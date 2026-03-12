# Pocket Money Core

Go EOA wallet core for `gomobile` (iOS/Android) plus a small backend API for cached balances, transactions, and FX rates.

## Architecture

- `main.go`: `WalletCore` gomobile facade, encrypted DB lifecycle, network/token registration, JSON responses.
- `internal/database`: SQLCipher persistence for wallets, transactions, watched addresses, and balance history.
- `internal/ethereum`: EOA key management, balance reads, token transfers, inbound sync helpers.
- `internal/services`: backend workers for balances, transactions, and FX rates.
- `cmd/api`: HTTP API for cached data.
- `cmd/cli`: local CLI for core testing.

## Public `WalletCore` API

**Lifecycle**
- `Init(dataDir, masterKeyB64, kdfSaltB64) error`
- `Close() error`

**Network + token registration**
- `RegisterNetwork(name, rpcURL string, chainID int64)`
- `RegisterToken(network, identifier, symbol, address string, decimals int)`

**Wallet management**
- `CreateEthereumWallet(name string) (string, error)`
- `OpenOrCreateWallet(name string) (string, error)`
- `GetAddress() (string, error)`
- `ListAccounts() (string, error)`

**Address utilities**
- `ValidateAddress(addr string) string`
- `SignMessage(message string) (string, error)`

**Balances + history**
- `GetTokenBalance(networkName, tokenIdentifier string) (string, error)`
- `GetAllBalances(networkName string) (string, error)`
- `GetPriceHistory(networkName string, limit int) (string, error)`

**Watched addresses**
- `AddWatchedAddress(address, label string) error`
- `ListWatchedAddresses() (string, error)`

**Transfers**
- `SendToken(networkName, tokenIdentifier, recipient, amount string) (string, error)`

**Transactions**
- `SyncInboundTransactions(networkName string) (string, error)`
- `ListTokenTransactions(networkName, tokenIdentifier string, limit, offset int) (string, error)`
- `ListAllTransactions(networkName string, limit, offset int) (string, error)`

**Backup**
- `ExportWalletBackup(passphrase string) (string, error)`
- `ImportWalletBackup(payload, passphrase string) (string, error)`

Notes:
- Many methods return JSON-encoded strings for stable gomobile boundaries.
- The module is network-agnostic; the app registers networks and tokens at runtime.

## Backend API (`core/cmd/api`)

Endpoints:
- `GET /health`
- `POST /v1/wallets` (register a wallet address for tracking)
- `GET /v1/wallets/` (list tracked wallets)
- `GET /v1/balances?address=0x...&network=ethereum-sepolia`
- `GET /v1/transactions?address=0x...&direction=debit|credit&limit=20&offset=0`
- `GET /v1/fx/latest?pair=USD/ZAR`

Background workers:
- Balance + transaction workers use Alchemy RPC URLs from `POCKET_NETWORKS`.
- FX worker uses the Frankfurter API (no key required).

## Configuration

**CLI** (`cmd/cli`):
- `POCKET_NETWORK_NAME` (default `ethereum-sepolia`)
- `POCKET_RPC_URL` (default Alchemy demo URL)

**API** (`cmd/api`):
- `POCKET_API_ADDR` (default `:8080`)
- `POCKET_API_KEY` (optional; enables API key middleware)
- `POCKET_API_RATE_LIMIT_RPM` (default `120`)
- `POCKET_API_MONGO_URI`
- `POCKET_API_MONGO_DB_NAME`
- `POCKET_API_MONGO_CONNECT_TIMEOUT_SECONDS` (default `15`)
- `POCKET_NETWORKS` (comma list: `name:rpcURL`)
- `POCKET_ALCHEMY_API_KEY` (presence enables balance/tx workers)

## Build and Test

From `core/`:
- `go test ./...`
- `make test`
- `make android`
- `make ios`
- `make cli`
- `make api`
- `make run-api`

## Current Scope (v1)

- EOA-only wallet core with ETH + USDC support.
- Default networks: `ethereum-sepolia` (dev), `ethereum-mainnet` (prod).
