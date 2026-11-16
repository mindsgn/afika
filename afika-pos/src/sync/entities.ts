/**
 * Entity names shared with the backend's pos_changes / pos_external_ids
 * (backend/api/internal/posstore/sync.go). Keep the two lists in sync.
 */
export const SYNC_ENTITIES = {
  business: 'business',
  category: 'category',
  product: 'product',
  customer: 'customer',
  sale: 'sale',
  saleItem: 'sale_item',
  refund: 'refund',
  stockMovement: 'stock_movement',
} as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[keyof typeof SYNC_ENTITIES];

/** Operations recorded in the local outbox. */
export type SyncOperation =
  | 'business.upsert'
  | 'category.upsert'
  | 'category.delete'
  | 'product.upsert'
  | 'product.archive'
  | 'product.stock'
  | 'customer.upsert'
  | 'sale.pending'
  | 'sale.create'
  | 'sale.complete'
  | 'sale.fail'
  | 'sale.void'
  | 'refund.create';

/** A change as delivered by GET /v1/pos/changes. */
export interface RemoteChange {
  seq: number;
  entity: string;
  entityId: string;
  externalId?: string;
  operation: 'upsert' | 'delete';
  data: Record<string, unknown> | null;
}

export interface ChangesPage {
  changes: RemoteChange[];
  cursor: number;
  hasMore: boolean;
}
