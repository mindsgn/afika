import { makeTestDb } from '@/db/testDb';
import { saveBusiness } from '@/services/business';
import { createProduct } from '@/services/catalog';
import { createPendingSale } from '@/services/checkout';
import { SYNC_ENTITIES } from './entities';
import {
  ensureSyncId,
  externalIdFor,
  isClean,
  localIdForRemote,
  markError,
  markSynced,
  pendingCount,
  pendingOutbox,
  setRemoteId,
  deviceId,
} from './outbox';

describe('sync outbox', () => {
  it('records service writes in order and keeps rows until they are synced', () => {
    const db = makeTestDb();
    saveBusiness(db, { name: 'Afika Coffee', address: '12 Long Street', website: 'afika.app' });
    const product = createProduct(db, {
      sku: 'FLATWHITE',
      name: 'Flat White',
      categoryId: null,
      price: 3200,
      costPrice: 1200,
      stock: 20,
      reorderLevel: 5,
    });
    const sale = createPendingSale(db, {
      items: [{ productId: product.id, qty: 2 }],
      method: 'usdc-base',
    });

    const rows = pendingOutbox(db);
    expect(rows.map((r) => r.operation)).toEqual([
      'business.upsert',
      'product.upsert',
      'sale.pending',
    ]);
    expect(rows.map((r) => r.localId)).toEqual([1, product.id, sale.saleId]);
    expect(pendingCount(db)).toBe(3);
    expect(new Set(rows.map((r) => r.idempotencyKey)).size).toBe(3);
    expect(JSON.parse(rows[1].payload)).toMatchObject({ sku: 'FLATWHITE', stock: 20 });
    expect(JSON.parse(rows[2].payload)).toMatchObject({
      items: [{ productId: product.id, qty: 2 }],
      paymentMethod: 'usdc-base',
    });
  });

  it('shares one device id across every external id', () => {
    const db = makeTestDb();
    const first = externalIdFor(db, SYNC_ENTITIES.product, 1);
    const second = externalIdFor(db, SYNC_ENTITIES.category, 2);
    expect(first.startsWith(`${deviceId(db)}:product:1`)).toBe(true);
    expect(second.startsWith(`${deviceId(db)}:category:2`)).toBe(true);
    expect(deviceId(db)).toBe(deviceId(db));
  });

  it('maps local ids to remote ids and back', () => {
    const db = makeTestDb();
    ensureSyncId(db, SYNC_ENTITIES.product, 7);
    expect(localIdForRemote(db, SYNC_ENTITIES.product, 'remote-7')).toBeUndefined();
    setRemoteId(db, SYNC_ENTITIES.product, 7, 'remote-7');
    expect(localIdForRemote(db, SYNC_ENTITIES.product, 'remote-7')).toBe(7);
    expect(localIdForRemote(db, SYNC_ENTITIES.category, 'remote-7')).toBeUndefined();
  });

  it('tracks clean rows, errors and successful drains', () => {
    const db = makeTestDb();
    saveBusiness(db, { name: 'Afika Coffee', address: '12 Long Street' });
    const [row] = pendingOutbox(db);
    expect(isClean(db, SYNC_ENTITIES.business, 1)).toBe(false);
    markError(db, row.id, 'INSUFFICIENT_STOCK: out of stock');
    expect(pendingOutbox(db)[0].lastError).toContain('INSUFFICIENT_STOCK');
    markSynced(db, row.id, 1234);
    expect(pendingCount(db)).toBe(0);
    expect(isClean(db, SYNC_ENTITIES.business, 1)).toBe(true);
  });

  it('does not enqueue when the business transaction rolls back', () => {
    const db = makeTestDb();
    createProduct(db, {
      sku: 'DUP', name: 'First', categoryId: null, price: 100, costPrice: 50,
    });
    const before = pendingCount(db);
    expect(() =>
      createProduct(db, { sku: 'DUP', name: 'Second', categoryId: null, price: 100, costPrice: 50 }),
    ).toThrow(/already in use/);
    expect(pendingCount(db)).toBe(before);
  });
});
