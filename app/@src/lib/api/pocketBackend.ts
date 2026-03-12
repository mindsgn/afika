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

const BASE_URL = (process.env.EXPO_PUBLIC_POCKET_BACKEND_BASE_URL || '').trim().replace(/\/$/, '');
const API_KEY = (process.env.EXPO_PUBLIC_POCKET_BACKEND_API_KEY || '').trim();

function isConfigured() {
  return BASE_URL.length > 0;
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
  path: string,
  options?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  if (!isConfigured()) {
    throw new Error('backend_not_configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const method = options?.method ?? (options?.body ? 'POST' : 'GET');
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: buildHeaders(),
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
};

export type BackendTokenBalance = {
  tokenSymbol: string;
  tokenAddress: string;
  balance: string;
  usdValue: string;
  network: string;
  fetchedAt: number;
};

export type BackendTransaction = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  tokenSymbol: string;
  amount: string;
  feeETH: string;
  feeUsd?: string;
  usdAmount?: string;
  network: string;
  direction: 'debit' | 'credit';
  state: string;
  blockNumber: number;
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
    return callBackend<{ ok: boolean; service: string; version: string; timestamp: string }>('/health');
  },

  /** Register a wallet address for balance and transaction tracking on the backend. */
  async saveWallet(address: string, network: string) {
    return callBackend<{ address: string; network: string }>('/v1/wallets', {
      method: 'POST',
      body: { address, network },
    });
  },

  /** List all tracked wallet addresses. */
  async listWallets() {
    return callBackend<{ wallets: BackendWallet[] }>('/v1/wallets/');
  },

  /** Fetch the latest cached balances for an address, optionally filtered by network. */
  async getBalances(address: string, network?: string) {
    const params = new URLSearchParams({ address });
    if (network) params.set('network', network);
    return callBackend<{ address: string; network: string; balances: BackendTokenBalance[] }>(
      `/v1/balances?${params.toString()}`,
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
      `/v1/transactions?${params.toString()}`,
    );
  },

  /** Fetch the latest cached FX rate for a currency pair (e.g. "USD/ZAR"). */
  async getFXRate(pair: string) {
    const params = new URLSearchParams({ pair });
    return callBackend<BackendFXRate>(`/v1/fx/latest?${params.toString()}`);
  },
};
