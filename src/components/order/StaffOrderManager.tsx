/**
 * ROCK UC FOODS - Staff / Owner Live Order Manager
 * (Playbook v2 Section 8, 10 & Section 17 v3 Addendum)
 * Authoritative payment verification, status pipeline transitions,
 * audit logging, and refund calculation execution.
 */

import React, { useState } from 'react';
import { orderRepository } from '../../order/orderRepository';
import { Order, OrderStatus } from '../../types/order';
import { formatNaira } from '../../lib/money';
import { calculateRefund } from '../../policy/refund';
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Truck,
  PackageCheck,
  Search,
  RefreshCw,
  Building2,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
} from 'lucide-react';

interface StaffOrderManagerProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  currentUserId: string;
}

function getManualPaymentRef(): string {
  return `MANUAL-VERIFIED-${Date.now().toString().slice(-6)}`;
}

function getNowTimestamp(): number {
  return Date.now();
}

export const StaffOrderManager: React.FC<StaffOrderManagerProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const isOwnerOrDev = currentUserRole === 'owner' || currentUserRole === 'developer';

  const [orders, setOrders] = useState<Order[]>(() => orderRepository.getAll());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Refund calculation state modal
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState<string>('Customer requested cancellation before cooking started');
  const [cookingStarted, setCookingStarted] = useState<boolean>(false);
  const [refundCalculation, setRefundCalculation] = useState<any>(null);

  const refreshOrders = () => {
    setOrders(orderRepository.getAll());
  };

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleVerifyPayment = (order: Order) => {
    try {
      const updated = orderRepository.updateStatus(order.id, 'payment_confirmed', {
        actorUserId: currentUserId,
        paymentReference: getManualPaymentRef(),
      });
      refreshOrders();
      notify(`Payment verified for order ${updated.orderCode}. Ready for kitchen.`);
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
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
        verifiedPaidKobo: order.status === 'pending_payment' ? 0n : order.totalKobo,
        orderTimestampMs: new Date(order.createdAt).getTime(),
        cancellationTimestampMs: getNowTimestamp(),
        cookingStarted: cookingStarted,
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
        verifiedPaidKobo: refundOrder.status === 'pending_payment' ? 0n : refundOrder.totalKobo,
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
      notify(`Order ${refundOrder.orderCode} cancelled. Refund advice: ${refundCalculation ? formatNaira(refundCalculation.eligibleRefundKobo) : '₦0.00'}`);
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
      const matchPhone = o.customerPhone.includes(query);
      const matchCode = o.orderCode.toLowerCase().includes(query);
      return matchName || matchPhone || matchCode;
    }
    return true;
  });

  return (
    <div className="bg-[#0B0A09] text-[#F7EFD9] min-h-screen p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Banner */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs md:text-sm font-semibold flex items-center gap-2 ${
            notification.type === 'error'
              ? 'bg-[#B3261E] text-white'
              : 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[#F7EFD9]">Order Management</h1>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#D4AF37] text-[#0B0A09]">
              Role: {currentUserRole}
            </span>
          </div>
          <p className="text-xs text-[#F7EFD9]/60 mt-1">
            Verify bank payments, track preparation, and advance kitchen/dispatch pipeline.
          </p>
        </div>

        <button
          onClick={refreshOrders}
          className="bg-[#17120F] border border-white/15 px-3 py-1.5 rounded text-xs font-semibold hover:border-[#D4AF37] flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#D4AF37]" /> Refresh Orders
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by customer name, phone, or order code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#17120F] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {['all', 'pending_payment', 'payment_confirmed', 'in_kitchen', 'out_for_delivery', 'delivered', 'cancelled'].map(
            (status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all ${
                  filterStatus === status
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                    : 'bg-[#17120F] text-white/60 hover:text-white border border-white/5'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-[#17120F] rounded-2xl border border-white/5 text-white/50 text-xs">
            No orders found matching the filter criteria.
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-[#17120F] border border-white/10 hover:border-[#D4AF37]/40 rounded-xl p-4 sm:p-5 space-y-4 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#F7EFD9]">{order.orderCode}</span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      order.status === 'delivered'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : order.status === 'out_for_delivery'
                        ? 'bg-blue-950 text-blue-300 border border-blue-700'
                        : order.status === 'in_kitchen'
                        ? 'bg-purple-950 text-purple-300 border border-purple-700'
                        : order.status === 'payment_confirmed'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : order.status === 'cancelled'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-700'
                    }`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="text-xs text-white/50">
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                  &bull; <span className="font-mono font-bold text-[#D4AF37]">{formatNaira(order.totalKobo)}</span>
                </div>
              </div>

              {/* Customer and Items Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-white/50 text-[11px] block">Customer:</span>
                  <span className="font-semibold text-[#F7EFD9]">{order.customerName}</span>{' '}
                  <span className="font-mono text-white/70">({order.customerPhone})</span>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {order.deliveryType === 'collection' ? 'Collection at 5 Aro St.' : order.deliveryAddress}
                  </p>
                </div>

                <div>
                  <span className="text-white/50 text-[11px] block">Dishes Snapshot:</span>
                  <div className="space-y-0.5">
                    {order.items.map((i) => (
                      <div key={i.id} className="text-[11px] text-[#F7EFD9]/80 flex justify-between">
                        <span>
                          {i.quantity}&times; {i.nameSnapshot}
                        </span>
                        <span className="font-mono">{formatNaira(i.totalKoboSnapshot)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions Toolbar */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
                {order.status === 'pending_payment' && (
                  <button
                    onClick={() => handleVerifyPayment(order)}
                    className="bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/50 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" /> Confirm Bank Payment
                  </button>
                )}

                {order.status === 'payment_confirmed' && (
                  <button
                    onClick={() => handleAdvanceStatus(order, 'in_kitchen')}
                    className="bg-purple-900/80 hover:bg-purple-800 text-purple-100 border border-purple-500/50 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5"
                  >
                    <ChefHat className="w-3.5 h-3.5" /> Start Cooking
                  </button>
                )}

                {order.status === 'in_kitchen' && (
                  <button
                    onClick={() => handleAdvanceStatus(order, 'out_for_delivery')}
                    className="bg-blue-900/80 hover:bg-blue-800 text-blue-100 border border-blue-500/50 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5" /> Dispatch for Delivery
                  </button>
                )}

                {order.status === 'out_for_delivery' && (
                  <button
                    onClick={() => handleAdvanceStatus(order, 'delivered')}
                    className="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-500/50 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5"
                  >
                    <PackageCheck className="w-3.5 h-3.5" /> Mark Delivered
                  </button>
                )}

                {isOwnerOrDev && order.status !== 'cancelled' && order.status !== 'delivered' && (
                  <button
                    onClick={() => handleOpenRefundModal(order)}
                    className="bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-700/60 px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 ml-auto"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Cancel / Refund Engine
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Deterministic Refund Calculation Modal */}
      {refundOrder && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#17120F] border border-[#D4AF37] rounded-xl max-w-md w-full p-6 text-[#F7EFD9] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base text-[#F7EFD9]">
                Refund &amp; Cancellation Engine (Section 17.7)
              </h3>
              <button onClick={() => setRefundOrder(null)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/70">
              Order <span className="font-mono font-bold text-[#D4AF37]">{refundOrder.orderCode}</span> for{' '}
              {refundOrder.customerName}.
            </p>

            <div className="space-y-2 text-xs bg-[#0B0A09] p-3 rounded-lg border border-white/5">
              <div className="flex items-center justify-between">
                <span>Cooking status:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRecalculateRefund(false)}
                    className={`px-2 py-1 rounded text-[11px] ${
                      !cookingStarted ? 'bg-[#6B1230] text-white font-bold' : 'bg-black/30 text-white/60'
                    }`}
                  >
                    Not Started
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRecalculateRefund(true)}
                    className={`px-2 py-1 rounded text-[11px] ${
                      cookingStarted ? 'bg-[#6B1230] text-white font-bold' : 'bg-black/30 text-white/60'
                    }`}
                  >
                    Started
                  </button>
                </div>
              </div>

              {refundCalculation && (
                <div className="pt-2 border-t border-white/10 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between text-white/70">
                    <span>Eligible Refund:</span>
                    <span className="font-bold text-emerald-400">
                      {formatNaira(refundCalculation.eligibleRefundKobo)}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/50 leading-tight pt-1">
                    Reason: {refundCalculation.reason}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundOrder(null)}
                className="px-3 py-1.5 rounded text-xs text-white/70 hover:text-white"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleConfirmCancellation}
                className="bg-rose-900 hover:bg-rose-800 text-white font-bold px-4 py-1.5 rounded text-xs"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
