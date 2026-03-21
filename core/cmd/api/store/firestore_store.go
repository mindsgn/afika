package store

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

type FirebaseAPIDatabase struct {
	client *firestore.Client
}

func NewFirebaseAPIDatabase(ctx context.Context, projectID, credentialsPath string) (*FirebaseAPIDatabase, error) {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, errors.New("firestore store: projectID is required")
	}

	var opts []option.ClientOption
	if strings.TrimSpace(os.Getenv("FIRESTORE_EMULATOR_HOST")) == "" && strings.TrimSpace(credentialsPath) != "" {
		opts = append(opts, option.WithCredentialsFile(credentialsPath))
	}

	client, err := firestore.NewClient(ctx, projectID, opts...)
	if err != nil {
		return nil, err
	}
	return &FirebaseAPIDatabase{client: client}, nil
}

func (f *FirebaseAPIDatabase) Close(ctx context.Context) error {
	if f == nil || f.client == nil {
		return nil
	}
	return f.client.Close()
}

func (f *FirebaseAPIDatabase) SaveWallet(ctx context.Context, w WalletRecord) error {
	address := strings.ToLower(strings.TrimSpace(w.Address))
	network := strings.TrimSpace(w.Network)
	if address == "" || network == "" {
		return errors.New("firestore store: address and network are required")
	}
	if w.CreatedAt == 0 {
		w.CreatedAt = time.Now().Unix()
	}
	_, err := f.client.Collection("wallets").Doc(address).Set(ctx, map[string]any{
		"address":   address,
		"network":   network,
		"createdAt": w.CreatedAt,
	}, firestore.MergeAll)
	return err
}

func (f *FirebaseAPIDatabase) ListWallets(ctx context.Context) ([]WalletRecord, error) {
	iter := f.client.Collection("wallets").Documents(ctx)
	defer iter.Stop()
	var out []WalletRecord
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, err
		}
		data := doc.Data()
		out = append(out, WalletRecord{
			Address:   asString(data["address"], doc.Ref.ID),
			Network:   asString(data["network"], ""),
			CreatedAt: asInt64(data["createdAt"]),
		})
	}
	return out, nil
}

func (f *FirebaseAPIDatabase) ListWalletAddresses(ctx context.Context) ([]string, error) {
	wallets, err := f.ListWallets(ctx)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{}, len(wallets))
	addrs := make([]string, 0, len(wallets))
	for _, w := range wallets {
		if w.Address == "" {
			continue
		}
		if _, ok := seen[w.Address]; ok {
			continue
		}
		seen[w.Address] = struct{}{}
		addrs = append(addrs, w.Address)
	}
	return addrs, nil
}

func (f *FirebaseAPIDatabase) UpsertBalance(ctx context.Context, b BalanceSnapshot) error {
	address := strings.ToLower(strings.TrimSpace(b.WalletAddress))
	network := strings.TrimSpace(b.Network)
	tokenAddr := strings.ToLower(strings.TrimSpace(b.TokenAddress))
	if address == "" || network == "" {
		return errors.New("firestore store: wallet address and network are required")
	}
	docID := network + ":" + tokenAddr
	ref := f.client.Collection("wallets").Doc(address).Collection("balances").Doc(docID)

	existing, err := ref.Get(ctx)
	if err == nil && existing.Exists() {
		data := existing.Data()
		if asString(data["balance"], "") == b.Balance && asString(data["usdValue"], "") == b.USDValue {
			return nil
		}
	}
	if b.FetchedAt == 0 {
		b.FetchedAt = time.Now().UnixMilli()
	}
	_, err = ref.Set(ctx, map[string]any{
		"walletAddress": address,
		"network":       network,
		"tokenAddress":  tokenAddr,
		"tokenSymbol":   b.TokenSymbol,
		"balance":       b.Balance,
		"usdValue":      b.USDValue,
		"fetchedAt":     b.FetchedAt,
	}, firestore.MergeAll)
	return err
}

