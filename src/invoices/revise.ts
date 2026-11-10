/**
 * ROCK UC FOODS - Invoice Revision & Amendment Engine (Phase 1D)
 * (Playbook v2 Section 10 & Section 24)
 * 
 * Rules:
 * - An issued invoice is immutable: a material change creates a new version (revision + 1)
 *   with an explicit reason, archiving the previous version as superseded.
 * - Owner only with second-factor rule (Staff and developer roles receive 403 and are audited).
 * - Reason required (minimum 3 non-whitespace characters).
 * - Validates input parameters through server-side computeEstimate. Never trusts client totals.
 * - Enforces BigInt kobo precision and deposit/balance reconciliation identity.
 */

import crypto from 'crypto';
import { StoredInvoice, InvoiceRevisionInput, InvoiceLineItem, InvoiceVersionRecord } from './types';
import { invoiceRepository, invoiceVersionsRepository, invoiceLinksRepository, estimateRepository } from './repository';
import { computeEstimate } from '../estimator/compute';
import { getEstimatorConfig } from '../estimator/config';
import { EstimatorConfig } from '../estimator/types';
import { requireRole, UserProfile } from '../lib/auth/access';
import { recordAudit } from '../lib/audit';
import { generateAccessToken } from './publicRef';

export function reviseInvoice(
  invoiceIdOrRef: string,
  input: InvoiceRevisionInput,
  actor: UserProfile,
  deps: { nowIso?: string; config?: EstimatorConfig } = {}
): { invoice: StoredInvoice; versionRecord: InvoiceVersionRecord } {
  const { nowIso = new Date().toISOString(), config = getEstimatorConfig() } = deps;

  // 1. Authorize: Owner only with Second-Factor Rule
  requireRole(['owner'], actor, 'revise official invoice', invoiceIdOrRef, {
    requireSecondFactor: true,
  });

  // 2. Reason validation
  if (!input.reason || input.reason.trim().length < 3) {
    throw new Error('A clear revision reason (minimum 3 characters) is required to revise an issued invoice.');
  }

  // 3. Load invoice (by ID or publicRef)
  let invoice = invoiceRepository.getById(invoiceIdOrRef);
  if (!invoice) {
    invoice = invoiceRepository.getByPublicRef(invoiceIdOrRef);
  }
  if (!invoice) {
    throw new Error(`Invoice '${invoiceIdOrRef}' not found.`);
  }

  // 4. Status Check: Only issued invoices can be revised into Rev N+1
  if (invoice.status !== 'issued') {
    throw new Error(`Cannot revise invoice in '${invoice.status}' status. Only issued invoices can be revised.`);
  }

  // 5. Input Validation
  const guests = Number(input.inputs.guests);
  if (!Number.isInteger(guests) || guests < 1) {
    throw new Error('Guest count must be a positive integer.');
  }

  // 6. Server-Side Recomputation against current estimator config
  const estimateResult = computeEstimate(
    {
      tierId: input.inputs.packageId,
      guestCount: guests,
      selectedAddOns: (input.inputs.addOnIds || []).map((id) => ({ addOnId: id, quantity: 1 })),
    },
    config
  );

  // Maximum cap check (100 million Naira = 10,000,000,000 kobo)
  if (estimateResult.grandTotalKobo > 10000000000n) {
    throw new Error('Total invoice amount exceeds maximum allowed ceiling (₦100,000,000.00).');
  }

  // 7. Build new line items
  const selectedTier = config.tiers.find((t) => t.id === input.inputs.packageId);
  const tierName = selectedTier ? selectedTier.name : 'Custom Catering Package';

  const newLines: InvoiceLineItem[] = [
    {
      name: `${tierName}, ${guests} guests`,
      quantity: guests,
      unitPriceKobo: selectedTier ? selectedTier.pricePerGuestKobo.toString() : '0',
      lineTotalKobo: estimateResult.foodSubtotalKobo.toString(),
    },
    ...estimateResult.addOns.map((addon) => ({
      name: addon.addOn.name,
      quantity: addon.quantity,
      unitPriceKobo: addon.addOn.unitPriceKobo.toString(),
      lineTotalKobo: addon.totalKobo.toString(),
    })),
  ];

  if (estimateResult.serviceChargeKobo > 0n) {
    newLines.push({
      name: 'Service Charge (10%)',
      quantity: 1,
      unitPriceKobo: estimateResult.serviceChargeKobo.toString(),
      lineTotalKobo: estimateResult.serviceChargeKobo.toString(),
    });
  }

  if (estimateResult.logisticsKobo > 0n) {
    newLines.push({
      name: 'Logistics and Delivery',
      quantity: 1,
      unitPriceKobo: estimateResult.logisticsKobo.toString(),
      lineTotalKobo: estimateResult.logisticsKobo.toString(),
    });
  }

  // 8. Archive Current Snapshot as Immutable Version Record
  const versionRecord: InvoiceVersionRecord = {
    id: crypto.randomUUID(),
    invoiceId: invoice.id,
    revision: invoice.revision,
    publicRef: invoice.publicRef,
    snapshot: { ...invoice, lines: [...invoice.lines] },
    reason: input.reason.trim(),
    changedBy: actor.id,
    changedAt: nowIso,
  };
  invoiceVersionsRepository.saveVersion(versionRecord);

  // 9. Update Invoice to Revision + 1
  const previousRevision = invoice.revision;
  const newRevision = previousRevision + 1;

  invoice.revision = newRevision;
  invoice.lines = newLines;
  invoice.totalKobo = estimateResult.grandTotalKobo;
  invoice.depositKobo = estimateResult.depositKobo;
  invoice.balanceKobo = estimateResult.balanceKobo;
  invoice.revisedBy = actor.id;
  invoice.revisedAt = nowIso;
  invoice.revisionReason = input.reason.trim();
  invoice.label = guests >= 21 ? 'Needs team confirmation' : undefined;

  // Mint new access token hash for new revision
  const { tokenHash } = generateAccessToken();
  invoice.accessTokenHash = tokenHash;

  // Revoke existing share links for old revision so new 30-day link must be shared
  invoiceLinksRepository.revokeLinksByInvoiceId(invoice.id, nowIso);

  // Also update stored estimate inputs if present
  const estimate = estimateRepository.getById(invoice.estimateId);
  if (estimate) {
    estimate.inputs = {
      packageId: input.inputs.packageId,
      guests,
      zoneId: input.inputs.zoneId,
      addOnIds: input.inputs.addOnIds,
    };
    estimate.result = {
      foodSubtotalKobo: estimateResult.foodSubtotalKobo.toString(),
      addOnsSubtotalKobo: estimateResult.addOnsSubtotalKobo.toString(),
      serviceChargeKobo: estimateResult.serviceChargeKobo.toString(),
      logisticsKobo: estimateResult.logisticsKobo.toString(),
      grandTotalKobo: estimateResult.grandTotalKobo.toString(),
      depositKobo: estimateResult.depositKobo.toString(),
      balanceKobo: estimateResult.balanceKobo.toString(),
    };
    estimateRepository.save(estimate);
  }

  // Persist updated invoice
  invoiceRepository.save(invoice);

  // 10. Audit Record
  recordAudit({
    action: 'invoice.revised',
    entity: 'invoice',
    entityId: invoice.id,
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      publicRef: invoice.publicRef,
      revision: newRevision,
      previousRevision,
      reason: input.reason.trim(),
      totalKobo: invoice.totalKobo.toString(),
      depositKobo: invoice.depositKobo.toString(),
      balanceKobo: invoice.balanceKobo.toString(),
    },
  });

  return { invoice, versionRecord };
}
