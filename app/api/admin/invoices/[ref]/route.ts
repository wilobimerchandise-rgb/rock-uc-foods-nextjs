/**
 * ROCK UC FOODS - Phase 1G: Server Route for Single Invoice Admin Detail & Approval
 * Playbook v2 Section 29
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '@/src/lib/same-origin';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { invoiceRepository, estimateRepository, invoiceLinksRepository } from '@/src/invoices/repository';
import { issueInvoice } from '@/src/invoices/issue';
import { requireRole, AuthorizationError, UserProfile } from '@/src/lib/auth/access';
import { formatNaira } from '@/src/lib/money';

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

  const userProfile: UserProfile = {
    id: profile.id,
    role: profile.role,
    isActive: profile.isActive,
    fullName: profile.fullName,
    email: profile.email,
    hasMfaVerified: sessionRes.session?.aal === 'aal2',
  };

  try {
    requireRole(['owner', 'staff', 'developer'], userProfile, 'view invoice detail', ref);

    const invoice = invoiceRepository.getByPublicRef(ref);
    if (!invoice) {
      return NextResponse.json(
        { error: `Invoice '${ref}' not found.` },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const estimate = estimateRepository.getById(invoice.estimateId);
    const links = invoiceLinksRepository.getLinksByInvoiceId(invoice.id);

    return NextResponse.json(
      {
        id: invoice.id,
        publicRef: invoice.publicRef,
        status: invoice.status,
        customerName: estimate?.contactName || 'Valued Client',
        customerPhone: estimate?.contactPhone || '',
        customerEmail: estimate?.contactEmail,
        guests: estimate?.inputs?.guests || 0,
        packageId: estimate?.inputs?.packageId,
        lines: invoice.lines,
        totalKobo: invoice.totalKobo.toString(),
        formattedTotal: formatNaira(invoice.totalKobo),
        depositKobo: invoice.depositKobo.toString(),
        formattedDeposit: formatNaira(invoice.depositKobo),
        balanceKobo: invoice.balanceKobo.toString(),
        formattedBalance: formatNaira(invoice.balanceKobo),
        label: invoice.label,
        createdAt: invoice.createdAt,
        expiresAt: estimate?.validUntil,
        issuedAt: invoice.issuedAt,
        issuedBy: invoice.issuedBy,
        voidReason: invoice.voidReason,
        linksCount: links.length,
        lastSharedAt: links[0]?.createdAt,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
        },
      }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Error fetching invoice detail.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

/**
 * Owner-only approve draft invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  // 1. Same-Site Origin Check
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin requests forbidden.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2. Authentication
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
      { error: 'Forbidden: Account inactive.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const userProfile: UserProfile = {
    id: profile.id,
    role: profile.role,
    isActive: profile.isActive,
    fullName: profile.fullName,
    email: profile.email,
    hasMfaVerified: sessionRes.session?.aal === 'aal2',
  };

  try {
    const invoice = invoiceRepository.getByPublicRef(ref);
    if (!invoice) {
      return NextResponse.json(
        { error: `Invoice '${ref}' not found.` },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const issued = issueInvoice(invoice.id, userProfile);
    return NextResponse.json(
      {
        success: true,
        invoice: {
          publicRef: issued.publicRef,
          status: issued.status,
          issuedAt: issued.issuedAt,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
        },
      }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Error approving invoice.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
