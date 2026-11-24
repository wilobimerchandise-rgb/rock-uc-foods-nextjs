import { NextRequest, NextResponse } from 'next/server';
import { validateAuthRouteRequest, authJson } from '@/src/auth/route-helper';
import { mfaStart, AuthError } from '@/src/auth/login-core';
import { createCookieLoginDeps } from '@/src/auth/wiring';
import { SESSION_COOKIE_NAME } from '@/src/auth/cookies';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const validation = await validateAuthRouteRequest(request);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const { ipHash } = validation;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value || null;
  const deps = createCookieLoginDeps(ipHash, sessionToken);

  try {
    const result = await mfaStart(deps);
    return authJson(result);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return authJson({ error: err.message }, err.statusCode);
    }
    const message = err instanceof Error ? err.message : 'Failed to start MFA enrollment';
    return authJson({ error: message }, 500);
  }
}
