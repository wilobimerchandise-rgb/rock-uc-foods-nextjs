'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Share2,
  Copy,
  Check,
  CheckCircle,
  ExternalLink,
  Download,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Phone,
  User,
  ShieldAlert,
  Edit3,
  History,
  X,
  Eye,
} from 'lucide-react';
import { maskCustomerPhone, canViewUnmaskedCustomerPhone } from '../../lib/security';
import { formatNaira } from '../../lib/money';

interface InvoiceDetailProps {
  invoice: {
    id: string;
    publicRef: string;
    revision: number;
    status: 'draft' | 'issued' | 'void' | 'superseded';
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    packageId?: string;
    guests: number;
    zoneId?: string;
    addOnIds?: string[];
    lines: Array<{
      name: string;
      quantity: number;
      unitPriceKobo: string;
      lineTotalKobo: string;
    }>;
    totalKobo: string;
    formattedTotal: string;
    depositKobo: string;
    formattedDeposit: string;
    balanceKobo: string;
    formattedBalance: string;
    label?: string;
    createdAt: string;
    expiresAt?: string;
    issuedAt?: string;
    voidReason?: string;
    revisedAt?: string;
    revisionReason?: string;
    linksCount: number;
    lastSharedAt?: string;
    versions?: Array<{
      id: string;
      revision: number;
      reason: string;
      changedAt: string;
      formattedTotal: string;
      formattedDeposit: string;
      formattedBalance: string;
    }>;
  };
  userRole: string;
  hasMfaVerified?: boolean;
  config?: {
    tiers: Array<{
      id: string;
      name: string;
      pricePerGuestKobo: string;
      formattedPrice: string;
      minGuests: number;
      maxGuests: number;
    }>;
    addOns: Array<{
      id: string;
      name: string;
      flatPriceKobo: string;
      formattedPrice: string;
    }>;
    zones: Array<{
      id: string;
      name: string;
      flatPriceKobo: string;
      formattedPrice: string;
    }>;
  };
}

