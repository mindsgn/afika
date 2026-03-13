import { StyleSheet, View } from 'react-native';
import useWallet from '../store/wallet';
import { useEffect, useMemo } from 'react';
import { FlashList } from "@shopify/flash-list";
import EmptyTransactionCard from './empty-transaction-card';
import TransactionCard from './transaction-card';
import { pocketBackend } from '../lib/api/pocketBackend';
import TransactionHeader from './transaction-header';
import { WalletTransaction } from '../store/wallet';

export default function TransactionList() {
  const { transactions, walletAddress, setTransactions } = useWallet();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const response = await pocketBackend.listTransactions(walletAddress);
        const { transactions } = response
        const transactionList = transactions as WalletTransaction[];
        setTransactions(transactionList)
      } catch {
        //get local sql
      }
    };

    bootstrap();
  }, [walletAddress, setTransactions]);
  
  const usdcTransactions = useMemo(() => {
    return transactions.filter((tx: any) => tx.tokenSymbol === "USDC");
  }, [transactions]);

  return (
    <View testID="transaction-list">
      <FlashList
        data={usdcTransactions}
        estimatedItemSize={90}
        keyExtractor={(item) => item.hash}
        ListEmptyComponent={ <EmptyTransactionCard /> }
        ListHeaderComponent={<TransactionHeader />}
        renderItem={({ item }) => <TransactionCard tx={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
