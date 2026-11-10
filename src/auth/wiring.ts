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

import { AuthPort, AuthPortUser, AuthPortSession, LoginCoreDeps } from './login-core';
import { UserProfile } from '../lib/auth/access';
import { generateMfaSecret, verifyTotp } from '../security/totp';

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

  public async signInWithPassword(credentials: { email: string; password: string }): Promise<{
    user: AuthPortUser;
    session: AuthPortSession;
  }> {
    const record = this.findUserByEmail(credentials.email);
    if (!record || record.passwordHash !== credentials.password) {
      throw new Error('Invalid credentials');
    }

    const authUser = this.toAuthUser(record);
    const session: AuthPortSession = {
      access_token: `tok-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      refresh_token: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      expires_at: Date.now() + 1000 * 60 * 60 * 24,
      user: authUser,
      aal: record.factors.some((f) => f.status === 'verified') ? 'aal1' : 'aal1',
    };

    this.currentSession = session;
    return { user: authUser, session };
  }

  public async signOut(): Promise<void> {
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
    if (!this.currentSession) {
      throw new Error('No active session for MFA enrollment');
    }

    const userId = this.currentSession.user.id;
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

    // Update current session user factors
    this.currentSession.user = this.toAuthUser(user);

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

  public async mfaChallengeAndVerify(params: { factorId: string; code: string }): Promise<{
    user: AuthPortUser;
    session: AuthPortSession;
  }> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const userId = this.currentSession.user.id;
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const factor = user.factors.find((f) => f.id === params.factorId);
    if (!factor) {
      throw new Error('Factor not found');
    }

    // Verify TOTP code using security totp engine
    const res = verifyTotp(params.code, factor.secret);
    if (!res.valid) {
      throw new Error('Invalid verification code');
    }

    // Mark verified
    factor.status = 'verified';

    const authUser = this.toAuthUser(user);
    this.currentSession.user = authUser;
    this.currentSession.aal = 'aal2';

    return {
      user: authUser,
      session: this.currentSession,
    };
  }

  public async mfaUnenroll(params: { factorId: string }): Promise<void> {
    if (!this.currentSession) return;
    const user = this.users.get(this.currentSession.user.id);
    if (!user) return;

    user.factors = user.factors.filter((f) => f.id !== params.factorId);
    this.currentSession.user = this.toAuthUser(user);
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
      if (!updates.isActive && this.currentSession?.user.id === id) {
        this.currentSession = null;
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
  }

  public deleteUser(id: string): void {
    this.users.delete(id);
    if (this.currentSession?.user.id === id) {
      this.currentSession = null;
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

// Global Singleton InMemoryAuthService for application runtime
export const globalAuthService = new InMemoryAuthService();

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

export function createLoginDeps(ipHash: string = 'unknown'): LoginCoreDeps {
  return {
    auth: globalAuthService,
    getProfile: getProfileFromService,
    ipHash,
  };
}
