# Pocket Money Business Model (South Africa)

Date: 10 March 2026

## Goal

Build a South Africa-first money app that makes digital dollar transfers simple, fast, and cheaper than traditional options.

## Users

- Freelancers and remote workers paid by international clients.
- Small businesses paying suppliers or contractors.
- Families sending money cross-border.
- Early fintech users who want fast, app-first transfers.

## Core Value

- USDC-first payments with a familiar banking-style mobile UX.
- Fast movement of value compared with traditional rails.
- Local support model for manual payout/deposit in early stages.

## Monetization Options

1. FX spread on USDC to ZAR settlement
- Add a small spread between market rate and settlement rate.
- Example: 0.5% to 1.5% depending on volume tier.

2. Transfer fee tiers
- Free or low fee for first monthly limit.
- Small flat or percentage fee above threshold.

3. Priority payout fees
- Standard payout: lower fee.
- Priority payout (same-day/manual fast lane): premium fee.

4. Merchant tools (B2B)
- Invoice links and payment collection tools.
- Monthly subscription for business dashboard and exports.

5. API access (long-term)
- Partner APIs for embedded payouts/collections.
- Usage-based pricing once reliability is proven.

6. Float/treasury optimization (careful compliance)
- Controlled treasury yield on held balances where legal.
- Must be transparent and compliant with regulations.

## Suggested Pricing for Private Beta to Early Launch

- Wallet creation: free.
- Internal/email claim transfers: free during private beta.
- Address sends: free or near-zero during private beta.
- Bank transfer request processing fee: fixed ZAR fee.
- Later: introduce FX spread and transfer tiers gradually.

## Unit Economics to Track

- Cost per successful transfer.
- Support cost per active user.
- Revenue per transfer and per active user.
- Manual payout operations cost.
- Fraud/chargeback loss rate.

## Risks

- Compliance and licensing requirements in South Africa.
- Fraud attempts in email-claim and manual payout flows.
- Operational bottlenecks from manual bank processing.
- User trust concerns around crypto terminology.

## Risk Controls

- Keep UX crypto-light and plain-language first.
- Strong auth: device secret + password/biometric on send.
- API key, rate limiting, idempotency, and audit logs.
- Manual review queue for suspicious transactions.
- Explicit transaction states and support tooling.

## Go-To-Market (Private Beta)

- Focus on South African early adopters via community channels.
- Recruit testers from freelancer and small-business groups.
- Offer fee-free beta period in return for structured feedback.
- Publish transparent roadmap and reliability metrics.

## 12-Month Path

1. Month 1-2
- Ship private beta on Sepolia, validate UX and reliability.

2. Month 3-4
- Add stronger ops tooling and expand tester cohort.

3. Month 5-6
- Introduce controlled production-network rollout and paid pricing.

4. Month 7-12
- Add merchant tools and improve payout automation.
