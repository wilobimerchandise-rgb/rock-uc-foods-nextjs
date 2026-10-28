/**
 * ROCK UC FOODS - Paystack Webhook Handler
 * Playbook v4 Section 21
 * 
 * Rules:
 * - Cryptographic HMAC-SHA512 verification.
 * - Idempotency & replay protection: duplicate deliveries return 200 OK without double crediting.
 * - Never trusts client callbacks; only server webhook verifies payments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processPaystackWebhook } from '@/src/payment/paymentEngine';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing x-paystack-signature header.' },
        { status: 401 }
      );
    }

    const rawBody = await req.text();
    if (rawBody.length > 65536) {
      return NextResponse.json(
        { error: 'Webhook payload exceeds size limit.' },
        { status: 413 }
      );
    }

    const secretKey =
      process.env.PAYSTACK_SECRET_KEY || 'pstk_secret_rockucfoods_default_key';

    const result = processPaystackWebhook(rawBody, signature, secretKey);

    return NextResponse.json(
      {
        received: true,
        message: result.message,
        duplicate: result.duplicate || false,
        paymentId: result.paymentId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    if (err.message && err.message.includes('SECURITY VIOLATION')) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: err.message || 'Webhook processing failed.' },
      { status: 400 }
    );
  }
}
