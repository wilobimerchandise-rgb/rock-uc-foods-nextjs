/**
 * ROCK UC FOODS - Client IP & Hash Extraction
 * Playbook v4 Section 28
 * Unknown IPs share a single bucket ('unknown').
 */

import crypto from 'crypto';

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}

export function hashIp(ip: string, salt: string = process.env.IP_HASH_SALT || 'ruc_default_salt_2026'): string {
  if (!ip || ip === 'unknown') {
    return 'unknown';
  }
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex').substring(0, 16);
}
