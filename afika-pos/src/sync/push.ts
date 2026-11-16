/**
 * Outbox drainer: pushes local mutations to the existing /v1/pos endpoints.
 *
 * Rows are drained in id order so a sale is never pushed before the products
 * and customer it references. Every create carries a device-generated
 * externalId; the drainer resolves it against the server's registry first, so
 * a retry never creates a duplicate. Sales and refunds also carry the row's
 * idempotencyKey so the server replays the original response.
 */
import { asc, eq } from 'drizzle-orm';
import { saleItems } from '@/db/schema';
import type { PosDb } from '@/db/types';
import { SyncApiError } from './client';
import type { SyncClient } from './client';
import { SYNC_ENTITIES } from './entities';
import type { SyncEntity } from './entities';
import {
  markError,
  markSynced,
  pendingOutbox,
  remoteIdFor,
  setRemoteId,
} from './outbox';

export interface PushConflict {
  outboxId: number;
  entity: string;
  localId: number;
  operation: string;
  code: string;
  message: string;
}

export interface PushResult {
  pushed: number;
  failed: number;
  conflicts: PushConflict[];
  /** True when a transient network error stopped the drain early. */
  stopped: boolean;
}

class UnresolvedReference extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

interface Created {
  id: string;
}

interface SaleDetailResponse {
  sale: { id: string };
  items: { id: string; sku: string }[];
}

/** Resolves a local row to its server id, registering the external id if the
 * server already knows it (for example after a retry or on another device). */
async function resolveRemote(
  db: PosDb,
  client: SyncClient,
  entity: SyncEntity,
  localId: number,
  externalId: string,
): Promise<string | undefined> {
  const known = remoteIdFor(db, entity, localId);
  if (known) return known;
  const fromServer = await client.resolveExternalId(entity, externalId);
  if (fromServer) {
    setRemoteId(db, entity, localId, fromServer, externalId);
    return fromServer;
  }
  return undefined;
}

/** Registers a freshly created server row in the local map and on the server. */
async function rememberCreated(
  db: PosDb,
  client: SyncClient,
  entity: SyncEntity,
  localId: number,
  externalId: string,
  remoteId: string,
): Promise<void> {
  setRemoteId(db, entity, localId, remoteId, externalId);
  await client.linkExternalId(entity, externalId, remoteId);
}

/** Maps local sale lines to the server's sale-item ids for later refunds. */
function mapSaleItems(db: PosDb, localSaleId: number, remoteItems: { id: string; sku: string }[]): void {
  const localLines = db
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, localSaleId))
    .orderBy(asc(saleItems.id))
    .all();
  const used = new Set<string>();
  for (const line of localLines) {
    const match = remoteItems.find((item) => item.sku === line.sku && !used.has(item.id));
    if (match) {
      used.add(match.id);
      setRemoteId(db, SYNC_ENTITIES.saleItem, line.id, match.id);
    }
  }
}

