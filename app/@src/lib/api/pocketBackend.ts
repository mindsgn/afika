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

function makeIdempotencyKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildHeaders(idempotencyKey?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  return headers;
}

async function callBackend<T>(path: string, body?: Record<string, unknown>, options?: { idempotencyKey?: string }): Promise<T> {
  if (!isConfigured()) {
    throw new Error('backend_not_configured');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: buildHeaders(options?.idempotencyKey),
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const json = (await response.json()) as BackendSuccess<T> | BackendErrorEnvelope;
    if (!response.ok) {
      const errorMessage = ('error' in json ? json.error?.message : undefined) || `backend_request_failed_${response.status}`;
      throw new Error(errorMessage);
    }

    return (json as BackendSuccess<T>).data;
  } finally {
    clearTimeout(timeout);
  }
}

export const pocketBackend = {
  isConfigured,
  async health() {
    return callBackend<{ ok: boolean; service: string; version: string; timestamp: string }>('/health');
  },
  async sendEmailPayment(input: { fromEmail: string; toEmail: string; amountUsdc: string; note?: string }) {
    return callBackend<{ id: string; status: string; fromEmail: string; toEmail: string; amountUsdc: string }>(
      '/v1/payments/send-email',
      {
        fromEmail: input.fromEmail,
        toEmail: input.toEmail,
        amountUsdc: input.amountUsdc,
        note: input.note || '',
      },
      { idempotencyKey: makeIdempotencyKey('send-email') },
    );
  },
  async claimPayments(email: string) {
    return callBackend<{ claimedCount: number }>(
      '/v1/payments/claim',
      { email },
      { idempotencyKey: makeIdempotencyKey('claim') },
    );
  },
};
