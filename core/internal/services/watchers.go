package services

import (
	"context"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/config"
	"github.com/mindsgn-studio/pocket-money-app/core/internal/database"
)

// AddressWatcher periodically scans for activity on known addresses.
func AddressWatcher(ctx context.Context, db *database.DB, interval time.Duration) error {
	if interval <= 0 {
		interval = time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			// Minimal stub: fetch known wallets and log on-chain balances.
			_ = db // placeholder to avoid unused warning in stub
			_ = config.GetDeployment
			_ = ethclient.DialContext
			_ = common.HexToAddress
		}
	}
}
