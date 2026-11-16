/**
 * Thin HTTP client for the POS sync endpoints.
 *
 * Only the network boundary lives here. It is intentionally small so the
 * engine can be unit tested with a fake client (see engine.test.ts).
 */
import { apiBaseUrl } from '@/services/payments';
import type { ChangesPage } from './entities';

export class SyncApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    /** A 4xx business-rule rejection will never succeed on retry. */
    readonly permanent: boolean,
  ) {
    super(message);
    this.name = 'SyncApiError';
  }
}

export interface SyncClientOptions {
  /** Privy access token when the merchant is signed in. */
  accessToken?: string | null;
  /** Override for tests. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

export interface SyncClient {
  request<T>(path: string, init?: RequestInit, idempotencyKey?: string): Promise<T>;
  getChanges(since: number, limit?: number): Promise<ChangesPage>;
  resolveExternalId(entity: string, externalId: string): Promise<string | null>;
  linkExternalId(entity: string, externalId: string, entityId: string): Promise<void>;
}

interface Envelope<T> {
  data: T;
}

function sharedToken(): string {
  return process.env.EXPO_PUBLIC_API_TOKEN?.trim() ?? '';
}

export function createSyncClient(options: SyncClientOptions = {}): SyncClient {
  const base = (options.baseUrl ?? apiBaseUrl()).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const bearer = options.accessToken?.trim() || sharedToken();

  async function request<T>(path: string, init: RequestInit = {}, idempotencyKey?: string): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      throw new SyncApiError('NETWORK', error instanceof Error ? error.message : 'Could not reach the sync service', 0, false);
    }

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
    }
    if (!response.ok) {
      const errorBody = body as { error?: { code?: string; message?: string } } | null;
      throw new SyncApiError(
        errorBody?.error?.code ?? `HTTP_${response.status}`,
        errorBody?.error?.message ?? `Sync service error (${response.status})`,
        response.status,
        response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429,
      );
    }
    return (body as Envelope<T> | null)?.data as T;
  }

  return {
    request,
    async getChanges(since: number, limit = 100): Promise<ChangesPage> {
      return request<ChangesPage>(`/v1/pos/changes?since=${encodeURIComponent(since)}&limit=${encodeURIComponent(limit)}`);
    },
    async resolveExternalId(entity: string, externalId: string): Promise<string | null> {
      try {
        const result = await request<{ entityId: string }>(
          `/v1/pos/external-ids?entity=${encodeURIComponent(entity)}&externalId=${encodeURIComponent(externalId)}`,
        );
        return result?.entityId ?? null;
      } catch (error) {
        if (error instanceof SyncApiError && error.status === 404) return null;
        throw error;
      }
    },
    async linkExternalId(entity: string, externalId: string, entityId: string): Promise<void> {
      await request('/v1/pos/external-ids', {
        method: 'POST',
        body: JSON.stringify({ entity, externalId, entityId }),
      });
    },
  };
}
