/**
 * ROCK UC FOODS - MFA Configuration & Enrollment API
 * Playbook v4 Section 23
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityStore } from '@/src/security/stepUp';
import { generateMfaSecret, verifyTotp } from '@/src/security/totp';
import { resolveActiveAdminProfile } from '@/src/order/orderAuth';
import { globalAuthService } from '@/src/auth/wiring';
import { requireRole, AuthorizationError } from '@/src/lib/auth/access';
import { isSameOrigin } from '@/src/lib/same-origin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const resolved = await resolveActiveAdminProfile(req);
  if ('error' in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const userProfile = resolved.userProfile;
  const authRecord = globalAuthService.getUserById(userProfile.id);
  const verifiedFactor = authRecord?.factors.find(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );

  if (verifiedFactor) {
    securityStore.syncVerifiedTotpCredential(userProfile.id, verifiedFactor.secret);
  }

  const cred = securityStore.getMfaCredential(userProfile.id);
  if (cred && cred.isEnabled) {
    return NextResponse.json(
      {
        isEnabled: true,
        accountEmail: userProfile.email,
        role: userProfile.role,
        backupCodesRemaining: cred.backupCodes.length,
        updatedAt: cred.updatedAt,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const seed = generateMfaSecret(
    'ROCK UC FOODS',
    userProfile.email || `${userProfile.id}@rockucfoods.com`
  );

  return NextResponse.json(
    {
      isEnabled: false,
      accountEmail: userProfile.email,
      role: userProfile.role,
      setupSecret: seed.secret,
      otpauthUri: seed.otpauthUri,
      backupCodes: seed.backupCodes,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

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
    requireRole(['owner', 'developer'], resolved.userProfile, 'enroll TOTP MFA', 'security');
    const userId = resolved.userProfile.id;

    const existingCred = securityStore.getMfaCredential(userId);
    const authRecord = globalAuthService.getUserById(userId);
    const hasVerifiedFactor = Boolean(
      authRecord?.factors.some((f) => f.factor_type === 'totp' && f.status === 'verified')
    );

    if (existingCred?.isEnabled || hasVerifiedFactor) {
      return NextResponse.json(
        { error: 'Authenticator is already enrolled and verified. Cannot enroll an additional factor.' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const body = await req.json();
    const { secret, code, backupCodes } = body || {};

    if (!secret || !code || typeof secret !== 'string' || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'secret and 6-digit code are required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const verification = verifyTotp(code, secret, 0);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.reason || 'Invalid verification code.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const newCred = {
      userId,
      secret,
      isEnabled: true,
      backupCodes: Array.isArray(backupCodes) ? backupCodes : [],
      lastUsedStep: verification.step || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    securityStore.saveMfaCredential(newCred);
    globalAuthService.verifyUserFactorDirectly(userId, secret);
    securityStore.recordAuditEvent({
      actorUserId: userId,
      actorRole: resolved.userProfile.role as 'owner' | 'developer',
      eventType: 'mfa.enrolled',
      details: { backupCodesCount: newCred.backupCodes.length },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Multi-Factor Authentication enabled successfully.',
        backupCodesRemaining: newCred.backupCodes.length,
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
      { error: err.message || 'MFA enrollment failed.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