function asString(value: unknown): string {
  return value == null ? '' : String(value);
}

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function pushRow(db: PosDb, client: SyncClient, row: {
  id: number;
  entity: string;
  localId: number;
  operation: string;
  externalId: string;
  payload: string;
  idempotencyKey: string;
}): Promise<void> {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  const entity = row.entity as SyncEntity;
  const externalId = row.externalId;
  const localId = row.localId;
  const post = <T>(path: string, body: unknown, key?: string) =>
    client.request<T>(path, { method: 'POST', body: JSON.stringify(body) }, key);
  const put = <T>(path: string, body: unknown) =>
    client.request<T>(path, { method: 'PUT', body: JSON.stringify(body) });

  switch (row.operation) {
    case 'business.upsert': {
      await put('/v1/pos/business', {
        name: asString(payload.name),
        website: asString(payload.website),
        address: asString(payload.address),
        walletAddress: asString(payload.walletAddress),
        logoUri: asString(payload.logoUri),
      });
      return;
    }

    case 'category.upsert': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.category, localId, externalId);
      const body = { name: asString(payload.name) };
      if (remoteId) {
        await put(`/v1/pos/categories/${encodeURIComponent(remoteId)}`, body);
      } else {
        const created = await post<Created>('/v1/pos/categories', body);
        await rememberCreated(db, client, SYNC_ENTITIES.category, localId, externalId, created.id);
      }
      return;
    }

    case 'category.delete': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.category, localId, externalId);
      if (remoteId) {
        await client.request(`/v1/pos/categories/${encodeURIComponent(remoteId)}`, { method: 'DELETE' });
      }
      return;
    }

    case 'product.upsert': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.product, localId, externalId);
      let categoryId = '';
      if (payload.categoryId != null) {
        const resolved = remoteIdFor(db, SYNC_ENTITIES.category, asNumber(payload.categoryId));
        if (!resolved) throw new UnresolvedReference('CATEGORY_NOT_SYNCED', 'The category has not synced yet.');
        categoryId = resolved;
      }
      const body = {
        sku: asString(payload.sku),
        name: asString(payload.name),
        imageUri: asString(payload.imageUri),
        categoryId,
        price: asNumber(payload.price),
        costPrice: asNumber(payload.costPrice),
        stock: remoteId ? 0 : asNumber(payload.stock),
        reorderLevel: asNumber(payload.reorderLevel),
      };
      if (remoteId) {
        await put(`/v1/pos/products/${encodeURIComponent(remoteId)}`, body);
      } else {
        const created = await post<Created>('/v1/pos/products', body);
        await rememberCreated(db, client, SYNC_ENTITIES.product, localId, externalId, created.id);
      }
      return;
    }

    case 'product.archive': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.product, localId, externalId);
      if (!remoteId) throw new UnresolvedReference('PRODUCT_NOT_SYNCED', 'The product has not synced yet.');
      await post(`/v1/pos/products/${encodeURIComponent(remoteId)}/active`, { active: Boolean(payload.active) });
      return;
    }

    case 'product.stock': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.product, localId, externalId);
      if (!remoteId) throw new UnresolvedReference('PRODUCT_NOT_SYNCED', 'The product has not synced yet.');
      await post(`/v1/pos/products/${encodeURIComponent(remoteId)}/stock`, {
        kind: asString(payload.kind),
        delta: asNumber(payload.delta),
        unitCost: payload.unitCost == null ? null : asNumber(payload.unitCost),
        note: asString(payload.note),
      });
      return;
    }

    case 'customer.upsert': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.customer, localId, externalId);
      const body = { name: asString(payload.name), phone: asString(payload.phone) };
      if (remoteId) {
        await put(`/v1/pos/customers/${encodeURIComponent(remoteId)}`, body);
      } else {
        const created = await post<Created>('/v1/pos/customers', body);
        await rememberCreated(db, client, SYNC_ENTITIES.customer, localId, externalId, created.id);
      }
      return;
    }

    case 'sale.pending':
    case 'sale.create': {
      const lines = (payload.items as { productId: number; qty: number }[]) ?? [];
      const items = lines.map((line) => {
        const productId = remoteIdFor(db, SYNC_ENTITIES.product, line.productId);
        if (!productId) throw new UnresolvedReference('PRODUCT_NOT_SYNCED', 'A product in the sale has not synced yet.');
        return { productId, qty: line.qty };
      });
      let customerId = '';
      if (payload.customerId != null) {
        const resolved = remoteIdFor(db, SYNC_ENTITIES.customer, asNumber(payload.customerId));
        if (!resolved) throw new UnresolvedReference('CUSTOMER_NOT_SYNCED', 'The customer has not synced yet.');
        customerId = resolved;
      }
      const discountType = asString(payload.discountType) || 'none';
      const detail = await post<SaleDetailResponse>(
        '/v1/pos/sales',
        {
          items,
          discount: { type: discountType, value: asNumber(payload.discountValue) },
          customerId,
          redeemPoints: asNumber(payload.redeemPoints),
          paymentMethod: asString(payload.paymentMethod),
          complete: row.operation === 'sale.create',
          txHash: asString(payload.txHash),
          idempotencyKey: row.idempotencyKey,
        },
        row.idempotencyKey,
      );
      await rememberCreated(db, client, SYNC_ENTITIES.sale, localId, externalId, detail.sale.id);
      mapSaleItems(db, localId, detail.items ?? []);
      return;
    }

    case 'sale.complete': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.sale, localId, externalId);
      if (!remoteId) throw new UnresolvedReference('SALE_NOT_SYNCED', 'The sale has not synced yet.');
      await post(`/v1/pos/sales/${encodeURIComponent(remoteId)}/complete`, {
        txHash: asString(payload.txHash),
        cryptoAmount: payload.cryptoAmount == null ? '' : String(payload.cryptoAmount),
        cryptoRate: payload.cryptoRate == null ? '' : String(payload.cryptoRate),
      });
      return;
    }

    case 'sale.fail': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.sale, localId, externalId);
      if (!remoteId) throw new UnresolvedReference('SALE_NOT_SYNCED', 'The sale has not synced yet.');
      await post(`/v1/pos/sales/${encodeURIComponent(remoteId)}/fail`, { reason: asString(payload.reason) });
      return;
    }

    case 'sale.void': {
      const remoteId = await resolveRemote(db, client, SYNC_ENTITIES.sale, localId, externalId);
      if (!remoteId) throw new UnresolvedReference('SALE_NOT_SYNCED', 'The sale has not synced yet.');
      await post(`/v1/pos/sales/${encodeURIComponent(remoteId)}/void`, { reason: asString(payload.reason) });
      return;
    }

    case 'refund.create': {
      const saleRemoteId = remoteIdFor(db, SYNC_ENTITIES.sale, asNumber(payload.saleId));
      if (!saleRemoteId) throw new UnresolvedReference('SALE_NOT_SYNCED', 'The sale has not synced yet.');
      const lines = (payload.items as { saleItemId: number; qty: number }[]) ?? [];
      const items = lines.map((line) => {
        const saleItemId = remoteIdFor(db, SYNC_ENTITIES.saleItem, line.saleItemId);
        if (!saleItemId) throw new UnresolvedReference('SALE_ITEM_NOT_SYNCED', 'A sale line has not synced yet.');
        return { saleItemId, qty: line.qty };
      });
      const result = await post<{ refund: { id: string } }>(
        `/v1/pos/sales/${encodeURIComponent(saleRemoteId)}/refunds`,
        {
          items,
          reason: asString(payload.reason),
          restock: payload.restocked !== false,
          idempotencyKey: row.idempotencyKey,
        },
        row.idempotencyKey,
      );
      setRemoteId(db, SYNC_ENTITIES.refund, localId, result.refund.id, externalId);
      return;
    }

    default:
      throw new SyncApiError('UNKNOWN_OPERATION', `Unknown sync operation ${row.operation}`, 0, true);
  }
}

