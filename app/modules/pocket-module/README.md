# pocket-module

Local Expo module that exposes the Go `WalletCore` (gomobile) API to JavaScript as `PocketCore`.

## Required files

- `expo-module.config.json`: declares iOS module class (`PocketModule`).
- `package.json`: module identity used by Expo autolinking.
- `pocket-module.podspec`: CocoaPods spec and `PocketCore.xcframework` reference.
- `ios/PocketModule.swift`: Expo Modules wrapper with `Name("PocketCore")`.
- `ios/PocketCore.xcframework`: vendored Go mobile framework.

If any of these are missing, `requireNativeModule('PocketCore')` will fail at runtime.

## Public JS API

`PocketCore` mirrors the Go `WalletCore` surface (see `src/PocketModule.types.ts`).

**Lifecycle**
- `initWallet(dataDir, masterKeyB64, kdfSaltB64)`
- `initWalletSecure(dataDir)` (Keychain/Keystore path; preferred)
- `closeWallet()`

**Network + token registration**
- `registerNetwork(name, rpcURL, chainID)`
- `registerToken(network, identifier, symbol, address, decimals)`

**Wallet management**
- `createEthereumWallet(name)`
- `openOrCreateWallet(name)`
- `getAddress()`
- `listAccounts()`

**Utilities**
- `validateAddress(addr)`
- `signMessage(message)`

**Balances + history**
- `getTokenBalance(networkName, tokenIdentifier)`
- `getAllBalances(networkName)`
- `getPriceHistory(networkName, limit)`

**Watched addresses**
- `addWatchedAddress(address, label)`
- `listWatchedAddresses()`

**Transfers**
- `sendToken(networkName, tokenIdentifier, recipient, amount)`

**Transactions**
- `syncInboundTransactions(networkName)`
- `listTokenTransactions(networkName, tokenIdentifier, limit, offset)`
- `listAllTransactions(networkName, limit, offset)`

**Backup**
- `exportWalletBackup(passphrase)`
- `importWalletBackup(payload, passphrase)`

Notes:
- Many methods return JSON strings for stable gomobile boundaries; parse in JS.
- The app must register the active network + tokens before balance/send calls.

## Build profile env configuration

Pocket runtime config values for Expo builds are defined in `app/.env` and `app/eas.json`.

Common keys:
- `EXPO_PUBLIC_APP_ENV` (controls default network selection in app screens)
- `EXPO_PUBLIC_ALCHEMY_RPC_URL_SEPOLIA`
- `EXPO_PUBLIC_ALCHEMY_RPC_URL_MAINNET`
- `EXPO_PUBLIC_POCKET_BACKEND_BASE_URL`
- `EXPO_PUBLIC_POCKET_BACKEND_API_KEY`

Backend calls live in `app/@src/lib/api/pocketBackend.ts` and are separate from this module.

## Regenerate and validate iOS registration

```bash
cd app
npx expo prebuild --clean --platform ios --non-interactive
cd ios && pod install && cd ..
./scripts/check-pocketcore-module.sh
```

The registration source of truth is:
`ios/Pods/Target Support Files/Pods-PocketMoney/ExpoModulesProvider.swift`
