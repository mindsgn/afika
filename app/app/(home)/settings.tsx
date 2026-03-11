import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BodyText, PrimaryButton, Screen, Title } from '@/@src/components/Primitives';

export default function Settings() {
  const router = useRouter();

  return (
    <Screen testID="settings-screen" style={styles.container}>
      <Title>Settings</Title>
      <BodyText>Security and app options will continue to expand during MVP.</BodyText>
      <PrimaryButton
        testID="open-claim-button"
        label="Open Claim Screen"
        onPress={() => router.push('/(home)/claim')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    paddingHorizontal: 16,
    gap: 8
  }
});
