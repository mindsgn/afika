# Pocket Money - Reddit Draft

Title: Building a South Africa-first USDC app (private beta soon) - feedback wanted

Hey everyone,

I am building **Pocket Money**, an MVP focused on making USDC transfers simple for South African users.

Current MVP scope:
- Create wallet on-device
- Unlock with password (biometric option)
- Send USDC to wallet address or email
- Claim funds in-app
- Manual bank transfer request flow (handled operationally for now)

Architecture:
- Expo/React Native + TypeScript frontend
- Go + gomobile wallet core
- API with api-key auth, rate limits, and idempotency work in progress
- Sepolia private beta first

Important product decision:
We kept the MVP focused so we can ship faster and reduce failure points.

I would love feedback on:
1. What would make this genuinely useful in South Africa?
2. Biggest trust or UX concerns with email-based claim flows?
3. What would make you comfortable using this for real payments later?

If you want to test early builds, comment or DM.
