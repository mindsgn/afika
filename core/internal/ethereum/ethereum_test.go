package ethereum

import (
	"context"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
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

func openTestDB(t *testing.T) *database.DB {
	t.Helper()
	db, err := database.Open(context.Background(), t.TempDir(), "password", &testSecureKeyStore{
		masterKey: []byte("0123456789abcdef0123456789abcdef"),
		salt:      []byte("abcdef0123456789"),
	})
	if err != nil {
		t.Fatalf("database.Open() error = %v", err)
	}
	return db
}

type fakeBalanceClient struct{}

func (f *fakeBalanceClient) BalanceAt(_ context.Context, _ common.Address, _ *big.Int) (*big.Int, error) {
	return big.NewInt(1_000_000_000_000_000_000), nil
}

func (f *fakeBalanceClient) Close() {}

func TestConvertBody(t *testing.T) {
	data, err := ConvertBody([]byte(`{"data":{"price":12.5,"name":"polygon"}}`))
	if err != nil {
		t.Fatalf("ConvertBody() error = %v", err)
	}
	if data.Data.Price != 12.5 {
		t.Fatalf("expected price 12.5, got %v", data.Data.Price)
	}
}

func TestConvertBodyInvalidJSON(t *testing.T) {
	_, err := ConvertBody([]byte("{"))
	if err == nil {
		t.Fatalf("expected error for invalid JSON")
	}
}

func TestGetNetworkPolygonMumbai(t *testing.T) {
	network := GetNetwork("polygon-mumbai")
	if network.ChainID != 80001 {
		t.Fatalf("expected chain id 80001, got %d", network.ChainID)
	}
	if network.ChainIDHex != "0x13881" {
		t.Fatalf("expected chain id hex 0x13881, got %s", network.ChainIDHex)
	}
}

func TestCreateNewEthereumWalletRequiresDB(t *testing.T) {
	_, err := CreateNewEthereumWallet(context.Background(), nil, "Primary")
	if err == nil {
		t.Fatalf("expected error for nil db")
	}
}

func TestCreateNewEthereumWalletInsertsRecord(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	address, err := CreateNewEthereumWallet(context.Background(), db, "Primary")
	if err != nil {
		t.Fatalf("CreateNewEthereumWallet() error = %v", err)
	}
	if address == "" {
		t.Fatalf("expected non-empty address")
	}

	wallets, err := db.ListWallets(context.Background())
	if err != nil {
		t.Fatalf("ListWallets() error = %v", err)
	}
	if len(wallets) != 1 {
		t.Fatalf("expected 1 wallet, got %d", len(wallets))
	}
}

func TestGetTotalBalanceWithInjectedClients(t *testing.T) {
	db := openTestDB(t)
	defer db.Close()

	if err := db.InsertWallet(context.Background(), "ethereum", "Primary", "0x0000000000000000000000000000000000000001", []byte("key")); err != nil {
		t.Fatalf("InsertWallet() error = %v", err)
	}

	previousDial := dialClient
	previousFetch := fetchMarketData
	dialClient = func(string) (balanceClient, error) { return &fakeBalanceClient{}, nil }
	fetchMarketData = func(string) (MarketData, error) {
		var data MarketData
		data.Data.Price = 2.0
		data.Data.Name = "polygon"
		return data, nil
	}
	defer func() {
		dialClient = previousDial
		fetchMarketData = previousFetch
	}()

	result, err := GetTotalBalance(context.Background(), db, "testnet")
	if err != nil {
		t.Fatalf("GetTotalBalance() error = %v", err)
	}
	if result.Currency != "USD" {
		t.Fatalf("expected USD currency, got %s", result.Currency)
	}
	if len(result.Wallets) != 1 {
		t.Fatalf("expected 1 wallet result, got %d", len(result.Wallets))
	}
	if result.TotalFiat <= 0 {
		t.Fatalf("expected positive total fiat, got %f", result.TotalFiat)
	}
}

// ---------------------------------------------------------------------------
// FetchInboundTransfers tests
// ---------------------------------------------------------------------------

// fakeInboundClient implements inboundTransferClient for tests.
type fakeInboundClient struct {
	blockNumber uint64
	logs        []types.Log
	filterErr   error
	blockErr    error
}

func (f *fakeInboundClient) BlockNumber(_ context.Context) (uint64, error) {
	return f.blockNumber, f.blockErr
}
func (f *fakeInboundClient) FilterLogs(_ context.Context, _ ethereum.FilterQuery) ([]types.Log, error) {
	if f.filterErr != nil {
		return nil, f.filterErr
	}
	return f.logs, nil
}
func (f *fakeInboundClient) Close() {}

func TestFetchInboundTransfersEmptyAddress(t *testing.T) {
	_, err := FetchInboundTransfers(context.Background(), "", "ethereum-sepolia")
	if err == nil {
		t.Fatal("expected error for empty wallet address")
	}
}

func TestFetchInboundTransfersInvalidAddress(t *testing.T) {
	_, err := FetchInboundTransfers(context.Background(), "not-an-address", "ethereum-sepolia")
	if err == nil {
		t.Fatal("expected error for invalid wallet address")
	}
}

func TestFetchInboundTransfersUnsupportedNetwork(t *testing.T) {
	_, err := FetchInboundTransfers(context.Background(), "0x0000000000000000000000000000000000000001", "unknown-chain")
	if err == nil {
		t.Fatal("expected error for unsupported network")
	}
}

func TestFetchInboundTransfersNoLogs(t *testing.T) {
	prev := dialInboundClient
	dialInboundClient = func(_ context.Context, _ string) (inboundTransferClient, error) {
		return &fakeInboundClient{blockNumber: 1000}, nil
	}
	defer func() { dialInboundClient = prev }()

	results, err := FetchInboundTransfers(context.Background(), "0x0000000000000000000000000000000000000001", "ethereum-sepolia")
	if err != nil {
		t.Fatalf("FetchInboundTransfers() error = %v", err)
	}
	// No logs returned by the fake client, so results must be empty (ETH alchemy path also silently returns nil).
	if len(results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(results))
	}
}

