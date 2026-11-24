import { NextRequest, NextResponse } from 'next/server';
import { validateAuthRouteRequest, authJson } from '@/src/auth/route-helper';
import { login, AuthError } from '@/src/auth/login-core';
import { createCookieLoginDeps } from '@/src/auth/wiring';
import { getSessionCookieOptions, getRememberCookieOptions } from '@/src/auth/cookies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const validation = await validateAuthRouteRequest(request);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const { body, ipHash } = validation;
  const deps = createCookieLoginDeps(ipHash);

  try {
    const result = await login(body, deps);
    const sessionRes = await deps.auth.getSession();
    const sessionToken =
      deps.getSessionToken() || sessionRes.session?.access_token || `tok-${Date.now()}`;

    const response = authJson({
      step: result.step,
      role: result.role,
      next: result.next,
    });

    // Set HttpOnly session cookie: 30 days if "Keep me signed in" checked, browser-session otherwise
    const cookieOpts = getSessionCookieOptions(sessionToken, result.remember);
    response.cookies.set(cookieOpts.name, cookieOpts.value, {
      httpOnly: cookieOpts.httpOnly,
      sameSite: cookieOpts.sameSite,
      secure: cookieOpts.secure,
      path: cookieOpts.path,
      ...(cookieOpts.maxAge !== undefined ? { maxAge: cookieOpts.maxAge } : {}),
    });

    const rememberOpts = getRememberCookieOptions(result.remember);
    response.cookies.set(rememberOpts.name, rememberOpts.value, {
      httpOnly: rememberOpts.httpOnly,
      sameSite: rememberOpts.sameSite,
      secure: rememberOpts.secure,
      path: rememberOpts.path,
      ...(rememberOpts.maxAge !== undefined ? { maxAge: rememberOpts.maxAge } : {}),
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return authJson({ error: err.message }, err.statusCode);
    }
    const message = err instanceof Error ? err.message : 'Authentication failed';
    return authJson({ error: message }, 500);
  }
}
