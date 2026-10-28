/**
 * ROCK UC FOODS - Bank Statement Reconciliation Engine
 * Playbook v4 Section 21
 * 
 * Rules:
 * - 100% BigInt integer kobo for all amounts.
 * - Extracts Nigerian order references (ROC-*, EVT-*).
 * - Identifies Exact Match, Underpaid, Overpaid, Already Paid, and Unmatched.
 * - Reconciles total credits with mathematical identity check.
 */

import { parseNairaToKobo } from '../lib/money';
import { Order } from '../types/order';

export type ReconciliationStatus =
  | 'reconciled_exact'
  | 'underpaid'
  | 'overpaid'
  | 'already_paid'
  | 'unmatched';

export interface ParsedBankTxn {
  id: string;
  date: string;
  narration: string;
  amountKobo: bigint;
  extractedRef: string | null;
}

export interface ReconciledTxnLine extends ParsedBankTxn {
  status: ReconciliationStatus;
  matchedOrderId?: string;
  orderCode?: string;
  orderCustomerName?: string;
  orderTotalKobo?: bigint;
  differenceKobo?: bigint;
}

export interface ReconciliationBatchSummary {
  batchId: string;
  totalTransactions: number;
  totalCreditsKobo: bigint;
  exactMatchedKobo: bigint;
  unmatchedKobo: bigint;
  underpaidKobo: bigint;
  overpaidKobo: bigint;
  alreadyPaidKobo: bigint;
  exactMatchCount: number;
  discrepancyCount: number;
  unmatchedCount: number;
  reconciliationIdentityVerified: boolean;
  lines: ReconciledTxnLine[];
}

/**
 * Extracts order codes matching ROC-YYYYMMDD-XXXX or EVT-YYYYMMDD-XXXX from bank narrations.
 */
export function extractOrderReference(narration: string): string | null {
  if (!narration) return null;

  // 1. Look for explicit ROC- or EVT- patterns
  const orderRefRegex = /\b(ROC-[A-Z0-9-]+|EVT-[A-Z0-9-]+)\b/i;
  const match = narration.match(orderRefRegex);
  if (match) {
    return match[1].toUpperCase();
  }

  // 2. Look for order code without hyphen e.g. ROC20261028
  const noHyphenRegex = /\b(ROC\d{8}[A-Z0-9]+)\b/i;
  const matchNoHyphen = narration.match(noHyphenRegex);
  if (matchNoHyphen) {
    return matchNoHyphen[1].toUpperCase();
  }

  return null;
}

/**
 * Parses raw CSV lines from Moniepoint, GTBank, Zenith, or standard bank exports.
 */
