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

	mongoURI := envOrDefault("POCKET_API_MONGO_URI", "mongodb://localhost:27017")
	mongoDBName := envOrDefault("POCKET_API_MONGO_DB_NAME", "pocket_api")
	startupTimeout := time.Duration(envInt("POCKET_API_MONGO_CONNECT_TIMEOUT_SECONDS", 15)) * time.Second
	startupCtx, startupCancel := context.WithTimeout(context.Background(), startupTimeout)
	defer startupCancel()

	apiStore, err := store.NewMongoAPIDatabase(startupCtx, mongoURI, mongoDBName)
	if err != nil {
		log.Fatalf("failed to initialize mongo api store: %v", err)
	}
	defer func() {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		_ = apiStore.Close(shutdownCtx)
	}()

	api, err := routes.NewAPI(apiStore)
	if err != nil {
		log.Fatalf("failed to initialize API routes: %v", err)
	}

	mux := http.NewServeMux()
	mux.Handle("/health", api.Health())
	mux.Handle("/v1/users/register", api.RegisterUser())
	mux.Handle("/v1/users/address", api.GetUserAddress())
	mux.Handle("/v1/balances", api.GetBalances())
	mux.Handle("/v1/payments/send-email", api.SendEmailPayment())
	mux.Handle("/v1/payments/claim", api.ClaimPayments())
	mux.Handle("/v1/fx/latest", api.GetLatestFX())

	limiter := middleware.NewLimiter(rateLimit)
	wrapped := middleware.RequestID(middleware.Logging(limiter.Middleware(middleware.APIKey(apiKey)(mux))))

	server := &http.Server{
		Addr:              addr,
		Handler:           wrapped,
		ReadHeaderTimeout: 10 * time.Second,
	}

	if apiKey == "" {
		log.Printf("warning: POCKET_API_KEY is empty; auth is disabled")
	}

	log.Printf("pocket API listening on %s", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server failed: %v", err)
	}
}

func envInt(name string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}

	return parsed
}

func envOrDefault(name, fallback string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}
	return value
}
