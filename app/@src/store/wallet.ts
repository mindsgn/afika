import { create } from 'zustand';

export type WalletTransaction = {
  hash: string;
  userOpHash?: string;
  token: string;
  amount: string;
  state: string;
  mode?: string;
  sponsorshipMode?: string;
  bundlerStatus?: string;
  createdAt?: number;
  metadata?: {
    source?: string;
    destination?: string;
    note?: string;
    providerId?: string;
  };
};

type WalletState = {
  walletAddress: string;
  balancesJson: string;
  transactions: WalletTransaction[];
  setWalletAddress: (address: string) => void;
  setBalancesJson: (summary: string) => void;
  setTransactions: (items: WalletTransaction[]) => void;
  clearWalletState: () => void;
};

const useWallet = create<WalletState>((set) => ({
  walletAddress: '',
  balancesJson: '{}',
  transactions: [],
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setBalancesJson: (balancesJson) => set({ balancesJson }),
  setTransactions: (transactions) => set({ transactions }),
  clearWalletState: () =>
    set({
      walletAddress: '',
      balancesJson: '{}',
      transactions: [],
    }),
}));

export default useWallet;