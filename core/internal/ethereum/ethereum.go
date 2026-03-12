package ethereum

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TokenConfig struct {
	Identifier string `json:"identifier"`
	Symbol     string `json:"symbol"`
	Address    string `json:"address"`
	Decimals   int    `json:"decimals"`
	IsNative   bool   `json:"isNative"`
}

type TokenBalance struct {
	Identifier string `json:"identifier"`
	Symbol     string `json:"symbol"`
	Address    string `json:"address"`
	Decimals   int    `json:"decimals"`
	IsNative   bool   `json:"isNative"`
	Balance    string `json:"balance"`
}

type SendResult struct {
	TxHash  string `json:"txHash"`
	Mode    string `json:"mode"`
	Network string `json:"network"`
	Token   string `json:"token"`
}

// ---------------------------------------------------------------------------
// Constants & registries
// ---------------------------------------------------------------------------

const (
	NativeTokenIdentifier = "native"
	USDCIdentifier        = "usdc"
	USDCSymbol            = "USDC"
	USDCDecimals          = 6

	// erc20TransferTopic = keccak256("Transfer(address,address,uint256)")
	erc20TransferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
	// inboundSyncBlockDepth is the default look-back window for inbound scans.
	inboundSyncBlockDepth = uint64(10_000)
)

// tokenRegistry provides built-in token configs for well-known named networks.
var tokenRegistry = map[string][]TokenConfig{
	"ethereum-sepolia": {
		{Identifier: NativeTokenIdentifier, Symbol: "ETH", Address: "", Decimals: 18, IsNative: true},
		{Identifier: "usdc", Symbol: USDCSymbol, Address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", Decimals: USDCDecimals, IsNative: false},
	},
	"ethereum-mainnet": {
		{Identifier: NativeTokenIdentifier, Symbol: "ETH", Address: "", Decimals: 18, IsNative: true},
		{Identifier: "usdc", Symbol: USDCSymbol, Address: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", Decimals: USDCDecimals, IsNative: false},
	},
}

var erc20ABI = mustParseABI(`[{
	"constant":true,
	"inputs":[{"name":"account","type":"address"}],
	"name":"balanceOf",
	"outputs":[{"name":"","type":"uint256"}],
	"stateMutability":"view",
	"type":"function"
},{
	"constant":false,
	"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],
	"name":"transfer",
	"outputs":[{"name":"","type":"bool"}],
	"stateMutability":"nonpayable",
	"type":"function"
}]`)

func mustParseABI(value string) abi.ABI {
	parsed, err := abi.JSON(strings.NewReader(value))
	if err != nil {
		panic(err)
	}
	return parsed
}

// ---------------------------------------------------------------------------
// Wallet creation
// ---------------------------------------------------------------------------

// CreateNewEthereumWallet generates a fresh EOA key pair, persists it in db
// and returns the checksummed public address.
func CreateNewEthereumWallet(ctx context.Context, db *database.DB, name string) (string, error) {
	if db == nil {
		return "", errors.New("database is required")
	}

	newPrivateKey, err := crypto.GenerateKey()
	if err != nil {
		return "", err
	}

	privateKeyBytes := crypto.FromECDSA(newPrivateKey)
	publicKeyECDSA, ok := newPrivateKey.Public().(*ecdsa.PublicKey)
	if !ok {
		return "", errors.New("cannot assert publicKey type")
	}

	address := crypto.PubkeyToAddress(*publicKeyECDSA).Hex()
	if name == "" {
		name = "Ethereum"
	}

	if err := db.InsertWallet(ctx, "ethereum", name, address, privateKeyBytes); err != nil {
		return "", err
	}
	return address, nil
}

// ValidateAddress returns true when addr is a valid 20-byte hex Ethereum address.
func ValidateAddress(addr string) bool {
	return common.IsHexAddress(strings.TrimSpace(addr))
}

// SignMessage signs message using EIP-191 personal_sign convention and returns
// the 65-byte signature as a 0x-prefixed hex string.
func SignMessage(privateKeyBytes []byte, message string) (string, error) {
	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		return "", err
	}
	msgBytes := []byte(message)
	prefix := fmt.Sprintf("\x19Ethereum Signed Message:\n%d", len(msgBytes))
	hash := crypto.Keccak256Hash([]byte(prefix), msgBytes)
	sig, err := crypto.Sign(hash.Bytes(), privateKey)
	if err != nil {
		return "", err
	}
	// Adjust v: sig[64] is 0 or 1; EIP-191 expects 27 or 28
	sig[64] += 27
	return "0x" + fmt.Sprintf("%x", sig), nil
}

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

// GetTokenBalanceForAddress fetches the on-chain balance of a token at
// walletAddress using the given rpcURL. Pass the full TokenConfig so the
// caller decides which token list to use.
func GetTokenBalanceForAddress(ctx context.Context, walletAddress string, rpcURL string, token TokenConfig) (string, error) {
	if walletAddress == "" {
		return "", errors.New("wallet address is required")
	}
	if rpcURL == "" {
		return "", errors.New("rpcURL is required")
	}

	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return "", err
	}
	defer client.Close()

	ownerAddress := common.HexToAddress(walletAddress)
	if token.IsNative {
		bal, err := client.BalanceAt(ctx, ownerAddress, nil)
		if err != nil {
			return "", err
		}
		return formatTokenUnits(bal, token.Decimals), nil
	}

	tokenAddress := common.HexToAddress(token.Address)
	data, err := erc20ABI.Pack("balanceOf", ownerAddress)
	if err != nil {
		return "", err
	}
	result, err := client.CallContract(ctx, ethereum.CallMsg{To: &tokenAddress, Data: data}, nil)
	if err != nil {
		return "", err
	}
	out, err := erc20ABI.Unpack("balanceOf", result)
	if err != nil {
		return "", err
	}
	if len(out) != 1 {
		return "", errors.New("unexpected balanceOf response")
	}
	rawBalance, ok := out[0].(*big.Int)
	if !ok {
		return "", errors.New("invalid balance type")
	}
	return formatTokenUnits(rawBalance, token.Decimals), nil
}

