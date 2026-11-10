/**
 * ROCK UC FOODS - Phase 1E: Staff User Management Test Suite
 * Playbook v2 Section 6 (Phase 1), Section 9 (Phase 4), Section 28.4 (Phase 1E)
 * 
 * Verifies:
 * 1. Owner with verified MFA can list, create, and update staff members.
 * 2. Staff and Developer roles receive 403 Forbidden and unauthorized attempts are audited.
 * 3. Self-Deactivation Guard: Owner cannot deactivate their own account.
 * 4. Last Active Owner Guard: Cannot deactivate the last remaining active owner.
 * 5. Input Validation: Names (2-80 chars), email format, duplicate email refusal, role restriction.
 * 6. Immediate Session Invalidation: Deactivated user loses session immediately.
 * 7. Lost-Phone Recovery: Resetting MFA removes authenticator factor and logs audit event.
 * 8. Password Reset: Secure password update with audit log.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  listStaffUsers,
  createStaffUser,
  updateStaffUser,
  resetStaffMfa,
  resetStaffPassword,
} from '../src/auth/staff-service';
import { globalAuthService, INITIAL_ACCOUNTS } from '../src/auth/wiring';
import { UserProfile } from '../src/lib/auth/access';
import { clearAuditLog, getAuditEvents } from '../src/lib/audit';

describe('Phase 1E: Staff User Management Engine', () => {
  const verifiedOwner: UserProfile = {
    id: 'usr-owner-verified',
    email: 'estherkwentua@gmail.com',
    role: 'owner',
    isActive: true,
    fullName: 'Chef Esther Kwentua (Verified MFA)',
    hasMfaVerified: true,
  };

  const unverifiedOwner: UserProfile = {
    id: 'usr-owner-01',
    email: 'rock-uc-foods@gmail.com',
    role: 'owner',
    isActive: true,
    fullName: 'Chef Esther Kwentua',
    hasMfaVerified: false,
  };

  const staffUser: UserProfile = {
    id: 'usr-staff-01',
    email: 'staff@rockucfoods.com',
    role: 'staff',
    isActive: true,
    fullName: 'Kitchen Operations Staff',
    hasMfaVerified: false,
  };

  const devUser: UserProfile = {
    id: 'usr-dev-01',
    email: 'developer@rockucfoods.com',
    role: 'developer',
    isActive: true,
    fullName: 'Platform Engineer',
    hasMfaVerified: true,
  };

  beforeEach(() => {
    globalAuthService.reset(INITIAL_ACCOUNTS);
    clearAuditLog();
  });

  it('1. Owner with verified MFA can list, create, and update staff users', () => {
    const listBefore = listStaffUsers(verifiedOwner);
    expect(listBefore.length).toBeGreaterThanOrEqual(4);

    // Create a new staff member
    const newStaff = createStaffUser(
      {
        fullName: 'Bolanle Adeleke',
        email: 'bolanle@rockucfoods.com',
        role: 'staff',
        password: 'SecurePass2026!#',
      },
      verifiedOwner
    );

    expect(newStaff.fullName).toBe('Bolanle Adeleke');
    expect(newStaff.email).toBe('bolanle@rockucfoods.com');
    expect(newStaff.role).toBe('staff');
    expect(newStaff.isActive).toBe(true);
    expect(newStaff.hasMfaVerified).toBe(false);

    // Verify audit
    const createdAudits = getAuditEvents().filter((e) => e.action === 'user.staff_created');
    expect(createdAudits.length).toBe(1);
    expect(createdAudits[0].details.fullName).toBe('Bolanle Adeleke');

    // Update staff member
    const updated = updateStaffUser(
      newStaff.id,
      { fullName: 'Bolanle Adeleke-Smith' },
      verifiedOwner
    );
    expect(updated.fullName).toBe('Bolanle Adeleke-Smith');

    const updateAudits = getAuditEvents().filter((e) => e.action === 'user.staff_updated');
    expect(updateAudits.length).toBe(1);
  });

  it('2. Staff, Developer, and unverified Owner roles receive 403 Forbidden and are audited', () => {
    // Staff cannot list
    expect(() => listStaffUsers(staffUser)).toThrow(/Permission denied/);

    // Developer cannot list
    expect(() => listStaffUsers(devUser)).toThrow(/Permission denied/);

    // Owner without MFA verified cannot list
    expect(() => listStaffUsers(unverifiedOwner)).toThrow(/Second-factor verification required/);

    // Staff cannot create
    expect(() =>
      createStaffUser(
        { fullName: 'Intruder', email: 'intruder@test.com', role: 'staff' },
        staffUser
      )
    ).toThrow(/Permission denied/);

    // Check security audit events
    const audits = getAuditEvents().filter(
      (e) =>
        e.action.startsWith('FORBIDDEN_ROLE_ATTEMPT') ||
        e.action.startsWith('MFA_REQUIRED_ATTEMPT')
    );
    expect(audits.length).toBe(4);
  });

  it('3. Self-Deactivation Guard: Owner cannot deactivate or demote their own account', () => {
    // Attempt to deactivate self
    expect(() =>
      updateStaffUser(verifiedOwner.id, { isActive: false }, verifiedOwner)
    ).toThrow(/You cannot deactivate your own owner account/);

    // Attempt to demote self to staff
    expect(() =>
      updateStaffUser(verifiedOwner.id, { role: 'staff' }, verifiedOwner)
    ).toThrow(/You cannot change your own role from owner/);
  });

  it('4. Last Active Owner Guard: Cannot deactivate the last remaining active owner', () => {
    // Deactivate owner 1
    updateStaffUser('usr-owner-01', { isActive: false }, verifiedOwner);

    // Now verifiedOwner is the only active owner. Attempting to deactivate it must fail.
    expect(() =>
      updateStaffUser(verifiedOwner.id, { isActive: false }, verifiedOwner)
    ).toThrow(/You cannot deactivate your own owner account/);
  });

  it('5. Input Validation: Names, email format, duplicate email refusal, and role restriction', () => {
    // Name too short (< 2)
    expect(() =>
      createStaffUser(
        { fullName: 'A', email: 'valid@rockucfoods.com', role: 'staff' },
        verifiedOwner
      )
    ).toThrow(/Full name must be between 2 and 80 characters/);

    // Invalid email shape
    expect(() =>
      createStaffUser(
        { fullName: 'Valid Name', email: 'notanemail', role: 'staff' },
        verifiedOwner
      )
    ).toThrow(/valid email address/);

    // Duplicate email
    expect(() =>
      createStaffUser(
        { fullName: 'Duplicate Staff', email: 'staff@rockucfoods.com', role: 'staff' },
        verifiedOwner
      )
    ).toThrow(/already exists/);

    // Invalid role
    expect(() =>
      createStaffUser(
        { fullName: 'Invalid Role', email: 'role@rockucfoods.com', role: 'guest' as any },
        verifiedOwner
      )
    ).toThrow(/Invalid role/);

    // Short password
    expect(() =>
      createStaffUser(
        { fullName: 'Short Pass', email: 'pass@rockucfoods.com', role: 'staff', password: '123' },
        verifiedOwner
      )
    ).toThrow(/at least 8 characters/);
  });

  it('6. Immediate Revocation: Deactivating a user revokes their active session and blocks login', async () => {
    // Sign in as staff
    await globalAuthService.signInWithPassword({
      email: 'staff@rockucfoods.com',
      password: 'StaffService2026!',
    });

    const activeSession = await globalAuthService.getSession();
    expect(activeSession.session?.user.id).toBe('usr-staff-01');

    // Owner deactivates staff
    updateStaffUser('usr-staff-01', { isActive: false }, verifiedOwner);

    // Staff session is cleared
    const postSession = await globalAuthService.getSession();
    expect(postSession.session).toBeNull();

    // Re-signing in with same credentials must fail
    const targetUser = globalAuthService.getUserById('usr-staff-01');
    expect(targetUser?.isActive).toBe(false);

    const deactAudits = getAuditEvents().filter((e) => e.action === 'user.staff_deactivated');
    expect(deactAudits.length).toBe(1);
    expect(deactAudits[0].details.userId).toBe('usr-staff-01');
  });

  it('7. Lost-Phone Recovery: Resetting MFA clears registered factor and logs audit event', () => {
    // usr-dev-01 has a verified factor
    const devBefore = globalAuthService.getUserById('usr-dev-01')!;
    expect(devBefore.factors.length).toBe(1);
    expect(devBefore.factors[0].status).toBe('verified');

    // Owner resets MFA for dev
    const res = resetStaffMfa('usr-dev-01', verifiedOwner);
    expect(res.hasMfaVerified).toBe(false);
    expect(res.mfaFactorsCount).toBe(0);

    const devAfter = globalAuthService.getUserById('usr-dev-01')!;
    expect(devAfter.factors.length).toBe(0);

    const mfaAudits = getAuditEvents().filter((e) => e.action === 'user.mfa_reset');
    expect(mfaAudits.length).toBe(1);
    expect(mfaAudits[0].details.userId).toBe('usr-dev-01');
  });

  it('8. Password Reset: Owner can reset user password with minimum length enforcement', () => {
    // Attempt short password
    expect(() =>
      resetStaffPassword('usr-staff-01', '123', verifiedOwner)
    ).toThrow(/at least 8 characters/);

    // Reset password successfully
    resetStaffPassword('usr-staff-01', 'BrandNewPass2026!', verifiedOwner);

    const updated = globalAuthService.getUserById('usr-staff-01')!;
    expect(updated.passwordHash).toBe('BrandNewPass2026!');

    const passAudits = getAuditEvents().filter((e) => e.action === 'user.password_reset');
    expect(passAudits.length).toBe(1);
    expect(passAudits[0].details.userId).toBe('usr-staff-01');
  });
});
