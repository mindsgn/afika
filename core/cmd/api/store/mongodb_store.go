package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	mongoCollectionUsers          = "users"
	mongoCollectionEmailTransfers = "email_transfers"
	mongoCollectionFXRates        = "fx_rates"
)

type mongoUser struct {
	ID        string `bson:"_id"`
	Email     string `bson:"email"`
	Address   string `bson:"address"`
	CreatedAt int64  `bson:"createdAt"`
}

type mongoEmailTransfer struct {
	ID            string `bson:"_id"`
	FromEmail     string `bson:"fromEmail"`
	ToEmail       string `bson:"toEmail"`
	AmountUSDC    string `bson:"amountUsdc"`
	Status        string `bson:"status"`
	OnchainTxHash string `bson:"onchainTxHash,omitempty"`
	CreatedAt     int64  `bson:"createdAt"`
	UpdatedAt     int64  `bson:"updatedAt"`
}

type mongoFXRate struct {
	ID        string `bson:"_id"`
	Pair      string `bson:"pair"`
	Rate      string `bson:"rate"`
	FetchedAt int64  `bson:"fetchedAt"`
}

// MongoAPIDatabase is a MongoDB-backed APIDatabase implementation.
type MongoAPIDatabase struct {
	client *mongo.Client
	db     *mongo.Database
}

func NewMongoAPIDatabase(ctx context.Context, uri, dbName string) (*MongoAPIDatabase, error) {
	uri = strings.TrimSpace(uri)
	dbName = strings.TrimSpace(dbName)
	if uri == "" {
		return nil, errors.New("mongo api store: uri is required")
	}
	if dbName == "" {
		return nil, errors.New("mongo api store: dbName is required")
	}

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}

	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}

	store := &MongoAPIDatabase{
		client: client,
		db:     client.Database(dbName),
	}

	if err := store.ensureIndexes(ctx); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}

	return store, nil
}

func (m *MongoAPIDatabase) ensureIndexes(ctx context.Context) error {
	_, err := m.db.Collection(mongoCollectionUsers).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "email", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("idx_users_email_unique"),
		},
	})
	if err != nil {
		return err
	}

	_, err = m.db.Collection(mongoCollectionEmailTransfers).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "toEmail", Value: 1}, {Key: "status", Value: 1}},
			Options: options.Index().SetName("idx_email_transfers_recipient_status"),
		},
	})
	if err != nil {
		return err
	}

	_, err = m.db.Collection(mongoCollectionFXRates).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "pair", Value: 1}, {Key: "fetchedAt", Value: -1}},
			Options: options.Index().SetName("idx_fx_rates_pair_time"),
		},
	})
	return err
}

func (m *MongoAPIDatabase) InsertUserIfMissing(ctx context.Context, email, address string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	address = strings.TrimSpace(address)
	if email == "" || address == "" {
		return errors.New("email and address are required")
	}

	now := time.Now().Unix()
	_, err := m.db.Collection(mongoCollectionUsers).UpdateOne(
		ctx,
		bson.M{"email": email},
		bson.M{"$setOnInsert": bson.M{
			"_id":       uuid.NewString(),
			"email":     email,
			"address":   address,
			"createdAt": now,
		}},
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return err
	}
	return nil
}

func (m *MongoAPIDatabase) FindUserByEmail(ctx context.Context, email string) (*User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, errors.New("email is required")
	}

	var doc mongoUser
	err := m.db.Collection(mongoCollectionUsers).FindOne(ctx, bson.M{"email": email}).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &User{
		Email:     doc.Email,
		Address:   doc.Address,
		CreatedAt: doc.CreatedAt,
	}, nil
}

func (m *MongoAPIDatabase) InsertEmailTransfer(ctx context.Context, t *EmailTransfer) error {
	if t == nil {
		return errors.New("email transfer is required")
	}
	if strings.TrimSpace(t.FromEmail) == "" || strings.TrimSpace(t.ToEmail) == "" || strings.TrimSpace(t.AmountUSDC) == "" {
		return errors.New("fromEmail, toEmail, and amountUsdc are required")
	}

	now := time.Now().Unix()
	if strings.TrimSpace(t.ID) == "" {
		t.ID = uuid.NewString()
	}
	if t.Status == "" {
		t.Status = "pending"
	}
	if t.CreatedAt == 0 {
		t.CreatedAt = now
	}
	t.UpdatedAt = now

	doc := mongoEmailTransfer{
		ID:            t.ID,
		FromEmail:     strings.TrimSpace(strings.ToLower(t.FromEmail)),
		ToEmail:       strings.TrimSpace(strings.ToLower(t.ToEmail)),
		AmountUSDC:    strings.TrimSpace(t.AmountUSDC),
		Status:        strings.TrimSpace(t.Status),
		OnchainTxHash: strings.TrimSpace(t.OnchainTxHash),
		CreatedAt:     t.CreatedAt,
		UpdatedAt:     t.UpdatedAt,
	}

	if _, err := m.db.Collection(mongoCollectionEmailTransfers).InsertOne(ctx, doc); err != nil {
		return err
	}
	return nil
}

func (m *MongoAPIDatabase) ListPendingEmailTransfersForRecipient(ctx context.Context, email string) ([]*EmailTransfer, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return nil, errors.New("email is required")
	}

	cur, err := m.db.Collection(mongoCollectionEmailTransfers).Find(
		ctx,
		bson.M{"toEmail": email, "status": "pending"},
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}),
	)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	out := make([]*EmailTransfer, 0)
	for cur.Next(ctx) {
		var doc mongoEmailTransfer
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		out = append(out, &EmailTransfer{
			ID:            doc.ID,
			FromEmail:     doc.FromEmail,
			ToEmail:       doc.ToEmail,
			AmountUSDC:    doc.AmountUSDC,
			Status:        doc.Status,
			OnchainTxHash: doc.OnchainTxHash,
			CreatedAt:     doc.CreatedAt,
			UpdatedAt:     doc.UpdatedAt,
		})
	}

	if err := cur.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (m *MongoAPIDatabase) MarkEmailTransfersClaimed(ctx context.Context, email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return errors.New("email is required")
	}

	_, err := m.db.Collection(mongoCollectionEmailTransfers).UpdateMany(
		ctx,
		bson.M{"toEmail": email, "status": "pending"},
		bson.M{"$set": bson.M{"status": "claimed", "updatedAt": time.Now().Unix()}},
	)
	return err
}

func (m *MongoAPIDatabase) LatestFXRate(ctx context.Context, pair string) (*FXRate, error) {
	pair = strings.TrimSpace(strings.ToUpper(pair))
	if pair == "" {
		return nil, errors.New("pair is required")
	}

	var doc mongoFXRate
	err := m.db.Collection(mongoCollectionFXRates).FindOne(
		ctx,
		bson.M{"pair": pair},
		options.FindOne().SetSort(bson.D{{Key: "fetchedAt", Value: -1}}),
	).Decode(&doc)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	return &FXRate{
		Pair:      doc.Pair,
		Rate:      doc.Rate,
		FetchedAt: doc.FetchedAt,
	}, nil
}

func (m *MongoAPIDatabase) Close(ctx context.Context) error {
	if m == nil || m.client == nil {
		return nil
	}
	return m.client.Disconnect(ctx)
}
