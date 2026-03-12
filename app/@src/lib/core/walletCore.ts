import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';

export const DEFAULT_NETWORK: 'ethereum-mainnet' | 'ethereum-sepolia' =
  process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'ethereum-mainnet' : 'ethereum-sepolia';

export const USDC_ADDRESS: Record<string, string> = {
  'ethereum-mainnet': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
};

let initPromise: Promise<string> | null = null;

export async function ensureWalletCoreReady(): Promise<string> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const dataDir = new Directory(Paths.document);
    await PocketCore.initWalletSecure(dataDir.uri);
    const address = await PocketCore.openOrCreateWallet('Main Wallet');

    const rpcURL = DEFAULT_NETWORK === 'ethereum-mainnet'
      ? (process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET ?? '')
      : (process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA ?? '');
    const chainId = DEFAULT_NETWORK === 'ethereum-mainnet' ? 1 : 11155111;

    await PocketCore.registerNetwork(DEFAULT_NETWORK, rpcURL, chainId);
    await PocketCore.registerToken(DEFAULT_NETWORK, 'usdc', 'USDC', USDC_ADDRESS[DEFAULT_NETWORK], 6);

    return address;
  })();
  return initPromise;
}
