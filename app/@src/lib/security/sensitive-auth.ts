import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const ONBOARDED_KEY = 'onboarded';

export const PIN_KEY = 'password';

export async function tryBiometricAuth(promptMessage: string): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!hasHardware || !isEnrolled) {
    return false;
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    fallbackLabel: 'Use PIN',
    disableDeviceFallback: false,
  });

  return result.success;
}

export async function verifyStoredPin(pin: string): Promise<boolean> {
  const savedPin = await SecureStore.getItemAsync(PIN_KEY);
  return !!savedPin && savedPin === pin;
}

export async function savePin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function hasPin(): Promise<boolean> {
  const pin = await SecureStore.getItemAsync(PIN_KEY);
  return !!pin;
}

export async function markOnboarded(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDED_KEY, 'true');
}

export async function isOnboarded(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(ONBOARDED_KEY);
  return val === 'true';
}

export async function clearAllSecrets(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
  await SecureStore.deleteItemAsync(ONBOARDED_KEY);
}

