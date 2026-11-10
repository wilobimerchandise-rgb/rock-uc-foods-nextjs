import { NextRequest, NextResponse } from 'next/server';
import { validateAuthRouteRequest, authJson } from '@/src/auth/route-helper';
import { login, AuthError } from '@/src/auth/login-core';
import { createLoginDeps } from '@/src/auth/wiring';
import { getSessionCookieOptions } from '@/src/auth/cookies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const validation = await validateAuthRouteRequest(request);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const { body, ipHash } = validation;
  const deps = createLoginDeps(ipHash);

  try {
    const result = await login(body, deps);
    const sessionRes = await deps.auth.getSession();
    const sessionToken = sessionRes.session?.access_token || `tok-${Date.now()}`;

    const response = authJson({
      step: result.step,
      role: result.role,
      next: result.next,
    });

    // Set session cookie
    const cookieOpts = getSessionCookieOptions(sessionToken);
    response.cookies.set(cookieOpts.name, cookieOpts.value, {
      httpOnly: cookieOpts.httpOnly,
      sameSite: cookieOpts.sameSite,
      secure: cookieOpts.secure,
      path: cookieOpts.path,
      maxAge: cookieOpts.maxAge,
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
