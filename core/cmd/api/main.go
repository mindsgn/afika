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
)

func main() {
	addr := envOrDefault("POCKET_API_ADDR", ":8080")
	apiKey := strings.TrimSpace(os.Getenv("POCKET_API_KEY"))
	rateLimit := envInt("POCKET_API_RATE_LIMIT_RPM", 120)

	firestoreProject := strings.TrimSpace(os.Getenv("POCKET_API_FIREBASE_PROJECT_ID"))
	firestoreCreds := strings.TrimSpace(os.Getenv("POCKET_API_FIREBASE_CREDENTIALS"))

	startupCtx, startupCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer startupCancel()

	apiStore, err := store.NewFirebaseAPIDatabase(startupCtx, firestoreProject, firestoreCreds)
	if err != nil {
		log.Fatalf("failed to initialize firestore store: %v", err)
	}
	defer func() {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = apiStore.Close(shutdownCtx)
	}()

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
	mux.Handle("/v1/transactions/announce", api.AnnounceTransaction())
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
