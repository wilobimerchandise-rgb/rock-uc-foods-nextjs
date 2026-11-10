import { NextRequest, NextResponse } from 'next/server';
import { validateAuthRouteRequest, authJson } from '@/src/auth/route-helper';
import { logout, AuthError } from '@/src/auth/login-core';
import { createLoginDeps } from '@/src/auth/wiring';
import { SESSION_COOKIE_NAME } from '@/src/auth/cookies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const validation = await validateAuthRouteRequest(request);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const { ipHash } = validation;
  const deps = createLoginDeps(ipHash);

  try {
    const result = await logout(deps);
    const response = authJson(result);

    // Delete session cookie
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return authJson({ error: err.message }, err.statusCode);
    }
    const message = err instanceof Error ? err.message : 'Logout failed';
    return authJson({ error: message }, 500);
  }
}
