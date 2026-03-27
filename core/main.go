// Package core is the gomobile-exported EOA wallet library.
// It exposes WalletCore to iOS and Android via gomobile bind.
package core

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/ethereum"

	_ "github.com/mutecomm/go-sqlcipher/v4"
)

// ---------------------------------------------------------------------------
// Public errors
// ---------------------------------------------------------------------------

var ErrNotInitialized = errors.New("wallet core is not initialized")

func sanitizeError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrNotInitialized) {
		return ErrNotInitialized
	}
	return errors.New(err.Error())
}

// ---------------------------------------------------------------------------
// Public types (gomobile-compatible: only exported fields, no generics)
// ---------------------------------------------------------------------------

// NetworkConfig describes one EVM-compatible network.
type NetworkConfig struct {
	Name    string
	RPCURL  string
	ChainID int64
}

// Transaction is the gomobile-friendly transaction record returned to apps.
type Transaction struct {
	Hash        string `json:"hash"`
	FromAddress string `json:"fromAddress"`
	ToAddress   string `json:"toAddress"`
	Description string `json:"description"`
	TokenSymbol string `json:"tokenSymbol"`
	Amount      string `json:"amount"`
	FeeETH      string `json:"feeEth"`
	FeeUSD      string `json:"feeUsd"`
	USDAmount   string `json:"usdAmount"`
	Network     string `json:"network"`
	Mode        string `json:"mode"`
	Direction   string `json:"direction"` // "credit" or "debit"
	State       string `json:"state"`
	Timestamp   int64  `json:"timestamp"`
}

// TokenBalance is the gomobile-friendly token balance record.
type TokenBalance struct {
	Symbol   string `json:"symbol"`
	Address  string `json:"address"`
	Balance  string `json:"balance"`
	IsNative bool   `json:"isNative"`
}

// BalanceSnapshot represents the latest balance state with USD value.
type BalanceSnapshot struct {
	WalletAddress string `json:"walletAddress"`
	TokenAddress  string `json:"tokenAddress"`
	TokenSymbol   string `json:"tokenSymbol"`
	Balance       string `json:"balance"`
	USDValue      string `json:"usdValue"`
	Network       string `json:"network"`
	FetchedAt     int64  `json:"fetchedAt"`
}

// FXRate is a gomobile-friendly FX rate record.
type FXRate struct {
	Pair      string `json:"pair"`
	Rate      string `json:"rate"`
	FetchedAt int64  `json:"fetchedAt"`
}

