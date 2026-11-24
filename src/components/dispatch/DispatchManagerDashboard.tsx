'use client';

/**
 * ROCK UC FOODS - Rider Dispatch & Delivery Dashboard
 * Playbook v2 Section 13 / Phase 4 Dispatch & Section 35
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { DispatchAssignment } from '../../types/dispatch';
import { Order } from '../../types/order';
import { formatNaira } from '../../lib/money';
import { maskCustomerPhone } from '../../lib/security';

interface DispatchManagerDashboardProps {
  currentUserRole?: 'owner' | 'staff' | 'developer';
  hasMfaVerified?: boolean;
}

export function DispatchManagerDashboard({
  currentUserRole = 'staff',
  hasMfaVerified = false,
}: DispatchManagerDashboardProps = {}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [assignments, setAssignments] = useState<DispatchAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOrder, setAssignModalOrder] = useState<Order | null>(null);
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderPlate, setRiderPlate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [ordersRes, dispatchRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/dispatch'),
      ]);

      const ordersData = await ordersRes.json();
      const dispatchData = await dispatchRes.json();

      if (ordersRes.ok) {
        setOrders(ordersData.orders || []);
      }
      if (dispatchRes.ok) {
        setAssignments(dispatchData.assignments || []);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const load = () => {
      Promise.all([
        fetch('/api/orders?status=active').then((r) => r.json()),
        fetch('/api/dispatch').then((r) => r.json()),
      ])
        .then(([ordersData, dispatchData]) => {
          if (!ignore) {
            if (ordersData.orders) setOrders(ordersData.orders);
            if (dispatchData.assignments) setAssignments(dispatchData.assignments);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    };
    load();
    const interval = setInterval(load, 6000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  const handleAssignRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalOrder) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_rider',
          orderId: assignModalOrder.id,
          riderName,
          riderPhone,
          riderVehiclePlate: riderPlate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to assign rider.');
      } else {
        setSuccessMsg(`Rider ${riderName} dispatched successfully for #${assignModalOrder.orderCode}.`);
        setAssignModalOrder(null);
        setRiderName('');
        setRiderPhone('');
        setRiderPlate('');
        await fetchData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch rider.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelivery = async (orderId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_delivery',
          orderId,
          customerSignatureConfirmed: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to confirm delivery.');
      } else {
        setSuccessMsg('Delivery confirmed and marked complete.');
        await fetchData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to confirm delivery.');
    }
  };

  const readyOrders = orders.filter((o) => o.status === 'ready_for_dispatch');
  const inTransitOrders = orders.filter((o) => o.status === 'out_for_delivery');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');

  return (
    <div className="space-y-6 text-[var(--text-primary)] min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Rider Dispatch &amp; Handover Hub
            </h2>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Dispatch fleet management, E.164 phone validation (+234...), and customer handover confirmation.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          disabled={loading}
          className="min-h-[44px] inline-flex items-center justify-center space-x-2 px-4 py-2 bg-[var(--bg-card)] hover:border-[var(--border-gold)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--text-accent)] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Fleet</span>
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl text-sm text-[var(--status-danger-text)] flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          role="status"
          className="p-3.5 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-xl text-sm text-[var(--status-success-text)] flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-2xl">
          <span className="text-sm text-[var(--status-warning-text)] font-semibold uppercase flex items-center gap-1.5">
            <Package className="w-4 h-4 shrink-0" /> Packaged &amp; Awaiting Rider
          </span>
          <div className="text-2xl font-black text-[var(--status-warning-text)] price-tabular mt-1">
            {readyOrders.length}
          </div>
          <span className="text-sm text-[var(--status-warning-text)] opacity-90">
            Thermal sealed boxes ready
          </span>
        </div>

        <div className="p-4 bg-[var(--status-info-bg)] border border-[var(--status-info-border)] rounded-2xl">
          <span className="text-sm text-[var(--status-info-text)] font-semibold uppercase flex items-center gap-1.5">
            <Truck className="w-4 h-4 shrink-0" /> Out For Delivery (In Transit)
          </span>
          <div className="text-2xl font-black text-[var(--status-info-text)] price-tabular mt-1">
            {inTransitOrders.length}
          </div>
          <span className="text-sm text-[var(--status-info-text)] opacity-90">
            Riders on the road
          </span>
        </div>

        <div className="p-4 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-2xl">
          <span className="text-sm text-[var(--status-success-text)] font-semibold uppercase flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Successfully Delivered
          </span>
          <div className="text-2xl font-black text-[var(--status-success-text)] price-tabular mt-1">
            {deliveredOrders.length}
          </div>
          <span className="text-sm text-[var(--status-success-text)] opacity-90">
            Completed handovers
          </span>
        </div>
      </div>

      {/* Section 1: Ready for Rider Assignment */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          Orders Awaiting Rider Handover ({readyOrders.length})
        </h3>

        {readyOrders.length === 0 ? (
          <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-2xl text-center text-sm text-[var(--text-body-muted)]">
            No orders currently waiting for rider assignment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {readyOrders.map((order) => (
              <div
                key={order.id}
                className="p-5 bg-[var(--bg-card)] border border-[var(--status-warning-border)] rounded-2xl space-y-3 flex flex-col justify-between min-w-0"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle-card)]">
                    <span className="font-mono text-sm font-bold text-[var(--text-accent)]">
                      #{order.orderCode}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-primary)] font-mono price-tabular">
                      {formatNaira(order.totalKobo)}
                    </span>
                  </div>

                  <div className="pt-2 text-sm text-[var(--text-body-muted)] space-y-1">
                    <div className="font-bold text-[var(--text-primary)]">{order.customerName}</div>
                    <div className="text-sm text-[var(--text-body-muted)]">
                      {order.deliveryAddress || 'Kitchen Pickup'}
                    </div>
                    <div className="text-[var(--text-body-muted)] font-mono price-tabular text-sm">
                      Customer Phone: {maskCustomerPhone(order.customerPhone, currentUserRole, hasMfaVerified)}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAssignModalOrder(order)}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#92400E] hover:bg-[#78350F] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow"
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>Assign Delivery Rider</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Active In-Transit Deliveries */}
      <div className="space-y-3 pt-4 border-t border-[var(--border-subtle-card)]">
        <h3 className="text-base font-bold text-[var(--text-primary)]">
          In-Transit Deliveries ({inTransitOrders.length})
        </h3>

        {inTransitOrders.length === 0 ? (
          <div className="p-6 bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-2xl text-center text-sm text-[var(--text-body-muted)]">
            No riders currently on the road.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inTransitOrders.map((order) => {
              const assignment = assignments.find((a) => a.orderId === order.id);

              return (
                <div
                  key={order.id}
                  className="p-5 bg-[var(--bg-card)] border border-[var(--status-info-border)] rounded-2xl space-y-3 flex flex-col justify-between min-w-0"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle-card)]">
                      <div className="min-w-0">
                        <span className="font-mono text-sm font-bold text-[var(--status-info-text)] block">
                          #{order.orderCode}
                        </span>
                        <span className="text-sm text-[var(--text-body-muted)]">
                          {order.customerName}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-[var(--text-primary)] font-mono price-tabular shrink-0">
                        {formatNaira(order.totalKobo)}
                      </span>
                    </div>

                    <div className="pt-2 text-sm space-y-2">
                      <div className="p-3 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle-card)]">
                        <span className="text-sm text-[var(--text-body-muted)] uppercase font-bold block mb-1">
                          Dispatched Rider
                        </span>
                        <div className="text-[var(--text-primary)] font-bold flex items-center justify-between gap-2">
                          <span>{assignment ? assignment.riderName : 'Dispatched Fleet'}</span>
                          {assignment?.riderVehiclePlate && (
                            <span className="text-sm bg-[var(--bg-card)] px-2 py-0.5 rounded font-mono text-[var(--text-accent)] border border-[var(--border-card)]">
                              {assignment.riderVehiclePlate}
                            </span>
                          )}
                        </div>
                        {assignment && (
                          <div className="text-sm text-[var(--status-info-text)] font-mono price-tabular mt-0.5">
                            {assignment.riderPhone}
                          </div>
                        )}
                      </div>

                      <div className="text-sm text-[var(--text-body-muted)]">
                        <span className="font-semibold text-[var(--text-primary)]">Destination:</span>{' '}
                        {order.deliveryAddress}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConfirmDelivery(order.id)}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Confirm Handover &amp; Delivery</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rider Assignment Modal */}
      {assignModalOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-rider-modal-title"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle-card)]">
              <div>
                <h4 id="assign-rider-modal-title" className="text-base font-bold text-[var(--text-primary)]">
                  Assign Delivery Rider
                </h4>
                <p className="text-sm text-[var(--text-body-muted)] font-mono">
                  Order #{assignModalOrder.orderCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="min-h-[44px] px-3 rounded-lg text-sm font-semibold text-[var(--text-body-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAssignRider} className="space-y-4 text-sm">
              <div>
                <label htmlFor="dispatch-rider-name" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Rider Full Name
                </label>
                <input
                  id="dispatch-rider-name"
                  type="text"
                  required
                  placeholder="e.g. Babatunde Lawal"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div>
                <label htmlFor="dispatch-rider-phone" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Rider Phone Number <span className="text-[var(--text-body-muted)]">(080... or +234...)</span>
                </label>
                <input
                  id="dispatch-rider-phone"
                  type="tel"
                  required
                  placeholder="08033729125 or +2348033729125"
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div>
                <label htmlFor="dispatch-rider-plate" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Vehicle / Bike Plate Number <span className="text-[var(--text-body-muted)]">(Optional)</span>
                </label>
                <input
                  id="dispatch-rider-plate"
                  type="text"
                  placeholder="e.g. KJA-482-XA"
                  value={riderPlate}
                  onChange={(e) => setRiderPlate(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOrder(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[var(--border-subtle-card)] text-sm font-semibold text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#6B1230] hover:bg-[#85163c] text-[#F7EFD9] border border-[#D4AF37] font-bold text-sm shadow transition-colors"
                >
                  {submitting ? 'Dispatching...' : 'Confirm Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
