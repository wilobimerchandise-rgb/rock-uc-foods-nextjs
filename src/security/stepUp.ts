/**
 * ROCK UC FOODS - Step-Up Authentication & Security Guard
 * Playbook v4 Section 23
 */

import crypto from 'crypto';
import {
  MfaCredential,
  StepUpSession,
  SensitiveOperation,
  SecurityAuditEvent,
  UserRole,
} from '../types/security';
import {
  verifyTotp,
  verifyAndRedeemBackupCode,
  generateMfaSecret,
} from './totp';

class SecurityStateStore {
  private mfaCredentials: Map<string, MfaCredential> = new Map();
  private stepUpSessions: Map<string, StepUpSession> = new Map();
  private auditEvents: SecurityAuditEvent[] = [];

  constructor() {
    // Seed default owner MFA state with standard development secret
    const defaultSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const defaultBackupCodes = [
      'RECV-0001',
      'RECV-0002',
      'RECV-0003',
      'RECV-0004',
      'RECV-0005',
      'RECV-0006',
      'RECV-0007',
      'RECV-0008',
    ];

    this.mfaCredentials.set('usr-owner-01', {
      userId: 'usr-owner-01',
      secret: defaultSecret,
      isEnabled: true,
      backupCodes: defaultBackupCodes,
      lastUsedStep: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  clear() {
    this.mfaCredentials.clear();
    this.stepUpSessions.clear();
    this.auditEvents = [];
  }

  getMfaCredential(userId: string): MfaCredential | undefined {
    return this.mfaCredentials.get(userId);
  }

  saveMfaCredential(cred: MfaCredential): MfaCredential {
    this.mfaCredentials.set(cred.userId, { ...cred, updatedAt: new Date().toISOString() });
    return cred;
  }

  createStepUpSession(
    userId: string,
    purpose: SensitiveOperation,
    ttlSeconds: number = 900 // 15 minutes
  ): StepUpSession {
    this.pruneExpiredSessions();

    const token = `stp-${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const session: StepUpSession = {
      token,
      userId,
      purpose,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    this.stepUpSessions.set(token, session);
    return session;
  }

  verifyAndConsumeStepUpToken(
    token: string,
    expectedPurpose: SensitiveOperation,
    expectedUserId?: string
  ): boolean {
    this.pruneExpiredSessions();

    const session = this.stepUpSessions.get(token);
    if (!session) return false;

    if (Date.now() > session.expiresAt) {
      this.stepUpSessions.delete(token);
      return false;
    }

    if (session.purpose !== expectedPurpose) {
      return false;
    }

    if (expectedUserId && session.userId !== expectedUserId) {
      return false;
    }

    // Step-up tokens are single-use or session-bound
    this.stepUpSessions.delete(token);
    return true;
  }

  recordAuditEvent(event: Omit<SecurityAuditEvent, 'id' | 'createdAt'>): SecurityAuditEvent {
    const fullEvent: SecurityAuditEvent = {
      ...event,
      id: `audit-sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
    };
    this.auditEvents.push(fullEvent);
    return fullEvent;
  }

  getAuditEvents(): SecurityAuditEvent[] {
    return [...this.auditEvents];
  }

  private pruneExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.stepUpSessions.entries()) {
      if (now > session.expiresAt) {
        this.stepUpSessions.delete(token);
      }
    }
  }
}

export const securityStore = new SecurityStateStore();

/**
 * Handles Step-Up code verification (either 6-digit TOTP or 8-char backup code).
 */
export function verifyStepUpCode(
  userId: string,
  code: string,
  purpose: SensitiveOperation,
  userRole: UserRole = 'owner'
): { success: boolean; stepUpToken?: string; error?: string } {
  const cred = securityStore.getMfaCredential(userId);
  if (!cred || !cred.isEnabled) {
    return {
      success: false,
      error: 'MFA is not enabled for this user account.',
    };
  }

  const cleanCode = code.trim();

  // 1. If 6-digit TOTP
  if (/^\d{6}$/.test(cleanCode)) {
    const totpResult = verifyTotp(cleanCode, cred.secret, cred.lastUsedStep);
    if (!totpResult.valid) {
      securityStore.recordAuditEvent({
        actorUserId: userId,
        actorRole: userRole,
        eventType: 'mfa.failed',
        details: { reason: totpResult.reason, purpose },
      });
      return { success: false, error: totpResult.reason || 'Invalid TOTP code.' };
    }

    // Update lastUsedStep
    cred.lastUsedStep = totpResult.step || Math.floor(Date.now() / 1000 / 30);
    securityStore.saveMfaCredential(cred);

    // Issue step-up token
    const session = securityStore.createStepUpSession(userId, purpose);

    securityStore.recordAuditEvent({
      actorUserId: userId,
      actorRole: userRole,
      eventType: 'step_up.granted',
      details: { purpose, method: 'totp' },
    });

    return { success: true, stepUpToken: session.token };
  }

  // 2. If 8-character backup recovery code (e.g. XXXX-XXXX)
  const backupResult = verifyAndRedeemBackupCode(cleanCode, cred.backupCodes);
  if (backupResult.valid) {
    cred.backupCodes = backupResult.remainingCodes;
    securityStore.saveMfaCredential(cred);

    const session = securityStore.createStepUpSession(userId, purpose);

    securityStore.recordAuditEvent({
      actorUserId: userId,
      actorRole: userRole,
      eventType: 'mfa.backup_code_used',
      details: { purpose, remainingCount: cred.backupCodes.length },
    });

    return { success: true, stepUpToken: session.token };
  }

  securityStore.recordAuditEvent({
    actorUserId: userId,
    actorRole: userRole,
    eventType: 'mfa.failed',
    details: { reason: 'Invalid authenticator or backup code.', purpose },
  });

  return { success: false, error: 'Invalid authenticator code or backup code.' };
}
