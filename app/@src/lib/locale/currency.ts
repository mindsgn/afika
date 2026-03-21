import { getLocales } from 'expo-localization';

export type LocaleCurrency = {
  locale: string;
  currency: string;
  currencySymbol: string;
};

export function getLocaleCurrency(): LocaleCurrency {
  const locales = getLocales();
  const primary = locales[0];
  return {
    locale: primary?.languageTag ?? 'en-US',
    currency: primary?.currencyCode ?? 'USD',
    currencySymbol: primary?.currencySymbol ?? '$',
  };
}

export function formatCurrency(amount: number, locale: string, currency: string): string {
  if (!Number.isFinite(amount)) return '';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function convertUSD(usdString: string, fxRate: number): number | null {
  const value = Number(usdString);
  if (!usdString || Number.isNaN(value) || fxRate <= 0) {
    return null;
  }
  return value * fxRate;
}

// convertLocalAmountToUsd converts a localized currency string into USD amount.
// fxRate is USD/{local} (e.g. USD/ZAR = 18.5).
export function convertLocalAmountToUsd(amount: string, fxRate: number): string | null {
  if (!amount || fxRate <= 0) return null;
  const normalized = amount.replace(/,/g, '').trim();
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const usd = value / fxRate;
  if (!Number.isFinite(usd) || usd <= 0) return null;
  const fixed = usd.toFixed(6);
  return fixed.replace(/\.?0+$/, '');
}
