package store_test

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/store"
)

// newTestMongoStore skips the test if POCKET_TEST_MONGO_URI is not set.
// It creates a unique database for each test and drops it on cleanup.
func newTestMongoStore(t *testing.T) store.APIDatabase {
	t.Helper()
	mongoURI := strings.TrimSpace(os.Getenv("POCKET_TEST_MONGO_URI"))
	if mongoURI == "" {
		t.Skip("POCKET_TEST_MONGO_URI not set; skipping MongoDB integration test")
	}
	dbName := "pocket_store_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	s, err := store.NewMongoAPIDatabase(ctx, mongoURI, dbName)
	if err != nil {
		t.Fatalf("NewMongoAPIDatabase: %v", err)
	}
	t.Cleanup(func() {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = s.Close(shutdownCtx)
	})
	return s
}

func bg() context.Context { return context.Background() }

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

func TestSaveAndListWalletsIntegration(t *testing.T) {
	s := newTestMongoStore(t)

	w := store.WalletRecord{
		Address:   "0x000000000000000000000000000000000000dEaD",
		Network:   "ethereum-sepolia",
		CreatedAt: time.Now().Unix(),
	}
	if err := s.SaveWallet(bg(), w); err != nil {
		t.Fatalf("SaveWallet: %v", err)
	}

	// Idempotent — second save should not produce a duplicate
	if err := s.SaveWallet(bg(), w); err != nil {
		t.Fatalf("SaveWallet (idempotent): %v", err)
	}

	wallets, err := s.ListWallets(bg())
	if err != nil {
		t.Fatalf("ListWallets: %v", err)
	}
	if len(wallets) != 1 {
		t.Fatalf("expected 1 wallet, got %d", len(wallets))
	}
	if wallets[0].Address != w.Address {
		t.Fatalf("unexpected address: %s", wallets[0].Address)
	}
}

