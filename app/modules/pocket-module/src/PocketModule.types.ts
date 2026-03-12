export type PocketNetwork = 'ethereum-mainnet' | 'ethereum-sepolia' | string;
export type TokenIdentifier = 'native' | 'usdc' | string;

export type PocketApi = {
  // Lifecycle
  initWallet(dataDir: string, masterKeyB64: string, kdfSaltB64: string): Promise<void>;
  initWalletSecure(dataDir: string): Promise<void>;
  closeWallet(): Promise<void>;

  // Network and token registration
  registerNetwork(name: string, rpcURL: string, chainID: number): Promise<void>;
  registerToken(network: string, identifier: string, symbol: string, address: string, decimals: number): Promise<void>;

  // Wallet management
  createEthereumWallet(name: string): Promise<string>;
  openOrCreateWallet(name: string): Promise<string>;
  getAddress(): Promise<string>;
  listAccounts(): Promise<string>;

  // Address utilities
  validateAddress(addr: string): Promise<string>;

  // Signing
  signMessage(message: string): Promise<string>;
  exportPrivateKey(): Promise<string>;

  // Balances (live network calls)
  getTokenBalance(networkName: string, tokenIdentifier: string): Promise<string>;
  getAllBalances(networkName: string): Promise<string>;

  // Price history
  getPriceHistory(networkName: string, limit: number): Promise<string>;

  // Watched addresses
  addWatchedAddress(address: string, label: string): Promise<void>;
  listWatchedAddresses(): Promise<string>;

  // Token transfers
  sendToken(networkName: string, tokenIdentifier: string, recipient: string, amount: string): Promise<string>;
  sendUSDC(networkName: string, recipient: string, amount: string): Promise<string>;

  // Transactions
  syncInboundTransactions(networkName: string): Promise<string>;
  listTokenTransactions(networkName: string, tokenIdentifier: string, limit: number, offset: number): Promise<string>;
  listAllTransactions(networkName: string, limit: number, offset: number): Promise<string>;

  // Backup
  exportWalletBackup(passphrase: string): Promise<string>;
  importWalletBackup(payload: string, passphrase: string): Promise<string>;
};
