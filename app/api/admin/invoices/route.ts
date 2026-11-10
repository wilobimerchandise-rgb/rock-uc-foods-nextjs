/**
 * ROCK UC FOODS - Phase 1G: Server Route to List Invoices
 * Playbook v2 Section 29
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { invoiceRepository, estimateRepository, invoiceLinksRepository } from '@/src/invoices/repository';
import { requireRole, AuthorizationError, UserProfile } from '@/src/lib/auth/access';
import { formatNaira } from '@/src/lib/money';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
    requireRole(['owner', 'staff', 'developer'], userProfile, 'list invoices');

    const invoices = invoiceRepository.getAll();

    // Drafts first, then newest first
    const sorted = [...invoices].sort((a, b) => {
      if (a.status === 'draft' && b.status !== 'draft') return -1;
      if (a.status !== 'draft' && b.status === 'draft') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const result = sorted.map((inv) => {
      const estimate = estimateRepository.getById(inv.estimateId);
      const links = invoiceLinksRepository.getLinksByInvoiceId(inv.id);
      return {
        id: inv.id,
        publicRef: inv.publicRef,
        guests: estimate?.inputs?.guests || 0,
        customerName: estimate?.contactName || 'Valued Client',
        customerPhone: estimate?.contactPhone || '',
        totalKobo: inv.totalKobo.toString(),
        formattedTotal: formatNaira(inv.totalKobo),
        depositKobo: inv.depositKobo.toString(),
        formattedDeposit: formatNaira(inv.depositKobo),
        balanceKobo: inv.balanceKobo.toString(),
        formattedBalance: formatNaira(inv.balanceKobo),
        status: inv.status,
        label: inv.label,
        createdAt: inv.createdAt,
        expiresAt: estimate?.validUntil,
        issuedAt: inv.issuedAt,
        linksCount: links.length,
        lastSharedAt: links[0]?.createdAt,
      };
    });

    return NextResponse.json(
      { invoices: result },
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
      { error: err.message || 'Error listing invoices.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
