import { NativeModule, requireNativeModule } from 'expo';

import { PocketApi, PocketNetwork, SendMode, TokenIdentifier } from './PocketModule.types';

declare class PocketModule extends NativeModule implements PocketApi {
  initWallet(dataDir: string, password: string, masterKeyB64: string, kdfSaltB64: string): Promise<void>;
  initWalletSecure(dataDir: string, password: string): Promise<void>;
  closeWallet(): Promise<void>;
  createEthereumWallet(name: string): Promise<string>;
  openOrCreateWallet(name: string): Promise<string>;
  getBalance(network: PocketNetwork): Promise<string>;
  getAccountSummary(network: string): Promise<string>;
  getAccountSnapshot(network: PocketNetwork): Promise<string>;
  listAccounts(): Promise<string>;
  sendUsdc(network: string, destination: string, amount: string, note: string, providerID: string): Promise<string>;
  sendUsdcWithMode(network: string, destination: string, amount: string, note: string, providerID: string, sendMode: SendMode): Promise<string>;
  sendToken(network: PocketNetwork, tokenIdentifier: TokenIdentifier, destination: string, amount: string, note: string, providerID: string): Promise<string>;
  sendTokenWithMode(network: PocketNetwork, tokenIdentifier: TokenIdentifier, destination: string, amount: string, note: string, providerID: string, sendMode: SendMode): Promise<string>;
  getUsdcTransactions(network: string, limit: number, offset: number): Promise<string>;
  getTokenTransactions(network: PocketNetwork, tokenIdentifier: TokenIdentifier, limit: number, offset: number): Promise<string>;
  listAllTransactions(network: PocketNetwork, limit: number, offset: number): Promise<string>;
  exportBackup(passphrase: string): Promise<string>;
  importBackup(payload: string, passphrase: string): Promise<string>;
  sendMoneyTo(network: PocketNetwork, destination: string, amount: string): Promise<string>;
  syncInboundTransactions(network: PocketNetwork): Promise<string>;
}

// This call loads the native module object from the JSI.
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
