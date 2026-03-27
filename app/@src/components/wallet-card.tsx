import { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import useWallet from '../store/wallet';
import { formatCurrency, convertUSD } from '@/@src/lib/locale/currency';
import { useFxRate } from '@/@src/lib/locale/useFxRate';
import { Balance } from './primitives/balance';
import { Card } from './primitives/card';

export default function WalletCard() {
  const {  balances } = useWallet();
  const { locale, currency, rate } = useFxRate();
  // const [ usdcBalance, setUsdcBalance] = useState(0);
  const [displayBalance, setDisplayBalance] = useState('');
  
  const usdcValue = useMemo(() => {
    const usdc = balances.find((b) => b.symbol === 'USDC');
    if (!usdc) return 0;
    const raw = usdc.usdValue || usdc.balance || '0';
    return Number(raw);
  }, [balances]);
  
  useEffect(() => {
    // setUsdcBalance(usdcValue);
    const usdString = usdcValue.toString();
    const converted = convertUSD(usdString, rate);
    const value = converted ?? usdcValue;
    setDisplayBalance(formatCurrency(value, locale, currency));
  }, [usdcValue, locale, currency, rate]);
  
  return (
    <Card testID="wallet-card" style={styles.container}>
      <View>
          <Text style={styles.secondaryBalance}>
            {"Your Balance"}
          </Text>
          <Balance>
            {displayBalance || formatCurrency(0, locale, currency)}
          </Balance>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container:{
    backgroundColor: "#FFF",
    height: 180,
    borderRadius: 20,
  },
  secondaryBalance: {
    fontSize: 15,
    color: '#94A3B8',
    fontWeight: '700',
  },
  status: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});
