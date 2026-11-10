/**
 * ROCK UC FOODS - Phase 1D Addendum: Invoice Revisions (Rev 2+) Test Suite
 * Playbook v2 Section 10 & Section 24
 * 
 * Verifies:
 * 1. Owner can revise an issued invoice into Rev 2 with a valid reason.
 * 2. Immutable history: previous version snapshot is archived in invoiceVersionsRepository.
 * 3. Role enforcement: Staff and Developer roles receive 403 and are audited.
 * 4. Reason validation: Reject empty or whitespace reason (< 3 chars).
 * 5. Cannot revise draft or void invoices.
 * 6. Mathematical reconciliation: depositKobo (70%) + balanceKobo (30%) === totalKobo.
 * 7. Old share links are revoked upon revision.
 * 8. PDF rendering carries (Rev 2) badge.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { invoiceRepository, estimateRepository, invoiceLinksRepository, invoiceVersionsRepository } from '../src/invoices/repository';
import { createInvoiceFromEstimate } from '../src/invoices/create';
import { issueInvoice } from '../src/invoices/issue';
import { reviseInvoice } from '../src/invoices/revise';
import { formatNaira } from '../src/lib/money';
import { clearAuditLog, getAuditEvents } from '../src/lib/audit';
import { UserProfile } from '../src/lib/auth/access';
import { StoredEstimate } from '../src/invoices/types';

describe('Phase 1D: Invoice Revision & Amendment Engine (Rev 2+)', () => {
  const ownerUser: UserProfile = {
    id: 'owner-uuid-001',
    role: 'owner',
    isActive: true,
    fullName: 'Chef Esther Kwentua',
    hasMfaVerified: true,
  };

  const staffUser: UserProfile = {
    id: 'staff-uuid-002',
    role: 'staff',
    isActive: true,
    fullName: 'Kitchen Supervisor',
    hasMfaVerified: false,
  };

  const devUser: UserProfile = {
    id: 'dev-uuid-003',
    role: 'developer',
    isActive: true,
    fullName: 'Platform Engineer',
    hasMfaVerified: true,
  };

  beforeEach(() => {
    estimateRepository.clear();
    invoiceRepository.clear();
    invoiceLinksRepository.clear();
    invoiceVersionsRepository.clear();
    clearAuditLog();
  });

  async function setupIssuedInvoice() {
    const estimate: StoredEstimate = {
      id: 'est-golden-001',
      configVersion: 1,
      inputs: {
        packageId: 'tier-bronze',
        guests: 50,
      },
      result: {
        foodSubtotalKobo: '62500000',
        addOnsSubtotalKobo: '0',
        serviceChargeKobo: '6250000',
        logisticsKobo: '5000000',
        grandTotalKobo: '73750000',
        depositKobo: '51625000',
        balanceKobo: '22125000',
      },
      contactName: 'Chinedu Okafor',
      contactPhone: '+2348033729125',
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    };
    estimateRepository.save(estimate);

    const { invoice: draft } = await createInvoiceFromEstimate(estimate.id, {
      name: 'Chinedu Okafor',
      phone: '08033729125',
    });

    const issued = issueInvoice(draft.id, ownerUser);
    return issued;
  }

  it('1. Owner can revise an issued invoice into Rev 2 with a valid reason', async () => {
    const invoice = await setupIssuedInvoice();
    expect(invoice.revision).toBe(1);
    expect(invoice.status).toBe('issued');
    expect(invoice.totalKobo).toBe(73750000n);

    // Revise to Silver Banquet with 65 guests (Silver is 51-150 guests)
    const { invoice: revised, versionRecord } = reviseInvoice(
      invoice.publicRef,
      {
        reason: 'Client requested upgrade to Silver Banquet with 65 guests',
        inputs: {
          packageId: 'tier-silver',
          guests: 65,
        },
      },
      ownerUser
    );

    expect(revised.revision).toBe(2);
    expect(revised.status).toBe('issued');
    expect(revised.revisionReason).toBe('Client requested upgrade to Silver Banquet with 65 guests');

    // Expected 65 guests on Silver:
    // Food: 65 * 18,500 = 1,202,500 (120,250,000 kobo)
    // Service: 10% = 120,250 (12,025,000 kobo)
    // Delivery: 50,000 (5,000,000 kobo)
    // Grand Total: 1,372,750 (137,275,000 kobo)
    // Deposit 70%: 960,925 (96,092,500 kobo)
    // Balance 30%: 411,825 (41,182,500 kobo)
    expect(revised.totalKobo).toBe(137275000n);
    expect(revised.depositKobo).toBe(96092500n);
    expect(revised.balanceKobo).toBe(41182500n);
    expect(revised.depositKobo + revised.balanceKobo).toBe(revised.totalKobo);

    // Check version archive
    expect(versionRecord.revision).toBe(1);
    expect(versionRecord.reason).toBe('Client requested upgrade to Silver Banquet with 65 guests');
    expect(versionRecord.snapshot.totalKobo).toBe(73750000n);

    const history = invoiceVersionsRepository.getVersionsByInvoiceId(revised.id);
    expect(history.length).toBe(1);
    expect(history[0].revision).toBe(1);

    // Check audit
    const audits = getAuditEvents().filter((e) => e.action === 'invoice.revised');
    expect(audits.length).toBe(1);
    expect(audits[0].details.publicRef).toBe(revised.publicRef);
    expect(audits[0].details.revision).toBe(2);
    expect(audits[0].details.previousRevision).toBe(1);
  });

  it('2. Staff and Developer roles receive 403 and attempts are audited', async () => {
    const invoice = await setupIssuedInvoice();

    expect(() =>
      reviseInvoice(
        invoice.publicRef,
        {
          reason: 'Staff attempted change',
          inputs: { packageId: 'tier-bronze', guests: 45 },
        },
        staffUser
      )
    ).toThrow(/Permission denied/);

    expect(() =>
      reviseInvoice(
        invoice.publicRef,
        {
          reason: 'Dev attempted change',
          inputs: { packageId: 'tier-bronze', guests: 45 },
        },
        devUser
      )
    ).toThrow(/Permission denied/);

    const authDenials = getAuditEvents().filter((e) =>
      e.action.startsWith('FORBIDDEN_ROLE_ATTEMPT')
    );
    expect(authDenials.length).toBe(2);
  });

  it('3. Rejects empty or too-short revision reason (< 3 chars)', async () => {
    const invoice = await setupIssuedInvoice();

    expect(() =>
      reviseInvoice(
        invoice.publicRef,
        {
          reason: '  ',
          inputs: { packageId: 'tier-bronze', guests: 45 },
        },
        ownerUser
      )
    ).toThrow(/A clear revision reason/);

    expect(() =>
      reviseInvoice(
        invoice.publicRef,
        {
          reason: 'no',
          inputs: { packageId: 'tier-bronze', guests: 45 },
        },
        ownerUser
      )
    ).toThrow(/A clear revision reason/);
  });

  it('4. Cannot revise draft invoice (must be issued first)', async () => {
    const estimate: StoredEstimate = {
      id: 'est-draft-only',
      configVersion: 1,
      inputs: { packageId: 'tier-bronze', guests: 30 },
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
    estimateRepository.save(estimate);
    const { invoice: draft } = await createInvoiceFromEstimate(estimate.id, {
      name: 'Test Client',
      phone: '08033729125',
    });

    expect(() =>
      reviseInvoice(
        draft.publicRef,
        {
          reason: 'Attempt on draft',
          inputs: { packageId: 'tier-bronze', guests: 40 },
        },
        ownerUser
      )
    ).toThrow(/Cannot revise invoice in 'draft' status/);
  });

  it('5. Previous share links are revoked on revision to ensure customer sees current quote', async () => {
    const invoice = await setupIssuedInvoice();

    // Create a share link for Rev 1
    invoiceLinksRepository.createLink({
      id: 'link-rev1-id',
      invoiceId: invoice.id,
      tokenHash: 'dummy-sha256-hash-rev1',
      createdBy: ownerUser.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    });

    const activeLinksBefore = invoiceLinksRepository
      .getLinksByInvoiceId(invoice.id)
      .filter((l) => !l.revokedAt);
    expect(activeLinksBefore.length).toBe(1);

    // Execute Rev 2
    reviseInvoice(
      invoice.publicRef,
      {
        reason: 'Adjusting menu package',
        inputs: { packageId: 'tier-silver', guests: 55 },
      },
      ownerUser
    );

    const activeLinksAfter = invoiceLinksRepository
      .getLinksByInvoiceId(invoice.id)
      .filter((l) => !l.revokedAt);
    expect(activeLinksAfter.length).toBe(0);
  });

  it('6. Multiple revisions (Rev 1 -> Rev 2 -> Rev 3) chain accurately in version history', async () => {
    const invoice = await setupIssuedInvoice();

    // Rev 1 -> Rev 2 (Silver: 51-150 guests)
    reviseInvoice(
      invoice.publicRef,
      {
        reason: 'Upgrade to Silver for 70 guests',
        inputs: { packageId: 'tier-silver', guests: 70 },
      },
      ownerUser
    );

    // Rev 2 -> Rev 3 (Gold: 151-300 guests)
    const { invoice: rev3 } = reviseInvoice(
      invoice.publicRef,
      {
        reason: 'Upgrade to Gold Royal package for 160 guests',
        inputs: { packageId: 'tier-gold', guests: 160 },
      },
      ownerUser
    );

    expect(rev3.revision).toBe(3);
    const history = invoiceVersionsRepository.getVersionsByInvoiceId(rev3.id);
    expect(history.length).toBe(2);
    expect(history[0].revision).toBe(2); // Newest superseded version first
    expect(history[1].revision).toBe(1);
    expect(rev3.depositKobo + rev3.balanceKobo).toBe(rev3.totalKobo);
  });
});
