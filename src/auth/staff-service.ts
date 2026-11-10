/**
 * ROCK UC FOODS - Staff User Management Service (Phase 1E)
 * Playbook v2 Section 6 (Phase 1), Section 9 (Phase 4), Section 28.4 (Phase 1E)
 * 
 * Rules:
 * 1. Owner ONLY with verified Second-Factor MFA.
 * 2. Staff and Developer roles receive 403 Forbidden and the attempt is audited.
 * 3. Self-Deactivation Guard: Owner cannot deactivate or demote their own account.
 * 4. Last Active Owner Guard: The system must never be left without an active owner.
 * 5. Input Validation: Names 2 to 80 chars, RFC-compliant email, valid role ('owner'|'staff'|'developer').
 * 6. Lost-phone Recovery: Resetting MFA removes verified factor so the user can re-enroll.
 * 7. Immediate Revocation: Deactivating a user immediately invalidates active sessions.
 * 8. Append-Only Audit Logging on every mutation.
 */

import { requireRole, UserProfile } from '../lib/auth/access';
import { recordAudit } from '../lib/audit';
import { globalAuthService, InternalUserRecord } from './wiring';

export interface PublicStaffUser {
  id: string;
  email: string;
  fullName: string;
  role: 'owner' | 'staff' | 'developer';
  isActive: boolean;
  hasMfaVerified: boolean;
  mfaFactorsCount: number;
}

export interface CreateStaffUserInput {
  email: string;
  fullName: string;
  role: 'owner' | 'staff' | 'developer';
  password?: string;
}

export interface UpdateStaffUserInput {
  fullName?: string;
  role?: 'owner' | 'staff' | 'developer';
  isActive?: boolean;
}

function sanitizePublicUser(user: InternalUserRecord): PublicStaffUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    hasMfaVerified: user.factors.some(
      (f) => f.factor_type === 'totp' && f.status === 'verified'
    ),
    mfaFactorsCount: user.factors.length,
  };
}

export function listStaffUsers(actor: UserProfile): PublicStaffUser[] {
  // 1. Owner only with verified second factor
  requireRole(['owner'], actor, 'list staff accounts', 'staff_users', {
    requireSecondFactor: true,
  });

  const users = globalAuthService.getAllUsers();
  return users.map(sanitizePublicUser);
}

export function createStaffUser(
  input: CreateStaffUserInput,
  actor: UserProfile
): PublicStaffUser {
  // 1. Owner only with verified second factor
  requireRole(['owner'], actor, 'create staff account', 'staff_users', {
    requireSecondFactor: true,
  });

  // 2. Input validation
  const fullName = (input.fullName || '').trim();
  if (fullName.length < 2 || fullName.length > 80) {
    throw new Error('Full name must be between 2 and 80 characters.');
  }

  const email = (input.email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 254) {
    throw new Error('Please provide a valid email address.');
  }

  const validRoles: Array<'owner' | 'staff' | 'developer'> = ['owner', 'staff', 'developer'];
  if (!validRoles.includes(input.role)) {
    throw new Error(`Invalid role '${input.role}'. Allowed roles: owner, staff, developer.`);
  }

  const password = input.password || 'TemporaryPass2026!';
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  // 3. Create user
  const created = globalAuthService.createUser({
    email,
    fullName,
    role: input.role,
    passwordHash: password,
    isActive: true,
  });

  // 4. Audit Log
  recordAudit({
    action: 'user.staff_created',
    entity: 'user_profile',
    entityId: created.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      userId: created.id,
      role: created.role,
      fullName: created.fullName,
    },
  });

  return sanitizePublicUser(created);
}

