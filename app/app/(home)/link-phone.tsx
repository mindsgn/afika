import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
// import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import type { ApplicationVerifier, ConfirmationResult } from 'firebase/auth';
import { BodyText, Input, PrimaryButton, Screen, Title } from '@/@src/components/Primitives';
import { pocketBackend } from '@/@src/lib/api/pocketBackend';
import { getFirebaseAuthClient } from '@/@src/lib/firebase/client';
import {
  confirmPhoneVerificationCode,
  mapPhoneAuthErrorMessage,
  requestPhoneVerificationCode,
} from '@/@src/lib/firebase/phone-auth';
import useWallet from '@/@src/store/wallet';

const e164Pattern = /^\+[1-9][0-9]{7,14}$/;
const otpPattern = /^[0-9]{6}$/;
const resendCooldownSeconds = 30;

export default function LinkPhoneScreen() {
  const router = useRouter();
  const { walletAddress, network } = useWallet();
  const authClient = useMemo(() => getFirebaseAuthClient(), []);
  const firebaseConfig = authClient?.app.options;
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  // const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);

  useEffect(() => {
    if (cooldownRemaining <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setCooldownRemaining((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1_000);

    return () => {
      clearInterval(timer);
    };
  }, [cooldownRemaining]);

  const canRequestCode = useMemo(() => {
    return walletAddress.length > 0 && network.length > 0 && e164Pattern.test(phoneNumber.trim());
  }, [walletAddress, network, phoneNumber]);

  const isBusy = isRequestingCode || isVerifyingCode || isLinking;

  const onRequestCode = async () => {
    if (!canRequestCode) {
      Alert.alert('Invalid phone number', 'Enter phone number in E.164 format, for example +27821234567.');
      return;
    }
    if (!pocketBackend.isConfigured()) {
      Alert.alert('Backend unavailable', 'Configure backend URLs to link phone number.');
      return;
    }

    if (!authClient || !firebaseConfig) {
      Alert.alert('Auth unavailable', 'Firebase Auth is not configured. Check app environment settings.');
      return;
    }

    /*
    const appVerifier = recaptchaVerifier.current as unknown as ApplicationVerifier | null;
    if (!appVerifier) {
      Alert.alert('Verification unavailable', 'Phone verification is not available right now. Please try again.');
      return;
    }
    */

    setIsRequestingCode(true);
    try {
        /*
      const confirmation = await requestPhoneVerificationCode(
        authClient,
        phoneNumber.trim(),
        // appVerifier,
      );
      */

      // setConfirmationResult(confirmation);
      setVerificationCode('');
      setCooldownRemaining(resendCooldownSeconds);
      Alert.alert('Code sent', 'Enter the 6-digit code sent to your phone number.');
    } catch (error) {
      Alert.alert('Failed to send code', mapPhoneAuthErrorMessage(error));
    } finally {
      setIsRequestingCode(false);
    }
  };

  const onVerifyCode = async () => {
    if (!confirmationResult) {
      Alert.alert('Request code first', 'Request a verification code before confirming OTP.');
      return;
    }
    if (!otpPattern.test(verificationCode.trim())) {
      Alert.alert('Invalid code', 'Enter the 6-digit verification code.');
      return;
    }
    if (!pocketBackend.isConfigured()) {
      Alert.alert('Backend unavailable', 'Configure backend URLs to link phone number.');
      return;
    }

    if (!authClient) {
      Alert.alert('Auth unavailable', 'Firebase Auth is not configured. Check app environment settings.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      await confirmPhoneVerificationCode(confirmationResult, verificationCode.trim());
    } catch (error) {
      Alert.alert('Verification failed', mapPhoneAuthErrorMessage(error));
      return;
    } finally {
      setIsVerifyingCode(false);
    }

    const currentUser = authClient.currentUser;
    if (!currentUser) {
      Alert.alert('Verification failed', 'Verified user session not found. Please request a new code.');
      return;
    }

    setIsLinking(true);
    try {
      const firebaseIdToken = await currentUser.getIdToken(true);

      await pocketBackend.linkPhoneNumber(walletAddress.toLowerCase(), network, phoneNumber.trim(), firebaseIdToken);
      Alert.alert('Phone linked', 'Phone number linked successfully. Your account is now Level 1.');
      router.back();
    } catch (error) {
      Alert.alert('Link failed', mapPhoneAuthErrorMessage(error));
    } finally {
      setIsLinking(false);
    }
  };

  const onChangeNumber = () => {
    if (isBusy) {
      return;
    }
    setConfirmationResult(null);
    setVerificationCode('');
    setCooldownRemaining(0);
  };

  return (
    <Screen style={styles.screen}>
      <Title>Link Phone Number</Title>
      <BodyText style={styles.description}>
        Verify your phone number to unlock Level 1 and trigger your gas gift.
      </BodyText>
      <View style={styles.form}>
        <Input
          testID="phone-input"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholder="+27821234567"
          keyboardType="phone-pad"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!confirmationResult && !isBusy}
        />
        {!confirmationResult ? (
          <PrimaryButton
            testID="request-code-button"
            label={isRequestingCode ? 'Sending Code...' : 'Request Verification Code'}
            onPress={onRequestCode}
          />
        ) : (
          <>
            <Input
              testID="otp-input"
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="123456"
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={6}
              editable={!isBusy}
            />
            <PrimaryButton
              testID="verify-code-button"
              label={isVerifyingCode || isLinking ? 'Verifying...' : 'Verify and Link Phone'}
              onPress={onVerifyCode}
            />
            <PrimaryButton
              testID="change-number-button"
              label="Change Number"
              onPress={onChangeNumber}
            />
            <PrimaryButton
              testID="resend-code-button"
              label={
                cooldownRemaining > 0
                  ? `Resend Code in ${cooldownRemaining}s`
                  : isRequestingCode
                    ? 'Sending Code...'
                    : 'Resend Verification Code'
              }
              onPress={() => {
                if (cooldownRemaining > 0 || isBusy) {
                  return;
                }
                void onRequestCode();
              }}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 16,
    paddingVertical: 48,
    gap: 16,
  },
  description: {
    color: '#A0A0AA',
  },
  form: {
    gap: 12,
    marginTop: 8,
  },
});
