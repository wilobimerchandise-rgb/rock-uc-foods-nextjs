/**
 * ROCK UC FOODS - Staff User Mutation API Endpoint
 * PATCH /api/admin/users/[id] - Update user, toggle active, reset MFA, or reset password (Owner with MFA only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isSameOrigin } from '@/src/lib/same-origin';
import { globalAuthService, getProfileFromService } from '@/src/auth/wiring';
import { UserProfile } from '@/src/lib/auth/access';
import {
  updateStaffUser,
  resetStaffMfa,
  resetStaffPassword,
} from '@/src/auth/staff-service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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

  const action = body.action;

  try {
    let result;
    if (action === 'reset_mfa') {
      result = resetStaffMfa(id, actor);
    } else if (action === 'reset_password') {
      result = resetStaffPassword(id, body.newPassword, actor);
    } else {
      // General update (name, role, active status)
      result = updateStaffUser(
        id,
        {
          fullName: body.fullName,
          role: body.role,
          isActive: body.isActive,
        },
        actor
      );
    }

    return NextResponse.json(
      { success: true, user: result },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('Permission denied') ? 403 : 400);
    return NextResponse.json(
      { error: err.message || 'Failed to update user.' },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