// ---------------------------------------------------------------------------
// Send (direct EOA)
// ---------------------------------------------------------------------------

// SendToken sends tokenIdentifier from the first wallet in db to recipient
// using a direct EOA transaction. Returns the transaction hash on success.
func SendToken(
	ctx context.Context,
	db *database.DB,
	rpcURL string,
	chainID int64,
	network string,
	tokenIdentifier string,
	recipient string,
	amount string,
) (SendResult, error) {
	if db == nil {
		return SendResult{}, errors.New("database is required")
	}
	if rpcURL == "" {
		return SendResult{}, errors.New("rpcURL is required")
	}
	if !common.IsHexAddress(recipient) {
		return SendResult{}, errors.New("invalid recipient address")
	}

	tokens, _ := ListTokenConfigs(network)
	token, err := ResolveToken(tokens, tokenIdentifier)
	if err != nil {
		return SendResult{}, err
	}
	normalizedAmount := amount
	if isUSDCToken(token) {
		normalizedAmount, err = normalizeUSDCAmount(amount)
		if err != nil {
			return SendResult{}, err
		}
	}

	amountUnits, err := parseTokenAmount(amount, token.Decimals)
	if err != nil {
		return SendResult{}, err
	}
	if amountUnits.Sign() <= 0 {
		return SendResult{}, errors.New("amount must be greater than zero")
	}

	walletSecrets, err := db.ListWalletSecrets(ctx)
	if err != nil {
		return SendResult{}, err
	}
	if len(walletSecrets) == 0 {
		return SendResult{}, errors.New("no wallet found")
	}

	sender := walletSecrets[0]
	privateKey, err := crypto.ToECDSA(sender.PrivateKey)
	if err != nil {
		return SendResult{}, err
	}

	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return SendResult{}, err
	}
	defer client.Close()

	senderAddr := common.HexToAddress(sender.Address)
	nativeBalance, err := client.BalanceAt(ctx, senderAddr, nil)
	if err != nil {
		return SendResult{}, err
	}
	if nativeBalance.Cmp(minGasReserveWei(network)) < 0 {
		return SendResult{}, errors.New("insufficient native balance for gas")
	}

	nonce, err := client.PendingNonceAt(ctx, senderAddr)
	if err != nil {
		return SendResult{}, err
	}

	signer := types.NewEIP155Signer(big.NewInt(chainID))

	var signedTx *types.Transaction

	if token.IsNative {
		// Native ETH transfer
		gasPrice, err := client.SuggestGasPrice(ctx)
		if err != nil {
			return SendResult{}, err
		}
		recipientAddr := common.HexToAddress(recipient)
		tx := types.NewTransaction(nonce, recipientAddr, amountUnits, 21000, gasPrice, nil)
		signedTx, err = types.SignTx(tx, signer, privateKey)
		if err != nil {
			return SendResult{}, err
		}
	} else {
		// ERC-20 transfer
		tokenAddr := common.HexToAddress(token.Address)
		data, err := erc20ABI.Pack("transfer", common.HexToAddress(recipient), amountUnits)
		if err != nil {
			return SendResult{}, err
		}
		gasPrice, err := client.SuggestGasPrice(ctx)
		if err != nil {
			return SendResult{}, err
		}
		gasLimit, err := client.EstimateGas(ctx, ethereum.CallMsg{
			From: senderAddr, To: &tokenAddr, Data: data,
		})
		if err != nil {
			gasLimit = 80_000
		}
		tx := types.NewTransaction(nonce, tokenAddr, big.NewInt(0), gasLimit, gasPrice, data)
		signedTx, err = types.SignTx(tx, signer, privateKey)
		if err != nil {
			return SendResult{}, err
		}
	}

	if err := client.SendTransaction(ctx, signedTx); err != nil {
		return SendResult{}, err
	}

	txHash := signedTx.Hash().Hex()

	gasUsed := signedTx.Gas()
	feeWei := new(big.Int).Mul(signedTx.GasPrice(), big.NewInt(int64(gasUsed)))
	feeETH := formatTokenUnits(feeWei, 18)
	feeUSD := ""
	usdAmount := ""
	if ethUSD, err := fetchETHPriceUSD(ctx); err == nil && ethUSD > 0 {
		feeUSD = formatUSDFromString(feeETH, ethUSD)
		if token.IsNative {
			usdAmount = formatUSDFromString(amount, ethUSD)
		}
	}
	if isUSDCToken(token) {
		usdAmount = normalizedAmount
	}

	_ = db.InsertTransactionIfMissing(ctx, database.TransactionRecord{
		WalletAddress: sender.Address,
		TxHash:        txHash,
		FromAddress:   sender.Address,
		ToAddress:     recipient,
		TokenAddress:  token.Address,
		TokenSymbol:   token.Symbol,
		Amount:        normalizedAmount,
		FeeETH:        feeETH,
		FeeUSD:        feeUSD,
		USDAmount:     usdAmount,
		Network:       network,
		TxMode:        "direct",
		State:         "pending",
		Timestamp:     time.Now().Unix(),
	})

	return SendResult{TxHash: txHash, Mode: "direct", Network: network, Token: token.Symbol}, nil
}

