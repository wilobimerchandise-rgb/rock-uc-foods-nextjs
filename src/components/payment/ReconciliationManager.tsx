'use client';

/**
 * ROCK UC FOODS - Bank Reconciliation Dashboard
 * Playbook v4 Section 21
 */

import React, { useState } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  RefreshCw,
  Search,
  Filter,
  Check,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import { formatNaira } from '../../lib/money';

interface ReconciledLineDto {
  id: string;
  date: string;
  narration: string;
  amountKobo: string;
  amountFormatted: string;
  extractedRef: string | null;
  status: 'reconciled_exact' | 'underpaid' | 'overpaid' | 'already_paid' | 'unmatched';
  matchedOrderId?: string;
  orderCode?: string;
  orderCustomerName?: string;
  orderTotalFormatted?: string;
  differenceFormatted?: string;
}

interface BatchSummaryDto {
  batchId: string;
  totalTransactions: number;
  totalCreditsFormatted: string;
  exactMatchedFormatted: string;
  unmatchedFormatted: string;
  underpaidFormatted: string;
  overpaidFormatted: string;
  alreadyPaidFormatted: string;
  exactMatchCount: number;
  discrepancyCount: number;
  unmatchedCount: number;
  reconciliationIdentityVerified: boolean;
  lines: ReconciledLineDto[];
}

const SAMPLE_GTBANK_CSV = `Date,Reference,Narration,Amount,Balance
2026-10-28,GTB-982341,"TRF/RUC-20261028-ABCD/CHIDIEBERE/GTB",18500.00,1250000.00
2026-10-28,GTB-982342,"NIP/ESTHER/RUC-20261028-WXYZ/LUNCH",3500.00,1253500.00
2026-10-28,GTB-982343,"TRANSFER FROM OLUWASEUN RUC-20261028-PARTIAL",2000.00,1255500.00
2026-10-28,GTB-982344,"POS CASH SETTLEMENT UNKNOWN SENDER",15000.00,1270500.00`;

