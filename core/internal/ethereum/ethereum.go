package ethereum

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/config"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/logs"
)

type Wallet struct {
	Address      string  `json:"address"`
	Blockchain   string  `json:"blockchain"`
	BlockchainId string  `json:"blockchainId"`
	Decimals     uint    `json:"decimals"`
	Currency     string  `json:"currency"`
	FiatBalance  float64 `json:"fiatBalances"`
}

type Wallets struct {
	TotalFiat float64  `json:"totalFiat"`
	Currency  string   `json:"currency"`
	Wallets   []Wallet `json:"wallets"`
}

type Contract struct {
	Address      string `json:"address"`
	Blockchain   string `json:"blockchain"`
	BlockchainId string `json:"blockchainId"`
	Decimals     uint   `json:"decimals"`
}

type MarketData struct {
	Data struct {
		MarketCap         float64    `json:"market_cap"`
		MarketCapDiluted  float64    `json:"market_cap_diluted"`
		Liquidity         float64    `json:"liquidity"`
		Price             float64    `json:"price"`
		OffChainVolume    float64    `json:"off_chain_volume"`
		Volume            float64    `json:"volume"`
		VolumeChange24h   float64    `json:"volume_change_24h"`
		Volume7d          float64    `json:"volume_7d"`
		IsListed          bool       `json:"is_listed"`
		PriceChange24h    float64    `json:"price_change_24h"`
		PriceChange1h     float64    `json:"price_change_1h"`
		PriceChange7d     float64    `json:"price_change_7d"`
		PriceChange1m     float64    `json:"price_change_1m"`
		PriceChange1y     float64    `json:"price_change_1y"`
		Ath               float64    `json:"ath"`
		Atl               float64    `json:"atl"`
		Name              string     `json:"name"`
		Symbol            string     `json:"symbol"`
		Logo              string     `json:"logo"`
		Rank              int        `json:"rank"`
		Contracts         []Contract `json:"contracts"`
		TotalSupply       string     `json:"total_supply"`
		CirculatingSupply string     `json:"circulating_supply"`
	} `json:"data"`
}

type networkDetails struct {
	Name       string   `json:"name"`
	ChainID    int      `json:"chainID"`
	ChainIDHex string   `json:"ChainIDHex"`
	Currency   string   `json:"currency"`
	Mainnet    bool     `json:"mainnet"`
	RPC        []string `json:"rpc"`
}

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

type AccountSnapshot struct {
	OwnerAddress   string         `json:"ownerAddress"`
	AccountAddress string         `json:"accountAddress"`
	Network        string         `json:"network"`
	Balances       []TokenBalance `json:"balances"`
}

