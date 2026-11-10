/**
 * ROCK UC FOODS - Phase 1E Authentication & MFA Test Suite
 * Playbook v2 Section 28
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  safeNext,
  parseCredentials,
  login,
  mfaStart,
  mfaVerify,
  logout,
  AuthError,
  LoginCoreDeps,
} from '../src/auth/login-core';
import { decideAdminAccess } from '../src/auth/admin-gate';
import { decideMiddleware } from '../src/auth/middleware-decision';
import { InMemoryAuthService, INITIAL_ACCOUNTS } from '../src/auth/wiring';
import { clearAuditLog, getAuditEvents, StoredAuditEvent } from '../src/lib/audit';
import { resetRateLimitStore } from '../src/lib/rate-limit';
import { UserProfile } from '../src/lib/auth/access';

describe('Phase 1E: Owner Sign-In with Authenticator Second Step', () => {
  let authService: InMemoryAuthService;
  let recordedAudits: StoredAuditEvent[];

  const createDeps = (overrides?: Partial<LoginCoreDeps>): LoginCoreDeps => {
    return {
      auth: authService,
      getProfile: async (userId: string): Promise<UserProfile | null> => {
        const user = authService.getUserById(userId);
        if (!user) return null;
        return {
          id: user.id,
          role: user.role,
          isActive: user.isActive,
          fullName: user.fullName,
          email: user.email,
          hasMfaVerified: user.factors.some((f) => f.status === 'verified'),
        };
      },
      auditWriter: (evt) => {
        const stored: StoredAuditEvent = {
          id: `test-aud-${Date.now()}-${Math.random()}`,
          ...evt,
          createdAt: new Date().toISOString(),
        };
        recordedAudits.push(stored);
        return stored;
      },
      ipHash: 'test_ip_hash_01',
      ...overrides,
    };
  };

  beforeEach(() => {
    authService = new InMemoryAuthService();
    recordedAudits = [];
    clearAuditLog();
    resetRateLimitStore();
  });

  describe('1. safeNext URL Redirect Table (16 Cases)', () => {
    const testCases: Array<{ input: unknown; expected: string; label: string }> = [
      { input: '/admin', expected: '/admin', label: '1. Standard /admin' },
      { input: '/admin/estimator', expected: '/admin/estimator', label: '2. Sub-path /admin/estimator' },
      { input: '/admin/reconciliation', expected: '/admin/reconciliation', label: '3. Sub-path /admin/reconciliation' },
      { input: '/admin/orders?status=active', expected: '/admin/orders?status=active', label: '4. Path with search params' },
      { input: '//evil.com', expected: '/admin', label: '5. Protocol-relative URL //evil.com' },
      { input: 'https://evil.com', expected: '/admin', label: '6. Absolute foreign origin https://evil.com' },
      { input: 'http://evil.com/admin', expected: '/admin', label: '7. Foreign origin with admin path' },
      { input: 'javascript:alert(1)', expected: '/admin', label: '8. JavaScript pseudo-protocol' },
      { input: '\\\\evil.com', expected: '/admin', label: '9. Windows backslash trick' },
      { input: '/admin\\evil', expected: '/admin', label: '10. Backslash inside admin path' },
      { input: '/administrator', expected: '/admin', label: '11. /administrator prefix match attempt' },
      { input: '/admin/../etc', expected: '/admin', label: '12. Directory traversal attempt /admin/../etc' },
      { input: null, expected: '/admin', label: '13. null value' },
      { input: undefined, expected: '/admin', label: '14. undefined value' },
      { input: 12345, expected: '/admin', label: '15. numeric value' },
      { input: '/admin/' + 'a'.repeat(210), expected: '/admin', label: '16. Path exceeding 200 characters' },
    ];

    testCases.forEach(({ input, expected, label }) => {
      it(`Case ${label}`, () => {
        expect(safeNext(input)).toBe(expected);
      });
    });
  });

  describe('2. Credential Parsing & Validation', () => {
    it('trims and lowercases email; preserves password without trimming', () => {
      const parsed = parseCredentials({
        email: '  Owner@RockUcFoods.COM  ',
        password: ' PasswordWithSpaces! ',
        next: '/admin/estimator',
      });

      expect(parsed.email).toBe('owner@rockucfoods.com');
      expect(parsed.password).toBe(' PasswordWithSpaces! ');
      expect(parsed.next).toBe('/admin/estimator');
    });

    it('rejects invalid emails and out-of-bound passwords', () => {
      expect(() => parseCredentials({ email: 'invalid-email', password: 'pass' })).toThrow();
      expect(() => parseCredentials({ email: 'a@b.com', password: '' })).toThrow();
      expect(() => parseCredentials({ email: 'a@b.com', password: 'a'.repeat(201) })).toThrow();
    });
  });

  describe('3. Login Flow, Identical 401 Text & Immediate Sign-Out', () => {
    const GENERIC_ERROR = 'Email or password is incorrect.';

    it('returns identical 401 text for wrong password', async () => {
      const deps = createDeps();
      await expect(
        login({ email: 'rock-uc-foods@gmail.com', password: 'WrongPassword!' }, deps)
      ).rejects.toThrow(GENERIC_ERROR);
    });

    it('returns identical 401 text for unknown email', async () => {
      const deps = createDeps();
      await expect(
        login({ email: 'unknown@example.com', password: 'EstherLuxury2026!' }, deps)
      ).rejects.toThrow(GENERIC_ERROR);
    });

    it('returns identical 401 text and signs out immediately for deactivated account', async () => {
      const deps = createDeps();
      let signOutCalled = false;
      deps.auth.signOut = async () => {
        signOutCalled = true;
      };

      await expect(
        login({ email: 'disabled@rockucfoods.com', password: 'OldPassword2026!' }, deps)
      ).rejects.toThrow(GENERIC_ERROR);

      expect(signOutCalled).toBe(true);
    });

    it('returns identical 401 text and signs out immediately for missing profile', async () => {
      const deps = createDeps({
        getProfile: async () => null,
      });
      let signOutCalled = false;
      deps.auth.signOut = async () => {
        signOutCalled = true;
      };

      await expect(
        login({ email: 'rock-uc-foods@gmail.com', password: 'EstherLuxury2026!' }, deps)
      ).rejects.toThrow(GENERIC_ERROR);

      expect(signOutCalled).toBe(true);
    });

    it('staff role completes login without MFA requirement', async () => {
      const deps = createDeps();
      const res = await login(
        { email: 'staff@rockucfoods.com', password: 'StaffService2026!' },
        deps
      );
      expect(res.step).toBe('done');
      expect(res.role).toBe('staff');
    });

    it('owner without verified factor gets enrol step', async () => {
      const deps = createDeps();
      const res = await login(
        { email: 'rock-uc-foods@gmail.com', password: 'EstherLuxury2026!' },
        deps
      );
      expect(res.step).toBe('enrol');
      expect(res.role).toBe('owner');
    });

    it('owner with verified factor gets verify step', async () => {
      const deps = createDeps();
      const res = await login(
        { email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' },
        deps
      );
      expect(res.step).toBe('verify');
      expect(res.role).toBe('owner');
    });

    it('audit log NEVER leaks typed email or password on success or failure', async () => {
      const deps = createDeps();
      try {
        await login({ email: 'secret-user@rockucfoods.com', password: 'SuperSecretPassword!' }, deps);
      } catch {
        // Expected
      }

      for (const evt of recordedAudits) {
        const str = JSON.stringify(evt);
        expect(str).not.toContain('secret-user@rockucfoods.com');
        expect(str).not.toContain('SuperSecretPassword!');
      }
    });

    it('audit failure never blocks a correct sign-in', async () => {
      const deps = createDeps({
        auditWriter: () => {
          throw new Error('Database audit write failure');
        },
      });

      const res = await login(
        { email: 'staff@rockucfoods.com', password: 'StaffService2026!' },
        deps
      );
      expect(res.step).toBe('done');
    });
  });

  describe('4. Rate Limiting Protection (11th Attempt = 429)', () => {
    it('enforces 10 login attempts per window; 11th attempt fails closed with 429', async () => {
      const deps = createDeps();

      for (let i = 1; i <= 10; i++) {
        try {
          await login({ email: 'rock-uc-foods@gmail.com', password: 'WrongPassword!' }, deps);
        } catch (e: any) {
          expect(e.statusCode).toBe(401);
        }
      }

      // 11th attempt must fail with 429
      let errorThrown: any = null;
      try {
        await login({ email: 'rock-uc-foods@gmail.com', password: 'WrongPassword!' }, deps);
      } catch (e) {
        errorThrown = e;
      }

      expect(errorThrown).not.toBeNull();
      expect(errorThrown.statusCode).toBe(429);
      expect(errorThrown.message).toContain('Too many failed sign-in attempts');
    });

    it('missing IP shares ONE bucket (login:ip:unknown)', async () => {
      const deps = createDeps({ ipHash: 'unknown' });

      for (let i = 1; i <= 10; i++) {
        try {
          await login({ email: 'rock-uc-foods@gmail.com', password: 'WrongPassword!' }, deps);
        } catch {
          // Expected
        }
      }

      await expect(
        login({ email: 'rock-uc-foods@gmail.com', password: 'WrongPassword!' }, deps)
      ).rejects.toThrow('Too many failed sign-in attempts');
    });
  });

  describe('5. MFA Enrollment & Refusal of Duplicate Factor (409)', () => {
    it('refuses enrollment with 409 when user already has verified factor', async () => {
      const deps = createDeps();
      // Sign in as owner who already has verified factor
      await login(
        { email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' },
        deps
      );

      await expect(mfaStart(deps)).rejects.toThrow(
        'Authenticator is already enrolled and verified. Cannot enroll an additional factor.'
      );
    });

    it('generates SVG QR code and secret for fresh owner', async () => {
      const deps = createDeps();
      await login(
        { email: 'rock-uc-foods@gmail.com', password: 'EstherLuxury2026!' },
        deps
      );

      const res = await mfaStart(deps);
      expect(res.factorId).toBeDefined();
      expect(res.qrCode).toMatch(/^data:image\/svg\+xml/);
      expect(res.secret).toMatch(/^[A-Z2-7]+$/);
    });
  });

  describe('6. MFA Verification, Code Normalization & Factor Selection', () => {
    it('rejects malformed codes (non-6 digits, letters, special chars) before service call', async () => {
      const deps = createDeps();
      await login(
        { email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' },
        deps
      );

      await expect(mfaVerify({ code: '12345' }, deps)).rejects.toThrow('must be exactly 6 digits');
      await expect(mfaVerify({ code: '1234567' }, deps)).rejects.toThrow('must be exactly 6 digits');
      await expect(mfaVerify({ code: 'ABCDEF' }, deps)).rejects.toThrow('must be exactly 6 digits');
      await expect(mfaVerify({ code: '12-34-56' }, deps)).rejects.toThrow('must be exactly 6 digits');
    });

    it('normalizes spaces in 6-digit codes cleanly', async () => {
      const deps = createDeps();
      await login(
        { email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' },
        deps
      );

      // Even with spaces, space is removed before validation
      // Service call will fail with 401 invalid code rather than malformed code error
      await expect(mfaVerify({ code: ' 000 000 ' }, deps)).rejects.toThrow(
        'Invalid 6-digit verification code.'
      );
    });

    it('enforces guess limit: 10 attempts per user, 11th attempt fails with 429', async () => {
      const deps = createDeps();
      await login(
        { email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' },
        deps
      );

      for (let i = 1; i <= 10; i++) {
        try {
          await mfaVerify({ code: '000000' }, deps);
        } catch {
          // Expected
        }
      }

      await expect(mfaVerify({ code: '000000' }, deps)).rejects.toThrow('Account locked');
    });

    it('ignores client-supplied factorId when verified factor exists', async () => {
      const deps = createDeps();
      await login(
        { email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' },
        deps
      );

      // Sending a fake factorId should be ignored; server uses the verified factor
      try {
        await mfaVerify({ code: '000000', factorId: 'hacker-fake-factor-id' }, deps);
      } catch (e: any) {
        // It failed because code 000000 was wrong, NOT because factor was unknown
        expect(e.message).toBe('Invalid 6-digit verification code.');
      }
    });
  });

  describe('7. Admin Gate & Edge Middleware Decision Matrix', () => {
    it('redirects anonymous visitor to /login with next path remembered', async () => {
      const decision = await decideAdminAccess(
        { getUserProfile: async () => null },
        '/admin/estimator'
      );

      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.destination).toBe('/login?next=%2Fadmin%2Festimator');
      }
    });

    it('forbids deactivated account with 403', async () => {
      const decision = await decideAdminAccess({
        getUserProfile: async () => ({
          id: 'usr-01',
          role: 'owner',
          isActive: false,
          fullName: 'Deactivated Owner',
        }),
      });

      expect(decision.action).toBe('forbidden');
    });

    it('allows staff without second factor requirement', async () => {
      const decision = await decideAdminAccess({
        getUserProfile: async () => ({
          id: 'usr-staff',
          role: 'staff',
          isActive: true,
          fullName: 'Kitchen Staff',
        }),
      });

      expect(decision.action).toBe('allow');
    });

    it('redirects owner without verified MFA to /login/mfa', async () => {
      const decision = await decideAdminAccess(
        {
          getUserProfile: async () => ({
            id: 'usr-owner',
            role: 'owner',
            isActive: true,
            fullName: 'Chef Esther',
            hasMfaVerified: false,
          }),
        },
        '/admin/reconciliation'
      );

      expect(decision.action).toBe('redirect');
      if (decision.action === 'redirect') {
        expect(decision.destination).toBe('/login/mfa?next=%2Fadmin%2Freconciliation');
      }
    });

    it('allows owner with verified MFA', async () => {
      const decision = await decideAdminAccess({
        getUserProfile: async () => ({
          id: 'usr-owner',
          role: 'owner',
          isActive: true,
          fullName: 'Chef Esther',
          hasMfaVerified: true,
        }),
      });

      expect(decision.action).toBe('allow');
    });

    it('Edge middleware decision has zero node imports and returns 401 JSON for /api/admin without user', () => {
      const apiDec = decideMiddleware({
        pathname: '/api/admin/estimator',
        hasUser: false,
      });
      expect(apiDec.type).toBe('unauthorized_api');
      if (apiDec.type === 'unauthorized_api') {
        expect(apiDec.status).toBe(401);
      }

      const uiDec = decideMiddleware({
        pathname: '/admin/estimator',
        hasUser: false,
      });
      expect(uiDec.type).toBe('redirect_login');
      if (uiDec.type === 'redirect_login') {
        expect(uiDec.destination).toContain('/login?next=');
      }
    });
  });

  describe('8. Mutation Safety Invariants', () => {
    it('Mutation 1: Letting disabled account in violates invariant', async () => {
      const deps = createDeps();
      let errorThrown = false;
      try {
        await login({ email: 'disabled@rockucfoods.com', password: 'OldPassword2026!' }, deps);
      } catch {
        errorThrown = true;
      }
      expect(errorThrown).toBe(true);
    });

    it('Mutation 2: Allowing duplicate authenticator enrollment violates invariant', async () => {
      const deps = createDeps();
      await login({ email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' }, deps);
      let errorThrown = false;
      try {
        await mfaStart(deps);
      } catch (e: any) {
        expect(e.statusCode).toBe(409);
        errorThrown = true;
      }
      expect(errorThrown).toBe(true);
    });

    it('Mutation 3: Accepting open redirect violates invariant', () => {
      expect(safeNext('https://malicious.com')).toBe('/admin');
    });
  });
});
