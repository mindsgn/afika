import { useMemo, useRef } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { Alert, StyleSheet, View } from "react-native";
import { encodeFunctionData, erc20Abi } from "viem";
import { useEmbeddedEthereumWallet } from "@privy-io/expo";
import { SEND_TOKEN } from "@/constants/tokens";
import { useWalletBalances } from "@/hooks/use-wallet-balances";
import { useKernelClient } from "@/hooks/use-Kernal";
import {
  keypadMaxFromBalance,
  parseTokenAmount,
  sanitizeDecimalInput,
} from "@/lib/amount";
import {
  buildPendingTransactionId,
  createPendingTransaction,
  updateTransaction,
} from "@/lib/transactions";
import { shortenAddress, getActiveWalletAddress } from "@/lib/wallet";
import { useWallet } from "@/store/wallet";
import { AmountKeypad } from "@/components/keypad";
import { colors } from "@/theme";

export default function SendAmountScreen() {
  const { address } = useLocalSearchParams<{ address: string }>();
  const { wallets } = useEmbeddedEthereumWallet();
  const wallet = wallets?.[0];
  const { kernelClient } = useKernelClient(wallet);
  const walletStore = useWallet();
  const activeWalletAddress = getActiveWalletAddress(walletStore);
  const { balanceMap } = useWalletBalances(activeWalletAddress);
  const usdcBalance = balanceMap.USDC;

  const sendingRef = useRef(false);

  const shortAddress = useMemo(() => shortenAddress(address), [address]);
  const availableAmount = usdcBalance?.amount || "0";
  const maxAmount = useMemo(
    () => keypadMaxFromBalance(availableAmount),
    [availableAmount],
  );

  const validateAmount = (value: string) => {
    try {
      const parsedAmount = parseTokenAmount(value, SEND_TOKEN.decimals);
      const parsedBalance = parseTokenAmount(
        availableAmount,
        SEND_TOKEN.decimals,
      );

      if (parsedAmount <= BigInt(0)) {
        return "Please enter a valid USDC amount.";
      }
      if (parsedAmount > parsedBalance) {
        return "Send amount cannot exceed your available USDC balance.";
      }
      return null;
    } catch {
      return "Please enter a valid USDC amount.";
    }
  };

  const handleSend = async (value: string) => {
    if (sendingRef.current) return;

    const validationError = validateAmount(value);
    if (validationError) {
      Alert.alert("Invalid amount", validationError);
      return;
    }

    if (!address?.trim() || !activeWalletAddress || !kernelClient) {
      Alert.alert(
        "Wallet not ready",
        "Your smart wallet is still loading. Please try again.",
      );
      return;
    }

    const normalizedAmount = sanitizeDecimalInput(value);
    const timestampMs = Date.now();
    const pendingDocId = buildPendingTransactionId("send");

    try {
      sendingRef.current = true;

      await createPendingTransaction(activeWalletAddress, pendingDocId, {
        kind: "send",
        state: "pending",
        source: "app",
        walletAddress: activeWalletAddress,
        network: "base-mainnet",
        direction: "debit",
        tokenSymbol: SEND_TOKEN.symbol,
        tokenAddress: SEND_TOKEN.address,
        amount: normalizedAmount,
        usdAmount: normalizedAmount,
        fromAddress: activeWalletAddress,
        toAddress: address.toLowerCase(),
        description: `Sending ${normalizedAmount} USDC`,
        timestampMs,
        timestamp: timestampMs,
        fetchedAtMs: timestampMs,
        fetchedAt: timestampMs,
      });

      router.push({
        pathname: "/transaction/process",
        params: {
          title: "Sending USDC",
          message: `Sending ${normalizedAmount} USDC to ${shortAddress}.`,
        },
      });

      const callData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "transfer",
        args: [
          address as `0x${string}`,
          parseTokenAmount(normalizedAmount, SEND_TOKEN.decimals),
        ],
      });

      const userOperationHash = await kernelClient.sendUserOperation({
        calls: [
          {
            to: SEND_TOKEN.address,
            data: callData,
            value: BigInt(0),
          },
        ],
      });

      await updateTransaction(activeWalletAddress, pendingDocId, {
        state: "submitted",
        userOperationHash,
      });

      const receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOperationHash,
      });

      const txHash = receipt?.receipt?.transactionHash;

      router.replace({
        pathname: "/transaction/complete",
        params: {
          title: "USDC sent",
          message: `You sent ${normalizedAmount} USDC successfully.`,
          amount: normalizedAmount,
          token: "USDC",
          target: address,
          txHash: txHash || userOperationHash,
        },
      });
    } catch (error) {
      console.log(error);
      await updateTransaction(activeWalletAddress, pendingDocId, {
        state: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      }).catch(() => null);

      router.replace({
        pathname: "/transaction/error",
        params: {
          title: "Send failed",
          message:
            error instanceof Error
              ? error.message
              : "Something went wrong while sending USDC.",
          retryPath: `/send/amount?address=${address}`,
        },
      });
    }
    sendingRef.current = false;
  };

  return (
    <View style={styles.container} testID="send-amount-screen">
      <AmountKeypad
        max={maxAmount}
        currencySymbol="$"
        accountLabel={shortAddress || "Recipient"}
        ctaLabel="Send USDC"
        onSubmit={(value) => handleSend(String(value))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
});
