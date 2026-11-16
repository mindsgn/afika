import { usePrivy } from '@privy-io/expo';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getDb } from '@/db/client';
import type { SyncOutboxRow, SyncStateRow } from '@/db/schema';
import { E2E_ENABLED } from '@/lib/e2e';
import { syncNow } from '@/sync/engine';
import type { SyncResult } from '@/sync/engine';
import { conflicts, getState, pendingCount, retryOutboxRow } from '@/sync/outbox';

export type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

interface SyncContextValue {
  status: SyncStatus;
  result: SyncResult | null;
  pending: number;
  state: SyncStateRow;
  conflictRows: SyncOutboxRow[];
  sync: () => Promise<SyncResult | null>;
  refresh: () => void;
  retry: (outboxId: number) => Promise<SyncResult | null>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

/** Off by default in E2E builds so flows stay deterministic and offline. */
const AUTO_SYNC = !E2E_ENABLED && process.env.EXPO_PUBLIC_SYNC_AUTO !== '0';

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useMemo(() => getDb(), []);
  const { getAccessToken } = usePrivy();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [result, setResult] = useState<SyncResult | null>(null);
  const [snapshot, setSnapshot] = useState(() => readSnapshot(db));
  const running = useRef(false);

  const refresh = useCallback(() => setSnapshot(readSnapshot(db)), [db]);

  const run = useCallback(async (): Promise<SyncResult | null> => {
    if (running.current) return null;
    running.current = true;
    setStatus('syncing');
    let accessToken: string | null = null;
    try {
      if (typeof getAccessToken === 'function') accessToken = await getAccessToken();
    } catch {
      // Offline or Privy not ready: the shared API token still works.
    }
    try {
      const next = await syncNow(db, { accessToken });
      setResult(next);
      setStatus(next.ok ? 'done' : 'error');
      refresh();
      return next;
    } catch (error) {
      setStatus('error');
      setResult({
        ok: false, pushed: 0, failed: 0, pulled: 0, cursor: getState(db).cursor,
        conflicts: [], error: error instanceof Error ? error.message : String(error), skipped: false,
      });
      refresh();
      return null;
    } finally {
      running.current = false;
    }
  }, [db, getAccessToken, refresh]);

  const retry = useCallback(
    async (outboxId: number) => {
      retryOutboxRow(db, outboxId);
      refresh();
      return run();
    },
    [db, refresh, run],
  );

  useEffect(() => {
    if (!AUTO_SYNC) return;
    // One background cycle on start; failures are reported, never thrown.
    void run();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => subscription.remove();
  }, [run]);

  const value = useMemo<SyncContextValue>(
    () => ({
      status,
      result,
      pending: snapshot.pending,
      state: snapshot.state,
      conflictRows: snapshot.conflictRows,
      sync: run,
      refresh,
      retry,
    }),
    [status, result, snapshot, run, refresh, retry],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

function readSnapshot(db: ReturnType<typeof getDb>) {
  return {
    pending: pendingCount(db),
    state: getState(db),
    conflictRows: conflicts(db),
  };
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync must be used inside <SyncProvider>');
  return value;
}
