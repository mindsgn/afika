package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	colWallets      = "wallets"
	colBalances     = "balances"
	colTransactions = "transactions"
	colFXRates      = "fx_rates"
)

// ---------------------------------------------------------------------------
// Internal BSON types
// ---------------------------------------------------------------------------

type mongoWallet struct {
	ID        string `bson:"_id"`
	Address   string `bson:"address"`
	Network   string `bson:"network"`
	CreatedAt int64  `bson:"createdAt"`
}

type mongoBalance struct {
	ID            string `bson:"_id"` // address:network:tokenAddress
	WalletAddress string `bson:"walletAddress"`
	Network       string `bson:"network"`
	TokenAddress  string `bson:"tokenAddress"`
	TokenSymbol   string `bson:"tokenSymbol"`
	Balance       string `bson:"balance"`
	USDValue      string `bson:"usdValue"`
	FetchedAt     int64  `bson:"fetchedAt"`
}

type mongoTransaction struct {
	ID            string `bson:"_id"` // txHash:walletAddress
	WalletAddress string `bson:"walletAddress"`
	TxHash        string `bson:"txHash"`
	FromAddress   string `bson:"fromAddress"`
	ToAddress     string `bson:"toAddress"`
	TokenAddress  string `bson:"tokenAddress"`
	TokenSymbol   string `bson:"tokenSymbol"`
	Amount        string `bson:"amount"`
	FeeETH        string `bson:"feeEth"`
	FeeUSD        string `bson:"feeUsd"`
	USDAmount     string `bson:"usdAmount"`
	Network       string `bson:"network"`
	Direction     string `bson:"direction"`
	State         string `bson:"state"`
	BlockNumber   uint64 `bson:"blockNumber"`
	Timestamp     int64  `bson:"timestamp"`
	FetchedAt     int64  `bson:"fetchedAt"`
}

type mongoFXRate struct {
	ID        string `bson:"_id"` // pair
	Pair      string `bson:"pair"`
	Rate      string `bson:"rate"`
	FetchedAt int64  `bson:"fetchedAt"`
}

// ---------------------------------------------------------------------------
// MongoAPIDatabase
// ---------------------------------------------------------------------------

// MongoAPIDatabase is a MongoDB-backed APIDatabase.
type MongoAPIDatabase struct {
	client *mongo.Client
	db     *mongo.Database
}

// NewMongoAPIDatabase connects to MongoDB, pings, and ensures indexes.
func NewMongoAPIDatabase(ctx context.Context, uri, dbName string) (*MongoAPIDatabase, error) {
	uri = strings.TrimSpace(uri)
	dbName = strings.TrimSpace(dbName)
	if uri == "" {
		return nil, errors.New("mongo store: uri is required")
	}
	if dbName == "" {
		return nil, errors.New("mongo store: dbName is required")
	}

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, err
	}
	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("mongo store: ping: %w", err)
	}

	s := &MongoAPIDatabase{client: client, db: client.Database(dbName)}
	if err := s.ensureIndexes(ctx); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, err
	}
	return s, nil
}

func (m *MongoAPIDatabase) ensureIndexes(ctx context.Context) error {
	// wallets: unique on (address, network)
	_, err := m.db.Collection(colWallets).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "address", Value: 1}, {Key: "network", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("idx_wallets_address_network"),
		},
	})
	if err != nil {
		return fmt.Errorf("mongo store: wallet index: %w", err)
	}

	// balances: unique on _id already; secondary index for queries
	_, err = m.db.Collection(colBalances).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "walletAddress", Value: 1}, {Key: "network", Value: 1}},
			Options: options.Index().SetName("idx_balances_wallet_network"),
		},
	})
	if err != nil {
		return fmt.Errorf("mongo store: balance index: %w", err)
	}

	// transactions
	_, err = m.db.Collection(colTransactions).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "walletAddress", Value: 1}, {Key: "timestamp", Value: -1}},
			Options: options.Index().SetName("idx_tx_wallet_time"),
		},
		{
			Keys:    bson.D{{Key: "walletAddress", Value: 1}, {Key: "direction", Value: 1}, {Key: "timestamp", Value: -1}},
			Options: options.Index().SetName("idx_tx_wallet_direction_time"),
		},
	})
	if err != nil {
		return fmt.Errorf("mongo store: tx index: %w", err)
	}

	// fx_rates
	_, err = m.db.Collection(colFXRates).Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "pair", Value: 1}},
			Options: options.Index().SetUnique(true).SetName("idx_fx_pair_unique"),
		},
	})
	if err != nil {
		return fmt.Errorf("mongo store: fx index: %w", err)
	}
	return nil
}

