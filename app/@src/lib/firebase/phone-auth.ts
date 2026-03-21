import type { ApplicationVerifier, Auth, ConfirmationResult } from 'firebase/auth';
import { signInWithPhoneNumber } from 'firebase/auth';

type ErrorLike = {
  code?: string;
  message?: string;
};

export async function requestPhoneVerificationCode(
  auth: Auth,
  phoneNumber: string,
  appVerifier: ApplicationVerifier,
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
}

export async function confirmPhoneVerificationCode(
  confirmationResult: ConfirmationResult,
  verificationCode: string,
) {
  return confirmationResult.confirm(verificationCode);
}

export function mapPhoneAuthErrorMessage(error: unknown): string {
  const candidate = error as ErrorLike | undefined;
  const code = candidate?.code || '';
  const message = candidate?.message || '';

  if (code.includes('auth/invalid-phone-number')) {
    return 'The phone number is invalid. Use E.164 format, for example +27821234567.';
  }
  if (code.includes('auth/missing-phone-number')) {
    return 'Phone number is required.';
  }
  if (code.includes('auth/invalid-verification-code')) {
    return 'That verification code is incorrect. Please check and try again.';
  }
  if (code.includes('auth/code-expired')) {
    return 'That code has expired. Request a new verification code.';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'Network error. Check your internet connection and try again.';
  }
  if (code.includes('auth/captcha-check-failed')) {
    return 'Security verification failed. Request a new code and try again.';
  }

  if (message.includes('backend_not_configured')) {
    return 'Backend is not configured in this app build.';
  }
  if (message.includes('token_verification_required')) {
    return 'Phone verification token is required. Verify your number and try again.';
  }
  if (message.includes('token_verification_failed')) {
    return 'Phone verification token was rejected. Request a new code and retry.';
  }

  return 'Something went wrong. Please try again.';
}