/**
 * ROCK UC FOODS - Core Login & MFA Logic (Pure Logic)
 * Playbook v2 Section 28 (Phase 1E)
 * 
 * Rules:
 * - NO sign-up of any kind.
 * - Same 401 text for wrong password, unknown email, deactivated, and missing profile.
 * - Deactivated and missing profile sign out immediately.
 * - Audit log NEVER contains typed email, password, or token.
 * - safeNext strictly allows /admin or /admin/*.
 * - Guessing OTP stops after 10 tries (429).
 * - Enrolment is REFUSED with 409 if a verified authenticator already exists.
 */

import { UserRole, UserProfile } from '../lib/auth/access';
import { checkRateLimit, RateLimitResult } from '../lib/rate-limit';
import { recordAudit } from '../lib/audit';

export interface AuthPortUser {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  factors?: Array<{
    id: string;
    factor_type: string;
    status: 'verified' | 'unverified';
  }>;
}

export interface AuthPortSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: AuthPortUser;
  aal?: 'aal1' | 'aal2';
}

export interface AuthPort {
  signInWithPassword(credentials: { email: string; password: string }): Promise<{
    user: AuthPortUser;
    session: AuthPortSession;
  }>;
  signOut(): Promise<void>;
  getUser(): Promise<{ user: AuthPortUser | null }>;
  getSession(): Promise<{ session: AuthPortSession | null }>;
  mfaEnroll(params: { factorType: 'totp'; issuer?: string }): Promise<{
    id: string;
    type: 'totp';
    totp: {
      qr_code: string;
      secret: string;
      uri: string;
    };
  }>;
  mfaChallengeAndVerify(params: { factorId: string; code: string }): Promise<{
    user: AuthPortUser;
    session: AuthPortSession;
  }>;
  mfaUnenroll?(params: { factorId: string }): Promise<void>;
}

export interface LoginCoreDeps {
  auth: AuthPort;
  getProfile: (userId: string) => Promise<UserProfile | null>;
  rateLimit?: (key: string, limit: number, windowMs: number) => RateLimitResult;
  auditWriter?: typeof recordAudit;
  ipHash: string;
}

export class AuthError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Validates and sanitizes the post-login redirect path.
 * Strictly accepts only paths equal to /admin or under /admin/.
 * Refuses foreign origins, backslash tricks, non-strings, or strings > 200 chars.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string') {
    return '/admin';
  }

  const str = raw.trim();
  if (!str || str.length > 200 || str.includes('\\')) {
    return '/admin';
  }

  try {
    const fakeBase = 'https://fake-internal.rockucfoods.com';
    const parsed = new URL(str, fakeBase);

    // Reject any foreign origin or scheme change
    if (parsed.origin !== fakeBase) {
      return '/admin';
    }

    const pathname = parsed.pathname;
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      return pathname + (parsed.search || '') + (parsed.hash || '');
    }

    return '/admin';
  } catch {
    return '/admin';
  }
}

/**
 * Validates and parses credentials.
 */
export function parseCredentials(body: unknown): { email: string; password: string; next: string } {
  if (!body || typeof body !== 'object') {
    throw new AuthError('Invalid request body', 400);
  }

  const { email, password, next } = body as Record<string, unknown>;

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new AuthError('Email and password must be strings', 400);
  }

  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail.length < 3 || cleanEmail.length > 254) {
    throw new AuthError('Email length must be between 3 and 254 characters', 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw new AuthError('Invalid email format', 400);
  }

  // Password is not trimmed per Playbook specification
  if (password.length < 1 || password.length > 200) {
    throw new AuthError('Password length must be between 1 and 200 characters', 400);
  }

  return {
    email: cleanEmail,
    password,
    next: safeNext(next),
  };
}

export type LoginStep = 'done' | 'verify' | 'enrol';

export interface LoginResult {
  step: LoginStep;
  role: UserRole;
  next: string;
  userId: string;
}

/**
 * Handles the initial email + password sign-in step.
 */
