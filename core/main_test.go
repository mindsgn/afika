package core

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"testing"
)

func testKeyMaterial() (string, string) {
	masterKey := base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef"))
	salt := base64.StdEncoding.EncodeToString([]byte("abcdef0123456789"))
	return masterKey, salt
}

func TestWalletCoreRequiresInit(t *testing.T) {
	wallet := NewWalletCore()

	if _, err := wallet.ListAccounts(); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("expected ErrNotInitialized from ListAccounts, got %v", err)
	}
	if _, err := wallet.CreateEthereumWallet("Primary"); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("expected ErrNotInitialized from CreateEthereumWallet, got %v", err)
	}
	if _, err := wallet.GetBalance("testnet"); !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("expected ErrNotInitialized from GetBalance, got %v", err)
	}
}

func TestWalletCoreInitCreateAndList(t *testing.T) {
	wallet := NewWalletCore()
	masterKey, salt := testKeyMaterial()

	if err := wallet.Init(t.TempDir(), "password", masterKey, salt); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	defer wallet.Close()

	address, err := wallet.CreateEthereumWallet("Primary")
	if err != nil {
		t.Fatalf("CreateEthereumWallet() error = %v", err)
	}
	if address == "" {
		t.Fatalf("expected non-empty address")
	}

	accountsJSON, err := wallet.ListAccounts()
	if err != nil {
		t.Fatalf("ListAccounts() error = %v", err)
	}

	var accounts []map[string]any
	if err := json.Unmarshal([]byte(accountsJSON), &accounts); err != nil {
		t.Fatalf("accounts JSON unmarshal error = %v", err)
	}
	if len(accounts) != 1 {
		t.Fatalf("expected 1 account, got %d", len(accounts))
	}
}

func TestWalletCoreSendMoneyStub(t *testing.T) {
	wallet := NewWalletCore()
	masterKey, salt := testKeyMaterial()
	if err := wallet.Init(t.TempDir(), "password", masterKey, salt); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	defer wallet.Close()

	_, err := wallet.SendMoneyTo("ethereum", "0x1", "1")
	if err == nil {
		t.Fatalf("expected not implemented error")
	}
}

func TestWalletCoreGetAAReadinessDisabledInMVP(t *testing.T) {
	wallet := NewWalletCore()
	masterKey, salt := testKeyMaterial()
	if err := wallet.Init(t.TempDir(), "password", masterKey, salt); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	defer wallet.Close()

	_, err := wallet.GetAAReadiness("sepolia")
	if !errors.Is(err, ErrSmartAccountsDisabled) {
		t.Fatalf("expected ErrSmartAccountsDisabled, got %v", err)
	}
}

func TestSyncInboundTransactionsRequiresInit(t *testing.T) {
	wallet := NewWalletCore()
	_, err := wallet.SyncInboundTransactions("ethereum-sepolia")
	if !errors.Is(err, ErrNotInitialized) {
		t.Fatalf("expected ErrNotInitialized, got %v", err)
	}
}

func TestSyncInboundTransactionsNoWalletReturnsZero(t *testing.T) {
	wallet := NewWalletCore()
	masterKey, salt := testKeyMaterial()
	if err := wallet.Init(t.TempDir(), "password", masterKey, salt); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	defer wallet.Close()

	// No wallet created, so the function should return {"synced":0} without error.
	result, err := wallet.SyncInboundTransactions("ethereum-sepolia")
	if err != nil {
		t.Fatalf("SyncInboundTransactions() unexpected error = %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(result), &out); err != nil {
		t.Fatalf("JSON unmarshal error = %v", err)
	}
	synced, ok := out["synced"]
	if !ok {
		t.Fatal("expected 'synced' key in result")
	}
	// JSON numbers decode to float64.
	if synced.(float64) != 0 {
		t.Fatalf("expected synced=0, got %v", synced)
	}
}

func TestSyncInboundTransactionsSendMoneyToStillReturnsError(t *testing.T) {
	wallet := NewWalletCore()
	masterKey, salt := testKeyMaterial()
	if err := wallet.Init(t.TempDir(), "password", masterKey, salt); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	defer wallet.Close()

	_, err := wallet.SendMoneyTo("ethereum-sepolia", "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "1")
	if err == nil {
		t.Fatal("expected SendMoneyTo to return an error (stub not implemented)")
	}
}
