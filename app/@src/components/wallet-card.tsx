import { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import useWallet from '../store/wallet';
import PocketCore from '@/modules/pocket-module';
import { ensureWalletCoreReady, DEFAULT_NETWORK } from '@/@src/lib/core/walletCore';
import { formatCurrency, convertUSD } from '@/@src/lib/locale/currency';
import { useFxRate } from '@/@src/lib/locale/useFxRate';

export default function WalletCard() {
  const { walletAddress } = useWallet();
  const { locale, currency, rate } = useFxRate();
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [displayBalance, setDisplayBalance] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await ensureWalletCoreReady();
        const cachedJson = await PocketCore.getLatestBalances(DEFAULT_NETWORK);
        const cached = JSON.parse(cachedJson) as Array<{
          tokenSymbol: string;
          balance: string;
          usdValue: string;
        }>;
        const usdc = cached.find((b) => b.tokenSymbol === 'USDC');
        if (usdc) {
          setUsdcBalance(Number(usdc.usdValue || usdc.balance || 0));
        }
      } catch {
        // ignore cache read errors
      }

      try {
        const latestJson = await PocketCore.syncBalances(DEFAULT_NETWORK);
        const latest = JSON.parse(latestJson) as Array<{
          tokenSymbol: string;
          balance: string;
          usdValue: string;
        }>;
        const usdc = latest.find((b) => b.tokenSymbol === 'USDC');
        if (usdc) {
          setUsdcBalance(Number(usdc.usdValue || usdc.balance || 0));
        }
      } catch {
        // ignore sync errors
      }
    };

    bootstrap();
  }, [walletAddress]);

  useEffect(() => {
    const usdString = usdcBalance.toString();
    const converted = convertUSD(usdString, rate);
    const value = converted ?? usdcBalance;
    setDisplayBalance(formatCurrency(value, locale, currency));
  }, [usdcBalance, locale, currency, rate]);

  return (
    <View style={styles.card} testID="wallet-card">
      <View>
         <Text style={styles.secondaryBalance}>
            {"Your Balance"}
          </Text>
          <Text style={styles.primaryBalance}>
            {displayBalance || formatCurrency(0, locale, currency)}
          </Text>
      </View>
      <View>
        <TouchableOpacity>
          <Text style={styles.secondaryBalance}>
            see
          </Text>
        </TouchableOpacity>
      </View>
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
    // borderColor: '#2A3143',
    marginBottom: 16,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between"
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
