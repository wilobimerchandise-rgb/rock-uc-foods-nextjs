/**
 * ROCK UC FOODS - Invoice Owner Review & Issuance (Phase 1D)
 * 
 * Rules:
 * - Owner only with second-factor rule.
 * - Developer & Staff roles get 403, and each attempt is audited.
 * - Refuse if not a draft.
 * - Mark issued with issued_by and issued_at.
 * - Audit invoice.issued.
 * - Void: owner only with second-factor, reason required, never deletes, audit invoice.voided.
 */

import { StoredInvoice } from './types';
import { invoiceRepository } from './repository';
import { requireRole, UserProfile } from '../lib/auth/access';
import { recordAudit } from '../lib/audit';

export function issueInvoice(
  invoiceId: string,
  actor: UserProfile,
  deps: { nowIso?: string } = {}
): StoredInvoice {
  const { nowIso = new Date().toISOString() } = deps;

  // 1. Authorize: Owner only with Second-Factor Rule (developer & staff get 403 and are audited)
  requireRole(['owner'], actor, 'issue official invoice', invoiceId, {
    requireSecondFactor: true,
  });

  // 2. Load invoice
  const invoice = invoiceRepository.getById(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice '${invoiceId}' not found.`);
  }

  // 3. Status Check: Must be draft
  if (invoice.status !== 'draft') {
    throw new Error(`Cannot issue invoice in '${invoice.status}' status. Only draft invoices can be issued.`);
  }

  // 4. Update status
  invoice.status = 'issued';
  invoice.issuedBy = actor.id;
  invoice.issuedAt = nowIso;
  invoiceRepository.save(invoice);

  // 5. Audit
  recordAudit({
    action: 'invoice.issued',
    entity: 'invoice',
    entityId: invoice.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      publicRef: invoice.publicRef,
      issuedAt: nowIso,
    },
  });

  return invoice;
}

export function voidInvoice(
  invoiceId: string,
  actor: UserProfile,
  reason: string,
  deps: { nowIso?: string } = {}
): StoredInvoice {
  // 1. Authorize: Owner only with Second-Factor Rule
  requireRole(['owner'], actor, 'void invoice', invoiceId, {
    requireSecondFactor: true,
  });

  if (!reason || reason.trim().length < 3) {
    throw new Error('A valid reason (minimum 3 characters) is required to void an invoice.');
  }

  // 2. Load invoice
  const invoice = invoiceRepository.getById(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice '${invoiceId}' not found.`);
  }

  // 3. Void (never delete!)
  invoice.status = 'void';
  invoice.voidReason = reason.trim();
  invoiceRepository.save(invoice);

  // 4. Audit
  recordAudit({
    action: 'invoice.voided',
    entity: 'invoice',
    entityId: invoice.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      publicRef: invoice.publicRef,
      reason: reason.trim(),
    },
  });

  return invoice;
}
