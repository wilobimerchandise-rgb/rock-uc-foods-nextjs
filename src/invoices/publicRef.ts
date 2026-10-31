/**
 * ROCK UC FOODS - Public Reference & Token Utilities
 * Playbook Phase 1D
 * 
 * Rules:
 * - Format: EVT-YYYYMMDD-XXXX
 * - XXXX is 4 random characters from A-Z and 2-9 (excluding 0, O, 1, I, L).
 * - Cryptographically random source, never sequential.
 * - Customer access token is 32 cryptographically random bytes (64 hex characters);
 *   only its SHA-256 hash is stored in the database.
 */

import crypto from 'crypto';

export const SAFE_REF_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 chars, no 0, O, 1, I, L

export function generatePublicRef(dateStr = new Date().toISOString()): string {
  const yyyymmdd = dateStr.slice(0, 10).replace(/-/g, '');
  let suffix = '';
  const randomBytes = crypto.randomBytes(4);

  for (let i = 0; i < 4; i++) {
    const idx = randomBytes[i] % SAFE_REF_CHARS.length;
    suffix += SAFE_REF_CHARS[idx];
  }

  return `EVT-${yyyymmdd}-${suffix}`;
}

export function generateAccessToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyTokenHash(rawToken: string, storedHash: string): boolean {
  if (!rawToken || !storedHash) return false;
  const computedHash = hashToken(rawToken);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}

export const hashAccessToken = hashToken;
export const verifyAccessToken = verifyTokenHash;
