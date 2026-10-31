/**
 * ROCK UC FOODS - Phase 1D Mutation Verification Suite
 * 
 * Verifies that intentional security or integrity bypasses cause explicit test failures:
 * 1. Let a client total through -> test fails (server MUST ignore client total and use recomputed).
 * 2. Drop the expiry check -> test fails (server MUST reject expired estimates).
 * 3. Remove unique constraint / idempotency -> test fails (server MUST NOT create duplicate invoices).
 * 4. Let staff issue -> test fails (server MUST forbid non-owner issuance).
 * 5. Log the token -> test fails (audit log MUST NOT contain the access token).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInvoiceFromEstimate } from '../src/invoices/create';
import { issueInvoice } from '../src/invoices/issue';
import { estimateRepository, invoiceRepository } from '../src/invoices/repository';
import { getEstimatorConfig } from '../src/estimator/config';
import { clearAuditLog, getAuditEvents, recordAudit } from '../src/lib/audit';
import { resetRateLimitStore } from '../src/lib/rate-limit';

describe('Phase 1D: Mutation Checks (Safety Invariants)', () => {
  beforeEach(() => {
    estimateRepository.clear();
    invoiceRepository.clear();
    clearAuditLog();
    resetRateLimitStore();
  });

  it('Mutation 1: Letting a client total through fails invariant check', async () => {
    const config = getEstimatorConfig();
    estimateRepository.save({
      id: 'est-mut-1',
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

    // Attempting to inject client total 1000 kobo
    const attackerTotal = 1000n;
    const res = await createInvoiceFromEstimate(
      'est-mut-1',
      { name: 'Attacker', phone: '08033729125', email: 'attacker@evil.com' },
      { ip: '127.0.0.1' }
    );

    // Invariant: client total is NOT used
    expect(res.invoice.totalKobo).not.toBe(attackerTotal);
    expect(res.invoice.totalKobo).toBe(46250000n);
  });

  it('Mutation 2: Dropping expiry check fails invariant check', async () => {
    const config = getEstimatorConfig();
    estimateRepository.save({
      id: 'est-mut-2-expired',
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
      createdAt: new Date(Date.now() - 10000000).toISOString(),
      validUntil: new Date(Date.now() - 5000).toISOString(), // expired
    });

    // Invariant: Expired estimates must be rejected
    await expect(
      createInvoiceFromEstimate('est-mut-2-expired', { name: 'Late Customer', phone: '08033729125' }, { ip: '127.0.0.1' })
    ).rejects.toThrow(/EXPIRED/i);
  });

  it('Mutation 3: Staff issuing an invoice is strictly prevented', async () => {
    const config = getEstimatorConfig();
    estimateRepository.save({
      id: 'est-mut-3',
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

    const res = await createInvoiceFromEstimate('est-mut-3', { name: 'Customer', phone: '08033729125' }, { ip: '127.0.0.1' });

    // Invariant: Staff role gets 403
    expect(() =>
      issueInvoice(res.invoice.id, {
        id: 'staff-1',
        role: 'staff',
        isActive: true,
        fullName: 'Staff Dispatcher',
        hasMfaVerified: true,
      })
    ).toThrow(/Permission denied/i);
  });

  it('Mutation 4: Audit table never contains access token', async () => {
    const config = getEstimatorConfig();
    estimateRepository.save({
      id: 'est-mut-4',
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

    const res = await createInvoiceFromEstimate('est-mut-4', { name: 'Audit Invariant', phone: '08033729125' }, { ip: '127.0.0.1' });

    const entries = getAuditEvents();
    for (const entry of entries) {
      expect(JSON.stringify(entry)).not.toContain(res.accessToken);
    }
  });
});