func (f *FirebaseAPIDatabase) GetLatestBalances(ctx context.Context, address, network string) ([]BalanceSnapshot, error) {
	address = strings.ToLower(strings.TrimSpace(address))
	if address == "" {
		return nil, errors.New("firestore store: address is required")
	}
	query := f.client.Collection("wallets").Doc(address).Collection("balances").Query
	if strings.TrimSpace(network) != "" {
		query = query.Where("network", "==", strings.TrimSpace(network))
	}
	iter := query.Documents(ctx)
	defer iter.Stop()

	var out []BalanceSnapshot
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, err
		}
		data := doc.Data()
		out = append(out, BalanceSnapshot{
			WalletAddress: asString(data["walletAddress"], address),
			Network:       asString(data["network"], ""),
			TokenAddress:  asString(data["tokenAddress"], ""),
			TokenSymbol:   asString(data["tokenSymbol"], ""),
			Balance:       asString(data["balance"], "0"),
			USDValue:      asString(data["usdValue"], ""),
			FetchedAt:     asInt64(data["fetchedAt"]),
		})
	}
	return out, nil
}

func (f *FirebaseAPIDatabase) UpsertTransaction(ctx context.Context, t TransactionItem) error {
	address := strings.ToLower(strings.TrimSpace(t.WalletAddress))
	txHash := strings.ToLower(strings.TrimSpace(t.TxHash))
	if address == "" || txHash == "" {
		return errors.New("firestore store: walletAddress and txHash are required")
	}
	docID := txHash
	if direction := strings.TrimSpace(t.Direction); direction != "" {
		docID = txHash + "_" + direction
	}
	ref := f.client.Collection("wallets").Doc(address).Collection("transactions").Doc(docID)

	existing, err := ref.Get(ctx)
	if err == nil && existing.Exists() {
		data := existing.Data()
		if asString(data["amount"], "") == t.Amount &&
			asString(data["state"], "") == t.State &&
			asString(data["direction"], "") == t.Direction &&
			asString(data["description"], "") == t.Description &&
			asInt64(data["timestamp"]) == t.Timestamp {
			return nil
		}
	}
	if t.FetchedAt == 0 {
		t.FetchedAt = time.Now().UnixMilli()
	}
	if t.Timestamp > 0 && t.Timestamp < 1_000_000_000_000 {
		t.Timestamp *= 1000
	}
	feeNative := strings.TrimSpace(t.FeeETH)
	_, err = ref.Set(ctx, map[string]any{
		"walletAddress": address,
		"txHash":        txHash,
		"fromAddress":   strings.ToLower(strings.TrimSpace(t.FromAddress)),
		"toAddress":     strings.ToLower(strings.TrimSpace(t.ToAddress)),
		"description":   t.Description,
		"tokenAddress":  strings.ToLower(strings.TrimSpace(t.TokenAddress)),
		"tokenSymbol":   t.TokenSymbol,
		"amount":        t.Amount,
		"feeNative":     feeNative,
		"feeEth":        t.FeeETH,
		"feeBase":       t.FeeETH,
		"feeUsd":        t.FeeUSD,
		"usdAmount":     t.USDAmount,
		"network":       t.Network,
		"direction":     t.Direction,
		"state":         t.State,
		"blockNumber":   t.BlockNumber,
		"timestampMs":   t.Timestamp,
		"timestamp":     t.Timestamp,
		"fetchedAt":     t.FetchedAt,
	}, firestore.MergeAll)
	if err != nil {
		return err
	}

	historyID := fmt.Sprintf("%d_%s_%s", t.Timestamp, txHash, strings.TrimSpace(t.Direction))
	historyRef := f.client.Collection("transactionHistory").Doc(address).Collection("records").Doc(historyID)
	_, err = historyRef.Set(ctx, map[string]any{
		"walletAddress": address,
		"txHash":        txHash,
		"fromAddress":   strings.ToLower(strings.TrimSpace(t.FromAddress)),
		"toAddress":     strings.ToLower(strings.TrimSpace(t.ToAddress)),
		"description":   t.Description,
		"tokenAddress":  strings.ToLower(strings.TrimSpace(t.TokenAddress)),
		"tokenSymbol":   t.TokenSymbol,
		"amount":        t.Amount,
		"feeNative":     feeNative,
		"feeUsd":        t.FeeUSD,
		"usdAmount":     t.USDAmount,
		"network":       t.Network,
		"direction":     t.Direction,
		"state":         t.State,
		"blockNumber":   t.BlockNumber,
		"timestampMs":   t.Timestamp,
		"fetchedAt":     t.FetchedAt,
	}, firestore.MergeAll)
	return err
}

