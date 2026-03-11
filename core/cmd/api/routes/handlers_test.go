package routes

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/store"
	"github.com/mindsgn-studio/pocket-money-app/core/cmd/api/types"
)

func TestNewAPIRequiresStore(t *testing.T) {
	var apiStore store.APIDatabase
	api, err := NewAPI(apiStore)
	if err == nil {
		t.Fatalf("expected error when store is nil")
	}
	if api != nil {
		t.Fatalf("expected nil api when store is nil")
	}
}

func TestReserveIdempotencyKeyMissing(t *testing.T) {
	api := &API{idempotencySeen: make(map[string]int64)}
	req := httptest.NewRequest(http.MethodPost, "/v1/payments/send-email", nil)
	rec := httptest.NewRecorder()

	ok := api.reserveIdempotencyKey(rec, req, "payments_send_email")
	if ok {
		t.Fatalf("expected false when idempotency key is missing")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
}

func TestReserveIdempotencyKeyDuplicate(t *testing.T) {
	api := &API{idempotencySeen: make(map[string]int64)}

	req1 := httptest.NewRequest(http.MethodPost, "/v1/payments/send-email", nil)
	req1.Header.Set("Idempotency-Key", "abc123")
	req1.Header.Set("X-API-Key", "test-key")
	rec1 := httptest.NewRecorder()

	if !api.reserveIdempotencyKey(rec1, req1, "payments_send_email") {
		t.Fatalf("expected first idempotency key reservation to succeed")
	}

	req2 := httptest.NewRequest(http.MethodPost, "/v1/payments/send-email", nil)
	req2.Header.Set("Idempotency-Key", "abc123")
	req2.Header.Set("X-API-Key", "test-key")
	rec2 := httptest.NewRecorder()

	ok := api.reserveIdempotencyKey(rec2, req2, "payments_send_email")
	if ok {
		t.Fatalf("expected duplicate idempotency key reservation to fail")
	}
	if rec2.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d", http.StatusConflict, rec2.Code)
	}
}

func TestWriteMappedErrorAA23Contract(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/v1/aa/send-sponsored", nil)
	rec := httptest.NewRecorder()

	sourceErr := errors.New("AA23 reverted")
	writeMappedError(rec, req, sourceErr)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected status %d, got %d", http.StatusConflict, rec.Code)
	}

	var payload types.APIErrorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	if payload.Error.Code != "aa23_reverted" {
		t.Fatalf("expected error code aa23_reverted, got %s", payload.Error.Code)
	}
	if payload.Error.Message != sourceErr.Error() {
		t.Fatalf("expected error message %q, got %q", sourceErr.Error(), payload.Error.Message)
	}
	if payload.Error.Retryable {
		t.Fatalf("expected retryable=false, got true")
	}
}
