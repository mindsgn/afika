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

/*
The mobile layer (Swift / Kotlin) MUST implement this interface and provide
secure storage backed by iOS Keychain / Android Keystore.
*/

type SecureKeyStore interface {
	// Returns a persistent, random 32-byte master key.
	// The OS should protect and gate access (biometrics / device lock).
	GetOrCreateMasterKey(ctx context.Context) ([]byte, error)

	// Returns a stable random salt (at least 16 bytes) for KDF.
	GetOrCreateKDFSalt(ctx context.Context) ([]byte, error)
}

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

type BalanceHistory struct {
	UUID      string
	ZAR       string
	USD       string
	EURO      string
	CreatedAt int64
}

type TransactionRecord struct {
	UUID            string
	TxHash          string
	Nonce           int64
	Chain           string
	Token           string
	Amount          string
	TransactionType string
	State           string
	Note            string
	Source          string
	Destination     string
	ProviderID      string
	WalletAddress   string
	Counterparty    string
	CreatedAt       int64
	UpdatedAt       int64
}

type DB struct {
	db *sql.DB
}

const dbFileName = "wallet.db"

// ---------- Public API ----------

func Open(
	ctx context.Context,
	dataDir string,
	userPassword string,
	keystore SecureKeyStore,
) (*DB, error) {

	if keystore == nil {
		return nil, errors.New("keystore is required")
	}

	masterKey, err := keystore.GetOrCreateMasterKey(ctx)
	if err != nil {
		return nil, err
	}

	salt, err := keystore.GetOrCreateKDFSalt(ctx)
	if err != nil {
		return nil, err
	}

	derivedKey := deriveDBKey(userPassword, masterKey, salt)

	dsn := fmt.Sprintf(
		"%s?_pragma_key=x'%s'",
		filepath.Join(dataDir, dbFileName),
		hex(derivedKey),
	)

	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		zero(derivedKey)
		return nil, err
	}

	if err := hardenDatabase(ctx, db); err != nil {
		db.Close()
		zero(derivedKey)
		return nil, err
	}

	if err := verifyKey(ctx, db); err != nil {
		db.Close()
		zero(derivedKey)
		return nil, err
	}

	if err := createSchema(ctx, db); err != nil {
		db.Close()
		zero(derivedKey)
		return nil, err
	}

	zero(derivedKey)

	return &DB{db: db}, nil
}

func (d *DB) Close() error {
	if d.db == nil {
		return nil
	}
	return d.db.Close()
}

func (d *DB) InsertWallet(
	ctx context.Context,
	walletType string,
	name string,
	address string,
	encryptedPrivateKey []byte,
) error {
	if d == nil || d.db == nil {
		return errors.New("database is not initialized")
	}
	if walletType == "" {
		return errors.New("wallet type is required")
	}
	if name == "" {
		return errors.New("wallet name is required")
	}
	if address == "" {
		return errors.New("wallet address is required")
	}
	if len(encryptedPrivateKey) == 0 {
		return errors.New("encrypted private key is required")
	}

	const q = `
	INSERT INTO wallet (
		uuid, name, type, address, private_key, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?);
	`

	now := time.Now().Unix()
	uuid := newID()

	stmt, err := d.db.PrepareContext(ctx, q)
	if err != nil {
		return err
	}
	defer stmt.Close()

	_, err = stmt.ExecContext(
		ctx,
		uuid,
		name,
		walletType,
		address,
		base64.StdEncoding.EncodeToString(encryptedPrivateKey),
		now,
		now,
	)

	return err
}

func (d *DB) InsertWalletIfMissing(
	ctx context.Context,
	walletType string,
	name string,
	address string,
	encryptedPrivateKey []byte,
) error {
	err := d.InsertWallet(ctx, walletType, name, address, encryptedPrivateKey)
	if err == nil {
		return nil
	}
	if strings.Contains(strings.ToLower(err.Error()), "unique") {
		return nil
	}
	return err
}

func (d *DB) WalletExists(ctx context.Context) (bool, error) {
	if d == nil || d.db == nil {
		return false, errors.New("database is not initialized")
	}

	const q = `SELECT COUNT(*) FROM wallet;`

	var c int
	if err := d.db.QueryRowContext(ctx, q).Scan(&c); err != nil {
		return false, err
	}

	return c > 0, nil
}

