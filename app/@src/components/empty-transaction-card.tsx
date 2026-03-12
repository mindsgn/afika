import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

export default function EmptyTransactionCard() {
  return (
    <View style={styles.card} testID="wallet-card">
      <Text style={styles.title}>
        No Transactions Yet
      </Text>
      <Text style={styles.body}>
        Your transactions will appear here once you start sending or receiving money.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.5,
    marginHorizontal: 10,
  },
  body: {
    marginTop: 10,
    fontSize: 21,
    fontFamily: "monospace",
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
});

