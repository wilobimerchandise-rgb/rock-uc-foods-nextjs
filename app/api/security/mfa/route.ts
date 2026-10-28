/**
 * ROCK UC FOODS - MFA Configuration & Enrollment API
 * Playbook v4 Section 23
 */

import { NextRequest, NextResponse } from 'next/server';
import { securityStore } from '@/src/security/stepUp';
import { generateMfaSecret, verifyTotp } from '@/src/security/totp';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') || 'usr-owner-01';

  const cred = securityStore.getMfaCredential(userId);

  if (cred && cred.isEnabled) {
    return NextResponse.json({
      isEnabled: true,
      backupCodesRemaining: cred.backupCodes.length,
      updatedAt: cred.updatedAt,
    });
  }

  // Generate new secret for initial setup
  const seed = generateMfaSecret('ROCK UC FOODS', `${userId}@rockucfoods.com`);

  return NextResponse.json({
    isEnabled: false,
    setupSecret: seed.secret,
    otpauthUri: seed.otpauthUri,
    backupCodes: seed.backupCodes,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId = 'usr-owner-01', secret, code, backupCodes } = body;

    if (!secret || !code) {
      return NextResponse.json(
        { error: 'secret and 6-digit code are required.' },
        { status: 400 }
      );
    }

    const verification = verifyTotp(code, secret, 0);
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.reason || 'Invalid verification code.' },
        { status: 401 }
      );
    }

    const newCred = {
      userId,
      secret,
      isEnabled: true,
      backupCodes: backupCodes || [],
      lastUsedStep: verification.step || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    securityStore.saveMfaCredential(newCred);
    securityStore.recordAuditEvent({
      actorUserId: userId,
      actorRole: 'owner',
      eventType: 'mfa.enrolled',
      details: { backupCodesCount: newCred.backupCodes.length },
    });

    return NextResponse.json({
      success: true,
      message: 'Multi-Factor Authentication enabled successfully.',
      backupCodesRemaining: newCred.backupCodes.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'MFA enrollment failed.' },
      { status: 400 }
    );
  }
}
