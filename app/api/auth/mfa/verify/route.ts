import { NextRequest, NextResponse } from 'next/server';
import { validateAuthRouteRequest, authJson } from '@/src/auth/route-helper';
import { mfaVerify, AuthError } from '@/src/auth/login-core';
import { createCookieLoginDeps } from '@/src/auth/wiring';
import {
  SESSION_COOKIE_NAME,
  REMEMBER_COOKIE_NAME,
  getSessionCookieOptions,
  getRememberCookieOptions,
} from '@/src/auth/cookies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const validation = await validateAuthRouteRequest(request);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const { body, ipHash } = validation;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value || null;
  const remember =
    request.cookies.get(REMEMBER_COOKIE_NAME)?.value === '1' ||
    Boolean(body && typeof body === 'object' && (body as Record<string, unknown>).remember === true);
  const deps = createCookieLoginDeps(ipHash, sessionToken);

  try {
    const result = await mfaVerify(body, deps);
    const response = authJson(result);

    if (sessionToken) {
      const cookieOpts = getSessionCookieOptions(sessionToken, remember);
      response.cookies.set(cookieOpts.name, cookieOpts.value, {
        httpOnly: cookieOpts.httpOnly,
        sameSite: cookieOpts.sameSite,
        secure: cookieOpts.secure,
        path: cookieOpts.path,
        ...(cookieOpts.maxAge !== undefined ? { maxAge: cookieOpts.maxAge } : {}),
      });
      const rememberOpts = getRememberCookieOptions(remember);
      response.cookies.set(rememberOpts.name, rememberOpts.value, {
        httpOnly: rememberOpts.httpOnly,
        sameSite: rememberOpts.sameSite,
        secure: rememberOpts.secure,
        path: rememberOpts.path,
        ...(rememberOpts.maxAge !== undefined ? { maxAge: rememberOpts.maxAge } : {}),
      });
    }

    return response;
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return authJson({ error: err.message }, err.statusCode);
    }
    const message = err instanceof Error ? err.message : 'Verification failed';
    return authJson({ error: message }, 500);
  }
}
