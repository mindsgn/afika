package ethereum

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

const defaultMinPriorityFeeWei int64 = 100_000_000 // 0.1 gwei

// ResolveTxFeeCaps computes EIP-1559 maxFeePerGas and maxPriorityFeePerGas
// from the chain-suggested tip and base fee.
//
// minPriorityFeeWei is the caller-supplied floor; nil means 0.1 gwei.
// Returns (maxFeePerGas, maxPriorityFeePerGas, error).
func ResolveTxFeeCaps(ctx context.Context, client *ethclient.Client, minPriorityFeeWei *big.Int) (*big.Int, *big.Int, error) {
	if minPriorityFeeWei == nil || minPriorityFeeWei.Sign() <= 0 {
		minPriorityFeeWei = big.NewInt(defaultMinPriorityFeeWei)
	}

	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, nil, err
	}

	priorityFee := new(big.Int).Div(gasPrice, big.NewInt(4))
	if priorityFee.Sign() == 0 {
		priorityFee = big.NewInt(1)
	}

	if suggestedTip, tipErr := client.SuggestGasTipCap(ctx); tipErr == nil && suggestedTip != nil && suggestedTip.Sign() > 0 {
		if suggestedTip.Cmp(priorityFee) > 0 {
			priorityFee = new(big.Int).Set(suggestedTip)
		}
	}

	if priorityFee.Cmp(minPriorityFeeWei) < 0 {
		priorityFee = new(big.Int).Set(minPriorityFeeWei)
	}

	if gasPrice.Cmp(priorityFee) < 0 {
		gasPrice = new(big.Int).Set(priorityFee)
	}

	if header, hdrErr := client.HeaderByNumber(ctx, nil); hdrErr == nil {
		candidate := maxFeeFromBaseFee(header, priorityFee)
		if candidate.Cmp(gasPrice) > 0 {
			gasPrice = candidate
		}
	}

	return gasPrice, priorityFee, nil
}

func maxFeeFromBaseFee(header *types.Header, priorityFee *big.Int) *big.Int {
	if header == nil || header.BaseFee == nil || priorityFee == nil {
		return big.NewInt(0)
	}
	// EIP-1559: maxFee = 2 * baseFee + priorityFee
	maxFee := new(big.Int).Mul(header.BaseFee, big.NewInt(2))
	maxFee.Add(maxFee, priorityFee)
	return maxFee
}
