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
  setWalletAddress: (walletAddress) => {
    console.log('🔧 [DEBUG] Setting wallet address:', walletAddress);
    console.log('🔧 [DEBUG] Address type:', typeof walletAddress);
    console.log('🔧 [DEBUG] Address length:', walletAddress?.length);
    set({ walletAddress });
  },
  setNetwork: (network) => {
    console.log('🔧 [DEBUG] Setting network:', network);
    set({ network });
  },
  setBalances: (balances) => {
    console.log('🔧 [DEBUG] Setting balances:', balances?.length, 'items');
    set({ balances });
  },
  setBalancesJson: (json) => {
    console.log('🔧 [DEBUG] Setting balances from JSON');
    try {
      const balances = JSON.parse(json) as TokenBalance[];
      console.log('🔧 [DEBUG] Parsed balances:', balances?.length, 'items');
      set({ balances: Array.isArray(balances) ? balances : [] });
    } catch (error) {
      console.error('🔧 [DEBUG] Failed to parse balances JSON:', error);
      set({ balances: [] });
    }
  },
  setTransactions: (transactions) => {
    console.log('🔧 [DEBUG] Setting transactions:', transactions?.length, 'items');
    set({ transactions });
  },
  clearWalletState: () => {
    console.log('🔧 [DEBUG] Clearing wallet state');
    set({
      walletAddress: '',
      network: '',
      balances: [],
      transactions: [],
    });
  },
}));

export default useWallet;
