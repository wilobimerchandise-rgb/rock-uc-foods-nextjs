import { NextRequest, NextResponse } from 'next/server';
import {
  getBusinessBankSettings,
  hasVerifiedBankSettings,
  MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
} from '../../../../src/lib/businessSettings';
import { authorizeOrderAccess, serializeOrderForApi } from '../../../../src/order/orderAuth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: 'Order code is required' }, { status: 400 });
  }

  const auth = await authorizeOrderAccess(req, code);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const bankSettings = getBusinessBankSettings();
  const configured = hasVerifiedBankSettings(bankSettings);

  return NextResponse.json(
    {
      order: serializeOrderForApi(auth.order, {
        isAdmin: auth.isAdmin,
        role: auth.adminProfile?.role,
        hasMfaVerified: auth.adminProfile?.hasMfaVerified,
      }),
      bankDetails:
        configured && bankSettings
          ? {
              bankName: bankSettings.bankName,
              accountName: bankSettings.accountName,
              accountNumber: bankSettings.accountNumber,
            }
          : null,
      bankMessage: configured ? null : MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