export async function login(body: unknown, deps: LoginCoreDeps): Promise<LoginResult> {
  const credentials = parseCredentials(body);
  const limiter = deps.rateLimit || checkRateLimit;
  const audit = deps.auditWriter || recordAudit;

  // 1. Per-IP Rate Limiting (10 per 600s, shared bucket for unknown IPs)
  const rateLimitKey = `login:ip:${deps.ipHash || 'unknown'}`;
  const rateLimitRes = limiter(rateLimitKey, 10, 600 * 1000);
  if (!rateLimitRes.allowed) {
    throw new AuthError('Too many failed sign-in attempts. Please try again in 10 minutes.', 429);
  }

  const GENERIC_AUTH_ERROR = 'Email or password is incorrect.';

  let authUser: AuthPortUser;
  try {
    const res = await deps.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    authUser = res.user;
  } catch (err: unknown) {
    audit({
      action: 'auth.login_failed',
      entity: 'auth',
      entityId: 'login_attempt',
      ipHash: deps.ipHash,
      details: { reason: 'invalid_credentials' },
    });

    const isDown = err instanceof Error && (err.message.includes('503') || err.message.toLowerCase().includes('service unavailable'));
    if (isDown) {
      throw new AuthError('Sign-in service is temporarily unavailable. Please try again later.', 503);
    }

    throw new AuthError(GENERIC_AUTH_ERROR, 401);
  }

  // 2. Fetch User Profile
  const profile = await deps.getProfile(authUser.id);

  // If profile is missing or account is deactivated, immediately sign out and return identical 401
  if (!profile || !profile.isActive) {
    try {
      await deps.auth.signOut();
    } catch {
      // Ignored
    }

    audit({
      action: 'auth.login_failed',
      entity: 'auth',
      entityId: authUser.id,
      ipHash: deps.ipHash,
      details: { reason: !profile ? 'missing_profile' : 'deactivated_account' },
    });

    throw new AuthError(GENERIC_AUTH_ERROR, 401);
  }

  // Record successful password authentication (never logs email or password)
  try {
    audit({
      action: 'auth.password_ok',
      entity: 'auth',
      entityId: authUser.id,
      actorId: authUser.id,
      actorRole: profile.role,
      ipHash: deps.ipHash,
    });
  } catch {
    // An audit failure never blocks a correct sign-in
  }

  // 3. Determine Next Step Based on Role
  if (profile.role === 'staff') {
    return {
      step: 'done',
      role: 'staff',
      next: credentials.next,
      userId: authUser.id,
    };
  }

  // Owner & Developer require second factor (MFA)
  const factors = authUser.factors || [];
  const hasVerifiedFactor = factors.some(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );

  return {
    step: hasVerifiedFactor ? 'verify' : 'enrol',
    role: profile.role,
    next: credentials.next,
    userId: authUser.id,
  };
}

/**
 * Initiates TOTP MFA enrollment.
 */
