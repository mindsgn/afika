# MVP v1 Plan (EOA-Only Reset)

Date: 10 March 2026
Status: In progress

## Decision

We are pausing smart-account/AA flows for MVP v1 and shipping an EOA-first product.

Why this is the best decision now:
- Faster time-to-market with fewer moving parts.
- Lower production risk while there are zero users.
- Better focus on user experience, security, and operations.
- AA work is preserved for post-MVP reintroduction.

## Stack

- Go + gomobile
- Expo + React Native + TypeScript
- Zod + Zustand
- Drizzle + Expo SQLite
- Expo Secure Store

## Product Scope (MVP v1)

1. Wallet onboarding and unlock
- Create wallet on device.
- Confirm PIN/password flow.
- Store unlock secret in SecureStore.
- Optional biometrics for unlock/send confirmation.

2. Send and receive
- Send USDC by default.
- Send ETH and USDC supported.
- Send to Ethereum address.
- Send by email (backend pending record first).
- Claim funds screen in app.

3. Balance and transactions
- Home card with wallet overview.
- USDC-first balance display.
- ETH hidden by default; optional advanced toggle.
- Transaction list USDC-first; optional ETH visibility.

4. Backend/API and operations
- Save user address in backend.
- API key required on protected routes.
- Rate limiting and idempotency on money-moving routes.
- Address watcher saves sent/received events.
- Forex watcher stores hourly rates.

5. South Africa cash-in/cash-out (MVP)
- Deposit/top-up screen with direct bank deposit instructions.
- Bank transfer request ticket flow.
- Manual payout processing for now.

6. Testing and release quality
- Unit tests for core and API.
- Gomobile bridge smoke tests.
- Maestro E2E flows with full testID coverage.

## Non-Goals (MVP v1)

- Smart-account account abstraction in production paths.
- Automated bank payout integration.
- Full compliance automation/KYC onboarding.
- Multi-network production switching.

## Implementation Phases

## Phase 1: Remove Smart-Account Interactions
- Remove AA calls from app onboarding and screens.
- Remove AA state from Zustand store.
- Disable AA bridge methods in core with explicit errors.
- Force direct-mode sending by default.

## Phase 2: Secure Wallet UX
- Add biometric unlock/confirm on send.
- Add secure settings controls (lock mode, session timeout).
- Ensure password/biometric challenge before send or claim.

## Phase 3: Payments and Claims
- Add email send flow UI and API integration.
- Add claim flow UI and backend status handling.
- Add bank transfer request ticket UI/API.

## Phase 4: Backend Hardening
- API key enforcement checks.
- IP + API-key rate limiting.
- Idempotency key support and duplicate-send guardrails.
- Structured logs and request IDs for tracing.

## Phase 5: Watchers and Data
- Address activity watcher service.
- Hourly forex fetch service.
- Persist events/rates for app and support tools.

## Phase 6: Tests and QA
- Core/API unit and integration test expansion.
- Maestro onboarding/send/claim/deposit flows.
- Sepolia UAT checklist before private beta.

## Missing Items Added to Plan

These were not explicit enough and are now included:
- Session timeout and re-auth policy for sensitive actions.
- Duplicate-send prevention via idempotency keys.
- Operational runbook for manual bank transfer processing.
- Error taxonomy for app-friendly failures.
- Feature flags/kill-switches for email and bank-request flows.
- Audit logging for money-moving endpoints.

## Success Metrics (Private Beta)

- 95%+ successful wallet create/unlock flows.
- 95%+ successful USDC send flows on Sepolia.
- Zero duplicate fund sends.
- 90%+ Maestro critical-flow pass rate.
- User feedback from at least 20 South African testers.

## Post-MVP (v1.1+)

- Reintroduce smart accounts in a controlled rollout.
- Add gasless UX and sponsorship policies.
- Integrate automated fiat rails.
- Expand to lower-fee production network options.
