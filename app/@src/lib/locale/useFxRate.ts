import { useEffect, useState } from 'react';
import PocketCore from '@/modules/pocket-module';
import { pocketBackend } from '@/@src/lib/api/pocketBackend';
import { ensureWalletCoreReady } from '@/@src/lib/core/walletCore';
import { getLocaleCurrency } from './currency';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from '@/@src/lib/firebase/client';

type FxState = {
  locale: string;
  currency: string;
  rate: number;
  ready: boolean;
};

export function useFxRate(): FxState {
  const [{ locale, currency }, setLocale] = useState(() => getLocaleCurrency());
  const [rate, setRate] = useState(1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    const bootstrap = async () => {
      const info = getLocaleCurrency();
      if (mounted) {
        setLocale(info);
      }
      if (info.currency === 'USD') {
        if (mounted) {
          setRate(1);
          setReady(true);
        }
        return;
      }

      const pair = `USD/${info.currency}`;

      try {
        await ensureWalletCoreReady();
        const cached = await PocketCore.latestFXRate(pair);
        if (cached) {
          const parsed = JSON.parse(cached) as { rate?: string };
          const parsedRate = Number(parsed.rate);
          if (Number.isFinite(parsedRate) && parsedRate > 0 && mounted) {
            setRate(parsedRate);
          }
        }
      } catch {
        // ignore cache errors
      }

      const db = getFirestoreDb();
      if (db) {
        const ref = doc(db, 'fxRates', pair.replace('/', '_'));
        unsubscribe = onSnapshot(ref, async (snap) => {
          const data = snap.data();
          if (!data) return;
          const parsedRate = Number(data.rate);
          if (Number.isFinite(parsedRate) && parsedRate > 0) {
            try {
              await PocketCore.upsertFXRate(pair, String(data.rate), Number(data.fetchedAt || Date.now()));
            } catch {
              // ignore cache errors
            }
            if (mounted) setRate(parsedRate);
          }
        });
      } else {
        try {
          if (pocketBackend.isConfigured()) {
            const latest = await pocketBackend.getFXRate(pair);
            const parsedRate = Number(latest.rate);
            if (Number.isFinite(parsedRate) && parsedRate > 0) {
              await PocketCore.upsertFXRate(pair, latest.rate, latest.fetchedAt);
              if (mounted) {
                setRate(parsedRate);
              }
            }
          }
        } catch {
          // ignore backend errors
        }
      }

      if (mounted) setReady(true);
    };

    bootstrap();
    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { locale, currency, rate, ready };
}
