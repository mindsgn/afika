package core

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"sync"

	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/ethereum"
)

var ErrNotInitialized = errors.New("wallet core is not initialized")

type TransactionType string

const (
	TransactionTypeCredit   TransactionType = "credit"
	TransactionTypeDebit    TransactionType = "debit"
	TransactionTypeTransfer TransactionType = "transfer"
)

type TransactionState string

const (
	TransactionStatePending   TransactionState = "pending"
	TransactionStateCompleted TransactionState = "completed"
	TransactionStateFailed    TransactionState = "failed"
	TransactionStateReversed  TransactionState = "reversed"
)

type TransactionMetadata struct {
	Note        string `json:"note"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	ProviderID  string `json:"providerId"`
}

type Transaction struct {
	Hash      string              `json:"hash"`
	Chain     string              `json:"chain"`
	Token     string              `json:"token"`
	Amount    string              `json:"amount"`
	Type      TransactionType     `json:"type"`
	State     TransactionState    `json:"state"`
	Metadata  TransactionMetadata `json:"metadata"`
	CreatedAt int64               `json:"createdAt"`
	UpdatedAt int64               `json:"updatedAt"`
}

type AccountSummary struct {
	WalletAddress string `json:"walletAddress"`
	Network       string `json:"network"`
	Asset         string `json:"asset"`
	Balance       string `json:"balance"`
	Currency      string `json:"currency"`
}

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

type WalletCore struct {
	mu sync.RWMutex
	db *database.DB
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

func NewWalletCore() *WalletCore {
	return &WalletCore{}
}

func (w *WalletCore) Init(dataDir, password, masterKeyB64, kdfSaltB64 string) error {
	masterKey, err := base64.StdEncoding.DecodeString(masterKeyB64)
	if err != nil {
		return err
	}

	salt, err := base64.StdEncoding.DecodeString(kdfSaltB64)
	if err != nil {
		return err
	}

	keystore := &staticSecureKeyStore{
		masterKey: masterKey,
		salt:      salt,
	}

	db, err := database.Open(context.Background(), dataDir, password, keystore)
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

func (w *WalletCore) CreateEthereumWallet(name string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	return ethereum.CreateNewEthereumWallet(context.Background(), db, name)
}

func (w *WalletCore) GetBalance(network string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	balances, err := ethereum.GetTotalBalance(context.Background(), db, network)
	if err != nil {
		return "", err
	}

	encoded, err := json.Marshal(balances)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) ListAccounts() (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	accounts, err := db.ListWallets(context.Background())
	if err != nil {
		return "", err
	}

	encoded, err := json.Marshal(accounts)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) OpenOrCreateWallet(name string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", err
	}
	if len(wallets) > 0 {
		return wallets[0].Address, nil
	}

	if strings.TrimSpace(name) == "" {
		name = "Main Wallet"
	}

	return ethereum.CreateNewEthereumWallet(context.Background(), db, name)
}

func (w *WalletCore) GetAccountSummary(network string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", err
	}

	resolvedNetwork := resolveUSDCNetwork(network)
	balance, walletAddress, err := ethereum.GetUSDCBalance(context.Background(), db, resolvedNetwork)
	if err != nil {
		return "", err
	}

	if walletAddress == "" && len(wallets) > 0 {
		walletAddress = wallets[0].Address
	}

	summary := AccountSummary{
		WalletAddress: walletAddress,
		Network:       resolvedNetwork,
		Asset:         ethereum.USDCSymbol,
		Balance:       balance,
		Currency:      "USD",
	}

	encoded, err := json.Marshal(summary)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) SendMoneyTo(network string, destination string, amount string) (string, error) {
	if _, err := w.getDB(); err != nil {
		return "", err
	}

	return "", errors.New("send money is not implemented")
}

func (w *WalletCore) SendUsdc(network string, destination string, amount string, note string, providerID string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	return ethereum.SendUSDC(context.Background(), db, resolveUSDCNetwork(network), destination, amount, note, providerID)
}

func (w *WalletCore) ListUsdcTransactions(network string, limit int, offset int) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	items, err := ethereum.ListUSDCTransactions(context.Background(), db, resolveUSDCNetwork(network), limit, offset)
	if err != nil {
		return "", err
	}

	out := make([]Transaction, 0, len(items))
	for _, item := range items {
		out = append(out, Transaction{
			Hash:   item.TxHash,
			Chain:  item.Chain,
			Token:  item.Token,
			Amount: item.Amount,
			Type:   TransactionType(item.TransactionType),
			State:  TransactionState(item.State),
			Metadata: TransactionMetadata{
				Note:        item.Note,
				Source:      item.Source,
				Destination: item.Destination,
				ProviderID:  item.ProviderID,
			},
			CreatedAt: item.CreatedAt,
			UpdatedAt: item.UpdatedAt,
		})
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) ExportWalletBackup(passphrase string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(passphrase) == "" {
		return "", errors.New("passphrase is required")
	}

	wallets, err := db.ListWalletSecrets(context.Background())
	if err != nil {
		return "", err
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
		return "", err
	}

	encrypted, err := encryptBackup(passphrase, plain)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(encrypted), nil
}

func (w *WalletCore) ImportWalletBackup(payload string, passphrase string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(passphrase) == "" {
		return "", errors.New("passphrase is required")
	}

	raw, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return "", err
	}

	plain, err := decryptBackup(passphrase, raw)
	if err != nil {
		return "", err
	}

	var backup backupPayload
	if err := json.Unmarshal(plain, &backup); err != nil {
		return "", err
	}

	imported := 0
	for _, wallet := range backup.Wallets {
		privateKey, err := base64.StdEncoding.DecodeString(wallet.PrivateKey)
		if err != nil {
			continue
		}

		if err := db.InsertWalletIfMissing(context.Background(), wallet.Type, wallet.Name, wallet.Address, privateKey); err == nil {
			imported++
		}
	}

	result := map[string]any{"imported": imported}
	encoded, err := json.Marshal(result)
	if err != nil {
		return "", err
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

	ciphertext := gcm.Seal(nil, nonce, plaintext, nil)
	return append(nonce, ciphertext...), nil
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

func resolveUSDCNetwork(network string) string {
	value := strings.TrimSpace(strings.ToLower(network))
	switch value {
	case "", "mainnet", "gnosis", "gnosis-mainnet":
		return "gnosis-mainnet"
	case "testnet", "chiado", "gnosis-chiado":
		return "gnosis-chiado"
	default:
		return network
	}
}

func (w *WalletCore) getDB() (*database.DB, error) {
	w.mu.RLock()
	defer w.mu.RUnlock()

	if w.db == nil {
		return nil, ErrNotInitialized
	}

	return w.db, nil
}
