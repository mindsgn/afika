import { StyleSheet, View } from 'react-native';
import useWallet from '../store/wallet';
import { useMemo } from 'react';
import { FlashList } from "@shopify/flash-list";
import EmptyTransactionCard from './empty-transaction-card';
import TransactionCard from './transaction-card';
import TransactionHeader from './transaction-header';
import { WalletTransaction } from '../store/wallet';
import { pocketBackend } from '../lib/api/pocketBackend';
import { useEffect } from 'react';

export default function TransactionList() {
  const { transactions, setTransactions, walletAddress } = useWallet();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const response = await pocketBackend.listTransactions(walletAddress);
        const { transactions } = response
        //@ts-expect-error unkown type error
        const transactionList = transactions as WalletTransaction[];
        setTransactions(transactionList)
      } catch {
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
        //@ts-expect-error unknown error
        estimatedItemSize={90}
        keyExtractor={(item) => item.hash}
        ListEmptyComponent={<EmptyTransactionCard /> }
        ListHeaderComponent={transactions.length == 0? null: <TransactionHeader />}
        renderItem={({ item }) => <TransactionCard tx={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({});