func (f *FirebaseAPIDatabase) ListTransactions(ctx context.Context, address, direction string, limit, offset int) ([]TransactionItem, int64, error) {
	address = strings.ToLower(strings.TrimSpace(address))
	if address == "" {
		return nil, 0, errors.New("firestore store: address is required")
	}

	base := f.client.Collection("wallets").Doc(address).Collection("transactions").Query
	if direction == "debit" || direction == "credit" {
		base = base.Where("direction", "==", direction)
	}

	total := int64(0)
	iterTotal := base.Documents(ctx)
	for {
		_, err := iterTotal.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			iterTotal.Stop()
			return nil, 0, err
		}
		total++
	}
	iterTotal.Stop()

	if limit <= 0 {
		limit = 20
	}
	query := base.OrderBy("timestamp", firestore.Desc).Offset(offset).Limit(limit)
	iter := query.Documents(ctx)
	defer iter.Stop()

	results := []TransactionItem{}
	for {
		doc, err := iter.Next()
		if errors.Is(err, iterator.Done) {
			break
		}
		if err != nil {
			return nil, 0, err
		}
		data := doc.Data()
		results = append(results, TransactionItem{
			WalletAddress: asString(data["walletAddress"], address),
			TxHash:        asString(data["txHash"], doc.Ref.ID),
			FromAddress:   asString(data["fromAddress"], ""),
			ToAddress:     asString(data["toAddress"], ""),
			Description:   asString(data["description"], ""),
			TokenAddress:  asString(data["tokenAddress"], ""),
			TokenSymbol:   asString(data["tokenSymbol"], ""),
			Amount:        asString(data["amount"], ""),
			FeeETH:        firstNonEmpty(asString(data["feeNative"], ""), asString(data["feeBase"], ""), asString(data["feeEth"], "")),
			FeeUSD:        asString(data["feeUsd"], ""),
			USDAmount:     asString(data["usdAmount"], ""),
			Network:       asString(data["network"], ""),
			Direction:     asString(data["direction"], ""),
			State:         asString(data["state"], ""),
			BlockNumber:   asUint64(data["blockNumber"]),
			Timestamp:     normalizeTimestampMs(asInt64(data["timestampMs"]), asInt64(data["timestamp"])),
			FetchedAt:     asInt64(data["fetchedAt"]),
		})
	}
	return results, total, nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func normalizeTimestampMs(ms, fallback int64) int64 {
	if ms > 0 {
		if ms < 1_000_000_000_000 {
			return ms * 1000
		}
		return ms
	}
	if fallback > 0 && fallback < 1_000_000_000_000 {
		return fallback * 1000
	}
	return fallback
}

func (f *FirebaseAPIDatabase) UpsertFXRate(ctx context.Context, pair, rate string, fetchedAt int64) error {
	pair = strings.ToUpper(strings.TrimSpace(pair))
	if pair == "" {
		return errors.New("firestore store: pair is required")
	}
	if fetchedAt == 0 {
		fetchedAt = time.Now().UnixMilli()
	}
	key := fxPairKey(pair)
	_, err := f.client.Collection("fxRates").Doc(key).Set(ctx, map[string]any{
		"pair":      pair,
		"rate":      rate,
		"fetchedAt": fetchedAt,
	}, firestore.MergeAll)
	return err
}

func (f *FirebaseAPIDatabase) LatestFXRate(ctx context.Context, pair string) (*FXRate, error) {
	pair = strings.ToUpper(strings.TrimSpace(pair))
	if pair == "" {
		return nil, ErrNotFound
	}
	key := fxPairKey(pair)
	doc, err := f.client.Collection("fxRates").Doc(key).Get(ctx)
	if err != nil {
		return nil, err
	}
	if !doc.Exists() {
		return nil, ErrNotFound
	}
	data := doc.Data()
	return &FXRate{
		Pair:      asString(data["pair"], pair),
		Rate:      asString(data["rate"], ""),
		FetchedAt: asInt64(data["fetchedAt"]),
	}, nil
}

func fxPairKey(pair string) string {
	return strings.ReplaceAll(pair, "/", "_")
}

func asString(v any, fallback string) string {
	if v == nil {
		return fallback
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fallback
}

func asInt64(v any) int64 {
	switch t := v.(type) {
	case int64:
		return t
	case int:
		return int64(t)
	case float64:
		return int64(t)
	case float32:
		return int64(t)
	}
	return 0
}

func asUint64(v any) uint64 {
	switch t := v.(type) {
	case uint64:
		return t
	case int64:
		if t < 0 {
			return 0
		}
		return uint64(t)
	case int:
		if t < 0 {
			return 0
		}
		return uint64(t)
	case float64:
		if t < 0 {
			return 0
		}
		return uint64(t)
	}
	return 0
}
