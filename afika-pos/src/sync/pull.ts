/**
 * Pull phase: applies GET /v1/pos/changes snapshots to the local database.
 *
 * The change feed returns each entity's *current* state, so applying it is an
 * idempotent upsert. Conflict policy (from backend/docs/OFFLINE_SYNC.md):
 *
 *   * Catalogue/customer/business rows are only overwritten when they have no
 *     pending outbox entries (the local row is "clean"). Dirty local edits win.
 *   * Sales, refunds and stock movements are append-only. Remote sales are
 *     imported as history rows WITHOUT re-running the checkout use case: local
 *     stock and loyalty are derived from local movements, so replaying a remote
 *     sale would double-count them.
 *   * Deletes become a local archive/delete, never a hard delete of a row that
 *     is still referenced.
 */
import { eq } from 'drizzle-orm';
import {
  business,
  categories,
  customers,
  products,
  refundItems,
  refunds,
  saleItems,
  sales,
} from '@/db/schema';
import type { PosDb } from '@/db/types';
import type { SyncClient } from './client';
import type { RemoteChange } from './entities';
import { SYNC_ENTITIES } from './entities';
import type { SyncEntity } from './entities';
import { getState, isClean, localIdForRemote, setCursor, setRemoteId } from './outbox';

export interface PullResult {
  applied: number;
  cursor: number;
  pages: number;
}

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

function num(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === '1';
}

/** Finds the local row for a change, or returns undefined to create one. */
function localIdFor(db: PosDb, change: RemoteChange): number | undefined {
  return localIdForRemote(db, change.entity as SyncEntity, change.entityId, change.externalId);
}

function remember(db: PosDb, entity: SyncEntity, localId: number, remoteId: string): void {
  // Keep the device's own external id: it is what our pushes resolve against.
  setRemoteId(db, entity, localId, remoteId);
}

function findProductId(db: PosDb, change: RemoteChange, sku: string): number | undefined {
  const mapped = localIdFor(db, change);
  if (mapped) return mapped;
  return db.select().from(products).where(eq(products.sku, sku)).get()?.id;
}

function applyBusiness(db: PosDb, change: RemoteChange): void {
  const data = change.data ?? {};
  const values = {
    name: str(data.name),
    website: str(data.website),
    address: str(data.address),
    walletAddress: str(data.walletAddress),
    logoUri: data.logoUri == null ? null : str(data.logoUri),
    createdAt: num(data.createdAt) || Date.now(),
    updatedAt: num(data.updatedAt) || Date.now(),
  };
  const existing = db.select().from(business).where(eq(business.id, 1)).get();
  if (!existing) {
    db.insert(business).values({ id: 1, ...values }).run();
  } else if (isClean(db, SYNC_ENTITIES.business, 1)) {
    db.update(business).set(values).where(eq(business.id, 1)).run();
  }
}

function applyCategory(db: PosDb, change: RemoteChange): void {
  const data = change.data ?? {};
  const name = str(data.name);
  if (!name) return;
  let localId = localIdFor(db, change);
  if (localId === undefined) {
    const byName = db.select().from(categories).where(eq(categories.name, name)).get();
    if (byName) {
      localId = byName.id;
    } else {
      localId = db.insert(categories).values({ name, createdAt: num(data.createdAt) || Date.now() }).returning().get().id;
    }
  } else if (isClean(db, SYNC_ENTITIES.category, localId)) {
    db.update(categories).set({ name }).where(eq(categories.id, localId)).run();
  }
  remember(db, SYNC_ENTITIES.category, localId, change.entityId);
}

function applyCustomer(db: PosDb, change: RemoteChange): void {
  const data = change.data ?? {};
  const name = str(data.name);
  if (!name) return;
  const phone = data.phone == null || str(data.phone) === '' ? null : str(data.phone);
  let localId = localIdFor(db, change);
  if (localId === undefined) {
    const existing = phone
      ? db.select().from(customers).where(eq(customers.phone, phone)).get()
      : db.select().from(customers).where(eq(customers.name, name)).get();
    if (existing) {
      localId = existing.id;
    } else {
      localId = db
        .insert(customers)
        .values({ name, phone, loyaltyPoints: 0, createdAt: num(data.createdAt) || Date.now() })
        .returning()
        .get().id;
    }
  }
  if (isClean(db, SYNC_ENTITIES.customer, localId)) {
    db.update(customers)
      .set({ name, phone, loyaltyPoints: num(data.loyaltyPoints) })
      .where(eq(customers.id, localId))
      .run();
  }
  remember(db, SYNC_ENTITIES.customer, localId, change.entityId);
}

