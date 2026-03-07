package database

import (
	"context"
	"math/big"
	"testing"
)

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
		masterKey: []byte("0123456789abcdef0123456789abcdef"),
		salt:      []byte("abcdef0123456789"),
	}
}

func TestOpenInsertListWalletLifecycle(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()

	db, err := Open(ctx, dir, "password-1", newTestSecureKeyStore())
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()

	exists, err := db.WalletExists(ctx)
	if err != nil {
		t.Fatalf("WalletExists() error = %v", err)
	}
	if exists {
		t.Fatalf("expected no wallets at start")
	}

	err = db.InsertWallet(ctx, "ethereum", "Primary", "0x123", []byte("encrypted-key"))
	if err != nil {
		t.Fatalf("InsertWallet() error = %v", err)
	}

	exists, err = db.WalletExists(ctx)
	if err != nil {
		t.Fatalf("WalletExists() error = %v", err)
	}
	if !exists {
		t.Fatalf("expected wallet to exist")
	}

	wallets, err := db.ListWallets(ctx)
	if err != nil {
		t.Fatalf("ListWallets() error = %v", err)
	}
	if len(wallets) != 1 {
		t.Fatalf("expected 1 wallet, got %d", len(wallets))
	}
	if wallets[0].WalletType != "ethereum" {
		t.Fatalf("unexpected wallet type: %s", wallets[0].WalletType)
	}
	if wallets[0].Address != "0x123" {
		t.Fatalf("unexpected wallet address: %s", wallets[0].Address)
	}
}

func TestOpenFailsWithNilKeystore(t *testing.T) {
	_, err := Open(context.Background(), t.TempDir(), "password", nil)
	if err == nil {
		t.Fatalf("expected error for nil keystore")
	}
}

func TestOpenFailsWithWrongKeyMaterial(t *testing.T) {
	dir := t.TempDir()
	ctx := context.Background()

	first, err := Open(ctx, dir, "password", &testSecureKeyStore{
		masterKey: []byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
		salt:      []byte("1111111111111111"),
	})
	if err != nil {
		t.Fatalf("first Open() error = %v", err)
	}
	if err := first.InsertWallet(ctx, "ethereum", "Primary", "0xabc", []byte("k")); err != nil {
		t.Fatalf("InsertWallet() error = %v", err)
	}
	_ = first.Close()

	_, err = Open(ctx, dir, "password", &testSecureKeyStore{
		masterKey: []byte("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"),
		salt:      []byte("2222222222222222"),
	})
	if err == nil {
		t.Fatalf("expected Open() to fail with wrong key material")
	}
}

func TestInsertWalletValidation(t *testing.T) {
	var db DB
	ctx := context.Background()

	if err := db.InsertWallet(ctx, "", "", "", nil); err == nil {
		t.Fatalf("expected validation error for uninitialized db")
	}
}

func TestSponsoredOperationsPersistenceAndAggregation(t *testing.T) {
	db, err := Open(context.Background(), t.TempDir(), "password", newTestSecureKeyStore())
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	sender := "0x1111111111111111111111111111111111111111"

	if err := db.RecordSponsoredOperation(ctx, SponsoredOperation{
		UserOperationID: "0xaaa",
		SenderAddress:   sender,
		Network:         "ethereum-sepolia",
		TokenAddress:    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
		Recipient:       "0x2222222222222222222222222222222222222222",
		AmountUnits:     "15000000",
		Status:          "submitted",
	}); err != nil {
		t.Fatalf("RecordSponsoredOperation(first) error = %v", err)
	}

	if err := db.RecordSponsoredOperation(ctx, SponsoredOperation{
		UserOperationID: "0xbbb",
		SenderAddress:   sender,
		Network:         "ethereum-sepolia",
		TokenAddress:    "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
		Recipient:       "0x3333333333333333333333333333333333333333",
		AmountUnits:     "5000000",
		Status:          "submitted",
	}); err != nil {
		t.Fatalf("RecordSponsoredOperation(second) error = %v", err)
	}

	count, err := db.CountSponsoredOperationsToday(ctx, sender)
	if err != nil {
		t.Fatalf("CountSponsoredOperationsToday() error = %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 sponsored ops, got %d", count)
	}

	sum, err := db.SumSponsoredAmountToday(ctx, sender)
	if err != nil {
		t.Fatalf("SumSponsoredAmountToday() error = %v", err)
	}
	if sum.Cmp(big.NewInt(20_000_000)) != 0 {
		t.Fatalf("expected sponsored sum 20000000, got %s", sum.String())
	}
}

func TestRecordPaymasterValidation(t *testing.T) {
	db, err := Open(context.Background(), t.TempDir(), "password", newTestSecureKeyStore())
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()

	err = db.RecordPaymasterValidation(context.Background(), PaymasterValidation{
		SenderAddress:   "0x1111111111111111111111111111111111111111",
		Decision:        "rejected",
		RejectionReason: "token is not eligible for sponsorship",
		AmountUnits:     "1000000",
		Metadata:        "ethereum-sepolia",
	})
	if err != nil {
		t.Fatalf("RecordPaymasterValidation() error = %v", err)
	}
}

func TestUpdateUserOperationSettlement(t *testing.T) {
	db, err := Open(context.Background(), t.TempDir(), "password", newTestSecureKeyStore())
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	if err := db.InsertTransactionIfMissing(ctx, TransactionRecord{
		TxHash:          "0xuserop",
		UserOpHash:      "0xuserop",
		Nonce:           1,
		Chain:           "ethereum-sepolia",
		Token:           "USDC",
		Amount:          "1",
		TransactionType: "transfer",
		State:           "pending",
		BundlerStatus:   "submitted",
		TxMode:          "userop",
		SponsorshipMode: "sponsored",
		WalletAddress:   "0x1111111111111111111111111111111111111111",
	}); err != nil {
		t.Fatalf("InsertTransactionIfMissing() error = %v", err)
	}

	if err := db.RecordSponsoredOperation(ctx, SponsoredOperation{
		UserOperationID: "0xuserop",
		SenderAddress:   "0x1111111111111111111111111111111111111111",
		Network:         "ethereum-sepolia",
		TokenAddress:    "0x1",
		Recipient:       "0x2",
		AmountUnits:     "1",
		Status:          "submitted",
	}); err != nil {
		t.Fatalf("RecordSponsoredOperation() error = %v", err)
	}

	if err := db.UpdateUserOperationSettlement(ctx, "0xuserop", "0xfinaltx", "completed", "included"); err != nil {
		t.Fatalf("UpdateUserOperationSettlement() error = %v", err)
	}

	list, err := db.ListTransactions(ctx, "0x1111111111111111111111111111111111111111", "USDC", 10, 0)
	if err != nil {
		t.Fatalf("ListTransactions() error = %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(list))
	}
	if list[0].TxHash != "0xfinaltx" {
		t.Fatalf("expected final tx hash, got %s", list[0].TxHash)
	}
	if list[0].State != "completed" {
		t.Fatalf("expected completed state, got %s", list[0].State)
	}
	if list[0].BundlerStatus != "included" {
		t.Fatalf("expected included bundler status, got %s", list[0].BundlerStatus)
	}
}
