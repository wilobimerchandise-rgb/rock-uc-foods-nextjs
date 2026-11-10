'use client';

/**
 * ROCK UC FOODS - Customer Invoice Landing View (Phase 1G)
 * Playbook v2 Section 24 & Section 29
 * 
 * Rules:
 * - Private token-protected customer page (no login required).
 * - Displays official invoice with ₦ kobo amounts.
 * - 70% deposit and 30% balance split.
 * - Bank details for wire transfer.
 * - One-tap buttons: Download PDF and Send Payment Proof on WhatsApp.
 * - Mobile-first luxury layout (#0B0A09, #D4AF37, #6B1230, #F7EFD9).
 */

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Download,
  Share2,
  CheckCircle,
  Building,
  CreditCard,
  Phone,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { RucLogo } from '@/src/components/brand/RucLogo';

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
  };
}

export function CustomerInvoiceView({ invoice }: CustomerInvoiceViewProps) {
  const isIssued = invoice.status === 'issued';
  const isDraft = invoice.status === 'draft';
  const isSuperseded = invoice.status === 'superseded';

  return (
    <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] py-8 px-4 sm:px-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <RucLogo size={64} showWordmark={true} />
          </div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#D4AF37] font-semibold">
            Taste the Luxury
          </p>
        </div>

        {/* Invoice Card */}
        <div className="bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-[#D4AF37]">
                Official Event Invoice
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <h1 className="text-2xl font-mono font-bold text-white tracking-wide">
                  {invoice.publicRef}
                </h1>
                {invoice.revision > 1 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50 font-mono">
                    Rev {invoice.revision}
                  </span>
                )}
              </div>
            </div>

            <div className="self-start sm:self-auto">
              {isIssued && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Issued & Confirmed</span>
                </span>
              )}
              {isDraft && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/60 text-amber-400 border border-amber-500/40">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Under Review</span>
                </span>
              )}
              {isSuperseded && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white/60 border border-white/20">
                  <span>Superseded by Newer Revision</span>
                </span>
              )}
            </div>
          </div>

          {/* Client Details */}
          <div className="bg-[#0B0A09]/70 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row justify-between gap-3 text-xs">
            <div>
              <span className="text-white/40 uppercase tracking-wider text-[10px] block">
                Billed To
              </span>
              <span className="font-semibold text-sm text-[#F7EFD9]">
                {invoice.customerName}
              </span>
            </div>
            {invoice.customerPhone && (
              <div className="sm:text-right">
                <span className="text-white/40 uppercase tracking-wider text-[10px] block">
                  Contact
                </span>
                <span className="font-mono text-white/80">
                  {invoice.customerPhone}
                </span>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-[#D4AF37] font-bold">
              Menu & Services Breakdown
            </h2>
            <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5 text-xs">
              {invoice.lines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3.5 flex items-center justify-between gap-3 bg-[#0B0A09]/40"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#F7EFD9] truncate">
                      {line.name}
                    </div>
                    {line.quantity > 1 && (
                      <div className="text-[11px] text-white/40">
                        Qty: {line.quantity}
                      </div>
                    )}
                  </div>
                  <div className="font-mono font-bold text-[#F7EFD9] text-right shrink-0">
                    ₦{(Number(line.lineTotalKobo) / 100).toLocaleString('en-NG', {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Terms Split */}
          <div className="bg-[#0B0A09] border border-[#D4AF37]/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>70% Upfront Deposit:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {invoice.formattedDeposit}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-white/70">
              <span>30% Balance on Delivery:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {invoice.formattedBalance}
              </span>
            </div>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between">
              <span className="font-bold text-sm text-[#F7EFD9]">Grand Total:</span>
              <span className="font-bold text-xl text-[#D4AF37]">
                {invoice.formattedTotal}
              </span>
            </div>
          </div>

          {/* Payment Instructions */}
          {isIssued && (
            <div className="bg-[#0B0A09]/90 border border-white/10 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37]">
                <Building className="w-4 h-4" />
                <span>Bank Transfer Instructions</span>
              </div>
              <div className="space-y-1.5 text-xs text-[#F7EFD9]/80 font-mono">
                <div>
                  <span className="text-white/40">Bank:</span> Zenith Bank Plc
                </div>
                <div>
                  <span className="text-white/40">Account Name:</span> ROCK UC FOODS & CATERING
                </div>
                <div>
                  <span className="text-white/40">Account Number:</span> 1228493018
                </div>
                <div className="text-[11px] text-white/50 pt-1">
                  * Please use invoice reference &ldquo;{invoice.publicRef}&rdquo; as the transfer narration.
                </div>
              </div>
            </div>
          )}

          {/* Call to Actions (Mobile-First 48px+ touch targets) */}
          <div className="space-y-3 pt-2">
            {isIssued && (
              <a
                href={invoice.whatsappProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[52px] px-6 bg-[#1E7E34] hover:bg-[#155724] active:bg-[#0E3E1A] text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Send Payment Proof on WhatsApp</span>
              </a>
            )}

            <a
              href={invoice.pdfDownloadUrl}
              download
              className="w-full min-h-[48px] px-6 bg-[#17120F] hover:bg-white/5 border border-[#D4AF37]/50 text-[#D4AF37] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Official PDF</span>
            </a>
          </div>

          {/* Footer note */}
          <div className="text-center text-[11px] text-white/40 pt-2 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]/60" />
            <span>Secure 30-day tokenized access · Verified by Chef Esther Kwentua</span>
          </div>
        </div>
      </div>
    </div>
  );
}
