package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"strings"
	"time"
)

// TxStore is the write interface the transaction worker needs.
type TxStore interface {
	ListWalletAddresses(ctx context.Context) ([]string, error)
	UpsertTransaction(ctx context.Context, tx TxRecord) error
}

// TxRecord is a cleaned-up transaction record from Alchemy.
type TxRecord struct {
	WalletAddress string
	TxHash        string
	FromAddress   string
	ToAddress     string
	Description   string
	TokenAddress  string
	TokenSymbol   string
	Amount        string
	FeeETH        string
	FeeUSD        string
	USDAmount     string
	Network       string
	Direction     string // "debit" | "credit"
	State         string
	BlockNumber   uint64
	Timestamp     int64
}

// RunTransactionWorker periodically fetches all ERC-20 asset transfers
// for registered wallet addresses via Alchemy and persists them.
//
// networks maps networkName → full Alchemy RPC URL (contains the API key).
func RunTransactionWorker(
	ctx context.Context,
	store TxStore,
	networks map[string]string,
	interval time.Duration,
) {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	log.Println("[tx-worker] starting, interval=", interval)
	syncTransactions(ctx, store, networks)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("[tx-worker] stopped")
			return
		case <-ticker.C:
			syncTransactions(ctx, store, networks)
		}
	}
}

