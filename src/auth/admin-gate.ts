/**
 * ROCK UC FOODS - Admin Gate Decision Helper
 * Playbook v2 Section 28 (Phase 1E)
 * 
 * Rules:
 * - Anonymous redirects to /login?next=<encoded path inside /admin>
 * - Owner or developer without second step redirects to /login/mfa
 * - Deactivated or unknown accounts are forbidden (403)
 * - Any unexpected error is thrown, never treated as allowed
 */

import { UserProfile, requireRole, AuthorizationError } from '../lib/auth/access';
import { safeNext } from './login-core';

export interface AdminGateDeps {
  getUserProfile: () => Promise<UserProfile | null>;
}

export type AdminGateDecision =
  | { action: 'allow'; profile: UserProfile }
  | { action: 'redirect'; destination: string }
  | { action: 'forbidden'; reason: string };

export async function decideAdminAccess(
  deps: AdminGateDeps,
  requestedPath: string = '/admin'
): Promise<AdminGateDecision> {
  const sanitizedPath = safeNext(requestedPath);
  let profile: UserProfile | null = null;

  try {
    profile = await deps.getUserProfile();
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return { action: 'forbidden', reason: err.message };
    }
    throw err; // Never treat unexpected errors as allowed
  }

  // 1. Anonymous visitor -> redirect to /login with next remembered
  if (!profile || profile.role === 'anonymous') {
    const encodedNext = encodeURIComponent(sanitizedPath);
    return {
      action: 'redirect',
      destination: `/login?next=${encodedNext}`,
    };
  }

  // 2. Deactivated account -> forbidden
  if (!profile.isActive) {
    return {
      action: 'forbidden',
      reason: 'Account is deactivated. Access revoked.',
    };
  }

  // 3. Role authorization check
  const allowedRoles = ['owner', 'staff', 'developer'] as const;
  if (!allowedRoles.includes(profile.role as any)) {
    return {
      action: 'forbidden',
      reason: `Role '${profile.role}' is not authorized to access the admin portal.`,
    };
  }

  // 4. Staff members bypass MFA requirements
  if (profile.role === 'staff') {
    return { action: 'allow', profile };
  }

  // 5. Owner and Developer MUST have completed the second factor (MFA)
  if (profile.role === 'owner' || profile.role === 'developer') {
    if (!profile.hasMfaVerified) {
      const encodedNext = encodeURIComponent(sanitizedPath);
      return {
        action: 'redirect',
        destination: `/login/mfa?next=${encodedNext}`,
      };
    }
  }

  return { action: 'allow', profile };
}
