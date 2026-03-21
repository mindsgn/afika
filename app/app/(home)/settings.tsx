import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { Screen, Title, BodyText, PrimaryButton } from '@/@src/components/Primitives';
import useWallet from '@/@src/store/wallet';
import { clearAllSecrets, verifyStoredPin, savePin } from '@/@src/lib/security/sensitiveAuth';
import PinAuthSheet from '@/@src/components/PinAuthSheet';

const BIOMETRIC_KEY = 'biometric_enabled';

export default function Settings() {
  const router = useRouter();
  const { clearWalletState } = useWallet();
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [changePinVisible, setChangePinVisible] = useState(false);
  const [changePinStep, setChangePinStep] = useState<'current' | 'new'>('current');
  const [capturedNewPin, setCapturedNewPin] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);

      const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      setBiometricEnabled(stored === 'true');
    };
    void loadSettings();
  }, []);

  const toggleBiometric = async (value: boolean) => {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, value ? 'true' : 'false');
    setBiometricEnabled(value);
  };

  const handleChangePinStart = () => {
    setChangePinStep('current');
    setCapturedNewPin('');
    setChangePinVisible(true);
  };

  const handleChangePinConfirm = async (pin: string): Promise<boolean> => {
    if (changePinStep === 'current') {
      const ok = await verifyStoredPin(pin);
      if (!ok) return false;
      // Current PIN verified — now ask for new PIN
      setChangePinStep('new');
      return true; // sheet stays open for next step
    } else {
      // Save the new PIN
      await savePin(pin);
      setChangePinVisible(false);
      setChangePinStep('current');
      Alert.alert('PIN Updated', 'Your PIN has been changed successfully.');
      return true;
    }
  };

  const handleChangePinCancel = () => {
    setChangePinVisible(false);
    setChangePinStep('current');
    setCapturedNewPin('');
  };

  const handleResetWallet = () => {
    Alert.alert(
      'Reset Wallet',
      'This will permanently delete your wallet keys and all app data. Make sure you have a backup. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllSecrets();
              clearWalletState();
              router.replace('/(onboarding)/create');
            } catch {
              Alert.alert('Error', 'Failed to reset wallet. Please try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <Screen testID="settings-screen" style={styles.screen}>
      <Title>Settings</Title>

      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Security</Text>

        {biometricAvailable && (
          <View style={styles.row}>
            <BodyText style={styles.rowLabel}>Face ID / Touch ID</BodyText>
            <Switch
              testID="biometric-toggle"
              value={biometricEnabled}
              onValueChange={toggleBiometric}
              trackColor={{ false: '#2A2A36', true: '#4F7FFF' }}
              thumbColor="#fff"
            />
          </View>
        )}

        <TouchableOpacity
          testID="change-pin-button"
          style={styles.rowButton}
          onPress={handleChangePinStart}
        >
          <BodyText style={styles.rowLabel}>Change PIN</BodyText>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="link-phone-button"
          style={styles.rowButton}
          onPress={() => router.push('/(home)/link-phone')}
        >
          <BodyText style={styles.rowLabel}>Link Phone Number (Level 1)</BodyText>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Danger Section */}
      <View style={[styles.section, styles.dangerSection]}>
        <Text style={styles.sectionHeader}>Danger Zone</Text>
        <View style={styles.dangerButtonWrapper}>
          <PrimaryButton
            testID="reset-wallet-button"
            label="Reset Wallet"
            onPress={handleResetWallet}
          />
        </View>
      </View>

      <PinAuthSheet
        visible={changePinVisible}
        title={changePinStep === 'current' ? 'Enter current PIN' : 'Enter new PIN'}
        onConfirm={handleChangePinConfirm}
        onCancel={handleChangePinCancel}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingVertical: 48,
    gap: 24,
  },
  section: {
    borderRadius: 12,
    backgroundColor: '#15151A',
    overflow: 'hidden',
  },
  dangerSection: {
    backgroundColor: '#1A0E0E',
  },
  sectionHeader: {
    color: '#5A5A64',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A36',
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2A2A36',
  },
  rowLabel: {
    color: '#E5E5EA',
    fontSize: 14,
  },
  chevron: {
    color: '#5A5A64',
    fontSize: 22,
    lineHeight: 24,
  },
  dangerButtonWrapper: {
    margin: 16,
  },
});
