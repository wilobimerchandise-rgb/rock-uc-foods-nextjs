'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { formatMoneyKobo } from '../../../src/lib/money';
import {
  BUSINESS_CONTACT,
  ALLERGEN_NOTICE,
  PAYMENT_VERIFICATION_FRAUD_RULE,
} from '../../../src/policy/content';
import {
  CheckCircle2,
  Clock,
  Truck,
  Store,
  ArrowLeft,
  AlertCircle,
  Printer,
  ShoppingBag,
  Building2,
  Copy,
  Check,
  UploadCloud,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

interface OrderItemView {
  id: string;
  nameSnapshot: string;
  portionSnapshot?: string;
  selectedTierName?: string;
  selectedOptionsSnapshot?: Array<{ id: string; name: string; priceDeltaKobo: string }>;
  unitPriceKoboSnapshot: string;
  quantity: number;
  totalKoboSnapshot: string;
}

interface OrderView {
  id: string;
  orderCode: string;
  paymentReference?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: 'delivery' | 'collection';
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryFeeKobo: string;
  subtotalKobo: string;
  discountKobo?: string;
  totalKobo: string;
  paidAmountKobo?: string;
  status: string;
  specialInstructions?: string;
  policyVersion: string;
  policyAcceptedAt: string;
  expiresAt: string;
  createdAt: string;
  paymentVerifiedAt?: string;
  paymentVerifiedByName?: string;
  rejectionReason?: string;
  proofSummary?: {
    id: string;
    senderName: string;
    transferTime: string;
    paymentReference: string;
    receiptFileName?: string;
    submittedAt: string;
  };
  items: OrderItemView[];
}

interface BankDetailsView {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const resolvedParams = use(params);
  const code = resolvedParams.code;

  const [order, setOrder] = useState<OrderView | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetailsView | null>(null);
  const [bankMessage, setBankMessage] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [copiedField, setCopiedField] = useState<'account' | 'ref' | null>(null);

  // Proof Submission Form State
  const [senderName, setSenderName] = useState('');
  const [transferTime, setTransferTime] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const urlToken =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('token')
        : null;

    async function fetchOrder() {
      try {
        const qs = urlToken ? `?token=${encodeURIComponent(urlToken)}` : '';
        const res = await fetch(`/api/orders/${encodeURIComponent(code)}${qs}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok || !data.order) {
          throw new Error(data.error || 'Order not found or access denied');
        }
        if (isMounted) {
          setAccessToken(urlToken);
          setOrder(data.order);
          setBankDetails(data.bankDetails || null);
          setBankMessage(data.bankMessage || null);
        }
      } catch (err: any) {
        if (isMounted) {
          setAccessToken(urlToken);
          setError(err?.message || 'Could not load order');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void fetchOrder();

    return () => {
      isMounted = false;
    };
  }, [code]);

  // 7-hour countdown interval
  useEffect(() => {
    if (
      !order ||
      !['pending_payment', 'rejected', 'partial', 'proof_submitted'].includes(order.status)
    ) {
      return;
    }

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  const timeLeftSeconds =
    order && ['pending_payment', 'rejected', 'partial', 'proof_submitted'].includes(order.status)
      ? Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000))
      : null;

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopy = (val: string, field: 'account' | 'ref') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(val)
        .then(() => {
          setCopiedField(field);
          setTimeout(() => setCopiedField(null), 2000);
        })
        .catch(() => {
          // Clipboard permission may be unavailable in restricted contexts
        });
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setProofError(null);
    setProofSuccess(null);

    const trimmedSender = senderName.trim();
    if (trimmedSender.length < 2) {
      setProofError('Please enter the bank account holder name (minimum 2 characters).');
      return;
    }

    const parsedDate = new Date(transferTime);
    if (!transferTime || Number.isNaN(parsedDate.getTime())) {
      setProofError('Please select a valid transfer date and time.');
      return;
    }

    if (receiptFile) {
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowed.includes(receiptFile.type)) {
        setProofError('Only JPG, PNG, or PDF receipt files are allowed.');
        return;
      }
      if (receiptFile.size > 5 * 1024 * 1024) {
        setProofError('Receipt file must not exceed 5 MB.');
        return;
      }
    }

    setSubmittingProof(true);
    try {
      const formData = new FormData();
      formData.append('senderName', trimmedSender);
      formData.append('transferTime', parsedDate.toISOString());
      if (order.paymentReference) {
        formData.append('paymentReference', order.paymentReference);
      }
      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      const qs = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';
      const res = await fetch(`/api/orders/${encodeURIComponent(order.orderCode)}/proof${qs}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not upload payment proof. Please try again.');
      }

      setOrder(data.order);
      setReceiptFile(null);
      setProofSuccess(
        'Payment proof submitted. Our team is checking GTBank and will confirm shortly.'
      );
    } catch (err: any) {
      setProofError(err?.message || 'Upload failed. Please retry or check your receipt file.');
    } finally {
      setSubmittingProof(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'proof_submitted':
        return {
          label: 'Proof Submitted (Awaiting Confirmation)',
          color:
            'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
        };
      case 'partial':
        return {
          label: 'Partial Payment Recorded',
          color:
            'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
        };
      case 'paid':
      case 'payment_confirmed':
        return {
          label: 'Paid & Confirmed',
          color:
            'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
        };
      case 'in_kitchen':
        return {
          label: 'Cooking in Kitchen',
          color:
            'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]',
        };
      case 'ready_for_dispatch':
      case 'out_for_delivery':
        return {
          label: status === 'ready_for_dispatch' ? 'Ready for Dispatch' : 'Out for Delivery',
          color:
            'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]',
        };
      case 'delivered':
        return {
          label: 'Delivered Fresh',
          color:
            'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]',
        };
      case 'expired':
        return {
          label: 'Expired (7h Window Elapsed)',
          color:
            'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
        };
      case 'rejected':
        return {
          label: 'Proof Rejected',
          color:
            'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          color:
            'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]',
        };
      default:
        return {
          label: 'Awaiting Bank Transfer',
          color:
            'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]',
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-center p-6 space-y-3">
        <div className="w-10 h-10 border-2 border-[var(--border-gold)] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm uppercase tracking-wider text-[var(--text-accent)] font-semibold">
          Loading order status...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-center p-6 space-y-4">
        <AlertCircle className="w-12 h-12 text-[var(--text-error)]" />
        <h1 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
          Order Unavailable
        </h1>
        <p className="text-sm text-[var(--text-body-muted)] max-w-sm text-center leading-relaxed">
          {error || `Order '${code}' could not be retrieved or requires your tracking link.`}
        </p>
        <Link
          href="/menu"
          className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] mt-2 bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-text)] font-bold text-sm uppercase tracking-wider py-3 px-6 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          Return to Menu
        </Link>
      </div>
    );
  }

  const badge = getStatusBadge(order.status);
  const windowTimedOut =
    ['pending_payment', 'rejected', 'partial'].includes(order.status) &&
    timeLeftSeconds !== null &&
    timeLeftSeconds <= 0;
  const canSubmitProof =
    ['pending_payment', 'rejected', 'partial'].includes(order.status) && !windowTimedOut;

  const paidAmount = order.paidAmountKobo ? BigInt(order.paidAmountKobo) : 0n;
  const totalAmount = BigInt(order.totalKobo);
  const balanceDue = totalAmount > paidAmount ? totalAmount - paidAmount : 0n;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-card)] pb-4">
          <Link
            href="/menu"
            className="inline-flex items-center min-h-[44px] min-w-[44px] gap-2 text-sm uppercase tracking-wider text-[var(--text-accent)] hover:underline font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg pr-2"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Back to Menu</span>
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center min-h-[44px] min-w-[44px] gap-2 text-sm font-medium text-[var(--text-body-muted)] hover:text-[var(--text-accent)] transition-colors cursor-pointer px-3 rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Print Receipt</span>
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-3xl p-5 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-card)] pb-6">
            <div className="space-y-1">
              <span className="text-sm uppercase tracking-widest text-[var(--text-accent)] font-semibold block">
                Order Tracking &amp; Status
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[var(--text-primary)] tracking-tight">
                {order.orderCode}
              </h1>
              <p className="text-sm text-[var(--text-body-muted)]">
                Placed on{' '}
                {new Date(order.createdAt).toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })}
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <span
                className={`px-3.5 py-1.5 rounded-lg text-sm font-bold border uppercase tracking-wider ${badge.color}`}
              >
                {badge.label}
              </span>

              {timeLeftSeconds !== null && (
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-accent)] bg-[var(--bg-surface-muted)] px-3 py-1.5 rounded-lg border border-[var(--border-card)] font-medium">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>
                    Expires in:{' '}
                    <strong className="font-mono price-tabular">
                      {formatCountdown(timeLeftSeconds)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Expired Banner */}
          {(order.status === 'expired' || windowTimedOut) && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-sm text-[var(--status-danger-text)] flex items-start gap-3"
            >
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-base">Order Expired After 7 Hours</p>
                <p className="leading-relaxed">
                  This order was not confirmed paid within the 7-hour window and has expired. Please
                  call us on <span className="font-mono font-bold">08033729125</span> if you already
                  transferred so an admin can explicitly review and reopen your order.
                </p>
              </div>
            </div>
          )}

          {/* Rejected Proof Banner */}
          {order.status === 'rejected' && (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-sm text-[var(--status-danger-text)] flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-base">Previous Payment Proof Rejected</p>
                <p>
                  Reason: {order.rejectionReason || 'Payment not found on GTBank statement.'}
                </p>
                <p className="font-medium">Please resubmit accurate transfer details below.</p>
              </div>
            </div>
          )}

          {/* Partial Payment Banner */}
          {order.status === 'partial' && (
            <div className="p-4 rounded-2xl bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] text-sm text-[var(--status-warning-text)] space-y-1">
              <p className="font-bold text-base">Partial Payment Recorded</p>
              <p className="leading-relaxed">
                Paid so far:{' '}
                <strong className="font-mono price-tabular">{formatMoneyKobo(paidAmount)}</strong>{' '}
                &bull; Remaining Balance:{' '}
                <strong className="font-mono price-tabular">{formatMoneyKobo(balanceDue)}</strong>.
                Order will only move to Paid once full amount is confirmed by admin.
              </p>
            </div>
          )}

          {/* Proof Submitted Banner */}
          {order.status === 'proof_submitted' && order.proofSummary && (
            <div className="p-4 rounded-2xl bg-[var(--status-info-bg)] border border-[var(--status-info-border)] text-sm text-[var(--status-info-text)] space-y-1">
              <p className="font-bold text-base flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" /> Proof Submitted — Waiting for Admin
                Verification
              </p>
              <p className="leading-relaxed">
                Sender: <strong>{order.proofSummary.senderName}</strong> &bull; Reference:{' '}
                <span className="font-mono">{order.proofSummary.paymentReference}</span>
                {order.proofSummary.receiptFileName
                  ? ` • Receipt: ${order.proofSummary.receiptFileName}`
                  : ''}
              </p>
            </div>
          )}

          {/* Paid Verification Stamp */}
          {(order.status === 'paid' || order.status === 'payment_confirmed') && (
            <div className="p-4 rounded-2xl bg-[var(--status-success-bg)] border border-[var(--status-success-border)] text-sm text-[var(--status-success-text)] flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-base">Bank Transfer Confirmed by Admin</p>
                <p className="leading-relaxed">
                  Reference <span className="font-mono">{order.paymentReference}</span> confirmed
                  {order.paymentVerifiedByName ? ` by ${order.paymentVerifiedByName}` : ''}
                  {order.paymentVerifiedAt
                    ? ` on ${new Date(order.paymentVerifiedAt).toLocaleString('en-NG')}`
                    : ''}
                  .
                </p>
              </div>
            </div>
          )}

          {/* Bank Transfer Details Box */}
          {['pending_payment', 'proof_submitted', 'rejected', 'partial'].includes(order.status) && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-surface-muted)] border-2 border-[var(--border-gold)] space-y-4">
              <div className="flex items-center gap-2 text-base font-serif font-bold text-[var(--text-accent)]">
                <Building2 className="w-5 h-5 shrink-0" />
                <span>Manual Bank Transfer Instructions</span>
              </div>

              {bankDetails ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-card)]">
                  <div>
                    <span className="text-[var(--text-body-muted)] block text-sm">Bank Name</span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {bankDetails.bankName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-body-muted)] block text-sm">
                      Account Name
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {bankDetails.accountName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-body-muted)] block text-sm">
                      Account Number
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono price-tabular font-bold text-base text-[var(--text-accent)]">
                        {bankDetails.accountNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(bankDetails.accountNumber, 'account')}
                        className="min-w-[44px] min-h-[44px] rounded-lg border border-[var(--border-card)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] hover:border-[var(--border-gold)] inline-flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        aria-label="Copy account number"
                      >
                        {copiedField === 'account' ? (
                          <Check className="w-4 h-4 text-[var(--text-money-positive)]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[var(--text-body-muted)] block text-sm">
                      Exact Amount to Pay
                    </span>
                    <span className="font-mono price-tabular font-bold text-base text-[var(--text-money-positive)]">
                      {formatMoneyKobo(balanceDue > 0n ? balanceDue : totalAmount)}
                    </span>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-[var(--border-subtle-card)]">
                    <span className="text-[var(--text-body-muted)] block text-sm">
                      Required Transfer Narration / Payment Reference
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono font-bold text-base text-[var(--text-accent)]">
                        {order.paymentReference || order.orderCode}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(order.paymentReference || order.orderCode, 'ref')
                        }
                        className="min-w-[44px] min-h-[44px] rounded-lg border border-[var(--border-card)] bg-[var(--bg-surface-muted)] text-[var(--text-primary)] hover:border-[var(--border-gold)] inline-flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        aria-label="Copy payment reference"
                      >
                        {copiedField === 'ref' ? (
                          <Check className="w-4 h-4 text-[var(--text-money-positive)]" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm"
                >
                  {bankMessage || 'Payment details unavailable, contact us on 08033729125'}
                </div>
              )}

              {/* Customer Proof Upload Form */}
              {canSubmitProof && bankDetails && (
                <form
                  onSubmit={handleSubmitProof}
                  className="space-y-4 pt-3 border-t border-[var(--border-card)]"
                >
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-accent)] flex items-center gap-2">
                    <UploadCloud className="w-4 h-4 shrink-0" /> Submit Transfer Proof
                  </h3>

                  {proofError && (
                    <div
                      role="alert"
                      className="p-3 rounded-lg bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] text-sm"
                    >
                      {proofError}
                    </div>
                  )}
                  {proofSuccess && (
                    <div
                      role="status"
                      className="p-3 rounded-lg bg-[var(--status-success-bg)] border border-[var(--status-success-border)] text-[var(--status-success-text)] text-sm"
                    >
                      {proofSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <label
                        htmlFor="proof-sender-name"
                        className="block text-sm font-medium text-[var(--text-primary)] mb-1"
                      >
                        Bank Sender Name *
                      </label>
                      <input
                        id="proof-sender-name"
                        type="text"
                        required
                        minLength={2}
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Account holder name on receipt"
                        className="w-full min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-body-muted)] placeholder:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="proof-transfer-time"
                        className="block text-sm font-medium text-[var(--text-primary)] mb-1"
                      >
                        Transfer Date &amp; Time *
                      </label>
                      <input
                        id="proof-transfer-time"
                        type="datetime-local"
                        required
                        value={transferTime}
                        onChange={(e) => setTransferTime(e.target.value)}
                        className="w-full min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                      />
                    </div>
                  </div>

                  <div className="text-sm">
                    <label
                      htmlFor="proof-receipt-file"
                      className="block text-sm font-medium text-[var(--text-primary)] mb-1"
                    >
                      Receipt Image / PDF (Optional — JPG, PNG or PDF, max 5 MB)
                    </label>
                    <input
                      id="proof-receipt-file"
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      className="w-full min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-input)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[var(--cta-wine-bg)] file:text-[var(--cta-wine-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingProof}
                    className="w-full min-h-[48px] bg-[var(--cta-wine-bg)] hover:opacity-95 text-[var(--cta-wine-text)] border border-[var(--border-gold)] py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <UploadCloud className="w-4 h-4 text-[var(--icon-on-wine)] shrink-0" />
                    <span>{submittingProof ? 'Submitting Proof...' : 'Submit Payment Proof'}</span>
                  </button>
                </form>
              )}

              <p className="text-sm text-[var(--text-body-muted)] italic flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0 mt-0.5" />
                <span>{PAYMENT_VERIFICATION_FRAUD_RULE}</span>
              </p>
            </div>
          )}

          {/* Customer & Fulfilment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-1">
              <span className="text-sm uppercase font-bold tracking-wider text-[var(--text-accent)] block">
                Customer
              </span>
              <p className="font-semibold text-base text-[var(--text-primary)]">
                {order.customerName}
              </p>
              <p className="text-[var(--text-body-muted)] font-mono">{order.customerPhone}</p>
              {order.customerEmail && (
                <p className="text-[var(--text-body-muted)]">{order.customerEmail}</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-1">
              <div className="flex items-center gap-1.5 text-sm uppercase font-bold tracking-wider text-[var(--text-accent)]">
                {order.deliveryType === 'delivery' ? (
                  <>
                    <Truck className="w-4 h-4 shrink-0" />
                    <span>Lagos Delivery</span>
                  </>
                ) : (
                  <>
                    <Store className="w-4 h-4 shrink-0" />
                    <span>Kitchen Pick-up</span>
                  </>
                )}
              </div>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                {order.deliveryType === 'delivery'
                  ? order.deliveryAddress
                  : BUSINESS_CONTACT.collectionAddress}
              </p>
            </div>
          </div>

          {/* Itemized Snapshot */}
          <div className="space-y-3 border-t border-[var(--border-card)] pt-4">
            <h2 className="font-serif text-base font-bold uppercase tracking-wider text-[var(--text-accent)]">
              Itemized Receipt
            </h2>

            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] flex items-start justify-between gap-3 text-sm"
                >
                  <div>
                    <span className="font-bold text-[var(--text-primary)] block">
                      {item.quantity}x {item.nameSnapshot}
                    </span>
                    {item.selectedTierName && (
                      <span className="block text-sm text-[var(--text-accent)] font-semibold">
                        Size: {item.selectedTierName}
                      </span>
                    )}
                    {item.selectedOptionsSnapshot && item.selectedOptionsSnapshot.length > 0 && (
                      <span className="block text-sm text-[var(--text-body-muted)] italic">
                        + {item.selectedOptionsSnapshot.map((o) => o.name).join(', ')}
                      </span>
                    )}
                  </div>
                  <span className="font-mono price-tabular font-bold text-[var(--text-accent)] shrink-0 whitespace-nowrap">
                    {formatMoneyKobo(BigInt(item.totalKoboSnapshot))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="border-t border-[var(--border-card)] pt-4 space-y-2 text-sm">
            <div className="flex justify-between text-[var(--text-body-muted)]">
              <span>Subtotal</span>
              <span className="font-mono price-tabular">
                {formatMoneyKobo(BigInt(order.subtotalKobo))}
              </span>
            </div>
            {order.discountKobo && BigInt(order.discountKobo) > 0n && (
              <div className="flex justify-between text-[var(--text-money-positive)] font-semibold">
                <span>Promo Discount</span>
                <span className="font-mono price-tabular">
                  -{formatMoneyKobo(BigInt(order.discountKobo))}
                </span>
              </div>
            )}
            <div className="flex justify-between text-[var(--text-body-muted)]">
              <span>Fulfilment Fee</span>
              <span className="font-mono price-tabular">
                {formatMoneyKobo(BigInt(order.deliveryFeeKobo))}
              </span>
            </div>
            <div className="border-t border-[var(--border-gold)] pt-2.5 flex items-baseline justify-between text-base font-bold text-[var(--text-accent)]">
              <span>Grand Total</span>
              <span className="font-sans price-tabular text-xl whitespace-nowrap">
                {formatMoneyKobo(BigInt(order.totalKobo))}
              </span>
            </div>
          </div>

          {/* Allergen advisory */}
          <div className="p-3.5 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-card)] flex items-start gap-2.5 text-sm text-[var(--text-body-muted)] leading-relaxed">
            <ShoppingBag className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0 mt-0.5" />
            <span>{ALLERGEN_NOTICE}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
