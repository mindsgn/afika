import React from 'react';
import { View, Text, FlatList } from 'react-native';

import { style } from './style';
import { useWallet } from '../../context';
import { TransactionCard } from '../transactionCard';
import { TransactionLoadingContainer } from '../transactionLoadingContainer ';
import { TransactionEmptyContainer } from '../transactionEmptyContainer';

const TransactionContainer = () => {
  const { transactions, loading } = useWallet();

  return (
    <View style={style.default}>
      <Text style={style.title}>Transactions</Text>
      <View style={style.transactionCardList}>
        {loading ? (
          <TransactionLoadingContainer />
        ) : (
          <FlatList
            data={transactions}
            ListEmptyComponent={<TransactionEmptyContainer />}
            renderItem={({ item }) => (
              <TransactionCard
                key={`${item.blockHash}`}
                date={item.timeStamp}
                label={item.label}
                amount={item.value}
              />
            )}
          />
        )}
      </View>
    </View>
  );
};

export { TransactionContainer };
