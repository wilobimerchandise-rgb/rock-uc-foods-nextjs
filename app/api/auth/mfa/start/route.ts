import { NextRequest, NextResponse } from 'next/server';
import { validateAuthRouteRequest, authJson } from '@/src/auth/route-helper';
import { mfaStart, AuthError } from '@/src/auth/login-core';
import { createLoginDeps } from '@/src/auth/wiring';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const validation = await validateAuthRouteRequest(request);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const { ipHash } = validation;
  const deps = createLoginDeps(ipHash);

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
