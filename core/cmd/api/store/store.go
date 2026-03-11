package store

import (
	"context"
	"errors"
)

// ErrNotFound is returned when a requested record does not exist.
var ErrNotFound = errors.New("store: not found")

// User represents the minimal user data needed by the HTTP API layer.
type User struct {
	Email     string
	Address   string
	CreatedAt int64
}

// EmailTransfer represents an email-based payment transfer used by the API.
type EmailTransfer struct {
	ID            string
	FromEmail     string
	ToEmail       string
	AmountUSDC    string
	Status        string
	OnchainTxHash string
	CreatedAt     int64
	UpdatedAt     int64
}

// FXRate represents a foreign exchange rate snapshot used by the API.
type FXRate struct {
	Pair      string
	Rate      string
	FetchedAt int64
}

// APIDatabase defines the operations the HTTP API expects from its backing store.
//
// It is intentionally narrow and focused on the specific data used by
// core/cmd/api/routes/handlers.go so that different backing stores (SQLite,
// MongoDB, etc.) can be swapped without changing handler logic.
type APIDatabase interface {
	InsertUserIfMissing(ctx context.Context, email, address string) error
	FindUserByEmail(ctx context.Context, email string) (*User, error)

	InsertEmailTransfer(ctx context.Context, t *EmailTransfer) error
	ListPendingEmailTransfersForRecipient(ctx context.Context, email string) ([]*EmailTransfer, error)
	MarkEmailTransfersClaimed(ctx context.Context, email string) error

	LatestFXRate(ctx context.Context, pair string) (*FXRate, error)

	// Close releases any underlying resources (connections, clients, etc.).
	Close(ctx context.Context) error
}

