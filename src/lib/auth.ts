/**
 * ROCK UC FOODS - Authorization and Role-Based Access Control
 * (Playbook v2 Section 6, 10, and 16)
 */

export type UserRole = 'owner' | 'staff' | 'developer';

export interface UserProfile {
  id: string;
  role: UserRole;
  isActive: boolean;
  fullName: string;
  email?: string;
}

export class AuthorizationError extends Error {
  public statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface SecurityAuditEvent {
  actorId: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipHash?: string;
  createdAt: string;
}

// In-memory audit collector for test/runtime environments before DB flush
export const auditLogStore: SecurityAuditEvent[] = [];

export function recordAuditEvent(event: Omit<SecurityAuditEvent, 'createdAt'>): SecurityAuditEvent {
  const fullEvent: SecurityAuditEvent = {
    ...event,
    createdAt: new Date().toISOString(),
  };
  auditLogStore.push(fullEvent);
  return fullEvent;
}

/**
 * Enforces role authorization on sensitive actions.
 * Throws 403 AuthorizationError and audits unauthorized attempts.
 */
export function requireRole(
  allowedRoles: UserRole[],
  user: UserProfile | null | undefined,
  actionDescription: string,
  entityId: string = 'system'
): UserProfile {
  if (!user) {
    recordAuditEvent({
      actorId: 'anonymous',
      actorRole: 'unauthenticated',
      action: `UNAUTHORIZED_ATTEMPT: ${actionDescription}`,
      entity: 'authorization',
      entityId,
    });
    throw new AuthorizationError('Authentication required to perform this action.');
  }

  // Deactivated accounts are rejected immediately on next request
  if (!user.isActive) {
    recordAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      action: `DEACTIVATED_ACCOUNT_ATTEMPT: ${actionDescription}`,
      entity: 'authorization',
      entityId,
    });
    throw new AuthorizationError('Account is deactivated. Access revoked.');
  }

  if (!allowedRoles.includes(user.role)) {
    recordAuditEvent({
      actorId: user.id,
      actorRole: user.role,
      action: `FORBIDDEN_ROLE_ATTEMPT: ${actionDescription}`,
      entity: 'authorization',
      entityId,
      before: { userRole: user.role, allowedRoles },
    });
    throw new AuthorizationError(
      `Permission denied: role '${user.role}' is not authorized to ${actionDescription}.`
    );
  }

  return user;
}
