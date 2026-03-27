import { useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { HapticPressable } from '@/@src/components/primitives/haptic-pressable';

export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      Alert.alert(
        'Page not found',
        'The screen you tried to open does not exist.'
      );
    }, 2000);

    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Oops 😕</Text>
      <Text style={styles.subtitle}>
        This screen does not exist.
      </Text>

      <HapticPressable onPress={() => router.replace('/')}>
        <Text style={styles.link}>Go home</Text>
      </HapticPressable>
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
  link: {
    marginTop: 12,
    color: '#3478f6',
    fontSize: 16,
    fontWeight: '600',
  },
});
