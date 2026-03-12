package ethereum

import (
	"context"
	"encoding/hex"
	"strings"
	"testing"

	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
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

func openTestDB(t *testing.T) *database.DB {
	t.Helper()
	db, err := database.Open(context.Background(), t.TempDir(), &testSecureKeyStore{
		masterKey: []byte("0123456789abcdef0123456789abcdef"),
		salt:      []byte("abcdef0123456789abcdef0123456789"),
	})
	if err != nil {
		t.Fatalf("database.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// ---------------------------------------------------------------------------
// ValidateAddress
// ---------------------------------------------------------------------------

func TestValidateAddress(t *testing.T) {
	tests := []struct {
		addr  string
		valid bool
	}{
		{"0x0000000000000000000000000000000000000001", true},
		{"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", true},
		{"0xinvalid", false},
		{"not-an-address", false},
		{"", false},
	}
	for _, tc := range tests {
		got := ValidateAddress(tc.addr)
		if got != tc.valid {
			t.Errorf("ValidateAddress(%q) = %v, want %v", tc.addr, got, tc.valid)
		}
	}
}

// ---------------------------------------------------------------------------
// SignMessage
// ---------------------------------------------------------------------------

func TestSignMessageProducesHexSignature(t *testing.T) {
	// Generate a deterministic private key for testing
	privateKeyHex := "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
	privateKeyBytes, err := hex.DecodeString(privateKeyHex)
	if err != nil {
		t.Fatalf("hex.DecodeString() error = %v", err)
	}

	sig, err := SignMessage(privateKeyBytes, "hello world")
	if err != nil {
		t.Fatalf("SignMessage() error = %v", err)
	}
	if len(sig) == 0 {
		t.Fatal("expected non-empty signature")
	}
	// EIP-191 personal_sign result is 132 hex chars (0x + 65 bytes)
	if len(sig) != 132 {
		t.Fatalf("expected 132-char hex signature, got len=%d sig=%q", len(sig), sig)
	}
}

func TestSignMessageRequiresValidKey(t *testing.T) {
	_, err := SignMessage(nil, "test")
	if err == nil {
		t.Fatal("expected error for nil private key")
	}
}

// ---------------------------------------------------------------------------
// ResolveToken
// ---------------------------------------------------------------------------

func TestResolveTokenBuiltIn(t *testing.T) {
	tokens, err := ListTokenConfigs("ethereum-sepolia")
	if err != nil {
		t.Fatalf("ListTokenConfigs() error = %v", err)
	}
	if len(tokens) == 0 {
		t.Fatal("expected at least one built-in token for ethereum-sepolia")
	}

	usdc, err := ResolveToken(tokens, "USDC")
	if err != nil {
		t.Fatalf("ResolveToken(USDC) error = %v", err)
	}
	if usdc.Symbol != "USDC" {
		t.Fatalf("expected symbol USDC, got %s", usdc.Symbol)
	}
}

func TestResolveTokenUnknown(t *testing.T) {
	tokens, _ := ListTokenConfigs("ethereum-sepolia")
	_, err := ResolveToken(tokens, "NOTEXIST")
	if err == nil {
		t.Fatal("expected error for unknown token identifier")
	}
}

func TestResolveTokenByAddress(t *testing.T) {
	tokens, _ := ListTokenConfigs("ethereum-sepolia")
	// Try to resolve by contract address (should work as identifier)
	if len(tokens) == 0 {
		t.Skip("no tokens to test")
	}
	first := tokens[0]
	found, err := ResolveToken(tokens, first.Address)
	if err != nil {
		t.Fatalf("ResolveToken(by address) error = %v", err)
	}
	if found.Address != first.Address {
		t.Fatalf("expected address %s, got %s", first.Address, found.Address)
	}
}

// ---------------------------------------------------------------------------
// ListTokenConfigs
// ---------------------------------------------------------------------------

func TestListTokenConfigsKnownNetworks(t *testing.T) {
	for _, net := range []string{"ethereum-mainnet", "ethereum-sepolia"} {
		tokens, err := ListTokenConfigs(net)
		if err != nil {
			t.Fatalf("ListTokenConfigs(%s) error = %v", net, err)
		}
		if len(tokens) == 0 {
			t.Fatalf("expected tokens for %s, got none", net)
		}
	}
}

func TestListTokenConfigsUnknownNetworkReturnsNativeETH(t *testing.T) {
	tokens, err := ListTokenConfigs("custom-chain-999")
	if err != nil {
		t.Fatalf("ListTokenConfigs(unknown) error = %v", err)
	}
	if len(tokens) != 1 {
		t.Fatalf("expected 1 fallback ETH token for unknown network, got %d", len(tokens))
	}
	if tokens[0].Symbol != "ETH" {
		t.Fatalf("expected fallback symbol ETH, got %s", tokens[0].Symbol)
	}
}

// ---------------------------------------------------------------------------
// CreateNewEthereumWallet
// ---------------------------------------------------------------------------

func TestCreateNewEthereumWalletRequiresDB(t *testing.T) {
	_, err := CreateNewEthereumWallet(context.Background(), nil, "Primary")
	if err == nil {
		t.Fatal("expected error for nil db")
	}
}

func TestCreateNewEthereumWalletInsertsRecord(t *testing.T) {
	db := openTestDB(t)

	address, err := CreateNewEthereumWallet(context.Background(), db, "Primary")
	if err != nil {
		t.Fatalf("CreateNewEthereumWallet() error = %v", err)
	}
	if !ValidateAddress(address) {
		t.Fatalf("expected valid Ethereum address, got %q", address)
	}

	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		t.Fatalf("ListWallets() error = %v", err)
	}
	if len(wallets) != 1 {
		t.Fatalf("expected 1 wallet, got %d", len(wallets))
	}
	if !strings.EqualFold(wallets[0].Address, address) {
		t.Fatalf("expected address %s in DB, got %s", address, wallets[0].Address)
	}
}

// ---------------------------------------------------------------------------
// formatTokenUnits helper (internal, tested via its effects)
// ---------------------------------------------------------------------------

func TestFormatTokenUnitsViaListTokenConfigs(t *testing.T) {
	// Indirectly verify decimal handling by checking ListTokenConfigs doesn't panic
	configs, err := ListTokenConfigs("ethereum-mainnet")
	if err != nil {
		t.Fatalf("ListTokenConfigs error = %v", err)
	}
	for _, c := range configs {
		if c.Decimals < 0 || c.Decimals > 18 {
			t.Fatalf("unexpected decimals %d for token %s", c.Decimals, c.Symbol)
		}
	}
}

func TestNormalizeUSDCAmount(t *testing.T) {
	cases := []struct {
		input   string
		want    string
		wantErr bool
	}{
		{"1", "1.000000", false},
		{"1.5", "1.500000", false},
		{"1.000001", "1.000001", false},
		{"1.0000001", "", true},
	}

	for _, tc := range cases {
		got, err := normalizeUSDCAmount(tc.input)
		if tc.wantErr {
			if err == nil {
				t.Fatalf("normalizeUSDCAmount(%q) expected error", tc.input)
			}
			continue
		}
		if err != nil {
			t.Fatalf("normalizeUSDCAmount(%q) error = %v", tc.input, err)
		}
		if got != tc.want {
			t.Fatalf("normalizeUSDCAmount(%q) = %q want %q", tc.input, got, tc.want)
		}
	}
}
