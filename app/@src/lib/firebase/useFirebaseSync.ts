import { useEffect, useRef } from 'react';
import { collection, onSnapshot, orderBy, query, where, limit } from 'firebase/firestore';
import PocketCore from '@/modules/pocket-module';
import useWallet, { TokenBalance, WalletTransaction } from '@/@src/store/wallet';
import { DEFAULT_NETWORK, ensureWalletCoreReady } from '@/@src/lib/core/walletCore';
import { pocketBackend } from '@/@src/lib/api/pocketBackend';
import { getFirestoreDb } from './client';

const TX_LIMIT = 50;

function mapBalanceDoc(data: any): TokenBalance {
  const tokenAddress = String(data.tokenAddress || '');
  const amount = String(data.amount || data.balance || '0');
  const usdAmount = String(data.usdAmount || data.usdValue || '');
  return {
    symbol: String(data.tokenSymbol || ''),
    address: tokenAddress,
    amount,
    balance: amount,
    isNative: tokenAddress === '' || tokenAddress === 'native',
    usdAmount,
    usdValue: usdAmount,
    zarAmount: String(data.zarAmount || data.zarValue || ''),
    fetchedAt: Number(data.fetchedAt || 0),
    network: String(data.network || ''),
  };
}

function mapTxDoc(data: any): WalletTransaction {
  const hash = String(data.txHash || data.hash || '');
  const timestampMs = Number(data.timestampMs || data.timestamp || 0);
  const normalizedTimestamp = timestampMs > 0 && timestampMs < 1_000_000_000_000
    ? timestampMs * 1000
    : timestampMs;
  const feeNative = String(data.feeNative || data.feeBase || data.feeEth || data.feeETH || '');
  const direction = data.direction === 'debit' ? 'debit' : 'credit';
  return {
    hash,
    fromAddress: String(data.fromAddress || ''),
    toAddress: String(data.toAddress || ''),
    description: data.description ? String(data.description) : undefined,
    tokenAddress: data.tokenAddress ? String(data.tokenAddress) : undefined,
    tokenSymbol: String(data.tokenSymbol || ''),
    amount: String(data.amount || '0'),
    feeNative,
    feeEth: feeNative,
    feeUsd: data.feeUsd ? String(data.feeUsd) : (data.feeUSD ? String(data.feeUSD) : undefined),
    feeZar: data.feeZar ? String(data.feeZar) : (data.feeZAR ? String(data.feeZAR) : undefined),
    usdAmount: data.usdAmount ? String(data.usdAmount) : undefined,
    zarAmount: data.zarAmount ? String(data.zarAmount) : undefined,
    network: String(data.network || ''),
    mode: 'backend',
    direction,
    state: String(data.state || ''),
    timestampMs: normalizedTimestamp,
    timestamp: normalizedTimestamp,
  };
}

export function mergeIncomingTransactions(existing: WalletTransaction[], added: WalletTransaction[]): WalletTransaction[] {
  const seen = new Set(existing.map((tx) => `${tx.hash}:${tx.direction}`));
  const next = [...existing];
  for (const tx of added) {
    const key = `${tx.hash}:${tx.direction}`;
    if (!tx.hash || seen.has(key)) continue;
    seen.add(key);
    next.unshift(tx);
  }
  return next;
}

