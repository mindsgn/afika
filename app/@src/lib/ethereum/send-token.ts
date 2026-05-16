import * as SecureStore from 'expo-secure-store';
import { Contract, JsonRpcProvider, Wallet, parseUnits, isAddress } from 'ethers';
import type { NetworkKey } from '@/@src/lib/core/walletCore';

export const SECURE_STORE_PRIVATE_KEY = 'wallet_private_key_hex';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
];

const TOKEN_CONFIG: Record<NetworkKey, Record<string, { address: string; decimals: number }>> = {
  'eth-mainnet': {
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  },
  'ethereum-mainnet': {
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  },
  'eth-sepolia': {
    USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  },
  'base-mainnet': {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    ZARP: { address: '0xb755506531786C8aC63B756BaB1ac387bACB0C04', decimals: 18 },
  },
  'base-sepolia': {
    USDC: { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', decimals: 6 },
  },
  'gnosis-mainnet': {
    USDC: { address: '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83', decimals: 6 },
  },
  'gnosis-chiado': {},
  'ethereum-sepolia': {
    USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
  },
};

function getRpcURL(networkName: NetworkKey): string {
  const envByNetwork: Record<NetworkKey, string> = {
    'eth-mainnet': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET ?? '',
    'ethereum-mainnet': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET ?? '',
    'eth-sepolia': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA ?? '',
    'ethereum-sepolia': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA ?? '',
    'base-mainnet': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_BASE_MAINNET ?? '',
    'base-sepolia': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_BASE_SEPOLIA ?? '',
    'gnosis-mainnet': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_GNOSIS_MAINNET ?? '',
    'gnosis-chiado': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_GNOSIS_CHIADO ?? '',
  };
  const url = envByNetwork[networkName];
  if (!url) {
    throw new Error(`Missing RPC URL for network: ${networkName}`);
  }
  return url;
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!trimmed) throw new Error('amount is required');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('amount must be a number');
  }
  const [, decimalPart = ''] = trimmed.split('.');
  if (decimalPart.length > decimals) {
    throw new Error(`amount precision is too high for ${decimals} decimals`);
  }
  const units = parseUnits(trimmed, decimals);
  if (units <= 0n) {
    throw new Error('amount must be greater than zero');
  }
  return units;
}

export async function sendToken(networkName: NetworkKey, recipient: string, amount: string, tokenSymbol: string): Promise<string> {
  if (!isAddress(recipient)) {
    throw new Error('invalid recipient address');
  }

  const privateKey = await SecureStore.getItemAsync(SECURE_STORE_PRIVATE_KEY);
  if (!privateKey) {
    throw new Error('wallet private key missing; export key first');
  }

  const rpcURL = getRpcURL(networkName);
  const networkTokens = TOKEN_CONFIG[networkName];
  if (!networkTokens || !networkTokens[tokenSymbol]) {
    throw new Error(`${tokenSymbol} not configured for network: ${networkName}`);
  }
  const tokenConfig = networkTokens[tokenSymbol];

  const amountUnits = parseTokenAmount(amount, tokenConfig.decimals);
  const provider = new JsonRpcProvider(rpcURL);
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(tokenConfig.address, ERC20_ABI, wallet);

  const tx = await contract.transfer(recipient, amountUnits);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`transaction failed: ${tx.hash}`);
  }
  return tx.hash as string;
}
