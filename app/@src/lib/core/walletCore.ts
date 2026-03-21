import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';

export type NetworkKey =
  | 'eth-mainnet'
  | 'ethereum-sepolia'
  | 'base-mainnet'
  | 'gnosis-mainnet'
  | 'eth-sepolia'
  | 'base-sepolia'
  | 'gnosis-chiado';

type NetworkConfig = {
  rpcUrl: string;
  chainId: number;
};

const NETWORK_CONFIG: Record<NetworkKey, NetworkConfig> = {
  'eth-mainnet': {
    rpcUrl: process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET ?? '',
    chainId: 1,
  },
  'eth-sepolia': {
    rpcUrl: process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA ?? '',
    chainId: 11155111,
  },
   'ethereum-sepolia': {
    rpcUrl: process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA ?? '',
    chainId: 11155111,
  },
  'base-mainnet': {
    rpcUrl: process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_BASE_MAINNET ?? '',
    chainId: 8453,
  },
  'base-sepolia': {
    rpcUrl: process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_BASE_SEPOLIA ?? '',
    chainId: 84532,
  },
  'gnosis-mainnet': {
    rpcUrl: process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_GNOSIS_MAINNET ?? '',
    chainId: 100,
  },
  'gnosis-chiado': {
    rpcUrl: process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_GNOSIS_CHIADO ?? '',
    chainId: 10200,
  },
};

export const DEFAULT_NETWORK: NetworkKey =
  process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'eth-mainnet' : 'eth-sepolia';

export const USDC_ADDRESS: Record<NetworkKey, string> = {
  'eth-mainnet': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'eth-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'base-mainnet': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'gnosis-mainnet': '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
  'gnosis-chiado': '',
};

let initPromise: Promise<string> | null = null;

export async function ensureWalletCoreReady(): Promise<string> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const dataDir = new Directory(Paths.document);
    await PocketCore.initWalletSecure(dataDir.uri);
    const address = await PocketCore.openOrCreateWallet('Main Wallet');

    const { rpcUrl, chainId } = NETWORK_CONFIG[DEFAULT_NETWORK];
    if (!rpcUrl) {
      throw new Error(`missing rpc url for network ${DEFAULT_NETWORK}`);
    }

    await PocketCore.registerNetwork(DEFAULT_NETWORK, rpcUrl, chainId);
    await PocketCore.registerToken(DEFAULT_NETWORK, 'usdc', 'USDC', USDC_ADDRESS[DEFAULT_NETWORK], 6);

    return address;
  })();
  return initPromise;
}
