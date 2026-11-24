/**
 * ROCK UC FOODS - Customer Invoice Preview API Route (Read-Only)
 * Playbook v2 Section 31.6 ("Preview as the customer before sending an invoice")
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  resolveSessionFromRequest,
  getProfileFromService,
  hasSessionVerifiedMfa,
} from '@/src/auth/wiring';
import { AuthorizationError, UserProfile } from '@/src/lib/auth/access';
import { buildCustomerInvoicePreview } from '@/src/invoices/preview';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  const sessionRes = await resolveSessionFromRequest(request);
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

  const hasVerifiedTotp = hasSessionVerifiedMfa(sessionRes.session);

  const userProfile: UserProfile = {
    id: profile.id,
    role: profile.role,
    isActive: profile.isActive,
    fullName: profile.fullName,
    email: profile.email,
    hasMfaVerified: hasVerifiedTotp,
  };

  try {
    const preview = buildCustomerInvoicePreview(ref, userProfile);
    return NextResponse.json(
      { success: true, preview },
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
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    return NextResponse.json(
      { error: err.message || 'Failed to build customer preview.' },
      { status: statusCode, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
