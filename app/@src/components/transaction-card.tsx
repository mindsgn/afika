import { StyleSheet, Text, View } from 'react-native';
import { getLocales } from 'expo-localization';

function shortenAddress(addr: any) {
  if (!addr) return '';
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatDate(timestamp: any) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
}

function formatAmount(amount: any, symbol: any) {
  if (symbol === 'ETH') {
    return (Number(amount) / 1e18).toFixed(4);
  }
  if (symbol === 'USDC') {
    return (Number(amount) / 1e6).toFixed(2);
  }
  return amount;
}

export default function TransactionCard({ tx }: { tx: any}) {
  const locale = getLocales()
  const amount = formatAmount(tx.amount, tx.tokenSymbol);

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.primaryBalance}>
          {`${locale[0].currencySymbol} ${tx.usdAmount}`}
        </Text>

        <Text style={styles.meta}>
          {tx.state} • {formatDate(tx.timestamp)}
        </Text>
      </View>
      
      <View>
        <Text style={styles.primaryBalance}>
          {tx.direction === 'credit' ? '+' : '-'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: "row",
    borderRadius: 20,
    backgroundColor: '#161B27',
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#2A3143',
    marginBottom: 16,
    justifyContent: "space-between"
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },

  networkBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: '#60A5FA',
    backgroundColor: '#1E2D4A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: 'hidden',
  },

  primaryBalance: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F1F5F9',
  },

  secondaryBalance: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },

  address: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
    fontFamily: 'monospace',
  },

  meta: {
    marginTop: 10,
    fontSize: 12,
    color: '#475569',
  },
});