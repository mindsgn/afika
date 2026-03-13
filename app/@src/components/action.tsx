import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { useRouter } from 'expo-router';

export default function ActionCard() {
    const router = useRouter();

    return (
        <View  testID="action-container">
        <TouchableOpacity style={styles.button}
            onPress={() => {
                router.push("/send")
            }}>
            <Text style={styles.title}>{"SEND"}</Text>
        </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
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

