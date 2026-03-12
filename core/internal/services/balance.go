package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// BalanceStore is the write interface the balance worker needs.
type BalanceStore interface {
	// ListWalletAddresses returns the set of wallet addresses to scan.
	ListWalletAddresses(ctx context.Context) ([]string, error)

	// UpsertBalance stores a balance snapshot for an address.
	UpsertBalance(ctx context.Context, snap BalanceSnapshot) error
}

// BalanceSnapshot is one token-balance sample for a wallet address.
type BalanceSnapshot struct {
	WalletAddress string
	Network       string
	TokenAddress  string
	TokenSymbol   string
	RawBalance    string // decimal string with full token precision
	USDValue      string // decimal USD value, "" if unknown
	FetchedAt     int64  // Unix ms
}

// RunBalanceWorker periodically fetches native + ERC-20 balances for all
// wallets via Alchemy and persists results to store.
//
// alchemyKey is the POCKET_ALCHEMY_API_KEY (server-side only, never mobile).
// networks maps networkName → full Alchemy RPC URL (already contains the key).
// interval is the poll period; 0 defaults to 5 min.
func RunBalanceWorker(
	ctx context.Context,
	store BalanceStore,
	alchemyKey string,
	networks map[string]string,
	interval time.Duration,
) {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	log.Println("[balance-worker] starting, interval=", interval)
	syncBalances(ctx, store, alchemyKey, networks)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("[balance-worker] stopped")
			return
		case <-ticker.C:
			syncBalances(ctx, store, alchemyKey, networks)
		}
	}
}

func syncBalances(ctx context.Context, store BalanceStore, _ string, networks map[string]string) {
	addresses, err := store.ListWalletAddresses(ctx)
	if err != nil {
		log.Printf("[balance-worker] list wallets error: %v", err)
		return
	}

	ethUSD, _ := fetchETHPriceUSD(ctx)

	for netName, rpcURL := range networks {
		for _, addr := range addresses {
			now := time.Now().UnixMilli()

			// Native ETH balance
			if bal, err := fetchNativeBalance(ctx, rpcURL, addr); err == nil {
				usdVal := ""
				if ethUSD > 0 {
					usdVal = multiplyDecimalByFloat(bal, ethUSD)
				}
				_ = store.UpsertBalance(ctx, BalanceSnapshot{
					WalletAddress: addr,
					Network:       netName,
					TokenAddress:  "",
					TokenSymbol:   "ETH",
					RawBalance:    bal,
					USDValue:      usdVal,
					FetchedAt:     now,
				})
			}

			// ERC-20 balances via alchemy_getTokenBalances
			if snaps, err := fetchTokenBalances(ctx, rpcURL, addr, netName); err == nil {
				for _, snap := range snaps {
					_ = store.UpsertBalance(ctx, snap)
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Alchemy RPC helpers
// ---------------------------------------------------------------------------

type alchemyJSONRPCStringResult struct {
	Result string `json:"result"`
}

func fetchNativeBalance(ctx context.Context, rpcURL, address string) (string, error) {
	body, err := alchemyPost(ctx, rpcURL, "eth_getBalance", []any{address, "latest"})
	if err != nil {
		return "", err
	}
	var parsed alchemyJSONRPCStringResult
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}
	return hexWeiToDecimalETH(parsed.Result), nil
}

type alchemyTokenBalancesResponse struct {
	Result *struct {
		TokenBalances []struct {
			ContractAddress string `json:"contractAddress"`
			TokenBalance    string `json:"tokenBalance"`
			Error           *struct {
				Message string `json:"message"`
			} `json:"error,omitempty"`
		} `json:"tokenBalances"`
	} `json:"result"`
}

func fetchTokenBalances(ctx context.Context, rpcURL, address, network string) ([]BalanceSnapshot, error) {
	body, err := alchemyPost(ctx, rpcURL, "alchemy_getTokenBalances", []any{address, "erc20"})
	if err != nil {
		return nil, err
	}
	var parsed alchemyTokenBalancesResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Result == nil {
		return nil, nil
	}

	now := time.Now().UnixMilli()
	snaps := make([]BalanceSnapshot, 0, len(parsed.Result.TokenBalances))
	for _, tb := range parsed.Result.TokenBalances {
		if tb.Error != nil {
			continue
		}
		rawBal := hexUint256ToDecimal(tb.TokenBalance)
		if rawBal == "0" {
			continue
		}

		var tokenSymbol string = ""
		var usdValue string = ""

		if tb.ContractAddress == "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238" {
			tokenSymbol = "USDC"
			amount, err := strconv.ParseInt(rawBal, 10, 64)
			if err != nil {
				panic(err)
			}

			usdFloatValue := float64(amount) / 1000000
			usdValue = strconv.FormatFloat(usdFloatValue, 'f', -1, 64)
		}

		snaps = append(snaps, BalanceSnapshot{
			WalletAddress: address,
			Network:       network,
			TokenAddress:  strings.ToLower(tb.ContractAddress),
			TokenSymbol:   tokenSymbol,
			RawBalance:    rawBal,
			USDValue:      usdValue,
			FetchedAt:     now,
		})
	}
	return snaps, nil
}

func alchemyPost(ctx context.Context, rpcURL, method string, params []any) ([]byte, error) {
	payload, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
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
	return io.ReadAll(resp.Body)
}

// ---------------------------------------------------------------------------
// CoinGecko ETH/USD price
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Conversion helpers
// ---------------------------------------------------------------------------

// hexWeiToDecimalETH converts a 0x-prefixed hex wei string to a decimal ETH string.
func hexWeiToDecimalETH(hexWei string) string {
	trimmed := strings.TrimPrefix(strings.TrimSpace(hexWei), "0x")
	if trimmed == "" {
		return "0"
	}
	n := new(big.Int)
	if _, ok := n.SetString(trimmed, 16); !ok {
		return "0"
	}
	// Divide by 1e18 as a rational to preserve precision
	denom := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	r := new(big.Rat).SetFrac(n, denom)
	return formatRat(r, 18)
}

// hexUint256ToDecimal converts a 0x-prefixed hex uint256 to a base-10 string.
func hexUint256ToDecimal(hexVal string) string {
	trimmed := strings.TrimPrefix(strings.TrimSpace(hexVal), "0x")
	if trimmed == "" || trimmed == "0" {
		return "0"
	}
	n := new(big.Int)
	if _, ok := n.SetString(trimmed, 16); !ok {
		return "0"
	}
	return n.String()
}

// multiplyDecimalByFloat multiplies a decimal-string balance by a float price.
func multiplyDecimalByFloat(balStr string, price float64) string {
	var val float64
	if _, err := fmt.Sscanf(balStr, "%f", &val); err != nil {
		return ""
	}
	return fmt.Sprintf("%.6f", val*price)
}

func formatRat(r *big.Rat, decimals int) string {
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
