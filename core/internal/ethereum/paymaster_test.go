package ethereum

import (
	"math/big"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
)

func TestResolveSendMode(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "empty defaults to auto", input: "", want: SendModeAuto},
		{name: "auto remains auto", input: "auto", want: SendModeAuto},
		{name: "sponsored remains sponsored", input: "sponsored", want: SendModeSponsored},
		{name: "direct remains direct", input: "direct", want: SendModeDirect},
		{name: "unknown falls back to auto", input: "experimental", want: SendModeAuto},
		{name: "case and whitespace are normalized", input: "  SpOnSoReD  ", want: SendModeSponsored},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ResolveSendMode(tt.input)
			if got != tt.want {
				t.Fatalf("ResolveSendMode(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestValidateSponsoredTransfer(t *testing.T) {
	policy := PaymasterPolicy{
		Enabled:              true,
		SupportedTokenSymbol: USDCSymbol,
		MaxPerOperation:      big.NewInt(100_000_000),
		DailyLimit:           big.NewInt(500_000_000),
	}
	usdc := TokenConfig{Identifier: "usdc", Symbol: USDCSymbol, Address: "0x1", Decimals: USDCDecimals, IsNative: false}
	native := TokenConfig{Identifier: NativeTokenIdentifier, Symbol: "ETH", Address: "", Decimals: 18, IsNative: true}

	if err := ValidateSponsoredTransfer(policy, usdc, big.NewInt(10_000_000)); err != nil {
		t.Fatalf("expected valid sponsorship, got %v", err)
	}

	if err := ValidateSponsoredTransfer(PaymasterPolicy{Enabled: false}, usdc, big.NewInt(1)); err == nil {
		t.Fatalf("expected disabled policy error")
	}

	if err := ValidateSponsoredTransfer(policy, native, big.NewInt(1)); err == nil {
		t.Fatalf("expected unsupported token error")
	}

	if err := ValidateSponsoredTransfer(policy, usdc, big.NewInt(0)); err == nil {
		t.Fatalf("expected invalid amount error")
	}

	if err := ValidateSponsoredTransfer(policy, usdc, big.NewInt(200_000_000)); err == nil {
		t.Fatalf("expected per-operation cap error")
	}
}

func TestLoadPaymasterPolicyDailyOperationLimit(t *testing.T) {
	t.Setenv("POCKET_PAYMASTER_DAILY_OP_LIMIT", "77")
	policy := LoadPaymasterPolicy("ethereum-sepolia")
	if policy.DailyOperationLimit != 77 {
		t.Fatalf("expected daily operation limit 77, got %d", policy.DailyOperationLimit)
	}
}

func TestLoadPaymasterPolicyDailyOperationLimitNetworkOverride(t *testing.T) {
	t.Setenv("POCKET_PAYMASTER_DAILY_OP_LIMIT", "77")
	t.Setenv("POCKET_PAYMASTER_DAILY_OP_LIMIT_ETHEREUM_SEPOLIA", "33")

	policy := LoadPaymasterPolicy("ethereum-sepolia")
	if policy.DailyOperationLimit != 33 {
		t.Fatalf("expected network override 33, got %d", policy.DailyOperationLimit)
	}
}

func TestBuildSignedPaymasterAndDataRequiresSignerKey(t *testing.T) {
	t.Setenv("POCKET_PAYMASTER_SIGNER_PRIVATE_KEY", "")
	_, err := BuildSignedPaymasterAndData("0x00000000000000000000000000000000000000A1", common.HexToAddress("0x00000000000000000000000000000000000000B2"), big.NewInt(0), big.NewInt(11155111), "ethereum-sepolia")
	if err == nil || !strings.Contains(strings.ToLower(err.Error()), "private key") {
		t.Fatalf("expected missing signer key error, got %v", err)
	}
}

func TestBuildSignedPaymasterAndDataBuildsExpectedLength(t *testing.T) {
	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	t.Setenv("POCKET_PAYMASTER_SIGNER_PRIVATE_KEY", strings.TrimPrefix(common.Bytes2Hex(crypto.FromECDSA(key)), "0x"))

	result, err := BuildSignedPaymasterAndData(
		"0x00000000000000000000000000000000000000A1",
		common.HexToAddress("0x00000000000000000000000000000000000000B2"),
		big.NewInt(7),
		big.NewInt(11155111),
		"ethereum-sepolia",
	)
	if err != nil {
		t.Fatalf("BuildSignedPaymasterAndData() error = %v", err)
	}

	if len(result) != 85 {
		t.Fatalf("expected paymasterAndData length 85, got %d", len(result))
	}
	if string(result[:20]) != string(common.HexToAddress("0x00000000000000000000000000000000000000A1").Bytes()) {
		t.Fatalf("unexpected paymaster address prefix")
	}
}

func TestGetPaymasterSignerPrivateKeyNetworkOverride(t *testing.T) {
	t.Setenv("POCKET_PAYMASTER_SIGNER_PRIVATE_KEY", "global")
	t.Setenv("POCKET_PAYMASTER_SIGNER_PRIVATE_KEY_ETHEREUM_SEPOLIA", "network")

	value := getPaymasterSignerPrivateKey("ethereum-sepolia")
	if value != "network" {
		t.Fatalf("expected network override, got %s", value)
	}

	value = getPaymasterSignerPrivateKey("ethereum-mainnet")
	if value != "global" {
		t.Fatalf("expected global fallback, got %s", value)
	}
}

func TestBuildSignedPaymasterAndDataUsesNetworkSpecificKey(t *testing.T) {
	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("GenerateKey() error = %v", err)
	}

	t.Setenv("POCKET_PAYMASTER_SIGNER_PRIVATE_KEY", "")
	t.Setenv("POCKET_PAYMASTER_SIGNER_PRIVATE_KEY_ETHEREUM_SEPOLIA", common.Bytes2Hex(crypto.FromECDSA(key)))

	result, err := BuildSignedPaymasterAndData(
		"0x00000000000000000000000000000000000000A1",
		common.HexToAddress("0x00000000000000000000000000000000000000B2"),
		big.NewInt(1),
		big.NewInt(11155111),
		"ethereum-sepolia",
	)
	if err != nil {
		t.Fatalf("BuildSignedPaymasterAndData() error = %v", err)
	}
	if len(result) != 85 {
		t.Fatalf("expected 85 bytes, got %d", len(result))
	}
}
