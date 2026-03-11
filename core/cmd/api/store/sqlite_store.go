package store

import (
	"context"
	"database/sql"
	"errors"

	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
)

// SqliteAPIDatabase is an APIDatabase implementation backed by the existing
// encrypted SQLite database used elsewhere in the core service.
//
// This is primarily useful as a transitional adapter and for tests that still
// rely on the SQLite-backed implementation.
type SqliteAPIDDatabase struct {
	db *database.DB
}

// NewSqliteAPIDatabase wraps a *database.DB in an APIDatabase implementation.
func NewSqliteAPIDDatabase(db *database.DB) (*SqliteAPIDDatabase, error) {
	if db == nil {
		return nil, errors.New("sqlite api store: database is required")
	}
	return &SqliteAPIDDatabase{db: db}, nil
}

func (s *SqliteAPIDDatabase) InsertUserIfMissing(ctx context.Context, email, address string) error {
	return s.db.InsertUserIfMissing(ctx, email, address)
}

func (s *SqliteAPIDDatabase) FindUserByEmail(ctx context.Context, email string) (*User, error) {
	u, err := s.db.FindUserByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &User{
		Email:     u.Email,
		Address:   u.Address,
		CreatedAt: u.CreatedAt,
	}, nil
}

func (s *SqliteAPIDDatabase) InsertEmailTransfer(ctx context.Context, t *EmailTransfer) error {
	if t == nil {
		return errors.New("sqlite api store: email transfer is required")
	}

	dbTransfer := database.EmailTransfer{
		UUID:          t.ID,
		FromEmail:     t.FromEmail,
		ToEmail:       t.ToEmail,
		AmountUSDC:    t.AmountUSDC,
		Status:        t.Status,
		OnchainTxHash: t.OnchainTxHash,
		CreatedAt:     t.CreatedAt,
		UpdatedAt:     t.UpdatedAt,
	}

	if err := s.db.InsertEmailTransfer(ctx, dbTransfer); err != nil {
		return err
	}

	// Note: the underlying InsertEmailTransfer currently does not expose the
	// generated UUID back to the caller, so we leave t.ID unchanged here.
	return nil
}

func (s *SqliteAPIDDatabase) ListPendingEmailTransfersForRecipient(ctx context.Context, email string) ([]*EmailTransfer, error) {
	transfers, err := s.db.ListPendingEmailTransfersForRecipient(ctx, email)
	if err != nil {
		return nil, err
	}

	out := make([]*EmailTransfer, 0, len(transfers))
	for _, t := range transfers {
		copy := t
		out = append(out, &EmailTransfer{
			ID:            copy.UUID,
			FromEmail:     copy.FromEmail,
			ToEmail:       copy.ToEmail,
			AmountUSDC:    copy.AmountUSDC,
			Status:        copy.Status,
			OnchainTxHash: copy.OnchainTxHash,
			CreatedAt:     copy.CreatedAt,
			UpdatedAt:     copy.UpdatedAt,
		})
	}
	return out, nil
}

func (s *SqliteAPIDDatabase) MarkEmailTransfersClaimed(ctx context.Context, email string) error {
	return s.db.MarkEmailTransfersClaimed(ctx, email)
}

func (s *SqliteAPIDDatabase) LatestFXRate(ctx context.Context, pair string) (*FXRate, error) {
	r, err := s.db.LatestFXRate(ctx, pair)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &FXRate{
		Pair:      r.Pair,
		Rate:      r.Rate,
		FetchedAt: r.FetchedAt,
	}, nil
}

func (s *SqliteAPIDDatabase) Close(ctx context.Context) error {
	_ = ctx
	return s.db.Close()
}