// Recipient is a gomobile-friendly recipient record.
type Recipient struct {
	UUID          string `json:"uuid"`
	Name          string `json:"name"`
	Phone         string `json:"phone"`
	WalletAddress string `json:"walletAddress"`
	Email         string `json:"email"`
	Country       string `json:"country"`
	CreatedAt     int64  `json:"createdAt"`
	UpdatedAt     int64  `json:"updatedAt"`
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type walletBackup struct {
	Name       string `json:"name"`
	Type       string `json:"type"`
	Address    string `json:"address"`
	PrivateKey string `json:"privateKey"`
}

type backupPayload struct {
	Version int            `json:"version"`
	Wallets []walletBackup `json:"wallets"`
}

type staticSecureKeyStore struct {
	masterKey []byte
	salt      []byte
}

func (s *staticSecureKeyStore) GetOrCreateMasterKey(_ context.Context) ([]byte, error) {
	return append([]byte(nil), s.masterKey...), nil
}

func (s *staticSecureKeyStore) GetOrCreateKDFSalt(_ context.Context) ([]byte, error) {
	return append([]byte(nil), s.salt...), nil
}

// ---------------------------------------------------------------------------
// WalletCore
// ---------------------------------------------------------------------------

// WalletCore is the main gomobile entry point. One instance per app.
type WalletCore struct {
	mu       sync.RWMutex
	db       *database.DB
	networks map[string]NetworkConfig
	tokens   map[string][]ethereum.TokenConfig // keyed by network name
}

// NewWalletCore allocates a new (uninitialised) WalletCore.
func NewWalletCore() *WalletCore {
	return &WalletCore{
		networks: make(map[string]NetworkConfig),
		tokens:   make(map[string][]ethereum.TokenConfig),
	}
}

// Init opens (or creates) the encrypted wallet database.
//
//   - dataDir: directory where pocket.db will be stored
//   - masterKeyB64: base64-encoded 32-byte master key from Keychain/Keystore
//   - kdfSaltB64: base64-encoded 16-byte KDF salt from Keychain/Keystore
func (w *WalletCore) Init(dataDir, masterKeyB64, kdfSaltB64 string) error {
	masterKey, err := base64.StdEncoding.DecodeString(masterKeyB64)
	if err != nil {
		return err
	}
	salt, err := base64.StdEncoding.DecodeString(kdfSaltB64)
	if err != nil {
		return err
	}

	keystore := &staticSecureKeyStore{masterKey: masterKey, salt: salt}
	db, err := database.Open(context.Background(), dataDir, keystore)
	if err != nil {
		return err
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	if w.db != nil {
		_ = w.db.Close()
	}
	w.db = db
	return nil
}

// TestInitWalletSecure is a simple test function for debugging
func TestInitWalletSecure(dataDir string) string {
	wc := NewWalletCore()
	
	fmt.Printf("DEBUG: TestInitWalletSecure - Starting test\n")
	
	err := wc.InitWalletSecure(dataDir)
	if err != nil {
		fmt.Printf("DEBUG: TestInitWalletSecure - Init failed: %v\n", err)
		return fmt.Sprintf("ERROR: %v", err)
	}
	
	fmt.Printf("DEBUG: TestInitWalletSecure - Init successful, testing wallet creation\n")
	
	addr, err := wc.OpenOrCreateWallet("Test Wallet")
	if err != nil {
		fmt.Printf("DEBUG: TestInitWalletSecure - Wallet creation failed: %v\n", err)
		return fmt.Sprintf("ERROR: %v", err)
	}
	
	if addr == "" {
		fmt.Printf("DEBUG: TestInitWalletSecure - Wallet creation returned empty address\n")
		return "ERROR: Empty address"
	}
	
	fmt.Printf("DEBUG: TestInitWalletSecure - SUCCESS: %s\n", addr)
	wc.Close()
	return addr
}

// InitWalletSecure initializes the wallet with platform-generated secure key material.
// This is the mobile-friendly version that doesn't require pre-generated keys.
func (w *WalletCore) InitWalletSecure(dataDir string) error {
	fmt.Printf("DEBUG: InitWalletSecure - Starting with dataDir: %s\n", dataDir)
	
	// Ensure the directory exists
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		fmt.Printf("DEBUG: InitWalletSecure - Failed to create directory: %v\n", err)
		return fmt.Errorf("failed to create directory: %w", err)
	}
	fmt.Printf("DEBUG: InitWalletSecure - Directory created/verified\n")
	
	// Generate secure random master key (32 bytes)
	masterKey := make([]byte, 32)
	if _, err := rand.Read(masterKey); err != nil {
		fmt.Printf("DEBUG: InitWalletSecure - Failed to generate master key: %v\n", err)
		return fmt.Errorf("failed to generate master key: %w", err)
	}
	
	// Generate secure random salt (16 bytes)
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		fmt.Printf("DEBUG: InitWalletSecure - Failed to generate salt: %v\n", err)
		return fmt.Errorf("failed to generate salt: %w", err)
	}

	// Debug: Log successful key generation (without exposing the actual keys)
	fmt.Printf("DEBUG: InitWalletSecure - Generated master key (%d bytes) and salt (%d bytes)\n", len(masterKey), len(salt))

	keystore := &staticSecureKeyStore{masterKey: masterKey, salt: salt}
	
	fmt.Printf("DEBUG: InitWalletSecure - Attempting to open database\n")
	db, err := database.Open(context.Background(), dataDir, keystore)
	if err != nil {
		fmt.Printf("DEBUG: InitWalletSecure - Database open failed with error: %v\n", err)
		fmt.Printf("DEBUG: InitWalletSecure - Error type: %T\n", err)
		
		// Try to get more specific error information
		fmt.Printf("DEBUG: InitWalletSecure - Error details: %s\n", err.Error())
		
		return fmt.Errorf("database open failed: %w", err)
	}

	fmt.Printf("DEBUG: InitWalletSecure - Database opened successfully\n")

	w.mu.Lock()
	defer w.mu.Unlock()
	if w.db != nil {
		fmt.Printf("DEBUG: InitWalletSecure - Closing existing database\n")
		if closeErr := w.db.Close(); closeErr != nil {
			fmt.Printf("DEBUG: InitWalletSecure - Failed to close existing database: %v\n", closeErr)
		} else {
			fmt.Printf("DEBUG: InitWalletSecure - Existing database closed successfully\n")
		}
	}
	
	w.db = db
	fmt.Printf("DEBUG: InitWalletSecure - WalletCore initialized successfully, db is nil: %v\n", w.db == nil)
	return nil
}

// Close releases the database. Safe to call multiple times.
func (w *WalletCore) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.db == nil {
		return nil
	}
	err := w.db.Close()
	w.db = nil
	return err
}

// ---------------------------------------------------------------------------
// Network / token registration
// ---------------------------------------------------------------------------

// RegisterNetwork registers (or updates) an EVM network.
func (w *WalletCore) RegisterNetwork(name, rpcURL string, chainID int64) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.networks[strings.ToLower(strings.TrimSpace(name))] = NetworkConfig{
		Name:    name,
		RPCURL:  rpcURL,
		ChainID: chainID,
	}
}

