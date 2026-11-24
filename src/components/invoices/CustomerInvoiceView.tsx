'use client';

/**
 * ROCK UC FOODS - Customer Invoice Landing View (Phase 1G)
 * Playbook v2 Section 24, Section 29 & Section 35
 *
 * Rules:
 * - Private token-protected customer page (no login required).
 * - Displays official invoice with integer BigInt ₦ kobo amounts.
 * - 70% deposit and 30% balance split.
 * - Bank details for wire transfer (with ROCK UC FOODS fallback if unverified).
 * - Semantic Dark/Light CSS tokens, >=14px typography, >=44px touch targets.
 */

import React from 'react';
import {
  Download,
  Share2,
  CheckCircle,
  Building,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { RucLogo } from '../brand/RucLogo';
import { formatNaira } from '../../lib/money';

export interface CustomerInvoiceViewProps {
  invoice: {
    publicRef: string;
    revision: number;
    status: 'draft' | 'issued' | 'void' | 'superseded';
    customerName: string;
    customerPhone: string;
    lines: Array<{
      name: string;
      quantity: number;
      unitPriceKobo: string;
      lineTotalKobo: string;
    }>;
    formattedTotal: string;
    formattedDeposit: string;
    formattedBalance: string;
    createdAt: string;
    issuedAt?: string;
    pdfDownloadUrl: string;
    whatsappProofUrl: string;
    bankDetails?: {
      bankName: string;
      accountName: string;
      accountNumber: string;
    } | null;
  };
}

export function CustomerInvoiceView({ invoice }: CustomerInvoiceViewProps) {
  const isIssued = invoice.status === 'issued';
  const isDraft = invoice.status === 'draft';
  const isSuperseded = invoice.status === 'superseded';

  return (
    <div className="min-h-screen w-full max-w-full min-w-0 bg-[var(--bg-primary)] text-[var(--text-primary)] py-8 px-4 sm:px-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6 min-w-0">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <RucLogo size={64} showWordmark={true} />
          </div>
          <p className="text-sm uppercase tracking-[0.22em] text-[var(--text-accent)] font-semibold">
            Taste the Luxury
          </p>
        </div>

        {/* Invoice Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 min-w-0">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-subtle-card)] pb-5">
            <div className="min-w-0">
              <div className="text-sm uppercase font-bold tracking-wider text-[var(--text-accent)]">
                Official Event Invoice
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <h1 className="text-2xl font-mono font-bold text-[var(--text-primary)] tracking-wide price-tabular">
                  {invoice.publicRef}
                </h1>
                {invoice.revision > 1 && (
                  <span className="text-sm font-bold px-2.5 py-0.5 rounded-md bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/60 font-mono">
                    Rev {invoice.revision}
                  </span>
                )}
              </div>
            </div>

            <div className="self-start sm:self-auto shrink-0">
              {isIssued && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Issued &amp; Confirmed</span>
                </span>
              )}
              {isDraft && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Under Review</span>
                </span>
              )}
              {isSuperseded && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-bold bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border border-[var(--border-card)]">
                  <span>Superseded by Newer Revision</span>
                </span>
              )}
            </div>
          </div>

          {/* Client Details */}
          <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className="text-[var(--text-body-muted)] uppercase tracking-wider text-sm block font-semibold">
                Billed To
              </span>
              <span className="font-semibold text-base text-[var(--text-primary)] break-words">
                {invoice.customerName}
              </span>
            </div>
            {invoice.customerPhone && (
              <div className="sm:text-right min-w-0">
                <span className="text-[var(--text-body-muted)] uppercase tracking-wider text-sm block font-semibold">
                  Contact
                </span>
                <span className="font-mono price-tabular text-[var(--text-primary)]">
                  {invoice.customerPhone}
                </span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="space-y-3 min-w-0">
            <h2 className="text-sm uppercase tracking-wider text-[var(--text-accent)] font-bold">
              Menu &amp; Services Breakdown
            </h2>
            <div className="border border-[var(--border-subtle-card)] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle-card)] text-sm">
              {invoice.lines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3.5 flex items-center justify-between gap-3 bg-[var(--bg-surface-muted)] min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[var(--text-primary)] break-words">
                      {line.name}
                    </div>
                    {line.quantity > 1 && (
                      <div className="text-sm text-[var(--text-body-muted)]">
                        Qty: {line.quantity}
                      </div>
                    )}
                  </div>
                  <div className="font-mono font-bold text-[var(--text-primary)] price-tabular text-right shrink-0">
                    {formatNaira(BigInt(line.lineTotalKobo))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Terms Split */}
          <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-gold)] rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-body-muted)]">
              <span>70% Upfront Deposit:</span>
              <span className="font-mono font-bold text-[var(--text-money-positive)] text-base price-tabular">
                {invoice.formattedDeposit}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--text-body-muted)]">
              <span>30% Balance on Delivery:</span>
              <span className="font-mono font-bold text-[var(--status-warning-text)] text-base price-tabular">
                {invoice.formattedBalance}
              </span>
            </div>
            <div className="pt-3 border-t border-[var(--border-subtle-card)] flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-base text-[var(--text-primary)]">Grand Total:</span>
              <span className="font-bold text-xl text-[var(--text-accent)] price-tabular font-mono">
                {invoice.formattedTotal}
              </span>
            </div>
          </div>

          {/* Payment Instructions */}
          {isIssued && (
            <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-accent)]">
                <Building className="w-4 h-4 shrink-0" />
                <span>Bank Transfer Instructions</span>
              </div>
              {invoice.bankDetails ? (
                <div className="space-y-1.5 text-sm text-[var(--text-primary)] font-mono price-tabular">
                  <div>
                    <span className="text-[var(--text-body-muted)]">Bank:</span>{' '}
                    {invoice.bankDetails.bankName}
                  </div>
                  <div>
                    <span className="text-[var(--text-body-muted)]">Account Name:</span>{' '}
                    {invoice.bankDetails.accountName}
                  </div>
                  <div>
                    <span className="text-[var(--text-body-muted)]">Account Number:</span>{' '}
                    {invoice.bankDetails.accountNumber}
                  </div>
                  <div className="text-sm font-sans text-[var(--text-body-muted)] pt-1">
                    * Please use invoice reference &ldquo;{invoice.publicRef}&rdquo; as the transfer narration.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[var(--text-primary)]">
                  Payment details will be sent by ROCK UC FOODS.
                </div>
              )}
            </div>
          )}

          {/* Call to Actions (Mobile-First 48px+ touch targets) */}
          <div className="space-y-3 pt-2">
            {isIssued && (
              <a
                href={invoice.whatsappProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[48px] px-6 py-3 bg-[#166534] hover:bg-[#14532D] text-white text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <Share2 className="w-4 h-4 shrink-0" />
                <span>Send Payment Proof on WhatsApp</span>
              </a>
            )}

            <a
              href={invoice.pdfDownloadUrl}
              download
              className="w-full min-h-[48px] px-6 py-3 bg-[#6B1230] hover:bg-[#82173B] border border-[#D4AF37] text-[#F7EFD9] text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Download className="w-4 h-4 shrink-0 text-[#D4AF37]" />
              <span>Download Official PDF</span>
            </a>
          </div>

          {/* Footer note */}
          <div className="text-center text-sm text-[var(--text-body-muted)] pt-2 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <span>Secure 30-day tokenized access · Verified by Chef Esther Kwentua</span>
          </div>
        </div>
      </div>
    </div>
  );
}
