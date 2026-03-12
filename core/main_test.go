package core

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

func testKeyMaterial() (string, string) {
	masterKey := base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")) // 32 bytes
	salt := base64.StdEncoding.EncodeToString([]byte("abcdef0123456789abcdef0123456789"))      // 32 bytes
	return masterKey, salt
}

func newInitedWallet(t *testing.T) *WalletCore {
	t.Helper()
	wallet := NewWalletCore()
	masterKey, salt := testKeyMaterial()
	if err := wallet.Init(t.TempDir(), masterKey, salt); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	t.Cleanup(func() { _ = wallet.Close() })
	return wallet
}

// ---------------------------------------------------------------------------
// Init guard tests
// ---------------------------------------------------------------------------

func TestWalletCoreRequiresInit(t *testing.T) {
	wallet := NewWalletCore()
	tests := []struct {
		name string
		fn   func() error
	}{
		{"ListAccounts", func() error { _, err := wallet.ListAccounts(); return err }},
		{"CreateEthereumWallet", func() error { _, err := wallet.CreateEthereumWallet("p"); return err }},
		{"GetAddress", func() error { _, err := wallet.GetAddress(); return err }},
		{"GetAllBalances", func() error { _, err := wallet.GetAllBalances("testnet"); return err }},
		{"SyncInboundTransactions", func() error { _, err := wallet.SyncInboundTransactions("testnet"); return err }},
		{"SendToken", func() error { _, err := wallet.SendToken("testnet", "ETH", "0x0", "1"); return err }},
		{"SendUSDC", func() error { _, err := wallet.SendUSDC("testnet", "0x0", "1"); return err }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if err := tc.fn(); !errors.Is(err, ErrNotInitialized) {
				t.Fatalf("%s: expected ErrNotInitialized, got %v", tc.name, err)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

func TestWalletCoreInit(t *testing.T) {
	wallet := NewWalletCore()
	masterKey, salt := testKeyMaterial()
	if err := wallet.Init(t.TempDir(), masterKey, salt); err != nil {
		t.Fatalf("Init() error = %v", err)
	}
	defer wallet.Close() //nolint:errcheck
}

func TestWalletCoreDoubleInitOK(t *testing.T) {
	wallet := NewWalletCore()
	masterKey, salt := testKeyMaterial()
	dir := t.TempDir()
	if err := wallet.Init(dir, masterKey, salt); err != nil {
		t.Fatalf("first Init() error = %v", err)
	}
	// Re-init on same dir (re-open) should succeed
	if err := wallet.Init(dir, masterKey, salt); err != nil {
		t.Fatalf("second Init() error = %v", err)
	}
	defer wallet.Close() //nolint:errcheck
}

// ---------------------------------------------------------------------------
// Wallet creation / listing
// ---------------------------------------------------------------------------

func TestCreateEthereumWalletAndList(t *testing.T) {
	wallet := newInitedWallet(t)

	address, err := wallet.CreateEthereumWallet("Primary")
	if err != nil {
		t.Fatalf("CreateEthereumWallet() error = %v", err)
	}
	if address == "" {
		t.Fatal("expected non-empty address")
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

func TestGetAddressAfterCreate(t *testing.T) {
	wallet := newInitedWallet(t)

	created, err := wallet.CreateEthereumWallet("Primary")
	if err != nil {
		t.Fatalf("CreateEthereumWallet() error = %v", err)
	}

	got, err := wallet.GetAddress()
	if err != nil {
		t.Fatalf("GetAddress() error = %v", err)
	}
	if !strings.EqualFold(got, created) {
		t.Fatalf("GetAddress()=%q want %q", got, created)
	}
}

// ---------------------------------------------------------------------------
// ValidateAddress
// ---------------------------------------------------------------------------

func TestValidateAddress(t *testing.T) {
	wallet := newInitedWallet(t)

	if got := wallet.ValidateAddress("0x0000000000000000000000000000000000000001"); got != "true" {
		t.Fatalf("expected 'true' for valid EOA, got %q", got)
	}
	if got := wallet.ValidateAddress("not-valid"); got != "false" {
		t.Fatalf("expected 'false' for invalid address, got %q", got)
	}
}

// ---------------------------------------------------------------------------
// RegisterNetwork / RegisterToken
// ---------------------------------------------------------------------------

func TestRegisterNetworkAndToken(t *testing.T) {
	wallet := newInitedWallet(t)

	// RegisterNetwork should not panic
	wallet.RegisterNetwork("my-chain", "https://rpc.example.com", 1337)

	// RegisterToken on a registered network
	wallet.RegisterToken("my-chain", "mytoken", "MYT", "0x1234567890123456789012345678901234567890", 18)
}

func TestSendUSDCNormalizationSmoke(t *testing.T) {
	wallet := newInitedWallet(t)

	_, err := wallet.OpenOrCreateWallet("default")
	if err != nil {
		t.Fatalf("OpenOrCreateWallet() error = %v", err)
	}

	wallet.RegisterNetwork("ethereum-sepolia", "", 11155111)

	_, err = wallet.SendUSDC("ethereum-sepolia", "0x000000000000000000000000000000000000dEaD", "1.5")
	if err == nil {
		t.Fatal("expected error for empty rpcURL")
	}
	if !strings.Contains(err.Error(), "rpcURL") {
		t.Fatalf("expected rpcURL error, got %v", err)
	}
}

// ---------------------------------------------------------------------------
// OpenOrCreateWallet
// ---------------------------------------------------------------------------

func TestOpenOrCreateWalletCreatesNew(t *testing.T) {
	wallet := newInitedWallet(t)

	addr, err := wallet.OpenOrCreateWallet("default")
	if err != nil {
		t.Fatalf("OpenOrCreateWallet() error = %v", err)
	}
	if addr == "" {
		t.Fatal("expected non-empty address")
	}
}

func TestOpenOrCreateWalletIdempotent(t *testing.T) {
	wallet := newInitedWallet(t)

	addr1, _ := wallet.OpenOrCreateWallet("default")
	addr2, _ := wallet.OpenOrCreateWallet("default")
	if !strings.EqualFold(addr1, addr2) {
		t.Fatalf("OpenOrCreateWallet idempotency: got different addresses %s vs %s", addr1, addr2)
	}
}

// ---------------------------------------------------------------------------
// Watched addresses
// ---------------------------------------------------------------------------

func TestAddAndListWatchedAddresses(t *testing.T) {
	wallet := newInitedWallet(t)

	if err := wallet.AddWatchedAddress("0xdeadbeefdeadbeefdeadbeefdeadbeef00000001", "Alice"); err != nil {
		t.Fatalf("AddWatchedAddress() error = %v", err)
	}

	listJSON, err := wallet.ListWatchedAddresses()
	if err != nil {
		t.Fatalf("ListWatchedAddresses() error = %v", err)
	}
	var items []map[string]any
	if err := json.Unmarshal([]byte(listJSON), &items); err != nil {
		t.Fatalf("JSON unmarshal error = %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 watched address, got %d", len(items))
	}
}

// ---------------------------------------------------------------------------
// SyncInboundTransactions (no wallet created → returns {"synced":0})
// ---------------------------------------------------------------------------

func TestSyncInboundTransactionsNoWalletReturnsZero(t *testing.T) {
	wallet := newInitedWallet(t)
	wallet.RegisterNetwork("ethereum-sepolia", "https://eth-sepolia.g.alchemy.com/v2/demo", 11155111)

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
	if synced.(float64) != 0 {
		t.Fatalf("expected synced=0, got %v", synced)
	}
}

// ---------------------------------------------------------------------------
// Backup / restore round-trip
// ---------------------------------------------------------------------------

func TestExportAndImportBackup(t *testing.T) {
	wallet := newInitedWallet(t)

	addr, err := wallet.CreateEthereumWallet("Primary")
	if err != nil {
		t.Fatalf("CreateEthereumWallet() error = %v", err)
	}

	passphrase := "s3cr3t!"
	payload, err := wallet.ExportWalletBackup(passphrase)
	if err != nil {
		t.Fatalf("ExportWalletBackup() error = %v", err)
	}
	if payload == "" {
		t.Fatal("expected non-empty backup payload")
	}

	wallet2 := newInitedWallet(t)
	result, err := wallet2.ImportWalletBackup(payload, passphrase)
	if err != nil {
		t.Fatalf("ImportWalletBackup() error = %v", err)
	}
	var imported map[string]any
	if err := json.Unmarshal([]byte(result), &imported); err != nil {
		t.Fatalf("import result JSON error = %v", err)
	}
	importedCount, _ := imported["imported"].(float64)
	if importedCount < 1 {
		t.Fatalf("expected at least 1 imported wallet, got %v", importedCount)
	}
	// Verify the imported wallet is accessible via GetAddress
	importedAddr, err := wallet2.GetAddress()
	if err != nil {
		t.Fatalf("GetAddress() after import error = %v", err)
	}
	if !strings.EqualFold(importedAddr, addr) {
		t.Fatalf("imported address %q != original %q", importedAddr, addr)
	}
}

func TestImportBackupWrongPassphraseFails(t *testing.T) {
	wallet := newInitedWallet(t)
	_, _ = wallet.CreateEthereumWallet("Primary")

	payload, _ := wallet.ExportWalletBackup("correct-pass")

	wallet2 := newInitedWallet(t)
	_, err := wallet2.ImportWalletBackup(payload, "wrong-pass")
	if err == nil {
		t.Fatal("expected error for wrong passphrase")
	}
}