func (d *DB) ListWallets(ctx context.Context) ([]Wallet, error) {
	if d == nil || d.db == nil {
		return nil, errors.New("database is not initialized")
	}

	const q = `
	SELECT uuid, name, type, address
	FROM wallet
	ORDER BY created_at ASC;
	`

	rows, err := d.db.QueryContext(ctx, q)
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
	if d == nil || d.db == nil {
		return nil, errors.New("database is not initialized")
	}

	const q = `
	SELECT uuid, name, type, address, private_key
	FROM wallet
	ORDER BY created_at ASC;
	`

	rows, err := d.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []WalletSecret
	for rows.Next() {
		var w WalletSecret
		var privateKeyB64 string
		if err := rows.Scan(&w.UUID, &w.Name, &w.WalletType, &w.Address, &privateKeyB64); err != nil {
			return nil, err
		}

		privateKey, err := base64.StdEncoding.DecodeString(privateKeyB64)
		if err != nil {
			return nil, err
		}

		w.PrivateKey = privateKey
		out = append(out, w)
	}

	return out, rows.Err()
}

func (d *DB) FindWalletSecretByAddress(ctx context.Context, address string) (*WalletSecret, error) {
	if d == nil || d.db == nil {
		return nil, errors.New("database is not initialized")
	}
	if address == "" {
		return nil, errors.New("wallet address is required")
	}

	const q = `
	SELECT uuid, name, type, address, private_key
	FROM wallet
	WHERE address = ?
	LIMIT 1;
	`

	var out WalletSecret
	var privateKeyB64 string
	err := d.db.QueryRowContext(ctx, q, address).Scan(&out.UUID, &out.Name, &out.WalletType, &out.Address, &privateKeyB64)
	if err != nil {
		return nil, err
	}

	privateKey, err := base64.StdEncoding.DecodeString(privateKeyB64)
	if err != nil {
		return nil, err
	}
	out.PrivateKey = privateKey

	return &out, nil
}

func (d *DB) InsertTransaction(ctx context.Context, tx TransactionRecord) error {
	if d == nil || d.db == nil {
		return errors.New("database is not initialized")
	}
	if tx.TxHash == "" {
		return errors.New("transaction hash is required")
	}
	if tx.Token == "" {
		return errors.New("token is required")
	}

	const q = `
	INSERT INTO transactions (
		uuid, tx_hash, nonce, chain, token, amount, tx_type, state,
		note, source, destination, provider_id, wallet_address,
		counterparty_address, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
	`

	now := time.Now().Unix()
	if tx.UUID == "" {
		tx.UUID = newID()
	}
	if tx.CreatedAt == 0 {
		tx.CreatedAt = now
	}
	if tx.UpdatedAt == 0 {
		tx.UpdatedAt = now
	}

	stmt, err := d.db.PrepareContext(ctx, q)
	if err != nil {
		return err
	}
	defer stmt.Close()

	_, err = stmt.ExecContext(
		ctx,
		tx.UUID,
		tx.TxHash,
		tx.Nonce,
		tx.Chain,
		tx.Token,
		tx.Amount,
		tx.TransactionType,
		tx.State,
		tx.Note,
		tx.Source,
		tx.Destination,
		tx.ProviderID,
		tx.WalletAddress,
		tx.Counterparty,
		tx.CreatedAt,
		tx.UpdatedAt,
	)

	return err
}

func (d *DB) InsertTransactionIfMissing(ctx context.Context, tx TransactionRecord) error {
	err := d.InsertTransaction(ctx, tx)
	if err == nil {
		return nil
	}
	if strings.Contains(strings.ToLower(err.Error()), "unique") {
		return nil
	}
	return err
}

func (d *DB) UpdateTransactionState(ctx context.Context, txHash string, state string) error {
	if d == nil || d.db == nil {
		return errors.New("database is not initialized")
	}
	if txHash == "" {
		return errors.New("transaction hash is required")
	}

	const q = `
	UPDATE transactions
	SET state = ?, updated_at = ?
	WHERE tx_hash = ?;
	`

	_, err := d.db.ExecContext(ctx, q, state, time.Now().Unix(), txHash)
	return err
}

