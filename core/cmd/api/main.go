package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/middleware"
	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/routes"
	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/store"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/services"
)

// ---------------------------------------------------------------------------
// Store adapters — bridge between services types and store types
// ---------------------------------------------------------------------------

type balanceStoreAdapter struct{ db *store.MongoAPIDatabase }

func (a *balanceStoreAdapter) ListWalletAddresses(ctx context.Context) ([]string, error) {
	return a.db.ListWalletAddresses(ctx)
}

func (a *balanceStoreAdapter) UpsertBalance(ctx context.Context, b services.BalanceSnapshot) error {
	return a.db.UpsertBalance(ctx, store.BalanceSnapshot{
		WalletAddress: b.WalletAddress,
		Network:       b.Network,
		TokenAddress:  b.TokenAddress,
		TokenSymbol:   b.TokenSymbol,
		Balance:       b.RawBalance,
		USDValue:      b.USDValue,
		FetchedAt:     b.FetchedAt,
	})
}

type txStoreAdapter struct{ db *store.MongoAPIDatabase }

func (a *txStoreAdapter) ListWalletAddresses(ctx context.Context) ([]string, error) {
	return a.db.ListWalletAddresses(ctx)
}

func (a *txStoreAdapter) UpsertTransaction(ctx context.Context, t services.TxRecord) error {
	return a.db.UpsertTransaction(ctx, store.TransactionItem{
		WalletAddress: t.WalletAddress,
		TxHash:        t.TxHash,
		FromAddress:   t.FromAddress,
		ToAddress:     t.ToAddress,
		TokenAddress:  t.TokenAddress,
		TokenSymbol:   t.TokenSymbol,
		Amount:        t.Amount,
		FeeETH:        t.FeeETH,
		FeeUSD:        t.FeeUSD,
		USDAmount:     t.USDAmount,
		Network:       t.Network,
		Direction:     t.Direction,
		State:         t.State,
		BlockNumber:   t.BlockNumber,
		Timestamp:     t.Timestamp,
	})
}

func main() {
	addr := envOrDefault("POCKET_API_ADDR", ":8080")
	apiKey := strings.TrimSpace(os.Getenv("POCKET_API_KEY"))
	rateLimit := envInt("POCKET_API_RATE_LIMIT_RPM", 120)

	mongoURI := envOrDefault("POCKET_API_MONGO_URI", "mongodb://localhost:27017")
	mongoDBName := envOrDefault("POCKET_API_MONGO_DB_NAME", "pocket_api")

	alchemyKey := strings.TrimSpace(os.Getenv("POCKET_ALCHEMY_API_KEY"))
	if alchemyKey == "" {
		log.Println("warning: POCKET_ALCHEMY_API_KEY is empty; balance and transaction workers will not run")
	}

	startupCtx, startupCancel := context.WithTimeout(context.Background(),
		time.Duration(envInt("POCKET_API_MONGO_CONNECT_TIMEOUT_SECONDS", 15))*time.Second)
	defer startupCancel()

	apiStore, err := store.NewMongoAPIDatabase(startupCtx, mongoURI, mongoDBName)
	if err != nil {
		log.Fatalf("failed to initialize mongo store: %v", err)
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = apiStore.Close(shutdownCtx)
	}()

	// ---------------------------------------------------------------------------
	// Background workers
	// ---------------------------------------------------------------------------
	workerCtx, workerCancel := context.WithCancel(context.Background())
	defer workerCancel()

	// Forex worker: always on, no API key required.
	go services.RunForexWorker(workerCtx, apiStore, 15*time.Minute)

	// Build network map from env if Alchemy key is present.
	// Format: POCKET_NETWORKS=networkName1:rpcURL1,networkName2:rpcURL2
	// The rpcURL should include the Alchemy API key in the path.
	networks := parseNetworks(os.Getenv("POCKET_NETWORKS"))
	if alchemyKey != "" && len(networks) > 0 {
		go services.RunBalanceWorker(workerCtx, &balanceStoreAdapter{db: apiStore}, alchemyKey, networks, 5*time.Minute)
		go services.RunTransactionWorker(workerCtx, &txStoreAdapter{db: apiStore}, networks, 5*time.Minute)
	}

	// ---------------------------------------------------------------------------
	// HTTP server
	// ---------------------------------------------------------------------------
	api, err := routes.NewAPI(apiStore)
	if err != nil {
		log.Fatalf("failed to initialise API routes: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/health", api.Health())
	mux.Handle("/v1/wallets", api.SaveWallet())
	mux.Handle("/v1/wallets/", api.GetWallets())
	mux.Handle("/v1/balances", api.GetBalances())
	mux.Handle("/v1/transactions", api.ListTransactions())
	mux.Handle("/v1/fx/latest", api.GetLatestFX())

	limiter := middleware.NewLimiter(rateLimit)
	wrapped := middleware.RequestID(
		middleware.Logging(
			limiter.Middleware(
				middleware.APIKey(apiKey)(mux),
			),
		),
	)

	server := &http.Server{
		Addr:              addr,
		Handler:           wrapped,
		ReadHeaderTimeout: 10 * time.Second,
	}

	if apiKey == "" {
		log.Println("warning: POCKET_API_KEY is empty; auth middleware is disabled")
	}

	log.Printf("pocket-money API listening on %s", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server error: %v", err)
	}
}

// parseNetworks parses "name1:url1,name2:url2" into a map.
func parseNetworks(raw string) map[string]string {
	networks := make(map[string]string)
	for _, entry := range strings.Split(raw, ",") {
		parts := strings.SplitN(strings.TrimSpace(entry), ":", 2)
		if len(parts) == 2 {
			name := strings.TrimSpace(parts[0])
			rpcURL := strings.TrimSpace(parts[1])
			if name != "" && rpcURL != "" {
				networks[name] = rpcURL
			}
		}
	}
	return networks
}

func envInt(name string, fallback int) int {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func envOrDefault(name, fallback string) string {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		return fallback
	}
	return v
}
