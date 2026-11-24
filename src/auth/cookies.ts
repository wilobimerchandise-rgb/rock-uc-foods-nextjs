/**
 * ROCK UC FOODS - Session Cookie Settings
 * Playbook v2 Section 28 (Phase 1E)
 * 
 * Rules:
 * - Session cookies are HttpOnly, SameSite Lax, path /, Secure in production.
 * - Single source of truth used by both server client and middleware.
 */

export const SESSION_COOKIE_NAME = 'sb-ruc-auth-token';
export const REMEMBER_COOKIE_NAME = 'ruc_remember';
export const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days (Playbook §28.5)

export interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
  path: string;
  maxAge?: number;
}

export function authCookieOptions(remember: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(remember ? { maxAge: REMEMBER_MAX_AGE_SECONDS } : {}),
  };
}

export function getSessionCookieOptions(
  value: string,
  rememberOrMaxAge: boolean | number = false
): CookieOptions {
  const maxAge =
    typeof rememberOrMaxAge === 'number'
      ? rememberOrMaxAge
      : rememberOrMaxAge
      ? REMEMBER_MAX_AGE_SECONDS
      : undefined;

  return {
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

export function getRememberCookieOptions(remember: boolean): CookieOptions {
  return {
    name: REMEMBER_COOKIE_NAME,
    value: remember ? '1' : '0',
    ...authCookieOptions(remember),
  };
}
