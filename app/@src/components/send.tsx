// lib/send/sendTransaction.ts

import { sendUSDC } from "@/@src/lib/ethereum/send-usdc";
import { pocketBackend } from "@/@src/lib/api/pocketBackend";
import type { NetworkKey } from "@/@src/lib/core/walletCore";

export async function executeSend({
  network,
  destination,
  amountUsd,
  walletAddress,
  tokenAddress,
}: {
  network: NetworkKey;
  destination: string;
  amountUsd: string;
  walletAddress: string;
  tokenAddress: string;
}) {
  const txHash = await sendUSDC(network, destination, amountUsd);

  if (pocketBackend.isConfigured()) {
    await pocketBackend.announceTransaction({
      txHash,
      fromAddress: walletAddress,
      toAddress: destination,
      tokenSymbol: "USDC",
      tokenAddress,
      amount: amountUsd,
      network,
      timestampMs: Date.now(),
    });
  }

  return txHash;
}