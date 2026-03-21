package store_test

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/store"
)

// newTestFirestoreStore skips the test if POCKET_TEST_FIREBASE_PROJECT_ID is not set.
func newTestFirestoreStore(t *testing.T) store.APIDatabase {
	t.Helper()
	projectID := strings.TrimSpace(os.Getenv("POCKET_TEST_FIREBASE_PROJECT_ID"))
	if projectID == "" {
		t.Skip("POCKET_TEST_FIREBASE_PROJECT_ID not set; skipping Firestore integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	s, err := store.NewFirebaseAPIDatabase(ctx, projectID, "")
	if err != nil {
		t.Fatalf("NewFirebaseAPIDatabase: %v", err)
	}
	t.Cleanup(func() {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		_ = s.Close(shutdownCtx)
	})
	return s
}

func TestFirestoreSaveWalletAndBalances(t *testing.T) {
	s := newTestFirestoreStore(t)

	wallet := store.WalletRecord{
		Address:   "0x000000000000000000000000000000000000BEEF",
		Network:   "ethereum-sepolia",
		CreatedAt: time.Now().Unix(),
	}
	if err := s.SaveWallet(context.Background(), wallet); err != nil {
		t.Fatalf("SaveWallet: %v", err)
	}

	bal := store.BalanceSnapshot{
		WalletAddress: wallet.Address,
		Network:       wallet.Network,
		TokenAddress:  "0x0000000000000000000000000000000000000000",
		TokenSymbol:   "ETH",
		Balance:       "1000",
		USDValue:      "1500",
		FetchedAt:     time.Now().Unix(),
	}
	if err := s.UpsertBalance(context.Background(), bal); err != nil {
		t.Fatalf("UpsertBalance: %v", err)
	}

	snaps, err := s.GetLatestBalances(context.Background(), wallet.Address, wallet.Network)
	if err != nil {
		t.Fatalf("GetLatestBalances: %v", err)
	}
	if len(snaps) == 0 {
		t.Fatalf("expected balances, got 0")
	}
}

func TestFirestoreTransactionsAndFX(t *testing.T) {
	s := newTestFirestoreStore(t)

	addr := "0x000000000000000000000000000000000000CAFE"
	tx := store.TransactionItem{
		WalletAddress: addr,
		TxHash:        "0xhash-firestore-1",
		FromAddress:   addr,
		ToAddress:     "0xrecipient",
		Description:   "Sent USDC to 0xrecipient",
		TokenSymbol:   "USDC",
		Amount:        "1.25",
		Network:       "ethereum-sepolia",
		Direction:     "debit",
		State:         "pending",
		Timestamp:     time.Now().Unix(),
	}
	if err := s.UpsertTransaction(context.Background(), tx); err != nil {
		t.Fatalf("UpsertTransaction: %v", err)
	}

	items, total, err := s.ListTransactions(context.Background(), addr, "", 10, 0)
	if err != nil {
		t.Fatalf("ListTransactions: %v", err)
	}
	if total == 0 || len(items) == 0 {
		t.Fatalf("expected transactions, got 0")
	}

	if err := s.UpsertFXRate(context.Background(), "USD/ZAR", "18.5", time.Now().Unix()); err != nil {
		t.Fatalf("UpsertFXRate: %v", err)
	}
	rate, err := s.LatestFXRate(context.Background(), "USD/ZAR")
	if err != nil {
		t.Fatalf("LatestFXRate: %v", err)
	}
	if rate == nil || rate.Rate == "" {
		t.Fatalf("expected FX rate")
	}
}
