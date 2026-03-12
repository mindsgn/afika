import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import useWallet from '@/@src/store/wallet';
import type { TokenBalance } from '@/@src/store/wallet';
import { Screen, BodyText, Input, PrimaryButton } from '@/@src/components/Primitives';
import PinAuthSheet from '@/@src/components/PinAuthSheet';
import { verifyStoredPin } from '@/@src/lib/security/sensitiveAuth';
import { sendUSDC, SECURE_STORE_PRIVATE_KEY } from '@/@src/lib/ethereum/sendUSDC';

const DEFAULT_NETWORK: 'ethereum-mainnet' | 'ethereum-sepolia' =
  process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'ethereum-mainnet' : 'ethereum-sepolia';

const USDC_ADDRESS: Record<string, string> = {
  'ethereum-mainnet': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  'ethereum-sepolia': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
};

export default function Home() {
  const { walletAddress, setWalletAddress, setNetwork, setBalances } = useWallet();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenIdentifier, setTokenIdentifier] = useState<'usdc' | 'native'>('usdc');
  const [status, setStatus] = useState('Preparing wallet...');
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const authResolverRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const dataDir = new Directory(Paths.document);
        // initWalletSecure manages key material via iOS Keychain — no password arg
        await PocketCore.initWalletSecure(dataDir.uri);
        const address = await PocketCore.openOrCreateWallet('Main Wallet');
        setWalletAddress(address);
        const existingKey = await SecureStore.getItemAsync(SECURE_STORE_PRIVATE_KEY);
        if (!existingKey) {
          const exportedKey = await PocketCore.exportPrivateKey();
          await SecureStore.setItemAsync(SECURE_STORE_PRIVATE_KEY, exportedKey);
        }

        // Register the active network and USDC token so balance/send ops work
        const rpcURL = DEFAULT_NETWORK === 'ethereum-mainnet'
          ? (process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET ?? '')
          : (process.env.EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA ?? '');
        const chainId = DEFAULT_NETWORK === 'ethereum-mainnet' ? 1 : 11155111;
        await PocketCore.registerNetwork(DEFAULT_NETWORK, rpcURL, chainId);
        await PocketCore.registerToken(DEFAULT_NETWORK, 'usdc', 'USDC', USDC_ADDRESS[DEFAULT_NETWORK], 6);

        // Fetch balances
        const balJson = await PocketCore.getAllBalances(DEFAULT_NETWORK);
        const balances = JSON.parse(balJson) as TokenBalance[];
        setBalances(Array.isArray(balances) ? balances : []);
        setNetwork(DEFAULT_NETWORK);
        setStatus('Ready');
      } catch (error) {
        setStatus(`Init failed: ${String(error)}`);
      }
    };

    bootstrap();
  }, [setWalletAddress, setNetwork, setBalances]);

  const onPinConfirm = async (pin: string): Promise<boolean> => {
    const ok = await verifyStoredPin(pin);
    if (!ok) return false;
    setPinPromptVisible(false);
    authResolverRef.current?.(true);
    authResolverRef.current = null;
    return true;
  };

  const onPinCancel = () => {
    setPinPromptVisible(false);
    authResolverRef.current?.(false);
    authResolverRef.current = null;
  };
  
  const onSend = async () => {
    try {
      setStatus(`Sending ${tokenIdentifier.toUpperCase()}...`);
      const txHash = await sendUSDC(DEFAULT_NETWORK, destination, amount);
      setStatus(`Transfer submitted: ${txHash}`);
    } catch (error) {
      console.log(error)
      setStatus(`Send failed: ${String(error)}`);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} testID="home-screen">
          <BodyText style={styles.section}>Transfer</BodyText>
          <Input
            testID="token-input"
            value={tokenIdentifier}
            onChangeText={(value) => setTokenIdentifier(value === 'native' ? 'native' : 'usdc')}
            placeholder="Token (usdc / native)"
            autoCapitalize="none"
          />
          <Input
            testID="destination-input"
            value={destination}
            onChangeText={setDestination}
            placeholder="Destination address"
            autoCapitalize="none"
          />
          <Input
            testID="amount-input"
            value={amount}
            onChangeText={setAmount}
            placeholder="Amount"
            keyboardType="decimal-pad"
          />

          <PrimaryButton label="Send" onPress={onSend} testID="send-button" />
          <BodyText style={styles.status} testID="send-status">{status}</BodyText>

          <PinAuthSheet
            visible={pinPromptVisible}
            title="Enter PIN to confirm transfer"
            onConfirm={onPinConfirm}
            onCancel={onPinCancel}
          />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
    gap: 10,
  },
  title: {
  },
  section: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#224738',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFD8D2',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 4,
  },
  cardLabel: {
    fontSize: 12,
    color: '#5C7265',
    fontWeight: '700',
  },
  cardValue: {
    fontSize: 12,
    color: '#1C2C24',
  },
  input: {
    borderWidth: 1,
    borderColor: '#C6D2CA',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 13,
  },
  sendButton: {
    marginTop: 4,
    backgroundColor: '#1F7A4D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sendText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  status: {
    marginTop: 8,
    fontSize: 12,
    color: '#294638',
  },
});
