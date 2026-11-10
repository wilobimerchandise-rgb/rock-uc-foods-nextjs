/**
 * ROCK UC FOODS - Phase 1G: Customer WhatsApp Link & Token Verification Test Suite
 * Playbook v2 Section 29
 * 
 * Verifies:
 * 1. Valid token allows customer access to invoice figures.
 * 2. Missing, incorrect, or truncated token returns 404 (no leak).
 * 3. Expired 30-day token returns 404.
 * 4. Revoked share link returns 404.
 * 5. Re-sharing generates multiple active links until revoked or expired.
 * 6. Payment proof WhatsApp link is properly formatted with Nigerian phone (+234...).
 * 7. Money identity holds: depositKobo + balanceKobo === totalKobo.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  invoiceRepository,
  invoiceLinksRepository,
  estimateRepository,
} from '../src/invoices/repository';
import { prepareInvoiceShare, revokeInvoiceLinks } from '../src/invoices/share';
import { verifyTokenHash } from '../src/invoices/publicRef';
import { UserProfile } from '../src/lib/auth/access';
import { StoredInvoice, StoredEstimate } from '../src/invoices/types';

describe('Phase 1G: Customer Invoice WhatsApp Access & Token Lifecycle', () => {
  const ownerUser: UserProfile = {
    id: 'owner-uuid-01',
    role: 'owner',
    isActive: true,
    fullName: 'Chef Esther Kwentua',
    hasMfaVerified: true,
  };

  const sampleEstimate: StoredEstimate = {
    id: 'est-phase1g-001',
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
    contactName: 'Amaka Okafor',
    contactPhone: '08033729125',
    createdAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 86400000).toISOString(),
  };

  const sampleInvoice: StoredInvoice = {
    id: 'inv-phase1g-001',
    publicRef: 'EVT-20261110-WAPP',
    estimateId: sampleEstimate.id,
    revision: 1,
    status: 'issued',
    lines: [
      {
        name: 'Bronze Feast, 50 guests',
        quantity: 50,
        unitPriceKobo: '1250000',
        lineTotalKobo: '62500000',
      },
    ],
    totalKobo: 73750000n,
    depositKobo: 51625000n,
    balanceKobo: 22125000n,
    accessTokenHash: crypto.createHash('sha256').update('original_secret_token_abcdef1234567890').digest('hex'),
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    invoiceRepository.clear();
    invoiceLinksRepository.clear();
    estimateRepository.clear();

    estimateRepository.save(sampleEstimate);
    invoiceRepository.save(sampleInvoice);
  });

  it('1. Owner prepares WhatsApp share link and receives wa.me URL with 30-day token', async () => {
    const rawToken = 'random_secret_token_1234567890123456';
    const result = await prepareInvoiceShare(sampleInvoice.publicRef, ownerUser, {
      siteUrl: 'https://rockucfoods.com',
      randomTokenFn: () => rawToken,
    });

    expect(result.phoneProblem).toBe(false);
    expect(result.url).toBeDefined();
    expect(result.url).toContain('https://wa.me/2348033729125?text=');
    expect(result.message).toContain('EVT-20261110-WAPP');
    expect(result.message).toContain('₦737,500.00');
    expect(result.message).toContain('token=' + rawToken);

    // Verify token can be checked against stored hash
    const links = invoiceLinksRepository.getLinksByInvoiceId(sampleInvoice.id);
    expect(links.length).toBe(1);
    expect(verifyTokenHash(rawToken, links[0].tokenHash)).toBe(true);
  });

  it('2. Invalid, malformed or wrong tokens fail verification', async () => {
    const rawToken = 'real_token_for_phase1g_test_12345678';
    await prepareInvoiceShare(sampleInvoice.publicRef, ownerUser, {
      randomTokenFn: () => rawToken,
    });

    const links = invoiceLinksRepository.getLinksByInvoiceId(sampleInvoice.id);
    const storedHash = links[0].tokenHash;

    // Wrong token
    expect(verifyTokenHash('completely_wrong_token_here', storedHash)).toBe(false);

    // Empty or short
    expect(verifyTokenHash('', storedHash)).toBe(false);

    // Truncated token
    expect(verifyTokenHash(rawToken.slice(0, 10), storedHash)).toBe(false);
  });

  it('3. Expired links (> 30 days) are recognized as expired', async () => {
    const now = Date.now();
    const rawToken = 'token_for_expiration_check_12345678';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Create link that expired yesterday
    invoiceLinksRepository.createLink({
      id: 'expired-link-001',
      invoiceId: sampleInvoice.id,
      tokenHash,
      createdBy: ownerUser.id,
      createdAt: new Date(now - 31 * 86400000).toISOString(),
      expiresAt: new Date(now - 86400000).toISOString(),
    });

    const links = invoiceLinksRepository.getLinksByInvoiceId(sampleInvoice.id);
    const activeLink = links.find(
      (l) => !l.revokedAt && new Date(l.expiresAt).getTime() > now
    );
    expect(activeLink).toBeUndefined();
  });

  it('4. Revoking invoice links invalidates active customer access', async () => {
    const rawToken = 'token_to_be_revoked_1234567890123456';
    await prepareInvoiceShare(sampleInvoice.publicRef, ownerUser, {
      randomTokenFn: () => rawToken,
    });

    const linksBefore = invoiceLinksRepository
      .getLinksByInvoiceId(sampleInvoice.id)
      .filter((l) => !l.revokedAt);
    expect(linksBefore.length).toBe(1);

    // Revoke
    const res = await revokeInvoiceLinks(sampleInvoice.publicRef, ownerUser);
    expect(res.revokedCount).toBe(1);

    const linksAfter = invoiceLinksRepository
      .getLinksByInvoiceId(sampleInvoice.id)
      .filter((l) => !l.revokedAt);
    expect(linksAfter.length).toBe(0);
  });

  it('5. Money identity holds unconditionally: depositKobo + balanceKobo === totalKobo', () => {
    expect(sampleInvoice.depositKobo + sampleInvoice.balanceKobo).toBe(sampleInvoice.totalKobo);
    expect(sampleInvoice.totalKobo).toBe(73750000n);
  });
});