/** Drains the outbox in order. Returns conflicts for the UI to surface. */
export async function pushOutbox(
  db: PosDb,
  client: SyncClient,
  opts: { limit?: number; now?: number } = {},
): Promise<PushResult> {
  const rows = pendingOutbox(db, opts.limit ?? 50);
  const result: PushResult = { pushed: 0, failed: 0, conflicts: [], stopped: false };
  const now = opts.now ?? Date.now();

  for (const row of rows) {
    try {
      await pushRow(db, client, row);
      markSynced(db, row.id, now);
      result.pushed += 1;
    } catch (error) {
      let code = 'SYNC_FAILED';
      let message = error instanceof Error ? error.message : String(error);
      let permanent = false;
      if (error instanceof UnresolvedReference) {
        code = error.code;
        permanent = false; // ordering dependency; retry after the referenced row syncs
      } else if (error instanceof SyncApiError) {
        code = error.code;
        message = error.message;
        permanent = error.permanent;
      }
      markError(db, row.id, `${code}: ${message}`, now);
      result.failed += 1;
      result.conflicts.push({
        outboxId: row.id,
        entity: row.entity,
        localId: row.localId,
        operation: row.operation,
        code,
        message,
      });
      if (!permanent) {
        // Preserve outbox ordering: a later row may depend on this one.
        result.stopped = true;
        break;
      }
    }
  }
  return result;
}

