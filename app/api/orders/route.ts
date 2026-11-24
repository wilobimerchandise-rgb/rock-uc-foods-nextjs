import { NextRequest, NextResponse } from 'next/server';
import { createOrder } from '../../../src/order/orderEngine';
import { orderRepository } from '../../../src/order/orderRepository';
import { CreateOrderInput } from '../../../src/types/order';
import {
  getBusinessBankSettings,
  hasVerifiedBankSettings,
  MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
} from '../../../src/lib/businessSettings';
import {
  authorizeOrderAccess,
  buildUpdatedOrderTokenCookieValue,
  ORDER_TOKEN_COOKIE_NAME,
  resolveActiveAdminProfile,
  serializeOrderForApi,
} from '../../../src/order/orderAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const bankSettings = getBusinessBankSettings();
    if (!hasVerifiedBankSettings(bankSettings) || !bankSettings) {
      return NextResponse.json(
        {
          success: false,
          error: MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const body = await req.json();

    // Zero client trust: ignore any client-supplied id, orderCode, paymentReference, totalKobo,
    // subtotalKobo, deliveryFeeKobo, discountKobo, or status. Recomputed strictly on server.
    const input: CreateOrderInput = {
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      deliveryType: body.deliveryType,
      deliveryZoneId: body.deliveryZoneId,
      deliveryAddress: body.deliveryAddress,
      specialInstructions: body.specialInstructions,
      acceptedPolicy: body.acceptedPolicy,
      policyVersion: body.policyVersion,
      items: body.items || [],
      promoCode: typeof body.promoCode === 'string' ? body.promoCode : undefined,
      promoCodeId: typeof body.promoCodeId === 'string' ? body.promoCodeId : undefined,
    };

    const order = createOrder(input);
    const trackingUrl = `/order/${order.orderCode}?token=${encodeURIComponent(order.trackingToken || '')}`;
    const cookieVal = buildUpdatedOrderTokenCookieValue(
      req,
      order.orderCode,
      order.trackingToken || ''
    );

    const response = NextResponse.json(
      {
        success: true,
        order: serializeOrderForApi(order),
        orderCode: order.orderCode,
        paymentReference: order.paymentReference,
        trackingToken: order.trackingToken,
        trackingUrl,
        bankDetails: {
          bankName: bankSettings.bankName,
          accountName: bankSettings.accountName,
          accountNumber: bankSettings.accountNumber,
        },
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'no-store' },
      }
    );

    response.headers.append(
      'Set-Cookie',
      `${ORDER_TOKEN_COOKIE_NAME}=${cookieVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );

    return response;
  } catch (err: any) {
    const message = err?.message || 'Failed to place order.';
    const status = message === MISSING_BANK_DETAILS_CHECKOUT_MESSAGE ? 503 : 400;
    return NextResponse.json(
      { success: false, error: message },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (code) {
    const auth = await authorizeOrderAccess(req, code);
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        order: serializeOrderForApi(auth.order, {
          isAdmin: auth.isAdmin,
          role: auth.adminProfile?.role,
          hasMfaVerified: auth.adminProfile?.hasMfaVerified,
        }),
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Listing all orders is strictly restricted to logged-in active admins (prevent IDOR/PII leak)
  const adminCheck = await resolveActiveAdminProfile(req);
  if ('error' in adminCheck) {
    return NextResponse.json(
      { error: adminCheck.error },
      { status: adminCheck.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const all = orderRepository.getAll({ expireStale: true });
  return NextResponse.json(
    {
      orders: all.map((ord) =>
        serializeOrderForApi(ord, {
          isAdmin: true,
          role: adminCheck.userProfile.role,
          hasMfaVerified: adminCheck.userProfile.hasMfaVerified,
        })
      ),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
