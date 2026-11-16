import { eq } from 'drizzle-orm';
import { categories, products } from '@/db/schema';
import { makeTestDb } from '@/db/testDb';
import { saveBusiness } from '@/services/business';
import { createCategory, createProduct, listProducts } from '@/services/catalog';
import { createPendingSale } from '@/services/checkout';
import { getSale, listSales } from '@/services/sales';
import { createSyncClient, SyncApiError } from './client';
import type { SyncClient } from './client';
import { syncNow } from './engine';
import type { ChangesPage, RemoteChange } from './entities';
import { SYNC_ENTITIES } from './entities';
import { conflicts, getState, pendingCount, remoteIdFor, setRemoteId } from './outbox';
import { pullChanges } from './pull';

interface Call {
  path: string;
  method: string;
  body: Record<string, unknown> | undefined;
  key?: string;
}

/** A small in-memory stand-in for the Go API, recording every push. */
function fakeApi() {
  const calls: Call[] = [];
  const external = new Map<string, string>();
  const productSkus = new Map<string, string>();
  const changes: RemoteChange[] = [];
  let counter = 0;
  let failProduct = false;
  const nextId = (prefix: string) => `${prefix}-${++counter}`;
  const registryKey = (entity: string, externalId: string) => `${entity}:${externalId}`;

  const client: SyncClient = {
    async request<T>(path: string, init: RequestInit = {}, key?: string): Promise<T> {
      const method = init.method ?? 'GET';
      const body = init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
      calls.push({ path, method, body, key });

      if (path.startsWith('/v1/pos/external-ids?')) {
        const params = new URLSearchParams(path.split('?')[1] ?? '');
        const found = external.get(registryKey(params.get('entity') ?? '', params.get('externalId') ?? ''));
        if (!found) throw new SyncApiError('NOT_FOUND', 'not found', 404, true);
        return { entityId: found } as T;
      }
      if (path === '/v1/pos/external-ids' && method === 'POST') {
        external.set(registryKey(String(body?.entity), String(body?.externalId)), String(body?.entityId));
        return body as T;
      }
      if (path === '/v1/pos/business' && method === 'PUT') return { id: 'biz-1', ...body } as T;
      if (path === '/v1/pos/products' && method === 'POST') {
        if (failProduct) throw new SyncApiError('SKU_EXISTS', 'SKU already in use', 400, true);
        const id = nextId('prod');
        productSkus.set(id, String(body?.sku));
        return { id } as T;
      }
      if (path === '/v1/pos/products' && method === 'PUT') return body as T;
      if (path.startsWith('/v1/pos/products/') && path.endsWith('/active')) return body as T;
      if (path.startsWith('/v1/pos/products/') && path.endsWith('/stock')) return body as T;
      if (path === '/v1/pos/customers' && method === 'POST') return { id: nextId('cust') } as T;
      if (path === '/v1/pos/categories' && method === 'POST') return { id: nextId('cat') } as T;
      if (path === '/v1/pos/sales' && method === 'POST') {
        const items = (body?.items as { productId: string; qty: number }[]) ?? [];
        return {
          sale: { id: nextId('sale') },
          items: items.map((item, index) => ({
            id: `item-${counter}-${index}`,
            sku: productSkus.get(item.productId) ?? 'UNKNOWN',
          })),
          refunds: [],
        } as T;
      }
      if (path.endsWith('/complete') || path.endsWith('/fail') || path.endsWith('/void')) {
        return { sale: { id: 'sale' } } as T;
      }
      throw new SyncApiError('NOT_FOUND', `unexpected path ${path}`, 404, true);
    },
    async getChanges(since: number): Promise<ChangesPage> {
      const pending = changes.filter((change) => change.seq > since);
      const cursor = pending.reduce((max, change) => Math.max(max, change.seq), since);
      return { changes: pending, cursor, hasMore: false };
    },
    async resolveExternalId(entity: string, externalId: string) {
      try {
        const result = await client.request<{ entityId: string }>(
          `/v1/pos/external-ids?entity=${encodeURIComponent(entity)}&externalId=${encodeURIComponent(externalId)}`,
        );
        return result?.entityId ?? null;
      } catch (error) {
        if (error instanceof SyncApiError && error.status === 404) return null;
        throw error;
      }
    },
    async linkExternalId(entity: string, externalId: string, entityId: string) {
      await client.request('/v1/pos/external-ids', {
        method: 'POST',
        body: JSON.stringify({ entity, externalId, entityId }),
      });
    },
  };

  return {
    client,
    calls,
    external,
    changes,
    setFailProduct: (value: boolean) => {
      failProduct = value;
    },
  };
}

