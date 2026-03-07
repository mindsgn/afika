package config

import (
	"math/big"
	"os"
	"strings"
	"testing"
)

func TestGetDeploymentSepoliaDefaultsAreCurrent(t *testing.T) {
	deployment, err := GetDeployment("ethereum-sepolia")
	if err != nil {
		t.Fatalf("GetDeployment() error = %v", err)
	}

	if deployment.FactoryAddress != "0xFD6EacA961d88FF0422898CDBb284f963D613369" {
		t.Fatalf("unexpected Sepolia factory address: %s", deployment.FactoryAddress)
	}
	if deployment.ImplementationAddress != "0xF8b10Fc20F1eC48c37234007a675453fC0f92152" {
		t.Fatalf("unexpected Sepolia implementation address: %s", deployment.ImplementationAddress)
	}
	if deployment.EntryPointAddress != "0x0000000071727De22E5E9d8BAf0edAc6f37da032" {
		t.Fatalf("unexpected Sepolia entry point address: %s", deployment.EntryPointAddress)
	}
	if deployment.PaymasterAddress != "0x7F1BE467e9f0c2731ab9E8a646cF5972E71A66d8" {
		t.Fatalf("unexpected Sepolia paymaster address: %s", deployment.PaymasterAddress)
	}
}

func TestGetDeploymentEnvOverridesDefaults(t *testing.T) {
	t.Setenv("POCKET_FACTORY_ETHEREUM_SEPOLIA", "0x00000000000000000000000000000000000000a1")
	t.Setenv("POCKET_IMPLEMENTATION_ETHEREUM_SEPOLIA", "0x00000000000000000000000000000000000000b2")
	t.Setenv("POCKET_ENTRY_POINT_ETHEREUM_SEPOLIA", "0x00000000000000000000000000000000000000c3")
	t.Setenv("POCKET_BUNDLER_URL_ETHEREUM_SEPOLIA", "https://bundler.example")
	t.Setenv("POCKET_PAYMASTER_ETHEREUM_SEPOLIA", "0x00000000000000000000000000000000000000d4")

	deployment, err := GetDeployment("ethereum-sepolia")
	if err != nil {
		t.Fatalf("GetDeployment() error = %v", err)
	}

	if deployment.FactoryAddress != "0x00000000000000000000000000000000000000a1" {
		t.Fatalf("factory env override failed: %s", deployment.FactoryAddress)
	}
	if deployment.ImplementationAddress != "0x00000000000000000000000000000000000000b2" {
		t.Fatalf("implementation env override failed: %s", deployment.ImplementationAddress)
	}
	if deployment.EntryPointAddress != "0x00000000000000000000000000000000000000c3" {
		t.Fatalf("entry point env override failed: %s", deployment.EntryPointAddress)
	}
	if deployment.BundlerURL != "https://bundler.example" {
		t.Fatalf("bundler env override failed: %s", deployment.BundlerURL)
	}
	if deployment.PaymasterAddress != "0x00000000000000000000000000000000000000d4" {
		t.Fatalf("paymaster env override failed: %s", deployment.PaymasterAddress)
	}
}

func TestValidateAAConfigMissingBundlerReturnsDeterministicError(t *testing.T) {
	t.Setenv("POCKET_FACTORY_ETHEREUM_MAINNET", "0x00000000000000000000000000000000000000a1")
	t.Setenv("POCKET_IMPLEMENTATION_ETHEREUM_MAINNET", "0x00000000000000000000000000000000000000b2")
	t.Setenv("POCKET_ENTRY_POINT_ETHEREUM_MAINNET", "0x00000000000000000000000000000000000000c3")

	prev, hadPrev := os.LookupEnv("POCKET_BUNDLER_URL_ETHEREUM_MAINNET")
	defer func() {
		if hadPrev {
			_ = os.Setenv("POCKET_BUNDLER_URL_ETHEREUM_MAINNET", prev)
			return
		}
		_ = os.Unsetenv("POCKET_BUNDLER_URL_ETHEREUM_MAINNET")
	}()
	_ = os.Unsetenv("POCKET_BUNDLER_URL_ETHEREUM_MAINNET")

	_, err := ValidateAAConfig("ethereum-mainnet", true)
	if err == nil {
		t.Fatalf("expected missing bundler error")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "missing bundler url") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateAAConfigMissingPaymasterReturnsDeterministicError(t *testing.T) {
	t.Setenv("POCKET_FACTORY_ETHEREUM_MAINNET", "0x00000000000000000000000000000000000000a1")
	t.Setenv("POCKET_IMPLEMENTATION_ETHEREUM_MAINNET", "0x00000000000000000000000000000000000000b2")
	t.Setenv("POCKET_ENTRY_POINT_ETHEREUM_MAINNET", "0x00000000000000000000000000000000000000c3")
	t.Setenv("POCKET_BUNDLER_URL_ETHEREUM_MAINNET", "https://bundler.example")

	prev, hadPrev := os.LookupEnv("POCKET_PAYMASTER_ETHEREUM_MAINNET")
	defer func() {
		if hadPrev {
			_ = os.Setenv("POCKET_PAYMASTER_ETHEREUM_MAINNET", prev)
			return
		}
		_ = os.Unsetenv("POCKET_PAYMASTER_ETHEREUM_MAINNET")
	}()
	_ = os.Unsetenv("POCKET_PAYMASTER_ETHEREUM_MAINNET")

	_, err := ValidateAAConfig("ethereum-mainnet", true)
	if err == nil {
		t.Fatalf("expected missing paymaster error")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "missing paymaster address") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateAAConfigSucceedsForSepoliaWhenEnvProvided(t *testing.T) {
	t.Setenv("POCKET_BUNDLER_URL_ETHEREUM_SEPOLIA", "https://bundler.example")

	deployment, err := ValidateAAConfig("ethereum-sepolia", true)
	if err != nil {
		t.Fatalf("ValidateAAConfig() error = %v", err)
	}
	if deployment.BundlerURL != "https://bundler.example" {
		t.Fatalf("expected env bundler URL, got %s", deployment.BundlerURL)
	}
	if deployment.PaymasterAddress != "0x7F1BE467e9f0c2731ab9E8a646cF5972E71A66d8" {
		t.Fatalf("unexpected paymaster address: %s", deployment.PaymasterAddress)
	}
}

func TestGetOwnerCreationMinGasWeiDefaults(t *testing.T) {
	sep := GetOwnerCreationMinGasWei("ethereum-sepolia")
	if sep.Cmp(big.NewInt(3_000_000_000_000_000)) != 0 {
		t.Fatalf("unexpected sepolia min gas: %s", sep.String())
	}

	mainnet := GetOwnerCreationMinGasWei("ethereum-mainnet")
	if mainnet.Cmp(big.NewInt(15_000_000_000_000_000)) != 0 {
		t.Fatalf("unexpected mainnet min gas: %s", mainnet.String())
	}
}

func TestGetOwnerCreationMinGasWeiEnvOverride(t *testing.T) {
	t.Setenv("POCKET_OWNER_MIN_GAS_WEI_ETHEREUM_SEPOLIA", "4200000000000000")
	value := GetOwnerCreationMinGasWei("ethereum-sepolia")
	if value.Cmp(big.NewInt(4_200_000_000_000_000)) != 0 {
		t.Fatalf("unexpected env override value: %s", value.String())
	}
}
