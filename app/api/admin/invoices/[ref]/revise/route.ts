/**
 * ROCK UC FOODS - Phase 1D: Server Route for Invoice Revision (Rev 2+)
 * Playbook v2 Section 10 & Section 24
 * 
 * Rules:
 * - Owner only with second-factor rule (staff & developer get 403 and are audited).
 * - Same-site POST only (missing or foreign Origin = 403).
 * - Body: { reason: string, inputs: { packageId: string, guests: number, zoneId?: string, addOnIds?: string[] } }
 * - Recomputes all figures in bigint kobo on the server.
 * - Archives prior version into invoice_versions and increments revision.
 * - Returns { success: true, invoice, versionRecord }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '@/src/lib/same-origin';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { reviseInvoice } from '@/src/invoices/revise';
import { AuthorizationError, UserProfile } from '@/src/lib/auth/access';
import { formatNaira } from '@/src/lib/money';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  // 1. Same-Site Origin Check
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Cross-origin or missing origin requests are forbidden.' },
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
    fullName: profile.fullName || 'Admin User',
    hasMfaVerified: hasVerifiedTotp,
  };

  // 3. Parse Body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request payload.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { reason, inputs } = body || {};
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
    return NextResponse.json(
      { error: 'A valid revision reason (minimum 3 characters) is required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!inputs || !inputs.packageId || typeof inputs.guests !== 'number') {
    return NextResponse.json(
      { error: 'Invalid catering revision inputs: packageId and numeric guest count required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 4. Execute Revision
  try {
    const { invoice, versionRecord } = reviseInvoice(
      ref,
      {
        reason,
        inputs: {
          packageId: inputs.packageId,
          guests: inputs.guests,
          zoneId: inputs.zoneId,
          addOnIds: inputs.addOnIds,
        },
      },
      userProfile
    );

    return NextResponse.json(
      {
        success: true,
        invoice: {
          id: invoice.id,
          publicRef: invoice.publicRef,
          revision: invoice.revision,
          status: invoice.status,
          totalKobo: invoice.totalKobo.toString(),
          formattedTotal: formatNaira(invoice.totalKobo),
          depositKobo: invoice.depositKobo.toString(),
          formattedDeposit: formatNaira(invoice.depositKobo),
          balanceKobo: invoice.balanceKobo.toString(),
          formattedBalance: formatNaira(invoice.balanceKobo),
          revisionReason: invoice.revisionReason,
          revisedAt: invoice.revisedAt,
          lines: invoice.lines,
        },
        versionRecord: {
          revision: versionRecord.revision,
          reason: versionRecord.reason,
          changedAt: versionRecord.changedAt,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json(
        { error: err.message },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: err.message || 'Failed to revise invoice.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
