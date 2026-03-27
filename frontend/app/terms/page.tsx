export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-sm text-zinc-700 dark:text-zinc-300">
      <h1 className="text-2xl font-semibold mb-6">Terms of Service</h1>

      <p className="mb-4">
        By using AFIKA, you agree to the following terms.
      </p>

      <h2 className="font-medium mt-6 mb-2">1. Non-Custodial Wallet</h2>
      <p className="mb-4">
        AFIKA is a non-custodial wallet. You retain full control over your private keys and funds.
        AFIKA does not hold, manage, or recover your assets.
      </p>

      <h2 className="font-medium mt-6 mb-2">2. User Responsibility</h2>
      <p className="mb-4">
        You are responsible for securing your device, PIN, and wallet access. AFIKA cannot recover
        lost wallets, forgotten PINs, or stolen credentials.
      </p>

      <h2 className="font-medium mt-6 mb-2">3. Transactions</h2>
      <p className="mb-4">
        All transactions are executed on blockchain networks and are irreversible.
        AFIKA does not control or guarantee transaction confirmation times.
      </p>

      <h2 className="font-medium mt-6 mb-2">4. No Financial Advice</h2>
      <p className="mb-4">
        AFIKA does not provide financial, investment, or legal advice. Use of the app is at your own risk.
      </p>

      <h2 className="font-medium mt-6 mb-2">5. Availability</h2>
      <p className="mb-4">
        We strive to keep AFIKA reliable, but we do not guarantee uninterrupted access or error-free operation.
      </p>

      <h2 className="font-medium mt-6 mb-2">6. Limitation of Liability</h2>
      <p className="mb-4">
        AFIKA is not liable for any loss of funds, data, or damages resulting from misuse,
        device compromise, or user error.
      </p>

      <h2 className="font-medium mt-6 mb-2">7. Changes</h2>
      <p>
        These terms may be updated over time. Continued use of AFIKA constitutes acceptance of changes.
      </p>
    </div>
  );
}