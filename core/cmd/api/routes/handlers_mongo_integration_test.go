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

	"github.com/google/uuid"
	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/store"
)

type successEnvelope[T any] struct {
	Data T `json:"data"`
}

type registerResponse struct {
	Email   string `json:"email"`
	Address string `json:"address"`
}

type claimResponse struct {
	ClaimedCount int `json:"claimedCount"`
}

type userAddressResponse struct {
	Email   string `json:"email"`
	Address string `json:"address"`
}

func newMongoAPIForTest(t *testing.T) *API {
	t.Helper()

	mongoURI := strings.TrimSpace(os.Getenv("POCKET_TEST_MONGO_URI"))
	if mongoURI == "" {
		t.Skip("POCKET_TEST_MONGO_URI not set; skipping MongoDB integration test")
	}

	dbName := "pocket_api_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	apiStore, err := store.NewMongoAPIDatabase(ctx, mongoURI, dbName)
	if err != nil {
		t.Fatalf("failed to init mongo store: %v", err)
	}
	if apiStore == nil {
		t.Fatalf("mongo store is nil")
	}

	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cleanupCancel()
		_ = apiStore.Close(cleanupCtx)
	})

	api, err := NewAPI(apiStore)
	if err != nil {
		t.Fatalf("failed to init api: %v", err)
	}
	return api
}

func performJSONRequest(t *testing.T, handler http.HandlerFunc, method string, path string, body any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	var err error
	if body != nil {
		payload, err = json.Marshal(body)
		if err != nil {
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
	var payload successEnvelope[T]
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode success body: %v", err)
	}
	return payload.Data
}

func TestRegisterAndLookupUserMongoIntegration(t *testing.T) {
	api := newMongoAPIForTest(t)
	email := "integration-user@example.com"
	address := "0x000000000000000000000000000000000000dEaD"

	registerRec := performJSONRequest(t, api.RegisterUser(), http.MethodPost, "/v1/users/register", map[string]string{
		"email":   email,
		"address": address,
	}, nil)
	if registerRec.Code != http.StatusOK {
		t.Fatalf("register expected %d got %d body=%s", http.StatusOK, registerRec.Code, registerRec.Body.String())
	}

	registerData := decodeSuccess[registerResponse](t, registerRec)
	if registerData.Email != strings.ToLower(email) {
		t.Fatalf("expected normalized email %s got %s", strings.ToLower(email), registerData.Email)
	}

	lookupRec := performJSONRequest(t, api.GetUserAddress(), http.MethodGet, "/v1/users/address?email="+email, nil, nil)
	if lookupRec.Code != http.StatusOK {
		t.Fatalf("lookup expected %d got %d body=%s", http.StatusOK, lookupRec.Code, lookupRec.Body.String())
	}

	lookupData := decodeSuccess[userAddressResponse](t, lookupRec)
	if lookupData.Address != address {
		t.Fatalf("expected address %s got %s", address, lookupData.Address)
	}
}

func TestSendAndClaimMongoIntegration(t *testing.T) {
	api := newMongoAPIForTest(t)
	recipient := "claim-target@example.com"

	sendBody := map[string]string{
		"fromEmail":  "alice@example.com",
		"toEmail":    recipient,
		"amountUsdc": "5",
	}

	sendRec1 := performJSONRequest(t, api.SendEmailPayment(), http.MethodPost, "/v1/payments/send-email", sendBody, map[string]string{
		"Idempotency-Key": "send-1",
	})
	if sendRec1.Code != http.StatusOK {
		t.Fatalf("send #1 expected %d got %d body=%s", http.StatusOK, sendRec1.Code, sendRec1.Body.String())
	}

	sendRec2 := performJSONRequest(t, api.SendEmailPayment(), http.MethodPost, "/v1/payments/send-email", map[string]string{
		"fromEmail":  "bob@example.com",
		"toEmail":    recipient,
		"amountUsdc": "7",
	}, map[string]string{
		"Idempotency-Key": "send-2",
	})
	if sendRec2.Code != http.StatusOK {
		t.Fatalf("send #2 expected %d got %d body=%s", http.StatusOK, sendRec2.Code, sendRec2.Body.String())
	}

	sendDup := performJSONRequest(t, api.SendEmailPayment(), http.MethodPost, "/v1/payments/send-email", sendBody, map[string]string{
		"Idempotency-Key": "send-1",
	})
	if sendDup.Code != http.StatusConflict {
		t.Fatalf("duplicate send expected %d got %d body=%s", http.StatusConflict, sendDup.Code, sendDup.Body.String())
	}

	claimRec := performJSONRequest(t, api.ClaimPayments(), http.MethodPost, "/v1/payments/claim", map[string]string{
		"email": recipient,
	}, map[string]string{
		"Idempotency-Key": "claim-1",
	})
	if claimRec.Code != http.StatusOK {
		t.Fatalf("claim expected %d got %d body=%s", http.StatusOK, claimRec.Code, claimRec.Body.String())
	}

	claimData := decodeSuccess[claimResponse](t, claimRec)
	if claimData.ClaimedCount != 2 {
		t.Fatalf("expected claimed count 2 got %d", claimData.ClaimedCount)
	}

	claimRecAgain := performJSONRequest(t, api.ClaimPayments(), http.MethodPost, "/v1/payments/claim", map[string]string{
		"email": recipient,
	}, map[string]string{
		"Idempotency-Key": "claim-2",
	})
	if claimRecAgain.Code != http.StatusOK {
		t.Fatalf("second claim expected %d got %d body=%s", http.StatusOK, claimRecAgain.Code, claimRecAgain.Body.String())
	}

	claimDataAgain := decodeSuccess[claimResponse](t, claimRecAgain)
	if claimDataAgain.ClaimedCount != 0 {
		t.Fatalf("expected claimed count 0 on second claim got %d", claimDataAgain.ClaimedCount)
	}
}
