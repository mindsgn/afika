package database

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/argon2"

	_ "github.com/mutecomm/go-sqlcipher/v4"
)

// SecureKeyStore must be implemented by the platform layer (iOS Keychain /
// Android Keystore) to supply a durable master key and KDF salt.
type SecureKeyStore interface {
	GetOrCreateMasterKey(ctx context.Context) ([]byte, error)
	GetOrCreateKDFSalt(ctx context.Context) ([]byte, error)
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

type Wallet struct {
	UUID       string
	Name       string
	WalletType string
	Address    string
}

type WalletSecret struct {
	UUID       string
	Name       string
	WalletType string
	Address    string
	PrivateKey []byte
}

type TransactionRecord struct {
	UUID          string
	WalletAddress string
	TxHash        string
	FromAddress   string
	ToAddress     string
	TokenAddress  string
	TokenSymbol   string
	Amount        string
	FeeETH        string
	FeeUSD        string
	USDAmount     string
	Network       string
	TxMode        string
	State         string
	BlockNumber   uint64
	Timestamp     int64
	CreatedAt     int64
}

type BalanceHistory struct {
	UUID          string
	WalletAddress string
	Network       string
	TokenAddress  string
	TokenSymbol   string
	Balance       string
	USDValue      string
	FetchedAt     int64
}

type WatchedAddress struct {
	UUID      string
	Address   string
	Label     string
	CreatedAt int64
}

type FXRate struct {
	Pair      string
	Rate      string
	FetchedAt int64
}

// ---------------------------------------------------------------------------
// DB handle
// ---------------------------------------------------------------------------

type DB struct {
	sql *sql.DB
}

// Open opens (or creates) the encrypted SQLite database at dir/pocket.db.
func Open(ctx context.Context, dir string, keyStore SecureKeyStore) (*DB, error) {
	if keyStore == nil {
		return nil, errors.New("keyStore is required")
	}
	masterKey, err := keyStore.GetOrCreateMasterKey(ctx)
	if err != nil {
		return nil, fmt.Errorf("master key: %w", err)
	}
	salt, err := keyStore.GetOrCreateKDFSalt(ctx)
	if err != nil {
		return nil, fmt.Errorf("kdf salt: %w", err)
	}

	dbKey := deriveDBKey("pocket-db", masterKey, salt)
	defer zero(dbKey)

	dbPath := filepath.Join(dir, "pocket.db")
	hexKey := hexEncode(dbKey)
	dsn := fmt.Sprintf("%s?_pragma_key=x'%s'&_pragma_cipher_page_size=4096", dbPath, hexKey)
	zero([]byte(hexKey))

	rawDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	rawDB.SetMaxOpenConns(1)

	if err := hardenDatabase(ctx, rawDB); err != nil {
		rawDB.Close()
		return nil, err
	}
	if err := verifyKey(ctx, rawDB); err != nil {
		rawDB.Close()
		return nil, fmt.Errorf("wrong key or corrupt db: %w", err)
	}
	if err := createSchema(ctx, rawDB); err != nil {
		rawDB.Close()
		return nil, err
	}
	return &DB{sql: rawDB}, nil
}

func (d *DB) Close() error { return d.sql.Close() }

// ---------------------------------------------------------------------------
// Wallet methods
// ---------------------------------------------------------------------------

func (d *DB) InsertWallet(ctx context.Context, name, walletType, address string, privateKey []byte) error {
	if d == nil || d.sql == nil {
		return errors.New("database not open")
	}
	id := newID()
	now := time.Now().UnixMilli()
	_, err := d.sql.ExecContext(ctx, `
		INSERT INTO wallet (uuid, name, wallet_type, address, private_key, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, name, walletType, strings.ToLower(address), privateKey, now, now)
	return err
}

func (d *DB) InsertWalletIfMissing(ctx context.Context, name, walletType, address string, privateKey []byte) error {
	exists, err := d.WalletExists(ctx)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}
	return d.InsertWallet(ctx, name, walletType, address, privateKey)
}

func (d *DB) WalletExists(ctx context.Context) (bool, error) {
	var n int
	err := d.sql.QueryRowContext(ctx, `SELECT COUNT(*) FROM wallet`).Scan(&n)
	return n > 0, err
}

func (d *DB) ListWallets(ctx context.Context) ([]Wallet, error) {
	rows, err := d.sql.QueryContext(ctx, `
		SELECT uuid, name, wallet_type, address FROM wallet ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Wallet
	for rows.Next() {
		var w Wallet
		if err := rows.Scan(&w.UUID, &w.Name, &w.WalletType, &w.Address); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

func (d *DB) ListWalletSecrets(ctx context.Context) ([]WalletSecret, error) {
	rows, err := d.sql.QueryContext(ctx, `
		SELECT uuid, name, wallet_type, address, private_key FROM wallet ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []WalletSecret
	for rows.Next() {
		var w WalletSecret
		if err := rows.Scan(&w.UUID, &w.Name, &w.WalletType, &w.Address, &w.PrivateKey); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

func (d *DB) FindWalletSecretByAddress(ctx context.Context, address string) (*WalletSecret, error) {
	var w WalletSecret
	err := d.sql.QueryRowContext(ctx,
		`SELECT uuid, name, wallet_type, address, private_key FROM wallet WHERE address = ? LIMIT 1`,
		strings.ToLower(address)).Scan(&w.UUID, &w.Name, &w.WalletType, &w.Address, &w.PrivateKey)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &w, nil
}

// ---------------------------------------------------------------------------
// Transaction methods
// ---------------------------------------------------------------------------

func (d *DB) InsertTransaction(ctx context.Context, tx TransactionRecord) error {
	if tx.UUID == "" {
		tx.UUID = newID()
	}
	if tx.CreatedAt == 0 {
		tx.CreatedAt = time.Now().UnixMilli()
	}
	_, err := d.sql.ExecContext(ctx, `
		INSERT OR IGNORE INTO transactions (
			uuid, wallet_address, tx_hash, from_address, to_address,
			token_address, token_symbol, amount, fee_eth, fee_usd, usd_amount,
			network, tx_mode, state, block_number, timestamp, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tx.UUID, strings.ToLower(tx.WalletAddress), tx.TxHash,
		strings.ToLower(tx.FromAddress), strings.ToLower(tx.ToAddress),
		strings.ToLower(tx.TokenAddress), tx.TokenSymbol, tx.Amount,
		tx.FeeETH, tx.FeeUSD, tx.USDAmount, tx.Network, tx.TxMode, tx.State,
		tx.BlockNumber, tx.Timestamp, tx.CreatedAt)
	return err
}

func (d *DB) InsertTransactionIfMissing(ctx context.Context, tx TransactionRecord) error {
	return d.InsertTransaction(ctx, tx)
}

func (d *DB) UpdateTransactionState(ctx context.Context, txHash string, state string) error {
	_, err := d.sql.ExecContext(ctx,
		`UPDATE transactions SET state = ? WHERE tx_hash = ?`, state, txHash)
	return err
}

func (d *DB) ListTransactions(ctx context.Context, walletAddress string, token string, limit int, offset int) ([]TransactionRecord, error) {
	query := `SELECT uuid, wallet_address, tx_hash, from_address, to_address,
		token_address, token_symbol, amount, fee_eth, fee_usd, usd_amount,
		network, tx_mode, state, block_number, timestamp, created_at
		FROM transactions WHERE wallet_address = ?`
	args := []any{strings.ToLower(walletAddress)}
	if token != "" {
		query += ` AND token_address = ?`
		args = append(args, strings.ToLower(token))
	}
	query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)
	rows, err := d.sql.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransactionRows(rows)
}

func (d *DB) ListAllTransactions(ctx context.Context, walletAddress string, limit int, offset int) ([]TransactionRecord, error) {
	rows, err := d.sql.QueryContext(ctx, `
		SELECT uuid, wallet_address, tx_hash, from_address, to_address,
			token_address, token_symbol, amount, fee_eth, fee_usd, usd_amount,
			network, tx_mode, state, block_number, timestamp, created_at
		FROM transactions WHERE wallet_address = ?
		ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
		strings.ToLower(walletAddress), limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanTransactionRows(rows)
}

func scanTransactionRows(rows *sql.Rows) ([]TransactionRecord, error) {
	var out []TransactionRecord
	for rows.Next() {
		var t TransactionRecord
		if err := rows.Scan(
			&t.UUID, &t.WalletAddress, &t.TxHash, &t.FromAddress, &t.ToAddress,
			&t.TokenAddress, &t.TokenSymbol, &t.Amount, &t.FeeETH, &t.FeeUSD,
			&t.USDAmount, &t.Network, &t.TxMode, &t.State, &t.BlockNumber,
			&t.Timestamp, &t.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Balance history methods
// ---------------------------------------------------------------------------

func (d *DB) InsertBalanceHistory(ctx context.Context, b BalanceHistory) error {
	if b.UUID == "" {
		b.UUID = newID()
	}
	if b.FetchedAt == 0 {
		b.FetchedAt = time.Now().UnixMilli()
	}
	_, err := d.sql.ExecContext(ctx, `
		INSERT INTO balance_history (uuid, wallet_address, network, token_address, token_symbol, balance, usd_value, fetched_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		b.UUID, strings.ToLower(b.WalletAddress), b.Network,
		strings.ToLower(b.TokenAddress), b.TokenSymbol, b.Balance, b.USDValue, b.FetchedAt)
	return err
}

func (d *DB) InsertBalanceHistoryIfChanged(ctx context.Context, b BalanceHistory) (bool, error) {
	if b.UUID == "" {
		b.UUID = newID()
	}
	if b.FetchedAt == 0 {
		b.FetchedAt = time.Now().UnixMilli()
	}

	latest, err := d.LatestBalanceSnapshot(ctx, b.WalletAddress, b.Network, b.TokenAddress)
	if err != nil {
		return false, err
	}
	if latest != nil && latest.Balance == b.Balance && latest.USDValue == b.USDValue {
		return false, nil
	}
	if err := d.InsertBalanceHistory(ctx, b); err != nil {
		return false, err
	}
	return true, nil
}

func (d *DB) LatestBalanceSnapshot(ctx context.Context, walletAddress, network, tokenAddress string) (*BalanceHistory, error) {
	var b BalanceHistory
	query := `SELECT uuid, wallet_address, network, token_address, token_symbol, balance, usd_value, fetched_at
		FROM balance_history
		WHERE wallet_address = ? AND token_address = ?`
	args := []any{strings.ToLower(walletAddress), strings.ToLower(tokenAddress)}
	if network != "" {
		query += ` AND network = ?`
		args = append(args, network)
	}
	query += ` ORDER BY fetched_at DESC LIMIT 1`
	err := d.sql.QueryRowContext(ctx, query, args...).
		Scan(&b.UUID, &b.WalletAddress, &b.Network, &b.TokenAddress, &b.TokenSymbol, &b.Balance, &b.USDValue, &b.FetchedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (d *DB) ListBalanceHistory(ctx context.Context, walletAddress string, network string, limit int) ([]BalanceHistory, error) {
	query := `SELECT uuid, wallet_address, network, token_address, token_symbol, balance, usd_value, fetched_at
		FROM balance_history WHERE wallet_address = ?`
	args := []any{strings.ToLower(walletAddress)}
	if network != "" {
		query += ` AND network = ?`
		args = append(args, network)
	}
	query += ` ORDER BY fetched_at DESC LIMIT ?`
	args = append(args, limit)
	rows, err := d.sql.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []BalanceHistory
	for rows.Next() {
		var b BalanceHistory
		if err := rows.Scan(&b.UUID, &b.WalletAddress, &b.Network, &b.TokenAddress, &b.TokenSymbol, &b.Balance, &b.USDValue, &b.FetchedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (d *DB) ListLatestBalances(ctx context.Context, walletAddress string, network string) ([]BalanceHistory, error) {
	query := `
		SELECT b.uuid, b.wallet_address, b.network, b.token_address, b.token_symbol, b.balance, b.usd_value, b.fetched_at
		FROM balance_history b
		JOIN (
			SELECT token_address, MAX(fetched_at) AS fetched_at
			FROM balance_history
			WHERE wallet_address = ?`
	args := []any{strings.ToLower(walletAddress)}
	if network != "" {
		query += ` AND network = ?`
		args = append(args, network)
	}
	query += `
			GROUP BY token_address
		) latest
		ON b.token_address = latest.token_address AND b.fetched_at = latest.fetched_at
		WHERE b.wallet_address = ?`
	args = append(args, strings.ToLower(walletAddress))
	if network != "" {
		query += ` AND b.network = ?`
		args = append(args, network)
	}
	query += ` ORDER BY b.token_symbol ASC`

	rows, err := d.sql.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []BalanceHistory
	for rows.Next() {
		var b BalanceHistory
		if err := rows.Scan(&b.UUID, &b.WalletAddress, &b.Network, &b.TokenAddress, &b.TokenSymbol, &b.Balance, &b.USDValue, &b.FetchedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Watched address methods
// ---------------------------------------------------------------------------

func (d *DB) InsertWatchedAddress(ctx context.Context, address, label string) error {
	_, err := d.sql.ExecContext(ctx,
		`INSERT OR IGNORE INTO watched_addresses (uuid, address, label, created_at) VALUES (?, ?, ?, ?)`,
		newID(), strings.ToLower(address), label, time.Now().UnixMilli())
	return err
}

func (d *DB) ListWatchedAddresses(ctx context.Context) ([]WatchedAddress, error) {
	rows, err := d.sql.QueryContext(ctx,
		`SELECT uuid, address, label, created_at FROM watched_addresses ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []WatchedAddress
	for rows.Next() {
		var w WatchedAddress
		if err := rows.Scan(&w.UUID, &w.Address, &w.Label, &w.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// FX rate methods
// ---------------------------------------------------------------------------

func (d *DB) UpsertFXRate(ctx context.Context, pair, rate string, fetchedAt int64) error {
	_, err := d.sql.ExecContext(ctx,
		`INSERT INTO fx_rates (pair, rate, fetched_at) VALUES (?, ?, ?)
		 ON CONFLICT(pair) DO UPDATE SET rate = excluded.rate, fetched_at = excluded.fetched_at`,
		pair, rate, fetchedAt)
	return err
}

func (d *DB) LatestFXRate(ctx context.Context, pair string) (*FXRate, error) {
	var f FXRate
	err := d.sql.QueryRowContext(ctx,
		`SELECT pair, rate, fetched_at FROM fx_rates WHERE pair = ? LIMIT 1`, pair).
		Scan(&f.Pair, &f.Rate, &f.FetchedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &f, nil
}

func (d *DB) ListFXRates(ctx context.Context) ([]FXRate, error) {
	rows, err := d.sql.QueryContext(ctx,
		`SELECT pair, rate, fetched_at FROM fx_rates ORDER BY pair ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []FXRate
	for rows.Next() {
		var f FXRate
		if err := rows.Scan(&f.Pair, &f.Rate, &f.FetchedAt); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

func createSchema(ctx context.Context, db *sql.DB) error {
	const ddl = `
	CREATE TABLE IF NOT EXISTS wallet (
		uuid         TEXT PRIMARY KEY,
		name         TEXT NOT NULL DEFAULT '',
		wallet_type  TEXT NOT NULL DEFAULT 'eoa',
		address      TEXT NOT NULL UNIQUE,
		private_key  BLOB NOT NULL,
		created_at   INTEGER NOT NULL,
		updated_at   INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS transactions (
		uuid           TEXT PRIMARY KEY,
		wallet_address TEXT NOT NULL,
		tx_hash        TEXT NOT NULL UNIQUE,
		from_address   TEXT NOT NULL DEFAULT '',
		to_address     TEXT NOT NULL DEFAULT '',
		token_address  TEXT NOT NULL DEFAULT '',
		token_symbol   TEXT NOT NULL DEFAULT '',
		amount         TEXT NOT NULL DEFAULT '0',
		fee_eth        TEXT NOT NULL DEFAULT '0',
		fee_usd        TEXT NOT NULL DEFAULT '',
		usd_amount     TEXT NOT NULL DEFAULT '',
		network        TEXT NOT NULL DEFAULT '',
		tx_mode        TEXT NOT NULL DEFAULT 'direct',
		state          TEXT NOT NULL DEFAULT 'pending',
		block_number   INTEGER NOT NULL DEFAULT 0,
		timestamp      INTEGER NOT NULL DEFAULT 0,
		created_at     INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_transactions_wallet    ON transactions(wallet_address);
	CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);

	CREATE TABLE IF NOT EXISTS balance_history (
		uuid           TEXT PRIMARY KEY,
		wallet_address TEXT NOT NULL,
		network        TEXT NOT NULL DEFAULT '',
		token_address  TEXT NOT NULL DEFAULT '',
		token_symbol   TEXT NOT NULL DEFAULT '',
		balance        TEXT NOT NULL DEFAULT '0',
		usd_value      TEXT NOT NULL DEFAULT '0',
		fetched_at     INTEGER NOT NULL
	);
	CREATE INDEX IF NOT EXISTS idx_balance_history_wallet ON balance_history(wallet_address, fetched_at);

	CREATE TABLE IF NOT EXISTS watched_addresses (
		uuid       TEXT PRIMARY KEY,
		address    TEXT NOT NULL UNIQUE,
		label      TEXT NOT NULL DEFAULT '',
		created_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS fx_rates (
		pair       TEXT PRIMARY KEY,
		rate       TEXT NOT NULL,
		fetched_at INTEGER NOT NULL
	);
	`
	if _, err := db.ExecContext(ctx, ddl); err != nil {
		return err
	}
	if err := addColumnIfMissing(ctx, db, "transactions", "fee_usd", "TEXT", "''"); err != nil {
		return err
	}
	if err := addColumnIfMissing(ctx, db, "transactions", "usd_amount", "TEXT", "''"); err != nil {
		return err
	}
	return nil
}

func addColumnIfMissing(ctx context.Context, db *sql.DB, table, column, colType, defaultVal string) error {
	stmt := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s NOT NULL DEFAULT %s", table, column, colType, defaultVal)
	_, err := db.ExecContext(ctx, stmt)
	if err == nil {
		return nil
	}
	lower := strings.ToLower(err.Error())
	if strings.Contains(lower, "duplicate column") || strings.Contains(lower, "already exists") {
		return nil
	}
	return err
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

func hardenDatabase(ctx context.Context, db *sql.DB) error {
	for _, p := range []string{
		"PRAGMA journal_mode=WAL;",
		"PRAGMA foreign_keys=ON;",
		"PRAGMA secure_delete=ON;",
	} {
		if _, err := db.ExecContext(ctx, p); err != nil {
			return fmt.Errorf("pragma %q: %w", p, err)
		}
	}
	return nil
}

func verifyKey(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, "SELECT count(*) FROM sqlite_master;")
	return err
}

func deriveDBKey(password string, masterKey, salt []byte) []byte {
	combined := append([]byte(password), masterKey...)
	return argon2.IDKey(combined, salt, 1, 64*1024, 4, 32)
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("rand.Read: " + err.Error())
	}
	return base64.RawURLEncoding.EncodeToString(b)
}

func hexEncode(b []byte) string {
	const hextable = "0123456789abcdef"
	dst := make([]byte, len(b)*2)
	for i, v := range b {
		dst[i*2] = hextable[v>>4]
		dst[i*2+1] = hextable[v&0x0f]
	}
	return string(dst)
}

func zero(b []byte) {
	for i := range b {
		b[i] = 0
	}
}
