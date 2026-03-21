package store

import (
	"context"
	"errors"
)

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("store: not found")

// WalletRecord holds a tracked wallet address and the network it belongs to.
type WalletRecord struct {
	Address   string
	Network   string
	CreatedAt int64
}

// BalanceSnapshot holds the latest fetched balance for a token on a network.
type BalanceSnapshot struct {
	WalletAddress string
	Network       string
	TokenAddress  string
	TokenSymbol   string
	Balance       string
	USDValue      string
	FetchedAt     int64
}

// TransactionItem represents a single on-chain transfer classified by direction.
type TransactionItem struct {
	WalletAddress string
	TxHash        string
	FromAddress   string
	ToAddress     string
	Description   string
	TokenAddress  string
	TokenSymbol   string
	Amount        string
	FeeETH        string
	FeeUSD        string
	USDAmount     string
	Network       string
	Direction     string // "debit" | "credit"
	State         string
	BlockNumber   uint64
	Timestamp     int64
	FetchedAt     int64
}

// FXRate represents a foreign exchange rate snapshot.
type FXRate struct {
	Pair      string
	Rate      string
	FetchedAt int64
}

// APIDatabase is the minimal write-and-read interface the HTTP API layer needs.
// Different backing stores (MongoDB, SQLite, …) implement this interface.
type APIDatabase interface {
	// Wallets
	SaveWallet(ctx context.Context, w WalletRecord) error
	ListWallets(ctx context.Context) ([]WalletRecord, error)
	ListWalletAddresses(ctx context.Context) ([]string, error)

	// Balances
	UpsertBalance(ctx context.Context, b BalanceSnapshot) error
	GetLatestBalances(ctx context.Context, address, network string) ([]BalanceSnapshot, error)

	// Transactions
	UpsertTransaction(ctx context.Context, t TransactionItem) error
	ListTransactions(ctx context.Context, address, direction string, limit, offset int) ([]TransactionItem, int64, error)

	// FX rates
	UpsertFXRate(ctx context.Context, pair, rate string, fetchedAt int64) error
	LatestFXRate(ctx context.Context, pair string) (*FXRate, error)

	// Lifecycle
	Close(ctx context.Context) error
}
