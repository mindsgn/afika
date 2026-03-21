type BackendErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
  };
  requestId?: string;
};

type BackendSuccess<T> = {
  data: T;
  requestId?: string;
  timingsMs?: Record<string, number>;
};

const API_KEY = (process.env.EXPO_PUBLIC_POCKET_BACKEND_API_KEY || '').trim();

const URLS = {
  health:              (process.env.EXPO_PUBLIC_CF_HEALTH_URL              || '').trim(),
  walletsSave:         (process.env.EXPO_PUBLIC_CF_WALLETS_SAVE_URL        || '').trim(),
  walletsList:         (process.env.EXPO_PUBLIC_CF_WALLETS_LIST_URL        || '').trim(),
  balances:            (process.env.EXPO_PUBLIC_CF_BALANCES_URL            || '').trim(),
  transactionsList:    (process.env.EXPO_PUBLIC_CF_TRANSACTIONS_LIST_URL   || '').trim(),
  transactionsAnnounce:(process.env.EXPO_PUBLIC_CF_TRANSACTIONS_ANNOUNCE_URL || '').trim(),
  fxLatest:            (process.env.EXPO_PUBLIC_CF_FX_LATEST_URL           || '').trim(),
} as const;

function isConfigured() {
  return URLS.walletsSave.length > 0 && URLS.balances.length > 0;
}

function buildHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}

async function callBackend<T>(
  url: string,
  options?: { method?: string; body?: Record<string, unknown>; headers?: Record<string, string> },
): Promise<T> {
  if (!url) {
    throw new Error('backend_not_configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const method = options?.method ?? (options?.body ? 'POST' : 'GET');
    const response = await fetch(url, {
      method,
      headers: {
        ...buildHeaders(),
        ...(options?.headers ?? {}),
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const json = (await response.json()) as BackendSuccess<T> | BackendErrorEnvelope;
    if (!response.ok) {
      const errorMessage =
        ('error' in json ? json.error?.message : undefined) ||
        `backend_request_failed_${response.status}`;
      throw new Error(errorMessage);
    }

    return (json as BackendSuccess<T>).data;
  } finally {
    clearTimeout(timeout);
  }
}

export type BackendWallet = {
  address: string;
  network: string;
  createdAt: number;
  phoneNumber?: string;
  isVerified?: boolean;
  userLevel?: 'level0' | 'level1';
  phoneLinkedAt?: number;
  gasGiftSent?: boolean;
};

export type BackendTokenBalance = {
  tokenSymbol: string;
  tokenAddress: string;
  amount?: string;
  balance: string;
  usdAmount?: string;
  zarAmount?: string;
  usdValue: string;
  network: string;
  fetchedAt: number;
};

export type BackendTransaction = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  description?: string;
  tokenAddress?: string;
  tokenSymbol: string;
  amount: string;
  feeNative?: string;
  feeETH?: string;
  feeBase?: string;
  feeUsd?: string;
  feeZar?: string;
  usdAmount?: string;
  zarAmount?: string;
  network: string;
  direction: 'debit' | 'credit';
  state: string;
  blockNumber: number;
  timestampMs?: number;
  timestamp: number;
};

export type BackendFXRate = {
  pair: string;
  rate: string;
  fetchedAt: number;
};

export const pocketBackend = {
  isConfigured,

  async health() {
    return callBackend<{ ok: boolean; service: string; version: string; timestamp: string }>(
      URLS.health,
    );
  },

  /** Register a wallet address for balance and transaction tracking on the backend. */
  async saveWallet(address: string, network: string, options?: { phoneNumber?: string; isVerified?: boolean }) {
    return callBackend<BackendWallet>(URLS.walletsSave, {
      method: 'POST',
      body: {
        address,
        network,
        ...(options?.phoneNumber ? { phoneNumber: options.phoneNumber } : {}),
        ...(typeof options?.isVerified === 'boolean' ? { isVerified: options.isVerified } : {}),
      },
    });
  },

  async linkPhoneNumber(address: string, network: string, phoneNumber: string, firebaseIdToken?: string) {
    return callBackend<BackendWallet>(URLS.walletsSave, {
      method: 'POST',
      body: {
        address,
        network,
        phoneNumber,
        isVerified: true,
      },
      headers: firebaseIdToken ? { Authorization: `Bearer ${firebaseIdToken}` } : {},
    });
  },

  /** List all tracked wallet addresses. */
  async listWallets() {
    return callBackend<{ wallets: BackendWallet[] }>(URLS.walletsList);
  },

  /** Fetch the latest cached balances for an address, optionally filtered by network. */
  async getBalances(address: string, network?: string) {
    const params = new URLSearchParams({ address });
    if (network) params.set('network', network);
    return callBackend<{ address: string; network: string; balances: BackendTokenBalance[] }>(
      `${URLS.balances}?${params.toString()}`,
    );
  },

  /** List transactions for an address with optional direction filter and pagination. */
  async listTransactions(
    address: string,
    options?: { direction?: 'debit' | 'credit'; limit?: number; offset?: number },
  ) {
    const params = new URLSearchParams({ address });
    if (options?.direction) params.set('direction', options.direction);
    if (options?.limit != null) params.set('limit', String(options.limit));
    if (options?.offset != null) params.set('offset', String(options.offset));
    return callBackend<{ transactions: BackendTransaction[]; total: number; limit: number; offset: number }>(
      `${URLS.transactionsList}?${params.toString()}`,
    );
  },

  /** Announce a newly submitted transaction so recipients get realtime updates. */
  async announceTransaction(payload: {
    txHash: string;
    fromAddress: string;
    toAddress: string;
    tokenSymbol: string;
    amount: string;
    network: string;
    tokenAddress?: string;
    timestampMs?: number;
    timestamp?: number;
  }) {
    return callBackend<{ txHash: string; network: string; timestamp: number; announced: boolean }>(
      URLS.transactionsAnnounce,
      { method: 'POST', body: payload },
    );
  },

  /** Fetch the latest cached FX rate for a currency pair (e.g. "USD/ZAR"). */
  async getFXRate(pair: string) {
    const params = new URLSearchParams({ pair });
    return callBackend<BackendFXRate>(`${URLS.fxLatest}?${params.toString()}`);
  },
};