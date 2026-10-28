/**
 * ROCK UC FOODS - RFC 6238 TOTP & Step-Up Security Tests
 * Playbook v4 Section 23
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  base32Encode,
  base32Decode,
  generateTotp,
  generateTotpForStep,
  verifyTotp,
  generateBackupCodes,
  verifyAndRedeemBackupCode,
  generateMfaSecret,
} from '../src/security/totp';
import {
  securityStore,
  verifyStepUpCode,
} from '../src/security/stepUp';

describe('Playbook Section 23: RFC 6238 TOTP & Step-Up Security Engine', () => {
  const TEST_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'; // 32-char Base32 RFC secret

  beforeEach(() => {
    securityStore.clear();
  });

  describe('1. Base32 Encoding & Dynamic Truncation', () => {
    it('roundtrips buffer to base32 and back cleanly', () => {
      const buffer = Buffer.from('RockUcFoods2026!#$');
      const encoded = base32Encode(buffer);
      const decoded = base32Decode(encoded);

      expect(decoded.toString()).toBe('RockUcFoods2026!#$');
    });

    it('generates strictly 6-digit zero-padded TOTP tokens', () => {
      for (let step = 0; step < 20; step++) {
        const token = generateTotpForStep(TEST_SECRET, step * 1000);
        expect(token).toMatch(/^\d{6}$/);
      }
    });

    it('generates valid otpauth URI for authenticator apps', () => {
      const cred = generateMfaSecret('ROCK UC FOODS', 'owner@rockucfoods.com');
      expect(cred.secret).toMatch(/^[A-Z2-7]+$/);
      expect(cred.otpauthUri).toContain('otpauth://totp/ROCK%20UC%20FOODS');
      expect(cred.otpauthUri).toContain('secret=' + cred.secret);
      expect(cred.backupCodes.length).toBe(8);
    });
  });

  describe('2. Window Tolerance & Clock Drift (±1 Step)', () => {
    const fixedTimeSeconds = 1700000000;
    const currentStep = Math.floor(fixedTimeSeconds / 30);

    it('accepts valid code generated at the exact current time step', () => {
      const code = generateTotpForStep(TEST_SECRET, currentStep);
      const res = verifyTotp(code, TEST_SECRET, 0, fixedTimeSeconds);

      expect(res.valid).toBe(true);
      expect(res.step).toBe(currentStep);
    });

    it('accepts code generated at T - 1 step (30s clock drift)', () => {
      const code = generateTotpForStep(TEST_SECRET, currentStep - 1);
      const res = verifyTotp(code, TEST_SECRET, 0, fixedTimeSeconds);

      expect(res.valid).toBe(true);
      expect(res.step).toBe(currentStep - 1);
    });

    it('accepts code generated at T + 1 step (30s clock drift)', () => {
      const code = generateTotpForStep(TEST_SECRET, currentStep + 1);
      const res = verifyTotp(code, TEST_SECRET, 0, fixedTimeSeconds);

      expect(res.valid).toBe(true);
      expect(res.step).toBe(currentStep + 1);
    });

    it('rejects expired code generated at T - 2 steps (60s ago)', () => {
      const code = generateTotpForStep(TEST_SECRET, currentStep - 2);
      const res = verifyTotp(code, TEST_SECRET, 0, fixedTimeSeconds);

      expect(res.valid).toBe(false);
      expect(res.reason).toBe('Invalid authenticator code.');
    });

    it('rejects premature code generated at T + 2 steps (60s in future)', () => {
      const code = generateTotpForStep(TEST_SECRET, currentStep + 2);
      const res = verifyTotp(code, TEST_SECRET, 0, fixedTimeSeconds);

      expect(res.valid).toBe(false);
    });
  });

  describe('3. Replay Attack Prevention (lastUsedStep Enforcement)', () => {
    const fixedTimeSeconds = 1700000000;
    const currentStep = Math.floor(fixedTimeSeconds / 30);

    it('rejects re-use of identical code in the same 30-second window', () => {
      const code = generateTotpForStep(TEST_SECRET, currentStep);

      // First verification: success
      const firstCheck = verifyTotp(code, TEST_SECRET, 0, fixedTimeSeconds);
      expect(firstCheck.valid).toBe(true);
      const updatedLastUsedStep = firstCheck.step!;

      // Immediate second verification (replay attempt in same window): REJECTED
      const replayCheck = verifyTotp(code, TEST_SECRET, updatedLastUsedStep, fixedTimeSeconds);
      expect(replayCheck.valid).toBe(false);
      expect(replayCheck.reason).toContain('Token already used');
    });

    it('accepts new code once next 30-second cycle arrives', () => {
      const code1 = generateTotpForStep(TEST_SECRET, currentStep);
      const check1 = verifyTotp(code1, TEST_SECRET, 0, fixedTimeSeconds);
      expect(check1.valid).toBe(true);

      // Next step (+35s)
      const nextTimeSeconds = fixedTimeSeconds + 35;
      const nextStep = Math.floor(nextTimeSeconds / 30);
      const code2 = generateTotpForStep(TEST_SECRET, nextStep);

      const check2 = verifyTotp(code2, TEST_SECRET, check1.step!, nextTimeSeconds);
      expect(check2.valid).toBe(true);
      expect(check2.step).toBe(nextStep);
    });
  });

  describe('4. Single-Use Backup Recovery Codes', () => {
    it('generates 8 distinct formatted recovery codes (XXXX-XXXX)', () => {
      const codes = generateBackupCodes(8);
      expect(codes.length).toBe(8);
      for (const code of codes) {
        expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}$/);
      }
    });

    it('redeems valid backup code once and removes it from active list', () => {
      const initialCodes = ['ABCD-1234', 'WXYZ-5678', 'PQRS-9999'];
      const res = verifyAndRedeemBackupCode('ABCD-1234', initialCodes);

      expect(res.valid).toBe(true);
      expect(res.remainingCodes.length).toBe(2);
      expect(res.remainingCodes).not.toContain('ABCD-1234');

      // Attempting to redeem the same code again fails
      const secondAttempt = verifyAndRedeemBackupCode('ABCD-1234', res.remainingCodes);
      expect(secondAttempt.valid).toBe(false);
      expect(secondAttempt.remainingCodes.length).toBe(2);
    });

    it('handles code without hyphen and lowercase input', () => {
      const initialCodes = ['ABCD-1234'];
      const res = verifyAndRedeemBackupCode('abcd1234', initialCodes);
      expect(res.valid).toBe(true);
      expect(res.remainingCodes.length).toBe(0);
    });
  });

  describe('5. Step-Up Challenge Session Workflow', () => {
    beforeEach(() => {
      securityStore.saveMfaCredential({
        userId: 'usr-owner-01',
        secret: TEST_SECRET,
        isEnabled: true,
        backupCodes: ['RECV-0001', 'RECV-0002'],
        lastUsedStep: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('issues single-use step-up token upon valid TOTP verification', () => {
      const currentCode = generateTotp(TEST_SECRET);
      const challenge = verifyStepUpCode('usr-owner-01', currentCode, 'price_update', 'owner');

      expect(challenge.success).toBe(true);
      expect(challenge.stepUpToken).toBeDefined();
      expect(challenge.stepUpToken).toMatch(/^stp-[0-9a-f]{48}$/);

      // Verify token consumption
      const isConsumed = securityStore.verifyAndConsumeStepUpToken(
        challenge.stepUpToken!,
        'price_update',
        'usr-owner-01'
      );
      expect(isConsumed).toBe(true);

      // Second consumption must fail (single-use)
      const secondConsume = securityStore.verifyAndConsumeStepUpToken(
        challenge.stepUpToken!,
        'price_update',
        'usr-owner-01'
      );
      expect(secondConsume).toBe(false);
    });

    it('rejects step-up token for wrong purpose (purpose binding)', () => {
      const currentCode = generateTotp(TEST_SECRET);
      const challenge = verifyStepUpCode('usr-owner-01', currentCode, 'price_update', 'owner');
      expect(challenge.success).toBe(true);

      // Attempting to use token for reconciliation instead of price_update
      const isConsumed = securityStore.verifyAndConsumeStepUpToken(
        challenge.stepUpToken!,
        'reconciliation_confirm',
        'usr-owner-01'
      );
      expect(isConsumed).toBe(false);
    });

    it('issues step-up token upon backup code redemption and records audit event', () => {
      const challenge = verifyStepUpCode('usr-owner-01', 'RECV-0001', 'bank_details_update', 'owner');
      expect(challenge.success).toBe(true);
      expect(challenge.stepUpToken).toBeDefined();

      const cred = securityStore.getMfaCredential('usr-owner-01');
      expect(cred?.backupCodes.length).toBe(1);
      expect(cred?.backupCodes).not.toContain('RECV-0001');

      const auditEvents = securityStore.getAuditEvents();
      expect(auditEvents.some((e) => e.eventType === 'mfa.backup_code_used')).toBe(true);
    });

    it('rejects invalid code and logs failed audit event', () => {
      const challenge = verifyStepUpCode('usr-owner-01', '000000', 'price_update', 'owner');
      expect(challenge.success).toBe(false);

      const auditEvents = securityStore.getAuditEvents();
      expect(auditEvents.some((e) => e.eventType === 'mfa.failed')).toBe(true);
    });
  });
});
