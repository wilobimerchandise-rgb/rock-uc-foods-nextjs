import { NextRequest, NextResponse } from 'next/server';
import { validateAuthRouteRequest, authJson } from '@/src/auth/route-helper';
import { mfaVerify, AuthError } from '@/src/auth/login-core';
import { createLoginDeps } from '@/src/auth/wiring';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const validation = await validateAuthRouteRequest(request);
  if (validation instanceof NextResponse) {
    return validation;
  }

  const { body, ipHash } = validation;
  const deps = createLoginDeps(ipHash);

  try {
    const result = await mfaVerify(body, deps);
    return authJson(result);
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return authJson({ error: err.message }, err.statusCode);
    }
    const message = err instanceof Error ? err.message : 'Verification failed';
    return authJson({ error: message }, 500);
  }
}
