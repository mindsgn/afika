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
	"io"
	"math/big"
	"os"
	"strings"
	"sync"

	"github.com/ethereum/go-ethereum/common"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/ethereum"
)

var ErrNotInitialized = errors.New("wallet core is not initialized")
var ErrSmartAccountsDisabled = errors.New("smart account features are disabled in MVP v1")

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

type userOperationPayload struct {
	Sender               string `json:"sender"`
	Nonce                string `json:"nonce"`
	InitCode             string `json:"initCode"`
	CallData             string `json:"callData"`
	CallGasLimit         string `json:"callGasLimit"`
	VerificationGasLimit string `json:"verificationGasLimit"`
	PreVerificationGas   string `json:"preVerificationGas"`
	MaxFeePerGas         string `json:"maxFeePerGas"`
	MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas"`
	PaymasterAndData     string `json:"paymasterAndData"`
	Signature            string `json:"signature"`
}

type signUserOperationResponse struct {
	UserOperation userOperationPayload `json:"userOperation"`
	UserOpHash    string               `json:"userOpHash"`
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
	return "", ErrSmartAccountsDisabled
}

func (w *WalletCore) CreateSmartContractAccount(network string) (string, error) {
	return "", ErrSmartAccountsDisabled
}

func (w *WalletCore) GetSmartAccountCreationReadiness(network string) (string, error) {
	return "", ErrSmartAccountsDisabled
}

func (w *WalletCore) GetSmartContractAccount(network string) (string, error) {
	return "", ErrSmartAccountsDisabled
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
	resultJSON, err := w.SendTokenWithMode(network, tokenIdentifier, destination, amount, note, providerID, ethereum.SendModeDirect)
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

	if ethereum.ResolveSendMode(sendMode) == ethereum.SendModeSponsored {
		return "", ErrSmartAccountsDisabled
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

func (w *WalletCore) SignUserOperationPayload(network string, entryPointAddress string, userOperationJSON string) (string, error) {
	return "", ErrSmartAccountsDisabled
}

func (w *WalletCore) SyncInboundTransactions(network string) (string, error) {
	db, err := w.getDB()
	if err != nil {
		return "", err
	}

	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		return "", err
	}

	if len(wallets) == 0 {
		encoded, _ := json.Marshal(map[string]any{"synced": 0})
		return string(encoded), nil
	}

	resolvedNetwork := resolveAppNetwork(network)
	transfers, err := ethereum.FetchInboundTransfers(context.Background(), wallets[0].Address, resolvedNetwork)
	if err != nil {
		return "", err
	}

	synced := 0
	for _, tx := range transfers {
		if err := db.InsertTransactionIfMissing(context.Background(), tx); err == nil {
			synced++
		}
	}

	encoded, err := json.Marshal(map[string]any{"synced": synced})
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
		if strings.EqualFold(strings.TrimSpace(os.Getenv("EXPO_PUBLIC_POCKET_APP_ENV")), "production") {
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

func parseUserOperationPayload(payload userOperationPayload) (ethereum.UserOperation, error) {
	nonce, err := parseHexBig(payload.Nonce)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	callGasLimit, err := parseHexBig(payload.CallGasLimit)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	verificationGasLimit, err := parseHexBig(payload.VerificationGasLimit)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	preVerificationGas, err := parseHexBig(payload.PreVerificationGas)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	maxFeePerGas, err := parseHexBig(payload.MaxFeePerGas)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	maxPriorityFeePerGas, err := parseHexBig(payload.MaxPriorityFeePerGas)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	initCode, err := parseHexBytes(payload.InitCode)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	callData, err := parseHexBytes(payload.CallData)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	paymasterAndData, err := parseHexBytes(payload.PaymasterAndData)
	if err != nil {
		return ethereum.UserOperation{}, err
	}
	signature, err := parseHexBytes(payload.Signature)
	if err != nil {
		return ethereum.UserOperation{}, err
	}

	return ethereum.UserOperation{
		Sender:               common.HexToAddress(strings.TrimSpace(payload.Sender)),
		Nonce:                nonce,
		InitCode:             initCode,
		CallData:             callData,
		CallGasLimit:         callGasLimit,
		VerificationGasLimit: verificationGasLimit,
		PreVerificationGas:   preVerificationGas,
		MaxFeePerGas:         maxFeePerGas,
		MaxPriorityFeePerGas: maxPriorityFeePerGas,
		PaymasterAndData:     paymasterAndData,
		Signature:            signature,
	}, nil
}

func parseHexBig(value string) (*big.Int, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(value), "0x")
	if trimmed == "" {
		return big.NewInt(0), nil
	}
	parsed := new(big.Int)
	if _, ok := parsed.SetString(trimmed, 16); !ok {
		return nil, errors.New("invalid hex integer")
	}
	return parsed, nil
}

func parseHexBytes(value string) ([]byte, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(value), "0x")
	if trimmed == "" {
		return []byte{}, nil
	}
	decoded, err := hex.DecodeString(trimmed)
	if err != nil {
		return nil, err
	}
	return decoded, nil
}

func encodeHex(value []byte) string {
	if len(value) == 0 {
		return "0x"
	}
	return "0x" + hex.EncodeToString(value)
}