// ---------------------------------------------------------------------------
// Transaction status sync
// ---------------------------------------------------------------------------

// SyncTransactionStatus looks up the on-chain receipt for txHash using rpcURL
// and returns "completed", "failed", or "pending".
func SyncTransactionStatus(ctx context.Context, txHash string, rpcURL string) (string, error) {
	if txHash == "" {
		return "", errors.New("transaction hash is required")
	}
	if rpcURL == "" {
		return "pending", nil
	}

	client, err := ethclient.DialContext(ctx, rpcURL)
	if err != nil {
		return "", err
	}
	defer client.Close()

	hash := common.HexToHash(txHash)
	receipt, err := client.TransactionReceipt(ctx, hash)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			return "pending", nil
		}
		return "", err
	}

	if receipt.Status == types.ReceiptStatusSuccessful {
		return "completed", nil
	}
	return "failed", nil
}

// ---------------------------------------------------------------------------
// Transaction listing
// ---------------------------------------------------------------------------

// ListTokenTransactions loads stored transactions for the given wallet and
// token, syncing any pending tx statuses against rpcURL (pass "" to skip sync).
func ListTokenTransactions(
	ctx context.Context,
	db *database.DB,
	walletAddress string,
	rpcURL string,
	network string,
	tokenIdentifier string,
	limit int,
	offset int,
) ([]database.TransactionRecord, error) {
	if db == nil {
		return nil, errors.New("database is required")
	}
	if walletAddress == "" {
		return nil, errors.New("walletAddress is required")
	}

	tokens, _ := ListTokenConfigs(network)
	token, err := ResolveToken(tokens, tokenIdentifier)
	if err != nil {
		return nil, err
	}

	txs, err := db.ListTransactions(ctx, walletAddress, token.Address, limit, offset)
	if err != nil {
		return nil, err
	}

	if rpcURL != "" {
		for idx, tx := range txs {
			if tx.State != "pending" {
				continue
			}
			status, err := SyncTransactionStatus(ctx, tx.TxHash, rpcURL)
			if err != nil {
				continue
			}
			if status != tx.State {
				_ = db.UpdateTransactionState(ctx, tx.TxHash, status)
				txs[idx].State = status
			}
		}
	}

	return txs, nil
}

