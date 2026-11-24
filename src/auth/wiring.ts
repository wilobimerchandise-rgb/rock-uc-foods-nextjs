/**
 * ROCK UC FOODS - Auth System Wiring & In-Memory Port
 * Playbook v2 Section 28 (Phase 1E)
 * 
 * Rules:
 * - Pure server-side wiring.
 * - Stores state for verified and unverified factors.
 * - Seeds default operational roles (owner, staff, developer).
 * - Generates TOTP secrets and verified factors using RFC 6238 totp engine.
 */

import crypto from 'crypto';
import { AuthPort, AuthPortUser, AuthPortSession, LoginCoreDeps } from './login-core';
import { UserProfile } from '../lib/auth/access';
import { generateMfaSecret, verifyTotp } from '../security/totp';
import { securityStore } from '../security/stepUp';
import { SESSION_COOKIE_NAME } from './cookies';

export interface InternalUserRecord {
  id: string;
  email: string;
  passwordHash: string; // Plain mock check for test/in-memory environment
  role: 'owner' | 'staff' | 'developer';
  isActive: boolean;
  fullName: string;
  factors: Array<{
    id: string;
    factor_type: 'totp';
    status: 'verified' | 'unverified';
    secret: string;
  }>;
}

// Initial system accounts per Playbook Section 28.4 & Section 4
export const INITIAL_ACCOUNTS: InternalUserRecord[] = [
  {
    id: 'usr-owner-01',
    email: 'rock-uc-foods@gmail.com',
    passwordHash: 'EstherLuxury2026!',
    role: 'owner',
    isActive: true,
    fullName: 'Chef Esther Kwentua',
    factors: [],
  },
  {
    id: 'usr-owner-verified',
    email: 'estherkwentua@gmail.com',
    passwordHash: 'EstherLuxury2026!',
    role: 'owner',
    isActive: true,
    fullName: 'Chef Esther Kwentua (Verified MFA)',
    factors: [
      {
        id: 'factor-owner-01',
        factor_type: 'totp',
        status: 'verified',
        secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      },
    ],
  },
  {
    id: 'usr-staff-01',
    email: 'staff@rockucfoods.com',
    passwordHash: 'StaffService2026!',
    role: 'staff',
    isActive: true,
    fullName: 'Kitchen Operations Staff',
    factors: [],
  },
  {
    id: 'usr-dev-01',
    email: 'developer@rockucfoods.com',
    passwordHash: 'DevAccess2026!#$',
    role: 'developer',
    isActive: true,
    fullName: 'Audited Developer Account',
    factors: [
      {
        id: 'factor-dev-01',
        factor_type: 'totp',
        status: 'verified',
        secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      },
    ],
  },
  {
    id: 'usr-disabled-01',
    email: 'disabled@rockucfoods.com',
    passwordHash: 'OldPassword2026!',
    role: 'owner',
    isActive: false,
    fullName: 'Deactivated Former Owner',
    factors: [],
  },
];

export class InMemoryAuthService implements AuthPort {
  private users: Map<string, InternalUserRecord> = new Map();
  private currentSession: AuthPortSession | null = null;
  private sessionsByToken: Map<string, AuthPortSession> = new Map();

  constructor(initialUsers: InternalUserRecord[] = INITIAL_ACCOUNTS) {
    this.reset(initialUsers);
  }

  public reset(initialUsers: InternalUserRecord[] = INITIAL_ACCOUNTS): void {
    this.users.clear();
    for (const u of initialUsers) {
      this.users.set(u.id, {
        ...u,
        factors: u.factors.map((f) => ({ ...f })),
      });
    }
    this.currentSession = null;
    this.sessionsByToken.clear();
  }

