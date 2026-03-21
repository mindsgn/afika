import * as SecureStore from 'expo-secure-store';
import { Contract, JsonRpcProvider, Wallet, parseUnits, isAddress } from 'ethers';
import type { NetworkKey } from '@/@src/lib/core/walletCore';

export const SECURE_STORE_PRIVATE_KEY = 'wallet_private_key_hex';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
];

const USDC_ADDRESS: Record<NetworkKey, string> = {
  'eth-mainnet': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'eth-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  'base-mainnet': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  'gnosis-mainnet': '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83',
  'gnosis-chiado': '',
  'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'
};

function getRpcURL(networkName: NetworkKey): string {
  const envByNetwork: Record<NetworkKey, string> = {
    'eth-mainnet': process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET ?? '',
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

export function parseUSDCAmount(amount: string): bigint {
  const trimmed = amount.trim();
  if (!trimmed) throw new Error('amount is required');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('amount must be a number');
  }
  const [, decimals = ''] = trimmed.split('.');
  if (decimals.length > 6) {
    throw new Error('amount precision is too high');
  }
  const units = parseUnits(trimmed, 6);
  if (units <= 0n) {
    throw new Error('amount must be greater than zero');
  }
  return units;
}

export async function sendUSDC(networkName: NetworkKey, recipient: string, amount: string): Promise<string> {
  if (!isAddress(recipient)) {
    throw new Error('invalid recipient address');
  }

  const privateKey = await SecureStore.getItemAsync(SECURE_STORE_PRIVATE_KEY);
  if (!privateKey) {
    throw new Error('wallet private key missing; export key first');
  }

  const rpcURL = getRpcURL(networkName);
  const usdcAddress = USDC_ADDRESS[networkName];
  if (!usdcAddress) {
    throw new Error(`USDC not configured for network: ${networkName}`);
  }

  const amountUnits = parseUSDCAmount(amount);
  const provider = new JsonRpcProvider(rpcURL);
  const wallet = new Wallet(privateKey, provider);
  const contract = new Contract(usdcAddress, ERC20_ABI, wallet);

  const tx = await contract.transfer(recipient, amountUnits);
  const receipt = await tx.wait(1);
  if (!receipt || receipt.status !== 1) {
    throw new Error(`transaction failed: ${tx.hash}`);
  }
  return tx.hash as string;
}
