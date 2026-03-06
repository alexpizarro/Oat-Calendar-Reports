import * as rateLimiter from './rate-limiter';
import { RateLimitError } from './rate-limiter';
import { getAccessToken } from './token-manager';

const GHL_BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

export class GHLApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`GHL API error ${status}: ${body}`);
    this.name = 'GHLApiError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calcBackoff(attempt: number): number {
  const base = 1_000;
  const max = 60_000;
  const jitter = Math.random() * 500;
  return Math.min(base * Math.pow(2, attempt), max) + jitter;
}

export class GHLClient {
  private locationId: string;
  private maxRetries: number;

  constructor(locationId: string, maxRetries = 3) {
    this.locationId = locationId;
    this.maxRetries = maxRetries;
  }

  async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        // Acquire rate limit token (may throw RateLimitError)
        await rateLimiter.acquire(this.locationId);

        const token = await getAccessToken(this.locationId);

        const url = new URL(GHL_BASE_URL + path);
        if (options.params) {
          for (const [k, v] of Object.entries(options.params)) {
            if (v !== undefined && v !== null) {
              url.searchParams.set(k, String(v));
            }
          }
        }

        const res = await fetch(url.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Version: GHL_API_VERSION,
            'Content-Type': 'application/json',
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        // Sync rate limit state from headers
        const remaining = res.headers.get('X-RateLimit-Remaining');
        if (remaining !== null && !isNaN(Number(remaining))) {
          rateLimiter.syncFromHeader(this.locationId, Number(remaining));
        }

        if (res.status === 429) {
          rateLimiter.drain(this.locationId);

          const retryAfterHeader = res.headers.get('Retry-After');
          const waitMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : calcBackoff(attempt);

          if (attempt >= this.maxRetries) {
            throw new GHLApiError(429, 'Rate limit exceeded after max retries');
          }

          await sleep(waitMs);
          attempt++;
          continue;
        }

        if (res.status >= 500 && attempt < this.maxRetries) {
          await sleep(calcBackoff(attempt));
          attempt++;
          continue;
        }

        if (!res.ok) {
          const body = await res.text();
          throw new GHLApiError(res.status, body);
        }

        // Handle empty responses (e.g., 204 No Content)
        const contentType = res.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          return {} as T;
        }

        return res.json() as Promise<T>;
      } catch (e) {
        if (e instanceof RateLimitError && attempt < this.maxRetries) {
          await sleep(e.retryAfterMs);
          attempt++;
          continue;
        }
        throw e;
      }
    }
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>('POST', path, { body });
  }
}