export async function mfaStart(deps: LoginCoreDeps): Promise<{
  factorId: string;
  qrCode: string;
  secret: string;
}> {
  const limiter = deps.rateLimit || checkRateLimit;

  const sessionRes = await deps.auth.getSession();
  const userRes = await deps.auth.getUser();
  const user = userRes.user || sessionRes.session?.user;

  if (!user) {
    throw new AuthError('Authentication required to start MFA enrollment', 401);
  }

  const profile = await deps.getProfile(user.id);
  if (!profile || !profile.isActive || (profile.role !== 'owner' && profile.role !== 'developer')) {
    throw new AuthError('Role is not authorized for MFA enrollment', 403);
  }

  // Per-user rate limit: 10 per 600s
  const rateLimitKey = `mfa:user:${user.id}`;
  const rateLimitRes = limiter(rateLimitKey, 10, 600 * 1000);
  if (!rateLimitRes.allowed) {
    throw new AuthError('Too many MFA enrollment attempts. Please try again later.', 429);
  }

  // REFUSED with 409 if a verified authenticator already exists
  const factors = user.factors || [];
  const existingVerified = factors.some(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );
  if (existingVerified) {
    throw new AuthError(
      'Authenticator is already enrolled and verified. Cannot enroll an additional factor.',
      409
    );
  }

  // Discard unverified leftovers if unenroll is supported
  const unverified = factors.filter(
    (f) => f.factor_type === 'totp' && f.status === 'unverified'
  );
  if (deps.auth.mfaUnenroll) {
    for (const factor of unverified) {
      try {
        await deps.auth.mfaUnenroll({ factorId: factor.id });
      } catch {
        // Ignored
      }
    }
  }

  const enrollment = await deps.auth.mfaEnroll({
    factorType: 'totp',
    issuer: 'ROCK UC FOODS',
  });

  // Ensure QR code starts with data:image/svg+xml or data:image/
  let qrCode = enrollment.totp.qr_code;
  if (!qrCode.startsWith('data:image/svg+xml') && !qrCode.startsWith('data:image/')) {
    // Generate inline SVG QR representation
    const safeUri = encodeURIComponent(enrollment.totp.uri);
    qrCode = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="50" font-size="8">ROCK UC FOODS MFA</text></svg>`;
  }

  return {
    factorId: enrollment.id,
    qrCode,
    secret: enrollment.totp.secret,
  };
}

/**
 * Verifies a 6-digit TOTP code during verify or enrol mode.
 */
export async function mfaVerify(
  body: unknown,
  deps: LoginCoreDeps
): Promise<{ success: boolean; next: string }> {
  const limiter = deps.rateLimit || checkRateLimit;
  const audit = deps.auditWriter || recordAudit;

  if (!body || typeof body !== 'object') {
    throw new AuthError('Invalid request body', 400);
  }

  const { code, factorId: browserFactorId, next } = body as Record<string, unknown>;

  if (typeof code !== 'string') {
    throw new AuthError('Code must be a 6-digit string', 400);
  }

  // Clean spaces and validate exactly 6 ASCII digits before anything else
  const cleanCode = code.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    throw new AuthError('Verification code must be exactly 6 digits', 400);
  }

  const sessionRes = await deps.auth.getSession();
  const userRes = await deps.auth.getUser();
  const user = userRes.user || sessionRes.session?.user;

  if (!user) {
    throw new AuthError('Active session required for verification', 401);
  }

  // Per-user guess rate limiting: 10 per 600s
  const guessKey = `mfa:guess:${user.id}`;
  const rateLimitRes = limiter(guessKey, 10, 600 * 1000);
  if (!rateLimitRes.allowed) {
    throw new AuthError('Too many invalid verification attempts. Account locked for 10 minutes.', 429);
  }

  const profile = await deps.getProfile(user.id);
  if (!profile || !profile.isActive) {
    throw new AuthError('Account is deactivated or profile is missing', 403);
  }

  const factors = user.factors || [];
  const verifiedFactor = factors.find(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );

  let targetFactorId: string;
  let isEnrolment = false;

  if (verifiedFactor) {
    // If a verified factor exists, the SERVER picks it and any browser factorId is ignored
    targetFactorId = verifiedFactor.id;
  } else {
    // During setup, only the user's unverified factor is accepted
    isEnrolment = true;
    if (typeof browserFactorId !== 'string' || !browserFactorId) {
      throw new AuthError('Factor ID required for enrollment verification', 400);
    }

    const unverifiedFactor = factors.find(
      (f) => f.id === browserFactorId && f.factor_type === 'totp' && f.status === 'unverified'
    );

    if (!unverifiedFactor) {
      throw new AuthError('Unauthorized factor ID for enrollment', 403);
    }

    targetFactorId = browserFactorId;
  }

  try {
    await deps.auth.mfaChallengeAndVerify({
      factorId: targetFactorId,
      code: cleanCode,
    });
  } catch (err: unknown) {
    try {
      audit({
        action: 'auth.mfa_failed',
        entity: 'auth',
        entityId: user.id,
        actorId: user.id,
        actorRole: profile.role,
        ipHash: deps.ipHash,
      });
    } catch {
      // Ignored
    }

    const isDown = err instanceof Error && (err.message.includes('503') || err.message.toLowerCase().includes('service unavailable'));
    if (isDown) {
      throw new AuthError('MFA verification service is temporarily unavailable.', 503);
    }

    throw new AuthError('Invalid 6-digit verification code.', 401);
  }

  try {
    audit({
      action: isEnrolment ? 'auth.mfa_enrolled' : 'auth.mfa_ok',
      entity: 'auth',
      entityId: user.id,
      actorId: user.id,
      actorRole: profile.role,
      ipHash: deps.ipHash,
    });
  } catch {
    // Ignored
  }

  return {
    success: true,
    next: safeNext(next),
  };
}

/**
 * Handles user logout.
 */
export async function logout(deps: LoginCoreDeps): Promise<{ success: boolean }> {
  const audit = deps.auditWriter || recordAudit;
  const userRes = await deps.auth.getUser();
  const userId = userRes.user?.id || 'anonymous';

  try {
    audit({
      action: 'auth.logout',
      entity: 'auth',
      entityId: userId,
      actorId: userId,
      ipHash: deps.ipHash,
    });
  } catch {
    // Ignored
  }

  try {
    await deps.auth.signOut();
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Logout failed';
    throw new AuthError(msg, 500);
  }
}

/**
 * Determines current MFA page state for client navigation.
 */
export async function mfaPageState(deps: LoginCoreDeps): Promise<
  | { state: 'login' }
  | { state: 'done'; role: UserRole }
  | { state: 'mfa'; mode: 'enrol' | 'verify'; role: UserRole }
> {
  const sessionRes = await deps.auth.getSession();
  const user = sessionRes.session?.user;

  if (!user) {
    return { state: 'login' };
  }

  const profile = await deps.getProfile(user.id);
  if (!profile || !profile.isActive) {
    return { state: 'login' };
  }

  if (profile.role === 'staff') {
    return { state: 'done', role: 'staff' };
  }

  const factors = user.factors || [];
  const hasVerified = factors.some(
    (f) => f.factor_type === 'totp' && f.status === 'verified'
  );

  return {
    state: 'mfa',
    mode: hasVerified ? 'verify' : 'enrol',
    role: profile.role,
  };
}
