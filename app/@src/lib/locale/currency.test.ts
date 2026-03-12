import { convertUSD, formatCurrency, getLocaleCurrency } from './currency';
import * as Localization from 'expo-localization';

describe('currency helpers', () => {
  it('convertUSD returns null for invalid input', () => {
    expect(convertUSD('', 10)).toBeNull();
    expect(convertUSD('abc', 10)).toBeNull();
    expect(convertUSD('1', 0)).toBeNull();
  });

  it('convertUSD multiplies by fx rate', () => {
    expect(convertUSD('1.5', 18.5)).toBeCloseTo(27.75);
  });

  it('formatCurrency returns a string', () => {
    const result = formatCurrency(1234.56, 'en-US', 'USD');
    expect(typeof result).toBe('string');
  });

  it('getLocaleCurrency falls back to USD', () => {
    jest.spyOn(Localization, 'getLocales').mockReturnValueOnce([] as any);
    const info = getLocaleCurrency();
    expect(info.currency).toBe('USD');
  });
});