export function useFirebaseSync() {
  const { walletAddress, network, setBalances, setTransactions } = useWallet();
  const networkName = network || DEFAULT_NETWORK;
  const seenTxHashes = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!walletAddress) return;
    seenTxHashes.current = new Set();

    const db = getFirestoreDb();
    let unsubscribeBalances: (() => void) | null = null;
    let unsubscribeTxs: (() => void) | null = null;

    const bootstrap = async () => {
      try {
        await ensureWalletCoreReady();

        // Seed balances from local DB
        const cachedBalancesJson = await PocketCore.getLatestBalances(networkName);
        const cachedBalances = JSON.parse(cachedBalancesJson) as Array<any>;
        
        if (Array.isArray(cachedBalances)) {
          const mapped = cachedBalances.map(mapBalanceDoc);
          setBalances(mapped);
        }

        // Seed transactions from local DB (credit + debit)
        const cachedTxJson = await PocketCore.listAllTransactions(networkName, TX_LIMIT, 0);
        const cachedTxs = JSON.parse(cachedTxJson) as Array<any>;
        if (Array.isArray(cachedTxs)) {
          const mapped = cachedTxs.map(mapTxDoc);
          mapped.forEach((tx) => {
            if (tx.hash) seenTxHashes.current.add(`${tx.hash}:${tx.direction}`);
          });
          setTransactions(mapped);
        }
      } catch {
        // ignore cache errors
      }

    
      if (!db) {
        return;
      }

      const balancesQuery = query(
        collection(db, `wallets/${walletAddress}/balances`),
        //where('network', '==', networkName),
      );

      unsubscribeBalances = onSnapshot(balancesQuery, async (snapshot) => {
        const balances = snapshot.docs.map((docSnap) => mapBalanceDoc(docSnap.data()));
        if (balances.length > 0) {
          setBalances(balances);
        }

        try {
          await PocketCore.upsertBalanceSnapshots(JSON.stringify(balances.map((b) => ({
            walletAddress: walletAddress.toLowerCase(),
            tokenAddress: b.address,
            tokenSymbol: b.symbol,
            balance: b.amount ?? b.balance,
            amount: b.amount ?? b.balance,
            usdValue: b.usdAmount ?? b.usdValue ?? '',
            usdAmount: b.usdAmount ?? b.usdValue ?? '',
            zarAmount: b.zarAmount ?? '',
            network: b.network ?? networkName,
            fetchedAt: b.fetchedAt ?? 0,
          }))));
        } catch {
        }
      });

      const txQuery = query(
        collection(db, `wallets/${walletAddress}/transactions`, ),
        orderBy('timestamp', 'desc'),
        limit(TX_LIMIT),
      );
      unsubscribeTxs = onSnapshot(txQuery, async (snapshot) => {
        const added = snapshot.docChanges()
          .filter((change) => change.type === 'added')
          .map((change) => mapTxDoc(change.doc.data()));

        if (added.length === 0) {
        
      return;
    }
        const newOnes = added.filter((tx) => tx.hash && !seenTxHashes.current.has(`${tx.hash}:${tx.direction}`));
        newOnes.forEach((tx) => seenTxHashes.current.add(`${tx.hash}:${tx.direction}`));
        if (newOnes.length === 0) return;

        const current = useWallet.getState().transactions;
        setTransactions(mergeIncomingTransactions(current, newOnes));

        try {
          await PocketCore.upsertTransactions(JSON.stringify(newOnes.map((tx) => ({
            walletAddress: walletAddress.toLowerCase(),
            txHash: tx.hash,
            fromAddress: tx.fromAddress,
            toAddress: tx.toAddress,
            description: tx.description ?? '',
            tokenAddress: tx.tokenAddress ?? '',
            tokenSymbol: tx.tokenSymbol,
            amount: tx.amount,
            feeNative: tx.feeNative ?? tx.feeEth,
            feeEth: tx.feeEth,
            feeUsd: tx.feeUsd ?? '',
            feeZar: tx.feeZar ?? '',
            usdAmount: tx.usdAmount ?? '',
            zarAmount: tx.zarAmount ?? '',
            network: tx.network ?? networkName,
            direction: tx.direction,
            state: tx.state,
            blockNumber: 0,
            timestampMs: tx.timestampMs ?? tx.timestamp,
            timestamp: tx.timestampMs ?? tx.timestamp,
          }))));
        } catch {
          // ignore local save errors
        }
      });
      
    };

    bootstrap();

    return () => {
      unsubscribeBalances?.();
      unsubscribeTxs?.();
    };
  }, [walletAddress, networkName, setBalances, setTransactions]);
}
