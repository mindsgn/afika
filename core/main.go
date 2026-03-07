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
	"os"
	"strings"
	"sync"

	"github.com/mindsgn-studio/pocket-money-app/core/internal/config"
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
	Hash            string              `json:"hash"`
	UserOpHash      string              `json:"userOpHash"`
	Chain           string              `json:"chain"`
	Token           string              `json:"token"`
	Amount          string              `json:"amount"`
	Type            TransactionType     `json:"type"`
	State           TransactionState    `json:"state"`
	BundlerStatus   string              `json:"bundlerStatus"`
	Mode            string              `json:"mode"`
	SponsorshipMode string              `json:"sponsorshipMode"`
	Metadata        TransactionMetadata `json:"metadata"`
	CreatedAt       int64               `json:"createdAt"`
	UpdatedAt       int64               `json:"updatedAt"`
}

type SendOperationResult struct {
	OperationHash string `json:"operationHash"`
	UserOpHash    string `json:"userOpHash"`
	TxHash        string `json:"txHash"`
	Mode          string `json:"mode"`
	Sponsored     bool   `json:"sponsored"`
	Network       string `json:"network"`
	Token         string `json:"token"`
}

type AccountSummary struct {
	WalletAddress string `json:"walletAddress"`
	Network       string `json:"network"`
	Asset         string `json:"asset"`
	Balance       string `json:"balance"`
	Currency      string `json:"currency"`
}

type TokenBalance struct {
	Identifier string `json:"identifier"`
	Symbol     string `json:"symbol"`
	Address    string `json:"address"`
	Decimals   int    `json:"decimals"`
	IsNative   bool   `json:"isNative"`
	Balance    string `json:"balance"`
}

type AccountSnapshot struct {
	OwnerAddress   string         `json:"ownerAddress"`
	AccountAddress string         `json:"accountAddress"`
	Network        string         `json:"network"`
	Balances       []TokenBalance `json:"balances"`
}

type AAReadiness struct {
	Network              string `json:"network"`
	OwnerAddress         string `json:"ownerAddress"`
	AccountAddress       string `json:"accountAddress"`
	SmartAccountReady    bool   `json:"smartAccountReady"`
	EntryPointConfigured bool   `json:"entryPointConfigured"`
	BundlerConfigured    bool   `json:"bundlerConfigured"`
	PaymasterConfigured  bool   `json:"paymasterConfigured"`
	SponsorshipReady     bool   `json:"sponsorshipReady"`
}

