/**
 * ROCK UC FOODS - Access Control & Role Enforcement
 * Playbook v4 Section 6 & 16
 */

import { recordAudit } from '../audit';

export type UserRole = 'owner' | 'staff' | 'developer' | 'customer' | 'anonymous';

export interface UserProfile {
  id: string;
  role: UserRole;
  isActive: boolean;
  fullName: string;
  email?: string;
  hasMfaVerified?: boolean;
}

export class AuthorizationError extends Error {
  public statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function requireRole(
  allowedRoles: UserRole[],
  user: UserProfile | null | undefined,
  actionDescription: string,
  entityId: string = 'system',
  options?: { requireSecondFactor?: boolean }
): UserProfile {
  if (!user || user.role === 'anonymous') {
    recordAudit({
      actorId: 'anonymous',
      actorRole: 'anonymous',
      action: `UNAUTHORIZED_ATTEMPT: ${actionDescription}`,
      entity: 'authorization',
      entityId,
    });
    throw new AuthorizationError('Authentication required to perform this action.');
  }

  if (!user.isActive) {
    recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: `DEACTIVATED_ACCOUNT_ATTEMPT: ${actionDescription}`,
      entity: 'authorization',
      entityId,
    });
    throw new AuthorizationError('Account is deactivated. Access revoked.');
  }

  if (!allowedRoles.includes(user.role)) {
    recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: `FORBIDDEN_ROLE_ATTEMPT: ${actionDescription}`,
      entity: 'authorization',
      entityId,
      details: { role: user.role, allowedRoles },
    });
    throw new AuthorizationError(
      `Permission denied: role '${user.role}' is not authorized to ${actionDescription}.`
    );
  }

  // Second-factor requirement (e.g. for owner issuing/voiding invoices)
  if (options?.requireSecondFactor && !user.hasMfaVerified) {
    recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: `MFA_REQUIRED_ATTEMPT: ${actionDescription}`,
      entity: 'authorization',
      entityId,
    });
    throw new AuthorizationError('Second-factor verification required for this operation.');
  }

  return user;
}
