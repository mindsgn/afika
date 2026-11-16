/**
 * The local half of the sync engine: an append-only outbox, the local/remote
 * id map and the pull cursor.
 *
 * Services call `enqueue` inside the same transaction as their business write,
 * so a mutation can never be lost between the two. Everything here is
 * synchronous SQLite and works offline; network I/O lives in client.ts.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { syncIds, syncOutbox, syncState } from '@/db/schema';
import type { SyncIdRow, SyncOutboxRow, SyncStateRow } from '@/db/schema';
import type { PosDb } from '@/db/types';
import type { SyncEntity, SyncOperation } from './entities';

const STATE_ID = 1;

function randomHex(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable per-install id, used to namespace every device-generated external id. */
export function deviceId(db: PosDb): string {
  const state = db.select().from(syncState).where(eq(syncState.id, STATE_ID)).get();
  if (state) return state.deviceId;
  const id = `device-${randomHex()}`;
  db.insert(syncState)
    .values({ id: STATE_ID, deviceId: id, cursor: 0 })
    .onConflictDoUpdate({ target: syncState.id, set: { deviceId: id } })
    .run();
  return id;
}

export function externalIdFor(db: PosDb, entity: SyncEntity, localId: number): string {
  return `${deviceId(db)}:${entity}:${localId}`;
}

/** Ensures the id map has a row for a local entity and returns its external id. */
export function ensureSyncId(db: PosDb, entity: SyncEntity, localId: number): string {
  const externalId = externalIdFor(db, entity, localId);
  db.insert(syncIds)
    .values({ entity, localId, remoteId: null, externalId })
    .onConflictDoUpdate({
      target: [syncIds.entity, syncIds.localId],
      set: { externalId },
    })
    .run();
  return externalId;
}

export interface EnqueueInput {
  entity: SyncEntity;
  localId: number;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  now?: number;
}

/** Records a mutation. Call inside the same transaction as the write. */
export function enqueue(db: PosDb, input: EnqueueInput): SyncOutboxRow {
  const externalId = ensureSyncId(db, input.entity, input.localId);
  const now = input.now ?? Date.now();
  return db
    .insert(syncOutbox)
    .values({
      entity: input.entity,
      localId: input.localId,
      operation: input.operation,
      externalId,
      payload: JSON.stringify(input.payload),
      idempotencyKey: `${externalId}:${input.operation}:${randomHex()}`,
      attempts: 0,
      createdAt: now,
    })
    .returning()
    .get();
}

export function getSyncId(db: PosDb, entity: SyncEntity, localId: number): SyncIdRow | undefined {
  return db
    .select()
    .from(syncIds)
    .where(and(eq(syncIds.entity, entity), eq(syncIds.localId, localId)))
    .get();
}

export function setRemoteId(db: PosDb, entity: SyncEntity, localId: number, remoteId: string, externalId?: string): void {
  const existing = getSyncId(db, entity, localId);
  const resolvedExternalId = externalId ?? existing?.externalId ?? externalIdFor(db, entity, localId);
  db.insert(syncIds)
    .values({ entity, localId, remoteId, externalId: resolvedExternalId })
    .onConflictDoUpdate({
      target: [syncIds.entity, syncIds.localId],
      set: { remoteId, externalId: resolvedExternalId },
    })
    .run();
}

export function remoteIdFor(db: PosDb, entity: SyncEntity, localId: number): string | undefined {
  return getSyncId(db, entity, localId)?.remoteId ?? undefined;
}

/** Finds a local row by a server id or a device-generated external id. */
export function localIdForRemote(db: PosDb, entity: SyncEntity, remoteId: string, externalId?: string): number | undefined {
  const byRemote = db
    .select()
    .from(syncIds)
    .where(and(eq(syncIds.entity, entity), eq(syncIds.remoteId, remoteId)))
    .get();
  if (byRemote) return byRemote.localId;
  if (externalId) {
    const byExternal = db
      .select()
      .from(syncIds)
      .where(and(eq(syncIds.entity, entity), eq(syncIds.externalId, externalId)))
      .get();
    if (byExternal) return byExternal.localId;
  }
  return undefined;
}

/** Links a pulled server row to a local row (or creates the mapping). */
export function linkRemote(
  db: PosDb,
  entity: SyncEntity,
  localId: number,
  remoteId: string,
  externalId: string,
): void {
  setRemoteId(db, entity, localId, remoteId, externalId || externalIdFor(db, entity, localId));
}

export function pendingOutbox(db: PosDb, limit = 50): SyncOutboxRow[] {
  return db
    .select()
    .from(syncOutbox)
    .where(isNull(syncOutbox.syncedAt))
    .orderBy(asc(syncOutbox.id))
    .limit(limit)
    .all();
}

export function pendingCount(db: PosDb): number {
  return (
    db
      .select({ count: sql<number>`count(*)` })
      .from(syncOutbox)
      .where(isNull(syncOutbox.syncedAt))
      .get()?.count ?? 0
  );
}

export function conflicts(db: PosDb): SyncOutboxRow[] {
  return db
    .select()
    .from(syncOutbox)
    .where(and(isNull(syncOutbox.syncedAt), sql`${syncOutbox.lastError} is not null`))
    .orderBy(asc(syncOutbox.id))
    .all();
}

/** A row is "clean" when it has no unsynced outbox entry (server may win). */
export function isClean(db: PosDb, entity: SyncEntity, localId: number): boolean {
  return (
    db
      .select({ count: sql<number>`count(*)` })
      .from(syncOutbox)
      .where(and(eq(syncOutbox.entity, entity), eq(syncOutbox.localId, localId), isNull(syncOutbox.syncedAt)))
      .get()?.count === 0
  );
}

export function markSynced(db: PosDb, id: number, now = Date.now()): void {
  db.update(syncOutbox)
    .set({ syncedAt: now, lastError: null })
    .where(eq(syncOutbox.id, id))
    .run();
}

export function markError(db: PosDb, id: number, message: string, now = Date.now()): void {
  db.update(syncOutbox)
    .set({ attempts: sql`${syncOutbox.attempts} + 1`, lastError: message })
    .where(eq(syncOutbox.id, id))
    .run();
}

export function clearError(db: PosDb, id: number): void {
  db.update(syncOutbox).set({ lastError: null }).where(eq(syncOutbox.id, id)).run();
}

/** Clears a previously recorded error so the row is retried on the next sync. */
export function retryOutboxRow(db: PosDb, id: number): void {
  clearError(db, id);
}

export function getState(db: PosDb): SyncStateRow {
  const state = db.select().from(syncState).where(eq(syncState.id, STATE_ID)).get();
  if (state) return state;
  const device = `device-${randomHex()}`;
  db.insert(syncState)
    .values({ id: STATE_ID, deviceId: device, cursor: 0 })
    .onConflictDoNothing()
    .run();
  return db.select().from(syncState).where(eq(syncState.id, STATE_ID)).get()!;
}

export function setCursor(db: PosDb, cursor: number): void {
  db.update(syncState).set({ cursor }).where(eq(syncState.id, STATE_ID)).run();
}

export function recordSyncResult(db: PosDb, error: string | null, now = Date.now()): void {
  db.update(syncState)
    .set({ lastSyncAt: now, lastError: error })
    .where(eq(syncState.id, STATE_ID))
    .run();
}
