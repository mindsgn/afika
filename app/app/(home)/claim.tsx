import { useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { BodyText, Input, PrimaryButton, Screen, Title } from '@/@src/components/Primitives';
import PinAuthSheet from '@/@src/components/PinAuthSheet';
import { pocketBackend } from '@/@src/lib/api/pocketBackend';
import { tryBiometricAuth, verifyStoredPin } from '@/@src/lib/security/sensitiveAuth';

export default function ClaimScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('Enter your email to claim pending transfers.');
  const [pinPromptVisible, setPinPromptVisible] = useState(false);
  const authResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const onClaim = async () => {
    try {
      const biometricApproved = await tryBiometricAuth('Confirm claim');
      if (!biometricApproved) {
        const pinApproved = await new Promise<boolean>((resolve) => {
          authResolverRef.current = resolve;
          setPinPromptVisible(true);
        });

        if (!pinApproved) {
          setStatus('Claim canceled. Authentication required.');
          return;
        }
      }

      if (!pocketBackend.isConfigured()) {
        setStatus('Backend is not configured. Set EXPO_PUBLIC_POCKET_BACKEND_BASE_URL.');
        return;
      }

      setStatus('Claiming pending payments...');
      const response = await pocketBackend.claimPayments(email.trim().toLowerCase());
      setStatus(`Claimed transfers: ${response.claimedCount}`);
    } catch (error) {
      setStatus(`Claim failed: ${String(error)}`);
    }
  };

  const onPinConfirm = async (pin: string): Promise<boolean> => {
    const ok = await verifyStoredPin(pin);
    if (!ok) {
      return false;
    }

    setPinPromptVisible(false);
    authResolverRef.current?.(true);
    authResolverRef.current = null;
    return true;
  };

  const onPinCancel = () => {
    setPinPromptVisible(false);
    authResolverRef.current?.(false);
    authResolverRef.current = null;
  };

  return (
    <Screen testID="claim-screen">
      <ScrollView contentContainerStyle={styles.container}>
        <Title>Claim Funds</Title>
        <BodyText>Claim pending transfers sent to your email.</BodyText>

        <Input
          testID="claim-email-input"
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <PrimaryButton testID="claim-submit-button" label="Claim" onPress={onClaim} />
        <BodyText testID="claim-status" style={styles.status}>{status}</BodyText>
      </ScrollView>

      <PinAuthSheet
        visible={pinPromptVisible}
        title="Enter PIN to confirm claim"
        onConfirm={onPinConfirm}
        onCancel={onPinCancel}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 48,
    gap: 10,
  },
  status: {
    marginTop: 6,
  },
});
