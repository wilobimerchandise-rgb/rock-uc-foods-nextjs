/**
 * ROCK UC FOODS - Phase 1G: Owner sends issued invoice on WhatsApp in one tap
 * Playbook v2 Section 29
 * 
 * Rules:
 * - Owner only with second-factor rule (staff and developer get 403 and attempt is audited).
 * - Same-site POST only.
 * - Rate limit: 30 per 600 seconds per user, key share:user:<id>, fails closed (429).
 * - Look up invoice by public_ref. 404 if not found. 409 if not issued (draft or void).
 * - Mint a NEW 32-byte random token, store ONLY its SHA-256 hash in invoice_links with expires_at = now + 30 days.
 * - Build the link: SITE_URL/invoice/<ref>?token=<token>. The raw token appears only in this response, never in logs or audit.
 * - Fixed message wording with formatKobo (₦, never NGN) and percentages.
 * - Safe first name: first word, control characters stripped, at most 30 characters.
 * - Phone: Nigerian E.164 digits format (234 followed by 10 digits). If missing/invalid, return message without wa.me URL and phoneProblem: true.
 * - Audit invoice.share_prepared with public_ref and owner id only (no phone, no token, no message).
 * - Revoke route sets revoked_at and audits invoice.links_revoked.
 */

import crypto from 'crypto';
import { StoredInvoice, StoredInvoiceLink, InvoiceSharePayload } from './types';
import { invoiceRepository, invoiceLinksRepository, estimateRepository } from './repository';
import { requireRole, UserProfile } from '../lib/auth/access';
import { formatNaira } from '../lib/money';
import { checkRateLimit, RateLimitError } from '../lib/rate-limit';
import { recordAudit } from '../lib/audit';

export interface PrepareShareDeps {
  siteUrl?: string;
  nowMs?: number;
  randomTokenFn?: () => string;
}

/**
 * Extracts and cleans the first name for the WhatsApp greeting.
 * Strips newlines, control characters, HTML tags, and truncates to 30 characters.
 */
export function cleanFirstName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return 'Valued Client';

  // 1. Strip HTML tags
  let cleaned = rawName.replace(/<[^>]*>/g, ' ');

  // 2. Normalize whitespace, remove control characters & newlines
  cleaned = cleaned.replace(/[\r\n\t\0-\x1F\x7F]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (!cleaned) return 'Valued Client';

  // 3. Take the first word
  const firstWord = cleaned.split(' ')[0] || 'Valued Client';

  // 4. Cap at 30 characters
  return firstWord.slice(0, 30);
}

/**
 * Normalizes phone number for WhatsApp deep link.
 * Requires exactly 234 followed by 10 digits (13 digits total).
 * Accepts: '08033729125', '+2348033729125', '2348033729125', '0803 372 9125', '0803-372-9125'.
 * Rejects: '', '12345', '0803372912' (9 digits), letters, 14-digit numbers.
 */
export function normalizeWhatsAppPhone(rawPhone?: string | null): { digits: string; phoneProblem: boolean } {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { digits: '', phoneProblem: true };
  }

  // Strip spaces, dashes, parens, plus
  const cleaned = rawPhone.replace(/[\s\-()+]/g, '');

  // Check if string contains any non-digit character
  if (!/^\d+$/.test(cleaned)) {
    return { digits: '', phoneProblem: true };
  }

  let digits = cleaned;
  if (digits.startsWith('234')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  } else {
    return { digits: '', phoneProblem: true };
  }

  // Nigerian phone numbers must have exactly 10 digits after prefix
  if (!/^\d{10}$/.test(digits)) {
    return { digits: '', phoneProblem: true };
  }

  return {
    digits: `234${digits}`,
    phoneProblem: false,
  };
}

/**
 * Builds the exact WhatsApp share message required by Playbook v2 Section 29.
 */
export function buildShareMessage(params: {
  firstName: string;
  publicRef: string;
  totalKobo: bigint;
  depositKobo: bigint;
  balanceKobo: bigint;
  invoiceLink: string;
  depositPercent?: number;
  balancePercent?: number;
}): string {
  const {
    firstName,
    publicRef,
    totalKobo,
    depositKobo,
    balanceKobo,
    invoiceLink,
    depositPercent = 70,
    balancePercent = 30,
  } = params;

  const totalFormatted = formatNaira(totalKobo);
  const depositFormatted = formatNaira(depositKobo);
  const balanceFormatted = formatNaira(balanceKobo);

  return (
    `Hello ${firstName}, this is ROCK UC FOODS. Your invoice ${publicRef} is ready. ` +
    `Total: ${totalFormatted}. Deposit to start (${depositPercent}%): ${depositFormatted}. ` +
    `Balance on delivery (${balancePercent}%): ${balanceFormatted}. ` +
    `View and download your invoice here: ${invoiceLink}. ` +
    `Please pay by bank transfer and send the proof here. Thank you.`
  );
}

/**
 * Prepares an issued invoice for 1-tap WhatsApp sharing.
 */
