export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-sm text-zinc-700 dark:text-zinc-300">
      <h1 className="text-2xl font-semibold mb-6">Privacy Policy</h1>

      <p className="mb-4">
        AFIKA is a non-custodial wallet designed to give you full control over your digital money.
        Your privacy is fundamental to how the app is built.
      </p>

      <h2 className="font-medium mt-6 mb-2">1. No Custodial Control</h2>
      <p className="mb-4">
        AFIKA does not store, access, or control your funds. Your wallet is created and managed
        directly on your device. You are solely responsible for your private keys and access credentials.
      </p>

      <h2 className="font-medium mt-6 mb-2">2. Data Collection</h2>
      <p className="mb-4">
        AFIKA does not require account registration. We do not collect personal identity information.
        Limited technical data (such as app performance and crash logs) may be collected to improve the app.
      </p>

      <h2 className="font-medium mt-6 mb-2">3. On-Device Storage</h2>
      <p className="mb-4">
        Wallet data, PIN settings, and preferences are stored locally on your device. AFIKA does not
        store this data on external servers.
      </p>

      <h2 className="font-medium mt-6 mb-2">4. Security</h2>
      <p className="mb-4">
        Access to your wallet is protected by a 5-digit PIN and optional biometric authentication.
        You are responsible for keeping your device secure.
      </p>

      <h2 className="font-medium mt-6 mb-2">5. Third-Party Services</h2>
      <p className="mb-4">
        AFIKA may use third-party services for blockchain interaction and FX rate data.
        These services may process limited technical data required for functionality.
      </p>

      <h2 className="font-medium mt-6 mb-2">6. Your Responsibility</h2>
      <p className="mb-4">
        As a non-custodial wallet, you are fully responsible for your wallet access, recovery,
        and transactions. Loss of access credentials may result in permanent loss of funds.
      </p>

      <h2 className="font-medium mt-6 mb-2">7. Updates</h2>
      <p>
        This policy may be updated to reflect improvements or legal requirements.
      </p>
    </div>
  );
}