func syncTransactions(ctx context.Context, store TxStore, networks map[string]string) {
	addresses, err := store.ListWalletAddresses(ctx)
	if err != nil {
		log.Printf("[tx-worker] list wallets error: %v", err)
		return
	}
	ethUSD, _ := fetchETHPriceUSD(ctx)
	for netName, rpcURL := range networks {
		for _, addr := range addresses {
			// Outgoing (debit)
			if txs, err := fetchAssetTransfers(ctx, rpcURL, netName, addr, true, ethUSD); err == nil {
				for _, tx := range txs {
					if errU := store.UpsertTransaction(ctx, tx); errU != nil {
						log.Printf("[tx-worker] upsert error: %v", errU)
					}
				}
			}
			// Incoming (credit)
			if txs, err := fetchAssetTransfers(ctx, rpcURL, netName, addr, false, ethUSD); err == nil {
				for _, tx := range txs {
					if errU := store.UpsertTransaction(ctx, tx); errU != nil {
						log.Printf("[tx-worker] upsert error: %v", errU)
					}
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Alchemy alchemy_getAssetTransfers
// ---------------------------------------------------------------------------

type alchemyTransfer struct {
	UniqueID    string  `json:"uniqueId"`
	BlockNum    string  `json:"blockNum"`
	Hash        string  `json:"hash"`
	From        string  `json:"from"`
	To          string  `json:"to"`
	Value       float64 `json:"value"`
	Asset       string  `json:"asset"`
	Category    string  `json:"category"`
	RawContract struct {
		Value   string `json:"value"`
		Address string `json:"address"`
	} `json:"rawContract"`
	Metadata struct {
		BlockTimestamp string `json:"blockTimestamp"`
	} `json:"metadata"`
}

type alchemyAssetTransfersResult struct {
	Result *struct {
		Transfers []alchemyTransfer `json:"transfers"`
	} `json:"result"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

// fetchAssetTransfers fetches ERC-20 transfers for address.
// outgoing=true means "from address", false means "to address".
func fetchAssetTransfers(
	ctx context.Context,
	rpcURL string,
	network string,
	address string,
	outgoing bool,
	ethUSD float64,
) ([]TxRecord, error) {
	params := map[string]any{
		"fromBlock":        "0x0",
		"toBlock":          "latest",
		"category":         []string{"erc20", "external"},
		"excludeZeroValue": true,
		"maxCount":         "0x64",
		"withMetadata":     true,
	}
	if outgoing {
		params["fromAddress"] = address
	} else {
		params["toAddress"] = address
	}

	payload, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0", "id": 1,
		"method": "alchemy_getAssetTransfers",
		"params": []any{params},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, strings.NewReader(string(payload)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var parsed alchemyAssetTransfersResult
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Error != nil {
		return nil, fmt.Errorf("alchemy error %d: %s", parsed.Error.Code, parsed.Error.Message)
	}
	if parsed.Result == nil {
		return nil, nil
	}

	records := make([]TxRecord, 0, len(parsed.Result.Transfers))
	for _, t := range parsed.Result.Transfers {
		if t.Hash == "" {
			continue
		}
		direction := "credit"
		walletAddr := strings.ToLower(t.To)
		if outgoing {
			direction = "debit"
			walletAddr = strings.ToLower(address)
		}

		// Block number
		blockNum := hexUint64(t.BlockNum)

		// Timestamp from metadata
		ts := parseISO8601(t.Metadata.BlockTimestamp)

		// Fee: for external transfers where we're the sender, fetch receipt
		feeETH := ""
		if outgoing && t.Category == "external" {
			feeETH = fetchTxFee(ctx, rpcURL, t.Hash)
		}
		feeUSD := ""
		if feeETH != "" && ethUSD > 0 {
			feeUSD = formatUSDFromString(feeETH, ethUSD)
		}

		// Amount: prefer raw contract value when available
		amount := fmt.Sprintf("%g", t.Value)
		if t.RawContract.Value != "" && t.RawContract.Value != "0x" {
			// Raw value is in token smallest unit (uint256)
			if strings.EqualFold(t.Asset, "USDC") {
				amount = formatUnitsFixed(t.RawContract.Value, 6)
			} else {
				raw := hexUint256ToDecimal(t.RawContract.Value)
				amount = raw
			}
		} else if strings.EqualFold(t.Asset, "USDC") {
			amount = formatFixedFloat(t.Value, 6)
		}
		usdAmount := ""
		if strings.EqualFold(t.Asset, "USDC") {
			usdAmount = amount
		} else if strings.EqualFold(t.Asset, "ETH") && t.Category == "external" && ethUSD > 0 {
			usdAmount = formatUSD(t.Value * ethUSD)
		}

		records = append(records, TxRecord{
			WalletAddress: walletAddr,
			TxHash:        t.Hash,
			FromAddress:   strings.ToLower(t.From),
			ToAddress:     strings.ToLower(t.To),
			Description:   DescribeTransfer(direction, t.Asset, t.From, t.To),
			TokenAddress:  strings.ToLower(t.RawContract.Address),
			TokenSymbol:   t.Asset,
			Amount:        amount,
			FeeETH:        feeETH,
			FeeUSD:        feeUSD,
			USDAmount:     usdAmount,
			Network:       network,
			Direction:     direction,
			State:         "completed",
			BlockNumber:   blockNum,
			Timestamp:     ts,
		})
	}
	return records, nil
}

// DescribeTransfer builds a user-friendly description for a transfer.
func DescribeTransfer(direction, symbol, fromAddr, toAddr string) string {
	short := func(addr string) string {
		trimmed := strings.TrimSpace(addr)
		if len(trimmed) <= 10 {
			return trimmed
		}
		return trimmed[:6] + "..." + trimmed[len(trimmed)-4:]
	}
	token := strings.TrimSpace(symbol)
	if token == "" {
		token = "asset"
	}
	if direction == "debit" {
		return "Sent " + token + " to " + short(toAddr)
	}
	return "Received " + token + " from " + short(fromAddr)
}

// fetchTxFee fetches the gas used × gas price from the tx receipt.
func fetchTxFee(ctx context.Context, rpcURL, txHash string) string {
	payload, _ := json.Marshal(map[string]any{
		"jsonrpc": "2.0", "id": 1,
		"method": "eth_getTransactionReceipt",
		"params": []any{txHash},
	})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, rpcURL, strings.NewReader(string(payload)))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var result struct {
		Result *struct {
			GasUsed           string `json:"gasUsed"`
			EffectiveGasPrice string `json:"effectiveGasPrice"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || result.Result == nil {
		return ""
	}

	gasUsed := new(big.Int)
	gasPrice := new(big.Int)
	if _, ok := gasUsed.SetString(strings.TrimPrefix(result.Result.GasUsed, "0x"), 16); !ok {
		return ""
	}
	if _, ok := gasPrice.SetString(strings.TrimPrefix(result.Result.EffectiveGasPrice, "0x"), 16); !ok {
		return ""
	}
	feeWei := new(big.Int).Mul(gasUsed, gasPrice)
	return hexWeiToDecimalETH("0x" + feeWei.Text(16))
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

func hexUint64(hexVal string) uint64 {
	trimmed := strings.TrimPrefix(strings.TrimSpace(hexVal), "0x")
	if trimmed == "" {
		return 0
	}
	n := new(big.Int)
	if _, ok := n.SetString(trimmed, 16); !ok {
		return 0
	}
	return n.Uint64()
}

func parseISO8601(ts string) int64 {
	if ts == "" {
		return time.Now().Unix()
	}
	t, err := time.Parse(time.RFC3339, ts)
	if err != nil {
		return time.Now().Unix()
	}
	return t.Unix()
}

func formatUSD(val float64) string {
	if val <= 0 {
		return ""
	}
	s := fmt.Sprintf("%.6f", val)
	s = strings.TrimRight(s, "0")
	s = strings.TrimRight(s, ".")
	if s == "" {
		return "0"
	}
	return s
}

func formatUSDFromString(valStr string, price float64) string {
	if price <= 0 {
		return ""
	}
	var val float64
	if _, err := fmt.Sscanf(valStr, "%f", &val); err != nil {
		return ""
	}
	return formatUSD(val * price)
}

func formatFixedFloat(val float64, decimals int) string {
	return fmt.Sprintf("%.*f", decimals, val)
}

func formatUnitsFixed(hexVal string, decimals int) string {
	raw := hexUint256ToDecimal(hexVal)
	if raw == "" || raw == "0" {
		return "0"
	}
	n := new(big.Int)
	if _, ok := n.SetString(raw, 10); !ok {
		return ""
	}
	denom := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	r := new(big.Rat).SetFrac(n, denom)
	return r.FloatString(decimals)
}

func formatUnitsDecimal(hexVal string, decimals int) string {
	raw := hexUint256ToDecimal(hexVal)
	if raw == "" || raw == "0" {
		return "0"
	}
	n := new(big.Int)
	if _, ok := n.SetString(raw, 10); !ok {
		return ""
	}
	denom := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	r := new(big.Rat).SetFrac(n, denom)
	return formatRat(r, decimals)
}