export function updateStaffUser(
  userId: string,
  updates: UpdateStaffUserInput,
  actor: UserProfile
): PublicStaffUser {
  // 1. Owner only with verified second factor
  requireRole(['owner'], actor, 'update staff account', userId, {
    requireSecondFactor: true,
  });

  const target = globalAuthService.getUserById(userId);
  if (!target) {
    throw new Error(`User with ID '${userId}' not found.`);
  }

  // 2. Self-Modification Guards
  if (target.id === actor.id) {
    if (updates.isActive === false) {
      throw new Error('You cannot deactivate your own owner account.');
    }
    if (updates.role !== undefined && updates.role !== 'owner') {
      throw new Error('You cannot change your own role from owner.');
    }
  }

  // 3. Last Active Owner Guard
  if (target.role === 'owner' && (updates.isActive === false || (updates.role && updates.role !== 'owner'))) {
    const allUsers = globalAuthService.getAllUsers();
    const otherActiveOwners = allUsers.filter(
      (u) => u.id !== target.id && u.role === 'owner' && u.isActive
    );
    if (otherActiveOwners.length === 0) {
      throw new Error('Cannot deactivate or demote the last remaining active owner.');
    }
  }

  // 4. Validation
  const sanitizedUpdates: Partial<Pick<InternalUserRecord, 'fullName' | 'role' | 'isActive'>> = {};

  if (updates.fullName !== undefined) {
    const trimmed = updates.fullName.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      throw new Error('Full name must be between 2 and 80 characters.');
    }
    sanitizedUpdates.fullName = trimmed;
  }

  if (updates.role !== undefined) {
    const validRoles: Array<'owner' | 'staff' | 'developer'> = ['owner', 'staff', 'developer'];
    if (!validRoles.includes(updates.role)) {
      throw new Error(`Invalid role '${updates.role}'.`);
    }
    sanitizedUpdates.role = updates.role;
  }

  if (updates.isActive !== undefined) {
    sanitizedUpdates.isActive = updates.isActive;
  }

  // 5. Update user
  const updated = globalAuthService.updateUser(userId, sanitizedUpdates);

  // 6. Audit
  recordAudit({
    action: sanitizedUpdates.isActive === false
      ? 'user.staff_deactivated'
      : sanitizedUpdates.isActive === true && target.isActive === false
      ? 'user.staff_reactivated'
      : 'user.staff_updated',
    entity: 'user_profile',
    entityId: updated.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      userId: updated.id,
      previousRole: target.role,
      newRole: updated.role,
      previousActive: target.isActive,
      newActive: updated.isActive,
    },
  });

  return sanitizePublicUser(updated);
}

export function resetStaffMfa(userId: string, actor: UserProfile): PublicStaffUser {
  // 1. Owner only with verified second factor
  requireRole(['owner'], actor, 'reset staff authenticator MFA', userId, {
    requireSecondFactor: true,
  });

  const target = globalAuthService.getUserById(userId);
  if (!target) {
    throw new Error(`User with ID '${userId}' not found.`);
  }

  // 2. Reset factors
  globalAuthService.resetUserFactors(userId);

  // 3. Audit
  recordAudit({
    action: 'user.mfa_reset',
    entity: 'user_profile',
    entityId: target.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      userId: target.id,
      email: target.email,
      reason: 'Owner initiated lost-phone or authenticator reset',
    },
  });

  const updated = globalAuthService.getUserById(userId)!;
  return sanitizePublicUser(updated);
}

export function resetStaffPassword(
  userId: string,
  newPassword: string,
  actor: UserProfile
): PublicStaffUser {
  // 1. Owner only with verified second factor
  requireRole(['owner'], actor, 'reset staff password', userId, {
    requireSecondFactor: true,
  });

  const target = globalAuthService.getUserById(userId);
  if (!target) {
    throw new Error(`User with ID '${userId}' not found.`);
  }

  if (!newPassword || newPassword.length < 8) {
    throw new Error('New password must be at least 8 characters long.');
  }

  globalAuthService.updateUser(userId, { passwordHash: newPassword });

  recordAudit({
    action: 'user.password_reset',
    entity: 'user_profile',
    entityId: target.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      userId: target.id,
      reason: 'Owner initiated password reset',
    },
  });

  const updated = globalAuthService.getUserById(userId)!;
  return sanitizePublicUser(updated);
}
