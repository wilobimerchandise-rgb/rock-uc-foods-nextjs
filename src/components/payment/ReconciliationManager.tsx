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

const SAMPLE_MONIEPOINT_CSV = `Date,Reference,Narration,Amount,Balance
2026-10-28,MNP-982341,"TRF/ROC-20261028-ABCD/CHIDIEBERE/GTB",18500.00,1250000.00
2026-10-28,MNP-982342,"NIP/ESTHER/ROC-20261028-WXYZ/LUNCH",3500.00,1253500.00
2026-10-28,MNP-982343,"TRANSFER FROM OLUWASEUN ROC-20261028-PARTIAL",2000.00,1255500.00
2026-10-28,MNP-982344,"POS CASH SETTLEMENT UNKNOWN SENDER",15000.00,1270500.00`;

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
        body: JSON.stringify({ csvContent: csvInput, bankName: 'Moniepoint' }),
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-[#F7EFD9] tracking-tight">
            Bank Statement Reconciliation
          </h2>
          <p className="text-xs text-[#F7EFD9]/60 mt-1">
            Automated Moniepoint &amp; Bank CSV parser with strict order code extraction and 100% BigInt kobo matching.
          </p>
        </div>

        {batchData && batchData.exactMatchCount > 0 && (
          <button
            type="button"
            onClick={handleApplyConfirmedMatches}
            disabled={applying}
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#1E7E34] hover:bg-[#155724] text-white rounded-xl text-xs font-bold shadow-lg transition-all disabled:opacity-50"
          >
            {applying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Confirm {batchData.exactMatchCount} Exact Matches</span>
          </button>
        )}
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="p-3 bg-[#6B1230]/40 border border-[#D4AF37]/50 rounded-xl text-xs text-[#F7EFD9] flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-[#D4AF37] font-bold text-xs ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Upload & CSV Input */}
      {!batchData && (
        <div className="bg-[#17120F] p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#F7EFD9] flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#D4AF37]" />
              <span>Paste Bank Statement (CSV)</span>
            </span>
            <button
              type="button"
              onClick={() => setCsvInput(SAMPLE_MONIEPOINT_CSV)}
              className="text-xs text-[#D4AF37] hover:underline font-semibold"
            >
              Load Sample Moniepoint CSV
            </button>
          </div>

          <textarea
            rows={5}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            placeholder="Date,Reference,Narration,Amount,Balance..."
            className="w-full p-3 bg-black/40 border border-white/20 rounded-xl text-xs font-mono text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
          />

          <button
            type="button"
            onClick={handleUploadAndReconcile}
            disabled={loading || !csvInput.trim()}
            className="w-full py-3 bg-[#6B1230] hover:bg-[#85163c] text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-[#D4AF37]" />}
            <span>Reconcile Transactions</span>
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {batchData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#17120F] border border-white/10 rounded-2xl">
              <span className="text-[11px] text-[#F7EFD9]/60 font-semibold uppercase">Total Credits</span>
              <div className="text-lg font-black text-white mt-1">{batchData.totalCreditsFormatted}</div>
              <span className="text-[10px] text-[#F7EFD9]/40">{batchData.totalTransactions} transactions</span>
            </div>

            <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl">
              <span className="text-[11px] text-emerald-400 font-semibold uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Exact Matches
              </span>
              <div className="text-lg font-black text-emerald-200 mt-1">{batchData.exactMatchedFormatted}</div>
              <span className="text-[10px] text-emerald-400/80">{batchData.exactMatchCount} orders verified</span>
            </div>

            <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-2xl">
              <span className="text-[11px] text-amber-400 font-semibold uppercase flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Discrepancies
              </span>
              <div className="text-lg font-black text-amber-200 mt-1">
                {batchData.underpaidFormatted}
              </div>
              <span className="text-[10px] text-amber-400/80">{batchData.discrepancyCount} under/overpaid</span>
            </div>

            <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-2xl">
              <span className="text-[11px] text-rose-400 font-semibold uppercase">Unmatched Suspense</span>
              <div className="text-lg font-black text-rose-200 mt-1">{batchData.unmatchedFormatted}</div>
              <span className="text-[10px] text-rose-400/80">{batchData.unmatchedCount} unlinked txns</span>
            </div>
          </div>

          {/* Reconciliation Identity Check Bar */}
          <div className="flex items-center justify-between p-3 bg-black/40 border border-white/10 rounded-xl text-xs">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/80 font-medium">Reconciliation Identity Check:</span>
              <span className="font-bold text-emerald-400">
                {batchData.reconciliationIdentityVerified ? '100% Mathematical Reconciled' : 'Discrepancy Detected'}
              </span>
            </div>
            <button
              onClick={() => {
                setBatchData(null);
                setCsvInput('');
              }}
              className="text-xs text-[#D4AF37] hover:underline font-semibold"
            >
              Upload New Statement
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'all'
                  ? 'bg-[#6B1230] text-white border border-[#D4AF37]'
                  : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              All ({batchData.lines.length})
            </button>
            <button
              onClick={() => setActiveFilter('exact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'exact'
                  ? 'bg-emerald-800 text-white border border-emerald-400'
                  : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              Exact Matches ({batchData.exactMatchCount})
            </button>
            <button
              onClick={() => setActiveFilter('discrepancy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'discrepancy'
                  ? 'bg-amber-800 text-white border border-amber-400'
                  : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              Discrepancies ({batchData.discrepancyCount})
            </button>
            <button
              onClick={() => setActiveFilter('unmatched')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === 'unmatched'
                  ? 'bg-rose-800 text-white border border-rose-400'
                  : 'bg-white/5 text-white/60 hover:text-white'
              }`}
            >
              Unmatched ({batchData.unmatchedCount})
            </button>
          </div>

          {/* Transaction Lines Table */}
          <div className="bg-[#17120F] rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="bg-black/50 text-stone-400 uppercase text-[10px] tracking-wider border-b border-white/10">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Narration</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Extracted Ref</th>
                    <th className="p-3">Matched Order</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredLines.map((line) => (
                    <tr key={line.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 whitespace-nowrap font-mono text-[11px] text-stone-400">
                        {line.date}
                      </td>
                      <td className="p-3 max-w-xs truncate text-white" title={line.narration}>
                        {line.narration}
                      </td>
                      <td className="p-3 whitespace-nowrap font-bold text-white">
                        {line.amountFormatted}
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-[11px]">
                        {line.extractedRef ? (
                          <span className="text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded">
                            {line.extractedRef}
                          </span>
                        ) : (
                          <span className="text-stone-500">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {line.orderCode ? (
                          <div>
                            <span className="font-bold text-white">{line.orderCode}</span>
                            <span className="text-[10px] text-stone-400 block">{line.orderCustomerName}</span>
                          </div>
                        ) : (
                          <span className="text-stone-500">—</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {line.status === 'reconciled_exact' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <CheckCircle2 className="w-3 h-3" /> Exact Match
                          </span>
                        )}
                        {line.status === 'underpaid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <AlertCircle className="w-3 h-3" /> Underpaid (Short by {line.differenceFormatted})
                          </span>
                        )}
                        {line.status === 'overpaid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            <AlertCircle className="w-3 h-3" /> Overpaid
                          </span>
                        )}
                        {line.status === 'already_paid' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            <Check className="w-3 h-3" /> Already Confirmed
                          </span>
                        )}
                        {line.status === 'unmatched' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            <ShieldAlert className="w-3 h-3" /> Unmatched
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
