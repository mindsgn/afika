import React from 'react';
import { render } from '@testing-library/react-native';
import TransactionCard from './transaction-card';

jest.mock('@/@src/lib/locale/useFxRate', () => ({
  useFxRate: () => ({ locale: 'en-US', currency: 'USD', rate: 1, ready: true }),
}));

jest.mock('@/@src/lib/locale/currency', () => {
  const actual = jest.requireActual('@/@src/lib/locale/currency');
  return {
    ...actual,
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`,
  };
});

describe('TransactionCard', () => {
  it('renders localized usdAmount', () => {
    const tx = {
      amount: '2.5',
      tokenSymbol: 'USDC',
      usdAmount: '2.5',
      state: 'completed',
      timestamp: 1700000000,
      direction: 'credit',
    };
    const { getByText } = render(<TransactionCard tx={tx} />);
    expect(getByText('$2.50')).toBeTruthy();
  });
});