func TestFetchInboundTransfersERC20Log(t *testing.T) {
	walletAddr := "0xaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaA"
	fromAddr := common.HexToAddress("0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")
	toAddr := common.HexToAddress(walletAddr)

	// Build a fake Transfer log: amount = 5_000_000 (5 USDC, 6 decimals)
	amount := new(big.Int).SetUint64(5_000_000)
	paddedAmount := make([]byte, 32)
	amount.FillBytes(paddedAmount)

	fakeLog := types.Log{
		TxHash: common.HexToHash("0xdeadbeef"),
		Topics: []common.Hash{
			common.HexToHash(erc20TransferTopic),
			common.BytesToHash(fromAddr.Bytes()),
			common.BytesToHash(toAddr.Bytes()),
		},
		Data: paddedAmount,
	}

	prev := dialInboundClient
	dialInboundClient = func(_ context.Context, _ string) (inboundTransferClient, error) {
		return &fakeInboundClient{blockNumber: 500, logs: []types.Log{fakeLog}}, nil
	}
	defer func() { dialInboundClient = prev }()

	results, err := FetchInboundTransfers(context.Background(), walletAddr, "ethereum-sepolia")
	if err != nil {
		t.Fatalf("FetchInboundTransfers() error = %v", err)
	}

	// Should find exactly one USDC credit record.
	var found *database.TransactionRecord
	for i := range results {
		if results[i].TransactionType == "credit" && results[i].Token == "USDC" {
			found = &results[i]
			break
		}
	}
	if found == nil {
		t.Fatal("expected a credit USDC record in results")
	}
	if found.Amount != "5" {
		t.Fatalf("expected amount '5', got %q", found.Amount)
	}
	if found.TxHash != common.HexToHash("0xdeadbeef").Hex() {
		t.Fatalf("unexpected tx hash: %s", found.TxHash)
	}
	if found.TxMode != "external" {
		t.Fatalf("expected TxMode 'external', got %q", found.TxMode)
	}
	if found.State != "completed" {
		t.Fatalf("expected State 'completed', got %q", found.State)
	}
}

func TestFetchInboundTransfersFilterLogErrorIsSilent(t *testing.T) {
	prev := dialInboundClient
	dialInboundClient = func(_ context.Context, _ string) (inboundTransferClient, error) {
		return &fakeInboundClient{blockNumber: 1000, filterErr: ethereum.NotFound}, nil
	}
	defer func() { dialInboundClient = prev }()

	// Filter error must not propagate; we get an empty result instead.
	results, err := FetchInboundTransfers(context.Background(), "0x0000000000000000000000000000000000000001", "ethereum-sepolia")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(results) != 0 {
		t.Fatalf("expected 0 results on filter error, got %d", len(results))
	}
}
