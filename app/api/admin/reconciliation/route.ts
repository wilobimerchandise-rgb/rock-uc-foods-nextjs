/**
 * ROCK UC FOODS - Admin Bank Reconciliation API
 * Playbook v4 Section 21
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseStatementCsv, reconcileTransactions, ReconciledTxnLine } from '@/src/payment/reconciliation';
import { orderRepository } from '@/src/order/orderRepository';
import { paymentRepository } from '@/src/payment/paymentEngine';
import { formatNaira } from '@/src/lib/money';
import { resolveActiveAdminProfile } from '@/src/order/orderAuth';
import { requireRole, AuthorizationError } from '@/src/lib/auth/access';

// Cache for active reconciliation batches in memory
const batchStore = new Map<string, ReconciledTxnLine[]>();

async function authorizeReconciliationAdmin(req: NextRequest) {
  const authRes = await resolveActiveAdminProfile(req);
  if ('status' in authRes) {
    return {
      errorResponse: NextResponse.json(
        { error: authRes.error },
        { status: authRes.status, headers: { 'Cache-Control': 'no-store' } }
      ),
    };
  }

  try {
    requireRole(['owner', 'staff', 'developer'], authRes.userProfile, 'bank reconciliation');
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return {
        errorResponse: NextResponse.json(
          { error: err.message },
          { status: 403, headers: { 'Cache-Control': 'no-store' } }
        ),
      };
    }
    throw err;
  }

  return { profile: authRes.userProfile };
}

export async function POST(req: NextRequest) {
  const auth = await authorizeReconciliationAdmin(req);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const body = await req.json();
    const { csvContent, bankName = 'Guaranty Trust Bank (GTBank)' } = body;

    if (!csvContent || typeof csvContent !== 'string') {
      return NextResponse.json(
        { error: 'csvContent string is required.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const parsedTxns = parseStatementCsv(csvContent, bankName);
    const existingOrders = orderRepository.getAll();

    const summary = reconcileTransactions(parsedTxns, existingOrders);
    batchStore.set(summary.batchId, summary.lines);

    return NextResponse.json(
      {
        batch: {
          batchId: summary.batchId,
          totalTransactions: summary.totalTransactions,
          totalCreditsKobo: summary.totalCreditsKobo.toString(),
          totalCreditsFormatted: formatNaira(summary.totalCreditsKobo),
          exactMatchedKobo: summary.exactMatchedKobo.toString(),
          exactMatchedFormatted: formatNaira(summary.exactMatchedKobo),
          unmatchedKobo: summary.unmatchedKobo.toString(),
          unmatchedFormatted: formatNaira(summary.unmatchedKobo),
          underpaidKobo: summary.underpaidKobo.toString(),
          underpaidFormatted: formatNaira(summary.underpaidKobo),
          overpaidKobo: summary.overpaidKobo.toString(),
          overpaidFormatted: formatNaira(summary.overpaidKobo),
          alreadyPaidKobo: summary.alreadyPaidKobo.toString(),
          alreadyPaidFormatted: formatNaira(summary.alreadyPaidKobo),
          exactMatchCount: summary.exactMatchCount,
          discrepancyCount: summary.discrepancyCount,
          unmatchedCount: summary.unmatchedCount,
          reconciliationIdentityVerified: summary.reconciliationIdentityVerified,
          lines: summary.lines.map((l) => ({
            id: l.id,
            date: l.date,
            narration: l.narration,
            amountKobo: l.amountKobo.toString(),
            amountFormatted: formatNaira(l.amountKobo),
            extractedRef: l.extractedRef,
            status: l.status,
            matchedOrderId: l.matchedOrderId,
            orderCode: l.orderCode,
            orderCustomerName: l.orderCustomerName,
            orderTotalKobo: l.orderTotalKobo?.toString(),
            orderTotalFormatted: l.orderTotalKobo ? formatNaira(l.orderTotalKobo) : undefined,
            differenceKobo: l.differenceKobo?.toString(),
            differenceFormatted: l.differenceKobo ? formatNaira(l.differenceKobo) : undefined,
          })),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to process bank statement.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authorizeReconciliationAdmin(req);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const body = await req.json();
    const { batchId, lineIds } = body;

    const lines = batchStore.get(batchId);
    if (!lines) {
      return NextResponse.json(
        { error: `Batch '${batchId}' not found or session expired.` },
        { status: 404, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const targetLines =
      lineIds && Array.isArray(lineIds)
        ? lines.filter((l) => lineIds.includes(l.id))
        : lines.filter((l) => l.status === 'reconciled_exact');

    let confirmedCount = 0;
    const nowIso = new Date().toISOString();

    for (const line of targetLines) {
      if (line.status === 'reconciled_exact' && line.matchedOrderId) {
        const order = orderRepository.getById(line.matchedOrderId);
        if (order && (order.status === 'pending_payment' || order.status === 'proof_submitted')) {
          const refToUse = line.extractedRef || order.paymentReference || line.id;
          orderRepository.updateStatus(order.id, 'paid', {
            actorUserId: auth.profile.id,
            paymentReference: refToUse,
            paidAmountKobo: order.totalKobo,
          });

          paymentRepository.savePayment({
            id: `pay-recon-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            orderId: order.id,
            paymentType: 'order',
            method: 'manual_transfer',
            amountKobo: line.amountKobo,
            status: 'verified',
            providerReference: refToUse,
            verifiedAt: nowIso,
            metadata: {
              reconciledFrom: 'bank_statement_csv',
              narration: line.narration,
              date: line.date,
            },
            createdAt: nowIso,
          });

          confirmedCount++;
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        confirmedCount,
        message: `Successfully verified and reconciled ${confirmedCount} orders.`,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to apply reconciliation.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
