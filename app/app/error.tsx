import { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { HapticPressable } from '@/@src/components/primatives/haptic-pressable';

export default function ErrorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { message } =  params;
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something broke 😬</Text>

      <Text style={styles.subtitle}>
        {`${message || "An unexpected error occurred."}`}
      </Text>

      <View style={styles.actions}>
        <HapticPressable onPress={() => router.replace('/')}>
          <Text style={styles.link}>Restart</Text>
        </HapticPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
  },
  link: {
    color: '#3478f6',
    fontSize: 16,
    fontWeight: '600',
  },
});
