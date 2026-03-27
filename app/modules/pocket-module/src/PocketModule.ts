import { NativeModule, requireNativeModule } from 'expo';

import { PocketApi } from './PocketModule.types';

declare class PocketModule extends NativeModule implements PocketApi {
  initWallet(dataDir: string, masterKeyB64: string, kdfSaltB64: string): Promise<void>;
  initWalletSecure(dataDir: string): Promise<void>;
  closeWallet(): Promise<void>;
  testInitWalletSecure(dataDir: string): Promise<string>;
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
  upsertBalanceSnapshots(jsonPayload: string): Promise<void>;
  getPriceHistory(networkName: string, limit: number): Promise<string>;
  upsertFXRate(pair: string, rate: string, fetchedAt: number): Promise<void>;
  latestFXRate(pair: string): Promise<string>;
  addWatchedAddress(address: string, label: string): Promise<void>;
  listWatchedAddresses(): Promise<string>;
  saveRecipient(jsonPayload: string): Promise<string>;
  getRecipient(id: string): Promise<string>;
  getAllRecipients(): Promise<string>;
  searchRecipientsByName(name: string): Promise<string>;
  searchRecipientsByPhone(phone: string): Promise<string>;
  updateRecipient(jsonPayload: string): Promise<string>;
  sendToken(networkName: string, tokenIdentifier: string, recipient: string, amount: string): Promise<string>;
  sendUSDC(networkName: string, recipient: string, amount: string): Promise<string>;
  syncInboundTransactions(networkName: string): Promise<string>;
  listTokenTransactions(networkName: string, tokenIdentifier: string, limit: number, offset: number): Promise<string>;
  listAllTransactions(networkName: string, limit: number, offset: number): Promise<string>;
  upsertTransactions(jsonPayload: string): Promise<void>;
  exportWalletBackup(passphrase: string): Promise<string>;
  importWalletBackup(payload: string, passphrase: string): Promise<string>;
}

let PocketCoreModule: PocketModule;

try {
  console.log('🔧 [DEBUG] Attempting to load PocketCore native module...');
  PocketCoreModule = requireNativeModule<PocketModule>('PocketCore');
  console.log('🔧 [DEBUG] PocketCore native module loaded successfully');
  console.log('🔧 [DEBUG] Available methods:', Object.getOwnPropertyNames(PocketCoreModule));
} catch (error) {
  const details = error instanceof Error ? error.message : String(error);
  console.error('🔧 [DEBUG] Failed to load PocketCore native module:', details);
  throw new Error(
    `[PocketCore] Native module is not registered. Rebuild native iOS project and confirm Expo autolinking includes PocketModule. Details: ${details}`,
  );
}

// Debug wrapper to log all method calls
const debugWrapper = new Proxy(PocketCoreModule, {
  get(target, prop) {
    const originalMethod = target[prop as keyof PocketModule];
    if (typeof originalMethod === 'function') {
      return async function(...args: any[]) {
        const methodName = String(prop);
        console.log(`🔧 [DEBUG] Calling ${methodName} with args:`, args.map(arg => 
          typeof arg === 'string' && arg.length > 20 ? `${arg.substring(0, 20)}...` : arg
        ));
        
        try {
          const result = await (originalMethod as Function)(...args);
          console.log(`🔧 [DEBUG] ${methodName} success, result:`, 
            typeof result === 'string' && result.length > 20 ? `${result.substring(0, 20)}...` : result
          );
          return result;
        } catch (error) {
          console.error(`🔧 [DEBUG] ${methodName} failed:`, error);
          throw error;
        }
      };
    }
    return originalMethod;
  }
});

export default debugWrapper as PocketModule;
