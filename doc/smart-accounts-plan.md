## Smart Accounts – Future Plan

### Why we paused smart accounts for MVP v1

- The ERC‑4337 account abstraction path (EntryPoint, Bundler, Paymaster, SmartAccountFactory) added significant complexity and moving parts:
  - External bundler reliability and version mismatches (v0.6 vs v0.7 UserOperation shape).
  - Paymaster policy and validation issues surfaced as `AA23 reverted` with limited diagnostics.
  - More complicated onboarding and signing flows on mobile (UserOperation payloads, paymaster signatures).
- To ship a reliable product quickly, we are focusing MVP v1 on a simple EOA-based wallet with USDC/ETH on Sepolia.
- The current codebase already has a solid foundation for:
  - EOA key management via the Go core.
  - Token sends and balance reads.

### What we already built for smart accounts

- Contracts:
  - `SmartAccount.sol` – upgradeable ERC‑4337 smart account.
  - `SmartAccountFactory.sol` – factory with CREATE2 deployment and optional EntryPoint-aware creation.
  - `USDCPaymaster.sol` – paymaster that sponsors gas for USDC-only flows.
- Go core:
  - `UserOperation` type, bundler client, and paymaster signing helpers.
  - Smart-account creation and send paths using sponsored UserOperations.
- Backend API:
  - `/v1/aa/readiness`, `/v1/aa/create-sponsored`, `/v1/aa/send-sponsored` for sponsored creation and sends.
- App:
  - Onboarding flow that talked to the backend, signed UserOperations on-device, and relied on the paymaster and bundler.

### How we will reintroduce smart accounts later

When the EOA-based MVP is stable and live, we can bring back smart accounts in phases:

1. **Read-only AA status**
   - Expose AA-related readiness endpoints again (e.g. `/v1/aa/readiness`) that only report whether AA infra is healthy.
   - Show AA readiness in the app without changing send/receive behavior.

2. **Opt-in AA deployment**
   - Allow existing EOA users to “upgrade” to a smart account controlled by their EOA.
   - Use a dedicated “AA upgrade” screen and a clearly labeled on-chain deployment step.

3. **Paymaster-backed sponsored UX**
   - Once paymaster policy and limits are well tested, reintroduce gasless USDC sends via UserOperations with clear fallbacks.

4. **Migration of flows**
   - Gradually move high-value flows (recurring payments, fee abstraction, batching) onto smart accounts while keeping regular EOA sends as a fallback.

### Code organization guidance

For future AA work:

- Keep AA-specific logic in clearly separated packages/modules:
  - Go core: `internal/ethereum/aa` for UserOperation, bundler, and paymaster helpers.
  - Backend API: `/v1/aa/*` routes in a dedicated router file.
  - App: AA-specific hooks and screens in a separate sub-tree so they can be toggled on/off by feature flags.
- Prefer feature flags or build-time switches over hard-deleting EOA paths.

This document exists so we can confidently remove AA code from the MVP v1 surface while preserving the architectural knowledge needed to add it back in a future release.

