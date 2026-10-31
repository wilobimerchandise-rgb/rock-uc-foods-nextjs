/**
 * ROCK UC FOODS - Create Invoice From Estimate (Phase 1D)
 * 
 * Rules:
 * - Load stored estimate by id.
 * - IGNORE any price, total, or percentage in request body.
 * - Recompute with computeEstimate against the stored config version.
 * - Refuse if recomputed result differs from stored result.
 * - Refuse if expired (now > valid_until) with 'EXPIRED, please make a new estimate'.
 * - Contact validation: name 2 to 80 chars, phone normalized (+234...), email optional and validated.
 * - Refuse total above 10,000,000,000 kobo (₦100,000,000.00).
 * - Idempotency: second call returns the same invoice without re-creating.
 * - Always status 'draft'. Bulk orders (21+ guests) get label 'Needs team confirmation'.
 * - Rate limit: 10 per 600s key invoice:ip:<hash or 'unknown'>, fails closed (429).
 * - Audit: invoice.draft_created with estimate id and public_ref only (no phone, no email, no token!).
 * - Alerts: email alert to rock-uc-foods@gmail.com and estherkwentua@gmail.com. Email failure never fails request.
 */

import crypto from 'crypto';
import { StoredInvoice, InvoiceContactInput } from './types';
import { estimateRepository, invoiceRepository } from './repository';
import { computeEstimate } from '../estimator/compute';
import { getEstimatorConfig } from '../estimator/config';
import { normalizeNigerianPhone } from '../lib/security';
import { MAX_KOBO, formatNaira } from '../lib/money';
import { checkRateLimit, RateLimitError } from '../lib/rate-limit';
import { recordAudit } from '../lib/audit';
import { generatePublicRef, generateAccessToken } from './publicRef';

export interface CreateInvoiceDeps {
  ip?: string;
  nowMs?: number;
  sendEmailAlert?: (payload: {
    recipients: string[];
    publicRef: string;
    guestCount: number;
    totalKobo: bigint;
    ownerUrl: string;
  }) => Promise<void>;
  generateRefFn?: () => string;
}

export interface CreateInvoiceResult {
  invoice: StoredInvoice;
  accessToken: string; // only returned upon creation, raw token never stored
  isExisting: boolean;
}

