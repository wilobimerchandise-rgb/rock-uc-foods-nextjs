/**
 * ROCK UC FOODS - Session Cookie Settings
 * Playbook v2 Section 28 (Phase 1E)
 * 
 * Rules:
 * - Session cookies are HttpOnly, SameSite Lax, path /, Secure in production.
 * - Single source of truth used by both server client and middleware.
 */

export const SESSION_COOKIE_NAME = 'sb-ruc-auth-token';

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
  path: string;
  maxAge?: number;
}

export function getSessionCookieOptions(value: string, maxAgeSeconds = 60 * 60 * 24 * 7): CookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
