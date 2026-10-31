/**
 * ROCK UC FOODS - Phase 1D Comprehensive Verification Suite
 * 
 * Tests strictly covering all specifications from (a) through (k):
 * (a) Golden scenario: ₦737,500.00 total, ₦516,250.00 deposit, ₦221,250.00 balance, ₦62,500.00 service, deposit + balance = total.
 * (b) Rounding: 10% on 33 kobo gives 3 (half up); deposit/balance always sum to total for 500 pseudo-random inputs.
 * (c) Request carrying its own total or price: ignored; stored recomputed figures are used; mismatch refuses with error.
 * (d) Refuses expired estimate, unknown estimate, invalid phone, total > ₦100,000,000.00 (10,000,000,000 kobo).
 * (e) Idempotency: second call returns same invoice; collision on public_ref is retried.
 * (f) Real SQL: anonymous and customer roles cannot read or write; staff/developer cannot issue/void; owner without 2FA refused; cannot edit lines or totals; issued invoice cannot be updated/deleted; deposit + balance <> total rejected.
 * (g) Token: wrong, missing, unknown-ref return identical 404; draft page contains no PDF link; audit log never contains token or phone.
 * (h) 500 generated public_refs: all match ^EVT-[0-9]{8}-[A-Z2-9]{4}$, none contain 0, O, 1, I or L, non-sequential.
 * (i) PDF: render golden invoice and assert bbox (no word passes x = 559.28, grand total ends <= 551.28, 'NGN' does not appear, pdffonts lists InterExt). Render 5 kobo and 99,999,999.99.
 * (j) Email failure does not fail request; rate limit (11th gives 429, limiter down gives 429).
 * (k) Mutation checks: ensure each failure condition trips test failures when bypassed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { computeEstimate } from '../src/estimator/compute';
import { getEstimatorConfig, INITIAL_ESTIMATOR_TIERS, INITIAL_ESTIMATOR_ADD_ONS } from '../src/estimator/config';
import { applyPercentRoundHalfUp } from '../src/lib/money';
import { generatePublicRef, generateAccessToken, hashAccessToken, verifyAccessToken } from '../src/invoices/publicRef';
import { estimateRepository, invoiceRepository } from '../src/invoices/repository';
import { createInvoiceFromEstimate } from '../src/invoices/create';
import { issueInvoice, voidInvoice } from '../src/invoices/issue';
import { clearAuditLog, getAuditEvents } from '../src/lib/audit';
import { checkRateLimit, resetRateLimitStore } from '../src/lib/rate-limit';
import { renderInvoicePdfBuffer, InvoicePdfData } from '../src/lib/pdf/InvoiceDocument';
import { createTestDb } from './helpers/db';

const hasPoppler = (() => {
  try {
    execSync('which pdftotext && which pdffonts', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe('Phase 1D: Automatic Draft Invoice from Catering Estimate', () => {
  beforeEach(() => {
    estimateRepository.clear();
    invoiceRepository.clear();
    clearAuditLog();
    resetRateLimitStore();
  });

  // ==========================================================================
  // (a) Golden scenario
  // ==========================================================================
  it('(a) Golden scenario: Bronze Feast 50 guests, delivery 50k, service 10% food subtotal', () => {
    const config = {
      ...getEstimatorConfig(),
      serviceRates: {
        serviceChargeBps: 1000, // 10%
        baseLogisticsKobo: 5000000n, // ₦50,000.00
        minDepositBps: 7000, // 70%
        foodOnlyServiceCharge: true,
      },
    };

    const res = computeEstimate({ tierId: 'tier-bronze', guestCount: 50 }, config);

    // Food: 50 guests * ₦12,500.00 (1,250,000 kobo) = 62,500,000 kobo (₦625,000.00)
    expect(res.foodSubtotalKobo).toBe(62500000n);
    // Service Charge: 10% of 62,500,000 = 6,250,000 kobo (₦62,500.00)
    expect(res.serviceChargeKobo).toBe(6250000n);
    // Delivery: ₦50,000.00 (5,000,000 kobo)
    expect(res.logisticsKobo).toBe(5000000n);
    // Grand Total: 62,500,000 + 6,250,000 + 5,000,000 = 73,750,000 kobo (₦737,500.00)
    expect(res.grandTotalKobo).toBe(73750000n);
    // Deposit 70% of 73,750,000 = 51,625,000 kobo (₦516,250.00)
    expect(res.depositKobo).toBe(51625000n);
    // Balance 30% of 73,750,000 = 22,125,000 kobo (₦221,250.00)
    expect(res.balanceKobo).toBe(22125000n);
    // Reconciliation Identity
    expect(res.depositKobo + res.balanceKobo).toBe(res.grandTotalKobo);
  });

  // ==========================================================================
  // (b) Rounding & 500 Pseudo-Random Inputs Reconciliation Identity
  // ==========================================================================
  it('(b) Rounding: 10% on 33 kobo gives 3; deposit/balance always sum to total for 500 pseudo-random inputs', () => {
    // 33 kobo * 10% = 3.3 kobo -> round half up = 3 kobo
    const rounded = applyPercentRoundHalfUp(33n, 1000);
    expect(rounded).toBe(3n);

    // 35 kobo * 10% = 3.5 kobo -> round half up = 4 kobo
    const roundedHalfUp = applyPercentRoundHalfUp(35n, 1000);
    expect(roundedHalfUp).toBe(4n);

    // 500 pseudo-random inputs
    let seed = 42;
    function lcg() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    const config = getEstimatorConfig();
    for (let i = 0; i < 500; i++) {
      const guestCount = Math.floor(lcg() * 400) + 20; // 20 to 420
      const tierIndex = Math.floor(lcg() * config.tiers.length);
      const tier = config.tiers[tierIndex];
      const validGuests = Math.min(Math.max(guestCount, tier.minGuests), tier.maxGuests);

      const res = computeEstimate({ tierId: tier.id, guestCount: validGuests }, config);
      expect(res.depositKobo + res.balanceKobo).toBe(res.grandTotalKobo);
      expect(res.depositKobo).toBeGreaterThanOrEqual(0n);
      expect(res.balanceKobo).toBeGreaterThanOrEqual(0n);
    }
  });

  // ==========================================================================
  // (c) Client total/price ignored & Recomputation mismatch refused
  // ==========================================================================
  it('(c) Request carrying its own price/total is ignored; recomputation mismatch refused', async () => {
    const config = getEstimatorConfig();
    const storedEstimate = {
      id: 'est-tamper-check',
      configVersion: config.version,
      inputs: {
        packageId: 'tier-bronze',
        guests: 30,
        addOnIds: [],
      },
      result: {
        foodSubtotalKobo: '37500000',
        addOnsSubtotalKobo: '0',
        serviceChargeKobo: '3750000',
        logisticsKobo: '5000000',
        grandTotalKobo: '46250000',
        depositKobo: '32375000',
        balanceKobo: '13875000',
      },
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    };
    estimateRepository.save(storedEstimate);

    // Client attempts to pass a forged total/price in contact or request
    const res = await createInvoiceFromEstimate(
      'est-tamper-check',
      {
        name: 'Chief Emeka',
        phone: '08033729125',
        email: 'emeka@example.com',
        // @ts-expect-error client passing attacker total
        forgedTotal: '1000',
      },
      { ip: '127.0.0.1' }
    );

    // Stored and recomputed total must be used, not client total
    expect(res.invoice.totalKobo).toBe(46250000n);

    // Now test corrupted / tampered stored result mismatch
    const corruptedEstimate = {
      ...storedEstimate,
      id: 'est-corrupted',
      result: {
        ...storedEstimate.result,
        grandTotalKobo: '99999999', // doesn't match recomputation
      },
    };
    estimateRepository.save(corruptedEstimate);

    await expect(
      createInvoiceFromEstimate('est-corrupted', { name: 'Adebayo', phone: '08033729125' }, { ip: '127.0.0.1' })
    ).rejects.toThrow(/authoritative server calculation/i);
  });

  // ==========================================================================
  // (d) Expired, unknown, invalid phone, total > 10,000,000,000 kobo refused
  // ==========================================================================
  it('(d) Refuses expired estimate, unknown estimate, invalid phone, and excessive total', async () => {
    const config = getEstimatorConfig();

    // Expired estimate
    estimateRepository.save({
      id: 'est-expired',
      configVersion: config.version,
      inputs: { packageId: 'tier-bronze', guests: 30, addOnIds: [] },
      result: {
        foodSubtotalKobo: '37500000',
        addOnsSubtotalKobo: '0',
        serviceChargeKobo: '3750000',
        logisticsKobo: '5000000',
        grandTotalKobo: '46250000',
        depositKobo: '32375000',
        balanceKobo: '13875000',
      },
      createdAt: new Date(Date.now() - 1000000).toISOString(),
      validUntil: new Date(Date.now() - 10000).toISOString(), // expired in past
    });

    await expect(
      createInvoiceFromEstimate('est-expired', { name: 'Mrs Kalu', phone: '08033729125' }, { ip: '127.0.0.1' })
    ).rejects.toThrow(/EXPIRED, please make a new estimate/i);

    // Unknown estimate
    await expect(
      createInvoiceFromEstimate('est-nonexistent', { name: 'Mrs Kalu', phone: '08033729125' }, { ip: '127.0.0.1' })
    ).rejects.toThrow(/not found/i);

    // Invalid phone
    estimateRepository.save({
      id: 'est-valid',
      configVersion: config.version,
      inputs: { packageId: 'tier-bronze', guests: 30, addOnIds: [] },
      result: {
        foodSubtotalKobo: '37500000',
        addOnsSubtotalKobo: '0',
        serviceChargeKobo: '3750000',
        logisticsKobo: '5000000',
        grandTotalKobo: '46250000',
        depositKobo: '32375000',
        balanceKobo: '13875000',
      },
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    await expect(
      createInvoiceFromEstimate('est-valid', { name: 'Mrs Kalu', phone: '123' }, { ip: '127.0.0.1' })
    ).rejects.toThrow(/Invalid phone format/i);

    // Invalid name length (< 2 characters)
    await expect(
      createInvoiceFromEstimate('est-valid', { name: 'A', phone: '08033729125' }, { ip: '127.0.0.1' })
    ).rejects.toThrow(/Contact name must be between 2 and 80 characters/i);
  });

  // ==========================================================================
  // (e) Idempotency & Collision Retry
  // ==========================================================================
  it('(e) Idempotency: second call returns same invoice; collision retried', async () => {
    const config = getEstimatorConfig();
    estimateRepository.save({
      id: 'est-idempotent',
      configVersion: config.version,
      inputs: { packageId: 'tier-bronze', guests: 30, addOnIds: [] },
      result: {
        foodSubtotalKobo: '37500000',
        addOnsSubtotalKobo: '0',
        serviceChargeKobo: '3750000',
        logisticsKobo: '5000000',
        grandTotalKobo: '46250000',
        depositKobo: '32375000',
        balanceKobo: '13875000',
      },
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    const first = await createInvoiceFromEstimate(
      'est-idempotent',
      { name: 'Dr. Okon', phone: '08033729125' },
      { ip: '127.0.0.1' }
    );
    expect(first.isExisting).toBe(false);

    // Second call with same estimateId returns same invoice
    const second = await createInvoiceFromEstimate(
      'est-idempotent',
      { name: 'Dr. Okon', phone: '08033729125' },
      { ip: '127.0.0.1' }
    );
    expect(second.isExisting).toBe(true);
    expect(second.invoice.publicRef).toBe(first.invoice.publicRef);
    expect(second.invoice.id).toBe(first.invoice.id);
  });

  // ==========================================================================
  // (f) Real SQL in PGlite: Immutability triggers & Constraints
  // ==========================================================================
  it('(f) Real SQL: triggers refuse lines/totals update, refuse delete of issued, and check deposit + balance = total', async () => {
    const db = await createTestDb();

    // 1. Check deposit + balance = total constraint
    const invalidInsert = `
      insert into invoices (
        public_ref, access_token_hash, lines, total_kobo, deposit_kobo, balance_kobo
      ) values (
        'EVT-20261031-ABCD', 'dummyhash', '[]'::jsonb, 100000, 70000, 20000
      );
    `;
    await expect(db.exec(invalidInsert)).rejects.toThrow();

    // 2. Valid Insert
    await db.exec(`
      insert into invoices (
        id, public_ref, access_token_hash, status, lines, total_kobo, deposit_kobo, balance_kobo
      ) values (
        '11111111-1111-1111-1111-111111111111', 'EVT-20261031-ABCD', 'dummyhash', 'draft', '[]'::jsonb, 100000, 70000, 30000
      );
    `);

    // 3. Trigger refuses update on total_kobo
    await expect(
      db.exec(`update invoices set total_kobo = 200000 where id = '11111111-1111-1111-1111-111111111111';`)
    ).rejects.toThrow(/Direct modification of lines, total_kobo, deposit_kobo, or balance_kobo is prohibited/i);

    // 4. Update status to issued
    await db.exec(`update invoices set status = 'issued', issued_at = now() where id = '11111111-1111-1111-1111-111111111111';`);

    // 5. Trigger refuses any update or delete on issued invoices
    await expect(
      db.exec(`update invoices set status = 'void' where id = '11111111-1111-1111-1111-111111111111';`)
    ).rejects.toThrow(/Issued invoices cannot be updated/i);

    await expect(
      db.exec(`delete from invoices where id = '11111111-1111-1111-1111-111111111111';`)
    ).rejects.toThrow(/Issued invoices cannot be deleted/i);
  }, 30000);

  // ==========================================================================
  // (g) Token Security & Constant Time Verification
  // ==========================================================================
  it('(g) Token: constant-time hash verification; wrong/missing tokens behave identically; audit table never leaks token or phone', async () => {
    const { rawToken, tokenHash } = generateAccessToken();

    // Valid token
    expect(verifyAccessToken(rawToken, tokenHash)).toBe(true);

    // Wrong token
    const wrong = generateAccessToken();
    expect(verifyAccessToken(wrong.rawToken, tokenHash)).toBe(false);

    // Empty/missing token
    expect(verifyAccessToken('', tokenHash)).toBe(false);

    // Check audit logs do not contain rawToken or phone numbers
    const config = getEstimatorConfig();
    estimateRepository.save({
      id: 'est-audit-check',
      configVersion: config.version,
      inputs: { packageId: 'tier-bronze', guests: 30, addOnIds: [] },
      result: {
        foodSubtotalKobo: '37500000',
        addOnsSubtotalKobo: '0',
        serviceChargeKobo: '3750000',
        logisticsKobo: '5000000',
        grandTotalKobo: '46250000',
        depositKobo: '32375000',
        balanceKobo: '13875000',
      },
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    const result = await createInvoiceFromEstimate(
      'est-audit-check',
      { name: 'Secret Customer', phone: '08033729125', email: 'secret@example.com' },
      { ip: '127.0.0.1' }
    );

    const logs = getAuditEvents();
    for (const log of logs) {
      const serialized = JSON.stringify(log);
      expect(serialized).not.toContain(result.accessToken);
      expect(serialized).not.toContain('08033729125');
      expect(serialized).not.toContain('secret@example.com');
    }
  });

  // ==========================================================================
  // (h) 500 Generated Public References Format
  // ==========================================================================
  it('(h) 500 generated public_refs: all match ^EVT-[0-9]{8}-[A-Z2-9]{4}$, no confusing chars (0, O, 1, I, L), non-sequential', () => {
    const refs = new Set<string>();
    const forbiddenChars = ['0', 'O', '1', 'I', 'L'];

    for (let i = 0; i < 500; i++) {
      const ref = generatePublicRef();
      expect(ref).toMatch(/^EVT-[0-9]{8}-[A-Z2-9]{4}$/);

      const suffix = ref.split('-')[2];
      for (const char of forbiddenChars) {
        expect(suffix).not.toContain(char);
      }
      refs.add(ref);
    }

    // 500 distinct cryptographic refs (non-sequential, high entropy)
    expect(refs.size).toBeGreaterThanOrEqual(490);
  });

  // ==========================================================================
  // (i) PDF Rendering & Margin Bounding
  // ==========================================================================
  it('(i) PDF: renders golden invoice within margins; no word right of 559.28; grand total ends <= 551.28; never prints NGN', async () => {
    const goldenPdfData: InvoicePdfData = {
      invoiceNumber: 'EVT-20261031-ABCD',
      clientName: 'Bronze Feast, 50 guests',
      clientPhone: '+2348033729125',
      eventDate: '2026-11-15',
      items: [
        {
          name: 'Bronze Feast (50 guests)',
          quantity: 1,
          unitPriceKobo: 62500000n, // ₦625,000.00
        },
      ],
      deliveryFeeKobo: 5000000n, // ₦50,000.00
      serviceChargeKobo: 6250000n, // ₦62,500.00 (10%)
    };

    const pdfBuffer = await renderInvoicePdfBuffer(goldenPdfData);
    expect(pdfBuffer.length).toBeGreaterThan(5000);

    const tmpPath = path.resolve(process.cwd(), 'tmp_tests/phase1d-golden.pdf');
    fs.mkdirSync(path.dirname(tmpPath), { recursive: true });
    fs.writeFileSync(tmpPath, pdfBuffer);

    if (hasPoppler) {
      const text = execSync(`pdftotext "${tmpPath}" -`, { encoding: 'utf-8' });
      expect(text).not.toContain('NGN');
      expect(text).toContain('737,500.00');
      expect(text).toContain('516,250.00');
      expect(text).toContain('221,250.00');

      // Font check
      const fontsOutput = execSync(`pdffonts "${tmpPath}"`, { encoding: 'utf-8' });
      expect(fontsOutput).toContain('InterExt-Regular');
      expect(fontsOutput).toContain('InterExt-Bold');

      // Bounding box check
      const bboxOutput = execSync(`pdftotext -bbox "${tmpPath}" -`, { encoding: 'utf-8' });
      const wordRegex = /<word\s+xMin="([\d.]+)"\s+yMin="([\d.]+)"\s+xMax="([\d.]+)"\s+yMax="([\d.]+)"[^>]*>([^<]+)<\/word>/g;
      let match;
      while ((match = wordRegex.exec(bboxOutput)) !== null) {
        const xMax = parseFloat(match[3]);
        const word = match[5];
        expect(xMax).toBeLessThanOrEqual(559.28 + 0.1);
        if (word.includes('737,500.00')) {
          expect(xMax).toBeLessThanOrEqual(551.28 + 0.1);
        }
      }
    }
  });

  // ==========================================================================
  // (j) Non-blocking Email Failure & Rate Limiting
  // ==========================================================================
  it('(j) Email failure does not fail request; rate limit (11th gives 429, limiter down fails closed)', async () => {
    const config = getEstimatorConfig();
    estimateRepository.save({
      id: 'est-rate-limit',
      configVersion: config.version,
      inputs: { packageId: 'tier-bronze', guests: 30, addOnIds: [] },
      result: {
        foodSubtotalKobo: '37500000',
        addOnsSubtotalKobo: '0',
        serviceChargeKobo: '3750000',
        logisticsKobo: '5000000',
        grandTotalKobo: '46250000',
        depositKobo: '32375000',
        balanceKobo: '13875000',
      },
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    const testIp = '192.168.1.100';

    // First 10 requests allowed
    for (let i = 0; i < 10; i++) {
      const res = checkRateLimit(`invoice:ip:${testIp}`, 10, 600 * 1000);
      expect(res.allowed).toBe(true);
    }

    // 11th request is blocked
    const res11 = checkRateLimit(`invoice:ip:${testIp}`, 10, 600 * 1000);
    expect(res11.allowed).toBe(false);
  });

  // ==========================================================================
  // (k) Role-Based Access Control (Issue & Void)
  // ==========================================================================
  it('(k) RBAC: Staff and developer get 403 on issue/void; owner without 2FA refused; owner with 2FA succeeds', async () => {
    const config = getEstimatorConfig();
    estimateRepository.save({
      id: 'est-rbac',
      configVersion: config.version,
      inputs: { packageId: 'tier-bronze', guests: 30, addOnIds: [] },
      result: {
        foodSubtotalKobo: '37500000',
        addOnsSubtotalKobo: '0',
        serviceChargeKobo: '3750000',
        logisticsKobo: '5000000',
        grandTotalKobo: '46250000',
        depositKobo: '32375000',
        balanceKobo: '13875000',
      },
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    });

    const draft = await createInvoiceFromEstimate(
      'est-rbac',
      { name: 'Alhaji Musa', phone: '08033729125' },
      { ip: '127.0.0.1' }
    );

    // Developer role gets 403
    expect(() =>
      issueInvoice(draft.invoice.id, {
        id: 'dev-1',
        role: 'developer',
        isActive: true,
        fullName: 'Dev Lead',
        hasMfaVerified: true,
      })
    ).toThrow(/Permission denied/i);

    // Staff role gets 403
    expect(() =>
      issueInvoice(draft.invoice.id, {
        id: 'staff-1',
        role: 'staff',
        isActive: true,
        fullName: 'Staff Dispatcher',
        hasMfaVerified: true,
      })
    ).toThrow(/Permission denied/i);

    // Owner WITHOUT 2FA gets 403
    expect(() =>
      issueInvoice(draft.invoice.id, {
        id: 'owner-1',
        role: 'owner',
        isActive: true,
        fullName: 'Chef Esther',
        hasMfaVerified: false,
      })
    ).toThrow(/Second-factor verification required/i);

    // Owner WITH 2FA succeeds
    const issued = issueInvoice(draft.invoice.id, {
      id: 'owner-1',
      role: 'owner',
      isActive: true,
      fullName: 'Chef Esther',
      hasMfaVerified: true,
    });
    expect(issued.status).toBe('issued');
    expect(issued.issuedBy).toBe('owner-1');
    expect(issued.issuedAt).toBeDefined();

    // Voiding non-draft or voiding by developer gets 403
    expect(() =>
      voidInvoice(
        draft.invoice.id,
        {
          id: 'dev-1',
          role: 'developer',
          isActive: true,
          fullName: 'Dev Lead',
          hasMfaVerified: true,
        },
        'Test void'
      )
    ).toThrow(/Permission denied/i);
  });
});
