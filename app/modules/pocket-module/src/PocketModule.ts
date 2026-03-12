import { NativeModule, requireNativeModule } from 'expo';

import { PocketApi } from './PocketModule.types';

declare class PocketModule extends NativeModule implements PocketApi {
  initWallet(dataDir: string, masterKeyB64: string, kdfSaltB64: string): Promise<void>;
  initWalletSecure(dataDir: string): Promise<void>;
  closeWallet(): Promise<void>;
  registerNetwork(name: string, rpcURL: string, chainID: number): Promise<void>;
  registerToken(network: string, identifier: string, symbol: string, address: string, decimals: number): Promise<void>;
  createEthereumWallet(name: string): Promise<string>;
  openOrCreateWallet(name: string): Promise<string>;
  getAddress(): Promise<string>;
  listAccounts(): Promise<string>;
  validateAddress(addr: string): Promise<string>;
  signMessage(message: string): Promise<string>;
  exportPrivateKey(): Promise<string>;
  getTokenBalance(networkName: string, tokenIdentifier: string): Promise<string>;
  getAllBalances(networkName: string): Promise<string>;
  syncBalances(networkName: string): Promise<string>;
  getLatestBalances(networkName: string): Promise<string>;
  getPriceHistory(networkName: string, limit: number): Promise<string>;
  upsertFXRate(pair: string, rate: string, fetchedAt: number): Promise<void>;
  latestFXRate(pair: string): Promise<string>;
  addWatchedAddress(address: string, label: string): Promise<void>;
  listWatchedAddresses(): Promise<string>;
  sendToken(networkName: string, tokenIdentifier: string, recipient: string, amount: string): Promise<string>;
  sendUSDC(networkName: string, recipient: string, amount: string): Promise<string>;
  syncInboundTransactions(networkName: string): Promise<string>;
  listTokenTransactions(networkName: string, tokenIdentifier: string, limit: number, offset: number): Promise<string>;
  listAllTransactions(networkName: string, limit: number, offset: number): Promise<string>;
  exportWalletBackup(passphrase: string): Promise<string>;
  importWalletBackup(payload: string, passphrase: string): Promise<string>;
}

let PocketCoreModule: PocketModule;

try {
  PocketCoreModule = requireNativeModule<PocketModule>('PocketCore');
} catch (error) {
  const details = error instanceof Error ? error.message : String(error);
  throw new Error(
    `[PocketCore] Native module is not registered. Rebuild native iOS project and confirm Expo autolinking includes PocketModule. Details: ${details}`,
  );
}

export default PocketCoreModule;
