import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '../../../../../src/lib/same-origin';
import {
  resolveActiveAdminProfile,
  serializeOrderForApi,
} from '../../../../../src/order/orderAuth';
import {
  confirmOrderBankTransfer,
  recordPartialOrderPayment,
  rejectOrderPaymentProof,
  reopenExpiredOrder,
} from '../../../../../src/payment/paymentEngine';
import { parseNairaToKobo } from '../../../../../src/lib/money';
import { AuthorizationError } from '../../../../../src/lib/auth/access';

export const dynamic = 'force-dynamic';

function parseKoboFromBody(body: any): bigint {
  if (body?.amountReceivedNaira !== undefined && body?.amountReceivedNaira !== '') {
    return parseNairaToKobo(String(body.amountReceivedNaira));
  }
  const raw = body?.amountReceivedKobo;
  if (typeof raw === 'bigint') return raw;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw)) {
      throw new Error('Money amount must be an integer kobo value, never float.');
    }
    return BigInt(raw);
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    return BigInt(raw.trim());
  }
  throw new Error('Valid integer kobo or Naira payment amount is required.');
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json(
      { error: 'Cross-origin or missing origin requests are forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const adminRes = await resolveActiveAdminProfile(req);
  if ('error' in adminRes) {
    return NextResponse.json(
      { error: adminRes.error },
      { status: adminRes.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const actor = adminRes.userProfile;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'confirm_paid');
    const orderId = String(body?.orderId || '');

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'confirm_paid') {
      const amountReceivedKobo = parseKoboFromBody(body);
      const res = confirmOrderBankTransfer({
        orderId,
        paymentReference: String(body?.paymentReference || ''),
        amountReceivedKobo,
        isBankAppCreditConfirmed: Boolean(body?.isBankAppCreditConfirmed),
        actorUserId: actor.id,
        actorRole: actor.role,
        actorName: actor.fullName,
        notes: typeof body?.notes === 'string' ? body.notes : undefined,
      });

      return NextResponse.json(
        {
          success: true,
          order: serializeOrderForApi(res.order, {
            isAdmin: true,
            role: actor.role,
            hasMfaVerified: actor.hasMfaVerified,
          }),
          receiptId: res.receiptId,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'record_partial') {
      const amountReceivedKobo = parseKoboFromBody(body);
      const res = recordPartialOrderPayment({
        orderId,
        paymentReference: String(body?.paymentReference || ''),
        amountReceivedKobo,
        isBankAppCreditConfirmed: Boolean(body?.isBankAppCreditConfirmed),
        actorUserId: actor.id,
        actorRole: actor.role,
        actorName: actor.fullName,
        notes: typeof body?.notes === 'string' ? body.notes : undefined,
      });

      return NextResponse.json(
        {
          success: true,
          order: serializeOrderForApi(res.order, {
            isAdmin: true,
            role: actor.role,
            hasMfaVerified: actor.hasMfaVerified,
          }),
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'reject') {
      const updated = rejectOrderPaymentProof({
        orderId,
        actorUserId: actor.id,
        actorRole: actor.role,
        reason: String(body?.reason || ''),
      });

      return NextResponse.json(
        {
          success: true,
          order: serializeOrderForApi(updated, {
            isAdmin: true,
            role: actor.role,
            hasMfaVerified: actor.hasMfaVerified,
          }),
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (action === 'reopen') {
      const updated = reopenExpiredOrder({
        orderId,
        actorUserId: actor.id,
        actorRole: actor.role,
        actorName: actor.fullName,
        reason: String(body?.reason || ''),
        extendHours: typeof body?.extendHours === 'number' ? body.extendHours : 7,
      });

      return NextResponse.json(
        {
          success: true,
          order: serializeOrderForApi(updated, {
            isAdmin: true,
            role: actor.role,
            hasMfaVerified: actor.hasMfaVerified,
          }),
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      { error: `Unsupported action '${action}'.` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const msg = err?.message || 'Admin order payment action failed.';
    const status =
      msg.includes('Double confirm') ||
      msg.includes('Duplicate') ||
      msg.includes('expired') ||
      msg.includes('Amount mismatch')
        ? 409
        : 400;
    return NextResponse.json(
      { error: msg },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
