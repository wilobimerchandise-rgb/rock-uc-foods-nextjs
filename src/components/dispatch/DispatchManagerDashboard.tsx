'use client';

/**
 * ROCK UC FOODS - Rider Dispatch & Delivery Dashboard
 * Playbook v2 Section 13 / Phase 4 Dispatch
 */

import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  Phone,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  ExternalLink,
  Send,
  UserCheck,
  ShieldAlert,
} from 'lucide-react';
import { DispatchAssignment } from '../../types/dispatch';
import { Order } from '../../types/order';
import { formatNaira } from '../../lib/money';

export function DispatchManagerDashboard() {
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

  // Ready for dispatch or already in transit
  const readyOrders = orders.filter((o) => o.status === 'ready_for_dispatch');
  const inTransitOrders = orders.filter((o) => o.status === 'out_for_delivery');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');

  return (
    <div className="space-y-6 text-[#F7EFD9]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[#F7EFD9] tracking-tight">
              Rider Dispatch &amp; Handover Hub
            </h2>
          </div>
          <p className="text-xs text-[#F7EFD9]/60 mt-1">
            Dispatch fleet management, E.164 phone validation (+234...), and customer handover confirmation.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Fleet</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-2xl">
          <span className="text-[11px] text-amber-400 font-semibold uppercase flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Packaged &amp; Awaiting Rider
          </span>
          <div className="text-2xl font-black text-amber-200 mt-1">{readyOrders.length}</div>
          <span className="text-[10px] text-amber-400/80">Thermal sealed boxes ready</span>
        </div>

        <div className="p-4 bg-sky-950/40 border border-sky-500/30 rounded-2xl">
          <span className="text-[11px] text-sky-400 font-semibold uppercase flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" /> Out For Delivery (In Transit)
          </span>
          <div className="text-2xl font-black text-sky-200 mt-1">{inTransitOrders.length}</div>
          <span className="text-[10px] text-sky-400/80">Riders on the road</span>
        </div>

        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-semibold uppercase flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Successfully Delivered
          </span>
          <div className="text-2xl font-black text-emerald-200 mt-1">{deliveredOrders.length}</div>
          <span className="text-[10px] text-emerald-400/80">Completed handovers</span>
        </div>
      </div>

      {/* Section 1: Ready for Rider Assignment */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Orders Awaiting Rider Handover ({readyOrders.length})</span>
        </h3>

        {readyOrders.length === 0 ? (
          <div className="p-6 bg-[#17120F] border border-white/5 rounded-2xl text-center text-xs text-stone-400">
            No orders currently waiting for rider assignment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {readyOrders.map((order) => (
              <div
                key={order.id}
                className="p-5 bg-[#17120F] border border-amber-500/40 rounded-2xl space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <span className="font-mono text-xs font-bold text-[#D4AF37]">
                      #{order.orderCode}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {formatNaira(order.totalKobo)}
                    </span>
                  </div>

                  <div className="pt-2 text-xs text-stone-300 space-y-1">
                    <div className="font-bold text-white">{order.customerName}</div>
                    <div className="text-stone-400 text-[11px]">{order.deliveryAddress || 'Kitchen Pickup'}</div>
                    <div className="text-stone-500 font-mono text-[10px]">
                      Customer Phone: {order.customerPhone}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setAssignModalOrder(order)}
                  className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg"
                >
                  <Truck className="w-3.5 h-3.5" />
                  <span>Assign Delivery Rider</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Active In-Transit Deliveries */}
      <div className="space-y-3 pt-4 border-t border-white/10">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>In-Transit Deliveries ({inTransitOrders.length})</span>
        </h3>

        {inTransitOrders.length === 0 ? (
          <div className="p-6 bg-[#17120F] border border-white/5 rounded-2xl text-center text-xs text-stone-400">
            No riders currently on the road.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inTransitOrders.map((order) => {
              const assignment = assignments.find((a) => a.orderId === order.id);

              return (
                <div
                  key={order.id}
                  className="p-5 bg-sky-950/20 border border-sky-500/40 rounded-2xl space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div>
                        <span className="font-mono text-xs font-bold text-sky-300 block">
                          #{order.orderCode}
                        </span>
                        <span className="text-[10px] text-stone-400">{order.customerName}</span>
                      </div>
                      <span className="text-xs font-bold text-white font-mono">
                        {formatNaira(order.totalKobo)}
                      </span>
                    </div>

                    <div className="pt-2 text-xs space-y-1.5">
                      <div className="p-2.5 bg-black/40 rounded-xl border border-white/5">
                        <span className="text-[10px] text-stone-400 uppercase font-bold block mb-1">
                          Dispatched Rider
                        </span>
                        <div className="text-white font-bold flex items-center justify-between">
                          <span>{assignment ? assignment.riderName : 'Dispatched Fleet'}</span>
                          {assignment?.riderVehiclePlate && (
                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded font-mono text-[#D4AF37]">
                              {assignment.riderVehiclePlate}
                            </span>
                          )}
                        </div>
                        {assignment && (
                          <div className="text-[11px] text-sky-400 font-mono mt-0.5">
                            {assignment.riderPhone}
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] text-stone-300">
                        <span className="text-stone-500">Destination:</span> {order.deliveryAddress}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleConfirmDelivery(order.id)}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#17120F] border border-[#D4AF37]/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h4 className="text-base font-bold text-white">Assign Delivery Rider</h4>
                <p className="text-xs text-stone-400 font-mono">Order #{assignModalOrder.orderCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalOrder(null)}
                className="text-stone-400 hover:text-white text-xs"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAssignRider} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-stone-300 font-semibold mb-1">Rider Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Babatunde Lawal"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Rider Phone Number <span className="text-stone-400">(Nigerian 080... or +234...)</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="08033729125 or +2348033729125"
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-semibold mb-1">
                  Vehicle / Bike Plate Number <span className="text-stone-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. KJA-482-XA"
                  value={riderPlate}
                  onChange={(e) => setRiderPlate(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white placeholder-stone-600 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-stone-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#6B1230] hover:bg-[#85163c] text-white border border-[#D4AF37] font-bold shadow-lg transition-colors"
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
