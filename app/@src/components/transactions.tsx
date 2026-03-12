import { StyleSheet, View } from 'react-native';
import useWallet from '../store/wallet';
import { useEffect, useMemo } from 'react';
import { pocketBackend } from '../lib/api/pocketBackend';
import { FlashList } from "@shopify/flash-list";
import EmptyTransactionCard from './empty-transaction-card';
import TransactionCard from './transaction-card';

export default function TransactionList() {
  const { transactions, walletAddress, setTransactions } = useWallet();

  useEffect(() => {
    const bootstrap = async () => {
      const response = await pocketBackend.listTransactions(walletAddress);
      setTransactions(response.transactions);
    };

    bootstrap();
  }, []);
  
  const usdcTransactions = useMemo(() => {
    return transactions.filter((tx: any) => tx.tokenSymbol === "USDC");
  }, [transactions]);

  return (
    <View testID="transaction-list">
      <FlashList
        data={usdcTransactions}
        estimatedItemSize={90}
        keyExtractor={(item) => item.txHash}
        ListEmptyComponent={<EmptyTransactionCard />}
        renderItem={({ item }) => <TransactionCard tx={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({});