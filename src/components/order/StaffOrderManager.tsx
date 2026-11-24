'use client';

/**
 * ROCK UC FOODS - Staff / Owner Live Order Manager
 * Authoritative bank transfer verification (amount & narration reference check),
 * partial payment tracking, rejected proof & audited expired-order reopen controls,
 * status pipeline transitions, deterministic refund calculator, and Section 35 hardening.
 */

import React, { useState } from 'react';
import { orderRepository } from '../../order/orderRepository';
import { Order, OrderStatus } from '../../types/order';
import { formatNaira, parseNairaToKobo } from '../../lib/money';
import { calculateRefund } from '../../policy/refund';
import { maskCustomerPhone, canViewUnmaskedCustomerPhone } from '../../lib/security';
import {
  CheckCircle2,
  ChefHat,
  Truck,
  PackageCheck,
  Search,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  X,
  Building2,
  XCircle,
  Check,
  PhoneCall,
} from 'lucide-react';
import { StaffPhoneOrderModal } from './StaffPhoneOrderModal';

interface StaffOrderManagerProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  currentUserId: string;
  hasMfaVerified?: boolean;
}

function getNowTimestamp(): number {
  return Date.now();
}

export const StaffOrderManager: React.FC<StaffOrderManagerProps> = ({
  currentUserRole,
  currentUserId,
  hasMfaVerified = false,
}) => {
  const isOwnerOrDev = currentUserRole === 'owner' || currentUserRole === 'developer';
  const canViewPhones = canViewUnmaskedCustomerPhone(currentUserRole, hasMfaVerified);

  const [orders, setOrders] = useState<Order[]>(() =>
    orderRepository.getAll({ expireStale: true })
  );
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Per-order bank verification inputs
  const [receivedAmountsNaira, setReceivedAmountsNaira] = useState<Record<string, string>>({});
  const [bankAppChecked, setBankAppChecked] = useState<Record<string, boolean>>({});
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  // Refund calculation modal state
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [cookingStarted, setCookingStarted] = useState<boolean>(false);
  const [refundCalculation, setRefundCalculation] = useState<any>(null);
  const [showPhoneOrderModal, setShowPhoneOrderModal] = useState<boolean>(false);

  const refreshOrders = () => {
    setOrders(orderRepository.getAll({ expireStale: true }));
  };

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const getDefaultAmountNaira = (order: Order) => {
    if (receivedAmountsNaira[order.id] !== undefined) {
      return receivedAmountsNaira[order.id];
    }
    const whole = order.totalKobo / 100n;
    const kobo = order.totalKobo % 100n;
    return `${whole.toString()}.${kobo.toString().padStart(2, '0')}`;
  };

  const callAdminConfirmApi = async (payload: Record<string, unknown>, successMsg: string) => {
    setBusyOrderId(String(payload.orderId || ''));
    try {
      const res = await fetch('/api/admin/orders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Admin confirmation action failed.');
      }
      refreshOrders();
      notify(successMsg);
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleConfirmPaid = async (order: Order) => {
    const nairaInput = getDefaultAmountNaira(order);
    try {
      parseNairaToKobo(nairaInput);
    } catch (err: any) {
      notify(err.message || 'Invalid Naira amount.', 'error');
      return;
    }

    await callAdminConfirmApi(
      {
        action: 'confirm_paid',
        orderId: order.id,
        paymentReference: order.paymentReference || order.orderCode,
        amountReceivedNaira: nairaInput,
        isBankAppCreditConfirmed: Boolean(bankAppChecked[order.id]),
      },
      `Payment confirmed for ${order.orderCode} (${order.paymentReference || ''}).`
    );
  };

  const handleRecordPartial = async (order: Order) => {
    const nairaInput = getDefaultAmountNaira(order);
    try {
      parseNairaToKobo(nairaInput);
    } catch (err: any) {
      notify(err.message || 'Invalid Naira amount.', 'error');
      return;
    }

    await callAdminConfirmApi(
      {
        action: 'record_partial',
        orderId: order.id,
        paymentReference: `${order.paymentReference || order.orderCode}-P${Date.now()
          .toString()
          .slice(-4)}`,
        amountReceivedNaira: nairaInput,
        isBankAppCreditConfirmed: Boolean(bankAppChecked[order.id]),
      },
      `Partial payment recorded for ${order.orderCode}. Status remains 'partial'.`
    );
  };

  const handleRejectProof = async (order: Order) => {
    await callAdminConfirmApi(
      {
        action: 'reject',
        orderId: order.id,
        reason: 'Bank credit or narration reference not found on GTBank statement.',
      },
      `Proof rejected for ${order.orderCode}. Customer may resubmit.`
    );
  };

  const handleReopenExpired = async (order: Order) => {
    await callAdminConfirmApi(
      {
        action: 'reopen',
        orderId: order.id,
        reason: 'Late GTBank credit verified by admin — explicit audited reopen.',
      },
      `Expired order ${order.orderCode} reopened for verification and logged.`
    );
  };

  const handleAdvanceStatus = (order: Order, nextStatus: OrderStatus) => {
    try {
      orderRepository.updateStatus(order.id, nextStatus, { actorUserId: currentUserId });
      refreshOrders();
      notify(`Order ${order.orderCode} status updated to '${nextStatus.replace(/_/g, ' ')}'.`);
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const handleOpenRefundModal = (order: Order) => {
    setRefundOrder(order);
    try {
      const calc = calculateRefund({
        classification: 'fresh',
        foodSubtotalKobo: order.subtotalKobo,
        deliveryFeeKobo: order.deliveryFeeKobo,
        verifiedPaidKobo:
          order.status === 'paid' || order.status === 'payment_confirmed'
            ? order.totalKobo
            : order.paidAmountKobo ?? 0n,
        orderTimestampMs: new Date(order.createdAt).getTime(),
        cancellationTimestampMs: getNowTimestamp(),
        cookingStarted,
      });
      setRefundCalculation(calc);
    } catch {
      setRefundCalculation(null);
    }
  };

  const handleRecalculateRefund = (cooking: boolean) => {
    setCookingStarted(cooking);
    if (!refundOrder) return;
    try {
      const calc = calculateRefund({
        classification: 'fresh',
        foodSubtotalKobo: refundOrder.subtotalKobo,
        deliveryFeeKobo: refundOrder.deliveryFeeKobo,
        verifiedPaidKobo:
          refundOrder.status === 'paid' || refundOrder.status === 'payment_confirmed'
            ? refundOrder.totalKobo
            : refundOrder.paidAmountKobo ?? 0n,
        orderTimestampMs: new Date(refundOrder.createdAt).getTime(),
        cancellationTimestampMs: getNowTimestamp(),
        cookingStarted: cooking,
      });
      setRefundCalculation(calc);
    } catch {
      setRefundCalculation(null);
    }
  };

  const handleConfirmCancellation = () => {
    if (!refundOrder) return;
    try {
      orderRepository.updateStatus(refundOrder.id, 'cancelled', { actorUserId: currentUserId });
      refreshOrders();
      notify(
        `Order ${refundOrder.orderCode} cancelled. Refund advice: ${
          refundCalculation ? formatNaira(refundCalculation.eligibleRefundKobo) : '₦0.00'
        }`
      );
      setRefundOrder(null);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== 'all' && o.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = o.customerName.toLowerCase().includes(query);
      const matchPhone = canViewPhones
        ? o.customerPhone.includes(query)
        : o.customerPhone.slice(-4).includes(query);
      const matchCode = o.orderCode.toLowerCase().includes(query);
      const matchRef = (o.paymentReference || '').toLowerCase().includes(query);
      return matchName || matchPhone || matchCode || matchRef;
    }
    return true;
  });

  const FILTER_CHIPS = [
    'all',
    'pending_payment',
    'proof_submitted',
    'partial',
    'paid',
    'payment_confirmed',
    'in_kitchen',
    'out_for_delivery',
    'delivered',
    'expired',
    'rejected',
    'cancelled',
  ];

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen p-4 md:p-6 max-w-5xl mx-auto space-y-6 min-w-0 w-full max-w-full">
      {/* Top Banner */}
      {notification && (
        <div
          role={notification.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl text-sm font-semibold flex items-center gap-2 border ${
            notification.type === 'error'
              ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
              : 'bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)] border-[var(--status-neutral-border)]'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#D4AF37]" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[var(--text-primary)]">
              Order Management
            </h1>
            <span className="text-sm uppercase font-bold px-2.5 py-0.5 rounded-md bg-[#D4AF37] text-[#0B0A09]">
              Role: {currentUserRole}
            </span>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Match GTBank transfer references &amp; exact Naira totals before confirming paid orders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPhoneOrderModal(true)}
            data-testid="open-phone-order-modal-btn"
            className="btn-luxury text-sm font-bold inline-flex items-center gap-2 shrink-0"
          >
            <PhoneCall className="w-4 h-4 shrink-0" />
            <span>New Phone / WhatsApp Order</span>
          </button>

          <button
            type="button"
            onClick={refreshOrders}
            className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-primary)] px-4 py-2 rounded-xl text-sm font-semibold hover:border-[var(--border-gold)] inline-flex items-center gap-2 shrink-0"
          >
            <RefreshCw className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
            <span>Refresh Orders</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 min-w-0 w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-[var(--text-body-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Search orders"
            placeholder="Search by customer, phone, order code, or RUC-ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl pl-10 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
          />
        </div>

        {/* Filter Chip Row Scroll Container with Right Fade */}
        <div
          className="relative w-full sm:w-auto min-w-0 max-w-full flex-1"
          data-testid="filter-chip-wrapper"
        >
          <div
            className="w-full max-w-full overflow-x-auto [overscroll-behavior-x:contain] no-scrollbar min-w-0 pb-1"
            data-testid="filter-chip-scroll"
          >
            <div
              className="flex items-center gap-2 w-[max-content] min-w-max flex-nowrap text-sm pr-4"
              data-testid="filter-chip-row"
            >
              {FILTER_CHIPS.map((status) => (
                <button
                  type="button"
                  key={status}
                  data-testid={`filter-chip-${status}`}
                  onClick={() => setFilterStatus(status)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl font-semibold shrink-0 transition-all border ${
                    filterStatus === status
                      ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                      : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)] border-[var(--border-subtle-card)]'
                  }`}
                >
                  {status.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-[var(--bg-primary)] to-transparent"
            aria-hidden="true"
            data-testid="filter-chip-fade"
          />
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4 min-w-0">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] text-sm">
            No orders found matching the filter criteria.
          </div>
        ) : (
          filteredOrders.map((order) => {
            const needsVerification = [
              'pending_payment',
              'proof_submitted',
              'partial',
              'rejected',
            ].includes(order.status);

            const receiptInputId = `order-received-naira-${order.id}`;
            const bankCheckId = `order-gtbank-checked-${order.id}`;

            return (
              <div
                key={order.id}
                className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] hover:border-[var(--border-gold)] rounded-xl p-4 sm:p-5 space-y-4 transition-all min-w-0"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle-card)]">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-mono font-bold text-base text-[var(--text-primary)] price-tabular">
                      {order.orderCode}
                    </span>
                    {order.paymentReference && (
                      <span className="font-mono text-sm px-2.5 py-0.5 rounded-md bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-accent)] price-tabular">
                        Ref: {order.paymentReference}
                      </span>
                    )}
                    <span
                      className={`text-sm font-bold uppercase px-2.5 py-0.5 rounded-md border ${
                        order.status === 'delivered'
                          ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                          : order.status === 'out_for_delivery' || order.status === 'proof_submitted'
                          ? 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]'
                          : order.status === 'paid' || order.status === 'payment_confirmed' || order.status === 'in_kitchen'
                          ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]/60'
                          : order.status === 'cancelled' ||
                            order.status === 'expired' ||
                            order.status === 'rejected'
                          ? 'bg-[var(--status-danger-bg)] text-[var(--status-danger-text)] border-[var(--status-danger-border)]'
                          : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                      }`}
                    >
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-sm text-[var(--text-body-muted)] price-tabular shrink-0">
                    {new Date(order.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    &bull;{' '}
                    <span className="font-mono font-bold text-[var(--text-accent)] price-tabular">
                      {formatNaira(order.totalKobo)}
                    </span>
                  </div>
                </div>

                {/* Customer and Items Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm min-w-0">
                  <div className="min-w-0">
                    <span className="text-[var(--text-body-muted)] text-sm block font-semibold">
                      Customer:
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {order.customerName}
                    </span>{' '}
                    <span className="font-mono price-tabular text-[var(--text-body-muted)]">
                      ({maskCustomerPhone(order.customerPhone, currentUserRole, hasMfaVerified)})
                    </span>
                    <p className="text-sm text-[var(--text-body-muted)] mt-1 break-words">
                      {order.deliveryType === 'collection'
                        ? 'Collection at 5 Aro St.'
                        : order.deliveryAddress}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <span className="text-[var(--text-body-muted)] text-sm block font-semibold">
                      Dishes Snapshot:
                    </span>
                    <div className="space-y-1 mt-0.5">
                      {order.items.map((i) => (
                        <div
                          key={i.id}
                          className="text-sm text-[var(--text-primary)] flex justify-between gap-2"
                        >
                          <span className="min-w-0 break-words">
                            {i.quantity}&times; {i.nameSnapshot}
                          </span>
                          <span className="font-mono price-tabular shrink-0">
                            {formatNaira(i.totalKoboSnapshot)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submitted Proof Summary */}
                {order.proofSummary && (
                  <div className="p-3 rounded-xl bg-[var(--status-info-bg)] border border-[var(--status-info-border)] text-sm text-[var(--status-info-text)] space-y-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 shrink-0" /> Customer Proof Submitted
                    </div>
                    <div className="break-words">
                      Sender: <strong>{order.proofSummary.senderName}</strong> &bull; Transfer Time:{' '}
                      <span className="font-mono price-tabular">
                        {new Date(order.proofSummary.transferTime).toLocaleString()}
                      </span>
                      {order.proofSummary.receiptFileName && (
                        <span>
                          {' '}
                          &bull; File:{' '}
                          <span className="font-mono">{order.proofSummary.receiptFileName}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {order.paidAmountKobo !== undefined &&
                  order.paidAmountKobo > 0n &&
                  order.paidAmountKobo < order.totalKobo && (
                    <div className="text-sm font-mono price-tabular text-[var(--status-warning-text)]">
                      Partial Paid: {formatNaira(order.paidAmountKobo)} / Expected:{' '}
                      {formatNaira(order.totalKobo)}
                    </div>
                  )}

                {/* Manual Bank Transfer Confirmation Controls */}
                {needsVerification && (
                  <div className="p-3.5 bg-[var(--bg-surface-muted)] border border-[var(--border-card)] rounded-xl space-y-3 text-sm">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <label
                        htmlFor={bankCheckId}
                        className="flex items-center gap-2.5 text-sm text-[var(--text-primary)] cursor-pointer min-h-[44px]"
                      >
                        <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                          <input
                            id={bankCheckId}
                            type="checkbox"
                            checked={Boolean(bankAppChecked[order.id])}
                            onChange={(e) =>
                              setBankAppChecked((prev) => ({
                                ...prev,
                                [order.id]: e.target.checked,
                              }))
                            }
                            className="peer appearance-none w-11 h-11 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)] checked:bg-[#6B1230] checked:border-[#D4AF37] cursor-pointer"
                          />
                          <Check
                            aria-hidden="true"
                            className="w-5 h-5 text-[#F7EFD9] pointer-events-none absolute opacity-0 peer-checked:opacity-100"
                          />
                        </div>
                        <span>
                          Checked GTBank app for ref{' '}
                          <strong className="font-mono text-[var(--text-accent)]">
                            {order.paymentReference || order.orderCode}
                          </strong>
                        </span>
                      </label>

                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={receiptInputId}
                          className="text-sm text-[var(--text-body-muted)] shrink-0 font-semibold"
                        >
                          Received (₦):
                        </label>
                        <input
                          id={receiptInputId}
                          type="text"
                          value={getDefaultAmountNaira(order)}
                          onChange={(e) =>
                            setReceivedAmountsNaira((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                          className="w-full min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm font-mono price-tabular text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busyOrderId === order.id}
                        onClick={() => handleConfirmPaid(order)}
                        className="min-h-[44px] bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/60 px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 shadow disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" /> Confirm payment
                      </button>

                      <button
                        type="button"
                        disabled={busyOrderId === order.id}
                        onClick={() => handleRecordPartial(order)}
                        className="min-h-[44px] bg-[var(--status-warning-bg)] hover:opacity-90 text-[var(--status-warning-text)] border border-[var(--status-warning-border)] px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                      >
                        Record Partial Payment
                      </button>

                      <button
                        type="button"
                        disabled={busyOrderId === order.id}
                        onClick={() => handleRejectProof(order)}
                        className="min-h-[44px] bg-[var(--status-danger-bg)] hover:opacity-90 text-[var(--status-danger-text)] border border-[var(--status-danger-border)] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reject Proof
                      </button>
                    </div>
                  </div>
                )}

                {/* Audited Reopen Control for Expired Orders */}
                {order.status === 'expired' && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle-card)]">
                    <button
                      type="button"
                      disabled={busyOrderId === order.id}
                      onClick={() => handleReopenExpired(order)}
                      className="min-h-[44px] bg-[var(--status-warning-bg)] hover:opacity-90 text-[var(--status-warning-text)] border border-[var(--status-warning-border)] px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" /> Reopen Expired Order (Audited)
                    </button>
                  </div>
                )}

                {/* Pipeline Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle-card)]">
                  {(order.status === 'paid' || order.status === 'payment_confirmed') && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(order, 'in_kitchen')}
                      className="min-h-[44px] bg-[#5B2A6E] hover:opacity-90 text-[#F7EFD9] border border-[#D4AF37]/40 px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      <ChefHat className="w-4 h-4" /> Start Cooking
                    </button>
                  )}

                  {order.status === 'in_kitchen' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(order, 'out_for_delivery')}
                      className="min-h-[44px] bg-[#1E40AF] hover:bg-[#1E3A8A] text-white border border-[#93C5FD]/40 px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      <Truck className="w-4 h-4" /> Dispatch for Delivery
                    </button>
                  )}

                  {order.status === 'out_for_delivery' && (
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(order, 'delivered')}
                      className="min-h-[44px] bg-[#166534] hover:bg-[#14532D] text-white border border-[#86EFAC]/40 px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                      <PackageCheck className="w-4 h-4" /> Mark Delivered
                    </button>
                  )}

                  {isOwnerOrDev &&
                    order.status !== 'cancelled' &&
                    order.status !== 'delivered' &&
                    order.status !== 'expired' && (
                      <button
                        type="button"
                        onClick={() => handleOpenRefundModal(order)}
                        className="min-h-[44px] bg-[var(--status-danger-bg)] hover:opacity-90 text-[var(--status-danger-text)] border border-[var(--status-danger-border)] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 ml-auto"
                      >
                        <RotateCcw className="w-4 h-4" /> Cancel / Refund Engine
                      </button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Deterministic Refund Calculation Modal */}
      {refundOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-engine-modal-title"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl max-w-md w-full p-6 text-[var(--text-primary)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle-card)]">
              <h3 id="refund-engine-modal-title" className="font-serif font-bold text-lg text-[var(--text-primary)]">
                Refund &amp; Cancellation Engine (Section 17.7)
              </h3>
              <button
                type="button"
                aria-label="Close refund dialog"
                onClick={() => setRefundOrder(null)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-body-muted)]">
              Order <span className="font-mono font-bold text-[var(--text-accent)]">{refundOrder.orderCode}</span>{' '}
              for {refundOrder.customerName}.
            </p>

            <div className="space-y-3 text-sm bg-[var(--bg-surface-muted)] p-4 rounded-xl border border-[var(--border-subtle-card)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>Cooking status:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRecalculateRefund(false)}
                    className={`min-h-[44px] px-3 py-1.5 rounded-lg text-sm border ${
                      !cookingStarted
                        ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37] font-bold'
                        : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)]'
                    }`}
                  >
                    Not Started
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecalculateRefund(true)}
                    className={`min-h-[44px] px-3 py-1.5 rounded-lg text-sm border ${
                      cookingStarted
                        ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37] font-bold'
                        : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)]'
                    }`}
                  >
                    Started
                  </button>
                </div>
              </div>

              {refundCalculation && (
                <div className="pt-2 border-t border-[var(--border-subtle-card)] space-y-1.5 font-mono text-sm">
                  <div className="flex justify-between text-[var(--text-body-muted)]">
                    <span>Eligible Refund:</span>
                    <span className="font-bold text-[var(--text-money-positive)] price-tabular">
                      {formatNaira(refundCalculation.eligibleRefundKobo)}
                    </span>
                  </div>
                  <p className="text-sm font-sans text-[var(--text-body-muted)] leading-snug pt-1">
                    Reason: {refundCalculation.reason}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundOrder(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleConfirmCancellation}
                className="min-h-[44px] bg-[#B3261E] hover:bg-[#8E1D17] text-white font-bold px-4 py-2 rounded-xl text-sm"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Staff Phone / WhatsApp Order Entry Modal */}
      {showPhoneOrderModal && (
        <StaffPhoneOrderModal
          onClose={() => setShowPhoneOrderModal(false)}
          onOrderCreated={(summary) => {
            refreshOrders();
            notify(summary);
          }}
        />
      )}
    </div>
  );
};