func (d *DB) ListTransactions(ctx context.Context, walletAddress string, token string, limit int, offset int) ([]TransactionRecord, error) {
	if d == nil || d.db == nil {
		return nil, errors.New("database is not initialized")
	}
	if token == "" {
		return nil, errors.New("token is required")
	}
	if limit <= 0 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	const q = `
	SELECT uuid, tx_hash, nonce, chain, token, amount, tx_type, state,
		note, source, destination, provider_id, wallet_address,
		counterparty_address, created_at, updated_at
	FROM transactions
	WHERE wallet_address = ? AND token = ?
	ORDER BY created_at DESC
	LIMIT ? OFFSET ?;
	`

	rows, err := d.db.QueryContext(ctx, q, walletAddress, token, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []TransactionRecord
	for rows.Next() {
		var tx TransactionRecord
		if err := rows.Scan(
			&tx.UUID,
			&tx.TxHash,
			&tx.Nonce,
			&tx.Chain,
			&tx.Token,
			&tx.Amount,
			&tx.TransactionType,
			&tx.State,
			&tx.Note,
			&tx.Source,
			&tx.Destination,
			&tx.ProviderID,
			&tx.WalletAddress,
			&tx.Counterparty,
			&tx.CreatedAt,
			&tx.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, tx)
	}

	return out, rows.Err()
}

// ---------- Schema / Hardening ----------

func createSchema(ctx context.Context, db *sql.DB) error {
	const q = `
	CREATE TABLE IF NOT EXISTS wallet (
		uuid        TEXT PRIMARY KEY NOT NULL,
		name        TEXT NOT NULL,
		type        TEXT NOT NULL,
		address     TEXT NOT NULL UNIQUE,
		private_key TEXT NOT NULL,
		created_at  INTEGER NOT NULL,
		updated_at  INTEGER NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_wallet_address
	ON wallet(address);

	CREATE TABLE IF NOT EXISTS transactions (
		uuid                 TEXT PRIMARY KEY NOT NULL,
		tx_hash              TEXT NOT NULL UNIQUE,
		nonce                INTEGER NOT NULL DEFAULT 0,
		chain                TEXT NOT NULL,
		token                TEXT NOT NULL,
		amount               TEXT NOT NULL,
		tx_type              TEXT NOT NULL,
		state                TEXT NOT NULL,
		note                 TEXT NOT NULL DEFAULT '',
		source               TEXT NOT NULL DEFAULT '',
		destination          TEXT NOT NULL DEFAULT '',
		provider_id          TEXT NOT NULL DEFAULT '',
		wallet_address       TEXT NOT NULL,
		counterparty_address TEXT NOT NULL DEFAULT '',
		created_at           INTEGER NOT NULL,
		updated_at           INTEGER NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_transactions_wallet_token
	ON transactions(wallet_address, token, created_at DESC);

	CREATE INDEX IF NOT EXISTS idx_transactions_state
	ON transactions(state);
	`
	_, err := db.ExecContext(ctx, q)
	return err
}

func hardenDatabase(ctx context.Context, db *sql.DB) error {
	pragmas := []string{
		"PRAGMA cipher_memory_security = ON;",
		"PRAGMA secure_delete = ON;",
		"PRAGMA journal_mode = WAL;",
		"PRAGMA synchronous = NORMAL;",
	}

	for _, p := range pragmas {
		if _, err := db.ExecContext(ctx, p); err != nil {
			return err
		}
	}

	return nil
}

func verifyKey(ctx context.Context, db *sql.DB) error {
	var name string
	err := db.QueryRowContext(
		ctx,
		"SELECT name FROM sqlite_master LIMIT 1;",
	).Scan(&name)

	if err != nil && err != sql.ErrNoRows {
		return err
	}
	return nil
}

// ---------- Crypto helpers ----------

func deriveDBKey(password string, masterKey, salt []byte) []byte {

	combined := make([]byte, 0, len(password)+len(masterKey))
	combined = append(combined, []byte(password)...)
	combined = append(combined, masterKey...)

	key := argon2.IDKey(
		combined,
		salt,
		3,
		64*1024,
		4,
		32,
	)

	zero(combined)
	return key
}

// ---------- Utilities ----------

func newID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex(b)
}

func hex(b []byte) string {
	const hextable = "0123456789abcdef"

	out := make([]byte, len(b)*2)
	for i, v := range b {
		out[i*2] = hextable[v>>4]
		out[i*2+1] = hextable[v&0x0f]
	}
	return string(out)
}

func zero(b []byte) {
	for i := range b {
		b[i] = 0
	}
}
