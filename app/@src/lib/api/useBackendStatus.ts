import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { pocketBackend } from './pocketBackend';
import { getFirestoreDb } from '@/@src/lib/firebase/client';

type BackendStatus = {
  status: 'checking' | 'online' | 'offline';
  fromCache: boolean;
};

export function useBackendStatus(walletAddress?: string): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>({ status: 'checking', fromCache: false });

  useEffect(() => {
    let mounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (!pocketBackend.isConfigured()) {
        if (mounted) setStatus((s) => ({ ...s, status: 'offline' }));
        return;
      }
      try {
        await pocketBackend.health();
        if (mounted) setStatus((s) => ({ ...s, status: 'online' }));
      } catch {
        if (mounted) setStatus((s) => ({ ...s, status: 'offline' }));
      }
    };

    poll();
    interval = setInterval(poll, 30_000);

    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const db = getFirestoreDb();
    if (!db || !walletAddress) return;
    const ref = doc(db, 'wallets', walletAddress.toLowerCase());
    const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, (snap) => {
      setStatus((s) => ({ ...s, fromCache: snap.metadata.fromCache }));
    });
    return () => unsubscribe();
  }, [walletAddress]);

  return status;
}
