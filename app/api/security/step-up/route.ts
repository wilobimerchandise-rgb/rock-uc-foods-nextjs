/**
 * ROCK UC FOODS - Step-Up Challenge Verification API
 * Playbook v4 Section 23
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityStore, verifyStepUpCode } from '@/src/security/stepUp';
import { SensitiveOperation, UserRole } from '@/src/types/security';
import { resolveActiveAdminProfile } from '@/src/order/orderAuth';
import { globalAuthService } from '@/src/auth/wiring';
import { requireRole, AuthorizationError } from '@/src/lib/auth/access';
import { isSameOrigin } from '@/src/lib/same-origin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: 'Cross-origin or missing origin requests are forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const resolved = await resolveActiveAdminProfile(req);
  if ('error' in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    requireRole(['owner', 'developer'], resolved.userProfile, 'verify step-up challenge', 'security');
    const userId = resolved.userProfile.id;
    const userRole = resolved.userProfile.role as UserRole;

    const authRecord = globalAuthService.getUserById(userId);
    const verifiedFactor = authRecord?.factors.find(
      (f) => f.factor_type === 'totp' && f.status === 'verified'
    );
    if (verifiedFactor) {
      securityStore.syncVerifiedTotpCredential(userId, verifiedFactor.secret);
    }

    const body = await req.json();
    const { code, purpose = 'price_update' } = body || {};

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Authenticator or backup code is required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const result = verifyStepUpCode(
      userId,
      code,
      purpose as SensitiveOperation,
      userRole
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Verification failed.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        success: true,
        stepUpToken: result.stepUpToken,
        message: 'Step-up authorization granted.',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Step-up verification failed.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