// RegisterToken adds an ERC-20 token to a network's token list.
// address should be a checksummed EVM address (or "" for native).
func (w *WalletCore) RegisterToken(network, identifier, symbol, address string, decimals int) {
	key := strings.ToLower(strings.TrimSpace(network))
	w.mu.Lock()
	defer w.mu.Unlock()

	isNative := strings.ToLower(strings.TrimSpace(identifier)) == "native"
	cfg := ethereum.TokenConfig{
		Identifier: identifier,
		Symbol:     symbol,
		Address:    address,
		Decimals:   decimals,
		IsNative:   isNative,
	}
	// Replace if identifier already exists
	for i, t := range w.tokens[key] {
		if strings.EqualFold(t.Identifier, identifier) {
			w.tokens[key][i] = cfg
			return
		}
	}
	w.tokens[key] = append(w.tokens[key], cfg)
}

// ---------------------------------------------------------------------------
// Wallet management
// ---------------------------------------------------------------------------

// CreateEthereumWallet generates a new EOA and returns its address.
func (w *WalletCore) CreateEthereumWallet(name string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	addr, err := ethereum.CreateNewEthereumWallet(context.Background(), db, name)
	return addr, sanitizeError(err)
}

// OpenOrCreateWallet returns the first stored wallet address (creating one if none exists).
func (w *WalletCore) OpenOrCreateWallet(name string) (string, error) {
	fmt.Printf("DEBUG: OpenOrCreateWallet - Starting with name: %s\n", name)
	
	db, err := w.getDB()
	if err != nil {
		fmt.Printf("DEBUG: OpenOrCreateWallet - getDB failed: %v\n", err)
		return "", sanitizeError(err)
	}
	
	fmt.Printf("DEBUG: OpenOrCreateWallet - Got database, listing wallets\n")
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		fmt.Printf("DEBUG: OpenOrCreateWallet - ListWallets failed: %v\n", err)
		return "", sanitizeError(err)
	}
	
	fmt.Printf("DEBUG: OpenOrCreateWallet - Found %d existing wallets\n", len(wallets))
	if len(wallets) > 0 {
		fmt.Printf("DEBUG: OpenOrCreateWallet - Returning existing wallet: %s\n", wallets[0].Address)
		return wallets[0].Address, nil
	}
	
	if strings.TrimSpace(name) == "" {
		name = "Main Wallet"
	}
	
	fmt.Printf("DEBUG: OpenOrCreateWallet - Creating new wallet with name: %s\n", name)
	addr, err := ethereum.CreateNewEthereumWallet(context.Background(), db, name)
	if err != nil {
		fmt.Printf("DEBUG: OpenOrCreateWallet - CreateNewEthereumWallet failed: %v\n", err)
		return "", sanitizeError(err)
	}
	
	fmt.Printf("DEBUG: OpenOrCreateWallet - Created new wallet: %s\n", addr)
	return addr, sanitizeError(err)
}

// GetAddress returns the primary wallet address as a JSON string, or "" if none.
func (w *WalletCore) GetAddress() (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		return "", nil
	}
	return wallets[0].Address, nil
}

// ListAccounts returns a JSON array of all stored wallet addresses.
func (w *WalletCore) ListAccounts() (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	encoded, err := json.Marshal(wallets)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// ValidateAddress returns "true" if addr is a valid EVM address, "false" otherwise.
func (w *WalletCore) ValidateAddress(addr string) string {
	if ethereum.ValidateAddress(addr) {
		return "true"
	}
	return "false"
}

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

// SignMessage signs message with the primary wallet's private key using EIP-191
// and returns the 0x-prefixed hex signature.
func (w *WalletCore) SignMessage(message string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	secrets, err := db.ListWalletSecrets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(secrets) == 0 {
		return "", sanitizeError(errors.New("no wallet found"))
	}
	sig, err := ethereum.SignMessage(secrets[0].PrivateKey, message)
	return sig, sanitizeError(err)
}

// ExportPrivateKey returns the primary wallet private key as 0x-prefixed hex.
func (w *WalletCore) ExportPrivateKey() (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	secrets, err := db.ListWalletSecrets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(secrets) == 0 {
		return "", sanitizeError(errors.New("no wallet found"))
	}
	return "0x" + hex.EncodeToString(secrets[0].PrivateKey), nil
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

// GetTokenBalance returns the formatted balance of tokenIdentifier for the
// primary wallet on the given network. Returns a decimal string.
func (w *WalletCore) GetTokenBalance(networkName, tokenIdentifier string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}

	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		return "0", nil
	}

	net, rpcURL, err := w.resolveNetwork(networkName)
	if err != nil {
		return "", sanitizeError(err)
	}
	_ = net
	tokens := w.mergedTokens(networkName)
	token, err := ethereum.ResolveToken(tokens, tokenIdentifier)
	if err != nil {
		return "", sanitizeError(err)
	}

	bal, err := ethereum.GetTokenBalanceForAddress(context.Background(), wallets[0].Address, rpcURL, token)
	return bal, sanitizeError(err)
}

