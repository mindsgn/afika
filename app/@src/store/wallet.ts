import { create } from 'zustand';

/** EOA on-chain transaction produced by the Go core's marshalTransactions helper. */
export type WalletTransaction = {
  hash: string;
  fromAddress: string;
  toAddress: string;
  description?: string;
  tokenAddress?: string;
  tokenSymbol: string;
  amount: string;
  feeNative?: string;
  feeEth: string;
  feeUsd?: string;
  feeZar?: string;
  usdAmount?: string;
  zarAmount?: string;
  network: string;
  mode: string;
  direction: 'credit' | 'debit';
  state: string;
  timestampMs?: number;
  timestamp: number;
};

export type TokenBalance = {
  symbol: string;
  address: string;
  amount?: string;
  balance: string;
  isNative: boolean;
  usdValue?: string;
  usdAmount?: string;
  zarAmount?: string;
  fetchedAt?: number;
  network?: string;
};

type WalletState = {
  walletAddress: string;
  network: string;
  balances: TokenBalance[];
  transactions: WalletTransaction[];
  setWalletAddress: (address: string) => void;
  setNetwork: (network: string) => void;
  setBalances: (balances: TokenBalance[]) => void;
  setBalancesJson: (json: string) => void; // kept for legacy callers
  setTransactions: (items: WalletTransaction[]) => void;
  clearWalletState: () => void;
};

const useWallet = create<WalletState>((set) => ({
  walletAddress: '',
  network: '',
  balances: [],
  transactions: [],
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setNetwork: (network) => set({ network }),
  setBalances: (balances) => set({ balances }),
  setBalancesJson: (json) => {
    try {
      const balances = JSON.parse(json) as TokenBalance[];
      set({ balances: Array.isArray(balances) ? balances : [] });
    } catch {
      set({ balances: [] });
    }
  },
  setTransactions: (transactions) => set({ transactions }),
  clearWalletState: () =>
    set({
      walletAddress: '',
      network: '',
      balances: [],
      transactions: [],
    }),
}));

export default useWallet;
