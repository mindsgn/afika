import { parseUSDCAmount } from './sendUSDC';

describe('parseUSDCAmount', () => {
  it('parses whole numbers with 6 decimals', () => {
    expect(parseUSDCAmount('1')).toBe(1000000n);
  });

  it('parses decimals with 6 decimals', () => {
    expect(parseUSDCAmount('1.50')).toBe(1500000n);
  });

  it('rejects too many decimals', () => {
    expect(() => parseUSDCAmount('1.0000001')).toThrow('amount precision is too high');
  });
});
