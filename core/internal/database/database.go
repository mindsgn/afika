package database

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
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
	UserOpHash      string
	Nonce           int64
	Chain           string
	EntryPoint      string
	Token           string
	TokenAddress    string
	TokenDecimals   int
	NativeToken     bool
	Amount          string
	TransactionType string
	State           string
	BundlerStatus   string
	TxMode          string
	SponsorshipMode string
	Note            string
	Source          string
	Destination     string
	ProviderID      string
	WalletAddress   string
	Counterparty    string
	CreatedAt       int64
	UpdatedAt       int64
}

type SmartAccountRecord struct {
	UUID         string
	OwnerAddress string
	Network      string
	Address      string
	CreatedAt    int64
	UpdatedAt    int64
}

type SponsoredOperation struct {
	UUID            string
	UserOperationID string
	SenderAddress   string
	Network         string
	TokenAddress    string
	Recipient       string
	AmountUnits     string
	Status          string
	BundlerTxHash   string
	CreatedAt       int64
	UpdatedAt       int64
}

type PaymasterValidation struct {
	UUID            string
	SenderAddress   string
	Decision        string
	RejectionReason string
	AmountUnits     string
	Metadata        string
	CreatedAt       int64
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
		user_op_hash, entry_point_address, bundler_status, tx_mode, sponsorship_mode,
		token_address, token_decimals, is_native_token,
		note, source, destination, provider_id, wallet_address,
		counterparty_address, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
		tx.UserOpHash,
		tx.EntryPoint,
		tx.BundlerStatus,
		tx.TxMode,
		tx.SponsorshipMode,
		tx.TokenAddress,
		tx.TokenDecimals,
		tx.NativeToken,
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

func (d *DB) UpsertSmartAccount(ctx context.Context, ownerAddress string, network string, accountAddress string) error {
	if d == nil || d.db == nil {
		return errors.New("database is not initialized")
	}
	ownerAddress = strings.TrimSpace(ownerAddress)
	network = strings.TrimSpace(network)
	accountAddress = strings.TrimSpace(accountAddress)
	if ownerAddress == "" {
		return errors.New("owner address is required")
	}
	if network == "" {
		return errors.New("network is required")
	}
	if accountAddress == "" {
		return errors.New("smart account address is required")
	}

	const q = `
	INSERT INTO smart_accounts (
		uuid, owner_address, network, account_address, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?)
	ON CONFLICT(owner_address, network)
	DO UPDATE SET account_address = excluded.account_address, updated_at = excluded.updated_at;
	`

	now := time.Now().Unix()
	_, err := d.db.ExecContext(ctx, q, newID(), ownerAddress, network, accountAddress, now, now)
	return err
}

func (d *DB) FindSmartAccountByOwnerNetwork(ctx context.Context, ownerAddress string, network string) (*SmartAccountRecord, error) {
	if d == nil || d.db == nil {
		return nil, errors.New("database is not initialized")
	}
	ownerAddress = strings.TrimSpace(ownerAddress)
	network = strings.TrimSpace(network)
	if ownerAddress == "" {
		return nil, errors.New("owner address is required")
	}
	if network == "" {
		return nil, errors.New("network is required")
	}

	const q = `
	SELECT uuid, owner_address, network, account_address, created_at, updated_at
	FROM smart_accounts
	WHERE owner_address = ? AND network = ?
	LIMIT 1;
	`

	var out SmartAccountRecord
	err := d.db.QueryRowContext(ctx, q, ownerAddress, network).Scan(
		&out.UUID,
		&out.OwnerAddress,
		&out.Network,
		&out.Address,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &out, nil
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

func (d *DB) UpdateTransactionSettlement(ctx context.Context, txHash string, state string, bundlerStatus string) error {
	if d == nil || d.db == nil {
		return errors.New("database is not initialized")
	}
	if strings.TrimSpace(txHash) == "" {
		return errors.New("transaction hash is required")
	}

	const q = `
	UPDATE transactions
	SET state = ?, bundler_status = ?, updated_at = ?
	WHERE tx_hash = ?;
	`

	_, err := d.db.ExecContext(ctx, q, state, bundlerStatus, time.Now().Unix(), txHash)
	return err
}

func (d *DB) UpdateUserOperationSettlement(ctx context.Context, userOpHash string, finalTxHash string, state string, bundlerStatus string) error {
	if d == nil || d.db == nil {
		return errors.New("database is not initialized")
	}
	if strings.TrimSpace(userOpHash) == "" {
		return errors.New("user operation hash is required")
	}

	now := time.Now().Unix()
	resolvedHash := strings.TrimSpace(finalTxHash)
	if resolvedHash == "" {
		resolvedHash = userOpHash
	}

	const txQuery = `
	UPDATE transactions
	SET tx_hash = ?, state = ?, bundler_status = ?, updated_at = ?
	WHERE user_op_hash = ? OR tx_hash = ?;
	`

	if _, err := d.db.ExecContext(ctx, txQuery, resolvedHash, state, bundlerStatus, now, userOpHash, userOpHash); err != nil {
		return err
	}

	const sponsoredQuery = `
	UPDATE sponsored_operations
	SET status = ?, bundler_tx_hash = ?, updated_at = ?
	WHERE user_operation_hash = ?;
	`

	_, err := d.db.ExecContext(ctx, sponsoredQuery, state, resolvedHash, now, userOpHash)
	return err
}

func (d *DB) RecordSponsoredOperation(ctx context.Context, item SponsoredOperation) error {
	if d == nil || d.db == nil {
		return errors.New("database is not initialized")
	}
	if strings.TrimSpace(item.UserOperationID) == "" {
		return errors.New("user operation hash is required")
	}
	if strings.TrimSpace(item.SenderAddress) == "" {
		return errors.New("sender address is required")
	}

	now := time.Now().Unix()
	if item.UUID == "" {
		item.UUID = newID()
	}
	if item.CreatedAt == 0 {
		item.CreatedAt = now
	}
	item.UpdatedAt = now

	const q = `
	INSERT INTO sponsored_operations (
		uuid, user_operation_hash, sender_address, network, token_address,
		recipient_address, amount_units, status, bundler_tx_hash, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(user_operation_hash)
	DO UPDATE SET
		status = excluded.status,
		bundler_tx_hash = excluded.bundler_tx_hash,
		updated_at = excluded.updated_at;
	`

	_, err := d.db.ExecContext(
		ctx,
		q,
		item.UUID,
		item.UserOperationID,
		item.SenderAddress,
		item.Network,
		item.TokenAddress,
		item.Recipient,
		item.AmountUnits,
		item.Status,
		item.BundlerTxHash,
		item.CreatedAt,
		item.UpdatedAt,
	)
	return err
}

func (d *DB) RecordPaymasterValidation(ctx context.Context, item PaymasterValidation) error {
	if d == nil || d.db == nil {
		return errors.New("database is not initialized")
	}
	if strings.TrimSpace(item.SenderAddress) == "" {
		return errors.New("sender address is required")
	}
	if strings.TrimSpace(item.Decision) == "" {
		return errors.New("decision is required")
	}

	now := time.Now().Unix()
	if item.UUID == "" {
		item.UUID = newID()
	}
	if item.CreatedAt == 0 {
		item.CreatedAt = now
	}

	const q = `
	INSERT INTO paymaster_validations (
		uuid, sender_address, decision, rejection_reason, amount_units, metadata, created_at
	) VALUES (?, ?, ?, ?, ?, ?, ?);
	`

	_, err := d.db.ExecContext(
		ctx,
		q,
		item.UUID,
		item.SenderAddress,
		item.Decision,
		item.RejectionReason,
		item.AmountUnits,
		item.Metadata,
		item.CreatedAt,
	)
	return err
}

func (d *DB) CountSponsoredOperationsToday(ctx context.Context, senderAddress string) (int64, error) {
	if d == nil || d.db == nil {
		return 0, errors.New("database is not initialized")
	}
	if strings.TrimSpace(senderAddress) == "" {
		return 0, errors.New("sender address is required")
	}

	start := time.Now().UTC().Truncate(24 * time.Hour).Unix()
	const q = `
	SELECT COUNT(*)
	FROM sponsored_operations
	WHERE sender_address = ? AND created_at >= ?;
	`

	var count int64
	if err := d.db.QueryRowContext(ctx, q, senderAddress, start).Scan(&count); err != nil {
		return 0, err
	}

	return count, nil
}

func (d *DB) SumSponsoredAmountToday(ctx context.Context, senderAddress string) (*big.Int, error) {
	if d == nil || d.db == nil {
		return nil, errors.New("database is not initialized")
	}
	if strings.TrimSpace(senderAddress) == "" {
		return nil, errors.New("sender address is required")
	}

	start := time.Now().UTC().Truncate(24 * time.Hour).Unix()
	const q = `
	SELECT amount_units
	FROM sponsored_operations
	WHERE sender_address = ? AND created_at >= ?;
	`

	rows, err := d.db.QueryContext(ctx, q, senderAddress, start)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	total := big.NewInt(0)
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}

		amount := new(big.Int)
		if _, ok := amount.SetString(strings.TrimSpace(value), 10); !ok {
			continue
		}
		total = total.Add(total, amount)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return total, nil
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
		user_op_hash, entry_point_address, bundler_status, tx_mode, sponsorship_mode,
		token_address, token_decimals, is_native_token,
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
			&tx.UserOpHash,
			&tx.EntryPoint,
			&tx.BundlerStatus,
			&tx.TxMode,
			&tx.SponsorshipMode,
			&tx.TokenAddress,
			&tx.TokenDecimals,
			&tx.NativeToken,
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
		user_op_hash         TEXT NOT NULL DEFAULT '',
		entry_point_address  TEXT NOT NULL DEFAULT '',
		bundler_status       TEXT NOT NULL DEFAULT '',
		tx_mode              TEXT NOT NULL DEFAULT 'direct',
		sponsorship_mode     TEXT NOT NULL DEFAULT 'direct',
		token_address        TEXT NOT NULL DEFAULT '',
		token_decimals       INTEGER NOT NULL DEFAULT 0,
		is_native_token      INTEGER NOT NULL DEFAULT 0,
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

	CREATE INDEX IF NOT EXISTS idx_transactions_userop
	ON transactions(user_op_hash);

	CREATE TABLE IF NOT EXISTS sponsored_operations (
		uuid                 TEXT PRIMARY KEY NOT NULL,
		user_operation_hash  TEXT NOT NULL UNIQUE,
		sender_address       TEXT NOT NULL,
		network              TEXT NOT NULL,
		token_address        TEXT NOT NULL,
		recipient_address    TEXT NOT NULL,
		amount_units         TEXT NOT NULL,
		status               TEXT NOT NULL,
		bundler_tx_hash      TEXT NOT NULL DEFAULT '',
		created_at           INTEGER NOT NULL,
		updated_at           INTEGER NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_sponsored_operations_sender
	ON sponsored_operations(sender_address, created_at DESC);

	CREATE TABLE IF NOT EXISTS paymaster_validations (
		uuid              TEXT PRIMARY KEY NOT NULL,
		sender_address    TEXT NOT NULL,
		decision          TEXT NOT NULL,
		rejection_reason  TEXT NOT NULL DEFAULT '',
		amount_units      TEXT NOT NULL DEFAULT '0',
		metadata          TEXT NOT NULL DEFAULT '',
		created_at        INTEGER NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_paymaster_validations_sender
	ON paymaster_validations(sender_address, created_at DESC);

	CREATE TABLE IF NOT EXISTS smart_accounts (
		uuid          TEXT PRIMARY KEY NOT NULL,
		owner_address TEXT NOT NULL,
		network       TEXT NOT NULL,
		account_address TEXT NOT NULL,
		created_at    INTEGER NOT NULL,
		updated_at    INTEGER NOT NULL,
		UNIQUE(owner_address, network)
	);

	CREATE INDEX IF NOT EXISTS idx_smart_accounts_owner_network
	ON smart_accounts(owner_address, network);
	`
	if _, err := db.ExecContext(ctx, q); err != nil {
		return err
	}

	// Backfill columns for databases created before token metadata support.
	migrations := []string{
		"ALTER TABLE transactions ADD COLUMN token_address TEXT NOT NULL DEFAULT '';",
		"ALTER TABLE transactions ADD COLUMN token_decimals INTEGER NOT NULL DEFAULT 0;",
		"ALTER TABLE transactions ADD COLUMN is_native_token INTEGER NOT NULL DEFAULT 0;",
		"ALTER TABLE transactions ADD COLUMN user_op_hash TEXT NOT NULL DEFAULT '';",
		"ALTER TABLE transactions ADD COLUMN entry_point_address TEXT NOT NULL DEFAULT '';",
		"ALTER TABLE transactions ADD COLUMN bundler_status TEXT NOT NULL DEFAULT '';",
		"ALTER TABLE transactions ADD COLUMN tx_mode TEXT NOT NULL DEFAULT 'direct';",
		"ALTER TABLE transactions ADD COLUMN sponsorship_mode TEXT NOT NULL DEFAULT 'direct';",
	}

	for _, statement := range migrations {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			message := strings.ToLower(err.Error())
			if strings.Contains(message, "duplicate column name") {
				continue
			}
			return err
		}
	}

	return nil
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
