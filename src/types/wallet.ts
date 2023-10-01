type WalletContextType = {
  address: string | null;
  transactions: any[] | null;
  setMagic: any | null;
  exhangeRate: number;
  balance: number;
  loading: boolean;
  network: any | null;
  tokens: any[] | null;
  marketData: any[];
  rates: any | null;
};

export { type WalletContextType };
