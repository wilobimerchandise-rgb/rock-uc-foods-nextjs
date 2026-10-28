/**
 * ROCK UC FOODS - Step-Up Challenge Verification API
 * Playbook v4 Section 23
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyStepUpCode } from '@/src/security/stepUp';
import { SensitiveOperation, UserRole } from '@/src/types/security';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId = 'usr-owner-01',
      code,
      purpose = 'price_update',
      userRole = 'owner',
    } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Authenticator or backup code is required.' },
        { status: 400 }
      );
    }

    const result = verifyStepUpCode(
      userId,
      code,
      purpose as SensitiveOperation,
      userRole as UserRole
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Verification failed.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      stepUpToken: result.stepUpToken,
      message: 'Step-up authorization granted.',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Step-up verification failed.' },
      { status: 400 }
    );
  }
}
