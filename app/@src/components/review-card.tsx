// components/send/ReviewCard.tsx

import { View, Text, StyleSheet } from "react-native";

export default function ReviewCard({
  amount,
  usd,
  recipient,
}: {
  amount: string;
  usd: string;
  recipient: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Review Transfer</Text>

      <View style={styles.row}>
        <Text>Amount</Text>
        <Text>{amount}</Text>
      </View>

      <View style={styles.row}>
        <Text>USDC</Text>
        <Text>{usd}</Text>
      </View>

      <View style={styles.row}>
        <Text>Recipient</Text>
        <Text>{recipient}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 6,
  },
});