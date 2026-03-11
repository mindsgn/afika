import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PocketCore from '@/modules/pocket-module';
import { Directory, Paths } from 'expo-file-system';

const DEFAULT_NETWORK: 'ethereum-mainnet' | 'ethereum-sepolia' = process.env.EXPO_PUBLIC_APP_ENV === 'production' ? 'ethereum-mainnet' : 'ethereum-sepolia';

type TxItem = {
  hash: string;
  userOpHash?: string;
  token: string;
  amount: string;
  state: string;
  type?: string;
  mode?: string;
  sponsorshipMode?: string;
  bundlerStatus?: string;
  metadata?: {
    source?: string;
    destination?: string;
    note?: string;
  };
};

export default function App() {
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
    if (item.bundlerStatus === 'included') return 'Included onchain'
    if (item.bundlerStatus === 'submitted') return 'Submitted to bundler'
    return 'Pending'
  }

  const fallbackHint = (item: TxItem): string => {
    if (item.state === 'failed' && item.sponsorshipMode === 'sponsored') {
      return 'Retry in AUTO or DIRECT mode if sponsorship is unavailable.'
    }
    if (item.state === 'failed' && item.mode === 'direct') {
      return 'Check native gas balance on the owner wallet and retry.'
    }
    if (item.state === 'pending') {
      return 'Still processing. Pull to refresh or check again in a few seconds.'
    }
    return 'No action required.'
  }

  useEffect(() => { 
    const bootstrapWallet = async () => {
      const dataDir = new Directory(Paths.document);
      const password = 'dev-password-change-me'

      try {
        await PocketCore.initWalletSecure(dataDir.uri, password)
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
          <Text style={[styles.row, styles.direction]}>{item.type === 'credit' ? '↓ Received' : '↑ Sent'} {item.token} {item.amount}</Text>
          <Text style={styles.row}>Lifecycle: {formatLifecycle(item)}</Text>
          <Text style={styles.row}>State: {item.state}</Text>
          <Text style={styles.row}>Flow: {item.mode || 'direct'} / {item.sponsorshipMode || 'direct'}</Text>
          <Text style={styles.row}>Bundler: {item.bundlerStatus || 'n/a'}</Text>
          <Text style={styles.row}>Op: {item.userOpHash || item.hash}</Text>
          <Text style={styles.row}>To: {item.metadata?.destination || 'n/a'}</Text>
          <Text style={styles.row}>Note: {item.metadata?.note || '-'}</Text>
          <Text style={styles.hint}>{fallbackHint(item)}</Text>
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
  hint: {
    fontSize: 11,
    color: '#374151',
  },
  status: {
    marginTop: 12,
    fontSize: 12
  }
});