func TestListWalletAddressesIntegration(t *testing.T) {
	s := newTestMongoStore(t)

	addrs := []string{
		"0x0000000000000000000000000000000000000001",
		"0x0000000000000000000000000000000000000002",
	}
	for _, addr := range addrs {
		if err := s.SaveWallet(bg(), store.WalletRecord{Address: addr, Network: "ethereum-sepolia"}); err != nil {
			t.Fatalf("SaveWallet %s: %v", addr, err)
		}
	}

	listed, err := s.ListWalletAddresses(bg())
	if err != nil {
		t.Fatalf("ListWalletAddresses: %v", err)
	}
	if len(listed) != len(addrs) {
		t.Fatalf("expected %d addresses, got %d", len(addrs), len(listed))
	}
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

func TestUpsertAndGetBalancesIntegration(t *testing.T) {
	s := newTestMongoStore(t)

	snap := store.BalanceSnapshot{
		WalletAddress: "0xabc",
		Network:       "ethereum-sepolia",
		TokenAddress:  "0x0000000000000000000000000000000000000000",
		TokenSymbol:   "ETH",
		Balance:       "1000000000000000000",
		USDValue:      "3200.00",
		FetchedAt:     time.Now().Unix(),
	}
	if err := s.UpsertBalance(bg(), snap); err != nil {
		t.Fatalf("UpsertBalance: %v", err)
	}

	// Update with a new balance
	snap.Balance = "2000000000000000000"
	snap.USDValue = "6400.00"
	if err := s.UpsertBalance(bg(), snap); err != nil {
		t.Fatalf("UpsertBalance (update): %v", err)
	}

	snaps, err := s.GetLatestBalances(bg(), "0xabc", "ethereum-sepolia")
	if err != nil {
		t.Fatalf("GetLatestBalances: %v", err)
	}
	if len(snaps) != 1 {
		t.Fatalf("expected 1 snapshot, got %d", len(snaps))
	}
	if snaps[0].Balance != "2000000000000000000" {
		t.Fatalf("expected updated balance, got %s", snaps[0].Balance)
	}
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

func TestUpsertAndListTransactionsIntegration(t *testing.T) {
	s := newTestMongoStore(t)

	addr := "0x000000000000000000000000000000000000CAFE"
	txs := []store.TransactionItem{
		{
			WalletAddress: addr,
			TxHash:        "0xhash1",
			FromAddress:   addr,
			ToAddress:     "0xrecipient1",
			TokenSymbol:   "ETH",
			Amount:        "100000000000000000",
			Network:       "ethereum-sepolia",
			Direction:     "debit",
			State:         "confirmed",
			Timestamp:     time.Now().Unix(),
		},
		{
			WalletAddress: addr,
			TxHash:        "0xhash2",
			FromAddress:   "0xsender2",
			ToAddress:     addr,
			TokenSymbol:   "USDC",
			Amount:        "5000000",
			FeeUSD:        "0.120000",
			USDAmount:     "5",
			Network:       "ethereum-sepolia",
			Direction:     "credit",
			State:         "confirmed",
			Timestamp:     time.Now().Unix(),
		},
	}

	for _, tx := range txs {
		if err := s.UpsertTransaction(bg(), tx); err != nil {
			t.Fatalf("UpsertTransaction: %v", err)
		}
	}

	items, total, err := s.ListTransactions(bg(), addr, "", 10, 0)
	if err != nil {
		t.Fatalf("ListTransactions: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected total 2, got %d", total)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
	var found bool
	for _, item := range items {
		if item.TxHash == "0xhash2" {
			found = true
			if item.USDAmount != "5" {
				t.Fatalf("expected usdAmount 5, got %s", item.USDAmount)
			}
		}
	}
	if !found {
		t.Fatalf("expected tx 0xhash2 in results")
	}
}

func TestTransactionDirectionFilterIntegration(t *testing.T) {
	s := newTestMongoStore(t)

	addr := "0x000000000000000000000000000000000000BEEF"
	txs := []store.TransactionItem{
		{WalletAddress: addr, TxHash: "0xd1", Direction: "debit", State: "confirmed", Network: "sepolia"},
		{WalletAddress: addr, TxHash: "0xd2", Direction: "debit", State: "confirmed", Network: "sepolia"},
		{WalletAddress: addr, TxHash: "0xc1", Direction: "credit", State: "confirmed", Network: "sepolia"},
	}
	for _, tx := range txs {
		if err := s.UpsertTransaction(bg(), tx); err != nil {
			t.Fatalf("UpsertTransaction: %v", err)
		}
	}

	debits, total, err := s.ListTransactions(bg(), addr, "debit", 10, 0)
	if err != nil {
		t.Fatalf("ListTransactions(debit): %v", err)
	}
	if total != 2 {
		t.Fatalf("expected 2 debits, got %d", total)
	}
	for _, d := range debits {
		if d.Direction != "debit" {
			t.Fatalf("expected debit, got %s", d.Direction)
		}
	}

	credits, creditTotal, err := s.ListTransactions(bg(), addr, "credit", 10, 0)
	if err != nil {
		t.Fatalf("ListTransactions(credit): %v", err)
	}
	if creditTotal != 1 {
		t.Fatalf("expected 1 credit, got %d", creditTotal)
	}
	_ = credits
}

func TestListTransactionsPaginationIntegration(t *testing.T) {
	s := newTestMongoStore(t)

	addr := "0x000000000000000000000000000000000000FEED"
	for i := 0; i < 5; i++ {
		tx := store.TransactionItem{
			WalletAddress: addr,
			TxHash:        "0xpag" + strings.Repeat("0", 4) + string(rune('a'+i)),
			Direction:     "debit",
			State:         "confirmed",
			Network:       "sepolia",
		}
		if err := s.UpsertTransaction(bg(), tx); err != nil {
			t.Fatalf("UpsertTransaction: %v", err)
		}
	}

	page, total, err := s.ListTransactions(bg(), addr, "", 2, 0)
	if err != nil {
		t.Fatalf("ListTransactions page 1: %v", err)
	}
	if total != 5 {
		t.Fatalf("expected total 5, got %d", total)
	}
	if len(page) != 2 {
		t.Fatalf("expected 2 items on page 1, got %d", len(page))
	}

	page2, _, err := s.ListTransactions(bg(), addr, "", 2, 2)
	if err != nil {
		t.Fatalf("ListTransactions page 2: %v", err)
	}
	if len(page2) != 2 {
		t.Fatalf("expected 2 items on page 2, got %d", len(page2))
	}
}

// ---------------------------------------------------------------------------
// FX Rates
// ---------------------------------------------------------------------------

func TestUpsertAndLatestFXRateIntegration(t *testing.T) {
	s := newTestMongoStore(t)

	if err := s.UpsertFXRate(bg(), "USD/ZAR", "18.50", time.Now().Unix()); err != nil {
		t.Fatalf("UpsertFXRate: %v", err)
	}

	// Upsert again with a new rate — should replace
	if err := s.UpsertFXRate(bg(), "USD/ZAR", "18.75", time.Now().Unix()); err != nil {
		t.Fatalf("UpsertFXRate update: %v", err)
	}

	rate, err := s.LatestFXRate(bg(), "USD/ZAR")
	if err != nil {
		t.Fatalf("LatestFXRate: %v", err)
	}
	if rate.Rate != "18.75" {
		t.Fatalf("expected rate 18.75, got %s", rate.Rate)
	}
	if rate.Pair != "USD/ZAR" {
		t.Fatalf("expected pair USD/ZAR, got %s", rate.Pair)
	}
}

func TestLatestFXRateNotFoundIntegration(t *testing.T) {
	s := newTestMongoStore(t)

	_, err := s.LatestFXRate(bg(), "UNKNOWN/PAIR")
	if err == nil {
		t.Fatal("expected error for unknown pair")
	}
	if err != store.ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}
