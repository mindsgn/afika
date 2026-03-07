package config

import (
	"errors"
	"math/big"
	"os"
	"strconv"
	"strings"
)

type Deployment struct {
	FactoryAddress        string
	ImplementationAddress string
	EntryPointAddress     string
	BundlerURL            string
	PaymasterAddress      string
}

var defaultDeployments = map[string]Deployment{
	"ethereum-sepolia": {
		FactoryAddress:        "0xFD6EacA961d88FF0422898CDBb284f963D613369",
		ImplementationAddress: "0xF8b10Fc20F1eC48c37234007a675453fC0f92152",
		EntryPointAddress:     "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
		BundlerURL:            "",
		PaymasterAddress:      "0x7F1BE467e9f0c2731ab9E8a646cF5972E71A66d8",
	},
	"ethereum-mainnet": {
		FactoryAddress:        "",
		ImplementationAddress: "",
		EntryPointAddress:     "",
		BundlerURL:            "",
		PaymasterAddress:      "",
	},
}

func GetDeployment(network string) (Deployment, error) {
	network = strings.TrimSpace(strings.ToLower(network))
	deployment, ok := defaultDeployments[network]
	if !ok {
		return Deployment{}, errors.New("unsupported deployment network")
	}

	factoryEnv := envName(network, "FACTORY")
	implEnv := envName(network, "IMPLEMENTATION")
	entryPointEnv := envName(network, "ENTRY_POINT")
	bundlerEnv := envName(network, "BUNDLER_URL")
	paymasterEnv := envName(network, "PAYMASTER")

	if value := strings.TrimSpace(os.Getenv(factoryEnv)); value != "" {
		deployment.FactoryAddress = value
	}
	if value := strings.TrimSpace(os.Getenv(implEnv)); value != "" {
		deployment.ImplementationAddress = value
	}
	if value := strings.TrimSpace(os.Getenv(entryPointEnv)); value != "" {
		deployment.EntryPointAddress = value
	}
	if value := strings.TrimSpace(os.Getenv(bundlerEnv)); value != "" {
		deployment.BundlerURL = value
	}
	if value := strings.TrimSpace(os.Getenv(paymasterEnv)); value != "" {
		deployment.PaymasterAddress = value
	}

	if deployment.FactoryAddress == "" {
		return Deployment{}, errors.New("missing factory address for network")
	}
	if deployment.ImplementationAddress == "" {
		return Deployment{}, errors.New("missing implementation address for network")
	}

	return deployment, nil
}

func ValidateAAConfig(network string, requirePaymaster bool) (Deployment, error) {
	deployment, err := GetDeployment(network)
	if err != nil {
		return Deployment{}, err
	}

	if strings.TrimSpace(deployment.EntryPointAddress) == "" {
		return Deployment{}, errors.New("missing entry point address for network")
	}
	if strings.TrimSpace(deployment.BundlerURL) == "" {
		return Deployment{}, errors.New("missing bundler url for network")
	}
	if requirePaymaster && strings.TrimSpace(deployment.PaymasterAddress) == "" {
		return Deployment{}, errors.New("missing paymaster address for network")
	}

	return deployment, nil
}

func envName(network string, kind string) string {
	name := strings.ToUpper(strings.ReplaceAll(network, "-", "_"))
	return "POCKET_" + kind + "_" + name
}

func GetOwnerCreationMinGasWei(network string) *big.Int {
	networkKey := strings.TrimSpace(strings.ToLower(network))
	defaultValue := defaultOwnerCreationMinGasWei(networkKey)
	value := strings.TrimSpace(os.Getenv(envName(networkKey, "OWNER_MIN_GAS_WEI")))
	if value == "" {
		return defaultValue
	}

	if strings.HasPrefix(value, "0x") || strings.HasPrefix(value, "0X") {
		parsed := new(big.Int)
		if _, ok := parsed.SetString(value[2:], 16); ok && parsed.Sign() > 0 {
			return parsed
		}
		return defaultValue
	}

	intValue, err := strconv.ParseInt(value, 10, 64)
	if err != nil || intValue <= 0 {
		return defaultValue
	}

	return big.NewInt(intValue)
}

func defaultOwnerCreationMinGasWei(network string) *big.Int {
	switch network {
	case "ethereum-sepolia":
		return big.NewInt(3_000_000_000_000_000) // 0.003 ETH
	case "ethereum-mainnet":
		return big.NewInt(15_000_000_000_000_000) // 0.015 ETH
	default:
		return big.NewInt(5_000_000_000_000_000) // 0.005 ETH
	}
}
