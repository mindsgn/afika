import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';
import useWallet, { AAReadiness, SmartAccountCreationReadiness } from '@/@src/store/wallet';

const DEFAULT_NETWORK: 'ethereum-mainnet' | 'ethereum-sepolia' = process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'ethereum-mainnet' : 'ethereum-sepolia';

export default function Home() {
  const { walletAddress, setWalletAddress, smartAccountAddress, setSmartAccountAddress, setBalancesJson, creationReadiness, setCreationReadiness, aaReadiness, setAAReadiness } = useWallet();
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenIdentifier, setTokenIdentifier] = useState('usdc');
  const [note, setNote] = useState('');
  const [providerID, setProviderID] = useState('');
  const [sendMode, setSendMode] = useState<'auto' | 'direct' | 'sponsored'>('auto');
  const [status, setStatus] = useState('Preparing wallet...');

  const preflightWarning = (readiness: SmartAccountCreationReadiness | null) => {
    if (!readiness) return '';
    if (readiness.smartAccountExists || readiness.isReady) return '';
    const reasons = readiness.failureReasons?.join(', ') || 'unknown';
    return `Wallet creation blocked: ${reasons}. Fund owner wallet or enable sponsored creation.`;
  };

  const refreshContext = useCallback(async () => {
    const snapshot = await PocketCore.getAccountSnapshot(DEFAULT_NETWORK);
    setBalancesJson(snapshot);
    const parsed = JSON.parse(snapshot) as { accountAddress?: string };
    setSmartAccountAddress(parsed.accountAddress || '');

    const readinessRaw = await PocketCore.getAAReadiness(DEFAULT_NETWORK);
    setAAReadiness(JSON.parse(readinessRaw) as AAReadiness);

    const creationRaw = await PocketCore.getSmartAccountCreationReadiness(DEFAULT_NETWORK);
    setCreationReadiness(JSON.parse(creationRaw) as SmartAccountCreationReadiness);
  }, [setAAReadiness, setBalancesJson, setCreationReadiness, setSmartAccountAddress]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const dataDir = new Directory(Paths.document);
        await PocketCore.initWalletSecure(dataDir.uri, 'dev-password-change-me');
        const address = await PocketCore.openOrCreateWallet('Main Wallet');
        setWalletAddress(address);
        await refreshContext();
        setStatus('Ready');
      } catch (error) {
        setStatus(`Init failed: ${String(error)}`);
      }
    };

    bootstrap();
  }, [refreshContext, setWalletAddress]);

  const ensureSmartAccount = async () => {
    const creationRaw = await PocketCore.getSmartAccountCreationReadiness(DEFAULT_NETWORK);
    const readiness = JSON.parse(creationRaw) as SmartAccountCreationReadiness;
    setCreationReadiness(readiness);
    if (!readiness.isReady && !readiness.smartAccountExists) {
      throw new Error(preflightWarning(readiness) || 'Wallet creation is currently blocked');
    }

    await PocketCore.createSmartContractAccount(DEFAULT_NETWORK);
    await refreshContext();
  };

  const onSend = async () => {
    try {
      setStatus('Validating smart account...');
      await ensureSmartAccount();

      setStatus(`Sending ${tokenIdentifier.toUpperCase()} via ${sendMode.toUpperCase()}...`);
      await PocketCore.sendTokenWithMode(DEFAULT_NETWORK, tokenIdentifier, destination, amount, note, providerID, sendMode);
      setStatus('Transfer submitted');
    } catch (error) {
      setStatus(`Send failed: ${String(error)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Send</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Owner Wallet</Text>
        <Text style={styles.cardValue}>{walletAddress || 'Not initialized'}</Text>
        <Text style={styles.cardLabel}>Smart Account</Text>
        <Text style={styles.cardValue}>{smartAccountAddress || 'Not created yet'}</Text>
      </View>

      {creationReadiness && !creationReadiness.smartAccountExists && !creationReadiness.isReady ? (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Text style={styles.bannerTitle}>Creation Blocked</Text>
          <Text style={styles.bannerText}>{preflightWarning(creationReadiness)}</Text>
        </View>
      ) : null}

      {aaReadiness && !aaReadiness.sponsorshipReady ? (
        <View style={[styles.banner, styles.bannerInfo]}>
          <Text style={styles.bannerTitle}>Sponsored Send Disabled</Text>
          <Text style={styles.bannerText}>Bundler/paymaster is not fully configured, so AUTO may fall back to DIRECT.</Text>
        </View>
      ) : null}

      <Text style={styles.section}>Transfer</Text>
      <TextInput style={styles.input} value={tokenIdentifier} onChangeText={setTokenIdentifier} placeholder="Token (usdc/native)" autoCapitalize="none" />
      <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Destination address" autoCapitalize="none" />
      <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Amount" keyboardType="decimal-pad" />
      <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Note" />
      <TextInput style={styles.input} value={providerID} onChangeText={setProviderID} placeholder="Provider ID (optional)" autoCapitalize="none" />

      <View style={styles.modeRow}>
        {(['auto', 'direct', 'sponsored'] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeChip, sendMode === mode ? styles.modeChipActive : null]}
            onPress={() => setSendMode(mode)}
          >
            <Text style={[styles.modeText, sendMode === mode ? styles.modeTextActive : null]}>{mode.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.sendButton} onPress={onSend}>
        <Text style={styles.sendText}>Send</Text>
      </Pressable>

      <Text style={styles.status}>{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 16,
    gap: 10,
    backgroundColor: '#F5F7F3',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#153A2B',
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
  banner: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  bannerWarn: {
    backgroundColor: '#FFF1E7',
    borderWidth: 1,
    borderColor: '#F3C7A7',
  },
  bannerInfo: {
    backgroundColor: '#EAF3FF',
    borderWidth: 1,
    borderColor: '#B5D2FF',
  },
  bannerTitle: {
    fontWeight: '700',
    fontSize: 12,
    color: '#2D201A',
  },
  bannerText: {
    fontSize: 12,
    color: '#2D201A',
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
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    borderWidth: 1,
    borderColor: '#AAC1B4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#ECF3EE',
  },
  modeChipActive: {
    backgroundColor: '#153A2B',
    borderColor: '#153A2B',
  },
  modeText: {
    fontWeight: '700',
    fontSize: 11,
    color: '#325546',
  },
  modeTextActive: {
    color: '#FFFFFF',
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
