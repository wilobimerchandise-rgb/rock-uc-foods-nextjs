/**
 * ROCK UC FOODS - Order Tracking & Confirmation Screen
 * Visual status pipeline, itemized snapshot receipt, live GTBank transfer instructions,
 * unique payment reference narration, 7-hour expiry countdown, and payment proof submission.
 */

import React, { useState, useEffect } from 'react';
import { Order, OrderStatus } from '../../types/order';
import { formatNaira } from '../../lib/money';
import {
  BUSINESS_CONTACT,
  ALLERGEN_NOTICE,
  PAYMENT_VERIFICATION_FRAUD_RULE,
} from '../../policy/content';
import { orderRepository } from '../../order/orderRepository';
import {
  getBusinessBankSettings,
  hasVerifiedBankSettings,
  MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
} from '../../lib/businessSettings';
import { NotificationHistoryDrawer } from '../notifications/NotificationHistoryDrawer';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Truck,
  PackageCheck,
  Copy,
  Check,
  Building2,
  ArrowLeft,
  Search,
  AlertCircle,
  ShieldCheck,
  UploadCloud,
  XCircle,
} from 'lucide-react';

interface OrderTrackingViewProps {
  initialOrder?: Order;
  onBackToMenu: () => void;
}

const STATUS_STEPS: {
  status: OrderStatus;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { status: 'pending_payment', label: 'Order Placed', icon: Clock },
  { status: 'paid', label: 'Payment Paid', icon: CheckCircle2 },
  { status: 'in_kitchen', label: 'Chef Cooking', icon: ChefHat },
  { status: 'out_for_delivery', label: 'On The Way', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: PackageCheck },
];

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialOrder,
  onBackToMenu,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order | undefined>(initialOrder);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedType, setCopiedType] = useState<'code' | 'account' | 'ref' | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Proof upload form state
  const [senderName, setSenderName] = useState('');
  const [transferTime, setTransferTime] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofSuccess, setProofSuccess] = useState<string | null>(null);

  const localInitial = getBusinessBankSettings();
  const [bankConfigured, setBankConfigured] = useState<boolean>(
    hasVerifiedBankSettings(localInitial)
  );
  const [bankSettings, setBankSettings] = useState<{
    bankName: string;
    accountName: string;
    accountNumber: string;
  } | null>(
    localInitial && hasVerifiedBankSettings(localInitial)
      ? {
          bankName: localInitial.bankName,
          accountName: localInitial.accountName,
          accountNumber: localInitial.accountNumber,
        }
      : null
  );

  useEffect(() => {
    let active = true;
    fetch('/api/ops/bank-details', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setBankConfigured(Boolean(data?.configured && data?.bankDetails));
        setBankSettings(data?.bankDetails || null);
      })
      .catch(() => {
        // Keep initial state when offline
      });
    return () => {
      active = false;
    };
  }, [currentOrder?.orderCode]);

  useEffect(() => {
    if (
      !currentOrder ||
      !['pending_payment', 'rejected', 'partial', 'proof_submitted'].includes(currentOrder.status)
    ) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [currentOrder]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    if (!searchQuery.trim()) return;

    const found = orderRepository.getByCode(searchQuery);
    if (found) {
      setCurrentOrder(orderRepository.syncExpiry(found.id) || found);
    } else {
      setSearchError(`No order found matching '${searchQuery}'. Please check the order code.`);
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'account' | 'ref') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrder) return;

    setProofError(null);
    setProofSuccess(null);

    if (receiptFile) {
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowed.includes(receiptFile.type)) {
        setProofError('Only JPG, PNG, or PDF receipt files are allowed.');
        return;
      }
      if (receiptFile.size > 5 * 1024 * 1024) {
        setProofError('Receipt file size must not exceed 5 MB.');
        return;
      }
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('senderName', senderName.trim());
      fd.append('transferTime', new Date(transferTime).toISOString());
      if (currentOrder.paymentReference) {
        fd.append('paymentReference', currentOrder.paymentReference);
      }
      if (receiptFile) {
        fd.append('receipt', receiptFile);
      }

      const tokenQs = currentOrder.trackingToken
        ? `?token=${encodeURIComponent(currentOrder.trackingToken)}`
        : '';
      const res = await fetch(
        `/api/orders/${encodeURIComponent(currentOrder.orderCode)}/proof${tokenQs}`,
        {
          method: 'POST',
          body: fd,
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success || !data.order) {
        throw new Error(data.error || 'Could not upload payment proof. Please try again.');
      }

      const raw = data.order;
      setCurrentOrder({
        ...raw,
        deliveryFeeKobo: BigInt(raw.deliveryFeeKobo),
        subtotalKobo: BigInt(raw.subtotalKobo),
        totalKobo: BigInt(raw.totalKobo),
        paidAmountKobo: raw.paidAmountKobo ? BigInt(raw.paidAmountKobo) : 0n,
        discountKobo: raw.discountKobo ? BigInt(raw.discountKobo) : undefined,
        trackingToken: currentOrder.trackingToken,
        items: (raw.items || []).map((i: any) => ({
          ...i,
          unitPriceKoboSnapshot: BigInt(i.unitPriceKoboSnapshot),
          totalKoboSnapshot: BigInt(i.totalKoboSnapshot),
        })),
      });
      setReceiptFile(null);
      setProofSuccess(
        'Transfer proof received! Admin verification against GTBank is pending.'
      );
    } catch (err: any) {
      setProofError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  if (!currentOrder) {
    return (
      <div className="max-w-xl mx-auto py-8 sm:py-12 px-4 text-[var(--text-primary)]">
        <button
          type="button"
          onClick={onBackToMenu}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-sm font-medium text-[var(--text-accent)] hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" /> Return to Menu
        </button>

        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
          <Search className="w-10 h-10 text-[var(--text-accent)] mx-auto" />
          <h2 className="font-serif font-bold text-xl text-[var(--text-primary)]">
            Track Your Order
          </h2>
          <p className="text-sm text-[var(--text-body-muted)] max-w-sm mx-auto">
            Enter your unique order code (e.g.{' '}
            <span className="font-mono text-[var(--text-accent)]">RUC-20261019-XXXX</span>) to check
            status.
          </p>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5 max-w-sm mx-auto">
            <label htmlFor="order-track-search-empty" className="sr-only">
              Order code
            </label>
            <input
              id="order-track-search-empty"
              type="text"
              placeholder="RUC-YYYYMMDD-XXXX"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl px-3.5 py-2 text-base font-mono text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] flex-1 focus:outline-none focus:border-[var(--border-gold)]"
            />
            <button
              type="submit"
              className="min-h-[44px] bg-[#6B1230] hover:bg-[#82173B] text-[#F7EFD9] border border-[#D4AF37]/50 px-5 py-2 text-sm font-semibold rounded-xl shrink-0"
            >
              Track
            </button>
          </form>

          {searchError && (
            <p
              role="alert"
              className="text-sm text-[var(--status-danger-text)] bg-[var(--status-danger-bg)] p-3 rounded-xl border border-[var(--status-danger-border)]"
            >
              {searchError}
            </p>
          )}
        </div>
      </div>
    );
  }

  const normalizedPipelineStatus =
    currentOrder.status === 'payment_confirmed'
      ? 'paid'
      : currentOrder.status === 'ready_for_dispatch'
      ? 'in_kitchen'
      : currentOrder.status === 'proof_submitted' || currentOrder.status === 'partial'
      ? 'pending_payment'
      : currentOrder.status;

  const statusOrderIndex = [
    'pending_payment',
    'paid',
    'in_kitchen',
    'out_for_delivery',
    'delivered',
  ].indexOf(normalizedPipelineStatus);

  const timeLeftSeconds = ['pending_payment', 'proof_submitted', 'partial', 'rejected'].includes(
    currentOrder.status
  )
    ? Math.max(0, Math.floor((new Date(currentOrder.expiresAt).getTime() - now) / 1000))
    : null;

  const formatCountdown = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const canUploadProof =
    ['pending_payment', 'rejected', 'partial'].includes(currentOrder.status) &&
    (timeLeftSeconds === null || timeLeftSeconds > 0);
  const paidKobo = currentOrder.paidAmountKobo ?? 0n;
  const remainingKobo =
    currentOrder.totalKobo > paidKobo ? currentOrder.totalKobo - paidKobo : 0n;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 text-[var(--text-primary)] space-y-6">
      {/* Back button & top search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackToMenu}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-sm font-medium text-[var(--text-accent)] hover:underline"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" /> Return to Menu
        </button>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <label htmlFor="order-track-search-top" className="sr-only">
            Search another order code
          </label>
          <input
            id="order-track-search-top"
            type="text"
            placeholder="Search other code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl px-3 py-2 text-base font-mono text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)] w-44 sm:w-52"
          />
          <button
            type="submit"
            className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] text-sm font-semibold text-[var(--text-accent)] hover:border-[var(--border-gold)]"
          >
            Find
          </button>
        </form>
      </div>

      {/* Main Order Card */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-5 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle-card)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm uppercase tracking-wider text-[var(--text-accent)] font-semibold">
                Order Reference
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(currentOrder.orderCode, 'code')}
                className="w-11 h-11 flex items-center justify-center rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)]"
                aria-label="Copy order code"
              >
                {copiedType === 'code' ? (
                  <Check className="w-4 h-4 text-[var(--text-money-positive)]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <h1 className="text-xl sm:text-2xl font-mono font-bold text-[var(--text-primary)] tracking-wider mt-0.5">
              {currentOrder.orderCode}
            </h1>
            <p className="text-sm text-[var(--text-body-muted)] mt-1">
              Placed on {new Date(currentOrder.createdAt).toLocaleDateString()} at{' '}
              {new Date(currentOrder.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="sm:text-right space-y-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-bold uppercase tracking-wider border ${
                currentOrder.status === 'delivered'
                  ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                  : currentOrder.status === 'out_for_delivery' ||
                    currentOrder.status === 'in_kitchen' ||
                    currentOrder.status === 'proof_submitted'
                  ? 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]'
                  : currentOrder.status === 'paid' || currentOrder.status === 'payment_confirmed'
                  ? 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]'
                  : currentOrder.status === 'expired' || currentOrder.status === 'rejected'
                  ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
                  : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
              }`}
            >
              <Clock className="w-4 h-4" />
              {currentOrder.status.replace(/_/g, ' ')}
            </span>
            <span className="block text-sm font-mono font-bold text-[var(--text-accent)] price-tabular">
              Total: {formatNaira(currentOrder.totalKobo)}
            </span>
            {timeLeftSeconds !== null && (
              <span className="block text-sm font-mono font-semibold text-[var(--status-warning-text)]">
                7h Payment Window: {formatCountdown(timeLeftSeconds)}
              </span>
            )}
          </div>
        </div>

        {/* Visual Progress Stepper */}
        <div>
          <h3 className="text-sm uppercase font-serif font-bold text-[var(--text-accent)] mb-4">
            Live Fulfillment Pipeline
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {STATUS_STEPS.map((s, idx) => {
              const isPastOrCurrent = statusOrderIndex >= idx;
              const isCurrent = statusOrderIndex === idx;
              const IconComp = s.icon;
              return (
                <div
                  key={s.status}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    isCurrent
                      ? 'bg-[#6B1230] border-[#D4AF37] text-[#F7EFD9] shadow-md'
                      : isPastOrCurrent
                      ? 'bg-[var(--status-success-bg)] border-[var(--status-success-border)] text-[var(--status-success-text)]'
                      : 'bg-[var(--bg-primary)] border-[var(--border-subtle-card)] text-[var(--text-body-muted)]'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {currentOrder.status === 'expired' && (
          <div className="p-4 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl text-sm text-[var(--status-danger-text)] flex items-start gap-2.5">
            <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              Order expired after 7 hours without payment confirmation. Contact us on{' '}
              <strong>08033729125</strong> if an admin needs to review and reopen your order.
            </span>
          </div>
        )}

        {currentOrder.status === 'partial' && (
          <div className="p-4 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-xl text-sm text-[var(--status-warning-text)]">
            Partial payment recorded: <strong>{formatNaira(paidKobo)}</strong>. Remaining due:{' '}
            <strong>{formatNaira(remainingKobo)}</strong>.
          </div>
        )}

        {currentOrder.status === 'rejected' && currentOrder.rejectionReason && (
          <div className="p-4 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl text-sm text-[var(--status-danger-text)]">
            Previous proof rejected: {currentOrder.rejectionReason}
          </div>
        )}

        {/* Bank Transfer Details & Proof Upload */}
        {['pending_payment', 'proof_submitted', 'partial', 'rejected'].includes(
          currentOrder.status
        ) && (
          <div className="p-4 sm:p-5 bg-[var(--bg-primary)] border-2 border-[var(--border-gold)] rounded-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
                <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">
                  Manual Bank Transfer Instructions
                </h3>
              </div>
              <span className="text-sm text-[var(--status-warning-text)] bg-[var(--status-warning-bg)] px-2.5 py-1 rounded-md border border-[var(--status-warning-border)] font-semibold">
                {currentOrder.status === 'proof_submitted'
                  ? 'Awaiting Admin Check'
                  : 'Action Required'}
              </span>
            </div>

            {bankConfigured && bankSettings ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-[var(--bg-card)] p-3.5 rounded-xl border border-[var(--border-subtle-card)]">
                <div>
                  <span className="text-[var(--text-body-muted)] block text-sm">Bank Name:</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {bankSettings.bankName}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-body-muted)] block text-sm">
                    Account Number:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[var(--text-accent)] text-sm">
                      {bankSettings.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankSettings.accountNumber, 'account')}
                      className="w-11 h-11 flex items-center justify-center rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)]"
                      aria-label="Copy account number"
                    >
                      {copiedType === 'account' ? (
                        <Check className="w-4 h-4 text-[var(--text-money-positive)]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-body-muted)] block text-sm">
                    Account Name:
                  </span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {bankSettings.accountName}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-body-muted)] block text-sm">
                    Amount to Transfer:
                  </span>
                  <span className="font-mono font-bold text-[var(--text-money-positive)] text-sm price-tabular">
                    {formatNaira(remainingKobo > 0n ? remainingKobo : currentOrder.totalKobo)}
                  </span>
                </div>
                <div className="sm:col-span-2 pt-2.5 border-t border-[var(--border-subtle-card)]">
                  <span className="text-[var(--text-body-muted)] block text-sm">
                    Transfer Narration Reference:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[var(--text-accent)] text-sm">
                      {currentOrder.paymentReference || currentOrder.orderCode}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          currentOrder.paymentReference || currentOrder.orderCode,
                          'ref'
                        )
                      }
                      className="w-11 h-11 flex items-center justify-center rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] text-[var(--text-primary)] hover:border-[var(--border-gold)]"
                      aria-label="Copy payment reference"
                    >
                      {copiedType === 'ref' ? (
                        <Check className="w-4 h-4 text-[var(--text-money-positive)]" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl text-[var(--status-danger-text)] text-sm">
                {MISSING_BANK_DETAILS_CHECKOUT_MESSAGE}
              </div>
            )}

            {canUploadProof && bankConfigured && (
              <form
                onSubmit={handleProofSubmit}
                className="space-y-3 pt-3 border-t border-[var(--border-subtle-card)]"
              >
                {proofError && (
                  <p
                    role="alert"
                    className="text-sm text-[var(--status-danger-text)] bg-[var(--status-danger-bg)] p-3 rounded-xl border border-[var(--status-danger-border)]"
                  >
                    {proofError}
                  </p>
                )}
                {proofSuccess && (
                  <p className="text-sm text-[var(--status-success-text)] bg-[var(--status-success-bg)] p-3 rounded-xl border border-[var(--status-success-border)]">
                    {proofSuccess}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <label
                      htmlFor="proof-sender-name"
                      className="block text-sm font-medium text-[var(--text-body-muted)] mb-1"
                    >
                      Sender Name *
                    </label>
                    <input
                      id="proof-sender-name"
                      type="text"
                      required
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Name on bank transfer"
                      className="w-full min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl px-3 py-2 text-base text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="proof-transfer-time"
                      className="block text-sm font-medium text-[var(--text-body-muted)] mb-1"
                    >
                      Transfer Time *
                    </label>
                    <input
                      id="proof-transfer-time"
                      type="datetime-local"
                      required
                      value={transferTime}
                      onChange={(e) => setTransferTime(e.target.value)}
                      className="w-full min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl px-3 py-2 text-base text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                    />
                  </div>
                </div>

                <div className="text-sm">
                  <label
                    htmlFor="proof-receipt-file"
                    className="block text-sm font-medium text-[var(--text-body-muted)] mb-1"
                  >
                    Optional Receipt (JPG/PNG/PDF, max 5 MB)
                  </label>
                  <input
                    id="proof-receipt-file"
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="w-full min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full min-h-[48px] bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 border border-[#D4AF37]/40 transition-colors disabled:opacity-50"
                >
                  <UploadCloud className="w-4 h-4 text-[#D4AF37]" />
                  <span>{uploading ? 'Uploading Proof...' : 'Submit Transfer Proof'}</span>
                </button>
              </form>
            )}

            <p className="text-sm text-[var(--text-body-muted)] italic flex items-start gap-2 pt-1">
              <ShieldCheck className="w-4 h-4 text-[var(--text-accent)] shrink-0 mt-0.5" />
              <span>{PAYMENT_VERIFICATION_FRAUD_RULE}</span>
            </p>
          </div>
        )}

        {/* Itemized Order Receipt */}
        <div>
          <h3 className="text-sm uppercase font-serif font-bold text-[var(--text-accent)] mb-3">
            Itemized Snapshot Receipt
          </h3>
          <div className="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-subtle-card)] p-4 space-y-2.5 text-sm">
            {currentOrder.items.map((item) => (
              <div
                key={item.id}
                className="flex justify-between items-center gap-3 py-2 border-b border-[var(--border-subtle-card)] last:border-0"
              >
                <div className="min-w-0">
                  <span className="font-medium text-[var(--text-primary)]">
                    {item.nameSnapshot}
                  </span>
                  <p className="text-sm text-[var(--text-body-muted)]">
                    {item.portionSnapshot ? `${item.portionSnapshot} • ` : ''}Qty: {item.quantity}{' '}
                    &times; {formatNaira(item.unitPriceKoboSnapshot)}
                  </p>
                </div>
                <span className="font-mono font-bold text-[var(--text-primary)] price-tabular shrink-0">
                  {formatNaira(item.totalKoboSnapshot)}
                </span>
              </div>
            ))}

            <div className="pt-3 border-t border-[var(--border-subtle-card)] space-y-1.5 font-mono text-sm">
              <div className="flex justify-between text-[var(--text-body-muted)]">
                <span>Food Subtotal:</span>
                <span className="price-tabular">{formatNaira(currentOrder.subtotalKobo)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-body-muted)]">
                <span>Delivery / Dispatch Fee:</span>
                <span className="price-tabular">{formatNaira(currentOrder.deliveryFeeKobo)}</span>
              </div>
              <div className="pt-2 border-t border-[var(--border-subtle-card)] flex justify-between font-bold text-base text-[var(--text-accent)]">
                <span>Total Reconciled:</span>
                <span className="price-tabular">{formatNaira(currentOrder.totalKobo)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Fulfillment Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-subtle-card)]">
          <div>
            <span className="text-[var(--text-accent)] font-serif font-bold block mb-1">
              Customer Contact
            </span>
            <p className="text-[var(--text-primary)]">{currentOrder.customerName}</p>
            <p className="font-mono text-[var(--text-body-muted)]">{currentOrder.customerPhone}</p>
            {currentOrder.customerEmail && (
              <p className="text-[var(--text-body-muted)]">{currentOrder.customerEmail}</p>
            )}
          </div>

          <div>
            <span className="text-[var(--text-accent)] font-serif font-bold block mb-1">
              Fulfillment Mode
            </span>
            <p className="text-[var(--text-primary)] uppercase font-semibold text-sm">
              {currentOrder.deliveryType === 'collection' ? 'Self Collection' : 'Doorstep Delivery'}
            </p>
            <p className="text-[var(--text-body-muted)] text-sm">
              {currentOrder.deliveryType === 'collection'
                ? BUSINESS_CONTACT.collectionAddress
                : currentOrder.deliveryAddress}
            </p>
            {currentOrder.specialInstructions && (
              <p className="text-[var(--text-accent)] italic text-sm mt-1">
                Note: {currentOrder.specialInstructions}
              </p>
            )}
          </div>
        </div>

        {/* Live Dispatched Alerts History */}
        <NotificationHistoryDrawer orderId={currentOrder.id} />

        {/* Allergen Reminder Footer */}
        <div className="p-3.5 bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] rounded-xl text-sm text-[var(--text-body-muted)] flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--text-accent)] shrink-0 mt-0.5" />
          <span>{ALLERGEN_NOTICE}</span>
        </div>
      </div>
    </div>
  );
};