// Close disconnects the MongoDB client.
func (m *MongoAPIDatabase) Close(ctx context.Context) error {
	return m.client.Disconnect(ctx)
}

// ---------------------------------------------------------------------------
// Wallets
// ---------------------------------------------------------------------------

func (m *MongoAPIDatabase) SaveWallet(ctx context.Context, w WalletRecord) error {
	id := strings.ToLower(w.Address) + ":" + w.Network
	doc := mongoWallet{
		ID:        id,
		Address:   strings.ToLower(w.Address),
		Network:   w.Network,
		CreatedAt: w.CreatedAt,
	}
	if doc.CreatedAt == 0 {
		doc.CreatedAt = time.Now().Unix()
	}
	filter := bson.M{"_id": id}
	update := bson.M{"$setOnInsert": doc}
	opts := options.UpdateOne().SetUpsert(true)
	_, err := m.db.Collection(colWallets).UpdateOne(ctx, filter, update, opts)
	return err
}

func (m *MongoAPIDatabase) ListWallets(ctx context.Context) ([]WalletRecord, error) {
	cur, err := m.db.Collection(colWallets).Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var results []WalletRecord
	for cur.Next(ctx) {
		var doc mongoWallet
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		results = append(results, WalletRecord{
			Address:   doc.Address,
			Network:   doc.Network,
			CreatedAt: doc.CreatedAt,
		})
	}
	return results, cur.Err()
}

func (m *MongoAPIDatabase) ListWalletAddresses(ctx context.Context) ([]string, error) {
	wallets, err := m.ListWallets(ctx)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{}, len(wallets))
	addrs := make([]string, 0, len(wallets))
	for _, w := range wallets {
		if _, ok := seen[w.Address]; !ok {
			seen[w.Address] = struct{}{}
			addrs = append(addrs, w.Address)
		}
	}
	return addrs, nil
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

func (m *MongoAPIDatabase) UpsertBalance(ctx context.Context, b BalanceSnapshot) error {
	id := fmt.Sprintf("%s:%s:%s", strings.ToLower(b.WalletAddress), b.Network, strings.ToLower(b.TokenAddress))
	doc := mongoBalance{
		ID:            id,
		WalletAddress: strings.ToLower(b.WalletAddress),
		Network:       b.Network,
		TokenAddress:  strings.ToLower(b.TokenAddress),
		TokenSymbol:   b.TokenSymbol,
		Balance:       b.Balance,
		USDValue:      b.USDValue,
		FetchedAt:     b.FetchedAt,
	}
	if doc.FetchedAt == 0 {
		doc.FetchedAt = time.Now().Unix()
	}
	filter := bson.M{"_id": id}
	update := bson.M{"$set": doc}
	_, err := m.db.Collection(colBalances).UpdateOne(ctx, filter, update, options.UpdateOne().SetUpsert(true))
	return err
}