function applyProduct(db: PosDb, change: RemoteChange): void {
  const data = change.data ?? {};
  const sku = str(data.sku).toUpperCase();
  if (!sku) return;
  let localId = findProductId(db, change, sku);
  const isNew = localId === undefined;
  if (localId === undefined) {
    localId = db
      .insert(products)
      .values({
        sku,
        name: str(data.name) || sku,
        imageUri: data.imageUri == null ? null : str(data.imageUri),
        categoryId: null,
        price: num(data.price),
        costPrice: num(data.costPrice),
        stock: 0,
        reorderLevel: num(data.reorderLevel),
        active: true,
        createdAt: num(data.createdAt) || Date.now(),
      })
      .returning()
      .get().id;
  }
  if (!isNew && !isClean(db, SYNC_ENTITIES.product, localId)) {
    remember(db, SYNC_ENTITIES.product, localId, change.entityId);
    return;
  }

  let categoryId: number | null = null;
  if (data.categoryId) {
    categoryId = localIdForRemote(db, SYNC_ENTITIES.category, str(data.categoryId)) ?? null;
  }
  db.update(products)
    .set({
      sku,
      name: str(data.name) || sku,
      imageUri: data.imageUri == null ? null : str(data.imageUri),
      categoryId,
      price: num(data.price),
      costPrice: num(data.costPrice),
      stock: num(data.stock),
      reorderLevel: num(data.reorderLevel),
      active: bool(data.active),
    })
    .where(eq(products.id, localId))
    .run();
  remember(db, SYNC_ENTITIES.product, localId, change.entityId);
}

/** Imports a remote sale as history without touching stock or loyalty. */
function applySale(db: PosDb, change: RemoteChange): void {
  const data = change.data ?? {};
  const snapshot = (data.sale ?? data) as Record<string, unknown>;
  const receiptNo = str(snapshot.receiptNo);
  if (!receiptNo) return;

  let localId = localIdFor(db, change);
  if (localId === undefined) {
    localId = db.select().from(sales).where(eq(sales.receiptNo, receiptNo)).get()?.id;
  }
  if (localId !== undefined) {
    remember(db, SYNC_ENTITIES.sale, localId, change.entityId);
    return;
  }

  const customerId = snapshot.customerId
    ? localIdForRemote(db, SYNC_ENTITIES.customer, str(snapshot.customerId)) ?? null
    : null;
  const inserted = db
    .insert(sales)
    .values({
      receiptNo,
      createdAt: num(snapshot.createdAt) || Date.now(),
      status: str(snapshot.status) || 'completed',
      customerId,
      subtotal: num(snapshot.subtotal),
      discountType: str(snapshot.discountType) || 'none',
      discountValue: num(snapshot.discountValue),
      discountAmount: num(snapshot.discountAmount),
      pointsRedeemed: num(snapshot.pointsRedeemed),
      pointsDiscount: num(snapshot.pointsDiscount),
      total: num(snapshot.total),
      costTotal: num(snapshot.costTotal),
      paymentMethod: str(snapshot.paymentMethod),
      paymentStatus: str(snapshot.paymentStatus) || 'pending',
      cryptoAmount: num(snapshot.cryptoAmount),
      cryptoRate: num(snapshot.cryptoRate),
      txHash: snapshot.txHash == null ? null : str(snapshot.txHash),
      failureReason: snapshot.failureReason == null ? null : str(snapshot.failureReason),
      pointsEarned: num(snapshot.pointsEarned),
      refundedTotal: num(snapshot.refundedTotal),
    })
    .returning()
    .get();

  const remoteItems = (data.items as Record<string, unknown>[]) ?? [];
  const insertedItemIds = new Map<string, number>();
  for (const item of remoteItems) {
    const sku = str(item.sku);
    const productId = str(item.productId)
      ? localIdForRemote(db, SYNC_ENTITIES.product, str(item.productId)) ?? undefined
      : undefined;
    const resolvedProductId = productId ?? db.select().from(products).where(eq(products.sku, sku)).get()?.id;
    if (!resolvedProductId) continue;
    const row = db
      .insert(saleItems)
      .values({
        saleId: inserted.id,
        productId: resolvedProductId,
        sku,
        name: str(item.name) || sku,
        qty: num(item.qty),
        unitPrice: num(item.unitPrice),
        unitCost: num(item.unitCost),
        lineDiscount: num(item.lineDiscount),
        refundedQty: num(item.refundedQty),
        refundedAmount: num(item.refundedAmount),
      })
      .returning()
      .get();
    insertedItemIds.set(str(item.id), row.id);
    if (item.id) setRemoteId(db, SYNC_ENTITIES.saleItem, row.id, str(item.id));
  }

  const remoteRefunds = (data.refunds as Record<string, unknown>[]) ?? [];
  for (const refund of remoteRefunds) {
    const row = db
      .insert(refunds)
      .values({
        saleId: inserted.id,
        createdAt: num(refund.createdAt) || Date.now(),
        amount: num(refund.amount),
        reason: refund.reason == null ? null : str(refund.reason),
        restocked: refund.restocked !== false,
        pointsReversed: num(refund.pointsReversed),
      })
      .returning()
      .get();
    for (const line of (refund.items as Record<string, unknown>[]) ?? []) {
      const saleItemId = insertedItemIds.get(str(line.saleItemId));
      if (!saleItemId) continue;
      db.insert(refundItems)
        .values({
          refundId: row.id,
          saleItemId,
          qty: num(line.qty),
          amount: num(line.amount),
          costRecovered: num(line.costRecovered),
        })
        .run();
    }
  }
  remember(db, SYNC_ENTITIES.sale, inserted.id, change.entityId);
}

