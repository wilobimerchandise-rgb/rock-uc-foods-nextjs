import { NextRequest, NextResponse } from 'next/server';
import { processPaystackWebhook } from '@/src/payment/paymentEngine';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';
    const secretKey = process.env.PAYSTACK_SECRET_KEY || '';

    if (!secretKey) {
      return NextResponse.json(
        { error: 'PAYSTACK_SECRET_KEY not configured on server.' },
        { status: 500 }
      );
    }

    const result = processPaystackWebhook(rawBody, signature, secretKey);

    return NextResponse.json(
      {
        status: result.success ? 'success' : 'ignored',
        message: result.message,
        duplicate: result.duplicate,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = (err as Error).message;
    if (message.includes('Invalid Paystack webhook signature')) {
      return NextResponse.json({ error: 'Unauthorized signature.' }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
