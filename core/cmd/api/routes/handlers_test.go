package routes

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/store"
	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/types"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type successEnvelope[T any] struct {
	Data T `json:"data"`
}

func performJSONRequest(t *testing.T, handler http.HandlerFunc, method, path string, body any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var payload []byte
	var err error
	if body != nil {
		if payload, err = json.Marshal(body); err != nil {
			t.Fatalf("failed to marshal body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}

func decodeSuccess[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var env successEnvelope[T]
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode success body: %v", err)
	}
	return env.Data
}

// newFirestoreAPIForTest skips the test if POCKET_TEST_FIREBASE_PROJECT_ID is
// not set. It connects to Firestore (emulator when FIRESTORE_EMULATOR_HOST is
// set) and closes the store on cleanup.
func newFirestoreAPIForTest(t *testing.T) *API {
	t.Helper()
	projectID := strings.TrimSpace(os.Getenv("POCKET_TEST_FIREBASE_PROJECT_ID"))
	if projectID == "" {
		t.Skip("POCKET_TEST_FIREBASE_PROJECT_ID not set; skipping Firestore integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	apiStore, err := store.NewFirebaseAPIDatabase(ctx, projectID, "")
	if err != nil {
		t.Fatalf("failed to init firestore store: %v", err)
	}
	t.Cleanup(func() {
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = apiStore.Close(shutdownCtx)
	})

	api, err := NewAPI(apiStore)
	if err != nil {
		t.Fatalf("failed to init API: %v", err)
	}
	return api
}

// ---------------------------------------------------------------------------
// Unit tests (no MongoDB required)
// ---------------------------------------------------------------------------

func TestNewAPIRequiresStore(t *testing.T) {
	api, err := NewAPI(nil)
	if err == nil {
		t.Fatal("expected error when store is nil")
	}
	if api != nil {
		t.Fatal("expected nil API when store is nil")
	}
}

func TestHealthHandler(t *testing.T) {
	api, err := NewAPI(&stubStore{})
	if err != nil {
		t.Fatalf("NewAPI() error = %v", err)
	}

	rec := performJSONRequest(t, api.Health(), http.MethodGet, "/health", nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	data := decodeSuccess[types.HealthResponse](t, rec)
	if !data.OK {
		t.Fatal("expected ok=true in health response")
	}
}

func TestHealthHandlerMethodNotAllowed(t *testing.T) {
	api, _ := NewAPI(&stubStore{})
	rec := performJSONRequest(t, api.Health(), http.MethodPost, "/health", nil, nil)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d", rec.Code)
	}
}

func TestSaveWalletMissingFields(t *testing.T) {
	api, _ := NewAPI(&stubStore{})
	rec := performJSONRequest(t, api.SaveWallet(), http.MethodPost, "/v1/wallets", map[string]string{"address": ""}, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetBalancesMissingAddress(t *testing.T) {
	api, _ := NewAPI(&stubStore{})
	rec := performJSONRequest(t, api.GetBalances(), http.MethodGet, "/v1/balances", nil, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestListTransactionsMissingAddress(t *testing.T) {
	api, _ := NewAPI(&stubStore{})
	rec := performJSONRequest(t, api.ListTransactions(), http.MethodGet, "/v1/transactions", nil, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestListTransactionsInvalidDirection(t *testing.T) {
	api, _ := NewAPI(&stubStore{})
	rec := performJSONRequest(t, api.ListTransactions(), http.MethodGet, "/v1/transactions?address=0x1&direction=unknown", nil, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetLatestFXMissingPair(t *testing.T) {
	api, _ := NewAPI(&stubStore{})
	rec := performJSONRequest(t, api.GetLatestFX(), http.MethodGet, "/v1/fx/latest", nil, nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", rec.Code, rec.Body.String())
	}
}

func TestGetLatestFXNotFound(t *testing.T) {
	api, _ := NewAPI(&stubStore{})
	rec := performJSONRequest(t, api.GetLatestFX(), http.MethodGet, "/v1/fx/latest?pair=USD/XYZ", nil, nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", rec.Code, rec.Body.String())
	}
}

// ---------------------------------------------------------------------------
// MongoDB integration tests
// ---------------------------------------------------------------------------

func TestSaveAndListWalletsIntegration(t *testing.T) {
	api := newFirestoreAPIForTest(t)

	saveRec := performJSONRequest(t, api.SaveWallet(), http.MethodPost, "/v1/wallets", map[string]string{
		"address": "0x000000000000000000000000000000000000dEaD",
		"network": "ethereum-sepolia",
	}, nil)
	if saveRec.Code != http.StatusCreated {
		t.Fatalf("save wallet expected 201, got %d body=%s", saveRec.Code, saveRec.Body.String())
	}

	listRec := performJSONRequest(t, api.GetWallets(), http.MethodGet, "/v1/wallets/", nil, nil)
	if listRec.Code != http.StatusOK {
		t.Fatalf("list wallets expected 200, got %d body=%s", listRec.Code, listRec.Body.String())
	}

	data := decodeSuccess[types.WalletListResponse](t, listRec)
	if len(data.Wallets) != 1 {
		t.Fatalf("expected 1 wallet, got %d", len(data.Wallets))
	}
	if data.Wallets[0].Network != "ethereum-sepolia" {
		t.Fatalf("unexpected network: %s", data.Wallets[0].Network)
	}
}

func TestListTransactionsEmptyIntegration(t *testing.T) {
	api := newFirestoreAPIForTest(t)

	rec := performJSONRequest(t, api.ListTransactions(), http.MethodGet,
		"/v1/transactions?address=0x000000000000000000000000000000000000dEaD", nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}

	data := decodeSuccess[types.TransactionListResponse](t, rec)
	if data.Total != 0 {
		t.Fatalf("expected 0 transactions, got %d", data.Total)
	}
}

func TestGetLatestFXIntegration(t *testing.T) {
	api := newFirestoreAPIForTest(t)

	// Manually upsert via the store adapter inside the API
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = api.store.UpsertFXRate(ctx, "USD/ZAR", "18.50", time.Now().Unix())

	rec := performJSONRequest(t, api.GetLatestFX(), http.MethodGet, "/v1/fx/latest?pair=USD/ZAR", nil, nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rec.Code, rec.Body.String())
	}
	data := decodeSuccess[types.FXLatestResponse](t, rec)
	if data.Rate != "18.50" {
		t.Fatalf("expected rate 18.50, got %s", data.Rate)
	}
}

// ---------------------------------------------------------------------------
// Stub store for unit tests
// ---------------------------------------------------------------------------

type stubStore struct{}

func (s *stubStore) SaveWallet(ctx context.Context, w store.WalletRecord) error { return nil }
func (s *stubStore) ListWallets(ctx context.Context) ([]store.WalletRecord, error) {
	return nil, nil
}
func (s *stubStore) ListWalletAddresses(ctx context.Context) ([]string, error)        { return nil, nil }
func (s *stubStore) UpsertBalance(ctx context.Context, b store.BalanceSnapshot) error { return nil }
func (s *stubStore) GetLatestBalances(ctx context.Context, address, network string) ([]store.BalanceSnapshot, error) {
	return nil, nil
}
func (s *stubStore) UpsertTransaction(ctx context.Context, t store.TransactionItem) error {
	return nil
}
func (s *stubStore) ListTransactions(ctx context.Context, address, direction string, limit, offset int) ([]store.TransactionItem, int64, error) {
	return nil, 0, nil
}
func (s *stubStore) UpsertFXRate(ctx context.Context, pair, rate string, fetchedAt int64) error {
	return nil
}
func (s *stubStore) LatestFXRate(ctx context.Context, pair string) (*store.FXRate, error) {
	return nil, store.ErrNotFound
}
func (s *stubStore) Close(ctx context.Context) error { return nil }