export async function prepareInvoiceShare(
  publicRef: string,
  actor: UserProfile,
  deps: PrepareShareDeps = {}
): Promise<InvoiceSharePayload> {
  const {
    siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://rockucfoods.com',
    nowMs = Date.now(),
    randomTokenFn = () => crypto.randomBytes(32).toString('hex'),
  } = deps;

  // 1. Authorize: Owner only with Second-Factor Rule (Staff & Developer get 403 and are audited)
  requireRole(['owner'], actor, 'share invoice on WhatsApp', publicRef, {
    requireSecondFactor: true,
  });

  // 2. Rate limit: 30 per 600s per user, key share:user:<id>, fails closed (429)
  try {
    const rateKey = `share:user:${actor.id}`;
    const rateCheck = checkRateLimit(rateKey, 30, 600 * 1000);
    if (!rateCheck.allowed) {
      throw new RateLimitError('Rate limit exceeded. Maximum 30 shares per 10 minutes.');
    }
  } catch (err: unknown) {
    if (err instanceof RateLimitError) throw err;
    throw new RateLimitError('Rate limiter unavailable. Share request rejected.');
  }

  // 3. Look up invoice by publicRef
  const invoice = invoiceRepository.getByPublicRef(publicRef);
  if (!invoice) {
    const notFoundErr = new Error(`Invoice '${publicRef}' not found.`);
    (notFoundErr as any).statusCode = 404;
    throw notFoundErr;
  }

  // 4. Status check: Must be issued (draft or void throws 409)
  if (invoice.status !== 'issued') {
    const conflictErr = new Error(
      `Invoice '${publicRef}' is in '${invoice.status}' status. Only issued invoices can be shared.`
    );
    (conflictErr as any).statusCode = 409;
    throw conflictErr;
  }

  // 5. Mint a NEW 32-byte random token and SHA-256 hash
  const rawToken = randomTokenFn();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // 30 days expiration (2,592,000 seconds)
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(nowMs + THIRTY_DAYS_MS).toISOString();

  // 6. Save link in repository (store ONLY token_hash!)
  const linkId = crypto.randomUUID ? crypto.randomUUID() : `link_${Date.now()}`;
  const storedLink: StoredInvoiceLink = {
    id: linkId,
    invoiceId: invoice.id,
    tokenHash,
    createdBy: actor.id,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt,
  };
  invoiceLinksRepository.createLink(storedLink);

  // 7. Retrieve contact information from estimate
  const estimate = estimateRepository.getById(invoice.estimateId);
  const contactName = estimate?.contactName || 'Valued Client';
  const firstName = cleanFirstName(contactName);

  // 8. Build public link (raw token returned ONLY to client, never logged or stored)
  const cleanBaseUrl = siteUrl.replace(/\/+$/, '');
  const invoiceLink = `${cleanBaseUrl}/invoice/${encodeURIComponent(publicRef)}?token=${encodeURIComponent(rawToken)}`;

  // 9. Build message
  const message = buildShareMessage({
    firstName,
    publicRef,
    totalKobo: invoice.totalKobo,
    depositKobo: invoice.depositKobo,
    balanceKobo: invoice.balanceKobo,
    invoiceLink,
  });

  // 10. Phone normalization
  const phoneResult = normalizeWhatsAppPhone(estimate?.contactPhone);

  let waUrl: string | undefined = undefined;
  if (!phoneResult.phoneProblem && phoneResult.digits) {
    const candidateUrl = `https://wa.me/${phoneResult.digits}?text=${encodeURIComponent(message)}`;
    if (candidateUrl.length > 1800) {
      throw new Error(`Generated WhatsApp share URL exceeds maximum length of 1800 characters (${candidateUrl.length}).`);
    }
    waUrl = candidateUrl;
  }

  // 11. Audit: invoice.share_prepared with public_ref and owner id only (NO phone, NO token, NO message!)
  recordAudit({
    action: 'invoice.share_prepared',
    entity: 'invoice',
    entityId: invoice.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      publicRef: invoice.publicRef,
      hasPhone: !phoneResult.phoneProblem,
    },
  });

  return {
    url: waUrl,
    message,
    phoneProblem: phoneResult.phoneProblem,
    expiresAt,
  };
}

/**
 * Revokes all share links for an invoice (owner only).
 */
export async function revokeInvoiceLinks(
  publicRef: string,
  actor: UserProfile,
  deps: { nowIso?: string } = {}
): Promise<{ revokedCount: number }> {
  const { nowIso = new Date().toISOString() } = deps;

  // 1. Authorize: Owner only with Second-Factor Rule
  requireRole(['owner'], actor, 'revoke invoice share links', publicRef, {
    requireSecondFactor: true,
  });

  const invoice = invoiceRepository.getByPublicRef(publicRef);
  if (!invoice) {
    const err = new Error(`Invoice '${publicRef}' not found.`);
    (err as any).statusCode = 404;
    throw err;
  }

  const revokedCount = invoiceLinksRepository.revokeLinksByInvoiceId(invoice.id, nowIso);

  // Audit
  recordAudit({
    action: 'invoice.links_revoked',
    entity: 'invoice',
    entityId: invoice.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      publicRef: invoice.publicRef,
      revokedCount,
    },
  });

  return { revokedCount };
}
