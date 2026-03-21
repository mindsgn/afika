package database

import (
	"context"
	"testing"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type testSecureKeyStore struct {
	masterKey []byte
	salt      []byte
}

func (t *testSecureKeyStore) GetOrCreateMasterKey(_ context.Context) ([]byte, error) {
	return append([]byte(nil), t.masterKey...), nil
}

func (t *testSecureKeyStore) GetOrCreateKDFSalt(_ context.Context) ([]byte, error) {
	return append([]byte(nil), t.salt...), nil
}

func newTestSecureKeyStore() *testSecureKeyStore {
	return &testSecureKeyStore{
		masterKey: []byte("0123456789abcdef0123456789abcdef"), // 32 bytes
		salt:      []byte("abcdef0123456789abcdef0123456789"), // 32 bytes
	}
}

func openTestDB(t *testing.T) *DB {
	t.Helper()
	db, err := Open(context.Background(), t.TempDir(), newTestSecureKeyStore())
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// ---------------------------------------------------------------------------
// Open / lifecycle
// ---------------------------------------------------------------------------

func TestOpenAndClose(t *testing.T) {
	db := openTestDB(t)
	if db == nil {
		t.Fatal("expected non-nil DB")
	}
}

func TestOpenFailsWithNilKeystore(t *testing.T) {
	_, err := Open(context.Background(), t.TempDir(), nil)
	if err == nil {
		t.Fatal("expected error for nil keystore")
	}
}

func TestOpenFailsWithWrongKeyMaterial(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()

	first, err := Open(ctx, dir, &testSecureKeyStore{
		masterKey: []byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
		salt:      []byte("11111111111111111111111111111111"),
	})
	if err != nil {
		t.Fatalf("first Open() error = %v", err)
	}
	if err := first.InsertWallet(ctx, "ethereum", "Primary", "0xabc", []byte("k")); err != nil {
		t.Fatalf("InsertWallet() error = %v", err)
	}
	_ = first.Close()

	_, err = Open(ctx, dir, &testSecureKeyStore{
		masterKey: []byte("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
		salt:      []byte("22222222222222222222222222222222"),
	})
	if err == nil {
		t.Fatal("expected Open() to fail with wrong key material")
	}
}

// ---------------------------------------------------------------------------
// Wallet lifecycle
// ---------------------------------------------------------------------------

func TestInsertAndListWallets(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	exists, err := db.WalletExists(ctx)
	if err != nil {
		t.Fatalf("WalletExists() error = %v", err)
	}
	if exists {
		t.Fatal("expected no wallets at start")
	}

	if err := db.InsertWallet(ctx, "ethereum", "Primary", "0xabcdef", []byte("encrypted-key")); err != nil {
		t.Fatalf("InsertWallet() error = %v", err)
	}

	exists, err = db.WalletExists(ctx)
	if err != nil {
		t.Fatalf("WalletExists() after insert error = %v", err)
	}
	if !exists {
		t.Fatal("expected wallet to exist after insert")
	}

	wallets, err := db.ListWallets(ctx)
	if err != nil {
		t.Fatalf("ListWallets() error = %v", err)
	}
	if len(wallets) != 1 {
		t.Fatalf("expected 1 wallet, got %d", len(wallets))
	}
	if wallets[0].Address != "0xabcdef" {
		t.Fatalf("unexpected address: %s", wallets[0].Address)
	}
}

func TestInsertWalletIfMissingIdempotent(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	for i := 0; i < 3; i++ {
		if err := db.InsertWalletIfMissing(ctx, "ethereum", "Primary", "0x1234", []byte("key")); err != nil {
			t.Fatalf("InsertWalletIfMissing() iteration %d error = %v", i, err)
		}
	}

	wallets, err := db.ListWallets(ctx)
	if err != nil {
		t.Fatalf("ListWallets() error = %v", err)
	}
	if len(wallets) != 1 {
		t.Fatalf("expected 1 wallet after idempotent inserts, got %d", len(wallets))
	}
}

func TestInsertWalletValidation(t *testing.T) {
	var db DB
	if err := db.InsertWallet(context.Background(), "", "", "", nil); err == nil {
		t.Fatal("expected validation error for uninitialized db")
	}
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

func TestInsertAndListTransactions(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	wallet := "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

	tx := TransactionRecord{
		WalletAddress: wallet,
		TxHash:        "0xdeadbeef01",
		FromAddress:   wallet,
		ToAddress:     "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		TokenAddress:  "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
		TokenSymbol:   "USDC",
		Amount:        "5.00",
		FeeETH:        "0.001",
		FeeUSD:        "2.500000",
		USDAmount:     "5",
		Network:       "ethereum-sepolia",
		TxMode:        "direct",
		State:         "completed",
		BlockNumber:   12345,
		Timestamp:     1700000000,
	}

	if err := db.InsertTransaction(ctx, tx); err != nil {
		t.Fatalf("InsertTransaction() error = %v", err)
	}

	rows, err := db.ListTransactions(ctx, wallet, "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238", 10, 0)
	if err != nil {
		t.Fatalf("ListTransactions() error = %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(rows))
	}
	if rows[0].TxHash != tx.TxHash {
		t.Fatalf("unexpected tx hash: %s", rows[0].TxHash)
	}
	if rows[0].TokenSymbol != "USDC" {
		t.Fatalf("unexpected token symbol: %s", rows[0].TokenSymbol)
	}
	if rows[0].FeeUSD != tx.FeeUSD {
		t.Fatalf("unexpected feeUSD: %s", rows[0].FeeUSD)
	}
	if rows[0].USDAmount != tx.USDAmount {
		t.Fatalf("unexpected usdAmount: %s", rows[0].USDAmount)
	}
}

func TestInsertTransactionIfMissingIdempotent(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	wallet := "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

	tx := TransactionRecord{
		WalletAddress: wallet,
		TxHash:        "0xabcdef01",
		FromAddress:   wallet,
		TokenSymbol:   "ETH",
		Amount:        "1.0",
		Network:       "ethereum-mainnet",
		State:         "pending",
	}

	if err := db.InsertTransactionIfMissing(ctx, tx); err != nil {
		t.Fatalf("InsertTransactionIfMissing() error = %v", err)
	}
	if err := db.InsertTransactionIfMissing(ctx, tx); err != nil {
		t.Fatalf("InsertTransactionIfMissing() duplicate error = %v", err)
	}

	all, err := db.ListAllTransactions(ctx, wallet, 10, 0)
	if err != nil {
		t.Fatalf("ListAllTransactions() error = %v", err)
	}
	if len(all) != 1 {
		t.Fatalf("expected 1 transaction after duplicate inserts, got %d", len(all))
	}
}

func TestUpdateTransactionState(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	wallet := "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

	tx := TransactionRecord{
		WalletAddress: wallet,
		TxHash:        "0xstatehash",
		FromAddress:   wallet,
		TokenSymbol:   "ETH",
		Amount:        "0.5",
		Network:       "ethereum-sepolia",
		State:         "pending",
	}
	if err := db.InsertTransaction(ctx, tx); err != nil {
		t.Fatalf("InsertTransaction() error = %v", err)
	}

	if err := db.UpdateTransactionState(ctx, "0xstatehash", "completed"); err != nil {
		t.Fatalf("UpdateTransactionState() error = %v", err)
	}

	rows, err := db.ListAllTransactions(ctx, wallet, 10, 0)
	if err != nil {
		t.Fatalf("ListAllTransactions() error = %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows))
	}
	if rows[0].State != "completed" {
		t.Fatalf("expected state 'completed', got %q", rows[0].State)
	}
}

// ---------------------------------------------------------------------------
// Balance history
// ---------------------------------------------------------------------------

func TestInsertAndListBalanceHistory(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	wallet := "0xcccccccccccccccccccccccccccccccccccccccc"

	snap := BalanceHistory{
		WalletAddress: wallet,
		Network:       "ethereum-sepolia",
		TokenAddress:  "native",
		TokenSymbol:   "ETH",
		Balance:       "1.5",
		USDValue:      "3000.00",
		FetchedAt:     1700000000,
	}

	if err := db.InsertBalanceHistory(ctx, snap); err != nil {
		t.Fatalf("InsertBalanceHistory() error = %v", err)
	}

	history, err := db.ListBalanceHistory(ctx, wallet, "ethereum-sepolia", 10)
	if err != nil {
		t.Fatalf("ListBalanceHistory() error = %v", err)
	}
	if len(history) != 1 {
		t.Fatalf("expected 1 snapshot, got %d", len(history))
	}
	if history[0].TokenSymbol != "ETH" {
		t.Fatalf("unexpected token symbol: %s", history[0].TokenSymbol)
	}
	if history[0].Balance != "1.5" {
		t.Fatalf("unexpected balance: %s", history[0].Balance)
	}
}

func TestInsertBalanceHistoryIfChanged(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	wallet := "0xdddddddddddddddddddddddddddddddddddddddd"

	snap := BalanceHistory{
		WalletAddress: wallet,
		Network:       "ethereum-sepolia",
		TokenAddress:  "native",
		TokenSymbol:   "ETH",
		Balance:       "1.0",
		USDValue:      "2000",
		FetchedAt:     1700000000,
	}

	inserted, err := db.InsertBalanceHistoryIfChanged(ctx, snap)
	if err != nil {
		t.Fatalf("InsertBalanceHistoryIfChanged() error = %v", err)
	}
	if !inserted {
		t.Fatalf("expected insert on first call")
	}

	inserted, err = db.InsertBalanceHistoryIfChanged(ctx, snap)
	if err != nil {
		t.Fatalf("InsertBalanceHistoryIfChanged() duplicate error = %v", err)
	}
	if inserted {
		t.Fatalf("expected duplicate snapshot to be skipped")
	}

	snap.Balance = "1.5"
	inserted, err = db.InsertBalanceHistoryIfChanged(ctx, snap)
	if err != nil {
		t.Fatalf("InsertBalanceHistoryIfChanged() updated error = %v", err)
	}
	if !inserted {
		t.Fatalf("expected insert when balance changes")
	}

	history, err := db.ListBalanceHistory(ctx, wallet, "ethereum-sepolia", 10)
	if err != nil {
		t.Fatalf("ListBalanceHistory() error = %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("expected 2 snapshots, got %d", len(history))
	}
}

func TestListLatestBalances(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()
	wallet := "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

	_ = db.InsertBalanceHistory(ctx, BalanceHistory{
		WalletAddress: wallet,
		Network:       "ethereum-sepolia",
		TokenAddress:  "native",
		TokenSymbol:   "ETH",
		Balance:       "1.0",
		USDValue:      "2000",
		FetchedAt:     1000,
	})
	_ = db.InsertBalanceHistory(ctx, BalanceHistory{
		WalletAddress: wallet,
		Network:       "ethereum-sepolia",
		TokenAddress:  "native",
		TokenSymbol:   "ETH",
		Balance:       "1.2",
		USDValue:      "2400",
		FetchedAt:     2000,
	})
	_ = db.InsertBalanceHistory(ctx, BalanceHistory{
		WalletAddress: wallet,
		Network:       "ethereum-sepolia",
		TokenAddress:  "usdc",
		TokenSymbol:   "USDC",
		Balance:       "5",
		USDValue:      "5",
		FetchedAt:     1500,
	})

	latest, err := db.ListLatestBalances(ctx, wallet, "ethereum-sepolia")
	if err != nil {
		t.Fatalf("ListLatestBalances() error = %v", err)
	}
	if len(latest) != 2 {
		t.Fatalf("expected 2 latest balances, got %d", len(latest))
	}
	for _, b := range latest {
		if b.TokenSymbol == "ETH" && b.Balance != "1.2" {
			t.Fatalf("expected latest ETH balance 1.2, got %s", b.Balance)
		}
	}
}

// ---------------------------------------------------------------------------
// Watched addresses
// ---------------------------------------------------------------------------

func TestInsertAndListWatchedAddresses(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	if err := db.InsertWatchedAddress(ctx, "0xdeadbeefdeadbeefdeadbeefdeadbeef00000001", "Alice"); err != nil {
		t.Fatalf("InsertWatchedAddress() error = %v", err)
	}
	if err := db.InsertWatchedAddress(ctx, "0xdeadbeefdeadbeefdeadbeefdeadbeef00000002", ""); err != nil {
		t.Fatalf("InsertWatchedAddress() (no label) error = %v", err)
	}

	watched, err := db.ListWatchedAddresses(ctx)
	if err != nil {
		t.Fatalf("ListWatchedAddresses() error = %v", err)
	}
	if len(watched) != 2 {
		t.Fatalf("expected 2 watched addresses, got %d", len(watched))
	}
}

// ---------------------------------------------------------------------------
// FX rates
// ---------------------------------------------------------------------------

func TestUpsertAndLatestFXRate(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	if err := db.UpsertFXRate(ctx, "USD/ZAR", "18.50", 1000); err != nil {
		t.Fatalf("UpsertFXRate() error = %v", err)
	}
	if err := db.UpsertFXRate(ctx, "USD/ZAR", "18.75", 2000); err != nil {
		t.Fatalf("UpsertFXRate() update error = %v", err)
	}

	rate, err := db.LatestFXRate(ctx, "USD/ZAR")
	if err != nil {
		t.Fatalf("LatestFXRate() error = %v", err)
	}
	if rate.Rate != "18.75" {
		t.Fatalf("expected rate 18.75, got %s", rate.Rate)
	}
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

func TestRecipientInsertGetSearchUpdate(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	created, err := db.InsertRecipient(ctx, Recipient{
		Name:  "Alice Example",
		Phone: "+27 82-000-0000",
	})
	if err != nil {
		t.Fatalf("InsertRecipient() error = %v", err)
	}
	if created.UUID == "" {
		t.Fatal("expected recipient uuid")
	}

	fetched, err := db.GetRecipientByID(ctx, created.UUID)
	if err != nil {
		t.Fatalf("GetRecipientByID() error = %v", err)
	}
	if fetched == nil || fetched.Name != "Alice Example" {
		t.Fatalf("expected fetched recipient name, got %#v", fetched)
	}

	byName, err := db.SearchRecipientsByName(ctx, "alice")
	if err != nil {
		t.Fatalf("SearchRecipientsByName() error = %v", err)
	}
	if len(byName) == 0 {
		t.Fatal("expected name search results")
	}

	byPhone, err := db.SearchRecipientsByPhone(ctx, "2782000")
	if err != nil {
		t.Fatalf("SearchRecipientsByPhone() error = %v", err)
	}
	if len(byPhone) == 0 {
		t.Fatal("expected phone search results")
	}

	updated, err := db.UpdateRecipient(ctx, Recipient{
		UUID: created.UUID,
		Name: "Alice Updated",
	})
	if err != nil {
		t.Fatalf("UpdateRecipient() error = %v", err)
	}
	if updated.UpdatedAt == 0 {
		t.Fatal("expected updatedAt to be set")
	}

	refetched, err := db.GetRecipientByID(ctx, created.UUID)
	if err != nil {
		t.Fatalf("GetRecipientByID() (after update) error = %v", err)
	}
	if refetched == nil || refetched.Name != "Alice Updated" {
		t.Fatalf("expected updated recipient name, got %#v", refetched)
	}
}
