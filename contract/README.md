# Pocket Money Contracts

Hardhat project for Pocket Money account-abstraction contracts.

## Scope

- `SmartAccount.sol`: account contract with EntryPoint-aware validation and execution.
- `SmartAccountFactory.sol`: deterministic deployment and `create/get` helpers for AA flows.
- `USDCPaymaster.sol`: strict USDC sponsorship policy for EntryPoint v0.7.

Deployments are written to `contract/deployments/<network>.json` and consumed by core runtime config.

## Prerequisites

- Node.js 22+
- npm
- Sepolia RPC URL
- deployer private key (for deploy scripts)

Environment examples:

```bash
export SEPOLIA_RPC_URL="https://sepolia.infura.io/v3/<key>"
export SEPOLIA_PRIVATE_KEY="0x..."
```

## Commands

Run tests:

```bash
npx hardhat test
```

Deploy contracts:

```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

Run sponsorship preflight smoke checks:

```bash
npx hardhat run scripts/smoke-sepolia.ts --network sepolia
```

The smoke script validates on-chain prerequisites for sponsored creation/send:

- factory bytecode present
- paymaster bytecode present
- paymaster EntryPoint wiring matches expected value
- paymaster signer is configured (non-zero)
- factory is trusted by paymaster
- paymaster deposit is non-zero

## Testing Notes

- `smartAccount.ts` covers deterministic deployment and `validateUserOp` correctness.
- `paymaster.ts` contains baseline coverage and scaffolding for advanced validation-path tests.
- If advanced paymaster tests are expanded, they must execute in an EntryPoint caller context to avoid false negatives.