// ListAllTransactions loads all stored transactions for walletAddress across
// all tokens, syncing pending statuses when rpcURL is provided.
func ListAllTransactions(
	ctx context.Context,
	db *database.DB,
	walletAddress string,
	rpcURL string,
	limit int,
	offset int,
) ([]database.TransactionRecord, error) {
	if db == nil {
		return nil, errors.New("database is required")
	}
	if walletAddress == "" {
		return nil, errors.New("walletAddress is required")
	}

	txs, err := db.ListAllTransactions(ctx, walletAddress, limit, offset)
	if err != nil {
		return nil, err
	}

	if rpcURL != "" {
		for idx, tx := range txs {
			if tx.State != "pending" {
				continue
			}
			status, err := SyncTransactionStatus(ctx, tx.TxHash, rpcURL)
			if err != nil {
				continue
			}
			if status != tx.State {
				_ = db.UpdateTransactionState(ctx, tx.TxHash, status)
				txs[idx].State = status
			}
		}
	}

	return txs, nil
}

// ---------------------------------------------------------------------------
// Inbound transfer sync
// ---------------------------------------------------------------------------

type inboundTransferClient interface {
	BlockNumber(ctx context.Context) (uint64, error)
	FilterLogs(ctx context.Context, q ethereum.FilterQuery) ([]types.Log, error)
	Close()
}

var dialInboundClient = func(ctx context.Context, url string) (inboundTransferClient, error) {
	return ethclient.DialContext(ctx, url)
}

type alchemyAssetTransfer struct {
	Hash  string  `json:"hash"`
	From  string  `json:"from"`
	To    string  `json:"to"`
	Value float64 `json:"value"`
	Asset string  `json:"asset"`
}

