import { useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useWallet from '../store/wallet';
import { getLocales } from 'expo-localization';
import { pocketBackend } from '../lib/api/pocketBackend';

export default function WalletCard() {
  const locale = getLocales();
  const { walletAddress } = useWallet();

  const [usdcBalance, setUsdcBalance] = useState(0);

  useEffect(() => {
    const bootstrap = async () => {
      const response = await pocketBackend.listTransactions(walletAddress);

      const usdcTxs = response.transactions.filter(
        (tx: any) => tx.tokenSymbol === 'USDC'
      );

      const balance = usdcTxs.reduce((total: number, tx: any) => {
        const amount = Number(tx.amount) / 1e6;
        return tx.direction === 'credit'
          ? total + amount
          : total - amount;
      }, 0);

      setUsdcBalance(balance);
    };

    bootstrap();
  }, []);

  return (
    <View style={styles.card} testID="wallet-card">
      <Text style={styles.primaryBalance}>
        {locale[0].currencySymbol} {usdcBalance.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: '#161B27',
    padding: 20,
    gap: 6,
    height: 150,
    borderWidth: 1,
    borderColor: '#2A3143',
    marginBottom: 16,
  },
  primaryBalance: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  secondaryBalance: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '500',
  },
});