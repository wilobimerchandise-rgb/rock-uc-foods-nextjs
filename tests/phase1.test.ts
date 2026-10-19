/**
 * ROCK UC FOODS - Phase 1 Verification Test Suite
 * Validates money utilities, authorization, refund engine, consent gates,
 * real PostgreSQL PGlite migration & audit immutability, and PDF ₦ glyph rendering.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { PDFParse } = require('pdf-parse');
import {
  formatNaira,
  parseNairaToKobo,
  applyPercentRoundHalfUp,
  calculate7030Split,
  MAX_KOBO,
  NAIRA_SYMBOL,
} from '../src/lib/money';
import {
  requireRole,
  UserProfile,
  AuthorizationError,
  auditLogStore,
} from '../src/lib/auth';
import {
  classifyOrder,
  bulkRefundBps,
  calculateRefund,
} from '../src/policy/refund';
import {
  validatePolicyConsent,
  PolicyConsentError,
} from '../src/policy/consent';
import {
  POLICY_VERSION,
  ALLERGEN_NOTICE,
  CHECKOUT_POLICY_CHECKBOX_LABEL,
  INVOICE_FOOTER,
} from '../src/policy/content';
import { normalizeNigerianPhone, checkRateLimit } from '../src/lib/security';
import { generateSampleReceiptPdf } from '../src/lib/pdf';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 1: Money Module & Currency Integrity', () => {
  it('formatNaira(123456789n) === "₦1,234,567.89"', () => {
    const formatted = formatNaira(123456789n);
    expect(formatted).toBe('₦1,234,567.89');
    expect(formatted).toContain(NAIRA_SYMBOL);
    expect(formatted).not.toContain('NGN');
    expect(formatted).not.toContain('■');
  });

  it('formatNaira handles 0 and golden fixtures', () => {
    expect(formatNaira(0n)).toBe('₦0.00');
    expect(formatNaira(350000n)).toBe('₦3,500.00'); // T-001
    expect(formatNaira(420000n)).toBe('₦4,200.00'); // T-002
    expect(formatNaira(120000n)).toBe('₦1,200.00'); // T-003
    expect(formatNaira(970000n)).toBe('₦9,700.00'); // G1 Total
  });

  it('parseNairaToKobo parses "1,500.5" to 150050n', () => {
    expect(parseNairaToKobo('1,500.5')).toBe(150050n);
    expect(parseNairaToKobo('3,500.00')).toBe(350000n);
    expect(parseNairaToKobo('₦4,200')).toBe(420000n);
    expect(parseNairaToKobo('0.05')).toBe(5n);
  });

  it('parseNairaToKobo rejects invalid, negative, or malformed inputs', () => {
    expect(() => parseNairaToKobo('1.999')).toThrow(/maximum 2 decimal places/);
    expect(() => parseNairaToKobo('-5')).toThrow(/negative amounts are not permitted/);
    expect(() => parseNairaToKobo('abc')).toThrow(/valid numeric amount/);
    expect(() => parseNairaToKobo('')).toThrow(/cannot be empty/);
    expect(() => parseNairaToKobo('3.5k')).toThrow(/valid numeric amount/);
  });

  it('applyPercentRoundHalfUp(333n, 750) === 25n (7.5% of 333 = 24.975 -> 25)', () => {
    expect(applyPercentRoundHalfUp(333n, 750)).toBe(25n);
  });

  it('calculate7030Split accurately calculates 70% deposit and 30% balance with no kobo loss', () => {
    // ₦13,500.00 (1350000n kobo)
    const split1 = calculate7030Split(1350000n);
    expect(split1.depositKobo).toBe(945000n); // 70% of 1350000 = 945000
    expect(split1.balanceKobo).toBe(405000n); // 30% of 1350000 = 405000
    expect(split1.depositKobo + split1.balanceKobo).toBe(1350000n);

    // Odd kobo test: 101 kobo
    const split2 = calculate7030Split(101n);
    expect(split2.depositKobo + split2.balanceKobo).toBe(101n);
  });
});

describe('Phase 1: Real PostgreSQL PGlite Database Migration & Audit Immutability', () => {
  it('Applies 0001_foundation.sql migration and verifies audit_logs is append-only', async () => {
    const db = new PGlite();
    const migrationSql = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'),
      'utf-8'
    );

    // Apply migration
    await db.exec(migrationSql);

    // Insert an initial audit log record
    await db.exec(`
      INSERT INTO audit_logs (actor_role, action, entity, entity_id)
      VALUES ('owner', 'create_setting', 'business_settings', '1');
    `);

    // Verify row exists
    const selectRes = await db.query<{ count: string }>('SELECT count(*) as count FROM audit_logs;');
    expect(Number(selectRes.rows[0].count)).toBe(1);

    // Attempt an UPDATE - MUST fail via trigger
    let updateFailed = false;
    try {
      await db.exec("UPDATE audit_logs SET action = 'tampered' WHERE id = 1;");
    } catch (err: unknown) {
      updateFailed = true;
      expect((err as Error).message).toContain('SECURITY VIOLATION: audit_logs is append-only');
    }
    expect(updateFailed).toBe(true);

    // Attempt a DELETE - MUST fail via trigger
    let deleteFailed = false;
    try {
      await db.exec('DELETE FROM audit_logs WHERE id = 1;');
    } catch (err: unknown) {
      deleteFailed = true;
      expect((err as Error).message).toContain('SECURITY VIOLATION: audit_logs is append-only');
    }
    expect(deleteFailed).toBe(true);
  }, 25000);
});

describe('Phase 1: Authorization, Roles & In-Memory Audit Tracker', () => {
  const ownerUser: UserProfile = {
    id: 'usr-owner-001',
    role: 'owner',
    isActive: true,
    fullName: 'Esther Kwentua (Owner)',
  };

  const staffUser: UserProfile = {
    id: 'usr-staff-001',
    role: 'staff',
    isActive: true,
    fullName: 'Kitchen Staff A',
  };

  const deactivatedUser: UserProfile = {
    id: 'usr-staff-deact',
    role: 'staff',
    isActive: false,
    fullName: 'Former Staff',
  };

  beforeEach(() => {
    auditLogStore.length = 0;
  });

  it('Staff user calling owner-only action throws 403 and records audit event', () => {
    expect(() => {
      requireRole(['owner'], staffUser, 'update menu prices', 'menu_item_1');
    }).toThrow(AuthorizationError);

    expect(auditLogStore.length).toBe(1);
    expect(auditLogStore[0].action).toContain('FORBIDDEN_ROLE_ATTEMPT');
    expect(auditLogStore[0].actorRole).toBe('staff');
  });

  it('Deactivated user request is immediately rejected and audited', () => {
    expect(() => {
      requireRole(['staff', 'owner'], deactivatedUser, 'view orders', 'orders_queue');
    }).toThrow(/Account is deactivated/);

    expect(auditLogStore.length).toBe(1);
    expect(auditLogStore[0].action).toContain('DEACTIVATED_ACCOUNT_ATTEMPT');
  });

  it('Owner user authorized actions succeed without error', () => {
    const verified = requireRole(['owner'], ownerUser, 'configure bank settings');
    expect(verified.id).toBe(ownerUser.id);
  });
});

describe('Phase 1: Policy Wording & Consent Gate', () => {
  it('Policy strings match verbatim requirements', () => {
    expect(ALLERGEN_NOTICE).toContain('If you have any severe allergy');
    expect(ALLERGEN_NOTICE).toContain('WhatsApp 08033729125');
    expect(CHECKOUT_POLICY_CHECKBOX_LABEL).toContain('Refund & Cancellation Policy');
    expect(INVOICE_FOOTER).toContain('Cancellation: Fresh orders non-cancellable after cooking');
  });

  it('Consent gate rejects missing, unchecked, or stale policy version', () => {
    // Missing consent
    expect(() => validatePolicyConsent({})).toThrow(PolicyConsentError);

    // Unchecked (false)
    expect(() =>
      validatePolicyConsent({ acceptedPolicy: false, policyVersion: POLICY_VERSION })
    ).toThrow(PolicyConsentError);

    // Stale version
    expect(() =>
      validatePolicyConsent({ acceptedPolicy: true, policyVersion: 'old-v1' })
    ).toThrow(/Stale policy version/);

    // Valid consent
    const valid = validatePolicyConsent({
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
    });
    expect(valid.acceptedPolicy).toBe(true);
    expect(valid.policyVersion).toBe(POLICY_VERSION);
  });
});

describe('Phase 1: Deterministic Refund Engine', () => {
  it('Classifies fresh (1-20 packs) vs bulk (21+ or live cooking)', () => {
    expect(classifyOrder(1)).toBe('fresh');
    expect(classifyOrder(20)).toBe('fresh');
    expect(classifyOrder(21)).toBe('bulk');
    expect(classifyOrder(5, true)).toBe('bulk'); // tray or live cooking
  });

  it('bulkRefundBps implements inclusive lower bounds', () => {
    expect(bulkRefundBps(72)).toBe(8000); // 80%
    expect(bulkRefundBps(71.99)).toBe(5000); // 50%
    expect(bulkRefundBps(48)).toBe(5000); // 50%
    expect(bulkRefundBps(47.99)).toBe(2500); // 25%
    expect(bulkRefundBps(24)).toBe(2500); // 25%
    expect(bulkRefundBps(23.99)).toBe(0); // 0%
  });

  it('Fresh meal cancelled within 30 min and cooking not started receives 100% refund', () => {
    const now = Date.now();
    const res = calculateRefund({
      classification: 'fresh',
      foodSubtotalKobo: 820000n,
      deliveryFeeKobo: 150000n,
      verifiedPaidKobo: 970000n,
      orderTimestampMs: now - 20 * 60 * 1000, // 20 mins ago
      cancellationTimestampMs: now,
      cookingStarted: false,
    });

    expect(res.eligibleRefundKobo).toBe(970000n);
    expect(res.refundFoodKobo).toBe(820000n);
    expect(res.refundDeliveryKobo).toBe(150000n);
  });

  it('Fresh meal cancelled after cooking started or > 30 mins is non-refundable', () => {
    const now = Date.now();
    // Cooking started within 10 mins
    const res1 = calculateRefund({
      classification: 'fresh',
      foodSubtotalKobo: 820000n,
      deliveryFeeKobo: 150000n,
      verifiedPaidKobo: 970000n,
      orderTimestampMs: now - 10 * 60 * 1000,
      cancellationTimestampMs: now,
      cookingStarted: true,
    });
    expect(res1.eligibleRefundKobo).toBe(0n);

    // Cancelled after 31 mins
    const res2 = calculateRefund({
      classification: 'fresh',
      foodSubtotalKobo: 820000n,
      deliveryFeeKobo: 150000n,
      verifiedPaidKobo: 970000n,
      orderTimestampMs: now - 31 * 60 * 1000,
      cancellationTimestampMs: now,
      cookingStarted: false,
    });
    expect(res2.eligibleRefundKobo).toBe(0n);
  });

  it('Bulk order refund applies to food subtotal only, never delivery fee', () => {
    const now = Date.now();
    const eventTime = now + 75 * 3600 * 1000; // 75 hours away (>=72h -> 80%)

    const res = calculateRefund({
      classification: 'bulk',
      foodSubtotalKobo: 10000000n, // ₦100,000 food
      deliveryFeeKobo: 2000000n, // ₦20,000 delivery
      verifiedPaidKobo: 7000000n, // 70% deposit = ₦70,000
      orderTimestampMs: now - 3600000,
      cancellationTimestampMs: now,
      cookingStarted: false,
      eventDateTimestampMs: eventTime,
    });

    expect(res.eligibleRefundKobo).toBe(7000000n);
    expect(res.refundDeliveryKobo).toBe(0n);
  });
});

describe('Phase 1: Security & Nigerian Phone Normalization', () => {
  it('Normalizes Nigerian phone numbers to standard E.164 (+234...)', () => {
    expect(normalizeNigerianPhone('08033729125')).toBe('+2348033729125');
    expect(normalizeNigerianPhone('2348033729125')).toBe('+2348033729125');
    expect(normalizeNigerianPhone('+2348033729125')).toBe('+2348033729125');
    expect(normalizeNigerianPhone('0803-372-9125')).toBe('+2348033729125');
  });

  it('Rejects invalid phone numbers', () => {
    expect(() => normalizeNigerianPhone('12345')).toThrow(/Invalid phone/);
    expect(() => normalizeNigerianPhone('080337291')).toThrow(/Invalid Nigerian phone length/);
  });

  it('checkRateLimit enforces maximum requests in window', () => {
    const key = 'test-ip-123';
    expect(checkRateLimit(key, 3, 10000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 10000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 10000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 10000).allowed).toBe(false);
  });
});

describe('Phase 1: PDF Generation & Naira Glyph Verification', () => {
  it('PDF generation creates receipt text with ₦ and parses cleanly without placeholder boxes', async () => {
    const result = await generateSampleReceiptPdf(150000n);
    expect(result.pdfBytes.length).toBeGreaterThan(100);

    // Parse generated PDF using PDFParse class to extract actual rendered text stream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parser = new (PDFParse as any)({ data: Buffer.from(result.pdfBytes) });
    await parser.load();
    const parsedText = await parser.getText();

    expect(parsedText.text).toContain('ROCK UC FOODS');
    expect(parsedText.text).toContain(NAIRA_SYMBOL);
    expect(parsedText.text).toContain('1,500.00');
    expect(parsedText.text).not.toContain('■');
    expect(parsedText.text).not.toContain('NGN');
  });
});

describe('Phase 1: Secret Scan Audit', () => {
  it('No hardcoded secrets or service role keys in source files', () => {
    const sourceDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(sourceDir, { recursive: true }) as string[];

    for (const file of files) {
      const fullPath = path.join(sourceDir, file);
      if (fs.statSync(fullPath).isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        expect(content).not.toMatch(/service_role/i);
        expect(content).not.toMatch(/sk_live_/i);
        expect(content).not.toMatch(/sk_test_[0-9a-zA-Z]{20,}/i);
      }
    }
  });
});
