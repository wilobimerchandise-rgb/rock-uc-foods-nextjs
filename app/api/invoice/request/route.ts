/**
 * ROCK UC FOODS - Request Official Draft Invoice API
 * Playbook Phase 1D Section 3 & 8
 */

import { NextRequest, NextResponse } from 'next/server';
import { createInvoiceFromEstimate } from '@/src/invoices/create';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { estimateId, contact } = body;

    if (!estimateId) {
      return NextResponse.json({ error: 'estimateId is required.' }, { status: 400 });
    }

    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';

    const result = await createInvoiceFromEstimate(estimateId, contact, { ip });

    return NextResponse.json({
      success: true,
      publicRef: result.invoice.publicRef,
      accessToken: result.accessToken,
      status: result.invoice.status,
      totalKobo: result.invoice.totalKobo.toString(),
      depositKobo: result.invoice.depositKobo.toString(),
      balanceKobo: result.invoice.balanceKobo.toString(),
      label: result.invoice.label,
      isExisting: result.isExisting,
    });
  } catch (err: any) {
    const status = err.statusCode || 400;
    return NextResponse.json({ error: err.message || 'Invoice creation failed.' }, { status });
  }
}
