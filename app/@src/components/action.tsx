import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/@src/components/primitives/button';

export default function ActionCard() {
    const router = useRouter();
    return (
      <View 
        style={styles.container}
        testID="action-container">
        <Button
          label="SEND"
          color="white"
          onPress={() => {
            router.push("/send")
          }}
        />
        <Button
          label="RECEIVE"
          backgroundColor='none'
          color="#1f1f1f"
          onPress={() => {
            router.push("/receive")
          }}
        />
      </View>
    );
}

const styles = StyleSheet.create({
  container:{
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    borderRadius: 20,
    backgroundColor: '#161B27',
    padding: 20,
    gap: 6,
    width: 150,
    borderWidth: 1,
    // borderColor: '#2A3143',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F1F5F9',
    letterSpacing: -0.5,
    marginHorizontal: 10,
  }
});
