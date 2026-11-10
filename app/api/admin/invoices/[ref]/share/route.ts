/**
 * ROCK UC FOODS - Phase 1G: Server Route for WhatsApp Invoice Sharing
 * Playbook v2 Section 29
 * 
 * Rules:
 * - Owner only with second-factor rule (staff & developer get 403 and are audited).
 * - Same-site POST only (missing or foreign Origin = 403).
 * - No body needed (any request body carrying prices/totals is ignored).
 * - Rate limit: 30 per 600s per user, key share:user:<id>, fails closed (429).
 * - Returns { success: true, url, message, phoneProblem, expiresAt }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '@/src/lib/same-origin';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { prepareInvoiceShare } from '@/src/invoices/share';
import { AuthorizationError, UserProfile } from '@/src/lib/auth/access';
import { RateLimitError } from '@/src/lib/rate-limit';

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
    fullName: profile.fullName,
    email: profile.email,
    hasMfaVerified: hasVerifiedTotp,
  };

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rockucfoods.com';
    const result = await prepareInvoiceShare(ref, userProfile, { siteUrl });

    return NextResponse.json(
      {
        success: true,
        url: result.url,
        message: result.message,
        phoneProblem: result.phoneProblem,
        expiresAt: result.expiresAt,
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
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 409);
    return NextResponse.json(
      { error: err.message || 'Failed to prepare share link.' },
      { status: statusCode, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