func (m *MongoAPIDatabase) GetLatestBalances(ctx context.Context, address, network string) ([]BalanceSnapshot, error) {
	filter := bson.M{"walletAddress": strings.ToLower(address)}
	if network != "" {
		filter["network"] = network
	}
	cur, err := m.db.Collection(colBalances).Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var results []BalanceSnapshot
	for cur.Next(ctx) {
		var doc mongoBalance
		if err := cur.Decode(&doc); err != nil {
			return nil, err
		}
		results = append(results, BalanceSnapshot{
			WalletAddress: doc.WalletAddress,
			Network:       doc.Network,
			TokenAddress:  doc.TokenAddress,
			TokenSymbol:   doc.TokenSymbol,
			Balance:       doc.Balance,
			USDValue:      doc.USDValue,
			FetchedAt:     doc.FetchedAt,
		})
	}
	return results, cur.Err()
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

func (m *MongoAPIDatabase) UpsertTransaction(ctx context.Context, t TransactionItem) error {
	id := strings.ToLower(t.TxHash) + ":" + strings.ToLower(t.WalletAddress)
	now := time.Now().Unix()
	doc := mongoTransaction{
		ID:            id,
		WalletAddress: strings.ToLower(t.WalletAddress),
		TxHash:        strings.ToLower(t.TxHash),
		FromAddress:   strings.ToLower(t.FromAddress),
		ToAddress:     strings.ToLower(t.ToAddress),
		TokenAddress:  strings.ToLower(t.TokenAddress),
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
		FetchedAt:     now,
	}
	filter := bson.M{"_id": id}
	update := bson.M{"$set": doc}
	_, err := m.db.Collection(colTransactions).UpdateOne(ctx, filter, update, options.UpdateOne().SetUpsert(true))
	return err
}

func (m *MongoAPIDatabase) ListTransactions(
	ctx context.Context,
	address, direction string,
	limit, offset int,
) ([]TransactionItem, int64, error) {
	filter := bson.M{"walletAddress": strings.ToLower(address)}
	if direction == "debit" || direction == "credit" {
		filter["direction"] = direction
	}

	total, err := m.db.Collection(colTransactions).CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	if limit <= 0 {
		limit = 20
	}
	findOpts := options.Find().
		SetSort(bson.D{{Key: "timestamp", Value: -1}}).
		SetSkip(int64(offset)).
		SetLimit(int64(limit))

	cur, err := m.db.Collection(colTransactions).Find(ctx, filter, findOpts)
	if err != nil {
		return nil, 0, err
	}
	defer cur.Close(ctx)

	var results []TransactionItem
	for cur.Next(ctx) {
		var doc mongoTransaction
		if err := cur.Decode(&doc); err != nil {
			return nil, 0, err
		}
		results = append(results, TransactionItem{
			WalletAddress: doc.WalletAddress,
			TxHash:        doc.TxHash,
			FromAddress:   doc.FromAddress,
			ToAddress:     doc.ToAddress,
			TokenAddress:  doc.TokenAddress,
			TokenSymbol:   doc.TokenSymbol,
			Amount:        doc.Amount,
			FeeETH:        doc.FeeETH,
			FeeUSD:        doc.FeeUSD,
			USDAmount:     doc.USDAmount,
			Network:       doc.Network,
			Direction:     doc.Direction,
			State:         doc.State,
			BlockNumber:   doc.BlockNumber,
			Timestamp:     doc.Timestamp,
			FetchedAt:     doc.FetchedAt,
		})
	}
	return results, total, cur.Err()
}

// ---------------------------------------------------------------------------
// FX rates
// ---------------------------------------------------------------------------

func (m *MongoAPIDatabase) UpsertFXRate(ctx context.Context, pair, rate string, fetchedAt int64) error {
	doc := mongoFXRate{ID: pair, Pair: pair, Rate: rate, FetchedAt: fetchedAt}
	filter := bson.M{"_id": pair}
	update := bson.M{"$set": doc}
	_, err := m.db.Collection(colFXRates).UpdateOne(ctx, filter, update, options.UpdateOne().SetUpsert(true))
	return err
}

func (m *MongoAPIDatabase) LatestFXRate(ctx context.Context, pair string) (*FXRate, error) {
	var doc mongoFXRate
	err := m.db.Collection(colFXRates).FindOne(ctx, bson.M{"_id": pair}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &FXRate{Pair: doc.Pair, Rate: doc.Rate, FetchedAt: doc.FetchedAt}, nil
}
