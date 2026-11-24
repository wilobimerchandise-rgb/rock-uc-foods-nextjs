/**
 * ROCK UC FOODS - Nightly Invoice Self-Check
 * Playbook v2 Section 31.6 ("Nightly self-check: recompute saved invoices against saved prices")
 *
 * Recomputes active (draft and issued) catering invoices against authoritative
 * estimator configuration and reports any kobo discrepancy without mutating historical data.
 */

import { invoiceRepository, estimateRepository } from './repository';
import { computeEstimate } from '../estimator/compute';
import { getEstimatorConfig } from '../estimator/config';
import { EstimatorConfig } from '../estimator/types';
import { recordAudit } from '../lib/audit';
import { logError, logInfo } from '../lib/logger';

export interface InvoiceMismatch {
  invoiceId: string;
  publicRef: string;
  reason: string;
  savedTotalKobo: string;
  expectedTotalKobo: string;
  savedDepositKobo: string;
  expectedDepositKobo: string;
  savedBalanceKobo: string;
  expectedBalanceKobo: string;
}

export interface NightlySelfCheckReport {
  executedAt: string;
  passed: boolean;
  checkedCount: number;
  skippedCount: number;
  mismatches: InvoiceMismatch[];
}

export function runNightlyInvoiceSelfCheck(
  deps: {
    nowMs?: number;
    getConfigForVersion?: (configVersion: number) => EstimatorConfig;
    onMismatchDetected?: (report: NightlySelfCheckReport) => void;
  } = {}
): NightlySelfCheckReport {
  const {
    nowMs = Date.now(),
    getConfigForVersion = () => getEstimatorConfig(),
    onMismatchDetected,
  } = deps;

  const executedAt = new Date(nowMs).toISOString();
  const invoices = invoiceRepository.getAll({ autoExpireDrafts: false });

  let checkedCount = 0;
  let skippedCount = 0;
  const mismatches: InvoiceMismatch[] = [];

  for (const inv of invoices) {
    if (inv.status === 'void' || inv.status === 'superseded') {
      skippedCount += 1;
      continue;
    }

    checkedCount += 1;

    // 1. Fundamental deposit + balance split invariant
    if (inv.depositKobo + inv.balanceKobo !== inv.totalKobo) {
      mismatches.push({
        invoiceId: inv.id,
        publicRef: inv.publicRef,
        reason: '70/30 deposit + balance does not equal totalKobo',
        savedTotalKobo: inv.totalKobo.toString(),
        expectedTotalKobo: inv.totalKobo.toString(),
        savedDepositKobo: inv.depositKobo.toString(),
        expectedDepositKobo: (inv.totalKobo - inv.balanceKobo).toString(),
        savedBalanceKobo: inv.balanceKobo.toString(),
        expectedBalanceKobo: inv.balanceKobo.toString(),
      });
      continue;
    }

    // 2. Recompute against saved estimate inputs & estimator price matrix
    const estimate = estimateRepository.getById(inv.estimateId);
    if (!estimate) {
      mismatches.push({
        invoiceId: inv.id,
        publicRef: inv.publicRef,
        reason: `Orphaned invoice: estimate '${inv.estimateId}' not found`,
        savedTotalKobo: inv.totalKobo.toString(),
        expectedTotalKobo: '0',
        savedDepositKobo: inv.depositKobo.toString(),
        expectedDepositKobo: '0',
        savedBalanceKobo: inv.balanceKobo.toString(),
        expectedBalanceKobo: '0',
      });
      continue;
    }

    const config = getConfigForVersion(estimate.configVersion);
    const recomputed = computeEstimate(
      {
        tierId: estimate.inputs.packageId,
        guestCount: estimate.inputs.guests,
        selectedAddOns: (estimate.inputs.addOnIds || []).map((id) => ({ addOnId: id, quantity: 1 })),
      },
      config
    );

    if (
      recomputed.grandTotalKobo !== inv.totalKobo ||
      recomputed.depositKobo !== inv.depositKobo ||
      recomputed.balanceKobo !== inv.balanceKobo
    ) {
      mismatches.push({
        invoiceId: inv.id,
        publicRef: inv.publicRef,
        reason: 'Saved invoice totals differ from authoritative price matrix calculation',
        savedTotalKobo: inv.totalKobo.toString(),
        expectedTotalKobo: recomputed.grandTotalKobo.toString(),
        savedDepositKobo: inv.depositKobo.toString(),
        expectedDepositKobo: recomputed.depositKobo.toString(),
        savedBalanceKobo: inv.balanceKobo.toString(),
        expectedBalanceKobo: recomputed.balanceKobo.toString(),
      });
    }
  }

  const report: NightlySelfCheckReport = {
    executedAt,
    passed: mismatches.length === 0,
    checkedCount,
    skippedCount,
    mismatches,
  };

  recordAudit({
    action: 'ops.nightly_self_check',
    entity: 'invoice_ledger',
    entityId: executedAt.slice(0, 10),
    actorId: 'system',
    actorRole: 'system',
    details: {
      passed: report.passed,
      checkedCount,
      skippedCount,
      mismatchCount: mismatches.length,
      mismatchRefs: mismatches.map((m) => m.publicRef),
    },
  });

  if (!report.passed) {
    logError(
      `Nightly invoice self-check detected ${mismatches.length} pricing mismatch(es)`,
      new Error('InvoicePriceMismatch'),
      { mismatchRefs: mismatches.map((m) => m.publicRef) }
    );
    if (onMismatchDetected) {
      onMismatchDetected(report);
    }
  } else {
    logInfo('Nightly invoice self-check passed', { checkedCount, skippedCount });
  }

  return report;
}