  public findUserByEmail(email: string): InternalUserRecord | undefined {
    const clean = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === clean) {
        return user;
      }
    }
    return undefined;
  }

  public getUserById(id: string): InternalUserRecord | undefined {
    return this.users.get(id);
  }

  public getSessionByToken(token: string | null | undefined): AuthPortSession | null {
    if (!token) return null;
    const session = this.sessionsByToken.get(token);
    if (!session) return null;
    if (session.expires_at && Date.now() > session.expires_at) {
      this.sessionsByToken.delete(token);
      return null;
    }
    const user = this.users.get(session.user.id);
    if (!user || !user.isActive) {
      this.sessionsByToken.delete(token);
      return null;
    }
    session.user = this.toAuthUser(user);
    return session;
  }

  private createSessionForRecord(
    record: InternalUserRecord,
    authChannel: 'cookie' | 'in_memory'
  ): { user: AuthPortUser; session: AuthPortSession } {
    const authUser = this.toAuthUser(record);
    const token = `tok-${crypto.randomBytes(24).toString('hex')}`;
    const session: AuthPortSession = {
      access_token: token,
      refresh_token: `ref-${crypto.randomBytes(16).toString('hex')}`,
      expires_at: Date.now() + 1000 * 60 * 60 * 24,
      user: authUser,
      aal: 'aal1',
      authChannel,
    };
    this.sessionsByToken.set(token, session);
    return { user: authUser, session };
  }

  public async signInWithPassword(credentials: { email: string; password: string }): Promise<{
    user: AuthPortUser;
    session: AuthPortSession;
  }> {
    const record = this.findUserByEmail(credentials.email);
    if (!record || record.passwordHash !== credentials.password) {
      throw new Error('Invalid credentials');
    }

    const res = this.createSessionForRecord(record, 'in_memory');
    this.currentSession = res.session;
    return res;
  }

  public async signOut(): Promise<void> {
    if (this.currentSession) {
      this.sessionsByToken.delete(this.currentSession.access_token);
    }
    this.currentSession = null;
  }

  public async getUser(): Promise<{ user: AuthPortUser | null }> {
    return { user: this.currentSession ? this.currentSession.user : null };
  }

  public async getSession(): Promise<{ session: AuthPortSession | null }> {
    return { session: this.currentSession };
  }

  public setSession(session: AuthPortSession | null): void {
    this.currentSession = session;
    if (session?.access_token) {
      this.sessionsByToken.set(session.access_token, session);
    }
  }

  private enrollFactorForSession(
    session: AuthPortSession | null,
    params: { factorType: 'totp'; issuer?: string }
  ): {
    id: string;
    type: 'totp';
    totp: { qr_code: string; secret: string; uri: string };
  } {
    if (!session) {
      throw new Error('No active session for MFA enrollment');
    }

    const userId = session.user.id;
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const cred = generateMfaSecret(params.issuer || 'ROCK UC FOODS', user.email);
    const factorId = `factor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    user.factors.push({
      id: factorId,
      factor_type: 'totp',
      status: 'unverified',
      secret: cred.secret,
    });

    session.user = this.toAuthUser(user);

    return {
      id: factorId,
      type: 'totp',
      totp: {
        qr_code: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="8">ROCK UC FOODS QR</text></svg>`,
        secret: cred.secret,
        uri: cred.otpauthUri,
      },
    };
  }

  private verifyFactorForSession(
    session: AuthPortSession | null,
    params: { factorId: string; code: string }
  ): { user: AuthPortUser; session: AuthPortSession } {
    if (!session) {
      throw new Error('No active session');
    }

    const userId = session.user.id;
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const factor = user.factors.find((f) => f.id === params.factorId);
    if (!factor) {
      throw new Error('Factor not found');
    }

    const res = verifyTotp(params.code, factor.secret);
    if (!res.valid) {
      throw new Error('Invalid verification code');
    }

    factor.status = 'verified';
    securityStore.syncVerifiedTotpCredential(user.id, factor.secret);

    const authUser = this.toAuthUser(user);
    session.user = authUser;
    session.aal = 'aal2';

    return {
      user: authUser,
      session,
    };
  }

  private unenrollFactorForSession(
    session: AuthPortSession | null,
    params: { factorId: string }
  ): void {
    if (!session) return;
    const user = this.users.get(session.user.id);
    if (!user) return;

    user.factors = user.factors.filter((f) => f.id !== params.factorId);
    session.user = this.toAuthUser(user);
  }

  public async mfaEnroll(params: { factorType: 'totp'; issuer?: string }): Promise<{
    id: string;
    type: 'totp';
    totp: {
      qr_code: string;
      secret: string;
      uri: string;
    };
  }> {
    return this.enrollFactorForSession(this.currentSession, params);
  }

  public async mfaChallengeAndVerify(params: { factorId: string; code: string }): Promise<{
    user: AuthPortUser;
    session: AuthPortSession;
  }> {
    return this.verifyFactorForSession(this.currentSession, params);
  }

  public async mfaUnenroll(params: { factorId: string }): Promise<void> {
    this.unenrollFactorForSession(this.currentSession, params);
  }

  /**
   * Creates an AuthPort strictly isolated to an HTTP cookie token so concurrent or anonymous
   * browser requests can never inherit another visitor's session.
   */
  public createCookieScopedAuthPort(initialToken: string | null): AuthPort & {
    getActiveSessionToken: () => string | null;
  } {
    let activeToken: string | null = initialToken;
    const service = this;

    return {
      getActiveSessionToken: () => activeToken,
      async signInWithPassword(credentials) {
        const record = service.findUserByEmail(credentials.email);
        if (!record || record.passwordHash !== credentials.password) {
          throw new Error('Invalid credentials');
        }
        const res = service.createSessionForRecord(record, 'cookie');
        activeToken = res.session.access_token;
        return res;
      },
      async signOut() {
        if (activeToken) {
          service.sessionsByToken.delete(activeToken);
          if (service.currentSession?.access_token === activeToken) {
            service.currentSession = null;
          }
        }
        activeToken = null;
      },
      async getUser() {
        const sess = service.getSessionByToken(activeToken);
        return { user: sess ? sess.user : null };
      },
      async getSession() {
        const sess = service.getSessionByToken(activeToken);
        return { session: sess };
      },
      async mfaEnroll(params) {
        const sess = service.getSessionByToken(activeToken);
        return service.enrollFactorForSession(sess, params);
      },
      async mfaChallengeAndVerify(params) {
        const sess = service.getSessionByToken(activeToken);
        return service.verifyFactorForSession(sess, params);
      },
      async mfaUnenroll(params) {
        const sess = service.getSessionByToken(activeToken);
        service.unenrollFactorForSession(sess, params);
      },
    };
  }

  public verifyUserFactorDirectly(userId: string, secret: string): void {
    const user = this.users.get(userId);
    if (!user) return;
    const existing = user.factors.find((f) => f.factor_type === 'totp' && f.secret === secret);
    if (existing) {
      existing.status = 'verified';
    } else {
      user.factors = user.factors.filter((f) => f.status === 'verified');
      user.factors.push({
        id: `factor-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        factor_type: 'totp',
        status: 'verified',
        secret,
      });
    }
    for (const sess of this.sessionsByToken.values()) {
      if (sess.user.id === userId) {
        sess.user = this.toAuthUser(user);
        sess.aal = 'aal2';
      }
    }
    if (this.currentSession?.user.id === userId) {
      this.currentSession.user = this.toAuthUser(user);
      this.currentSession.aal = 'aal2';
    }
  }

  public getAllUsers(): InternalUserRecord[] {
    return Array.from(this.users.values()).map((u) => ({
      ...u,
      factors: u.factors.map((f) => ({ ...f })),
    }));
  }

  public createUser(record: {
    email: string;
    fullName: string;
    role: 'owner' | 'staff' | 'developer';
    passwordHash: string;
    isActive?: boolean;
    id?: string;
  }): InternalUserRecord {
    const cleanEmail = record.email.trim().toLowerCase();
    if (this.findUserByEmail(cleanEmail)) {
      throw new Error(`User with email '${cleanEmail}' already exists.`);
    }

    const newUser: InternalUserRecord = {
      id: record.id || `usr-${crypto.randomUUID()}`,
      email: cleanEmail,
      fullName: record.fullName.trim(),
      role: record.role,
      passwordHash: record.passwordHash,
      isActive: record.isActive !== undefined ? record.isActive : true,
      factors: [],
    };

    this.users.set(newUser.id, newUser);
    return { ...newUser, factors: [] };
  }

  public updateUser(
    id: string,
    updates: Partial<Pick<InternalUserRecord, 'fullName' | 'role' | 'isActive' | 'passwordHash'>>
  ): InternalUserRecord {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User with id '${id}' not found.`);
    }

    if (updates.fullName !== undefined) {
      user.fullName = updates.fullName.trim();
    }
    if (updates.role !== undefined) {
      user.role = updates.role;
    }
    if (updates.isActive !== undefined) {
      user.isActive = updates.isActive;
      if (!updates.isActive) {
        if (this.currentSession?.user.id === id) {
          this.currentSession = null;
        }
        for (const [tok, sess] of this.sessionsByToken.entries()) {
          if (sess.user.id === id) {
            this.sessionsByToken.delete(tok);
          }
        }
      }
    }
    if (updates.passwordHash !== undefined) {
      user.passwordHash = updates.passwordHash;
    }

    return {
      ...user,
      factors: user.factors.map((f) => ({ ...f })),
    };
  }

  public resetUserFactors(id: string): void {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User with id '${id}' not found.`);
    }
    user.factors = [];
    if (this.currentSession?.user.id === id) {
      this.currentSession.aal = 'aal1';
      this.currentSession.user = this.toAuthUser(user);
    }
    for (const sess of this.sessionsByToken.values()) {
      if (sess.user.id === id) {
        sess.aal = 'aal1';
        sess.user = this.toAuthUser(user);
      }
    }
  }

  public deleteUser(id: string): void {
    this.users.delete(id);
    if (this.currentSession?.user.id === id) {
      this.currentSession = null;
    }
    for (const [tok, sess] of this.sessionsByToken.entries()) {
      if (sess.user.id === id) {
        this.sessionsByToken.delete(tok);
      }
    }
  }

  private toAuthUser(user: InternalUserRecord): AuthPortUser {
    return {
      id: user.id,
      email: user.email,
      factors: user.factors.map((f) => ({
        id: f.id,
        factor_type: f.factor_type,
        status: f.status,
      })),
    };
  }
}

// Global Singleton InMemoryAuthService anchored on globalThis for Next.js multi-bundle safety
export const globalAuthService: InMemoryAuthService =
  ((globalThis as any).__rockUcGlobalAuthService as InMemoryAuthService) ||
  new InMemoryAuthService();
(globalThis as any).__rockUcGlobalAuthService = globalAuthService;

function extractSessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    if (key === SESSION_COOKIE_NAME) {
      const val = part.slice(eqIdx + 1).trim();
      return val ? decodeURIComponent(val) : null;
    }
  }
  return null;
}

export async function getProfileFromService(userId: string): Promise<UserProfile | null> {
  const user = globalAuthService.getUserById(userId);
  if (!user) return null;

  const hasMfaVerified = user.factors.some(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );

  return {
    id: user.id,
    role: user.role,
    isActive: user.isActive,
    fullName: user.fullName,
    email: user.email,
    hasMfaVerified,
  };
}

export function hasSessionVerifiedMfa(
  session: AuthPortSession | null,
  profileHasMfa?: boolean
): boolean {
  if (!session) return false;
  if (session.authChannel === 'cookie') {
    return session.aal === 'aal2';
  }
  return (
    (session.user.factors?.some((f) => f.factor_type === 'totp' && f.status === 'verified') ??
      false) ||
    session.aal === 'aal2' ||
    Boolean(profileHasMfa)
  );
}

/**
 * Resolves the active session from HTTP cookies (`sb-ruc-auth-token`) when inside a Next.js
 * request scope, failing closed when the cookie is absent or invalid, while preserving
 * direct in-memory session calls in unit tests outside Next.js request scope.
 */
export async function resolveSessionFromRequest(
  request?: Request
): Promise<{ session: AuthPortSession | null }> {
  if (request) {
    const cookieToken = extractSessionTokenFromCookieHeader(request.headers.get('cookie'));
    if (cookieToken) {
      return { session: globalAuthService.getSessionByToken(cookieToken) };
    }
  }

  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
    return { session: globalAuthService.getSessionByToken(token) };
  } catch {
    // Outside Next.js async request scope (direct Vitest invocation without HTTP cookie)
    return globalAuthService.getSession();
  }
}

export function createLoginDeps(ipHash: string = 'unknown'): LoginCoreDeps {
  return {
    auth: globalAuthService,
    getProfile: getProfileFromService,
    ipHash,
  };
}

export function createCookieLoginDeps(
  ipHash: string = 'unknown',
  sessionToken: string | null = null
): LoginCoreDeps & { getSessionToken: () => string | null } {
  const scopedAuth = globalAuthService.createCookieScopedAuthPort(sessionToken);
  return {
    auth: scopedAuth,
    getProfile: getProfileFromService,
    ipHash,
    getSessionToken: () => scopedAuth.getActiveSessionToken(),
  };
}
