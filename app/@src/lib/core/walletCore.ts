import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';
import { initializeWalletWithFallbacks } from '@/_debug_/android-wallet-fix';

export type NetworkKey =
  | 'eth-mainnet'
  | 'ethereum-sepolia'
  | 'eth-sepolia'
  | 'ethereum-mainnet'
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
  'ethereum-mainnet': {
    rpcUrl: process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET ?? '',
    chainId: 1,
  },
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
  process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'base-mainnet' : 'base-sepolia';

export const USDC_ADDRESS: Record<NetworkKey, string> = {
  'eth-mainnet': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'eth-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'ethereum-mainnet': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'base-mainnet': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'gnosis-mainnet': '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
  'gnosis-chiado': '',
};

let initPromise: Promise<string> | null = null;

export async function ensureWalletCoreReady(): Promise<string> {
  console.log('🔧 [DEBUG] Starting enhanced wallet core initialization with fallbacks');
  if (initPromise) {
    console.log('🔧 [DEBUG] Using existing init promise');
    return initPromise;
  }
  
  initPromise = (async () => {
    try {
      // Use enhanced initialization with multiple fallback methods
      const address = await initializeWalletWithFallbacks();
      
      if (!address) {
        throw new Error('All wallet initialization methods failed');
      }

      console.log('🔧 [DEBUG] Enhanced initialization successful, address:', address);
      console.log('🔧 [DEBUG] Address type:', typeof address);
      console.log('🔧 [DEBUG] Address length:', address?.length);
      
      if (address.length !== 42) {
        throw new Error(`Invalid address length: ${address.length}`);
      }
      
      if (!address.startsWith('0x')) {
        throw new Error('Address does not start with 0x');
      }

      const { rpcUrl, chainId } = NETWORK_CONFIG[DEFAULT_NETWORK];
      console.log('🔧 [DEBUG] Network config:', { network: DEFAULT_NETWORK, rpcUrl, chainId });
      
      if (!rpcUrl) {
        throw new Error(`missing rpc url for network ${DEFAULT_NETWORK}`);
      }

      console.log('🔧 [DEBUG] Registering network');
      await PocketCore.registerNetwork(DEFAULT_NETWORK, rpcUrl, chainId);
      console.log('🔧 [DEBUG] Network registered');
      
      console.log('🔧 [DEBUG] Registering USDC token');
      await PocketCore.registerToken(DEFAULT_NETWORK, 'usdc', 'USDC', USDC_ADDRESS[DEFAULT_NETWORK], 6);
      console.log('🔧 [DEBUG] USDC token registered');

      console.log('🔧 [DEBUG] Enhanced wallet core initialization complete');
      return address;
    } catch (error) {
      console.error('🔧 [DEBUG] Enhanced wallet initialization failed:', error);
      console.error('🔧 [DEBUG] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'No stack available'
      });
      throw error;
    }
  })();
  return initPromise;
}
