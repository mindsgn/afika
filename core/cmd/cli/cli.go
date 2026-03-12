// Command cli is a terminal interface for exercising the pocket-money WalletCore.
//
// Usage:
//
//	cli <command> [args...]
//
// Environment (all optional):
//
//	POCKET_DATA_DIR        — where to store the encrypted wallet DB (default: ~/.pocket)
//	POCKET_MASTER_KEY_B64  — base64-encoded 32-byte master key  (generated on first run)
//	POCKET_KDF_SALT_B64    — base64-encoded 32-byte KDF salt    (generated on first run)
//	POCKET_NETWORK_NAME    — network name to use  (default: ethereum-sepolia)
//	POCKET_RPC_URL         — network RPC URL (default: https://eth-sepolia.g.alchemy.com/v2/demo)
//	POCKET_CHAIN_ID        — chain ID int64       (default: 11155111)
package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"strconv"
	"strings"

	core "github.com/mindsgn-studio/pocket-money-app/core"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	wc := &core.WalletCore{}

	dataDir := envOrDefault("POCKET_DATA_DIR", defaultDataDir())
	masterKeyB64 := envOrDefault("POCKET_MASTER_KEY_B64", "")
	kdfSaltB64 := envOrDefault("POCKET_KDF_SALT_B64", "")

	// Auto-generate key material on first use and persist to env hint file.
	masterKeyB64, kdfSaltB64 = resolveKeyMaterial(masterKeyB64, kdfSaltB64)

	if err := wc.Init(dataDir, masterKeyB64, kdfSaltB64); err != nil {
		fatalf("init error: %v", err)
	}
	defer wc.Close() //nolint:errcheck

	// Register default network (can be overridden via env).
	netName := envOrDefault("POCKET_NETWORK_NAME", "ethereum-sepolia")
	rpcURL := envOrDefault("POCKET_RPC_URL", "https://eth-sepolia.g.alchemy.com/v2/demo")
	chainID := envInt64("POCKET_CHAIN_ID", 11155111)
	wc.RegisterNetwork(netName, rpcURL, chainID)

	cmd := strings.ToLower(strings.TrimSpace(os.Args[1]))
	args := os.Args[2:]

	switch cmd {
	case "create":
		name := argOrDefault(args, 0, "primary")
		addr, err := wc.CreateEthereumWallet(name)
		check(err)
		fmt.Println(addr)

	case "open":
		name := argOrDefault(args, 0, "primary")
		addr, err := wc.OpenOrCreateWallet(name)
		check(err)
		fmt.Println(addr)

	case "address":
		addr, err := wc.GetAddress()
		check(err)
		fmt.Println(addr)

	case "accounts":
		list, err := wc.ListAccounts()
		check(err)
		fmt.Println(list)

	case "validate":
		if len(args) < 1 {
			fatalf("usage: cli validate <address>")
		}
		fmt.Println(wc.ValidateAddress(args[0]))

	case "sign":
		if len(args) < 1 {
			fatalf("usage: cli sign <message>")
		}
		sig, err := wc.SignMessage(strings.Join(args, " "))
		check(err)
		fmt.Println(sig)

	case "balance":
		token := argOrDefault(args, 0, "ETH")
		bal, err := wc.GetTokenBalance(netName, token)
		check(err)
		fmt.Println(bal)

	case "balances":
		all, err := wc.GetAllBalances(netName)
		check(err)
		fmt.Println(all)

	case "price-history":
		limit := 10
		if len(args) > 0 {
			if n, e := strconv.Atoi(args[0]); e == nil {
				limit = n
			}
		}
		history, err := wc.GetPriceHistory(netName, limit)
		check(err)
		fmt.Println(history)

	case "watch":
		if len(args) < 1 {
			fatalf("usage: cli watch <address> [label]")
		}
		label := argOrDefault(args, 1, "")
		check(wc.AddWatchedAddress(args[0], label))
		fmt.Println("watching", args[0])

	case "watched":
		list, err := wc.ListWatchedAddresses()
		check(err)
		fmt.Println(list)

	case "send":
		if len(args) < 3 {
			fatalf("usage: cli send <token> <recipient> <amount>")
		}
		txHash, err := wc.SendToken(netName, args[0], args[1], args[2])
		check(err)
		fmt.Println(txHash)

	case "sync":
		result, err := wc.SyncInboundTransactions(netName)
		check(err)
		fmt.Println(result)

	case "txs":
		token := argOrDefault(args, 0, "")
		limit := 20
		offset := 0
		if len(args) > 1 {
			if n, e := strconv.Atoi(args[1]); e == nil {
				limit = n
			}
		}
		if len(args) > 2 {
			if n, e := strconv.Atoi(args[2]); e == nil {
				offset = n
			}
		}
		var (
			result string
			err    error
		)
		if token == "" {
			result, err = wc.ListAllTransactions(netName, limit, offset)
		} else {
			result, err = wc.ListTokenTransactions(netName, token, limit, offset)
		}
		check(err)
		fmt.Println(result)

	case "backup":
		if len(args) < 1 {
			fatalf("usage: cli backup <passphrase>")
		}
		payload, err := wc.ExportWalletBackup(args[0])
		check(err)
		fmt.Println(payload)

	case "restore":
		if len(args) < 2 {
			fatalf("usage: cli restore <payload> <passphrase>")
		}
		result, err := wc.ImportWalletBackup(args[0], args[1])
		check(err)
		fmt.Println(result)

	case "register-network":
		if len(args) < 3 {
			fatalf("usage: cli register-network <name> <rpcURL> <chainID>")
		}
		cid, err := strconv.ParseInt(args[2], 10, 64)
		if err != nil {
			fatalf("invalid chainID: %v", err)
		}
		wc.RegisterNetwork(args[0], args[1], cid)
		fmt.Printf("network %q registered (chainID=%d)\n", args[0], cid)

	case "register-token":
		if len(args) < 5 {
			fatalf("usage: cli register-token <network> <identifier> <symbol> <address> <decimals>")
		}
		dec, err := strconv.Atoi(args[4])
		if err != nil {
			fatalf("invalid decimals: %v", err)
		}
		wc.RegisterToken(args[0], args[1], args[2], args[3], dec)
		fmt.Printf("token %q registered on %q\n", args[2], args[0])

	default:
		fmt.Fprintf(os.Stderr, "unknown command: %q\n\n", cmd)
		usage()
		os.Exit(1)
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func usage() {
	fmt.Fprintln(os.Stderr, `pocket-money CLI — EOA wallet operations

commands:
  create [name]                 create a new wallet
  open [name]                   open or create a wallet
  address                       show the current wallet address
  accounts                      list all wallet accounts
  validate <address>            validate an Ethereum address
  sign <message>                sign a message (EIP-191)
  balance [token]               get single token balance (default: ETH)
  balances                      get all balances for the current network
  price-history [limit]         get ETH price history from local DB
  watch <address> [label]       add address to watch list
  watched                       list watched addresses
  send <token> <to> <amount>    send token to address
  sync                          sync inbound transactions
  txs [token] [limit] [offset]  list transactions
  backup <passphrase>           export encrypted wallet backup (JSON)
  restore <payload> <passphrase> import wallet from backup
  register-network <name> <rpcURL> <chainID>
  register-token <network> <id> <symbol> <addr> <decimals>

environment:
  POCKET_DATA_DIR         wallet DB directory  (default: ~/.pocket)
  POCKET_MASTER_KEY_B64   base64 master key
  POCKET_KDF_SALT_B64     base64 KDF salt
  POCKET_NETWORK_NAME     active network name  (default: ethereum-sepolia)
  POCKET_RPC_URL          network RPC URL
  POCKET_CHAIN_ID         network chain ID     (default: 11155111)`)
}

func check(err error) {
	if err != nil {
		fatalf("%v", err)
	}
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "error: "+format+"\n", args...)
	os.Exit(1)
}