type SmartAccountCreationReadiness struct {
	Network                   string   `json:"network"`
	OwnerAddress              string   `json:"ownerAddress"`
	FactoryAddress            string   `json:"factoryAddress"`
	EntryPointAddress         string   `json:"entryPointAddress"`
	SmartAccountAddress       string   `json:"smartAccountAddress"`
	SmartAccountExists        bool     `json:"smartAccountExists"`
	OwnerBalanceWei           string   `json:"ownerBalanceWei"`
	OwnerRequiredMinGasWei    string   `json:"ownerRequiredMinGasWei"`
	HasSufficientOwnerBalance bool     `json:"hasSufficientOwnerBalance"`
	CanUseSponsoredCreate     bool     `json:"canUseSponsoredCreate"`
	IsReady                   bool     `json:"isReady"`
	FailureReasons            []string `json:"failureReasons"`
	Warnings                  []string `json:"warnings"`
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
	if strings.EqualFold(strings.TrimSpace(os.Getenv("POCKET_APP_ENV")), "production") {
		if _, err := config.ValidateAAConfig("ethereum-mainnet", true); err != nil {
			return err
		}
	}

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

	resolvedNetwork := resolveAppNetwork(network)
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

func (w *WalletCore) GetAccountSnapshot(network string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	resolvedNetwork := resolveAppNetwork(network)
	snapshot, err := ethereum.GetAccountSnapshot(context.Background(), db, resolvedNetwork)
	if err != nil {
		return "", err
	}

	out := AccountSnapshot{
		OwnerAddress:   snapshot.OwnerAddress,
		AccountAddress: snapshot.AccountAddress,
		Network:        snapshot.Network,
		Balances:       make([]TokenBalance, 0, len(snapshot.Balances)),
	}
	for _, item := range snapshot.Balances {
		out.Balances = append(out.Balances, TokenBalance{
			Identifier: item.Identifier,
			Symbol:     item.Symbol,
			Address:    item.Address,
			Decimals:   item.Decimals,
			IsNative:   item.IsNative,
			Balance:    item.Balance,
		})
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) GetAAReadiness(network string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	resolvedNetwork := resolveAppNetwork(network)
	deployment, err := config.GetDeployment(resolvedNetwork)
	if err != nil {
		return "", err
	}

	ownerAddress := ""
	if wallets, err := db.ListWallets(context.Background()); err == nil && len(wallets) > 0 {
		ownerAddress = wallets[0].Address
	}

	accountAddress := ""
	smartReady := false
	if ownerAddress != "" {
		if _, account, err := ethereum.GetSmartAccount(context.Background(), db, resolvedNetwork); err == nil && strings.TrimSpace(account) != "" {
			accountAddress = account
			smartReady = true
		}
	}

	entryPointConfigured := strings.TrimSpace(deployment.EntryPointAddress) != ""
	bundlerConfigured := strings.TrimSpace(deployment.BundlerURL) != ""
	paymasterConfigured := strings.TrimSpace(deployment.PaymasterAddress) != ""

	readiness := AAReadiness{
		Network:              resolvedNetwork,
		OwnerAddress:         ownerAddress,
		AccountAddress:       accountAddress,
		SmartAccountReady:    smartReady,
		EntryPointConfigured: entryPointConfigured,
		BundlerConfigured:    bundlerConfigured,
		PaymasterConfigured:  paymasterConfigured,
		SponsorshipReady:     entryPointConfigured && bundlerConfigured && paymasterConfigured,
	}

	encoded, err := json.Marshal(readiness)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) CreateSmartContractAccount(network string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	resolvedNetwork := resolveAppNetwork(network)
	ownerAddress, accountAddress, err := ethereum.CreateOrGetSmartAccount(context.Background(), db, resolvedNetwork)
	if err != nil {
		return "", err
	}

	payload := map[string]string{
		"ownerAddress":   ownerAddress,
		"accountAddress": accountAddress,
		"network":        resolvedNetwork,
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) GetSmartAccountCreationReadiness(network string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	resolvedNetwork := resolveAppNetwork(network)
	readiness, err := ethereum.CheckSmartAccountCreationReadiness(context.Background(), db, resolvedNetwork)
	if err != nil {
		return "", err
	}

	payload := SmartAccountCreationReadiness{
		Network:                   readiness.Network,
		OwnerAddress:              readiness.OwnerAddress,
		FactoryAddress:            readiness.FactoryAddress,
		EntryPointAddress:         readiness.EntryPointAddress,
		SmartAccountAddress:       readiness.SmartAccountAddress,
		SmartAccountExists:        readiness.SmartAccountExists,
		OwnerBalanceWei:           readiness.OwnerBalanceWei,
		OwnerRequiredMinGasWei:    readiness.OwnerRequiredMinGasWei,
		HasSufficientOwnerBalance: readiness.HasSufficientOwnerBalance,
		CanUseSponsoredCreate:     readiness.CanUseSponsoredCreate,
		IsReady:                   readiness.IsReady,
		FailureReasons:            readiness.FailureReasons,
		Warnings:                  readiness.Warnings,
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) GetSmartContractAccount(network string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	resolvedNetwork := resolveAppNetwork(network)
	ownerAddress, accountAddress, err := ethereum.GetSmartAccount(context.Background(), db, resolvedNetwork)
	if err != nil {
		return "", err
	}

	payload := map[string]string{
		"ownerAddress":   ownerAddress,
		"accountAddress": accountAddress,
		"network":        resolvedNetwork,
	}

	encoded, err := json.Marshal(payload)
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
	return w.SendToken(network, "usdc", destination, amount, note, providerID)
}

func (w *WalletCore) SendUsdcWithMode(network string, destination string, amount string, note string, providerID string, sendMode string) (string, error) {
	return w.SendTokenWithMode(network, "usdc", destination, amount, note, providerID, sendMode)
}

func (w *WalletCore) SendToken(network string, tokenIdentifier string, destination string, amount string, note string, providerID string) (string, error) {
	resultJSON, err := w.SendTokenWithMode(network, tokenIdentifier, destination, amount, note, providerID, ethereum.SendModeAuto)
	if err != nil {
		return "", err
	}

	var result SendOperationResult
	if err := json.Unmarshal([]byte(resultJSON), &result); err != nil {
		return "", err
	}

	if strings.TrimSpace(result.OperationHash) != "" {
		return result.OperationHash, nil
	}

	return result.TxHash, nil
}

func (w *WalletCore) SendTokenWithMode(network string, tokenIdentifier string, destination string, amount string, note string, providerID string, sendMode string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	result, err := ethereum.SendTokenWithMode(context.Background(), db, resolveAppNetwork(network), tokenIdentifier, destination, amount, note, providerID, sendMode)
	if err != nil {
		return "", err
	}

	out := SendOperationResult{
		OperationHash: result.OperationHash,
		UserOpHash:    result.UserOpHash,
		TxHash:        result.TxHash,
		Mode:          result.Mode,
		Sponsored:     result.Sponsored,
		Network:       result.Network,
		Token:         result.Token,
	}

	encoded, err := json.Marshal(out)
	if err != nil {
		return "", err
	}

	return string(encoded), nil
}

func (w *WalletCore) ListUsdcTransactions(network string, limit int, offset int) (string, error) {
	return w.ListTokenTransactions(network, "usdc", limit, offset)
}

func (w *WalletCore) ListTokenTransactions(network string, tokenIdentifier string, limit int, offset int) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	items, err := ethereum.ListTokenTransactions(context.Background(), db, resolveAppNetwork(network), tokenIdentifier, limit, offset)
	if err != nil {
		return "", err
	}

	out := make([]Transaction, 0, len(items))
	for _, item := range items {
		out = append(out, Transaction{
			Hash:            item.TxHash,
			UserOpHash:      item.UserOpHash,
			Chain:           item.Chain,
			Token:           item.Token,
			Amount:          item.Amount,
			Type:            TransactionType(item.TransactionType),
			State:           TransactionState(item.State),
			BundlerStatus:   item.BundlerStatus,
			Mode:            item.TxMode,
			SponsorshipMode: item.SponsorshipMode,
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

func (w *WalletCore) ListAllTransactions(network string, limit int, offset int) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	items, err := ethereum.ListAllTransactions(context.Background(), db, resolveAppNetwork(network), limit, offset)
	if err != nil {
		return "", err
	}

	out := make([]Transaction, 0, len(items))
	for _, item := range items {
		out = append(out, Transaction{
			Hash:            item.TxHash,
			UserOpHash:      item.UserOpHash,
			Chain:           item.Chain,
			Token:           item.Token,
			Amount:          item.Amount,
			Type:            TransactionType(item.TransactionType),
			State:           TransactionState(item.State),
			BundlerStatus:   item.BundlerStatus,
			Mode:            item.TxMode,
			SponsorshipMode: item.SponsorshipMode,
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

func resolveAppNetwork(network string) string {
	value := strings.TrimSpace(strings.ToLower(network))
	switch value {
	case "", "default":
		if strings.EqualFold(strings.TrimSpace(os.Getenv("POCKET_APP_ENV")), "production") {
			return "ethereum-mainnet"
		}
		return "ethereum-sepolia"
	case "mainnet", "ethereum-mainnet", "ethereum":
		return "ethereum-mainnet"
	case "testnet", "sepolia", "ethereum-sepolia":
		return "ethereum-sepolia"
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
