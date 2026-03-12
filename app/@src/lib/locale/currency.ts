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
