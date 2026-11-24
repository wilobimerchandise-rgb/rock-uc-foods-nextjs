import { NextRequest, NextResponse } from 'next/server';
import { authorizeOrderAccess, serializeOrderForApi } from '../../../../../src/order/orderAuth';
import { submitOrderPaymentProof } from '../../../../../src/payment/paymentEngine';
import { getClientIp, hashIp } from '../../../../../src/lib/client-ip';
import { RateLimitError } from '../../../../../src/lib/rate-limit';
import { AuthorizationError } from '../../../../../src/lib/auth/access';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: 'Order code is required.' }, { status: 400 });
  }

  const auth = await authorizeOrderAccess(req, code);
  if (!auth.authorized) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const visitorIpHash = hashIp(getClientIp(req));

  try {
    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    let senderName = '';
    let transferTime = '';
    let paymentReference: string | undefined = undefined;
    let receiptFile:
      | {
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          buffer: Uint8Array;
        }
      | undefined = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      senderName = String(formData.get('senderName') || '');
      transferTime = String(formData.get('transferTime') || '');
      const rawRef = formData.get('paymentReference');
      if (typeof rawRef === 'string' && rawRef.trim()) {
        paymentReference = rawRef.trim();
      }

      const fileField = formData.get('receipt');
      if (fileField && typeof fileField === 'object' && 'arrayBuffer' in fileField) {
        const uploaded = fileField as File;
        if (uploaded.size > 0 || uploaded.name) {
          const ab = await uploaded.arrayBuffer();
          receiptFile = {
            fileName: uploaded.name || 'receipt',
            mimeType: uploaded.type || 'application/octet-stream',
            sizeBytes: uploaded.size,
            buffer: new Uint8Array(ab),
          };
        }
      }
    } else {
      const body = await req.json().catch(() => ({}));
      senderName = String(body?.senderName || '');
      transferTime = String(body?.transferTime || '');
      if (typeof body?.paymentReference === 'string' && body.paymentReference.trim()) {
        paymentReference = body.paymentReference.trim();
      }
      if (body?.receiptFile && typeof body.receiptFile === 'object') {
        const rf = body.receiptFile;
        const buf =
          rf.base64 && typeof rf.base64 === 'string'
            ? new Uint8Array(Buffer.from(rf.base64, 'base64'))
            : rf.buffer instanceof Uint8Array
            ? rf.buffer
            : new Uint8Array(0);
        receiptFile = {
          fileName: String(rf.fileName || 'receipt'),
          mimeType: String(rf.mimeType || 'application/octet-stream'),
          sizeBytes: typeof rf.sizeBytes === 'number' ? rf.sizeBytes : buf.byteLength,
          buffer: buf,
        };
      }
    }

    const result = submitOrderPaymentProof({
      orderId: auth.order.id,
      orderCode: auth.order.orderCode,
      senderName,
      transferTime,
      paymentReference,
      receiptFile,
      visitorIpHash,
    });

    return NextResponse.json(
      {
        success: true,
        order: serializeOrderForApi(result.order, {
          isAdmin: auth.isAdmin,
          role: auth.adminProfile?.role,
          hasMfaVerified: auth.adminProfile?.hasMfaVerified,
        }),
        proof: result.proof,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof RateLimitError) {
      return NextResponse.json(
        { error: err.message },
        { status: 429, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const msg = err?.message || 'Failed to submit payment proof.';
    const status = msg.startsWith('Duplicate') || msg.includes('expired') ? 409 : 400;
    return NextResponse.json(
      { error: msg },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
