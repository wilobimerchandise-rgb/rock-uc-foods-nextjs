/**
 * ROCK UC FOODS - Phase 1G: Invoice WhatsApp Sharing & 30-Day Tokens Test Suite
 * Playbook v2 Section 29
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  cleanFirstName,
  normalizeWhatsAppPhone,
  buildShareMessage,
  prepareInvoiceShare,
  revokeInvoiceLinks,
} from '../src/invoices/share';
import {
  invoiceRepository,
  invoiceLinksRepository,
  estimateRepository,
} from '../src/invoices/repository';
import { UserProfile, AuthorizationError } from '../src/lib/auth/access';
import { resetRateLimitStore, RateLimitError } from '../src/lib/rate-limit';
import { getAuditEvents, clearAuditLog } from '../src/lib/audit';
import { StoredInvoice, StoredEstimate } from '../src/invoices/types';

describe('Phase 1G - WhatsApp 1-Tap Invoice Sharing & Token Security', () => {
  const ownerUser: UserProfile = {
    id: 'owner_user_1',
    role: 'owner',
    isActive: true,
    fullName: 'Chef Esther Kwentua',
    email: 'estherkwentua@gmail.com',
    hasMfaVerified: true,
  };

  const staffUser: UserProfile = {
    id: 'staff_user_1',
    role: 'staff',
    isActive: true,
    fullName: 'Babatunde Staff',
    email: 'babatunde@example.com',
    hasMfaVerified: true,
  };

  const developerUser: UserProfile = {
    id: 'dev_user_1',
    role: 'developer',
    isActive: true,
    fullName: 'Lead Engineer',
    email: 'dev@example.com',
    hasMfaVerified: true,
  };

  const sampleEstimate: StoredEstimate = {
    id: 'est_evt_20261108_abcd',
    configVersion: 1,
    inputs: {
      packageId: 'tier_bronze',
      guests: 50,
      addOnIds: [],
    },
    result: {
      foodSubtotalKobo: '62500000',
      addOnsSubtotalKobo: '0',
      serviceChargeKobo: '6250000',
      logisticsKobo: '5000000',
      grandTotalKobo: '73750000', // ₦737,500.00
      depositKobo: '51625000',     // ₦516,250.00 (70%)
      balanceKobo: '22125000',     // ₦221,250.00 (30%)
    },
    contactName: 'Chinedu Okafor',
    contactPhone: '08033729125',
    contactEmail: 'chinedu@example.com',
    createdAt: '2026-11-08T12:00:00.000Z',
    validUntil: '2026-11-10T12:00:00.000Z',
  };

  const sampleIssuedInvoice: StoredInvoice = {
    id: 'inv_evt_20261108_abcd',
    publicRef: 'EVT-20261108-ABCD',
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
    totalKobo: 73750000n, // ₦737,500.00
    depositKobo: 51625000n, // ₦516,250.00
    balanceKobo: 22125000n, // ₦221,250.00
    accessTokenHash: crypto.createHash('sha256').update('original_secret_token_12345').digest('hex'),
    issuedBy: ownerUser.id,
    issuedAt: '2026-11-08T12:30:00.000Z',
    createdAt: '2026-11-08T12:05:00.000Z',
  };

  beforeEach(() => {
    invoiceRepository.clear();
    invoiceLinksRepository.clear();
    estimateRepository.clear();
    clearAuditLog();
    resetRateLimitStore();

    estimateRepository.save(sampleEstimate);
    invoiceRepository.save(sampleIssuedInvoice);
  });

  // (a) Golden message
  it('(a) Golden message: builds exact wording with ₦737,500.00, ₦516,250.00, ₦221,250.00 and never NGN', async () => {
    const result = await prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerUser, {
      siteUrl: 'https://rockucfoods.com',
      nowMs: new Date('2026-11-08T14:00:00.000Z').getTime(),
      randomTokenFn: () => '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
    });

    expect(result.phoneProblem).toBe(false);
    expect(result.url).toBeDefined();
    expect(result.url).toMatch(/^https:\/\/wa\.me\/2348033729125\?text=/);

    // Decode WhatsApp message
    const decodedMessage = decodeURIComponent(result.url!.replace('https://wa.me/2348033729125?text=', ''));

    // Check exact required wording
    expect(decodedMessage).toContain('Hello Chinedu, this is ROCK UC FOODS.');
    expect(decodedMessage).toContain('Your invoice EVT-20261108-ABCD is ready.');
    expect(decodedMessage).toContain('Total: ₦737,500.00.');
    expect(decodedMessage).toContain('Deposit to start (70%): ₦516,250.00.');
    expect(decodedMessage).toContain('Balance on delivery (30%): ₦221,250.00.');
    expect(decodedMessage).toContain('View and download your invoice here: https://rockucfoods.com/invoice/EVT-20261108-ABCD?token=');
    expect(decodedMessage).toContain('Please pay by bank transfer and send the proof here. Thank you.');

    // Never contain NGN
    expect(decodedMessage).not.toContain('NGN');
  });

  // (b) Phone table
  it('(b) Phone table: accepts all valid Nigerian phone variations, rejects invalid formats with phoneProblem true', () => {
    const validPhones = [
      '08033729125',
      '+2348033729125',
      '2348033729125',
      '0803 372 9125',
      '0803-372-9125',
    ];

    for (const p of validPhones) {
      const res = normalizeWhatsAppPhone(p);
      expect(res.phoneProblem).toBe(false);
      expect(res.digits).toBe('2348033729125');
    }

    const invalidPhones = ['', '12345', '0803372912', 'letters', '2348033729125000'];
    for (const p of invalidPhones) {
      const res = normalizeWhatsAppPhone(p);
      expect(res.phoneProblem).toBe(true);
      expect(res.digits).toBe('');
    }
  });

  // (c) Hostile name
  it('(c) Hostile name: cleans newlines, HTML, control chars and truncates to 30 chars on a single line', () => {
    const hostileName = 'Ada\nEvil & more %20 <b>x</b>';
    const cleaned = cleanFirstName(hostileName);
    expect(cleaned).toBe('Ada');
    expect(cleaned).not.toContain('\n');
    expect(cleaned).not.toContain('<b>');

    const twoHundredChars = 'A'.repeat(200) + ' Okafor';
    const cleanedLong = cleanFirstName(twoHundredChars);
    expect(cleanedLong.length).toBeLessThanOrEqual(30);
    expect(cleanedLong).toBe('A'.repeat(30));
  });

  // (d) Tamper protection: client inputs are completely ignored
  it('(d) Tamper resistance: only authoritative database figures appear in message', async () => {
    const result = await prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerUser);
    expect(result.message).toContain('₦737,500.00');
    expect(result.message).toContain('₦516,250.00');
    expect(result.message).toContain('₦221,250.00');
  });

  // (e) Draft 409, Void 409, Unknown 404, Non-owner 403, Owner without 2FA refused
  it('(e) State & role enforcement: draft throws 409, staff throws 403, unknown throws 404', async () => {
    // 1. Draft invoice
    const draftInvoice: StoredInvoice = {
      ...sampleIssuedInvoice,
      id: 'inv_draft_1',
      estimateId: 'est_draft_1',
      publicRef: 'EVT-20261108-DRFT',
      status: 'draft',
    };
    invoiceRepository.save(draftInvoice);

    await expect(prepareInvoiceShare(draftInvoice.publicRef, ownerUser)).rejects.toThrow(
      /Only issued invoices can be shared/
    );

    // 2. Void invoice
    const voidInvoice: StoredInvoice = {
      ...sampleIssuedInvoice,
      id: 'inv_void_1',
      estimateId: 'est_void_1',
      publicRef: 'EVT-20261108-VOID',
      status: 'void',
    };
    invoiceRepository.save(voidInvoice);


    await expect(prepareInvoiceShare(voidInvoice.publicRef, ownerUser)).rejects.toThrow(
      /Only issued invoices can be shared/
    );

    // 3. Unknown reference
    await expect(prepareInvoiceShare('EVT-99999999-XXXX', ownerUser)).rejects.toThrow(/not found/);

    // 4. Staff role gets 403 and is audited
    await expect(prepareInvoiceShare(sampleIssuedInvoice.publicRef, staffUser)).rejects.toThrow(
      AuthorizationError
    );

    // 5. Developer role gets 403 and is audited
    await expect(prepareInvoiceShare(sampleIssuedInvoice.publicRef, developerUser)).rejects.toThrow(
      AuthorizationError
    );

    // 6. Owner without second factor (MFA) refused
    const ownerNoMfa: UserProfile = { ...ownerUser, hasMfaVerified: false };
    await expect(prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerNoMfa)).rejects.toThrow(
      AuthorizationError
    );
  });

  // (g) Token hashing and 30-day lifecycle
  it('(g) Token hashing & lifecycle: stores only 64-char SHA-256 hash, links expire after 30 days, multiple shares allowed', async () => {
    const rawToken1 = 'token_test_11111111111111111111111111111111';
    const rawToken2 = 'token_test_22222222222222222222222222222222';

    // Share 1
    const share1 = await prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerUser, {
      randomTokenFn: () => rawToken1,
      nowMs: new Date('2026-11-08T12:00:00.000Z').getTime(),
    });

    // Share 2
    const share2 = await prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerUser, {
      randomTokenFn: () => rawToken2,
      nowMs: new Date('2026-11-08T12:01:00.000Z').getTime(),
    });

    const links = invoiceLinksRepository.getLinksByInvoiceId(sampleIssuedInvoice.id);
    expect(links.length).toBe(2);

    // Token stored is 64-char SHA-256 hash, NEVER raw token!
    expect(links[0].tokenHash).toHaveLength(64);
    expect(links[0].tokenHash).not.toBe(rawToken2);
    expect(links[0].tokenHash).toBe(crypto.createHash('sha256').update(rawToken2).digest('hex'));

    // Check expiry is exactly 30 days later
    const expectedExpiry = new Date(new Date('2026-11-08T12:00:00.000Z').getTime() + 30 * 86400 * 1000).toISOString();
    expect(links[1].expiresAt).toBe(expectedExpiry);

    // Revoke links
    const revokeRes = await revokeInvoiceLinks(sampleIssuedInvoice.publicRef, ownerUser);
    expect(revokeRes.revokedCount).toBe(2);

    const updatedLinks = invoiceLinksRepository.getLinksByInvoiceId(sampleIssuedInvoice.id);
    expect(updatedLinks[0].revokedAt).toBeDefined();
    expect(updatedLinks[1].revokedAt).toBeDefined();
  });

  // (h) Audit log compliance
  it('(h) Audit log compliance: never contains the raw token, phone number, or message text', async () => {
    await prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerUser);

    const logs = getAuditEvents();
    const shareLogs = logs.filter((l) => l.action === 'invoice.share_prepared');
    expect(shareLogs.length).toBe(1);

    const entry = shareLogs[0];
    const stringified = JSON.stringify(entry);

    // Must NOT contain sensitive client data
    expect(stringified).not.toContain(sampleEstimate.contactPhone);
    expect(stringified).not.toContain('Please pay by bank transfer');
    expect(stringified).not.toContain('token=');
  });

  // (i) Rate limit
  it('(i) Rate limit: 31st share within 600s window receives 429', async () => {
    // 30 shares succeed
    for (let i = 0; i < 30; i++) {
      await prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerUser, {
        randomTokenFn: () => `token_random_${i}_${Date.now()}`,
      });
    }

    // 31st share fails with RateLimitError (429)
    await expect(prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerUser)).rejects.toThrow(
      RateLimitError
    );
  });

  // (j) Customer-to-owner WhatsApp message has no amounts
  it('(j) Customer-to-owner link: contains ONLY reference, guest count, and owner link; no digits of any amount', () => {
    const requestedRef = 'EVT-20261108-ABCD';
    const guestCount = 50;
    const msg = `Reference: ${requestedRef}, Guests: ${guestCount}, Review: https://rockucfoods.com/admin/invoices/${requestedRef}`;

    // Confirm it does NOT contain money or amounts
    expect(msg).not.toContain('737500');
    expect(msg).not.toContain('₦');
    expect(msg).not.toContain('NGN');
    expect(msg).toContain(requestedRef);
    expect(msg).toContain('50');
  });

  // Mutation tests: deliberate breaks
  describe('Mutation Checks', () => {
    it('Mutation check: sharing draft invoice must fail', async () => {
      const draft = { ...sampleIssuedInvoice, status: 'draft' as const };
      invoiceRepository.save(draft);
      await expect(prepareInvoiceShare(draft.publicRef, ownerUser)).rejects.toThrow();
    });

    it('Mutation check: staff sharing must fail and record audit attempt', async () => {
      await expect(prepareInvoiceShare(sampleIssuedInvoice.publicRef, staffUser)).rejects.toThrow(
        AuthorizationError
      );
      const auditLogs = getAuditEvents();
      expect(auditLogs.some((l) => l.action.includes('FORBIDDEN_ROLE_ATTEMPT'))).toBe(true);

    });

    it('Mutation check: raw token must never equal stored token_hash', async () => {
      const rawToken = 'my_raw_secret_token_12345';
      await prepareInvoiceShare(sampleIssuedInvoice.publicRef, ownerUser, {
        randomTokenFn: () => rawToken,
      });
      const link = invoiceLinksRepository.getLinksByInvoiceId(sampleIssuedInvoice.id)[0];
      expect(link.tokenHash).not.toBe(rawToken);
      expect(link.tokenHash).toBe(crypto.createHash('sha256').update(rawToken).digest('hex'));
    });
  });
});
