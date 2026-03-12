import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';
import { formatCurrency, convertUSD } from '@/@src/lib/locale/currency';
import { useFxRate } from '@/@src/lib/locale/useFxRate';

const DEFAULT_NETWORK: 'ethereum-mainnet' | 'ethereum-sepolia' = process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'ethereum-mainnet' : 'ethereum-sepolia';

type TxItem = {
  hash: string;
  fromAddress: string;
  toAddress: string;
  tokenSymbol: string;
  amount: string;
  feeEth: string;
  feeUsd?: string;
  usdAmount?: string;
  network: string;
  mode: string;
  direction: 'credit' | 'debit';
  state: string;
  timestamp: number;
};

export default function App() {
  const { locale, currency, rate } = useFxRate();
  const [walletAddress, setWalletAddress] = useState('')
  const [transactions, setTransactions] = useState<TxItem[]>([])
  const [status, setStatus] = useState('Initializing...')
  const [lastUpdated, setLastUpdated] = useState<number>(0)

  const refreshData = useCallback(async () => {
    // Sync inbound transfers first so they appear in the list below.
    // Non-fatal: a sync failure must not block reading the local DB.
    try {
      await PocketCore.syncInboundTransactions(DEFAULT_NETWORK)
    } catch {
      // intentionally ignored
    }
    const tx = await PocketCore.listAllTransactions(DEFAULT_NETWORK, 20, 0)
    const parsed = JSON.parse(tx) as TxItem[]
    setTransactions(Array.isArray(parsed) ? parsed : [])
    setLastUpdated(Date.now())
  }, []);

  const formatLifecycle = (item: TxItem): string => {
    if (item.state === 'completed') return 'Completed'
    if (item.state === 'failed') return 'Failed'
    if (item.state === 'pending') return 'Pending'
    return item.state
  }

  const formatLocal = (usdValue?: string) => {
    if (!usdValue) return '';
    const converted = convertUSD(usdValue, rate);
    if (converted != null) {
      return formatCurrency(converted, locale, currency);
    }
    return formatCurrency(Number(usdValue), locale, currency);
  }

  useEffect(() => {
    const bootstrapWallet = async () => {
      const dataDir = new Directory(Paths.document);

      try {
        // initWalletSecure manages key material via iOS Keychain — no password arg
        await PocketCore.initWalletSecure(dataDir.uri)
        const address = await PocketCore.openOrCreateWallet('Main Wallet')
        setWalletAddress(address)
        await refreshData()
        setStatus('Wallet ready')
      } catch (error) {
        setStatus(`Init failed: ${String(error)}`)
      }
    }

    bootstrapWallet()
  }, [refreshData]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshData().catch(() => null)
    }, 10000)
    return () => clearInterval(timer)
  }, [refreshData])

  return (
    <ScrollView contentContainerStyle={styles.container} testID="transactions-screen">
      <Text style={styles.title}>Transactions</Text>
      <Text style={styles.label}>Wallet ({DEFAULT_NETWORK})</Text>
      <Text style={styles.value}>{walletAddress || 'Not ready'}</Text>
      <Text style={styles.value}>Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'n/a'}</Text>

      <Pressable testID="transactions-refresh" style={styles.refresh} onPress={() => refreshData().catch((error) => setStatus(`Refresh failed: ${String(error)}`))}>
        <Text style={styles.refreshText}>Refresh</Text>
      </Pressable>

      <Text style={styles.section}>Latest Activity</Text>
      {transactions.length === 0 ? <Text style={styles.value}>No transactions yet</Text> : null}
      {transactions.map((item, index) => (
        <View key={`${item.hash}-${index}`} style={styles.card} testID={`tx-item-${index}`}>
          <Text style={[styles.row, styles.direction]}>
            {item.direction === 'credit' ? '↓ Received' : '↑ Sent'} {item.tokenSymbol} {item.amount}
          </Text>
          <Text style={styles.row}>Status: {formatLifecycle(item)}</Text>
          <Text style={styles.row}>Network: {item.network} / {item.mode}</Text>
          <Text style={styles.row}>Amount: {formatLocal(item.usdAmount) || item.amount}</Text>
          <Text style={styles.row}>Fee: {formatLocal(item.feeUsd) || `${item.feeEth} ETH`}</Text>
          <Text style={styles.row}>From: {item.fromAddress}</Text>
          <Text style={styles.row}>To: {item.toAddress}</Text>
          <Text style={styles.row}>Hash: {item.hash}</Text>
          <Text style={styles.row}>
            {item.timestamp ? new Date(item.timestamp * 1000).toLocaleString() : ''}
          </Text>
        </View>
      ))}

      <Text style={styles.status} testID="transactions-status">{status}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    paddingHorizontal: 16,
    gap: 8
  },
  title: {
    fontSize: 24,
    fontWeight: '700'
  },
  section: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600'
  },
  label: {
    fontSize: 14,
    fontWeight: '600'
  },
  value: {
    fontSize: 12
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4
  },
  refresh: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    fontSize: 12
  },
  direction: {
    fontWeight: '600',
  },
  status: {
    marginTop: 12,
    fontSize: 12
  }
});