export function AdminInvoiceDetailClient({
  invoice,
  userRole,
  hasMfaVerified = false,
  config,
}: InvoiceDetailProps) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareData, setShareData] = useState<{
    url?: string;
    message?: string;
    phoneProblem?: boolean;
    expiresAt?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [canSharePdf, setCanSharePdf] = useState(false);

  // Revision Modal State
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [revising, setRevising] = useState(false);
  const [revReason, setRevReason] = useState('');
  const [revPackage, setRevPackage] = useState(invoice.packageId || config?.tiers[0]?.id || 'tier-bronze');
  const [revGuests, setRevGuests] = useState<number>(invoice.guests || 50);
  const [revZone, setRevZone] = useState<string>(invoice.zoneId || config?.zones[0]?.id || '');
  const [revAddOns, setRevAddOns] = useState<string[]>(invoice.addOnIds || []);

  // Customer Preview Modal State (Read-Only, does not mint share links)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [customerPreview, setCustomerPreview] = useState<{
    publicRef: string;
    revision: number;
    status: string;
    customerFirstName: string;
    guests: number;
    lines: Array<{
      name: string;
      quantity: number;
      formattedUnitPrice: string;
      formattedLineTotal: string;
    }>;
    formattedTotal: string;
    formattedDeposit: string;
    formattedBalance: string;
    whatsAppMessagePreview: string;
    isDraftNotice: boolean;
  } | null>(null);

  const isOwner = userRole === 'owner';
  const isDraft = invoice.status === 'draft';
  const isIssued = invoice.status === 'issued';
  const isVoid = invoice.status === 'void';
  const isSuperseded = invoice.status === 'superseded';

  // Check if Web Share API supports file sharing asynchronously
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
        try {
          const dummyFile = new File(['dummy'], 'test.pdf', { type: 'application/pdf' });
          if (navigator.canShare({ files: [dummyFile] })) {
            setCanSharePdf(true);
          }
        } catch {
          setCanSharePdf(false);
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleApprove = async () => {
    if (!isOwner) return;
    setApproving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(invoice.publicRef)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve invoice.');
      }
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error approving invoice.');
    } finally {
      setApproving(false);
    }
  };

  const handlePrepareShare = async () => {
    if (!isOwner) return;
    setSharing(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(invoice.publicRef)}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to prepare share link.');
      }
      setShareData(data);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error preparing share link.');
    } finally {
      setSharing(false);
    }
  };

  const handleCopyMessage = async () => {
    if (!shareData?.message) return;
    try {
      await navigator.clipboard.writeText(shareData.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setErrorMsg('Failed to copy message to clipboard.');
    }
  };

  const handleSharePdf = async () => {
    try {
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(invoice.publicRef)}/pdf`);
      if (!res.ok) throw new Error('Failed to fetch invoice PDF.');
      const blob = await res.blob();
      const file = new File([blob], `${invoice.publicRef}.pdf`, { type: 'application/pdf' });
      if (navigator.share) {
        await navigator.share({
          title: `Invoice ${invoice.publicRef}`,
          files: [file],
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error sharing PDF.');
    }
  };

  const handleReviseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    if (!revReason.trim() || revReason.trim().length < 3) {
      setErrorMsg('A valid reason (minimum 3 characters) is required for revision.');
      return;
    }
    setRevising(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(invoice.publicRef)}/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: revReason.trim(),
          inputs: {
            packageId: revPackage,
            guests: Number(revGuests),
            zoneId: revZone || undefined,
            addOnIds: revAddOns,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revise invoice.');
      }
      setShowReviseModal(false);
      setRevReason('');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating invoice revision.');
    } finally {
      setRevising(false);
    }
  };

  const toggleAddOn = (id: string) => {
    setRevAddOns((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenCustomerPreview = async () => {
    setPreviewLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/invoices/${encodeURIComponent(invoice.publicRef)}/preview`);
      const data = await res.json();
      if (!res.ok || !data.preview) {
        throw new Error(data.error || 'Failed to load customer preview.');
      }
      setCustomerPreview(data.preview);
      setShowPreviewModal(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error loading customer preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatLagosDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Lagos',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6 min-w-0">
      {/* Back button */}
      <div>
        <Link
          href="/admin/invoices"
          className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--text-accent)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>Back to Invoices</span>
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle-card)] pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-mono font-bold text-[var(--text-primary)]">
                {invoice.publicRef}
              </h1>

              {/* Revision Tag */}
              <span className="px-2.5 py-0.5 rounded text-sm font-mono font-bold bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50 shadow-sm">
                Rev {invoice.revision}
              </span>

              {isDraft && (
                <span className="px-2.5 py-0.5 rounded text-sm font-bold uppercase bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]">
                  Draft
                </span>
              )}
              {isIssued && (
                <span className="px-2.5 py-0.5 rounded text-sm font-bold uppercase bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]">
                  Issued
                </span>
              )}
              {isVoid && (
                <span className="px-2.5 py-0.5 rounded text-sm font-bold uppercase bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border border-[var(--status-danger-border)]">
                  Void
                </span>
              )}
              {isSuperseded && (
                <span className="px-2.5 py-0.5 rounded text-sm font-bold uppercase bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border border-[var(--border-card)]">
                  Superseded
                </span>
              )}
              {invoice.label && (
                <span className="px-2.5 py-0.5 rounded text-sm font-medium bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]">
                  {invoice.label}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-body-muted)] mt-1.5">
              Created on {formatLagosDate(invoice.createdAt)}
              {invoice.revisedAt && ` · Revised on ${formatLagosDate(invoice.revisedAt)}`}
            </p>
            {invoice.revisionReason && (
              <p className="text-sm text-[var(--text-accent)] mt-1 italic">
                Revision reason: &quot;{invoice.revisionReason}&quot;
              </p>
            )}
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="text-sm text-[var(--text-body-muted)]">Grand Total</div>
            <div className="text-2xl font-bold text-[var(--text-accent)] price-tabular">
              {invoice.formattedTotal}
            </div>
          </div>
        </div>

        {/* Client details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
          <div className="space-y-1">
            <span className="text-[var(--text-body-muted)] flex items-center gap-1.5">
              <User className="w-4 h-4 shrink-0" /> Client Name:
            </span>
            <div className="font-semibold text-[var(--text-primary)] text-base">{invoice.customerName}</div>
          </div>
          <div className="space-y-1">
            <span className="text-[var(--text-body-muted)] flex items-center gap-1.5">
              <Phone className="w-4 h-4 shrink-0" /> Phone Number:
            </span>
            <div className="font-semibold text-[var(--text-primary)] text-sm font-mono price-tabular flex flex-wrap items-center gap-2">
              <span>
                {invoice.customerPhone
                  ? maskCustomerPhone(invoice.customerPhone, userRole, hasMfaVerified)
                  : 'Not provided'}
              </span>
              {invoice.customerPhone && !canViewUnmaskedCustomerPhone(userRole, hasMfaVerified) && (
                <span className="text-sm font-sans font-normal text-[var(--status-warning-text)]">
                  Masked (Owner + MFA required)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Payment terms breakdown */}
        <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-sm text-[var(--text-body-muted)] font-medium">70% Upfront Deposit</div>
            <div className="text-base font-bold text-[var(--text-money-positive)] mt-0.5 price-tabular">
              {invoice.formattedDeposit}
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--text-body-muted)] font-medium">30% Balance on Delivery</div>
            <div className="text-base font-bold text-[var(--text-accent)] mt-0.5 price-tabular">
              {invoice.formattedBalance}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-2 pt-2">
          <div className="text-sm font-bold text-[var(--text-body-muted)] uppercase tracking-wider">
            Estimate Breakdown
          </div>
          <div className="border border-[var(--border-subtle-card)] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle-card)] text-sm">
            {invoice.lines.map((line, idx) => {
              let formattedLineTotal = '';
              if (line.lineTotalKobo && /^\d+$/.test(line.lineTotalKobo)) {
                formattedLineTotal = formatNaira(BigInt(line.lineTotalKobo));
              }
              return (
                <div key={idx} className="p-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text-primary)]">{line.name}</div>
                    <div className="text-sm text-[var(--text-body-muted)]">Qty: {line.quantity}</div>
                  </div>
                  <div className="font-mono text-[var(--text-primary)] price-tabular shrink-0">
                    {formattedLineTotal}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revision History Section */}
        {invoice.versions && invoice.versions.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-[var(--border-subtle-card)]">
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-accent)] uppercase tracking-wider">
              <History className="w-4 h-4 shrink-0" />
              <span>Revision History ({invoice.versions.length} prior {invoice.versions.length === 1 ? 'version' : 'versions'})</span>
            </div>
            <div className="space-y-2">
              {invoice.versions.map((ver) => (
                <div key={ver.id} className="p-3.5 bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] rounded-xl text-sm space-y-1">
                  <div className="flex items-center justify-between font-mono gap-2">
                    <span className="font-bold text-[var(--text-primary)]">Rev {ver.revision} (Superseded)</span>
                    <span className="text-[var(--text-accent)] font-bold price-tabular">{ver.formattedTotal}</span>
                  </div>
                  <div className="text-sm text-[var(--text-body-muted)]">
                    Archived on {formatLagosDate(ver.changedAt)} · Reason: &quot;{ver.reason}&quot;
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Error Announcement */}
      {errorMsg && (
        <div
          role="alert"
          className="p-4 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl flex items-center gap-3 text-[var(--status-danger-text)] text-sm font-medium"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action panel */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5 sm:p-6 space-y-4">
        {/* DRAFT STATE: Approve invoice button only */}
        {isDraft && (
          <div className="space-y-3">
            <div className="text-sm text-[var(--text-body-muted)]">
              This invoice is currently a <strong className="text-[var(--text-primary)]">Draft</strong>. Review the figures above before issuing. Once issued, a 30-day secure link can be prepared and sent to the client on WhatsApp.
            </div>
            {isOwner ? (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approving}
                  className="w-full h-14 min-h-[56px] px-6 bg-[#6B1230] hover:bg-[#82173B] disabled:opacity-50 text-[#F7EFD9] border border-[#D4AF37]/60 text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <CheckCircle className="w-5 h-5 shrink-0" />
                  <span>{approving ? 'Approving Invoice...' : 'Approve Invoice'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenCustomerPreview}
                  disabled={previewLoading}
                  className="w-full min-h-[44px] px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-primary)] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                  <span>{previewLoading ? 'Loading Preview...' : 'Preview as customer'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-xl text-[var(--status-warning-text)] text-sm font-medium">
                  Staff and developer roles have read-only access. Only the account owner can approve draft invoices.
                </div>
                <button
                  type="button"
                  onClick={handleOpenCustomerPreview}
                  disabled={previewLoading}
                  className="w-full min-h-[44px] px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-primary)] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                  <span>{previewLoading ? 'Loading Preview...' : 'Preview as customer'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ISSUED STATE: Send on WhatsApp, Revise Invoice, Copy message, Share PDF */}
        {isIssued && (
          <div className="space-y-4">
            <div className="text-sm text-[var(--text-body-muted)]">
              Invoice has been officially issued. Tap below to send on WhatsApp or prepare a formal revision if the client altered guest counts or packages.
            </div>

            {/* Sharing stats */}
            <div className="text-sm text-[var(--text-body-muted)] bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] rounded-lg px-3.5 py-2.5">
              Link prepared {invoice.linksCount} {invoice.linksCount === 1 ? 'time' : 'times'}
              {invoice.lastSharedAt && `, last on ${formatLagosDate(invoice.lastSharedAt)}`}
            </div>

            {isOwner ? (
              <div className="space-y-3">
                {/* 1-Tap Full Width Green WhatsApp Button (>=56px high) */}
                <button
                  type="button"
                  onClick={handlePrepareShare}
                  disabled={sharing}
                  className="w-full h-14 min-h-[56px] px-6 bg-[#166534] hover:bg-[#14532D] disabled:opacity-50 text-[#FFFFFF] text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <Share2 className="w-5 h-5 shrink-0" />
                  <span>{sharing ? 'Preparing Link...' : 'Send invoice on WhatsApp'}</span>
                </button>

                {/* Secondary buttons row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Revise Button */}
                  <button
                    type="button"
                    onClick={() => setShowReviseModal(true)}
                    className="min-h-[48px] px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-accent)] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 shrink-0" />
                    <span>Revise Invoice</span>
                  </button>

                  {shareData?.message && (
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="min-h-[48px] px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-primary)] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-[var(--text-money-positive)] shrink-0" />
                      ) : (
                        <Copy className="w-4 h-4 shrink-0" />
                      )}
                      <span>{copied ? 'Message Copied!' : 'Copy message'}</span>
                    </button>
                  )}

                  {canSharePdf && (
                    <button
                      type="button"
                      onClick={handleSharePdf}
                      className="min-h-[48px] px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-primary)] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <Share2 className="w-4 h-4 shrink-0" />
                      <span>Share PDF</span>
                    </button>
                  )}

                  {/* Direct PDF Download link */}
                  <a
                    href={`/api/admin/invoices/${encodeURIComponent(invoice.publicRef)}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-primary)] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>Download PDF</span>
                  </a>

                  {/* Read-Only Customer Preview */}
                  <button
                    type="button"
                    onClick={handleOpenCustomerPreview}
                    disabled={previewLoading}
                    className="min-h-[48px] px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-primary)] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Eye className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                    <span>{previewLoading ? 'Loading...' : 'Preview as customer'}</span>
                  </button>
                </div>

                {shareData?.url && (
                  <div
                    role="status"
                    className="p-3.5 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-semibold text-[var(--status-success-text)]">
                      30-day WhatsApp invoice link ready.
                    </span>
                    <a
                      href={shareData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-[#166534] hover:bg-[#14532D] text-[#FFFFFF] font-bold inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4 shrink-0" />
                      <span>Open WhatsApp Chat</span>
                    </a>
                  </div>
                )}

                {shareData?.phoneProblem && (
                  <div
                    role="alert"
                    className="p-3.5 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-lg text-[var(--status-warning-text)] text-sm font-medium"
                  >
                    Customer phone is missing or invalid. Use &apos;Copy message&apos; to paste manually.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] rounded-xl text-[var(--text-body-muted)] text-sm">
                  Staff and developer roles can download the invoice PDF above, but only the owner may revise or generate customer WhatsApp share links.
                </div>
                <button
                  type="button"
                  onClick={handleOpenCustomerPreview}
                  disabled={previewLoading}
                  className="w-full min-h-[44px] px-4 bg-[var(--bg-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-primary)] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                  <span>{previewLoading ? 'Loading Preview...' : 'Preview as customer'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VOID OR EXPIRED STATE */}
        {isVoid && (
          <div className="space-y-2 text-sm text-[var(--status-danger-text)] bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl p-4">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" /> This invoice has been voided.
            </div>
            <p>Reason: {invoice.voidReason || 'No reason provided.'}</p>
          </div>
        )}
      </div>

      {/* REVISION MODAL */}
      {showReviseModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Revise Invoice ${invoice.publicRef}`}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle-card)] pb-3 gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Revise Invoice {invoice.publicRef}</h2>
                <p className="text-sm text-[var(--text-accent)]">
                  Creates Revision {invoice.revision + 1} · Supersedes Rev {invoice.revision}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReviseModal(false)}
                aria-label="Close revision modal"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-body-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviseSubmit} className="space-y-4 text-sm">
              {/* Revision Reason */}
              <div className="space-y-1.5">
                <label htmlFor="revise-reason" className="font-bold text-[var(--text-primary)] block">
                  Revision Reason (Required):
                </label>
                <input
                  id="revise-reason"
                  type="text"
                  required
                  value={revReason}
                  onChange={(e) => setRevReason(e.target.value)}
                  placeholder="e.g., Client requested guest count increase to 65"
                  className="w-full min-h-[44px] px-3 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] text-base sm:text-sm focus:border-[var(--border-gold)] focus:outline-none"
                />
              </div>

              {/* Package Tier */}
              {config?.tiers && config.tiers.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="revise-package" className="font-bold text-[var(--text-primary)] block">
                    Package Tier:
                  </label>
                  <select
                    id="revise-package"
                    value={revPackage}
                    onChange={(e) => setRevPackage(e.target.value)}
                    className="w-full min-h-[44px] px-3 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] text-base sm:text-sm focus:border-[var(--border-gold)] focus:outline-none"
                  >
                    {config.tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.formattedPrice} / guest)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Guest Count */}
              <div className="space-y-1.5">
                <label htmlFor="revise-guests" className="font-bold text-[var(--text-primary)] block">
                  Number of Guests:
                </label>
                <input
                  id="revise-guests"
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={revGuests}
                  onChange={(e) => setRevGuests(Number(e.target.value))}
                  className="w-full min-h-[44px] px-3 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] text-base sm:text-sm price-tabular focus:border-[var(--border-gold)] focus:outline-none"
                />
              </div>

              {/* Add-Ons */}
              {config?.addOns && config.addOns.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-bold text-[var(--text-primary)] block">Optional Add-ons:</span>
                  <div className="space-y-2 bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-subtle-card)]">
                    {config.addOns.map((addon) => (
                      <label key={addon.id} className="min-h-[44px] flex items-center gap-3 cursor-pointer text-[var(--text-primary)]">
                        <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={revAddOns.includes(addon.id)}
                            onChange={() => toggleAddOn(addon.id)}
                            className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer"
                          />
                          <Check
                            aria-hidden="true"
                            className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                          />
                        </div>
                        <span>{addon.name} (+{addon.formattedPrice})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Zone */}
              {config?.zones && config.zones.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="revise-zone" className="font-bold text-[var(--text-primary)] block">
                    Delivery Location / Zone:
                  </label>
                  <select
                    id="revise-zone"
                    value={revZone}
                    onChange={(e) => setRevZone(e.target.value)}
                    className="w-full min-h-[44px] px-3 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-[var(--text-primary)] text-base sm:text-sm focus:border-[var(--border-gold)] focus:outline-none"
                  >
                    <option value="">Pickup / Customer Collects (₦0.00)</option>
                    {config.zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} (+{z.formattedPrice})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle-card)]">
                <button
                  type="button"
                  onClick={() => setShowReviseModal(false)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--border-card)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revising}
                  className="min-h-[44px] px-6 py-2.5 bg-[#6B1230] hover:bg-[#82173B] disabled:opacity-50 text-[#F7EFD9] border border-[#D4AF37]/60 text-sm font-bold rounded-xl flex items-center gap-2 shadow-lg"
                >
                  {revising ? 'Creating Revision...' : `Confirm & Issue Rev ${invoice.revision + 1}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER PREVIEW MODAL (Read-Only, Zero Link Minting) */}
      {showPreviewModal && customerPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer Invoice Preview"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle-card)] pb-3 gap-3">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Customer View Preview</h2>
                <p className="text-sm text-[var(--text-accent)]">
                  Read-only preview · No share link or audit token minted
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                aria-label="Close customer preview modal"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-body-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {customerPreview.isDraftNotice && (
              <div className="p-3.5 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-xl text-[var(--status-warning-text)] text-sm font-medium">
                This invoice is still a Draft. Customers cannot view it until approved and shared.
              </div>
            )}

            <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] rounded-xl p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {customerPreview.publicRef} (Rev {customerPreview.revision})
                </span>
                <span className="font-bold text-[var(--text-accent)] text-base price-tabular">
                  {customerPreview.formattedTotal}
                </span>
              </div>
              <div className="text-[var(--text-body-muted)]">
                Prepared for <span className="text-[var(--text-primary)] font-semibold">{customerPreview.customerFirstName}</span> · {customerPreview.guests} guests
              </div>
              <div className="divide-y divide-[var(--border-subtle-card)] border-t border-[var(--border-subtle-card)] pt-2">
                {customerPreview.lines.map((line, i) => (
                  <div key={i} className="py-2 flex items-center justify-between gap-2">
                    <span className="text-[var(--text-primary)]">{line.name} × {line.quantity}</span>
                    <span className="font-mono text-[var(--text-primary)] price-tabular shrink-0">
                      {line.formattedLineTotal}
                    </span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle-card)]">
                <div>
                  <div className="text-[var(--text-body-muted)]">70% Deposit</div>
                  <div className="font-bold text-[var(--text-money-positive)] price-tabular">
                    {customerPreview.formattedDeposit}
                  </div>
                </div>
                <div>
                  <div className="text-[var(--text-body-muted)]">30% Balance</div>
                  <div className="font-bold text-[var(--text-accent)] price-tabular">
                    {customerPreview.formattedBalance}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm font-bold text-[var(--text-body-muted)] uppercase tracking-wider">
                WhatsApp Message Preview
              </div>
              <pre className="whitespace-pre-wrap bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] rounded-xl p-3.5 text-sm text-[var(--text-primary)] font-sans">
                {customerPreview.whatsAppMessagePreview}
              </pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border-subtle-card)]">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="min-h-[44px] px-5 py-2.5 bg-[#6B1230] hover:bg-[#82173B] text-[#F7EFD9] border border-[#D4AF37]/60 text-sm font-bold rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
