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

export type AAReadiness = {
  network: string;
  ownerAddress: string;
  accountAddress: string;
  smartAccountReady: boolean;
  entryPointConfigured: boolean;
  bundlerConfigured: boolean;
  paymasterConfigured: boolean;
  sponsorshipReady: boolean;
};

export type SmartAccountCreationReadiness = {
  network: string;
  ownerAddress: string;
  factoryAddress: string;
  entryPointAddress: string;
  smartAccountAddress: string;
  smartAccountExists: boolean;
  ownerBalanceWei: string;
  ownerRequiredMinGasWei: string;
  hasSufficientOwnerBalance: boolean;
  canUseSponsoredCreate: boolean;
  isReady: boolean;
  failureReasons: string[];
  warnings: string[];
};

type WalletState = {
  walletAddress: string;
  smartAccountAddress: string;
  balancesJson: string;
  transactions: WalletTransaction[];
  aaReadiness: AAReadiness | null;
  creationReadiness: SmartAccountCreationReadiness | null;
  setWalletAddress: (address: string) => void;
  setSmartAccountAddress: (address: string) => void;
  setBalancesJson: (summary: string) => void;
  setTransactions: (items: WalletTransaction[]) => void;
  setAAReadiness: (readiness: AAReadiness | null) => void;
  setCreationReadiness: (readiness: SmartAccountCreationReadiness | null) => void;
  clearWalletState: () => void;
};

const useWallet = create<WalletState>((set) => ({
  walletAddress: '',
  smartAccountAddress: '',
  balancesJson: '{}',
  transactions: [],
  aaReadiness: null,
  creationReadiness: null,
  setWalletAddress: (walletAddress) => set({ walletAddress }),
  setSmartAccountAddress: (smartAccountAddress) => set({ smartAccountAddress }),
  setBalancesJson: (balancesJson) => set({ balancesJson }),
  setTransactions: (transactions) => set({ transactions }),
  setAAReadiness: (aaReadiness) => set({ aaReadiness }),
  setCreationReadiness: (creationReadiness) => set({ creationReadiness }),
  clearWalletState: () =>
    set({
      walletAddress: '',
      smartAccountAddress: '',
      balancesJson: '{}',
      transactions: [],
      aaReadiness: null,
      creationReadiness: null,
    }),
}));

export default useWallet;