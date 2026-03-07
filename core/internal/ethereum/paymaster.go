package ethereum

import (
	"crypto/ecdsa"
	"errors"
	"math/big"
	"os"
	"strconv"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

const (
	SendModeAuto      = "auto"
	SendModeSponsored = "sponsored"
	SendModeDirect    = "direct"
)

type PaymasterPolicy struct {
	Enabled              bool
	SupportedTokenSymbol string
	MaxPerOperation      *big.Int
	DailyLimit           *big.Int
	DailyOperationLimit  int64
}

func ResolveSendMode(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "", SendModeAuto:
		return SendModeAuto
	case SendModeDirect:
		return SendModeDirect
	case SendModeSponsored:
		return SendModeSponsored
	default:
		return SendModeAuto
	}
}

func LoadPaymasterPolicy(network string) PaymasterPolicy {
	maxPerOp := envBigInt("POCKET_PAYMASTER_MAX_PER_OP_UNITS", big.NewInt(100_000_000))
	dailyLimit := envBigInt("POCKET_PAYMASTER_DAILY_LIMIT_UNITS", big.NewInt(500_000_000))
	if dailyLimit.Cmp(maxPerOp) < 0 {
		dailyLimit = new(big.Int).Set(maxPerOp)
	}

	enabled := strings.EqualFold(strings.TrimSpace(os.Getenv("POCKET_PAYMASTER_ENABLED")), "true")
	token := strings.ToUpper(strings.TrimSpace(os.Getenv("POCKET_PAYMASTER_TOKEN")))
	if token == "" {
		token = USDCSymbol
	}
	dailyOperationLimit := envInt64ForNetwork(network, "POCKET_PAYMASTER_DAILY_OP_LIMIT", 50)

	return PaymasterPolicy{
		Enabled:              enabled,
		SupportedTokenSymbol: token,
		MaxPerOperation:      maxPerOp,
		DailyLimit:           dailyLimit,
		DailyOperationLimit:  dailyOperationLimit,
	}
}

func BuildPaymasterAndData(paymasterAddress string) ([]byte, error) {
	if !common.IsHexAddress(paymasterAddress) {
		return nil, errors.New("invalid paymaster address")
	}

	return common.HexToAddress(paymasterAddress).Bytes(), nil
}

func BuildSignedPaymasterAndData(paymasterAddress string, sender common.Address, nonce *big.Int, chainID *big.Int, network string) ([]byte, error) {
	if !common.IsHexAddress(paymasterAddress) {
		return nil, errors.New("invalid paymaster address")
	}
	if nonce == nil {
		return nil, errors.New("nonce is required")
	}
	if chainID == nil {
		return nil, errors.New("chain id is required")
	}

	privateKeyHex := getPaymasterSignerPrivateKey(network)
	if strings.TrimSpace(privateKeyHex) == "" {
		return nil, errors.New("paymaster signer private key is not configured")
	}

	privateKey, err := parsePrivateKey(privateKeyHex)
	if err != nil {
		return nil, err
	}

	paymasterAddressBytes := common.HexToAddress(paymasterAddress).Bytes()
	nonceBytes := common.LeftPadBytes(nonce.Bytes(), 32)
	chainIDBytes := common.LeftPadBytes(chainID.Bytes(), 32)
	payload := make([]byte, 0, 20+32+32+20)
	payload = append(payload, sender.Bytes()...)
	payload = append(payload, nonceBytes...)
	payload = append(payload, chainIDBytes...)
	payload = append(payload, paymasterAddressBytes...)

	hash := crypto.Keccak256Hash(payload)
	digest := crypto.Keccak256Hash([]byte("\x19Ethereum Signed Message:\n32"), hash.Bytes())
	signature, err := crypto.Sign(digest.Bytes(), privateKey)
	if err != nil {
		return nil, err
	}

	// OpenZeppelin ECDSA.recover expects v=27/28.
	signature[64] += 27
	return append(paymasterAddressBytes, signature...), nil
}

func getPaymasterSignerPrivateKey(network string) string {
	network = strings.TrimSpace(strings.ToLower(network))
	if network != "" {
		envSuffix := strings.ToUpper(strings.ReplaceAll(network, "-", "_"))
		if value := strings.TrimSpace(os.Getenv("POCKET_PAYMASTER_SIGNER_PRIVATE_KEY_" + envSuffix)); value != "" {
			return value
		}
	}

	return strings.TrimSpace(os.Getenv("POCKET_PAYMASTER_SIGNER_PRIVATE_KEY"))
}

func parsePrivateKey(value string) (*ecdsa.PrivateKey, error) {
	trimmed := strings.TrimPrefix(strings.TrimSpace(value), "0x")
	if trimmed == "" {
		return nil, errors.New("invalid paymaster signer private key")
	}
	key, err := crypto.HexToECDSA(trimmed)
	if err != nil {
		return nil, errors.New("invalid paymaster signer private key")
	}
	return key, nil
}

func ValidateSponsoredTransfer(policy PaymasterPolicy, token TokenConfig, amountUnits *big.Int) error {
	if !policy.Enabled {
		return errors.New("paymaster sponsorship is disabled")
	}
	if !strings.EqualFold(token.Symbol, policy.SupportedTokenSymbol) {
		return errors.New("token is not eligible for sponsorship")
	}
	if amountUnits == nil || amountUnits.Sign() <= 0 {
		return errors.New("invalid amount")
	}
	if amountUnits.Cmp(policy.MaxPerOperation) > 0 {
		return errors.New("amount exceeds sponsorship per-operation cap")
	}

	return nil
}

func envBigInt(name string, fallback *big.Int) *big.Int {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return new(big.Int).Set(fallback)
	}

	if strings.HasPrefix(value, "0x") {
		parsed := new(big.Int)
		if _, ok := parsed.SetString(strings.TrimPrefix(value, "0x"), 16); ok {
			return parsed
		}
		return new(big.Int).Set(fallback)
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return new(big.Int).Set(fallback)
	}

	return big.NewInt(parsed)
}

func envInt64(name string, fallback int64) int64 {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return fallback
	}

	return parsed
}

func envInt64ForNetwork(network string, base string, fallback int64) int64 {
	trimmedNetwork := strings.TrimSpace(strings.ToLower(network))
	if trimmedNetwork != "" {
		envSuffix := strings.ToUpper(strings.ReplaceAll(trimmedNetwork, "-", "_"))
		if value := envInt64(base+"_"+envSuffix, -1); value > 0 {
			return value
		}
	}

	return envInt64(base, fallback)
}
