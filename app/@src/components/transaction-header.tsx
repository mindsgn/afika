import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { formatCurrency, convertUSD } from '@/@src/lib/locale/currency';
import { useFxRate } from '@/@src/lib/locale/useFxRate';
import Ionicons from '@expo/vector-icons/Ionicons';


export default function TransactionHeader() {
  
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{"TRANSACTIONS"}</Text>
      <TouchableOpacity testID='button-see-all-transactions'>
        <Text style={styles.title}>{"SEE ALL"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 20,
  },
  title: {
    color: "white", 
    fontSize: 20
  }
});
