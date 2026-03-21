package routes

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/store"
	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/types"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/services"
)

// API holds the dependencies injected into all HTTP handlers.
type API struct {
	store store.APIDatabase
}

// NewAPI constructs an API handler set backed by the given store.
func NewAPI(apiStore store.APIDatabase) (*API, error) {
	if apiStore == nil {
		return nil, errors.New("store is required")
	}
	return &API{store: apiStore}, nil
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

// Health handles GET /health.
func (a *API) Health() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", false)
			return
		}
		writeSuccess(w, r, http.StatusOK, types.HealthResponse{
			OK:        true,
			Service:   "pocket-money-api",
			Version:   "2.0.0",
			Timestamp: time.Now().UTC(),
		})
	}
}

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

// SaveWallet handles POST /v1/wallets — registers a wallet address for tracking.
func (a *API) SaveWallet() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", false)
			return
		}
		var req types.WalletSaveRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, r, http.StatusBadRequest, "invalid_body", "invalid JSON body", false)
			return
		}
		req.Address = strings.TrimSpace(strings.ToLower(req.Address))
		req.Network = strings.TrimSpace(req.Network)
		if req.Address == "" || req.Network == "" {
			writeError(w, r, http.StatusBadRequest, "missing_fields", "address and network are required", false)
			return
		}

		now := time.Now().Unix()
		if err := a.store.SaveWallet(r.Context(), store.WalletRecord{
			Address:   req.Address,
			Network:   req.Network,
			CreatedAt: now,
		}); err != nil {
			writeError(w, r, http.StatusInternalServerError, "save_failed", "failed to save wallet", true)
			return
		}
		writeSuccess(w, r, http.StatusCreated, types.WalletSaveResponse{
			Address:   req.Address,
			Network:   req.Network,
			CreatedAt: now,
		})
	}
}

// GetWallets handles GET /v1/wallets — returns all tracked wallets.
func (a *API) GetWallets() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", false)
			return
		}
		wallets, err := a.store.ListWallets(r.Context())
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "list_failed", "failed to list wallets", true)
			return
		}
		items := make([]types.WalletSaveResponse, 0, len(wallets))
		for _, w2 := range wallets {
			items = append(items, types.WalletSaveResponse{
				Address:   w2.Address,
				Network:   w2.Network,
				CreatedAt: w2.CreatedAt,
			})
		}
		writeSuccess(w, r, http.StatusOK, types.WalletListResponse{Wallets: items})
	}
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

// GetBalances handles GET /v1/balances?address=0x...&network=ethereum-mainnet
func (a *API) GetBalances() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", false)
			return
		}
		address := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("address")))
		network := strings.TrimSpace(r.URL.Query().Get("network"))
		if address == "" {
			writeError(w, r, http.StatusBadRequest, "missing_address", "address query param is required", false)
			return
		}

		snapshots, err := a.store.GetLatestBalances(r.Context(), address, network)
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "fetch_failed", "failed to fetch balances", true)
			return
		}
		balances := make([]types.TokenBalance, 0, len(snapshots))
		for _, s := range snapshots {
			fetchedAtMs := normalizeTimestampMs(s.FetchedAt)
			balances = append(balances, types.TokenBalance{
				TokenAddress: s.TokenAddress,
				TokenSymbol:  s.TokenSymbol,
				Balance:      s.Balance,
				USDValue:     s.USDValue,
				FetchedAtMs:  fetchedAtMs,
				FetchedAt:    fetchedAtMs,
			})
		}
		writeSuccess(w, r, http.StatusOK, types.BalancesResponse{
			WalletAddress: address,
			Network:       network,
			Balances:      balances,
		})
	}
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

// ListTransactions handles GET /v1/transactions
//
// Query params:
//
//	address  string  (required)
//	direction string "debit" | "credit" | "" (all)
//	limit    int     default 20
//	offset   int     default 0
func (a *API) ListTransactions() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", false)
			return
		}
		q := r.URL.Query()
		address := strings.TrimSpace(strings.ToLower(q.Get("address")))
		if address == "" {
			writeError(w, r, http.StatusBadRequest, "missing_address", "address query param is required", false)
			return
		}

		direction := strings.TrimSpace(q.Get("direction"))
		if direction != "" && direction != "debit" && direction != "credit" {
			writeError(w, r, http.StatusBadRequest, "invalid_direction", "direction must be 'debit', 'credit', or omitted", false)
			return
		}

		limit := 20
		offset := 0
		if v := q.Get("limit"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 200 {
				limit = n
			}
		}
		if v := q.Get("offset"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n >= 0 {
				offset = n
			}
		}

		txs, total, err := a.store.ListTransactions(r.Context(), address, direction, limit, offset)
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "fetch_failed", "failed to fetch transactions", true)
			return
		}

		items := make([]types.TransactionItem, 0, len(txs))
		for _, t := range txs {
			timestampMs := normalizeTimestampMs(t.Timestamp)
			items = append(items, types.TransactionItem{
				TxHash:       t.TxHash,
				FromAddress:  t.FromAddress,
				ToAddress:    t.ToAddress,
				Description:  t.Description,
				TokenAddress: t.TokenAddress,
				TokenSymbol:  t.TokenSymbol,
				Amount:       t.Amount,
				FeeNative:    t.FeeETH,
				FeeETH:       t.FeeETH,
				FeeUSD:       t.FeeUSD,
				USDAmount:    t.USDAmount,
				Network:      t.Network,
				Direction:    t.Direction,
				State:        t.State,
				BlockNumber:  t.BlockNumber,
				TimestampMs:  timestampMs,
				Timestamp:    timestampMs,
			})
		}
		writeSuccess(w, r, http.StatusOK, types.TransactionListResponse{
			Address:      address,
			Direction:    direction,
			Transactions: items,
			Total:        total,
			Limit:        limit,
			Offset:       offset,
		})
	}
}