// GetAllBalances returns a JSON array of TokenBalance for all registered tokens
// on the given network.
func (w *WalletCore) GetAllBalances(networkName string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		encoded, _ := json.Marshal([]TokenBalance{})
		return string(encoded), nil
	}

	_, rpcURL, err := w.resolveNetwork(networkName)
	if err != nil {
		return "", sanitizeError(err)
	}

	tokens := w.mergedTokens(networkName)
	out := make([]TokenBalance, 0, len(tokens))
	for _, t := range tokens {
		bal, err := ethereum.GetTokenBalanceForAddress(context.Background(), wallets[0].Address, rpcURL, t)
		if err != nil {
			bal = "0"
		}
		out = append(out, TokenBalance{
			Symbol:   t.Symbol,
			Address:  t.Address,
			Balance:  bal,
			IsNative: t.IsNative,
		})
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// SyncBalances fetches live balances, stores them in balance_history, and returns latest balances.
func (w *WalletCore) SyncBalances(networkName string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		encoded, _ := json.Marshal([]BalanceSnapshot{})
		return string(encoded), nil
	}

	_, rpcURL, err := w.resolveNetwork(networkName)
	if err != nil {
		return "", sanitizeError(err)
	}

	tokens := w.mergedTokens(networkName)
	hasNative := false
	for _, t := range tokens {
		if t.IsNative {
			hasNative = true
			break
		}
	}
	ethUSD := 0.0
	if hasNative {
		if price, err := ethereum.FetchETHPriceUSD(context.Background()); err == nil {
			ethUSD = price
		}
	}

	out := make([]BalanceSnapshot, 0, len(tokens))
	for _, t := range tokens {
		bal, err := ethereum.GetTokenBalanceForAddress(context.Background(), wallets[0].Address, rpcURL, t)
		if err != nil {
			bal = "0"
		}

		usdValue := ""
		if t.IsNative && ethUSD > 0 {
			usdValue = ethereum.FormatUSDFromString(bal, ethUSD)
		} else if strings.EqualFold(t.Symbol, ethereum.USDCSymbol) || strings.EqualFold(t.Identifier, ethereum.USDCIdentifier) {
			usdValue = ethereum.FormatUSDValue(bal)
		}

		tokenAddress := t.Address
		if tokenAddress == "" && t.IsNative {
			tokenAddress = "native"
		}

		_, _ = db.InsertBalanceHistoryIfChanged(context.Background(), database.BalanceHistory{
			WalletAddress: wallets[0].Address,
			Network:       networkName,
			TokenAddress:  tokenAddress,
			TokenSymbol:   t.Symbol,
			Balance:       bal,
			USDValue:      usdValue,
			FetchedAt:     time.Now().UnixMilli(),
		})

		out = append(out, BalanceSnapshot{
			WalletAddress: wallets[0].Address,
			TokenAddress:  tokenAddress,
			TokenSymbol:   t.Symbol,
			Balance:       bal,
			USDValue:      usdValue,
			Network:       networkName,
			FetchedAt:     time.Now().UnixMilli(),
		})
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// GetLatestBalances returns the latest stored balance snapshots from local DB.
func (w *WalletCore) GetLatestBalances(networkName string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		encoded, _ := json.Marshal([]BalanceSnapshot{})
		return string(encoded), nil
	}
	rows, err := db.ListLatestBalances(context.Background(), wallets[0].Address, networkName)
	if err != nil {
		return "", sanitizeError(err)
	}
	out := make([]BalanceSnapshot, 0, len(rows))
	for _, b := range rows {
		out = append(out, BalanceSnapshot{
			WalletAddress: wallets[0].Address,
			TokenAddress:  b.TokenAddress,
			TokenSymbol:   b.TokenSymbol,
			Balance:       b.Balance,
			USDValue:      b.USDValue,
			Network:       b.Network,
			FetchedAt:     b.FetchedAt,
		})
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// UpsertBalanceSnapshots stores balance snapshots into the local database.
// jsonPayload must be a JSON array matching BalanceSnapshot.
func (w *WalletCore) UpsertBalanceSnapshots(jsonPayload string) error {
	db, err := w.getDB()
	if err != nil {
		return sanitizeError(err)
	}
	var items []BalanceSnapshot
	if err := json.Unmarshal([]byte(jsonPayload), &items); err != nil {
		return sanitizeError(err)
	}
	if len(items) == 0 {
		return nil
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return sanitizeError(err)
	}
	defaultAddress := ""
	if len(wallets) > 0 {
		defaultAddress = wallets[0].Address
	}
	now := time.Now().UnixMilli()
	for _, item := range items {
		// Balance snapshots don't always include wallet address; fallback to primary wallet.
		address := strings.TrimSpace(item.WalletAddress)
		if address == "" {
			address = defaultAddress
		}
		if address == "" {
			continue
		}
		fetchedAt := item.FetchedAt
		if fetchedAt == 0 {
			fetchedAt = now
		}
		_, _ = db.InsertBalanceHistoryIfChanged(context.Background(), database.BalanceHistory{
			WalletAddress: address,
			Network:       item.Network,
			TokenAddress:  item.TokenAddress,
			TokenSymbol:   item.TokenSymbol,
			Balance:       item.Balance,
			USDValue:      item.USDValue,
			FetchedAt:     fetchedAt,
		})
	}
	return nil
}

// GetPriceHistory returns balance history records from the local database as JSON.
// limit <= 0 defaults to 50.
func (w *WalletCore) GetPriceHistory(networkName string, limit int) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		encoded, _ := json.Marshal([]database.BalanceHistory{})
		return string(encoded), nil
	}
	if limit <= 0 {
		limit = 50
	}
	history, err := db.ListBalanceHistory(context.Background(), wallets[0].Address, networkName, limit)
	if err != nil {
		return "", sanitizeError(err)
	}
	encoded, err := json.Marshal(history)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// UpsertFXRate stores an FX rate in the local database.
func (w *WalletCore) UpsertFXRate(pair, rate string, fetchedAt int64) error {
	db, err := w.getDB()
	if err != nil {
		return sanitizeError(err)
	}
	if strings.TrimSpace(pair) == "" || strings.TrimSpace(rate) == "" {
		return sanitizeError(errors.New("pair and rate are required"))
	}
	if fetchedAt <= 0 {
		fetchedAt = time.Now().UnixMilli()
	}
	return sanitizeError(db.UpsertFXRate(context.Background(), pair, rate, fetchedAt))
}

// LatestFXRate returns the latest stored FX rate as JSON.
func (w *WalletCore) LatestFXRate(pair string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	if strings.TrimSpace(pair) == "" {
		return "", sanitizeError(errors.New("pair is required"))
	}
	rate, err := db.LatestFXRate(context.Background(), pair)
	if err != nil {
		return "", sanitizeError(err)
	}
	if rate == nil {
		return "", nil
	}
	encoded, err := json.Marshal(FXRate{Pair: rate.Pair, Rate: rate.Rate, FetchedAt: rate.FetchedAt})
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// ---------------------------------------------------------------------------
// Watched addresses
// ---------------------------------------------------------------------------

// AddWatchedAddress watches address under label for inbound monitoring.
func (w *WalletCore) AddWatchedAddress(address, label string) error {
	db, err := w.getDB()
	if err != nil {
		return sanitizeError(err)
	}
	if !common.IsHexAddress(address) {
		return sanitizeError(errors.New("invalid address"))
	}
	return sanitizeError(db.InsertWatchedAddress(context.Background(), address, label))
}

// ListWatchedAddresses returns all watched addresses as a JSON array.
func (w *WalletCore) ListWatchedAddresses() (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	addrs, err := db.ListWatchedAddresses(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	encoded, err := json.Marshal(addrs)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// ---------------------------------------------------------------------------
// Recipients
// ---------------------------------------------------------------------------

// SaveRecipient inserts a recipient record from JSON and returns saved recipient as JSON.
func (w *WalletCore) SaveRecipient(jsonPayload string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	var r Recipient
	if err := json.Unmarshal([]byte(jsonPayload), &r); err != nil {
		return "", sanitizeError(err)
	}
	if strings.TrimSpace(r.Name) == "" {
		return "", sanitizeError(errors.New("name is required"))
	}
	saved, err := db.InsertRecipient(context.Background(), database.Recipient{
		UUID:          r.UUID,
		Name:          r.Name,
		Phone:         r.Phone,
		WalletAddress: r.WalletAddress,
		Email:         r.Email,
		Country:       r.Country,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	})
	if err != nil {
		return "", sanitizeError(err)
	}
	encoded, err := json.Marshal(Recipient{
		UUID:          saved.UUID,
		Name:          saved.Name,
		Phone:         saved.Phone,
		WalletAddress: saved.WalletAddress,
		Email:         saved.Email,
		Country:       saved.Country,
		CreatedAt:     saved.CreatedAt,
		UpdatedAt:     saved.UpdatedAt,
	})
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// GetRecipient returns a recipient by ID as JSON (or "" if not found).
func (w *WalletCore) GetRecipient(id string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	if strings.TrimSpace(id) == "" {
		return "", sanitizeError(errors.New("recipient id is required"))
	}
	item, err := db.GetRecipientByID(context.Background(), id)
	if err != nil {
		return "", sanitizeError(err)
	}
	if item == nil {
		return "", nil
	}
	encoded, err := json.Marshal(Recipient{
		UUID:          item.UUID,
		Name:          item.Name,
		Phone:         item.Phone,
		WalletAddress: item.WalletAddress,
		Email:         item.Email,
		Country:       item.Country,
		CreatedAt:     item.CreatedAt,
		UpdatedAt:     item.UpdatedAt,
	})
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// GetAllRecipients returns all recipients as JSON.
func (w *WalletCore) GetAllRecipients() (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	items, err := db.ListAllRecipients(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	out := make([]Recipient, 0, len(items))
	for _, item := range items {
		out = append(out, Recipient{
			UUID:          item.UUID,
			Name:          item.Name,
			Phone:         item.Phone,
			WalletAddress: item.WalletAddress,
			Email:         item.Email,
			Country:       item.Country,
			CreatedAt:     item.CreatedAt,
			UpdatedAt:     item.UpdatedAt,
		})
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// SearchRecipientsByName returns recipients whose name matches (case-insensitive contains).
func (w *WalletCore) SearchRecipientsByName(name string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	if strings.TrimSpace(name) == "" {
		encoded, _ := json.Marshal([]Recipient{})
		return string(encoded), nil
	}
	items, err := db.SearchRecipientsByName(context.Background(), name)
	if err != nil {
		return "", sanitizeError(err)
	}
	out := make([]Recipient, 0, len(items))
	for _, item := range items {
		out = append(out, Recipient{
			UUID:          item.UUID,
			Name:          item.Name,
			Phone:         item.Phone,
			WalletAddress: item.WalletAddress,
			Email:         item.Email,
			Country:       item.Country,
			CreatedAt:     item.CreatedAt,
			UpdatedAt:     item.UpdatedAt,
		})
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// SearchRecipientsByPhone returns recipients whose phone matches (contains).
func (w *WalletCore) SearchRecipientsByPhone(phone string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	if strings.TrimSpace(phone) == "" {
		encoded, _ := json.Marshal([]Recipient{})
		return string(encoded), nil
	}
	items, err := db.SearchRecipientsByPhone(context.Background(), phone)
	if err != nil {
		return "", sanitizeError(err)
	}
	out := make([]Recipient, 0, len(items))
	for _, item := range items {
		out = append(out, Recipient{
			UUID:          item.UUID,
			Name:          item.Name,
			Phone:         item.Phone,
			WalletAddress: item.WalletAddress,
			Email:         item.Email,
			Country:       item.Country,
			CreatedAt:     item.CreatedAt,
			UpdatedAt:     item.UpdatedAt,
		})
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// UpdateRecipient updates a recipient record from JSON and returns updated recipient as JSON.
func (w *WalletCore) UpdateRecipient(jsonPayload string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	var r Recipient
	if err := json.Unmarshal([]byte(jsonPayload), &r); err != nil {
		return "", sanitizeError(err)
	}
	if strings.TrimSpace(r.UUID) == "" {
		return "", sanitizeError(errors.New("recipient uuid is required"))
	}
	if strings.TrimSpace(r.Name) == "" {
		return "", sanitizeError(errors.New("name is required"))
	}
	updated, err := db.UpdateRecipient(context.Background(), database.Recipient{
		UUID:          r.UUID,
		Name:          r.Name,
		Phone:         r.Phone,
		WalletAddress: r.WalletAddress,
		Email:         r.Email,
		Country:       r.Country,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	})
	if err != nil {
		return "", sanitizeError(err)
	}
	encoded, err := json.Marshal(Recipient{
		UUID:          updated.UUID,
		Name:          updated.Name,
		Phone:         updated.Phone,
		WalletAddress: updated.WalletAddress,
		Email:         updated.Email,
		Country:       updated.Country,
		CreatedAt:     updated.CreatedAt,
		UpdatedAt:     updated.UpdatedAt,
	})
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// ---------------------------------------------------------------------------
// Send
// ---------------------------------------------------------------------------

// SendToken sends tokenIdentifier on networkName to recipient.
// amount is a decimal string (e.g. "1.5"). Returns the tx hash.
func (w *WalletCore) SendToken(networkName, tokenIdentifier, recipient, amount string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}

	net, rpcURL, err := w.resolveNetwork(networkName)
	if err != nil {
		return "", sanitizeError(err)
	}

	result, err := ethereum.SendToken(
		context.Background(), db, rpcURL, net.ChainID, networkName, tokenIdentifier, recipient, amount,
	)
	if err != nil {
		return "", sanitizeError(err)
	}
	return result.TxHash, nil
}

// SendUSDC sends USDC on networkName to recipient.
// amount is a decimal string (e.g. "1.5"). Returns the tx hash.
func (w *WalletCore) SendUSDC(networkName, recipient, amount string) (string, error) {
	return w.SendToken(networkName, ethereum.USDCIdentifier, recipient, amount)
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

// SyncInboundTransactions fetches on-chain inbound transfers for the primary
// wallet on networkName and stores new ones in the local DB.
func (w *WalletCore) SyncInboundTransactions(networkName string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		encoded, _ := json.Marshal(map[string]any{"synced": 0})
		return string(encoded), nil
	}

	_, rpcURL, err := w.resolveNetwork(networkName)
	if err != nil {
		return "", sanitizeError(err)
	}

	tokens := w.mergedTokens(networkName)
	transfers, err := ethereum.FetchInboundTransfers(context.Background(), wallets[0].Address, rpcURL, tokens, networkName)
	if err != nil {
		return "", sanitizeError(err)
	}

	synced := 0
	for _, tx := range transfers {
		tx.WalletAddress = wallets[0].Address
		if err := db.InsertTransactionIfMissing(context.Background(), tx); err == nil {
			synced++
		}
	}
	encoded, err := json.Marshal(map[string]any{"synced": synced})
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// ListTokenTransactions returns stored transactions for a specific token as JSON.
func (w *WalletCore) ListTokenTransactions(networkName, tokenIdentifier string, limit, offset int) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		encoded, _ := json.Marshal([]Transaction{})
		return string(encoded), nil
	}

	rpcURL := w.rpcURL(networkName)
	items, err := ethereum.ListTokenTransactions(
		context.Background(), db, wallets[0].Address, rpcURL, networkName, tokenIdentifier, limit, offset,
	)
	if err != nil {
		return "", sanitizeError(err)
	}
	return marshalTransactions(items, wallets[0].Address)
}

// ListAllTransactions returns all stored transactions for the primary wallet as JSON.
func (w *WalletCore) ListAllTransactions(networkName string, limit, offset int) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	if len(wallets) == 0 {
		encoded, _ := json.Marshal([]Transaction{})
		return string(encoded), nil
	}

	rpcURL := w.rpcURL(networkName)
	items, err := ethereum.ListAllTransactions(
		context.Background(), db, wallets[0].Address, rpcURL, limit, offset,
	)
	if err != nil {
		return "", sanitizeError(err)
	}
	return marshalTransactions(items, wallets[0].Address)
}

// UpsertTransactions stores transaction snapshots into the local database.
// jsonPayload must be a JSON array matching the backend transaction schema.
func (w *WalletCore) UpsertTransactions(jsonPayload string) error {
	db, err := w.getDB()
	if err != nil {
		return sanitizeError(err)
	}
	var items []struct {
		WalletAddress string `json:"walletAddress"`
		TxHash        string `json:"txHash"`
		FromAddress   string `json:"fromAddress"`
		ToAddress     string `json:"toAddress"`
		Description   string `json:"description"`
		TokenAddress  string `json:"tokenAddress"`
		TokenSymbol   string `json:"tokenSymbol"`
		Amount        string `json:"amount"`
		FeeNative     string `json:"feeNative"`
		FeeETH        string `json:"feeEth"`
		FeeUSD        string `json:"feeUsd"`
		USDAmount     string `json:"usdAmount"`
		Network       string `json:"network"`
		Direction     string `json:"direction"`
		State         string `json:"state"`
		BlockNumber   uint64 `json:"blockNumber"`
		TimestampMs   int64  `json:"timestampMs"`
		Timestamp     int64  `json:"timestamp"`
	}
	if err := json.Unmarshal([]byte(jsonPayload), &items); err != nil {
		return sanitizeError(err)
	}
	if len(items) == 0 {
		return nil
	}
	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return sanitizeError(err)
	}
	defaultAddress := ""
	if len(wallets) > 0 {
		defaultAddress = wallets[0].Address
	}
	for _, item := range items {
		walletAddress := strings.TrimSpace(item.WalletAddress)
		if walletAddress == "" {
			walletAddress = defaultAddress
		}
		if walletAddress == "" || strings.TrimSpace(item.TxHash) == "" {
			continue
		}
		timestampMs := item.TimestampMs
		if timestampMs == 0 {
			timestampMs = item.Timestamp
		}
		if timestampMs > 0 && timestampMs < 1_000_000_000_000 {
			timestampMs *= 1000
		}
		feeNative := strings.TrimSpace(item.FeeNative)
		if feeNative == "" {
			feeNative = item.FeeETH
		}
		_ = db.InsertTransactionIfMissing(context.Background(), database.TransactionRecord{
			WalletAddress: walletAddress,
			TxHash:        item.TxHash,
			FromAddress:   item.FromAddress,
			ToAddress:     item.ToAddress,
			Description:   item.Description,
			TokenAddress:  item.TokenAddress,
			TokenSymbol:   item.TokenSymbol,
			Amount:        item.Amount,
			FeeETH:        feeNative,
			FeeUSD:        item.FeeUSD,
			USDAmount:     item.USDAmount,
			Network:       item.Network,
			TxMode:        "backend",
			State:         item.State,
			BlockNumber:   item.BlockNumber,
			Timestamp:     timestampMs,
		})
	}
	return nil
}

// ---------------------------------------------------------------------------
// Backup / restore
// ---------------------------------------------------------------------------

// ExportWalletBackup AES-GCM encrypts all wallet private keys with passphrase
// and returns a base64-encoded ciphertext blob.
func (w *WalletCore) ExportWalletBackup(passphrase string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	if strings.TrimSpace(passphrase) == "" {
		return "", sanitizeError(errors.New("passphrase is required"))
	}
	wallets, err := db.ListWalletSecrets(context.Background())
	if err != nil {
		return "", sanitizeError(err)
	}
	payload := backupPayload{Version: 1, Wallets: make([]walletBackup, 0, len(wallets))}
	for _, wallet := range wallets {
		payload.Wallets = append(payload.Wallets, walletBackup{
			Name:       wallet.Name,
			Type:       wallet.WalletType,
			Address:    wallet.Address,
			PrivateKey: base64.StdEncoding.EncodeToString(wallet.PrivateKey),
		})
	}
	plain, err := json.Marshal(payload)
	if err != nil {
		return "", sanitizeError(err)
	}
	encrypted, err := encryptBackup(passphrase, plain)
	if err != nil {
		return "", sanitizeError(err)
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}

// ImportWalletBackup decrypts a backup created by ExportWalletBackup and
// inserts any wallets not already present.
func (w *WalletCore) ImportWalletBackup(payload string, passphrase string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", sanitizeError(err)
	}
	if strings.TrimSpace(passphrase) == "" {
		return "", sanitizeError(errors.New("passphrase is required"))
	}
	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", sanitizeError(err)
	}
	plain, err := decryptBackup(passphrase, raw)
	if err != nil {
		return "", sanitizeError(err)
	}
	var backup backupPayload
	if err := json.Unmarshal(plain, &backup); err != nil {
		return "", sanitizeError(err)
	}
	imported := 0
	for _, wallet := range backup.Wallets {
		privateKey, err := base64.StdEncoding.DecodeString(wallet.PrivateKey)
		if err != nil {
			continue
		}
		if err := db.InsertWalletIfMissing(context.Background(), wallet.Name, wallet.Type, wallet.Address, privateKey); err == nil {
			imported++
		}
	}
	encoded, err := json.Marshal(map[string]any{"imported": imported})
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

func (w *WalletCore) getDB() (*database.DB, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	if w.db == nil {
		return nil, ErrNotInitialized
	}
	return w.db, nil
}

func (w *WalletCore) resolveNetwork(name string) (NetworkConfig, string, error) {
	key := strings.ToLower(strings.TrimSpace(name))
	w.mu.RLock()
	net, ok := w.networks[key]
	w.mu.RUnlock()
	if !ok {
		return NetworkConfig{}, "", fmt.Errorf("network %q not registered; call RegisterNetwork first", name)
	}
	if net.RPCURL == "" {
		return NetworkConfig{}, "", fmt.Errorf("network %q has no rpcURL", name)
	}
	return net, net.RPCURL, nil
}

func (w *WalletCore) rpcURL(name string) string {
	key := strings.ToLower(strings.TrimSpace(name))
	w.mu.RLock()
	net := w.networks[key]
	w.mu.RUnlock()
	return net.RPCURL
}

// mergedTokens returns the custom registered tokens merged with built-in registry.
func (w *WalletCore) mergedTokens(networkName string) []ethereum.TokenConfig {
	key := strings.ToLower(strings.TrimSpace(networkName))
	w.mu.RLock()
	custom := append([]ethereum.TokenConfig(nil), w.tokens[key]...)
	w.mu.RUnlock()

	builtin, _ := ethereum.ListTokenConfigs(networkName)
	// Merge: custom takes precedence (by identifier)
	seen := make(map[string]bool)
	result := make([]ethereum.TokenConfig, 0)
	for _, t := range custom {
		seen[strings.ToLower(t.Identifier)] = true
		result = append(result, t)
	}
	for _, t := range builtin {
		if !seen[strings.ToLower(t.Identifier)] {
			result = append(result, t)
		}
	}
	return result
}

func marshalTransactions(items []database.TransactionRecord, walletAddress string) (string, error) {
	out := make([]Transaction, 0, len(items))
	for _, item := range items {
		direction := "credit"
		if strings.EqualFold(item.FromAddress, walletAddress) {
			direction = "debit"
		}
		out = append(out, Transaction{
			Hash:        item.TxHash,
			FromAddress: item.FromAddress,
			ToAddress:   item.ToAddress,
			Description: item.Description,
			TokenSymbol: item.TokenSymbol,
			Amount:      item.Amount,
			FeeETH:      item.FeeETH,
			FeeUSD:      item.FeeUSD,
			USDAmount:   item.USDAmount,
			Network:     item.Network,
			Mode:        item.TxMode,
			Direction:   direction,
			State:       item.State,
			Timestamp:   item.Timestamp,
		})
	}
	encoded, err := json.Marshal(out)
	if err != nil {
		return "", sanitizeError(err)
	}
	return string(encoded), nil
}

func encryptBackup(passphrase string, plaintext []byte) ([]byte, error) {
	key := sha256.Sum256([]byte(passphrase))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return append(nonce, gcm.Seal(nil, nonce, plaintext, nil)...), nil
}

func decryptBackup(passphrase string, encrypted []byte) ([]byte, error) {
	key := sha256.Sum256([]byte(passphrase))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(encrypted) < gcm.NonceSize() {
		return nil, errors.New("invalid backup payload")
	}
	nonce := encrypted[:gcm.NonceSize()]
	ciphertext := encrypted[gcm.NonceSize():]
	return gcm.Open(nil, nonce, ciphertext, nil)
}
