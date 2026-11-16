import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at').notNull(),
});

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  imageUri: text('image_uri'),
  categoryId: integer('category_id').references(() => categories.id),
  price: integer('price').notNull(), // cents
  costPrice: integer('cost_price').notNull().default(0), // cents
  stock: integer('stock').notNull().default(0),
  reorderLevel: integer('reorder_level').notNull().default(0),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
});

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone').unique(),
  loyaltyPoints: integer('loyalty_points').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const sales = sqliteTable('sales', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  receiptNo: text('receipt_no').notNull().unique(),
  createdAt: integer('created_at').notNull(),
  // completed | failed | voided | refunded | partially_refunded
  status: text('status').notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  subtotal: integer('subtotal').notNull(),
  discountType: text('discount_type').notNull().default('none'),
  discountValue: integer('discount_value').notNull().default(0),
  discountAmount: integer('discount_amount').notNull().default(0),
  pointsRedeemed: integer('points_redeemed').notNull().default(0),
  pointsDiscount: integer('points_discount').notNull().default(0),
  total: integer('total').notNull(),
  costTotal: integer('cost_total').notNull().default(0),
  paymentMethod: text('payment_method').notNull(), // USDC | BTC | ETH
  paymentStatus: text('payment_status').notNull(), // success | failed
  cryptoAmount: real('crypto_amount').notNull().default(0),
  cryptoRate: real('crypto_rate').notNull().default(0),
  txHash: text('tx_hash'),
  failureReason: text('failure_reason'),
  pointsEarned: integer('points_earned').notNull().default(0),
  refundedTotal: integer('refunded_total').notNull().default(0),
  voidedAt: integer('voided_at'),
  voidReason: text('void_reason'),
});

export const saleItems = sqliteTable('sale_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id').notNull().references(() => sales.id),
  productId: integer('product_id').notNull().references(() => products.id),
  sku: text('sku').notNull(),
  name: text('name').notNull(),
  qty: integer('qty').notNull(),
  unitPrice: integer('unit_price').notNull(),
  unitCost: integer('unit_cost').notNull().default(0),
  lineDiscount: integer('line_discount').notNull().default(0),
  refundedQty: integer('refunded_qty').notNull().default(0),
  refundedAmount: integer('refunded_amount').notNull().default(0),
});

export const refunds = sqliteTable('refunds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  saleId: integer('sale_id').notNull().references(() => sales.id),
  createdAt: integer('created_at').notNull(),
  amount: integer('amount').notNull(),
  reason: text('reason'),
  restocked: integer('restocked', { mode: 'boolean' }).notNull().default(true),
  pointsReversed: integer('points_reversed').notNull().default(0),
});

export const refundItems = sqliteTable('refund_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  refundId: integer('refund_id').notNull().references(() => refunds.id),
  saleItemId: integer('sale_item_id').notNull().references(() => saleItems.id),
  qty: integer('qty').notNull(),
  amount: integer('amount').notNull(),
  costRecovered: integer('cost_recovered').notNull().default(0),
});

export const stockMovements = sqliteTable('stock_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  // initial | sale | refund | void | restock | adjustment
  type: text('type').notNull(),
  quantity: integer('quantity').notNull(), // signed
  balanceAfter: integer('balance_after').notNull(),
  unitCost: integer('unit_cost'), // cost price tracking (cents), when known
  reference: text('reference'),
  note: text('note'),
  createdAt: integer('created_at').notNull(),
});

/**
 * The merchant's business profile. There is at most one row (id = 1); the
 * onboarding flow writes it on first launch and receipts read it.
 */
export const business = sqliteTable('business', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  website: text('website').notNull().default(''),
  address: text('address').notNull().default(''),
  logoUri: text('logo_uri'),
  walletAddress: text('wallet_address').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * A shareable online payment for a pending sale. `id` is the id issued by the
 * payments API; the local row mirrors it so the app can show progress and
 * finalise the sale once the receipt worker confirms the transaction.
 */
export const paymentRequests = sqliteTable('payment_requests', {
  id: text('id').primaryKey(),
  saleId: integer('sale_id').notNull().references(() => sales.id),
  receiptNo: text('receipt_no').notNull(),
  asset: text('asset').notNull(),
  network: text('network').notNull(),
  address: text('address').notNull(),
  amountCents: integer('amount_cents').notNull(),
  cryptoAmount: text('crypto_amount').notNull(),
  paymentUrl: text('payment_url').notNull(),
  // pending | paid | expired | failed
  status: text('status').notNull().default('pending'),
  txHash: text('tx_hash'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Append-only outbox. Every local mutation writes one row in the same
 * transaction as the business write; the sync engine drains it in id order.
 */
export const syncOutbox = sqliteTable('sync_outbox', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  entity: text('entity').notNull(),
  localId: integer('local_id').notNull(),
  operation: text('operation').notNull(),
  externalId: text('external_id').notNull(),
  payload: text('payload').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
  syncedAt: integer('synced_at'),
});

/** Local integer id <-> server string id, keyed by the device's external id. */
export const syncIds = sqliteTable(
  'sync_ids',
  {
    entity: text('entity').notNull(),
    localId: integer('local_id').notNull(),
    remoteId: text('remote_id'),
    externalId: text('external_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.entity, t.localId] })],
);

/** One row (id = 1) holding the pull cursor and the last sync result. */
export const syncState = sqliteTable('sync_state', {
  id: integer('id').primaryKey(),
  deviceId: text('device_id').notNull(),
  cursor: integer('cursor').notNull().default(0),
  lastSyncAt: integer('last_sync_at'),
  lastError: text('last_error'),
});

export type SyncOutboxRow = typeof syncOutbox.$inferSelect;
export type SyncIdRow = typeof syncIds.$inferSelect;
export type SyncStateRow = typeof syncState.$inferSelect;

export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type Refund = typeof refunds.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Business = typeof business.$inferSelect;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
