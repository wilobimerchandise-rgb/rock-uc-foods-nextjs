/**
 * ROCK UC FOODS - Phase 1G: Server Route to Download Admin Invoice PDF
 * Playbook v2 Section 29
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { invoiceRepository, estimateRepository } from '@/src/invoices/repository';
import { renderInvoicePdfBuffer, InvoicePdfData } from '@/src/lib/pdf/InvoiceDocument';
import { requireRole, AuthorizationError, UserProfile } from '@/src/lib/auth/access';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  // 1. Authentication
  const sessionRes = await globalAuthService.getSession();
  const user = sessionRes.session?.user;
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const profile = await getProfileFromService(user.id);
  if (!profile || !profile.isActive) {
    return NextResponse.json(
      { error: 'Forbidden: Account inactive or profile missing.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const hasVerifiedTotp =
    (user.factors?.some((f) => f.factor_type === 'totp' && f.status === 'verified') ?? false) ||
    sessionRes.session?.aal === 'aal2';

  const userProfile: UserProfile = {
    id: profile.id,
    role: profile.role,
    isActive: profile.isActive,
    fullName: profile.fullName,
    email: profile.email,
    hasMfaVerified: hasVerifiedTotp,
  };

  try {
    // 2. Authorize: Owner, Staff, Developer
    requireRole(['owner', 'staff', 'developer'], userProfile, 'view invoice PDF', ref);

    // 3. Find invoice
    const invoice = invoiceRepository.getByPublicRef(ref);
    if (!invoice) {
      return NextResponse.json(
        { error: `Invoice '${ref}' not found.` },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // 4. Issued invoices only
    if (invoice.status !== 'issued') {
      return NextResponse.json(
        { error: `Invoice '${ref}' is in '${invoice.status}' status. PDF only available for issued invoices.` },
        { status: 409, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const estimate = estimateRepository.getById(invoice.estimateId);
    const pdfData: InvoicePdfData = {
      invoiceNumber: invoice.publicRef,
      revision: invoice.revision,
      clientName: estimate?.contactName || 'Valued Client',
      clientPhone: estimate?.contactPhone || '+2348033729125',
      clientEmail: estimate?.contactEmail,
      items: invoice.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPriceKobo: BigInt(l.unitPriceKobo),
      })),
      deliveryFeeKobo: 5000000n, // ₦50,000 logistics
      serviceChargeKobo: invoice.totalKobo - invoice.depositKobo,
    };

    const pdfBuffer = await renderInvoicePdfBuffer(pdfData);

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.publicRef}.pdf"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Error generating invoice PDF.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
