package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// FXStore is the minimal interface that the forex worker writes to.
type FXStore interface {
	UpsertFXRate(ctx context.Context, pair, rate string, fetchedAt int64) error
}

// RunForexWorker fetches all current FX rates from Frankfurter every interval
// and upserts them into store. It returns when ctx is cancelled.
// No API key required. Base currencies: USD and EUR.
// Frankfurter API: https://api.frankfurter.dev/v1/latest
func RunForexWorker(ctx context.Context, store FXStore, interval time.Duration) {
	if interval <= 0 {
		interval = 15 * time.Minute
	}
	log.Println("[forex-worker] starting, interval=", interval)
	fetchAndStore(ctx, store)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			log.Println("[forex-worker] stopped")
			return
		case <-ticker.C:
			fetchAndStore(ctx, store)
		}
	}
}

func fetchAndStore(ctx context.Context, store FXStore) {
	rates, err := fetchFrankfurterRates(ctx)
	if err != nil {
		log.Printf("[forex-worker] fetch error: %v", err)
		return
	}
	now := time.Now().UnixMilli()
	saved := 0
	for pair, rate := range rates {
		if err := store.UpsertFXRate(ctx, pair, rate, now); err != nil {
			log.Printf("[forex-worker] upsert %s error: %v", pair, err)
			continue
		}
		saved++
	}
	log.Printf("[forex-worker] saved %d fx rates", saved)
}

// frankFurterResponse is the JSON schema from https://api.frankfurter.dev/v1/latest
type frankfurterResponse struct {
	Base  string             `json:"base"`
	Date  string             `json:"date"`
	Rates map[string]float64 `json:"rates"`
}

// fetchFrankfurterRates returns a flat map of "BASE/QUOTE" to decimal-rate-string
// for USD and EUR base currencies.
func fetchFrankfurterRates(ctx context.Context) (map[string]string, error) {
	bases := []string{"USD", "EUR"}
	combined := make(map[string]string)

	for _, base := range bases {
		url := fmt.Sprintf("https://api.frankfurter.dev/v1/latest?base=%s", base)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Accept", "application/json")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, fmt.Errorf("frankfurter returned HTTP %d", resp.StatusCode)
		}

		var parsed frankfurterResponse
		if err := json.Unmarshal(body, &parsed); err != nil {
			return nil, fmt.Errorf("parse error: %w", err)
		}

		for quote, rate := range parsed.Rates {
			pair := strings.ToUpper(base) + "/" + strings.ToUpper(quote)
			combined[pair] = strconv.FormatFloat(rate, 'f', 8, 64)
		}
		// Also store the reciprocal so USD/USD = 1 is implicit
	}

	return combined, nil
}
