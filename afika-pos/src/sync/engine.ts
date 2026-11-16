/**
 * The sync cycle: push the local outbox, then pull the server's change feed.
 *
 * Local SQLite stays the source of truth while offline. A failed push never
 * deletes the outbox row; it is retried on the next cycle and surfaced in the
 * Sync screen as a conflict. Everything is best-effort: a network failure is
 * reported, never thrown into the UI.
 */
import type { PosDb } from '@/db/types';
import { hasBusiness } from '@/services/business';
import { createSyncClient } from './client';
import type { SyncClient } from './client';
import { getState, recordSyncResult } from './outbox';
import { pullChanges } from './pull';
import { pushOutbox } from './push';
import type { PushConflict } from './push';

export interface SyncOptions {
  /** Privy access token for authenticated requests. */
  accessToken?: string | null;
  /** Injected client for tests. */
  client?: SyncClient;
  now?: number;
}

export interface SyncResult {
  ok: boolean;
  pushed: number;
  failed: number;
  pulled: number;
  cursor: number;
  conflicts: PushConflict[];
  error: string | null;
  skipped: boolean;
}

function skippedResult(cursor: number): SyncResult {
  return { ok: true, pushed: 0, failed: 0, pulled: 0, cursor, conflicts: [], error: null, skipped: true };
}

/** Runs one push-then-pull cycle. Safe to call repeatedly. */
export async function syncNow(db: PosDb, options: SyncOptions = {}): Promise<SyncResult> {
  const state = getState(db);
  // Nothing to sync before onboarding: the API rejects unscoped writes.
  if (!hasBusiness(db)) return skippedResult(state.cursor);

  const client = options.client ?? createSyncClient({ accessToken: options.accessToken });
  const now = options.now ?? Date.now();

  try {
    const push = await pushOutbox(db, client, { now });
    const pull = await pullChanges(db, client);
    const error = push.conflicts.length
      ? `${push.conflicts.length} change(s) could not be pushed`
      : null;
    recordSyncResult(db, error, now);
    return {
      ok: push.conflicts.length === 0,
      pushed: push.pushed,
      failed: push.failed,
      pulled: pull.applied,
      cursor: getState(db).cursor,
      conflicts: push.conflicts,
      error,
      skipped: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordSyncResult(db, message, now);
    return {
      ok: false,
      pushed: 0,
      failed: 0,
      pulled: 0,
      cursor: getState(db).cursor,
      conflicts: [],
      error: message,
      skipped: false,
    };
  }
}