export function ReconciliationManager() {
  const [csvInput, setCsvInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [batchData, setBatchData] = useState<BatchSummaryDto | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'exact' | 'discrepancy' | 'unmatched'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleUploadAndReconcile = async () => {
    if (!csvInput.trim()) return;
    setLoading(true);
    setToastMessage(null);

    try {
      const res = await fetch('/api/admin/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: csvInput, bankName: 'GTBank' }),
      });

      const data = await res.json();
      if (res.ok) {
        setBatchData(data.batch);
        setToastMessage(`Reconciliation batch processed: ${data.batch.totalTransactions} transactions parsed.`);
      } else {
        setToastMessage(`Error: ${data.error || 'Failed to process statement.'}`);
      }
    } catch {
      setToastMessage('Network error submitting statement.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyConfirmedMatches = async () => {
    if (!batchData || applying) return;
    setApplying(true);

    try {
      const res = await fetch('/api/admin/reconciliation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: batchData.batchId }),
      });

      const data = await res.json();
      if (res.ok) {
        setToastMessage(`Success: ${data.confirmedCount} matching orders confirmed in system.`);
        // Mark matched lines as reconciled
        setBatchData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            lines: prev.lines.map((l) =>
              l.status === 'reconciled_exact' ? { ...l, status: 'already_paid' } : l
            ),
          };
        });
      } else {
        setToastMessage(`Error: ${data.error || 'Failed to apply matches.'}`);
      }
    } catch {
      setToastMessage('Network error updating matched orders.');
    } finally {
      setApplying(false);
    }
  };

  const filteredLines = batchData?.lines.filter((line) => {
    if (activeFilter === 'exact') return line.status === 'reconciled_exact';
    if (activeFilter === 'discrepancy')
      return (
        line.status === 'underpaid' ||
        line.status === 'overpaid' ||
        line.status === 'already_paid'
      );
    if (activeFilter === 'unmatched') return line.status === 'unmatched';
    return true;
  }) || [];

  return (
    <div className="space-y-6 min-w-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--border-card)]">
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold text-[var(--text-primary)] tracking-tight">
            Bank Statement Reconciliation
          </h1>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Automated GTBank &amp; Nigerian Bank CSV parser with strict order code extraction and 100% BigInt kobo matching.
          </p>
        </div>

        {batchData && batchData.exactMatchCount > 0 && (
          <button
            type="button"
            onClick={handleApplyConfirmedMatches}
            disabled={applying}
            className="min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 bg-[#166534] hover:bg-[#14532D] text-[#FFFFFF] rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-50"
          >
            {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Confirm {batchData.exactMatchCount} Exact Matches</span>
          </button>
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <div
          role={toastMessage.startsWith('Error') || toastMessage.startsWith('Network') ? 'alert' : 'status'}
          className="p-3.5 bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl text-sm text-[var(--text-primary)] flex flex-wrap items-center justify-between gap-3"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="min-h-[44px] px-3 text-[var(--text-accent)] font-bold text-sm hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload & CSV Input */}
      {!batchData && (
        <div className="bg-[var(--bg-card)] p-5 sm:p-6 rounded-2xl border border-[var(--border-card)] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label
              htmlFor="reconciliation-csv-input"
              className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2"
            >
              <Upload className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
              <span>Paste Bank Statement (CSV)</span>
            </label>
            <button
              type="button"
              onClick={() => setCsvInput(SAMPLE_GTBANK_CSV)}
              className="min-h-[44px] px-3 text-sm text-[var(--text-accent)] hover:underline font-semibold"
            >
              Load Sample GTBank CSV
            </button>
          </div>

          <textarea
            id="reconciliation-csv-input"
            rows={5}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="Date,Reference,Narration,Amount,Balance..."
            className="w-full p-3.5 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-base sm:text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
          />

          <button
            type="button"
            onClick={handleUploadAndReconcile}
            disabled={loading || !csvInput.trim()}
            className="w-full min-h-[48px] py-3 px-4 bg-[#6B1230] hover:bg-[#82173B] text-[#F7EFD9] border border-[#D4AF37]/60 font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-[#F3D98B]" />}
            <span>Reconcile Transactions</span>
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {batchData && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl space-y-1">
              <span className="text-sm text-[var(--text-body-muted)] font-semibold uppercase block">
                Total Credits
              </span>
              <div className="text-xl font-black text-[var(--text-primary)] price-tabular">
                {batchData.totalCreditsFormatted}
              </div>
              <span className="text-sm text-[var(--text-body-muted)] block">
                {batchData.totalTransactions} transactions
              </span>
            </div>

            <div className="p-4 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-2xl space-y-1">
              <span className="text-sm text-[var(--status-success-text)] font-semibold uppercase flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Exact Matches</span>
              </span>
              <div className="text-xl font-black text-[var(--status-success-text)] price-tabular">
                {batchData.exactMatchedFormatted}
              </div>
              <span className="text-sm text-[var(--status-success-text)] block">
                {batchData.exactMatchCount} orders verified
              </span>
            </div>

            <div className="p-4 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-2xl space-y-1">
              <span className="text-sm text-[var(--status-warning-text)] font-semibold uppercase flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Discrepancies</span>
              </span>
              <div className="text-xl font-black text-[var(--status-warning-text)] price-tabular">
                {batchData.underpaidFormatted}
              </div>
              <span className="text-sm text-[var(--status-warning-text)] block">
                {batchData.discrepancyCount} under/overpaid
              </span>
            </div>

            <div className="p-4 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-2xl space-y-1">
              <span className="text-sm text-[var(--status-danger-text)] font-semibold uppercase block">
                Unmatched Suspense
              </span>
              <div className="text-xl font-black text-[var(--status-danger-text)] price-tabular">
                {batchData.unmatchedFormatted}
              </div>
              <span className="text-sm text-[var(--status-danger-text)] block">
                {batchData.unmatchedCount} unlinked txns
              </span>
            </div>
          </div>

          {/* Reconciliation Identity Check Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[var(--text-body-muted)] font-medium">
                Reconciliation Identity Check:
              </span>
              <span className="font-bold text-[var(--text-money-positive)]">
                {batchData.reconciliationIdentityVerified ? '100% Mathematical Reconciled' : 'Discrepancy Detected'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setBatchData(null);
                setCsvInput('');
              }}
              className="min-h-[44px] px-3 text-sm text-[var(--text-accent)] hover:underline font-semibold"
            >
              Upload New Statement
            </button>
          </div>

          {/* Filter Row */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border ${
                activeFilter === 'all'
                  ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                  : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:border-[var(--border-card)]'
              }`}
            >
              All ({batchData.lines.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('exact')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border ${
                activeFilter === 'exact'
                  ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:border-[var(--border-card)]'
              }`}
            >
              Exact Matches ({batchData.exactMatchCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('discrepancy')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border ${
                activeFilter === 'discrepancy'
                  ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:border-[var(--border-card)]'
              }`}
            >
              Discrepancies ({batchData.discrepancyCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unmatched')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all border ${
                activeFilter === 'unmatched'
                  ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:border-[var(--border-card)]'
              }`}
            >
              Unmatched ({batchData.unmatchedCount})
            </button>
          </div>

          {/* Transaction Lines Table */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[var(--text-primary)]">
                <thead className="bg-[var(--bg-primary)] text-[var(--text-body-muted)] uppercase text-sm tracking-wider border-b border-[var(--border-card)]">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Narration</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Extracted Ref</th>
                    <th className="p-3.5">Matched Order</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle-card)]">
                  {filteredLines.map((line) => (
                    <tr key={line.id} className="hover:bg-[var(--bg-surface-muted)] transition-colors">
                      <td className="p-3.5 whitespace-nowrap font-mono text-sm text-[var(--text-body-muted)] price-tabular">
                        {line.date}
                      </td>
                      <td className="p-3.5 max-w-xs truncate text-[var(--text-primary)]" title={line.narration}>
                        {line.narration}
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-bold text-[var(--text-primary)] price-tabular">
                        {line.amountFormatted}
                      </td>
                      <td className="p-3.5 whitespace-nowrap font-mono text-sm">
                        {line.extractedRef ? (
                          <span className="text-[var(--text-accent)] bg-[var(--bg-primary)] border border-[var(--border-card)] px-2.5 py-1 rounded">
                            {line.extractedRef}
                          </span>
                        ) : (
                          <span className="text-[var(--text-body-muted)]">—</span>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {line.orderCode ? (
                          <div>
                            <span className="font-bold text-[var(--text-primary)]">{line.orderCode}</span>
                            <span className="text-sm text-[var(--text-body-muted)] block">{line.orderCustomerName}</span>
                          </div>
                        ) : (
                          <span className="text-[var(--text-body-muted)]">—</span>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        {line.status === 'reconciled_exact' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
                            <CheckCircle2 className="w-4 h-4 shrink-0" /> Exact Match
                          </span>
                        )}
                        {line.status === 'underpaid' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]">
                            <AlertCircle className="w-4 h-4 shrink-0" /> Underpaid (Short by {line.differenceFormatted})
                          </span>
                        )}
                        {line.status === 'overpaid' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]">
                            <AlertCircle className="w-4 h-4 shrink-0" /> Overpaid
                          </span>
                        )}
                        {line.status === 'already_paid' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]">
                            <Check className="w-4 h-4 shrink-0" /> Already Confirmed
                          </span>
                        )}
                        {line.status === 'unmatched' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]">
                            <ShieldAlert className="w-4 h-4 shrink-0" /> Unmatched
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
