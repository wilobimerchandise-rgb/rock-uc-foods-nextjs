/**
 * ROCK UC FOODS - Security and Sanitation Utilities
 * (Playbook v2 Section 6 & 8)
 */

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * In-memory sliding window rate limiter.
 * Default: 10 requests per 60 seconds per key.
 */
export function checkRateLimit(
  key: string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): { allowed: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetInMs: windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetInMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetInMs: entry.resetAt - now };
}

/**
 * Normalizes Nigerian phone numbers to standard E.164 format (+234...).
 * Accepts: "08033729125", "2348033729125", "+2348033729125".
 * Rejects invalid length or non-Nigerian formats.
 */
export function normalizeNigerianPhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Phone number must be a non-empty string.');
  }

  // Remove whitespace, dashes, parens
  const cleaned = phone.replace(/[\s\-()]/g, '');

  let normalized = cleaned;
  if (normalized.startsWith('+234')) {
    normalized = normalized.slice(4);
  } else if (normalized.startsWith('234')) {
    normalized = normalized.slice(3);
  } else if (normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  } else {
    throw new Error(`Invalid phone format: must start with 0, 234, or +234. Got '${phone}'.`);
  }

  // Nigerian phone numbers without country code must be exactly 10 digits (e.g. 8033729125)
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error(`Invalid Nigerian phone length: expected 10 digits after prefix. Got '${phone}'.`);
  }

  return `+234${normalized}`;
}

/**
 * Formats a generic production error message that prevents internal stack trace leaks.
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Whitelist safe business validation error names
    if (
      error.name === 'AuthorizationError' ||
      error.name === 'PolicyConsentError' ||
      error.message.startsWith('Invalid') ||
      error.message.startsWith('Calculation error')
    ) {
      return error.message;
    }
  }
  return 'An internal service error occurred. Please contact customer support via WhatsApp.';
}
