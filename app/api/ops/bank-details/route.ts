import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessBankSettings,
  hasVerifiedBankSettings,
  setBusinessBankSettings,
  MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
} from '../../../../src/lib/businessSettings';
import { resolveActiveAdminProfile } from '../../../../src/order/orderAuth';
import { requireRole, AuthorizationError } from '../../../../src/lib/auth/access';
import { isSameOrigin } from '../../../../src/lib/same-origin';

export const dynamic = 'force-dynamic';

/**
 * Public read endpoint for verified GTBank transfer details.
 * Returns empty state message if missing/unverified so checkout can block orders cleanly.
 */
export async function GET() {
  const bankSettings = getBusinessBankSettings();
  if (!hasVerifiedBankSettings(bankSettings) || !bankSettings) {
    return NextResponse.json(
      {
        configured: false,
        bankDetails: null,
        message: MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  return NextResponse.json(
    {
      configured: true,
      bankDetails: {
        bankName: bankSettings.bankName,
        accountName: bankSettings.accountName,
        accountNumber: bankSettings.accountNumber,
      },
      message: null,
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}

/**
 * Owner + Second-Factor MFA only: updates stored Nigerian bank details (10-digit string NUBAN).
 */
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
    requireRole(['owner'], resolved.userProfile, 'update business bank details', 'business-settings', {
      requireSecondFactor: true,
    });

    const body = await req.json().catch(() => ({}));
    if (body?.clear === true) {
      setBusinessBankSettings(null, resolved.userProfile);
      return NextResponse.json(
        {
          success: true,
          configured: false,
          bankDetails: null,
          message: MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const updated = setBusinessBankSettings(
      {
        bankName: body?.bankName,
        accountName: body?.accountName,
        accountNumber: body?.accountNumber,
        verifiedByOwner: Boolean(body?.verifiedByOwner ?? true),
      },
      resolved.userProfile
    );

    return NextResponse.json(
      {
        success: true,
        configured: hasVerifiedBankSettings(updated),
        bankDetails: updated
          ? {
              bankName: updated.bankName,
              accountName: updated.accountName,
              accountNumber: updated.accountNumber,
            }
          : null,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err?.message || 'Invalid bank details.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