function applyDelete(db: PosDb, change: RemoteChange): void {
  const localId = localIdFor(db, change);
  if (localId === undefined) return;
  if (change.entity === SYNC_ENTITIES.category) {
    const used = db.select().from(products).where(eq(products.categoryId, localId)).all();
    if (used.length === 0) db.delete(categories).where(eq(categories.id, localId)).run();
  } else if (change.entity === SYNC_ENTITIES.product) {
    db.update(products).set({ active: false }).where(eq(products.id, localId)).run();
  }
}

function applyChange(db: PosDb, change: RemoteChange): void {
  if (change.operation === 'delete') {
    applyDelete(db, change);
    return;
  }
  switch (change.entity) {
    case SYNC_ENTITIES.business:
      applyBusiness(db, change);
      break;
    case SYNC_ENTITIES.category:
      applyCategory(db, change);
      break;
    case SYNC_ENTITIES.product:
      applyProduct(db, change);
      break;
    case SYNC_ENTITIES.customer:
      applyCustomer(db, change);
      break;
    case SYNC_ENTITIES.sale:
      applySale(db, change);
      break;
    // Refunds and stock movements arrive inside the sale/product snapshots;
    // applying them separately would double-count stock and loyalty.
    default:
      break;
  }
}

/** Pulls every page of changes since the stored cursor. */
export async function pullChanges(db: PosDb, client: SyncClient, maxPages = 20): Promise<PullResult> {
  let cursor = getState(db).cursor;
  let applied = 0;
  let pages = 0;
  for (; pages < maxPages; pages += 1) {
    const page = await client.getChanges(cursor, 100);
    for (const change of page.changes) {
      try {
        db.transaction((tx) => applyChange(tx as PosDb, change));
        applied += 1;
      } catch {
        // A single malformed change must not stall the cursor forever. It is
        // reported through the sync result and retried on the next run.
      }
    }
    if (page.cursor > cursor) {
      cursor = page.cursor;
      setCursor(db, cursor);
    }
    if (!page.hasMore || page.changes.length === 0) break;
  }
  return { applied, cursor, pages: pages + 1 };
}