type SendResult struct {
	OperationHash string `json:"operationHash"`
	UserOpHash    string `json:"userOpHash"`
	TxHash        string `json:"txHash"`
	Mode          string `json:"mode"`
	Sponsored     bool   `json:"sponsored"`
	Network       string `json:"network"`
	Token         string `json:"token"`
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

var NetworkMainnetList []string = []string{
	"ethereum-mainnet",
}

var NetworkTestnetList []string = []string{
	"ethereum-sepolia",
}

type balanceClient interface {
	BalanceAt(ctx context.Context, account common.Address, blockNumber *big.Int) (*big.Int, error)
	Close()
}

var dialClient = func(url string) (balanceClient, error) {
	return ethclient.Dial(url)
}

var fetchMarketData = GetData

var dialEthereumClient = func(ctx context.Context, url string) (*ethclient.Client, error) {
	return ethclient.DialContext(ctx, url)
}

var clientChainID = func(ctx context.Context, client *ethclient.Client) (*big.Int, error) {
	return client.ChainID(ctx)
}

var clientCodeAt = func(ctx context.Context, client *ethclient.Client, address common.Address) ([]byte, error) {
	return client.CodeAt(ctx, address, nil)
}

var clientBalanceAt = func(ctx context.Context, client *ethclient.Client, address common.Address) (*big.Int, error) {
	return client.BalanceAt(ctx, address, nil)
}

const (
	NativeTokenIdentifier = "native"
	USDCSymbol            = "USDC"
	USDCDecimals          = 6
)

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

var smartAccountABI = mustParseABI(`[{
	"inputs":[{"internalType":"address","name":"target","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"bytes","name":"data","type":"bytes"}],
	"name":"execute",
	"outputs":[{"internalType":"bytes","name":"","type":"bytes"}],
	"stateMutability":"nonpayable",
	"type":"function"
}]`)

var entryPointABI = mustParseABI(`[{ 
	"inputs":[{"internalType":"address","name":"sender","type":"address"},{"internalType":"uint192","name":"key","type":"uint192"}],
	"name":"getNonce",
	"outputs":[{"internalType":"uint256","name":"nonce","type":"uint256"}],
	"stateMutability":"view",
	"type":"function"
}]`)

func mustParseABI(value string) abi.ABI {
	parsed, err := abi.JSON(strings.NewReader(value))
	if err != nil {
		panic(err)
	}
	return parsed
}

func ConvertBody(body []byte) (MarketData, error) {
	var data MarketData
	err := json.Unmarshal(body, &data)
	if err != nil {
		return data, err
	}
	return data, nil
}

func GetTotalBalance(ctx context.Context, db *database.DB, network string) (Wallets, error) {
	if db == nil {
		return Wallets{}, fmt.Errorf("database is required")
	}

	total := float64(0)
	var userWallet Wallets
	wallets, err := db.ListWallets(ctx)
	if err != nil {
		return Wallets{}, err
	}

	var networkList []string
	if network == "mainnet" {
		networkList = NetworkMainnetList
	} else {
		networkList = NetworkTestnetList
	}

	for _, networkName := range networkList {
		details := GetNetwork(networkName)
		if len(details.RPC) == 0 {
			continue
		}

		client, err := dialClient(details.RPC[0])
		if err != nil {
			return Wallets{}, err
		}

		data, err := fetchMarketData(details.Name)
		if err != nil {
			client.Close()
			return Wallets{}, err
		}

		for _, wallet := range wallets {
			account := common.HexToAddress(wallet.Address)
			balance, err := client.BalanceAt(ctx, account, nil)
			if err != nil {
				client.Close()
				return Wallets{}, err
			}

			fbalance := new(big.Float)
			fbalance.SetString(balance.String())
			ethValue := new(big.Float).Quo(fbalance, big.NewFloat(math.Pow10(18)))

			price := ethValue.String()
			cryptoBalance, err := strconv.ParseFloat(price, 64)
			if err != nil {
				client.Close()
				return Wallets{}, err
			}

			total += data.Data.Price * cryptoBalance

			walletData := Wallet{
				Address:      wallet.Address,
				Blockchain:   details.Name,
				BlockchainId: fmt.Sprintf("%d", details.ChainID),
				Decimals:     18,
				Currency:     "USD",
				FiatBalance:  cryptoBalance * data.Data.Price,
			}

			userWallet.Wallets = append(userWallet.Wallets, walletData)
		}

		client.Close()
	}

	userWallet.TotalFiat = total
	userWallet.Currency = "USD"

	return userWallet, nil
}

func CreateNewEthereumWallet(ctx context.Context, db *database.DB, name string) (string, error) {
	if db == nil {
		return "", fmt.Errorf("database is required")
	}

	newPrivateKey, err := crypto.GenerateKey()
	if err != nil {
		return "", err
	}

	privateKeyBytes := crypto.FromECDSA(newPrivateKey)
	publicKey := newPrivateKey.Public()

	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return "", fmt.Errorf("cannot assert type: publicKey is not of type *ecdsa.PublicKey")
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

func CreateOrGetSmartAccount(ctx context.Context, db *database.DB, network string) (string, string, error) {
	if db == nil {
		return "", "", errors.New("database is required")
	}

	walletSecrets, err := db.ListWalletSecrets(ctx)
	if err != nil {
		return "", "", err
	}
	if len(walletSecrets) == 0 {
		return "", "", errors.New("no wallet found")
	}

	owner := walletSecrets[0]
	if !common.IsHexAddress(owner.Address) {
		return "", "", errors.New("invalid owner address")
	}
	ownerAddress := common.HexToAddress(owner.Address)

	existing, err := db.FindSmartAccountByOwnerNetwork(ctx, owner.Address, network)
	if err == nil && common.IsHexAddress(existing.Address) {
		return owner.Address, existing.Address, nil
	}
	if err != nil && !strings.Contains(strings.ToLower(err.Error()), "no rows") {
		return "", "", err
	}

	readiness, err := CheckSmartAccountCreationReadiness(ctx, db, network)
	if err != nil {
		return "", "", err
	}
	if readiness.SmartAccountExists && common.IsHexAddress(readiness.SmartAccountAddress) {
		if upsertErr := db.UpsertSmartAccount(ctx, owner.Address, network, readiness.SmartAccountAddress); upsertErr != nil {
			return "", "", upsertErr
		}
		return owner.Address, readiness.SmartAccountAddress, nil
	}

	deployment, err := config.GetDeployment(network)
	if err != nil {
		return "", "", err
	}
	if !common.IsHexAddress(deployment.FactoryAddress) {
		return "", "", errors.New("invalid factory address in deployment config")
	}

	networkConfig := GetNetwork(network)
	if len(networkConfig.RPC) == 0 {
		return "", "", fmt.Errorf("unsupported network: %s", network)
	}

	client, err := dialEthereumClient(ctx, networkConfig.RPC[0])
	if err != nil {
		return "", "", err
	}
	defer client.Close()

	factory, err := NewFactory(common.HexToAddress(deployment.FactoryAddress), client)
	if err != nil {
		return "", "", err
	}

	predicted := common.HexToAddress(readiness.SmartAccountAddress)
	if predicted == (common.Address{}) {
		predicted, err = factory.GetAddress(&bind.CallOpts{Context: ctx}, ownerAddress)
		if err != nil {
			return "", "", err
		}
	}

	if !readiness.CanUseSponsoredCreate && !readiness.HasSufficientOwnerBalance {
		return "", "", fmt.Errorf("wallet creation blocked: insufficient owner gas and sponsorship unavailable; fund owner wallet with at least %s wei", readiness.OwnerRequiredMinGasWei)
	}

	privateKey, err := crypto.ToECDSA(owner.PrivateKey)
	if err != nil {
		return "", "", err
	}

	if readiness.CanUseSponsoredCreate {
		if userOpHash, createErr := createSmartAccountViaUserOperation(ctx, db, client, network, networkConfig, deployment, owner, ownerAddress, predicted, privateKey); createErr == nil {
			if upsertErr := db.UpsertSmartAccount(ctx, owner.Address, network, predicted.Hex()); upsertErr != nil {
				return "", "", upsertErr
			}
			return owner.Address, predicted.Hex(), nil
		} else if !readiness.HasSufficientOwnerBalance {
			return "", "", fmt.Errorf("wallet creation blocked: sponsored deployment failed and owner wallet has insufficient gas (%s wei required): %w", readiness.OwnerRequiredMinGasWei, createErr)
		} else {
			_ = userOpHash
		}
	}

	code, err := clientCodeAt(ctx, client, predicted)
	if err != nil {
		return "", "", err
	}
	if len(code) > 0 {
		if err := db.UpsertSmartAccount(ctx, owner.Address, network, predicted.Hex()); err != nil {
			return "", "", err
		}
		return owner.Address, predicted.Hex(), nil
	}

	chainID := big.NewInt(int64(networkConfig.ChainID))
	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return "", "", err
	}
	auth.Context = ctx

	if readiness.EntryPointAddress != "" {
		if _, err := factory.CreateAccountWithEntryPoint(auth, ownerAddress, common.HexToAddress(readiness.EntryPointAddress)); err != nil {
			return "", "", err
		}
	} else if _, err := factory.CreateAccount(auth, ownerAddress); err != nil {
		return "", "", err
	}

	if err := db.UpsertSmartAccount(ctx, owner.Address, network, predicted.Hex()); err != nil {
		return "", "", err
	}

	return owner.Address, predicted.Hex(), nil
}

func CheckSmartAccountCreationReadiness(ctx context.Context, db *database.DB, network string) (SmartAccountCreationReadiness, error) {
	result := SmartAccountCreationReadiness{
		Network:        network,
		FailureReasons: []string{},
		Warnings:       []string{},
	}

	if db == nil {
		return result, errors.New("database is required")
	}

	walletSecrets, err := db.ListWalletSecrets(ctx)
	if err != nil {
		return result, err
	}
	if len(walletSecrets) == 0 {
		result.FailureReasons = append(result.FailureReasons, "owner_wallet_missing")
		return result, errors.New("no wallet found")
	}

	owner := walletSecrets[0]
	result.OwnerAddress = owner.Address
	if !common.IsHexAddress(owner.Address) {
		result.FailureReasons = append(result.FailureReasons, "owner_wallet_invalid")
		return result, errors.New("invalid owner address")
	}

	networkConfig := GetNetwork(network)
	if len(networkConfig.RPC) == 0 {
		result.FailureReasons = append(result.FailureReasons, "network_unsupported")
		return result, fmt.Errorf("unsupported network: %s", network)
	}

	deployment, err := config.GetDeployment(network)
	if err != nil {
		result.FailureReasons = append(result.FailureReasons, "deployment_missing")
		return result, err
	}
	result.FactoryAddress = deployment.FactoryAddress

	entryPoint := strings.TrimSpace(deployment.EntryPointAddress)
	if common.IsHexAddress(entryPoint) {
		result.EntryPointAddress = common.HexToAddress(entryPoint).Hex()
	}

	if !common.IsHexAddress(deployment.FactoryAddress) {
		result.FailureReasons = append(result.FailureReasons, "factory_address_invalid")
		result.IsReady = false
		return result, nil
	}

	client, err := dialEthereumClient(ctx, networkConfig.RPC[0])
	if err != nil {
		result.FailureReasons = append(result.FailureReasons, "rpc_unreachable")
		result.IsReady = false
		return result, nil
	}
	defer client.Close()

	if _, err := clientChainID(ctx, client); err != nil {
		result.FailureReasons = append(result.FailureReasons, "rpc_chainid_unavailable")
		result.IsReady = false
		return result, nil
	}

	factoryAddress := common.HexToAddress(deployment.FactoryAddress)
	factoryCode, err := clientCodeAt(ctx, client, factoryAddress)
	if err != nil {
		result.FailureReasons = append(result.FailureReasons, "factory_check_failed")
		result.IsReady = false
		return result, nil
	}
	if len(factoryCode) == 0 {
		result.FailureReasons = append(result.FailureReasons, "factory_not_deployed")
	}

	factory, err := NewFactory(factoryAddress, client)
	if err != nil {
		result.FailureReasons = append(result.FailureReasons, "factory_bind_failed")
		result.IsReady = false
		return result, nil
	}

	ownerAddress := common.HexToAddress(owner.Address)
	predicted := common.Address{}
	if result.EntryPointAddress != "" {
		predicted, err = factory.GetAddressWithEntryPoint(&bind.CallOpts{Context: ctx}, ownerAddress, common.HexToAddress(result.EntryPointAddress))
		if err != nil {
			result.Warnings = append(result.Warnings, "entrypoint_prediction_failed_fallback_legacy")
			predicted, err = factory.GetAddress(&bind.CallOpts{Context: ctx}, ownerAddress)
		}
	} else {
		predicted, err = factory.GetAddress(&bind.CallOpts{Context: ctx}, ownerAddress)
	}
	if err != nil {
		result.FailureReasons = append(result.FailureReasons, "smart_account_prediction_failed")
		result.IsReady = false
		return result, nil
	}

	result.SmartAccountAddress = predicted.Hex()
	code, err := clientCodeAt(ctx, client, predicted)
	if err != nil {
		result.FailureReasons = append(result.FailureReasons, "smart_account_code_check_failed")
		result.IsReady = false
		return result, nil
	}
	result.SmartAccountExists = len(code) > 0

	minGas := config.GetOwnerCreationMinGasWei(network)
	result.OwnerRequiredMinGasWei = minGas.String()
	ownerBalance, err := clientBalanceAt(ctx, client, ownerAddress)
	if err != nil {
		result.FailureReasons = append(result.FailureReasons, "owner_balance_check_failed")
		result.IsReady = false
		return result, nil
	}
	result.OwnerBalanceWei = ownerBalance.String()
	result.HasSufficientOwnerBalance = ownerBalance.Cmp(minGas) >= 0
	if !result.HasSufficientOwnerBalance {
		result.FailureReasons = append(result.FailureReasons, "owner_insufficient_native_gas")
	}

	if aaDeployment, aaErr := config.ValidateAAConfig(network, true); aaErr == nil {
		policy := LoadPaymasterPolicy(network)
		hasSigner := strings.TrimSpace(getPaymasterSignerPrivateKey(network)) != ""
		if !hasSigner {
			result.Warnings = append(result.Warnings, "paymaster_signer_missing")
		}
		result.CanUseSponsoredCreate = strings.TrimSpace(aaDeployment.BundlerURL) != "" && common.IsHexAddress(aaDeployment.EntryPointAddress) && common.IsHexAddress(aaDeployment.PaymasterAddress) && policy.Enabled && hasSigner
	} else {
		result.Warnings = append(result.Warnings, "sponsored_creation_unavailable")
	}

	result.IsReady = result.SmartAccountExists || result.CanUseSponsoredCreate || result.HasSufficientOwnerBalance
	return result, nil
}

func GetSmartAccount(ctx context.Context, db *database.DB, network string) (string, string, error) {
	if db == nil {
		return "", "", errors.New("database is required")
	}

	wallets, err := db.ListWallets(ctx)
	if err != nil {
		return "", "", err
	}
	if len(wallets) == 0 {
		return "", "", errors.New("no wallet found")
	}

	ownerAddress := wallets[0].Address
	record, err := db.FindSmartAccountByOwnerNetwork(ctx, ownerAddress, network)
	if err != nil {
		return ownerAddress, "", err
	}

	return ownerAddress, record.Address, nil
}

func GetUSDCBalance(ctx context.Context, db *database.DB, network string) (string, string, error) {
	if db == nil {
		return "", "", errors.New("database is required")
	}

	wallets, err := db.ListWallets(ctx)
	if err != nil {
		return "", "", err
	}
	if len(wallets) == 0 {
		return "0", "", nil
	}

	walletAddress := wallets[0].Address
	balance, err := GetTokenBalanceForAddress(ctx, walletAddress, network, "usdc")
	if err != nil {
		return "", "", err
	}

	return balance, walletAddress, nil
}

func GetTokenBalanceForAddress(ctx context.Context, walletAddress string, network string, tokenIdentifier string) (string, error) {
	if walletAddress == "" {
		return "", errors.New("wallet address is required")
	}
	token, err := resolveToken(network, tokenIdentifier)
	if err != nil {
		return "", err
	}

	networkConfig := GetNetwork(network)
	if len(networkConfig.RPC) == 0 {
		return "", fmt.Errorf("unsupported network: %s", network)
	}

	client, err := ethclient.DialContext(ctx, networkConfig.RPC[0])
	if err != nil {
		return "", err
	}
	defer client.Close()

	ownerAddress := common.HexToAddress(walletAddress)
	if token.IsNative {
		nativeBalance, err := client.BalanceAt(ctx, ownerAddress, nil)
		if err != nil {
			return "", err
		}
		return formatTokenUnits(nativeBalance, token.Decimals), nil
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

func GetUSDCBalanceForAddress(ctx context.Context, walletAddress string, network string) (string, error) {
	return GetTokenBalanceForAddress(ctx, walletAddress, network, "usdc")
}

func GetAccountSnapshot(ctx context.Context, db *database.DB, network string) (AccountSnapshot, error) {
	if db == nil {
		return AccountSnapshot{}, errors.New("database is required")
	}

	ownerAddress, accountAddress, err := GetSmartAccount(ctx, db, network)
	if err != nil {
		return AccountSnapshot{}, err
	}
	if !common.IsHexAddress(accountAddress) {
		return AccountSnapshot{}, errors.New("smart account not initialized")
	}

	tokens := tokenRegistry[strings.ToLower(strings.TrimSpace(network))]
	balances := make([]TokenBalance, 0, len(tokens))
	for _, token := range tokens {
		balance, err := GetTokenBalanceForAddress(ctx, accountAddress, network, token.Identifier)
		if err != nil {
			return AccountSnapshot{}, err
		}
		balances = append(balances, TokenBalance{
			Identifier: token.Identifier,
			Symbol:     token.Symbol,
			Address:    token.Address,
			Decimals:   token.Decimals,
			IsNative:   token.IsNative,
			Balance:    balance,
		})
	}

	return AccountSnapshot{
		OwnerAddress:   ownerAddress,
		AccountAddress: accountAddress,
		Network:        network,
		Balances:       balances,
	}, nil
}

func SendUSDC(
	ctx context.Context,
	db *database.DB,
	network string,
	recipientAddress string,
	amount string,
	note string,
	providerID string,
) (string, error) {
	return SendToken(ctx, db, network, "usdc", recipientAddress, amount, note, providerID)
}

func SendToken(
	ctx context.Context,
	db *database.DB,
	network string,
	tokenIdentifier string,
	recipientAddress string,
	amount string,
	note string,
	providerID string,
) (string, error) {
	result, err := SendTokenWithMode(ctx, db, network, tokenIdentifier, recipientAddress, amount, note, providerID, SendModeAuto)
	if err != nil {
		return "", err
	}
	if result.OperationHash != "" {
		return result.OperationHash, nil
	}
	return result.TxHash, nil
}

func SendTokenWithMode(
	ctx context.Context,
	db *database.DB,
	network string,
	tokenIdentifier string,
	recipientAddress string,
	amount string,
	note string,
	providerID string,
	sendMode string,
) (SendResult, error) {
	if db == nil {
		return SendResult{}, errors.New("database is required")
	}
	if recipientAddress == "" {
		return SendResult{}, errors.New("recipient address is required")
	}
	if !common.IsHexAddress(recipientAddress) {
		return SendResult{}, errors.New("invalid recipient address")
	}
	token, err := resolveToken(network, tokenIdentifier)
	if err != nil {
		return SendResult{}, err
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
	if !common.IsHexAddress(sender.Address) {
		return SendResult{}, errors.New("invalid sender address")
	}

	record, err := db.FindSmartAccountByOwnerNetwork(ctx, sender.Address, network)
	if err != nil {
		return SendResult{}, errors.New("smart account not found for sender")
	}
	if !common.IsHexAddress(record.Address) {
		return SendResult{}, errors.New("invalid smart account address")
	}
	senderSmartAccount := record.Address

	currentBalance, err := GetTokenBalanceForAddress(ctx, senderSmartAccount, network, token.Identifier)
	if err != nil {
		return SendResult{}, err
	}
	currentBalanceUnits, err := parseTokenAmount(currentBalance, token.Decimals)
	if err != nil {
		return SendResult{}, err
	}
	if currentBalanceUnits.Cmp(amountUnits) < 0 {
		return SendResult{}, fmt.Errorf("insufficient %s balance", token.Symbol)
	}

	networkConfig := GetNetwork(network)
	if len(networkConfig.RPC) == 0 {
		return SendResult{}, fmt.Errorf("unsupported network: %s", network)
	}

	client, err := ethclient.DialContext(ctx, networkConfig.RPC[0])
	if err != nil {
		return SendResult{}, err
	}
	defer client.Close()

	privateKey, err := crypto.ToECDSA(sender.PrivateKey)
	if err != nil {
		return SendResult{}, err
	}

	recipient := common.HexToAddress(recipientAddress)
	smartAccount := common.HexToAddress(senderSmartAccount)

	target := recipient
	value := amountUnits
	executeData := []byte{}
	if !token.IsNative {
		target = common.HexToAddress(token.Address)
		value = big.NewInt(0)
		executeData, err = erc20ABI.Pack("transfer", recipient, amountUnits)
		if err != nil {
			return SendResult{}, err
		}
	}

	callData, err := smartAccountABI.Pack("execute", target, value, executeData)
	if err != nil {
		return SendResult{}, err
	}

	mode := ResolveSendMode(sendMode)
	if mode != SendModeDirect {
		aaResult, aaErr := sendTokenViaUserOperation(ctx, db, client, network, networkConfig, sender, smartAccount, recipientAddress, token, amountUnits, callData, note, providerID, mode, privateKey)
		if aaErr == nil {
			return aaResult, nil
		}
		if mode == SendModeSponsored {
			return SendResult{}, aaErr
		}
	}

	directResult, err := sendTokenDirect(ctx, db, client, network, networkConfig, sender, smartAccount, recipientAddress, token, amountUnits, callData, note, providerID, privateKey)
	if err != nil {
		return SendResult{}, err
	}

	return directResult, nil
}

func sendTokenDirect(
	ctx context.Context,
	db *database.DB,
	client *ethclient.Client,
	network string,
	networkConfig networkDetails,
	sender database.WalletSecret,
	smartAccount common.Address,
	recipientAddress string,
	token TokenConfig,
	amountUnits *big.Int,
	callData []byte,
	note string,
	providerID string,
	privateKey *ecdsa.PrivateKey,
) (SendResult, error) {
	senderAddress := common.HexToAddress(sender.Address)
	nativeBalance, err := client.BalanceAt(ctx, senderAddress, nil)
	if err != nil {
		return SendResult{}, err
	}
	if nativeBalance.Cmp(minGasReserveWei(network)) < 0 {
		return SendResult{}, errors.New("insufficient native gas token reserve")
	}

	nonce, err := client.PendingNonceAt(ctx, senderAddress)
	if err != nil {
		return SendResult{}, err
	}

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return SendResult{}, err
	}

	call := ethereum.CallMsg{
		From: senderAddress,
		To:   &smartAccount,
		Data: callData,
	}

	gasLimit, err := client.EstimateGas(ctx, call)
	if err != nil {
		gasLimit = 120000
	}

	tx := types.NewTransaction(nonce, smartAccount, big.NewInt(0), gasLimit, gasPrice, callData)
	signer := types.NewEIP155Signer(big.NewInt(int64(networkConfig.ChainID)))
	signedTx, err := types.SignTx(tx, signer, privateKey)
	if err != nil {
		return SendResult{}, err
	}

	if err := client.SendTransaction(ctx, signedTx); err != nil {
		return SendResult{}, err
	}

	txHash := signedTx.Hash().Hex()
	if err := db.InsertTransactionIfMissing(ctx, database.TransactionRecord{
		TxHash:          txHash,
		UserOpHash:      "",
		Nonce:           int64(nonce),
		Chain:           network,
		EntryPoint:      "",
		Token:           token.Symbol,
		TokenAddress:    token.Address,
		TokenDecimals:   token.Decimals,
		NativeToken:     token.IsNative,
		Amount:          formatTokenUnits(amountUnits, token.Decimals),
		TransactionType: "transfer",
		State:           "pending",
		BundlerStatus:   "",
		TxMode:          "direct",
		SponsorshipMode: SendModeDirect,
		Note:            note,
		Source:          smartAccount.Hex(),
		Destination:     recipientAddress,
		ProviderID:      providerID,
		WalletAddress:   sender.Address,
		Counterparty:    recipientAddress,
	}); err != nil {
		return SendResult{}, err
	}

	return SendResult{
		OperationHash: txHash,
		TxHash:        txHash,
		Mode:          "direct",
		Sponsored:     false,
		Network:       network,
		Token:         token.Symbol,
	}, nil
}

func sendTokenViaUserOperation(
	ctx context.Context,
	db *database.DB,
	client *ethclient.Client,
	network string,
	networkConfig networkDetails,
	sender database.WalletSecret,
	smartAccount common.Address,
	recipientAddress string,
	token TokenConfig,
	amountUnits *big.Int,
	callData []byte,
	note string,
	providerID string,
	sendMode string,
	privateKey *ecdsa.PrivateKey,
) (SendResult, error) {
	sponsored := sendMode == SendModeSponsored
	deployment, err := config.ValidateAAConfig(network, sponsored)
	if err != nil {
		return SendResult{}, err
	}
	if !common.IsHexAddress(deployment.EntryPointAddress) {
		return SendResult{}, errors.New("invalid entry point address")
	}

	entryPointAddress := common.HexToAddress(deployment.EntryPointAddress)
	nonceData, err := entryPointABI.Pack("getNonce", smartAccount, uint64(0))
	if err != nil {
		return SendResult{}, err
	}
	nonceRaw, err := client.CallContract(ctx, ethereum.CallMsg{To: &entryPointAddress, Data: nonceData}, nil)
	if err != nil {
		return SendResult{}, err
	}
	decodedNonce, err := entryPointABI.Unpack("getNonce", nonceRaw)
	if err != nil || len(decodedNonce) != 1 {
		return SendResult{}, errors.New("failed to decode entry point nonce")
	}
	nonce, ok := decodedNonce[0].(*big.Int)
	if !ok {
		return SendResult{}, errors.New("invalid nonce type")
	}

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return SendResult{}, err
	}
	priorityFee := new(big.Int).Div(gasPrice, big.NewInt(4))
	if priorityFee.Sign() == 0 {
		priorityFee = big.NewInt(1)
	}

	op := UserOperation{
		Sender:               smartAccount,
		Nonce:                nonce,
		InitCode:             []byte{},
		CallData:             callData,
		CallGasLimit:         big.NewInt(220000),
		VerificationGasLimit: big.NewInt(120000),
		PreVerificationGas:   big.NewInt(50000),
		MaxFeePerGas:         gasPrice,
		MaxPriorityFeePerGas: priorityFee,
		PaymasterAndData:     []byte{},
	}

	if sponsored {
		policy := LoadPaymasterPolicy(network)
		if err := ValidateSponsoredTransfer(policy, token, amountUnits); err != nil {
			_ = db.RecordPaymasterValidation(ctx, database.PaymasterValidation{
				SenderAddress:   sender.Address,
				Decision:        "rejected",
				RejectionReason: err.Error(),
				AmountUnits:     amountUnits.String(),
				Metadata:        network,
			})
			return SendResult{}, err
		}

		countToday, err := db.CountSponsoredOperationsToday(ctx, sender.Address)
		if err == nil && countToday >= policy.DailyOperationLimit {
			return SendResult{}, errors.New("sponsorship daily operation limit reached")
		}

		sumToday, err := db.SumSponsoredAmountToday(ctx, sender.Address)
		if err == nil {
			next := new(big.Int).Add(sumToday, amountUnits)
			if next.Cmp(policy.DailyLimit) > 0 {
				return SendResult{}, errors.New("sponsorship daily amount limit exceeded")
			}
		}

		paymasterAndData, err := BuildSignedPaymasterAndData(deployment.PaymasterAddress, smartAccount, nonce, big.NewInt(int64(networkConfig.ChainID)), network)
		if err != nil {
			_ = db.RecordPaymasterValidation(ctx, database.PaymasterValidation{
				SenderAddress:   sender.Address,
				Decision:        "rejected",
				RejectionReason: "signature_unavailable: " + err.Error(),
				AmountUnits:     amountUnits.String(),
				Metadata:        network,
			})
			return SendResult{}, err
		}
		op.PaymasterAndData = paymasterAndData

		_ = db.RecordPaymasterValidation(ctx, database.PaymasterValidation{
			SenderAddress: sender.Address,
			Decision:      "approved",
			AmountUnits:   amountUnits.String(),
			Metadata:      network,
		})
	}

	bundler := NewBundlerClient(deployment.BundlerURL)
	logs.LogError(fmt.Sprintf("aa_send_start mode=%s network=%s token=%s sender=%s", sendMode, network, token.Symbol, smartAccount.Hex()))
	if estimate, err := bundler.EstimateUserOperationGas(ctx, op, entryPointAddress.Hex()); err == nil {
		op.PreVerificationGas = estimate.PreVerificationGas
		op.VerificationGasLimit = estimate.VerificationGasLimit
		op.CallGasLimit = estimate.CallGasLimit
	}

	signature, userOpHash, err := SignUserOperation(op, entryPointAddress, big.NewInt(int64(networkConfig.ChainID)), privateKey)
	if err != nil {
		return SendResult{}, err
	}
	op.Signature = signature

	sentUserOpHash, err := bundler.SendUserOperation(ctx, op, entryPointAddress.Hex())
	if err != nil {
		logs.LogError(fmt.Sprintf("aa_send_error mode=%s network=%s token=%s err=%s", sendMode, network, token.Symbol, err.Error()))
		return SendResult{}, err
	}
	if strings.TrimSpace(sentUserOpHash) == "" {
		sentUserOpHash = userOpHash.Hex()
	}

	if err := db.InsertTransactionIfMissing(ctx, database.TransactionRecord{
		TxHash:          sentUserOpHash,
		UserOpHash:      sentUserOpHash,
		Nonce:           op.Nonce.Int64(),
		Chain:           network,
		EntryPoint:      entryPointAddress.Hex(),
		Token:           token.Symbol,
		TokenAddress:    token.Address,
		TokenDecimals:   token.Decimals,
		NativeToken:     token.IsNative,
		Amount:          formatTokenUnits(amountUnits, token.Decimals),
		TransactionType: "transfer",
		State:           "pending",
		BundlerStatus:   "submitted",
		TxMode:          "userop",
		SponsorshipMode: sendMode,
		Note:            note,
		Source:          smartAccount.Hex(),
		Destination:     recipientAddress,
		ProviderID:      providerID,
		WalletAddress:   sender.Address,
		Counterparty:    recipientAddress,
	}); err != nil {
		return SendResult{}, err
	}

	if sponsored {
		_ = db.RecordSponsoredOperation(ctx, database.SponsoredOperation{
			UserOperationID: sentUserOpHash,
			SenderAddress:   sender.Address,
			Network:         network,
			TokenAddress:    token.Address,
			Recipient:       recipientAddress,
			AmountUnits:     amountUnits.String(),
			Status:          "submitted",
		})
	}
	logs.LogError(fmt.Sprintf("aa_send_submitted mode=%s network=%s token=%s userOpHash=%s", sendMode, network, token.Symbol, sentUserOpHash))

	return SendResult{
		OperationHash: sentUserOpHash,
		UserOpHash:    sentUserOpHash,
		Mode:          "userop",
		Sponsored:     sponsored,
		Network:       network,
		Token:         token.Symbol,
	}, nil
}

func createSmartAccountViaUserOperation(
	ctx context.Context,
	db *database.DB,
	client *ethclient.Client,
	network string,
	networkConfig networkDetails,
	deployment config.Deployment,
	sender database.WalletSecret,
	ownerAddress common.Address,
	predicted common.Address,
	privateKey *ecdsa.PrivateKey,
) (string, error) {
	aaDeployment, err := config.ValidateAAConfig(network, true)
	if err != nil {
		return "", err
	}
	if !common.IsHexAddress(aaDeployment.EntryPointAddress) || !common.IsHexAddress(aaDeployment.FactoryAddress) {
		return "", errors.New("sponsored smart-account creation requires valid entry point and factory")
	}

	factoryAddress := common.HexToAddress(aaDeployment.FactoryAddress)
	entryPointAddress := common.HexToAddress(aaDeployment.EntryPointAddress)

	initCallData, err := buildFactoryCreateInitCall(ownerAddress, entryPointAddress)
	if err != nil {
		return "", err
	}
	initCode := append(factoryAddress.Bytes(), initCallData...)

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return "", err
	}
	priorityFee := new(big.Int).Div(gasPrice, big.NewInt(4))
	if priorityFee.Sign() == 0 {
		priorityFee = big.NewInt(1)
	}

	op := UserOperation{
		Sender:               predicted,
		Nonce:                big.NewInt(0),
		InitCode:             initCode,
		CallData:             []byte{},
		CallGasLimit:         big.NewInt(500000),
		VerificationGasLimit: big.NewInt(450000),
		PreVerificationGas:   big.NewInt(90000),
		MaxFeePerGas:         gasPrice,
		MaxPriorityFeePerGas: priorityFee,
		PaymasterAndData:     []byte{},
	}

	paymasterAndData, err := BuildSignedPaymasterAndData(aaDeployment.PaymasterAddress, predicted, op.Nonce, big.NewInt(int64(networkConfig.ChainID)), network)
	if err != nil {
		return "", err
	}
	op.PaymasterAndData = paymasterAndData

	bundler := NewBundlerClient(aaDeployment.BundlerURL)
	logs.LogError(fmt.Sprintf("aa_create_start network=%s sender=%s", network, predicted.Hex()))
	if estimate, err := bundler.EstimateUserOperationGas(ctx, op, entryPointAddress.Hex()); err == nil {
		op.PreVerificationGas = estimate.PreVerificationGas
		op.VerificationGasLimit = estimate.VerificationGasLimit
		op.CallGasLimit = estimate.CallGasLimit
	}

	signature, userOpHash, err := SignUserOperation(op, entryPointAddress, big.NewInt(int64(networkConfig.ChainID)), privateKey)
	if err != nil {
		return "", err
	}
	op.Signature = signature

	sentUserOpHash, err := bundler.SendUserOperation(ctx, op, entryPointAddress.Hex())
	if err != nil {
		logs.LogError(fmt.Sprintf("aa_create_error network=%s sender=%s err=%s", network, predicted.Hex(), err.Error()))
		return "", err
	}
	if strings.TrimSpace(sentUserOpHash) == "" {
		sentUserOpHash = userOpHash.Hex()
	}

	if err := db.InsertTransactionIfMissing(ctx, database.TransactionRecord{
		TxHash:          sentUserOpHash,
		UserOpHash:      sentUserOpHash,
		Nonce:           0,
		Chain:           network,
		EntryPoint:      entryPointAddress.Hex(),
		Token:           "ACCOUNT",
		TokenAddress:    deployment.FactoryAddress,
		TokenDecimals:   0,
		NativeToken:     false,
		Amount:          "1",
		TransactionType: "account_create",
		State:           "pending",
		BundlerStatus:   "submitted",
		TxMode:          "userop",
		SponsorshipMode: SendModeSponsored,
		Note:            "Sponsored smart account creation",
		Source:          ownerAddress.Hex(),
		Destination:     predicted.Hex(),
		ProviderID:      "",
		WalletAddress:   sender.Address,
		Counterparty:    predicted.Hex(),
	}); err != nil {
		return "", err
	}

	_ = db.RecordSponsoredOperation(ctx, database.SponsoredOperation{
		UserOperationID: sentUserOpHash,
		SenderAddress:   sender.Address,
		Network:         network,
		TokenAddress:    deployment.FactoryAddress,
		Recipient:       predicted.Hex(),
		AmountUnits:     "1",
		Status:          "submitted",
	})
	logs.LogError(fmt.Sprintf("aa_create_submitted network=%s userOpHash=%s sender=%s", network, sentUserOpHash, predicted.Hex()))

	return sentUserOpHash, nil
}

func SyncTransactionStatus(ctx context.Context, txHash string, network string) (string, error) {
	if txHash == "" {
		return "", errors.New("transaction hash is required")
	}

	if status, _, _, err := SyncUserOperationStatus(ctx, txHash, network); err == nil && status != "" {
		return status, nil
	}

	networkConfig := GetNetwork(network)
	if len(networkConfig.RPC) == 0 {
		return "", fmt.Errorf("unsupported network: %s", network)
	}

	client, err := ethclient.DialContext(ctx, networkConfig.RPC[0])
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

func SyncUserOperationStatus(ctx context.Context, userOpHash string, network string) (string, string, string, error) {
	deployment, err := config.ValidateAAConfig(network, false)
	if err != nil {
		return "", "", "", err
	}

	bundler := NewBundlerClient(deployment.BundlerURL)
	receipt, err := bundler.GetUserOperationReceipt(ctx, userOpHash)
	if err != nil {
		return "", "", "", err
	}
	if receipt == nil {
		return "pending", "", "pending", nil
	}

	if receipt.Success {
		logs.LogError(fmt.Sprintf("aa_receipt_success network=%s userOpHash=%s txHash=%s", network, userOpHash, strings.TrimSpace(receipt.TransactionHash)))
		return "completed", strings.TrimSpace(receipt.TransactionHash), "included", nil
	}

	logs.LogError(fmt.Sprintf("aa_receipt_failed network=%s userOpHash=%s txHash=%s", network, userOpHash, strings.TrimSpace(receipt.TransactionHash)))

	return "failed", strings.TrimSpace(receipt.TransactionHash), "failed", nil
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

func resolveToken(network string, tokenIdentifier string) (TokenConfig, error) {
	networkKey := strings.ToLower(strings.TrimSpace(network))
	tokenKey := strings.ToLower(strings.TrimSpace(tokenIdentifier))
	if tokenKey == "" {
		tokenKey = NativeTokenIdentifier
	}

	tokens, ok := tokenRegistry[networkKey]
	if !ok {
		return TokenConfig{}, fmt.Errorf("unsupported network: %s", network)
	}

	for _, token := range tokens {
		if strings.EqualFold(token.Identifier, tokenKey) || strings.EqualFold(token.Symbol, tokenKey) {
			return token, nil
		}
		if !token.IsNative && strings.EqualFold(token.Address, tokenKey) {
			return token, nil
		}
	}

	return TokenConfig{}, errors.New("token is not allowlisted on network")
}

func ListTokenConfigs(network string) ([]TokenConfig, error) {
	networkKey := strings.ToLower(strings.TrimSpace(network))
	tokens, ok := tokenRegistry[networkKey]
	if !ok {
		return nil, fmt.Errorf("unsupported network: %s", network)
	}

	result := make([]TokenConfig, 0, len(tokens))
	result = append(result, tokens...)
	return result, nil
}

func minGasReserveWei(network string) *big.Int {
	value := strings.ToLower(strings.TrimSpace(network))
	switch value {
	case "ethereum-mainnet":
		return big.NewInt(0).SetUint64(50_000_000_000_000) // 0.00005 ETH
	case "ethereum-sepolia":
		return big.NewInt(0).SetUint64(10_000_000_000_000) // 0.00001 ETH
	default:
		return big.NewInt(0).SetUint64(2_000_000_000_000_000)
	}
}

func buildFactoryCreateInitCall(ownerAddress common.Address, entryPointAddress common.Address) ([]byte, error) {
	parsed, err := FactoryMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	if parsed.Methods["createAccountWithEntryPoint"].Name != "" {
		return parsed.Pack("createAccountWithEntryPoint", ownerAddress, entryPointAddress)
	}
	if parsed.Methods["createAccount"].Name != "" {
		return parsed.Pack("createAccount", ownerAddress)
	}
	return nil, errors.New("factory creation method not found in ABI")
}

func ListUSDCTransactions(ctx context.Context, db *database.DB, network string, limit, offset int) ([]database.TransactionRecord, error) {
	return ListTokenTransactions(ctx, db, network, "usdc", limit, offset)
}

func ListTokenTransactions(ctx context.Context, db *database.DB, network string, tokenIdentifier string, limit, offset int) ([]database.TransactionRecord, error) {
	if db == nil {
		return nil, errors.New("database is required")
	}

	wallets, err := db.ListWallets(ctx)
	if err != nil {
		return nil, err
	}
	if len(wallets) == 0 {
		return []database.TransactionRecord{}, nil
	}

	token, err := resolveToken(network, tokenIdentifier)
	if err != nil {
		return nil, err
	}

	transactions, err := db.ListTransactions(ctx, wallets[0].Address, token.Symbol, limit, offset)
	if err != nil {
		return nil, err
	}

	for idx, tx := range transactions {
		if tx.State != "pending" {
			continue
		}

		if tx.TxMode == "userop" || tx.UserOpHash != "" {
			status, finalTxHash, bundlerStatus, err := SyncUserOperationStatus(ctx, tx.TxHash, network)
			if err != nil {
				continue
			}
			if strings.TrimSpace(finalTxHash) != "" {
				transactions[idx].TxHash = finalTxHash
			}
			if status != tx.State || bundlerStatus != tx.BundlerStatus {
				_ = db.UpdateTransactionSettlement(ctx, tx.TxHash, status, bundlerStatus)
				transactions[idx].State = status
				transactions[idx].BundlerStatus = bundlerStatus
				transactions[idx].UpdatedAt = time.Now().Unix()
			}
			continue
		}

		status, err := SyncTransactionStatus(ctx, tx.TxHash, network)
		if err != nil {
			continue
		}

		if status != tx.State {
			_ = db.UpdateTransactionState(ctx, tx.TxHash, status)
			transactions[idx].State = status
			transactions[idx].UpdatedAt = time.Now().Unix()
		}
	}

	return transactions, nil
}

func ListAllTransactions(ctx context.Context, db *database.DB, network string, limit, offset int) ([]database.TransactionRecord, error) {
	if db == nil {
		return nil, errors.New("database is required")
	}

	wallets, err := db.ListWallets(ctx)
	if err != nil {
		return nil, err
	}
	if len(wallets) == 0 {
		return []database.TransactionRecord{}, nil
	}

	tokens, err := ListTokenConfigs(network)
	if err != nil {
		return nil, err
	}

	items := make([]database.TransactionRecord, 0)
	for _, token := range tokens {
		txs, err := db.ListTransactions(ctx, wallets[0].Address, token.Symbol, limit, offset)
		if err != nil {
			continue
		}
		items = append(items, txs...)
	}

	for idx, tx := range items {
		if tx.State != "pending" {
			continue
		}

		if tx.TxMode == "userop" || tx.UserOpHash != "" {
			status, finalTxHash, bundlerStatus, err := SyncUserOperationStatus(ctx, tx.TxHash, network)
			if err != nil {
				continue
			}
			if strings.TrimSpace(finalTxHash) != "" {
				items[idx].TxHash = finalTxHash
			}
			if status != tx.State || bundlerStatus != tx.BundlerStatus {
				_ = db.UpdateTransactionSettlement(ctx, tx.TxHash, status, bundlerStatus)
				items[idx].State = status
				items[idx].BundlerStatus = bundlerStatus
				items[idx].UpdatedAt = time.Now().Unix()
			}
			continue
		}

		status, err := SyncTransactionStatus(ctx, tx.TxHash, network)
		if err != nil {
			continue
		}

		if status != tx.State {
			_ = db.UpdateTransactionState(ctx, tx.TxHash, status)
			items[idx].State = status
			items[idx].UpdatedAt = time.Now().Unix()
		}
	}

	return items, nil
}

func GetNetwork(network string) networkDetails {
	switch network {
	case "ethereum-mainnet", "mainnet":
		rpcList := []string{
			"https://eth.llamarpc.com",
			"https://rpc.ankr.com/eth",
		}

		return networkDetails{
			Name:       "ethereum",
			ChainID:    1,
			ChainIDHex: "0x1",
			Currency:   "ETH",
			Mainnet:    true,
			RPC:        rpcList,
		}
	case "ethereum-sepolia", "sepolia", "testnet":
		rpcList := []string{
			"https://ethereum-sepolia-rpc.publicnode.com",
			"https://rpc.sepolia.org",
		}

		return networkDetails{
			Name:       "ethereum",
			ChainID:    11155111,
			ChainIDHex: "0xaa36a7",
			Currency:   "ETH",
			Mainnet:    false,
			RPC:        rpcList,
		}
	case "polygon-mainnet":
		rpcList := []string{
			"wss://polygon-bor-rpc.publicnode.com",
			"https://polygon.llamarpc.com",
			"wss://polygon.drpc.org",
		}

		return networkDetails{
			Name:       "polygon",
			ChainID:    137,
			ChainIDHex: "0x89",
			Currency:   "matic",
			Mainnet:    true,
			RPC:        rpcList,
		}
	case "polygon-mumbai":
		rpcList := []string{
			"https://polygon-mumbai.gateway.tenderly.co",
			"https://polygon-mumbai.api.onfinality.io/public",
			"https://gateway.tenderly.co/public/polygon-mumbai",
		}

		return networkDetails{
			Name:       "polygon",
			ChainID:    80001,
			ChainIDHex: "0x13881",
			Currency:   "matic",
			Mainnet:    false,
			RPC:        rpcList,
		}
	case "gnosis-mainnet":
		rpcList := []string{
			"https://rpc.gnosischain.com",
			"https://gnosis.drpc.org",
		}

		return networkDetails{
			Name:       "gnosis",
			ChainID:    100,
			ChainIDHex: "0x64",
			Currency:   "xDAI",
			Mainnet:    true,
			RPC:        rpcList,
		}
	case "gnosis-chiado":
		rpcList := []string{
			"https://rpc.chiadochain.net",
			"https://gnosis-chiado-rpc.publicnode.com",
		}

		return networkDetails{
			Name:       "gnosis",
			ChainID:    10200,
			ChainIDHex: "0x27d8",
			Currency:   "xDAI",
			Mainnet:    false,
			RPC:        rpcList,
		}

	default:
		return networkDetails{
			Name:     "",
			ChainID:  0,
			Currency: "",
			Mainnet:  false,
		}
	}
}

func GetData(name string) (MarketData, error) {
	url := "https://api.mobula.io/api/1/market/data?asset=" + name
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return MarketData{}, err
	}

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return MarketData{}, err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return MarketData{}, fmt.Errorf("market data request failed: status %d", res.StatusCode)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return MarketData{}, err
	}

	data, err := ConvertBody(body)
	if err != nil {
		return MarketData{}, err
	}

	return data, nil
}
