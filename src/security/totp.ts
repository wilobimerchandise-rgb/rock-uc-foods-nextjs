/**
 * ROCK UC FOODS - RFC 6238 TOTP Engine & Security Hardening
 * Playbook v4 Section 23
 * 
 * Rules:
 * - RFC 6238 compliant HMAC-SHA1 algorithm with 30s step and 6 digits.
 * - Replay attack prevention: enforces lastUsedStep.
 * - Clock drift tolerance: ±1 step window (30 seconds before and after).
 * - Cryptographically random Base32 secret generation and backup recovery codes.
 */

import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TIME_STEP_SECONDS = 30;
const DIGITS = 6;

/**
 * Encodes a buffer to RFC 4648 Base32 string.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes an RFC 4648 Base32 string to buffer.
 */
export function base32Decode(base32Str: string): Buffer {
  const cleanStr = base32Str.toUpperCase().replace(/[\s-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const char = cleanStr[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) {
      continue; // Skip invalid or padding characters
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates an RFC 6238 TOTP code for a specific time step.
 */
export function generateTotpForStep(secret: string, step: number): string {
  const key = base32Decode(secret);

  // 8-byte big-endian counter buffer
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(step));

  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const tokenNumber = codeInt % Math.pow(10, DIGITS);
  return tokenNumber.toString().padStart(DIGITS, '0');
}

/**
 * Generates current TOTP code for a secret.
 */
export function generateTotp(secret: string, timeSeconds: number = Math.floor(Date.now() / 1000)): string {
  const step = Math.floor(timeSeconds / TIME_STEP_SECONDS);
  return generateTotpForStep(secret, step);
}

export interface VerifyTotpResult {
  valid: boolean;
  step?: number;
  reason?: string;
}

/**
 * Verifies a 6-digit TOTP code with replay defense and ±1 window drift.
 */
export function verifyTotp(
  token: string,
  secret: string,
  lastUsedStep: number = 0,
  timeSeconds: number = Math.floor(Date.now() / 1000)
): VerifyTotpResult {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'Token must be provided.' };
  }

  const cleanToken = token.trim();
  if (!/^\d{6}$/.test(cleanToken)) {
    return { valid: false, reason: 'Token must be exactly 6 digits.' };
  }

  const currentStep = Math.floor(timeSeconds / TIME_STEP_SECONDS);

  // Check windows: current step, previous step (-1), next step (+1)
  const stepsToTest = [currentStep, currentStep - 1, currentStep + 1];

  for (const step of stepsToTest) {
    // Replay defense: Reject if step is <= lastUsedStep
    if (step <= lastUsedStep) {
      continue;
    }

    const expectedCode = generateTotpForStep(secret, step);

    // Constant-time string comparison
    if (
      cleanToken.length === expectedCode.length &&
      crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expectedCode))
    ) {
      return { valid: true, step };
    }
  }

  // If token matched a step that was already used, explain replay error
  for (const step of stepsToTest) {
    if (step <= lastUsedStep) {
      const code = generateTotpForStep(secret, step);
      if (cleanToken === code) {
        return {
          valid: false,
          reason: 'Token already used. Please wait for the next 30-second cycle.',
        };
      }
    }
  }

  return { valid: false, reason: 'Invalid authenticator code.' };
}

/**
 * Generates single-use 8-character backup recovery codes.
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

  for (let i = 0; i < count; i++) {
    let code = '';
    const randomBytes = crypto.randomBytes(8);
    for (let b = 0; b < 8; b++) {
      code += chars[randomBytes[b] % chars.length];
    }
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Verifies and redeems a single-use backup recovery code.
 */
export function verifyAndRedeemBackupCode(
  inputCode: string,
  activeCodes: string[]
): { valid: boolean; remainingCodes: string[] } {
  if (!inputCode) return { valid: false, remainingCodes: activeCodes };

  const normalizedInput = inputCode.toUpperCase().replace(/\s+/g, '');
  const foundIndex = activeCodes.findIndex((c) => c.replace(/-/g, '') === normalizedInput.replace(/-/g, ''));

  if (foundIndex === -1) {
    return { valid: false, remainingCodes: activeCodes };
  }

  // Remove used code
  const remainingCodes = [...activeCodes];
  remainingCodes.splice(foundIndex, 1);

  return { valid: true, remainingCodes };
}

/**
 * Generates a fresh Base32 MFA secret and standard otpauth URL.
 */
export function generateMfaSecret(
  issuer: string = 'ROCK UC FOODS',
  accountName: string = 'owner@rockucfoods.com'
): { secret: string; otpauthUri: string; backupCodes: string[] } {
  const secretBuffer = crypto.randomBytes(20); // 160-bit key
  const secret = base32Encode(secretBuffer);
  const backupCodes = generateBackupCodes(8);

  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  const otpauthUri = `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;

  return {
    secret,
    otpauthUri,
    backupCodes,
  };
}