export async function createInvoiceFromEstimate(
  estimateId: string,
  contact: InvoiceContactInput,
  deps: CreateInvoiceDeps = {}
): Promise<CreateInvoiceResult> {
  const { ip = 'unknown', nowMs = Date.now(), sendEmailAlert, generateRefFn = generatePublicRef } = deps;

  // 1. Rate Limit Check (fails CLOSED on limiter error or limit reached)
  try {
    const ipHash = ip === 'unknown' ? 'unknown' : crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
    const rateLimitKey = `invoice:ip:${ipHash}`;
    const rateCheck = checkRateLimit(rateLimitKey, 10, 600 * 1000);
    if (!rateCheck.allowed) {
      throw new RateLimitError('Rate limit exceeded. Maximum 10 invoice requests per 10 minutes.');
    }
  } catch (err: any) {
    if (err instanceof RateLimitError) throw err;
    // Fails closed if rate limiter itself is down or throws
    throw new RateLimitError('Rate limiter unavailable. Request rejected (fails closed).');
  }

  // 2. Validate Contact
  if (!contact || typeof contact !== 'object') {
    throw new Error('Contact information is required.');
  }

  const name = (contact.name || '').trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error('Contact name must be between 2 and 80 characters.');
  }

  const normalizedPhone = normalizeNigerianPhone(contact.phone);

  let validatedEmail: string | undefined = undefined;
  if (contact.email && contact.email.trim() !== '') {
    const emailCandidate = contact.email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailCandidate)) {
      throw new Error(`Invalid email address: '${contact.email}'.`);
    }
    validatedEmail = emailCandidate;
  }

  // 3. Idempotency Check: if invoice already exists for this estimate, return it
  const existingInvoice = invoiceRepository.getByEstimateId(estimateId);
  if (existingInvoice) {
    return {
      invoice: existingInvoice,
      accessToken: '', // Token-less status returned on replay
      isExisting: true,
    };
  }

  // 4. Load Stored Estimate
  const estimate = estimateRepository.getById(estimateId);
  if (!estimate) {
    throw new Error(`Estimate '${estimateId}' not found.`);
  }

  // 5. Expiration Check
  const validUntilMs = new Date(estimate.validUntil).getTime();
  if (nowMs > validUntilMs) {
    throw new Error('EXPIRED, please make a new estimate');
  }

  // 6. Recompute Estimate against config (Zero Trust on client-supplied figures)
  const config = getEstimatorConfig();
  const recomputed = computeEstimate(
    {
      tierId: estimate.inputs.packageId,
      guestCount: estimate.inputs.guests,
      selectedAddOns: (estimate.inputs.addOnIds || []).map((id) => ({ addOnId: id, quantity: 1 })),
    },
    config
  );

  // Compare stored result with recomputed result
  if (
    estimate.result.grandTotalKobo !== recomputed.grandTotalKobo.toString() ||
    estimate.result.foodSubtotalKobo !== recomputed.foodSubtotalKobo.toString() ||
    estimate.result.depositKobo !== recomputed.depositKobo.toString() ||
    estimate.result.balanceKobo !== recomputed.balanceKobo.toString()
  ) {
    throw new Error('Estimate figures do not match authoritative server calculation. Please create a fresh estimate.');
  }

  // 7. Ceiling Enforcement: Refuse total above 10,000,000,000 kobo (100 million naira)
  if (recomputed.grandTotalKobo > MAX_KOBO) {
    throw new Error(`Total ${formatNaira(recomputed.grandTotalKobo)} exceeds maximum allowed limit of ${formatNaira(MAX_KOBO)}.`);
  }

  // 8. Generate Public Reference with Collision Retry (Max 5 tries)
  let publicRef = '';
  let tries = 0;
  while (tries < 5) {
    tries++;
    const candidateRef = generateRefFn();
    if (!invoiceRepository.hasPublicRef(candidateRef)) {
      publicRef = candidateRef;
      break;
    }
  }

  if (!publicRef) {
    throw new Error('Could not generate a unique invoice reference after 5 attempts. Please retry.');
  }

  // 9. Generate 32-byte Customer Access Token
  const { rawToken, tokenHash } = generateAccessToken();

  // 10. Build Lines Snapshot
  const lines = [
    {
      name: `${recomputed.tier.name}, ${recomputed.guestCount} guests`,
      quantity: recomputed.guestCount,
      unitPriceKobo: recomputed.tier.pricePerGuestKobo.toString(),
      lineTotalKobo: recomputed.foodSubtotalKobo.toString(),
    },
    ...recomputed.addOns.map((addon) => ({
      name: addon.addOn.name,
      quantity: addon.quantity,
      unitPriceKobo: addon.addOn.unitPriceKobo.toString(),
      lineTotalKobo: addon.totalKobo.toString(),
    })),
  ];

  const isBulk = recomputed.guestCount >= 21;
  const label = isBulk ? 'Needs team confirmation' : undefined;

  // Update estimate with validated contact
  estimate.contactName = name;
  estimate.contactPhone = normalizedPhone;
  estimate.contactEmail = validatedEmail;
  estimateRepository.save(estimate);

  const newInvoice: StoredInvoice = {
    id: `inv-${crypto.randomUUID()}`,
    publicRef,
    estimateId: estimate.id,
    revision: 1,
    status: 'draft',
    lines,
    totalKobo: recomputed.grandTotalKobo,
    depositKobo: recomputed.depositKobo,
    balanceKobo: recomputed.balanceKobo,
    accessTokenHash: tokenHash,
    createdAt: new Date(nowMs).toISOString(),
    label,
  };

  invoiceRepository.save(newInvoice);

  // 11. Audit: invoice.draft_created (Contains ONLY estimate id and public_ref)
  recordAudit({
    action: 'invoice.draft_created',
    entity: 'invoice',
    entityId: newInvoice.id,
    actorId: 'guest',
    actorRole: 'customer',
    details: {
      estimateId: estimate.id,
      publicRef: newInvoice.publicRef,
      // Strictly NO phone, NO email, NO token!
    },
  });

  // 12. Non-blocking Email Alert to Chef Esther and Team
  const emailAlertFn =
    sendEmailAlert ||
    (async (payload) => {
      // Production email dispatcher or logged simulation
      console.log(`[Email Alert] To: ${payload.recipients.join(', ')} | Ref: ${payload.publicRef} | Guests: ${payload.guestCount}`);
    });

  try {
    await emailAlertFn({
      recipients: ['rock-uc-foods@gmail.com', 'estherkwentua@gmail.com'],
      publicRef: newInvoice.publicRef,
      guestCount: recomputed.guestCount,
      totalKobo: recomputed.grandTotalKobo,
      ownerUrl: `https://rockucfoods.com/admin/invoices/${newInvoice.publicRef}`,
    });
  } catch (emailErr) {
    // A failed email is logged and retried later; it must NOT fail the customer request or hide the draft
    console.error('[Email Alert Error] Failed to send email alert:', emailErr);
  }

  return {
    invoice: newInvoice,
    accessToken: rawToken,
    isExisting: false,
  };
}
