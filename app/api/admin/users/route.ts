/**
 * ROCK UC FOODS - Staff User Management API Endpoint
 * GET /api/admin/users - List users (Owner with MFA only)
 * POST /api/admin/users - Create user (Owner with MFA only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '@/src/lib/same-origin';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { UserProfile } from '@/src/lib/auth/access';
import { listStaffUsers, createStaffUser } from '@/src/auth/staff-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Same-Origin Check (for stateful reads from browser)
  if (!isSameOrigin(request)) {
    // For GET requests, missing origin from standard page navigation is permitted, but if origin is present it must match
    const originHeader = request.headers.get('origin');
    if (originHeader) {
      return NextResponse.json(
        { error: 'Forbidden: Cross-site request rejected.' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  // 2. Auth Session & Profile
  const sessionRes = await globalAuthService.getSession();
  const user = sessionRes.session?.user;
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required.' },
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

  const actor: UserProfile = {
    id: profile.id,
    role: profile.role,
    isActive: profile.isActive,
    fullName: profile.fullName || 'Admin User',
    hasMfaVerified: hasVerifiedTotp,
  };

  try {
    const users = listStaffUsers(actor);
    return NextResponse.json({ success: true, users }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Permission denied') ? 403 : 400);
    return NextResponse.json(
      { error: err.message || 'Failed to list staff users.' },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(request: NextRequest) {
  // 1. Same-Origin Check
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden: Cross-site request rejected.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2. Auth Session & Profile
  const sessionRes = await globalAuthService.getSession();
  const user = sessionRes.session?.user;
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required.' },
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

  const actor: UserProfile = {
    id: profile.id,
    role: profile.role,
    isActive: profile.isActive,
    fullName: profile.fullName || 'Admin User',
    hasMfaVerified: hasVerifiedTotp,
  };

  // 3. Body Parsing
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request payload.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const created = createStaffUser(
      {
        fullName: body.fullName,
        email: body.email,
        role: body.role,
        password: body.password,
      },
      actor
    );

    return NextResponse.json(
      { success: true, user: created },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Permission denied') ? 403 : 400);
    return NextResponse.json(
      { error: err.message || 'Failed to create staff user.' },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
