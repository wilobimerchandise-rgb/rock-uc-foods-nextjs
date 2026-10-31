/**
 * ROCK UC FOODS - Rate Limiter Module
 * Fails closed (429) on limiter errors.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export class RateLimitError extends Error {
  public statusCode = 429;
  constructor(message = 'Too many requests. Please try again later.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 600 * 1000 // 600 seconds default
): RateLimitResult {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetInMs: record.resetAt - now };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetInMs: record.resetAt - now };
}

export function resetRateLimitStore(): void {
  memoryStore.clear();
}
