import { useEffect, useState } from 'react';
import PocketCore from '@/modules/pocket-module';
import { pocketBackend } from '@/@src/lib/api/pocketBackend';
import { ensureWalletCoreReady } from '@/@src/lib/core/walletCore';
import { getLocaleCurrency } from './currency';

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

      if (mounted) setReady(true);
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  return { locale, currency, rate, ready };
}