export function parseStatementCsv(
  csvContent: string,
  bankName: string = 'Moniepoint'
): ParsedBankTxn[] {
  if (!csvContent || csvContent.trim() === '') {
    return [];
  }

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // Determine headers
  const headerLine = lines[0].toLowerCase();
  const headers = headerLine.split(',').map((h) => h.replace(/["']/g, '').trim());

  // Find column indices
  let dateIdx = headers.findIndex((h) => h.includes('date'));
  let narrationIdx = headers.findIndex(
    (h) => h.includes('narration') || h.includes('description') || h.includes('details')
  );
  let amountIdx = headers.findIndex(
    (h) => h.includes('credit') || h.includes('amount') || h.includes('deposit')
  );

  // Fallbacks if no header detected
  if (dateIdx === -1) dateIdx = 0;
  if (narrationIdx === -1) narrationIdx = 1;
  if (amountIdx === -1) amountIdx = 2;

  const results: ParsedBankTxn[] = [];
  const startIdx = headers.some((h) => h.includes('date') || h.includes('amount')) ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const rawLine = lines[i];
    // Basic CSV token parser handling quoted commas
    const cols: string[] = [];
    let insideQuote = false;
    let currentToken = '';

    for (let c = 0; c < rawLine.length; c++) {
      const char = rawLine[c];
      if (char === '"' || char === "'") {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        cols.push(currentToken.trim().replace(/^["']|["']$/g, ''));
        currentToken = '';
      } else {
        currentToken += char;
      }
    }
    cols.push(currentToken.trim().replace(/^["']|["']$/g, ''));

    if (cols.length < 2) continue;

    const rawDate = cols[dateIdx] || new Date().toISOString().split('T')[0];
    const rawNarration = cols[narrationIdx] || 'Bank Transfer';
    const rawAmount = cols[amountIdx] || '0';

    // Parse amount using safe BigInt parser
    let amountKobo: bigint;
    try {
      amountKobo = parseNairaToKobo(rawAmount);
    } catch {
      continue; // Skip lines with invalid amounts or debit rows
    }

    if (amountKobo <= 0n) continue;

    const extractedRef = extractOrderReference(rawNarration);

    results.push({
      id: `btxn-${i}-${Math.random().toString(36).substring(2, 7)}`,
      date: rawDate,
      narration: rawNarration,
      amountKobo,
      extractedRef,
    });
  }

  return results;
}

/**
 * Reconciles parsed bank transactions against existing orders.
 */
export function reconcileTransactions(
  transactions: ParsedBankTxn[],
  orders: Order[]
): ReconciliationBatchSummary {
  const batchId = `recon-batch-${Date.now()}`;
  const lines: ReconciledTxnLine[] = [];

  let totalCreditsKobo = 0n;
  let exactMatchedKobo = 0n;
  let unmatchedKobo = 0n;
  let underpaidKobo = 0n;
  let overpaidKobo = 0n;
  let alreadyPaidKobo = 0n;

  let exactMatchCount = 0;
  let discrepancyCount = 0;
  let unmatchedCount = 0;

  for (const txn of transactions) {
    totalCreditsKobo += txn.amountKobo;

    if (!txn.extractedRef) {
      lines.push({
        ...txn,
        status: 'unmatched',
      });
      unmatchedKobo += txn.amountKobo;
      unmatchedCount++;
      continue;
    }

    // Locate order by reference
    const matchedOrder = orders.find(
      (o) =>
        o.orderCode.toUpperCase() === txn.extractedRef!.toUpperCase() ||
        (o.id && o.id.toUpperCase() === txn.extractedRef!.toUpperCase())
    );

    if (!matchedOrder) {
      lines.push({
        ...txn,
        status: 'unmatched',
      });
      unmatchedKobo += txn.amountKobo;
      unmatchedCount++;
      continue;
    }

    const orderTotalKobo = matchedOrder.totalKobo;

    // Check if order was already confirmed
    const isAlreadyPaid =
      matchedOrder.status === 'payment_confirmed' ||
      matchedOrder.status === 'in_kitchen' ||
      matchedOrder.status === 'ready_for_dispatch' ||
      matchedOrder.status === 'out_for_delivery' ||
      matchedOrder.status === 'delivered';

    if (isAlreadyPaid) {
      lines.push({
        ...txn,
        status: 'already_paid',
        matchedOrderId: matchedOrder.id,
        orderCode: matchedOrder.orderCode,
        orderCustomerName: matchedOrder.customerName,
        orderTotalKobo,
      });
      alreadyPaidKobo += txn.amountKobo;
      discrepancyCount++;
      continue;
    }

    // Compare amount with order total
    if (txn.amountKobo === orderTotalKobo) {
      lines.push({
        ...txn,
        status: 'reconciled_exact',
        matchedOrderId: matchedOrder.id,
        orderCode: matchedOrder.orderCode,
        orderCustomerName: matchedOrder.customerName,
        orderTotalKobo,
      });
      exactMatchedKobo += txn.amountKobo;
      exactMatchCount++;
    } else if (txn.amountKobo < orderTotalKobo) {
      const diff = orderTotalKobo - txn.amountKobo;
      lines.push({
        ...txn,
        status: 'underpaid',
        matchedOrderId: matchedOrder.id,
        orderCode: matchedOrder.orderCode,
        orderCustomerName: matchedOrder.customerName,
        orderTotalKobo,
        differenceKobo: diff,
      });
      underpaidKobo += txn.amountKobo;
      discrepancyCount++;
    } else {
      const diff = txn.amountKobo - orderTotalKobo;
      lines.push({
        ...txn,
        status: 'overpaid',
        matchedOrderId: matchedOrder.id,
        orderCode: matchedOrder.orderCode,
        orderCustomerName: matchedOrder.customerName,
        orderTotalKobo,
        differenceKobo: diff,
      });
      overpaidKobo += txn.amountKobo;
      discrepancyCount++;
    }
  }

  // Exact mathematical identity reconciliation check
  const calculatedSum =
    exactMatchedKobo + unmatchedKobo + underpaidKobo + overpaidKobo + alreadyPaidKobo;
  const reconciliationIdentityVerified = calculatedSum === totalCreditsKobo;

  return {
    batchId,
    totalTransactions: transactions.length,
    totalCreditsKobo,
    exactMatchedKobo,
    unmatchedKobo,
    underpaidKobo,
    overpaidKobo,
    alreadyPaidKobo,
    exactMatchCount,
    discrepancyCount,
    unmatchedCount,
    reconciliationIdentityVerified,
    lines,
  };
}
