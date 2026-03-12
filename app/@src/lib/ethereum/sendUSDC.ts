import * as SecureStore from 'expo-secure-store';
import { Contract, JsonRpcProvider, Wallet, parseUnits, isAddress } from 'ethers';

export const SECURE_STORE_PRIVATE_KEY = 'wallet_private_key_hex';

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
];

const USDC_ADDRESS: Record<string, string> = {
  'ethereum-mainnet': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
};

function getRpcURL(networkName: string): string {
  if (networkName === 'ethereum-mainnet') {
    const url = process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET ?? '';
    if (!url) throw new Error('Missing EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET');
    return url;
  }
  if (networkName === 'ethereum-sepolia') {
    const url = process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA ?? '';
    if (!url) throw new Error('Missing EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA');
    return url;
  }
  throw new Error(`Unsupported network: ${networkName}`);
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

export async function sendUSDC(networkName: string, recipient: string, amount: string): Promise<string> {
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
  return tx.hash as string;
}