function remoteProduct(overrides: Partial<Record<string, unknown>> = {}): RemoteChange {
  return {
    seq: 1,
    entity: SYNC_ENTITIES.product,
    entityId: 'prod-remote-99',
    externalId: 'other-device:product:1',
    operation: 'upsert',
    data: {
      id: 'prod-remote-99', sku: 'CORTADO', name: 'Cortado', imageUri: '',
      categoryId: '', price: 3000, costPrice: 1100, stock: 8, reorderLevel: 2,
      active: true, createdAt: 1, updatedAt: 1, ...overrides,
    },
  };
}

describe('syncNow', () => {
  it('pushes the outbox in order, links external ids and pulls a remote change', async () => {
    const db = makeTestDb();
    const api = fakeApi();
    saveBusiness(db, { name: 'Afika Coffee', address: '12 Long Street', website: 'afika.app' });
    const product = createProduct(db, {
      sku: 'FLATWHITE', name: 'Flat White', categoryId: null, price: 3200, costPrice: 1200, stock: 20,
    });
    const sale = createPendingSale(db, { items: [{ productId: product.id, qty: 2 }], method: 'usdc-base' });
    api.changes.push(remoteProduct());

    const result = await syncNow(db, { client: api.client, now: 1000 });

    expect(result.skipped).toBe(false);
    expect(result.ok).toBe(true);
    expect(result.pushed).toBe(3);
    expect(result.pulled).toBe(1);
    expect(result.conflicts).toHaveLength(0);
    expect(pendingCount(db)).toBe(0);
    expect(getState(db).cursor).toBe(1);
    expect(result.cursor).toBe(1);

    const businessCall = api.calls.find((c) => c.path === '/v1/pos/business' && c.method === 'PUT');
    expect(businessCall?.body).toMatchObject({ name: 'Afika Coffee', address: '12 Long Street' });

    const productCall = api.calls.find((c) => c.path === '/v1/pos/products' && c.method === 'POST');
    expect(productCall?.body).toMatchObject({ sku: 'FLATWHITE', stock: 20, price: 3200 });

    const saleCall = api.calls.find((c) => c.path === '/v1/pos/sales' && c.method === 'POST');
    expect(saleCall?.body).toMatchObject({ complete: false, paymentMethod: 'usdc-base' });
    expect(saleCall?.body?.items).toEqual([
      { productId: remoteIdFor(db, SYNC_ENTITIES.product, product.id), qty: 2 },
    ]);
    expect(typeof saleCall?.body?.idempotencyKey).toBe('string');
    expect(saleCall?.key).toBe(saleCall?.body?.idempotencyKey);

    // The server registry knows our device id, and the local map knows the
    // server id for the sale (so a later complete/void push can find it).
    expect([...api.external.values()]).toEqual(
      expect.arrayContaining([remoteIdFor(db, SYNC_ENTITIES.product, product.id)]),
    );
    expect(remoteIdFor(db, SYNC_ENTITIES.sale, sale.saleId)).toBeDefined();

    // The pulled product from another device is present with the server's stock.
    const pulled = listProducts(db).find((p) => p.sku === 'CORTADO');
    expect(pulled).toMatchObject({ name: 'Cortado', stock: 8, price: 3000 });
    expect(conflicts(db)).toHaveLength(0);
  });

  it('keeps a permanently rejected row and reports it as a conflict', async () => {
    const db = makeTestDb();
    const api = fakeApi();
    saveBusiness(db, { name: 'Afika Coffee', address: '12 Long Street' });
    createProduct(db, { sku: 'DUP', name: 'Duplicate', categoryId: null, price: 100, costPrice: 50 });
    api.setFailProduct(true);

    const first = await syncNow(db, { client: api.client });
    expect(first.ok).toBe(false);
    expect(first.conflicts).toHaveLength(1);
    expect(first.conflicts[0].code).toBe('SKU_EXISTS');
    expect(pendingCount(db)).toBe(1);
    expect(conflicts(db)).toHaveLength(1);

    api.setFailProduct(false);
    const second = await syncNow(db, { client: api.client });
    expect(second.ok).toBe(true);
    expect(second.pushed).toBe(1);
    expect(pendingCount(db)).toBe(0);
    expect(conflicts(db)).toHaveLength(0);
  });

  it('skips the cycle before business onboarding', async () => {
    const db = makeTestDb();
    const api = fakeApi();
    const result = await syncNow(db, { client: api.client });
    expect(result.skipped).toBe(true);
    expect(api.calls).toHaveLength(0);
  });

  it('does not overwrite a dirty local product with a server snapshot', async () => {
    const db = makeTestDb();
    const api = fakeApi();
    saveBusiness(db, { name: 'Afika Coffee', address: '12 Long Street' });
    createProduct(db, { sku: 'CORTADO', name: 'Cortado', categoryId: null, price: 3000, costPrice: 1100, stock: 4 });
    // The local create is still unsynced (pull in isolation), so the pulled
    // snapshot must not win over the dirty local row.
    api.changes.push(remoteProduct({ stock: 99, price: 9999 }));
    await pullChanges(db, api.client);
    const local = listProducts(db).find((p) => p.sku === 'CORTADO');
    expect(local?.stock).toBe(4);
    expect(local?.price).toBe(3000);
  });

  it('imports a remote sale as history without changing local stock', async () => {
    const db = makeTestDb();
    const api = fakeApi();
    saveBusiness(db, { name: 'Afika Coffee', address: '12 Long Street' });
    const product = createProduct(db, {
      sku: 'FLATWHITE', name: 'Flat White', categoryId: null, price: 3200, costPrice: 1200, stock: 20,
    });

    api.changes.push({
      seq: 1,
      entity: SYNC_ENTITIES.sale,
      entityId: 'sale-remote-1',
      operation: 'upsert',
      data: {
        sale: {
          id: 'sale-remote-1', receiptNo: 'R-000042', createdAt: 1000, updatedAt: 1000,
          status: 'completed', subtotal: 3200, discountType: 'none', discountValue: 0,
          discountAmount: 0, pointsRedeemed: 0, pointsDiscount: 0, total: 3200,
          costTotal: 1200, paymentMethod: 'usdc-base', paymentStatus: 'success',
          cryptoAmount: '1.7', cryptoRate: '18', pointsEarned: 3, refundedTotal: 0,
        },
        items: [{
          id: 'item-remote-1', saleId: 'sale-remote-1', productId: 'prod-remote-1',
          sku: 'FLATWHITE', name: 'Flat White', qty: 1, unitPrice: 3200, unitCost: 1200,
          lineDiscount: 0, refundedQty: 0, refundedAmount: 0,
        }],
        refunds: [],
      },
    });

    const result = await pullChanges(db, api.client);
    expect(result.applied).toBe(1);
    expect(result.cursor).toBe(1);

    const imported = listSales(db);
    expect(imported).toHaveLength(1);
    expect(imported[0].receiptNo).toBe('R-000042');
    expect(imported[0].status).toBe('completed');
    expect(getSale(db, imported[0].id)?.items).toHaveLength(1);
    // Stock and loyalty are derived locally; importing history must not replay
    // the sale through the checkout use case.
    expect(db.select().from(products).where(eq(products.id, product.id)).get()?.stock).toBe(20);
    expect(remoteIdFor(db, SYNC_ENTITIES.sale, imported[0].id)).toBe('sale-remote-1');
  });

  it('applies a delete tombstone to an unused category', async () => {
    const db = makeTestDb();
    const api = fakeApi();
    saveBusiness(db, { name: 'Afika Coffee', address: '12 Long Street' });
    const category = createCategory(db, 'Seasonal');
    setRemoteId(db, SYNC_ENTITIES.category, category.id, 'cat-remote-1');

    api.changes.push({
      seq: 1,
      entity: SYNC_ENTITIES.category,
      entityId: 'cat-remote-1',
      operation: 'delete',
      data: { id: 'cat-remote-1' },
    });
    await pullChanges(db, api.client);
    expect(db.select().from(categories).where(eq(categories.id, category.id)).get()).toBeUndefined();
  });
});

