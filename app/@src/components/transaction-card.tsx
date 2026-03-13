import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatCurrency, convertUSD } from '@/@src/lib/locale/currency';
import { useFxRate } from '@/@src/lib/locale/useFxRate';
import Ionicons from '@expo/vector-icons/Ionicons';

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
  const { locale, currency, rate } = useFxRate();
  const amount = formatAmount(tx.amount, tx.tokenSymbol);
  const usdAmount = tx.usdAmount || '';
  const converted = convertUSD(usdAmount, rate);
  const displayAmount = converted != null
    ? formatCurrency(converted, locale, currency)
    : (usdAmount ? formatCurrency(Number(usdAmount), locale, currency) : '');

  return (
    <TouchableOpacity style={styles.card}>
      <View>
        {
          tx.direction === 'credit' ? 
            <Ionicons style={[styles.primaryBalance, {color: "#00E71F"}]} name='arrow-up' />
          :
            <Ionicons style={[styles.primaryBalance, {color: "#FF225E"}]} name='arrow-down' />
        }
        <Text style={styles.meta}>
          {tx.state} • {formatDate(tx.timestamp)}
        </Text>
      </View>
      
      <View>
        <Text style={styles.primaryBalance}>
          {`${tx.direction === 'credit' ? '+' : '-'} ${displayAmount || amount}`}
        </Text>
      </View>
    </TouchableOpacity>
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
    // borderColor: '#2A3143',
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
    fontSize: 18,
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
