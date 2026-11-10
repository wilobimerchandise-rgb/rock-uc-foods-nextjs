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
} from 'lucide-react';

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

export function AdminInvoiceDetailClient({ invoice, userRole, config }: InvoiceDetailProps) {
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
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/admin/invoices"
          className="inline-flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Invoices</span>
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-[#17120F] border border-white/10 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-mono font-bold text-white">
                {invoice.publicRef}
              </h1>

              {/* Revision Tag */}
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow-sm">
                Rev {invoice.revision}
              </span>

              {isDraft && (
                <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Draft
                </span>
              )}
              {isIssued && (
                <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Issued
                </span>
              )}
              {isVoid && (
                <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-red-500/20 text-red-300 border border-red-500/40">
                  Void
                </span>
              )}
              {isSuperseded && (
                <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-white/10 text-white/60 border border-white/20">
                  Superseded
                </span>
              )}
              {invoice.label && (
                <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  {invoice.label}
                </span>
              )}
            </div>
            <p className="text-xs text-white/60 mt-1">
              Created on {formatLagosDate(invoice.createdAt)}
              {invoice.revisedAt && ` · Revised on ${formatLagosDate(invoice.revisedAt)}`}
            </p>
            {invoice.revisionReason && (
              <p className="text-xs text-[#D4AF37] mt-0.5 italic">
                Revision reason: &quot;{invoice.revisionReason}&quot;
              </p>
            )}
          </div>

          <div className="text-left sm:text-right">
            <div className="text-xs text-white/50">Grand Total</div>
            <div className="text-2xl font-bold text-[#D4AF37]">
              {invoice.formattedTotal}
            </div>
          </div>
        </div>

        {/* Client details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
          <div className="space-y-1">
            <span className="text-white/50 flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Client Name:
            </span>
            <div className="font-semibold text-white text-sm">{invoice.customerName}</div>
          </div>
          <div className="space-y-1">
            <span className="text-white/50 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" /> Phone Number:
            </span>
            <div className="font-semibold text-white text-sm">
              {invoice.customerPhone || 'Not provided'}
            </div>
          </div>
        </div>

        {/* Payment terms breakdown */}
        <div className="bg-[#0B0A09] border border-white/10 rounded-xl p-4 grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-[11px] text-white/50 font-medium">70% Upfront Deposit</div>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {invoice.formattedDeposit}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-white/50 font-medium">30% Balance on Delivery</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              {invoice.formattedBalance}
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-2 pt-2">
          <div className="text-xs font-bold text-white/70 uppercase tracking-wider">
            Estimate Breakdown
          </div>
          <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5 text-xs">
            {invoice.lines.map((line, idx) => (
              <div key={idx} className="p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium text-white">{line.name}</div>
                  <div className="text-[11px] text-white/50">Qty: {line.quantity}</div>
                </div>
                <div className="font-mono text-white/80">
                  {line.lineTotalKobo ? `₦${(Number(line.lineTotalKobo) / 100).toLocaleString()}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revision History Section */}
        {invoice.versions && invoice.versions.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 text-xs font-bold text-[#D4AF37] uppercase tracking-wider">
              <History className="w-4 h-4" />
              <span>Revision History ({invoice.versions.length} prior {invoice.versions.length === 1 ? 'version' : 'versions'})</span>
            </div>
            <div className="space-y-2">
              {invoice.versions.map((ver) => (
                <div key={ver.id} className="p-3 bg-black/40 border border-white/5 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-bold text-white/90">Rev {ver.revision} (Superseded)</span>
                    <span className="text-[#D4AF37]">{ver.formattedTotal}</span>
                  </div>
                  <div className="text-[11px] text-white/50">
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
        <div role="alert" className="p-4 bg-red-950/80 border border-red-500/50 rounded-xl flex items-center gap-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Action panel */}
      <div className="bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
        {/* DRAFT STATE: Approve invoice button only */}
        {isDraft && (
          <div className="space-y-3">
            <div className="text-xs text-white/70">
              This invoice is currently a <strong>Draft</strong>. Review the figures above before issuing. Once issued, a 30-day secure link can be prepared and sent to the client on WhatsApp.
            </div>
            {isOwner ? (
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving}
                className="w-full h-14 min-h-[56px] px-6 bg-[#6B1230] hover:bg-[#8B1A3E] disabled:opacity-50 text-[#F7EFD9] text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{approving ? 'Approving Invoice...' : 'Approve Invoice'}</span>
              </button>
            ) : (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-200 text-xs">
                Staff and developer roles have read-only access. Only the account owner can approve draft invoices.
              </div>
            )}
          </div>
        )}

        {/* ISSUED STATE: Send on WhatsApp, Revise Invoice, Copy message, Share PDF */}
        {isIssued && (
          <div className="space-y-4">
            <div className="text-xs text-white/70">
              Invoice has been officially issued. Tap below to send on WhatsApp or prepare a formal revision if the client altered guest counts or packages.
            </div>

            {/* Sharing stats */}
            <div className="text-xs text-white/50 bg-[#0B0A09] border border-white/5 rounded-lg px-3 py-2">
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
                  className="w-full h-14 min-h-[56px] px-6 bg-[#1E7E34] hover:bg-[#155724] active:bg-[#0E3E1A] disabled:opacity-50 text-white text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <Share2 className="w-5 h-5" />
                  <span>{sharing ? 'Preparing Link...' : 'Send invoice on WhatsApp'}</span>
                </button>

                {/* Secondary buttons row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Revise Button */}
                  <button
                    type="button"
                    onClick={() => setShowReviseModal(true)}
                    className="min-h-[48px] px-4 bg-[#17120F] hover:bg-[#D4AF37]/10 border border-[#D4AF37]/50 text-[#D4AF37] text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Revise Invoice</span>
                  </button>

                  {shareData?.message && (
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="min-h-[48px] px-4 bg-[#17120F] hover:bg-white/5 border border-white/20 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? 'Message Copied!' : 'Copy message'}</span>
                    </button>
                  )}

                  {canSharePdf && (
                    <button
                      type="button"
                      onClick={handleSharePdf}
                      className="min-h-[48px] px-4 bg-[#17120F] hover:bg-white/5 border border-white/20 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share PDF</span>
                    </button>
                  )}

                  {/* Direct PDF Download link */}
                  <a
                    href={`/api/admin/invoices/${encodeURIComponent(invoice.publicRef)}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[48px] px-4 bg-[#17120F] hover:bg-white/5 border border-white/20 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </a>
                </div>

                {shareData?.phoneProblem && (
                  <div role="alert" className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-xs">
                    Customer phone is missing or invalid. Use &apos;Copy message&apos; to paste manually.
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-white/70 text-xs">
                Staff and developer roles can download the invoice PDF above, but only the owner may revise or generate customer WhatsApp share links.
              </div>
            )}
          </div>
        )}

        {/* VOID OR EXPIRED STATE */}
        {isVoid && (
          <div className="space-y-2 text-xs text-red-300">
            <div className="font-bold flex items-center gap-1.5 text-red-400">
              <ShieldAlert className="w-4 h-4" /> This invoice has been voided.
            </div>
            <p>Reason: {invoice.voidReason || 'No reason provided.'}</p>
          </div>
        )}
      </div>

      {/* REVISION MODAL */}
      {showReviseModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17120F] border border-[#D4AF37]/50 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Revise Invoice {invoice.publicRef}</h2>
                <p className="text-xs text-[#D4AF37]">Creates Revision {invoice.revision + 1} · Supersedes Rev {invoice.revision}</p>
              </div>
              <button
                onClick={() => setShowReviseModal(false)}
                className="p-2 text-white/60 hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReviseSubmit} className="space-y-4 text-xs">
              {/* Revision Reason */}
              <div className="space-y-1.5">
                <label className="font-bold text-white/90">
                  Revision Reason (Required):
                </label>
                <input
                  type="text"
                  required
                  value={revReason}
                  onChange={(e) => setRevReason(e.target.value)}
                  placeholder="e.g., Client requested guest count increase to 65"
                  className="w-full h-11 px-3 bg-[#0B0A09] border border-white/20 rounded-xl text-white text-sm focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              {/* Package Tier */}
              {config?.tiers && config.tiers.length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-bold text-white/90">Package Tier:</label>
                  <select
                    value={revPackage}
                    onChange={(e) => setRevPackage(e.target.value)}
                    className="w-full h-11 px-3 bg-[#0B0A09] border border-white/20 rounded-xl text-white text-sm focus:border-[#D4AF37] focus:outline-none"
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
                <label className="font-bold text-white/90">Number of Guests:</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={revGuests}
                  onChange={(e) => setRevGuests(Number(e.target.value))}
                  className="w-full h-11 px-3 bg-[#0B0A09] border border-white/20 rounded-xl text-white text-sm focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              {/* Add-Ons */}
              {config?.addOns && config.addOns.length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-bold text-white/90">Optional Add-ons:</label>
                  <div className="space-y-2 bg-[#0B0A09] p-3 rounded-xl border border-white/10">
                    {config.addOns.map((addon) => (
                      <label key={addon.id} className="flex items-center gap-2 cursor-pointer text-white/80 hover:text-white">
                        <input
                          type="checkbox"
                          checked={revAddOns.includes(addon.id)}
                          onChange={() => toggleAddOn(addon.id)}
                          className="w-4 h-4 rounded border-white/20 text-[#6B1230] focus:ring-[#D4AF37]"
                        />
                        <span>{addon.name} (+{addon.formattedPrice})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Zone */}
              {config?.zones && config.zones.length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-bold text-white/90">Delivery Location / Zone:</label>
                  <select
                    value={revZone}
                    onChange={(e) => setRevZone(e.target.value)}
                    className="w-full h-11 px-3 bg-[#0B0A09] border border-white/20 rounded-xl text-white text-sm focus:border-[#D4AF37] focus:outline-none"
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
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowReviseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/20 text-white/70 hover:text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={revising}
                  className="px-6 py-2.5 bg-[#6B1230] hover:bg-[#8B1A3E] disabled:opacity-50 text-[#F7EFD9] text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg"
                >
                  {revising ? 'Creating Revision...' : `Confirm & Issue Rev ${invoice.revision + 1}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
