/**
 * Tests for the Transactions screen.
 *
 * PocketCore native module is fully mocked so these tests run in Node/Jest
 * without requiring a built iOS or Android binary.
 */
import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock the PocketCore native module
// ---------------------------------------------------------------------------
const mockInitWalletSecure = jest.fn().mockResolvedValue(undefined);
const mockOpenOrCreateWallet = jest.fn().mockResolvedValue('0xTESTADDRESS');
const mockSyncInboundTransactions = jest.fn().mockResolvedValue(JSON.stringify({ synced: 0 }));
const mockListAllTransactions = jest.fn().mockResolvedValue(JSON.stringify([]));

jest.mock('@/modules/pocket-module', () => ({
  __esModule: true,
  default: {
    initWalletSecure: (...args: unknown[]) => mockInitWalletSecure(...args),
    openOrCreateWallet: (...args: unknown[]) => mockOpenOrCreateWallet(...args),
    syncInboundTransactions: (...args: unknown[]) => mockSyncInboundTransactions(...args),
    listAllTransactions: (...args: unknown[]) => mockListAllTransactions(...args),
  },
}));

// Mock expo-file-system Directory / Paths used in the screen
jest.mock('expo-file-system', () => ({
  Directory: class {
    uri = '/test/dir';
    constructor() {}
  },
  Paths: { document: '/test/dir' },
}));

// ---------------------------------------------------------------------------
// Import the screen AFTER the mocks are registered
// ---------------------------------------------------------------------------
// eslint-disable-next-line import/first
import TransactionsScreen from '../app/(home)/transactions';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncInboundTransactions.mockResolvedValue(JSON.stringify({ synced: 0 }));
    mockListAllTransactions.mockResolvedValue(JSON.stringify([]));
    mockOpenOrCreateWallet.mockResolvedValue('0xTESTADDRESS');
  });

  it('renders without crashing', async () => {
    await act(async () => {
      render(<TransactionsScreen />);
    });
    expect(screen.getByTestId('transactions-screen')).toBeTruthy();
  });

  it('shows wallet address after init', async () => {
    await act(async () => {
      render(<TransactionsScreen />);
    });
    await waitFor(() => {
      expect(screen.getByText('0xTESTADDRESS')).toBeTruthy();
    });
  });

  it('shows "No transactions yet" when list is empty', async () => {
    await act(async () => {
      render(<TransactionsScreen />);
    });
    await waitFor(() => {
      expect(screen.getByText('No transactions yet')).toBeTruthy();
    });
  });

  it('calls syncInboundTransactions before listAllTransactions', async () => {
    const callOrder: string[] = [];
    mockSyncInboundTransactions.mockImplementation(async () => {
      callOrder.push('sync');
      return JSON.stringify({ synced: 0 });
    });
    mockListAllTransactions.mockImplementation(async () => {
      callOrder.push('list');
      return JSON.stringify([]);
    });

    await act(async () => {
      render(<TransactionsScreen />);
    });
    await waitFor(() => {
      expect(callOrder).toContain('sync');
      expect(callOrder).toContain('list');
      expect(callOrder.indexOf('sync')).toBeLessThan(callOrder.indexOf('list'));
    });
  });

  it('renders received transaction with correct direction label', async () => {
    const inboundTx = {
      hash: '0xabc',
      token: 'USDC',
      amount: '5',
      state: 'completed',
      type: 'credit',
      metadata: { source: '0xSENDER', destination: '0xTESTADDRESS' },
    };
    mockListAllTransactions.mockResolvedValue(JSON.stringify([inboundTx]));

    await act(async () => {
      render(<TransactionsScreen />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('tx-item-0')).toBeTruthy();
      // Direction label: "↓ Received USDC 5"
      expect(screen.getByText(/Received/)).toBeTruthy();
    });
  });

  it('renders sent transaction with correct direction label', async () => {
    const outboundTx = {
      hash: '0xdef',
      token: 'USDC',
      amount: '2',
      state: 'completed',
      type: 'debit',
      metadata: { source: '0xTESTADDRESS', destination: '0xRECIPIENT' },
    };
    mockListAllTransactions.mockResolvedValue(JSON.stringify([outboundTx]));

    await act(async () => {
      render(<TransactionsScreen />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('tx-item-0')).toBeTruthy();
      expect(screen.getByText(/Sent/)).toBeTruthy();
    });
  });

  it('shows Wallet ready status after successful init', async () => {
    await act(async () => {
      render(<TransactionsScreen />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('transactions-status')).toHaveTextContent('Wallet ready');
    });
  });

  it('shows error status when init fails', async () => {
    mockInitWalletSecure.mockRejectedValueOnce(new Error('keychain failure'));

    await act(async () => {
      render(<TransactionsScreen />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('transactions-status')).toHaveTextContent('Init failed');
    });
  });

  it('does not crash when syncInboundTransactions fails', async () => {
    mockSyncInboundTransactions.mockRejectedValueOnce(new Error('network error'));

    await act(async () => {
      render(<TransactionsScreen />);
    });
    // Should still show the screen and transactions (sync error is swallowed)
    await waitFor(() => {
      expect(screen.getByTestId('transactions-screen')).toBeTruthy();
    });
  });
});
