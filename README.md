# Pocket Money

Pocket Money is a mobile wallet project with a Go core (`gomobile`), native Expo bridges (iOS/Android), and a simple EOA-based USDC/ETH wallet on Ethereum (Sepolia for testing).

## Monorepo map

- `core/`: Go wallet core (SQLCipher persistence, EOA token send flows, backend API)
- `app/`: Expo app + native bridge module (`modules/pocket-module`) for PocketCore
- `contract/`: Hardhat contracts, tests, and deployment scripts (smart accounts for a future phase)
- `docs/`: architecture notes, implementation logs, active tasks, and business docs

## MVP v1: Non–Smart-Account Wallet

For MVP v1 we paused ERC‑4337 smart accounts and paymaster sponsorship and focused on a simple, reliable EOA wallet:

- **On-device (Go core via gomobile)**:
  - Generate and store a single EOA per user (encrypted DB + OS keystore).
  - Get ETH/USDC balances and transaction history.
  - Send ETH or USDC directly from the EOA.
- **Backend (`core/cmd/api`)**:
  - User registration (`/v1/users/*`) and address mapping (email → EOA).
  - Balance, FX, and payment endpoints (`/v1/balances`, `/v1/payments/*`, `/v1/fx/*`).
  - API-key auth + simple per-IP rate limiting.
- **App (`app/`)**:
  - Expo app with secure onboarding (password + `expo-secure-store`), home, send, transactions, and settings screens.
  - Cash App / Robinhood–style UI; USDC-first, ETH hidden by default.

The previous AA stack is documented for future work in `doc/smart-accounts-plan.md`.

## Current network defaults

- Development default network: `ethereum-sepolia`
- Production default network: `ethereum-mainnet`
- Default asset scope in app/core: `native` and `usdc`

## Core API surface (bridge-facing)

The Expo bridge (`PocketCore`) exposes the `WalletCore` facade methods, including:

- `initWallet(dataDir, password, masterKeyB64, kdfSaltB64)`
- `initWalletSecure(dataDir, password)`
- `closeWallet()`
- `openOrCreateWallet(name)`
- `createEthereumWallet(name)`
- `getAccountSummary(network)`
- `getAccountSnapshot(network)`
- `sendToken(network, tokenIdentifier, destination, amount, note, providerID)`
- `listAllTransactions(network, limit, offset)`
- `exportBackup(passphrase)`
- `importBackup(payload, passphrase)`

Smart-account and sponsorship methods exist in the codebase but are not used in MVP v1; see `doc/smart-accounts-plan.md` for future work.

## Validation commands

### Contracts

```bash
cd contract
npx hardhat test
```

### Go core

```bash
cd core
go test ./...
```

### Expo app TypeScript

```bash
cd app
npm run lint
npx tsc --noEmit
```

## More docs

- Contract architecture: `docs/contract.md`
- Backend API plan: `docs/backend.md`
- Working notes: `docs/notes.md`
- Active task list: `docs/tasks.md`
- Core internals: `core/README.md`