func argOrDefault(args []string, idx int, def string) string {
	if idx < len(args) {
		return args[idx]
	}
	return def
}

func envOrDefault(name, def string) string {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		return def
	}
	return v
}

func envInt64(name string, def int64) int64 {
	v := strings.TrimSpace(os.Getenv(name))
	if v == "" {
		return def
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return def
	}
	return n
}

func defaultDataDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".pocket"
	}
	return home + "/.pocket"
}

// resolveKeyMaterial generates 32-byte random keys on first run if not provided.
// It prints a WARNING to stderr with the generated values so the operator can
// persist them in env vars for future runs.
func resolveKeyMaterial(masterKeyB64, kdfSaltB64 string) (string, string) {
	if masterKeyB64 != "" && kdfSaltB64 != "" {
		return masterKeyB64, kdfSaltB64
	}
	key := make([]byte, 32)
	salt := make([]byte, 32)
	if _, err := readRand(key); err != nil {
		fatalf("failed to generate master key: %v", err)
	}
	if _, err := readRand(salt); err != nil {
		fatalf("failed to generate KDF salt: %v", err)
	}
	mk := base64.StdEncoding.EncodeToString(key)
	ks := base64.StdEncoding.EncodeToString(salt)
	if masterKeyB64 == "" {
		masterKeyB64 = mk
		fmt.Fprintf(os.Stderr, "GENERATED master key — set POCKET_MASTER_KEY_B64=%s\n", mk)
	}
	if kdfSaltB64 == "" {
		kdfSaltB64 = ks
		fmt.Fprintf(os.Stderr, "GENERATED KDF salt   — set POCKET_KDF_SALT_B64=%s\n", ks)
	}
	return masterKeyB64, kdfSaltB64
}

// readRand fills b with cryptographically random bytes.
func readRand(b []byte) (int, error) {
	return rand.Read(b)
}