type alchemyTransfersResponse struct {
	Result *struct {
		Transfers []alchemyAssetTransfer `json:"transfers"`
	} `json:"result"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// FetchInboundTransfers fetches recent on-chain transfers received by
// walletAddress. Pass a token list; if nil, the built-in registry for
// network is used.
func FetchInboundTransfers(
	ctx context.Context,
	walletAddress string,
	rpcURL string,
	tokens []TokenConfig,
	network string,
) ([]database.TransactionRecord, error) {
	if strings.TrimSpace(walletAddress) == "" {
		return nil, errors.New("wallet address is required")
	}
	if !common.IsHexAddress(walletAddress) {
		return nil, errors.New("invalid wallet address")
	}
	if rpcURL == "" {
		return nil, errors.New("rpcURL is required")
	}

	if len(tokens) == 0 {
		tokens, _ = ListTokenConfigs(network)
	}
	ethUSD, _ := fetchETHPriceUSD(ctx)

	client, err := dialInboundClient(ctx, rpcURL)
	if err != nil {
		return nil, err
	}
	defer client.Close()

	latestBlock, err := client.BlockNumber(ctx)
	if err != nil {
		return nil, err
	}

	var fromBlock *big.Int
	if latestBlock > inboundSyncBlockDepth {
		fromBlock = new(big.Int).SetUint64(latestBlock - inboundSyncBlockDepth)
	} else {
		fromBlock = big.NewInt(0)
	}

	results := make([]database.TransactionRecord, 0)
	ownerAddr := common.HexToAddress(walletAddress)
	toTopic := common.BytesToHash(ownerAddr.Bytes())
	transferTopic := common.HexToHash(erc20TransferTopic)

	for _, token := range tokens {
		if token.IsNative {
			continue
		}

		query := ethereum.FilterQuery{
			Addresses: []common.Address{common.HexToAddress(token.Address)},
			Topics: [][]common.Hash{
				{transferTopic},
				{},
				{toTopic},
			},
			FromBlock: fromBlock,
		}

		logs, err := client.FilterLogs(ctx, query)
		if err != nil {
			continue
		}

		for _, l := range logs {
			if len(l.Topics) < 3 || len(l.Data) < 32 {
				continue
			}
			fromAddr := common.HexToAddress(l.Topics[1].Hex()).Hex()
			rawAmount := new(big.Int).SetBytes(l.Data[:32])
			amount := formatTokenUnits(rawAmount, token.Decimals)
			usdAmount := ""
			if isUSDCToken(token) {
				if normalized, err := normalizeUSDCAmount(amount); err == nil {
					usdAmount = normalized
				}
			}

			results = append(results, database.TransactionRecord{
				TxHash:        l.TxHash.Hex(),
				WalletAddress: walletAddress,
				FromAddress:   fromAddr,
				ToAddress:     walletAddress,
				TokenAddress:  token.Address,
				TokenSymbol:   token.Symbol,
				Amount:        amount,
				USDAmount:     usdAmount,
				Network:       network,
				TxMode:        "external",
				State:         "completed",
				BlockNumber:   l.BlockNumber,
				Timestamp:     time.Now().Unix(),
			})
		}
	}

	// Attempt native ETH inbound via alchemy_getAssetTransfers (silently skipped
	// when the provider does not support the method).
	if ethRecs, err := fetchNativeInboundViaAlchemy(ctx, rpcURL, walletAddress, fromBlock, latestBlock, network, ethUSD); err == nil {
		results = append(results, ethRecs...)
	}

	return results, nil
}

func fetchNativeInboundViaAlchemy(
	ctx context.Context,
	rpcURL string,
	walletAddress string,
	fromBlock *big.Int,
	toBlock uint64,
	network string,
	ethUSD float64,
) ([]database.TransactionRecord, error) {
	payload, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "alchemy_getAssetTransfers",
		"params": []any{map[string]any{
			"fromBlock":        "0x" + fromBlock.Text(16),
			"toBlock":          fmt.Sprintf("0x%x", toBlock),
			"toAddress":        walletAddress,
			"category":         []string{"external"},
			"excludeZeroValue": true,
			"maxCount":         "0x64",
		}},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var parsed alchemyTransfersResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if parsed.Error != nil || parsed.Result == nil {
		return nil, nil
	}

	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	records := make([]database.TransactionRecord, 0, len(parsed.Result.Transfers))
	for _, t := range parsed.Result.Transfers {
		if !strings.EqualFold(t.To, walletAddress) {
			continue
		}
		weiFloat := new(big.Float).Mul(big.NewFloat(t.Value), new(big.Float).SetInt(scale))
		weiInt, _ := weiFloat.Int(nil)
		amount := formatTokenUnits(weiInt, 18)
		usdAmount := ""
		if ethUSD > 0 {
			usdAmount = formatUSDFromString(amount, ethUSD)
		}

		records = append(records, database.TransactionRecord{
			TxHash:        t.Hash,
			WalletAddress: walletAddress,
			FromAddress:   t.From,
			ToAddress:     walletAddress,
			TokenAddress:  "",
			TokenSymbol:   "ETH",
			Amount:        amount,
			USDAmount:     usdAmount,
			Network:       network,
			TxMode:        "external",
			State:         "completed",
			Timestamp:     time.Now().Unix(),
		})
	}
	return records, nil
}

// ---------------------------------------------------------------------------
// Token registry helpers
// ---------------------------------------------------------------------------

// ListTokenConfigs returns the built-in token list for a named network.
func ListTokenConfigs(network string) ([]TokenConfig, error) {
	networkKey := strings.ToLower(strings.TrimSpace(network))
	tokens, ok := tokenRegistry[networkKey]
	if !ok {
		// Return native ETH only as a safe fallback for unknown networks.
		return []TokenConfig{{Identifier: NativeTokenIdentifier, Symbol: "ETH", Decimals: 18, IsNative: true}}, nil
	}
	result := make([]TokenConfig, len(tokens))
	copy(result, tokens)
	return result, nil
}

// ResolveToken finds a token in the given list by identifier, symbol or address.
func ResolveToken(tokens []TokenConfig, identifier string) (TokenConfig, error) {
	key := strings.ToLower(strings.TrimSpace(identifier))
	if key == "" {
		key = NativeTokenIdentifier
	}
	for _, t := range tokens {
		if strings.EqualFold(t.Identifier, key) ||
			strings.EqualFold(t.Symbol, key) ||
			(!t.IsNative && strings.EqualFold(t.Address, key)) {
			return t, nil
		}
	}
	return TokenConfig{}, fmt.Errorf("token %q not found in token list", identifier)
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

func minGasReserveWei(network string) *big.Int {
	switch strings.ToLower(strings.TrimSpace(network)) {
	case "ethereum-mainnet":
		return new(big.Int).SetUint64(50_000_000_000_000) // 0.00005 ETH
	case "ethereum-sepolia":
		return new(big.Int).SetUint64(10_000_000_000_000) // 0.00001 ETH
	default:
		return new(big.Int).SetUint64(2_000_000_000_000_000) // 0.002 ETH
	}
}

func formatTokenUnits(amount *big.Int, decimals int) string {
	if amount == nil {
		return "0"
	}
	if decimals <= 0 {
		return amount.String()
	}
	denominator := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	r := new(big.Rat).SetFrac(amount, denominator)
	s := r.FloatString(decimals)
	for strings.Contains(s, ".") && strings.HasSuffix(s, "0") {
		s = strings.TrimSuffix(s, "0")
	}
	s = strings.TrimSuffix(s, ".")
	if s == "" {
		return "0"
	}
	return s
}

func parseTokenAmount(value string, decimals int) (*big.Int, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, errors.New("amount is required")
	}
	r, ok := new(big.Rat).SetString(value)
	if !ok {
		return nil, errors.New("invalid amount")
	}
	if r.Sign() <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	scaled := new(big.Rat).Mul(r, new(big.Rat).SetInt(scale))
	if !scaled.IsInt() {
		return nil, errors.New("amount precision is too high")
	}
	return scaled.Num(), nil
}

type coinGeckoPriceResponse struct {
	Ethereum struct {
		USD float64 `json:"usd"`
	} `json:"ethereum"`
}

func fetchETHPriceUSD(ctx context.Context) (float64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", nil)
	if err != nil {
		return 0, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	var parsed coinGeckoPriceResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return 0, err
	}
	return parsed.Ethereum.USD, nil
}

// FetchETHPriceUSD returns the current ETH price in USD.
func FetchETHPriceUSD(ctx context.Context) (float64, error) {
	return fetchETHPriceUSD(ctx)
}

func formatUSD(value float64) string {
	if value <= 0 {
		return ""
	}
	s := fmt.Sprintf("%.6f", value)
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	if s == "" {
		return "0"
	}
	return s
}

func formatUSDFromString(amount string, price float64) string {
	if price <= 0 {
		return ""
	}
	var val float64
	if _, err := fmt.Sscanf(amount, "%f", &val); err != nil {
		return ""
	}
	return formatUSD(val * price)
}

// FormatUSDFromString multiplies a decimal-string amount by a USD price.
func FormatUSDFromString(amount string, price float64) string {
	return formatUSDFromString(amount, price)
}

func formatUSDValue(amount string) string {
	r, ok := new(big.Rat).SetString(strings.TrimSpace(amount))
	if !ok {
		return ""
	}
	s := r.FloatString(6)
	for strings.Contains(s, ".") && strings.HasSuffix(s, "0") {
		s = strings.TrimSuffix(s, "0")
	}
	s = strings.TrimSuffix(s, ".")
	if s == "" {
		return "0"
	}
	return s
}

// FormatUSDValue normalizes a decimal USD amount string to trimmed 6 decimals.
func FormatUSDValue(amount string) string {
	return formatUSDValue(amount)
}

func normalizeUSDCAmount(amount string) (string, error) {
	units, err := parseTokenAmount(amount, USDCDecimals)
	if err != nil {
		return "", err
	}
	denom := new(big.Int).Exp(big.NewInt(10), big.NewInt(USDCDecimals), nil)
	r := new(big.Rat).SetFrac(units, denom)
	return r.FloatString(USDCDecimals), nil
}

func isUSDCToken(token TokenConfig) bool {
	return strings.EqualFold(token.Symbol, USDCSymbol) || strings.EqualFold(token.Identifier, USDCIdentifier)
}