// ---------------------------------------------------------------------------
// Transaction announce
// ---------------------------------------------------------------------------

// AnnounceTransaction handles POST /v1/transactions/announce.
func (a *API) AnnounceTransaction() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", false)
			return
		}
		var req types.TransactionAnnounceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, r, http.StatusBadRequest, "invalid_body", "invalid JSON body", false)
			return
		}
		req.TxHash = strings.TrimSpace(strings.ToLower(req.TxHash))
		req.FromAddress = strings.TrimSpace(strings.ToLower(req.FromAddress))
		req.ToAddress = strings.TrimSpace(strings.ToLower(req.ToAddress))
		req.TokenSymbol = strings.TrimSpace(strings.ToUpper(req.TokenSymbol))
		req.TokenAddress = strings.TrimSpace(strings.ToLower(req.TokenAddress))
		req.Network = strings.TrimSpace(req.Network)
		req.Amount = strings.TrimSpace(req.Amount)
		if req.TxHash == "" || req.FromAddress == "" || req.ToAddress == "" || req.TokenSymbol == "" || req.Amount == "" || req.Network == "" {
			writeError(w, r, http.StatusBadRequest, "missing_fields", "txHash, fromAddress, toAddress, tokenSymbol, amount, and network are required", false)
			return
		}
		if req.TimestampMs == 0 && req.Timestamp != 0 {
			req.TimestampMs = req.Timestamp
		}
		if req.TimestampMs != 0 && req.TimestampMs < 1_000_000_000_000 {
			req.TimestampMs *= 1000
		}
		if req.TimestampMs == 0 {
			req.TimestampMs = time.Now().UnixMilli()
		}
		req.Timestamp = req.TimestampMs

		creditDescription := services.DescribeTransfer("credit", req.TokenSymbol, req.FromAddress, req.ToAddress)
		debitDescription := services.DescribeTransfer("debit", req.TokenSymbol, req.FromAddress, req.ToAddress)

		credit := store.TransactionItem{
			WalletAddress: req.ToAddress,
			TxHash:        req.TxHash,
			FromAddress:   req.FromAddress,
			ToAddress:     req.ToAddress,
			Description:   creditDescription,
			TokenAddress:  req.TokenAddress,
			TokenSymbol:   req.TokenSymbol,
			Amount:        req.Amount,
			Network:       req.Network,
			Direction:     "credit",
			State:         "completed",
			BlockNumber:   0,
			Timestamp:     req.TimestampMs,
			FetchedAt:     time.Now().UnixMilli(),
		}
		debit := store.TransactionItem{
			WalletAddress: req.FromAddress,
			TxHash:        req.TxHash,
			FromAddress:   req.FromAddress,
			ToAddress:     req.ToAddress,
			Description:   debitDescription,
			TokenAddress:  req.TokenAddress,
			TokenSymbol:   req.TokenSymbol,
			Amount:        req.Amount,
			Network:       req.Network,
			Direction:     "debit",
			State:         "completed",
			BlockNumber:   0,
			Timestamp:     req.TimestampMs,
			FetchedAt:     time.Now().UnixMilli(),
		}

		if err := a.store.UpsertTransaction(r.Context(), credit); err != nil {
			writeError(w, r, http.StatusInternalServerError, "announce_failed", "failed to announce credit transaction", true)
			return
		}
		if err := a.store.UpsertTransaction(r.Context(), debit); err != nil {
			writeError(w, r, http.StatusInternalServerError, "announce_failed", "failed to announce debit transaction", true)
			return
		}

		writeSuccess(w, r, http.StatusCreated, types.TransactionAnnounceResponse{
			TxHash:      req.TxHash,
			Network:     req.Network,
			TimestampMs: req.TimestampMs,
			Timestamp:   req.TimestampMs,
			Announced:   true,
		})
	}
}

func normalizeTimestampMs(value int64) int64 {
	if value > 0 && value < 1_000_000_000_000 {
		return value * 1000
	}
	return value
}

// ---------------------------------------------------------------------------
// FX rates
// ---------------------------------------------------------------------------

// GetLatestFX handles GET /v1/fx/latest?pair=USD/ZAR
func (a *API) GetLatestFX() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, r, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed", false)
			return
		}
		pair := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("pair")))
		if pair == "" {
			writeError(w, r, http.StatusBadRequest, "missing_pair", "pair query param is required (e.g. USD/ZAR)", false)
			return
		}

		rate, err := a.store.LatestFXRate(r.Context(), pair)
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, r, http.StatusNotFound, "not_found", "no rate found for pair "+pair, false)
			return
		}
		if err != nil {
			writeError(w, r, http.StatusInternalServerError, "fetch_failed", "failed to fetch FX rate", true)
			return
		}
		writeSuccess(w, r, http.StatusOK, types.FXLatestResponse{
			Pair:      rate.Pair,
			Rate:      rate.Rate,
			FetchedAt: rate.FetchedAt,
		})
	}
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

func requestID(r *http.Request) string {
	if id := r.Header.Get("X-Request-ID"); id != "" {
		return id
	}
	return ""
}

func writeSuccess(w http.ResponseWriter, r *http.Request, status int, data any) {
	writeJSON(w, status, types.APISuccessResponse{
		Data:      data,
		RequestID: requestID(r),
	})
}

func writeError(w http.ResponseWriter, r *http.Request, status int, code, message string, retryable bool) {
	writeJSON(w, status, types.APIErrorResponse{
		Error:     types.ErrorEnvelope{Code: code, Message: message, Retryable: retryable},
		RequestID: requestID(r),
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
