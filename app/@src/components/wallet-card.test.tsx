import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import WalletCard from './wallet-card';

jest.mock('@/modules/pocket-module', () => ({
  getLatestBalances: jest.fn(async () => JSON.stringify([
    { tokenSymbol: 'USDC', balance: '5.0', usdValue: '5.0' },
  ])),
  syncBalances: jest.fn(async () => JSON.stringify([
    { tokenSymbol: 'USDC', balance: '7.5', usdValue: '7.5' },
  ])),
}));

jest.mock('@/@src/lib/core/walletCore', () => ({
  ensureWalletCoreReady: jest.fn(async () => '0xabc'),
  DEFAULT_NETWORK: 'ethereum-sepolia',
}));

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

describe('WalletCard', () => {
  it('renders localized balance', async () => {
    const { getByText } = render(<WalletCard />);
    await waitFor(() => {
      expect(getByText('$7.50')).toBeTruthy();
    });
  });
});
