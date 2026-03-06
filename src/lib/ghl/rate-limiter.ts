import prisma from '@/lib/prisma';

const MAX_TOKENS = 100;
const WINDOW_MS = 10_000; // 10 seconds

interface BucketState {
  tokens: number;
  lastRefill: number; // Unix ms
}

export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super(`Rate limit exceeded. Retry after ${retryAfterMs}ms`);
    this.name = 'RateLimitError';
  }
}

// In-memory store keyed by locationId
const buckets = new Map<string, BucketState>();

function refillBucket(state: BucketState): BucketState {
  const now = Date.now();
  const elapsed = now - state.lastRefill;
  const windowsElapsed = Math.floor(elapsed / WINDOW_MS);

  if (windowsElapsed > 0) {
    return {
      tokens: Math.min(MAX_TOKENS, state.tokens + windowsElapsed * MAX_TOKENS),
      lastRefill: state.lastRefill + windowsElapsed * WINDOW_MS,
    };
  }
  return state;
}

async function loadFromDb(locationId: string): Promise<BucketState> {
  try {
    const row = await prisma.rateLimitState.findUnique({ where: { location_id: locationId } });
    if (row) {
      return {
        tokens: row.requests_in_window,
        lastRefill: row.window_started_at.getTime(),
      };
    }
  } catch {
    // DB unavailable — start fresh
  }
  return { tokens: MAX_TOKENS, lastRefill: Date.now() };
}

function persistToDb(locationId: string, state: BucketState): void {
  // Fire-and-forget; non-blocking
  prisma.rateLimitState.upsert({
    where: { location_id: locationId },
    update: {
      requests_in_window: state.tokens,
      window_started_at: new Date(state.lastRefill),
    },
    create: {
      location_id: locationId,
      requests_in_window: state.tokens,
      window_started_at: new Date(state.lastRefill),
    },
  }).catch(() => {});
}

export async function acquire(locationId: string): Promise<void> {
  if (!buckets.has(locationId)) {
    const state = await loadFromDb(locationId);
    buckets.set(locationId, state);
  }

  const rawState = buckets.get(locationId)!;
  const state = refillBucket(rawState);
  buckets.set(locationId, state);

  if (state.tokens < 1) {
    const msUntilNextRefill = WINDOW_MS - (Date.now() - state.lastRefill);
    throw new RateLimitError(Math.max(msUntilNextRefill, 100));
  }

  state.tokens -= 1;
  buckets.set(locationId, state);
  persistToDb(locationId, state);
}

/** Called when GHL returns X-RateLimit-Remaining header */
export function syncFromHeader(locationId: string, remaining: number): void {
  const state = buckets.get(locationId) ?? { tokens: remaining, lastRefill: Date.now() };
  // Trust the header if it reports fewer tokens than we think we have
  if (remaining < state.tokens) {
    state.tokens = remaining;
    buckets.set(locationId, state);
    persistToDb(locationId, state);
  }
}

/** Zero out the bucket (e.g., after a 429) */
export function drain(locationId: string): void {
  const state = buckets.get(locationId) ?? { tokens: 0, lastRefill: Date.now() };
  state.tokens = 0;
  buckets.set(locationId, state);
  persistToDb(locationId, state);
}