describe('createSyncClient', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_API_TOKEN;
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('builds the URL, envelope and headers', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ data: { cursor: 7, changes: [], hasMore: false } }), { status: 200 });
    }) as unknown as typeof fetch;

    const client = createSyncClient({ baseUrl: 'http://localhost:8787/', fetchImpl, accessToken: 'privy-token' });
    const page = await client.getChanges(3, 25);
    expect(page.cursor).toBe(7);
    expect(calls[0].url).toBe('http://localhost:8787/v1/pos/changes?since=3&limit=25');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer privy-token');
  });

  it('maps a 404 to null when resolving an external id', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'missing' } }), { status: 404 })) as unknown as typeof fetch;
    const client = createSyncClient({ baseUrl: 'http://localhost:8787', fetchImpl });
    await expect(client.resolveExternalId('product', 'unknown')).resolves.toBeNull();
  });

  it('turns a business-rule error into a permanent SyncApiError', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { code: 'SKU_EXISTS', message: 'taken' } }), { status: 400 })) as unknown as typeof fetch;
    const client = createSyncClient({ baseUrl: 'http://localhost:8787', fetchImpl });
    await expect(client.request('/v1/pos/products', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      code: 'SKU_EXISTS',
      status: 400,
      permanent: true,
    });
  });
});
