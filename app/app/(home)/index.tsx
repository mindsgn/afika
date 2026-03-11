import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';
import useWallet from '@/@src/store/wallet';
import { Screen, Card, Title, BodyText, Input, PrimaryButton } from '@/@src/components/Primitives';
import PinAuthSheet from '@/@src/components/PinAuthSheet';
import { tryBiometricAuth, verifyStoredPin } from '@/@src/lib/security/sensitiveAuth';
import { useLocalSearchParams } from 'expo-router';
import WalletCard from '@/@src/components/wallet-card';

const DEFAULT_NETWORK: 'ethereum-mainnet' | 'ethereum-sepolia' =
  process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'ethereum-mainnet' : 'ethereum-sepolia';

export default function Home() {
  const { walletAddress, setWalletAddress, setBalancesJson } = useWallet();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenIdentifier, setTokenIdentifier] = useState<'usdc' | 'native'>('usdc');
  const [note, setNote] = useState('');
  const [providerID, setProviderID] = useState('');
  const [status, setStatus] = useState('Preparing wallet...');
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const authResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const data = useLocalSearchParams()

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const dataDir = new Directory(Paths.document);
        await PocketCore.initWalletSecure(dataDir.uri, data.password as string);
        const address = await PocketCore.openOrCreateWallet('Main Wallet');
        setWalletAddress(address);
        setStatus('Ready');
      } catch (error) {
        setStatus(`Init failed: ${String(error)}`);
      }
    };

    bootstrap();
  }, [setBalancesJson, setWalletAddress]);

  const onSend = async () => {
    try {
      const biometricApproved = await tryBiometricAuth('Confirm transfer');
      if (!biometricApproved) {
        const pinApproved = await new Promise<boolean>((resolve) => {
          authResolverRef.current = resolve;
          setPinPromptVisible(true);
        });

        if (!pinApproved) {
          setStatus('Transfer canceled. Authentication required.');
          return;
        }
      }

      setStatus(`Sending ${tokenIdentifier.toUpperCase()}...`);
      if (tokenIdentifier === 'native') {
        await PocketCore.sendToken(DEFAULT_NETWORK, 'native', destination, amount, note, providerID);
      } else {
        await PocketCore.sendToken(DEFAULT_NETWORK, 'usdc', destination, amount, note, providerID);
      }
      setStatus('Transfer submitted');
    } catch (error) {
      setStatus(`Send failed: ${String(error)}`);
    }
  };

  const onPinConfirm = async (pin: string): Promise<boolean> => {
    const ok = await verifyStoredPin(pin);
    if (!ok) {
      return false;
    }

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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} testID="home-screen">
        <WalletCard />
        
        {/*
        <BodyText style={styles.section}>Transfer</BodyText>
        <Input
        testID="token-input"
        value={tokenIdentifier}
        onChangeText={(value) => setTokenIdentifier(value === 'native' ? 'native' : 'usdc')}
        placeholder="Token (usdc/native)"
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
        <Input
          testID="provider-id-input"
          style={styles.input}
        value={providerID}
        onChangeText={setProviderID}
        placeholder="Provider ID (optional)"
        autoCapitalize="none"
      />

        <PrimaryButton label="Send" onPress={onSend} testID="send-button" />

        <BodyText style={styles.status} testID="send-status">{status}</BodyText>
     
      <PinAuthSheet
        visible={pinPromptVisible}
        title="Enter PIN to confirm transfer"
        onConfirm={onPinConfirm}
        onCancel={onPinCancel}
      />*/}
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
