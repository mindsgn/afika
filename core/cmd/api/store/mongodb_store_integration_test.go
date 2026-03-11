package store

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
)

func newMongoStoreForTest(t *testing.T) *MongoAPIDatabase {
	t.Helper()

	mongoURI := strings.TrimSpace(os.Getenv("POCKET_TEST_MONGO_URI"))
	if mongoURI == "" {
		t.Skip("POCKET_TEST_MONGO_URI not set; skipping MongoDB integration test")
	}

	dbName := "pocket_store_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	s, err := NewMongoAPIDatabase(ctx, mongoURI, dbName)
	if err != nil {
		t.Fatalf("failed to init mongo store: %v", err)
	}

	t.Cleanup(func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cleanupCancel()
		_ = s.Close(cleanupCtx)
	})
	return s
}

func TestLatestFXRateMongoIntegration(t *testing.T) {
	s := newMongoStoreForTest(t)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	pair := "USDCZAR"
	_, err := s.db.Collection(mongoCollectionFXRates).InsertMany(ctx, []any{
		bson.M{"_id": uuid.NewString(), "pair": pair, "rate": "18.12", "fetchedAt": int64(100)},
		bson.M{"_id": uuid.NewString(), "pair": pair, "rate": "18.45", "fetchedAt": int64(200)},
	})
	if err != nil {
		t.Fatalf("failed to seed fx rates: %v", err)
	}

	rate, err := s.LatestFXRate(ctx, pair)
	if err != nil {
		t.Fatalf("latest fx rate failed: %v", err)
	}
	if rate.Rate != "18.45" {
		t.Fatalf("expected latest rate 18.45 got %s", rate.Rate)
	}
}

func TestInsertUserIfMissingMongoIntegration(t *testing.T) {
	s := newMongoStoreForTest(t)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	email := "dup@example.com"
	address := "0x000000000000000000000000000000000000dEaD"

	if err := s.InsertUserIfMissing(ctx, email, address); err != nil {
		t.Fatalf("insert user first failed: %v", err)
	}
	if err := s.InsertUserIfMissing(ctx, email, address); err != nil {
		t.Fatalf("insert user duplicate failed: %v", err)
	}

	user, err := s.FindUserByEmail(ctx, email)
	if err != nil {
		t.Fatalf("find user failed: %v", err)
	}
	if user.Address != address {
		t.Fatalf("expected %s got %s", address, user.Address)
	}
}
