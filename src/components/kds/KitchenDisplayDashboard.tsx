'use client';

/**
 * ROCK UC FOODS - Interactive Kitchen Display System (KDS) Dashboard
 * Playbook v2 Section 13 / Phase 4 Real-Time KDS
 */

import React, { useState, useEffect } from 'react';
import {
  Flame,
  ChefHat,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Filter,
  Check,
  PackageCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { KitchenTicket, KitchenStation } from '../../types/dispatch';

const STATION_LABELS: Record<KitchenStation, { label: string; icon: string }> = {
  grill: { label: 'Grill & Suya', icon: '🥩' },
  stew_pot: { label: 'Signature Soups & Stews', icon: '🍲' },
  fryer: { label: 'Fryer & Plantain', icon: '🍳' },
  salad_prep: { label: 'Salad & Cold Prep', icon: '🥗' },
  packaging: { label: 'Thermal Packaging', icon: '📦' },
};

export function KitchenDisplayDashboard() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTickets = async () => {
    try {
      const url =
        selectedStation === 'all'
          ? '/api/kds'
          : `/api/kds?station=${encodeURIComponent(selectedStation)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setTickets(data.tickets || []);
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
      const url = selectedStation === 'all'
        ? '/api/kds'
        : `/api/kds?station=${encodeURIComponent(selectedStation)}`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (!ignore && data.tickets) setTickets(data.tickets);
        })
        .catch(() => {})
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    };
    load();
    const interval = setInterval(load, 5000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [selectedStation]);

  const handleTicketAction = async (
    ticketId: string,
    action: 'start_cooking' | 'mark_plated' | 'mark_handed_off'
  ) => {
    setActionLoadingId(ticketId);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/kds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ticketId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Action failed.');
      } else {
        await fetchTickets();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Action failed.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Group tickets by active cooking stages
  const queuedTickets = tickets.filter((t) => t.status === 'queued');
  const cookingTickets = tickets.filter((t) => t.status === 'cooking');
  const platedTickets = tickets.filter((t) => t.status === 'plated');
  const completedCount = tickets.filter((t) => t.status === 'handed_off').length;

  return (
    <div className="space-y-6 text-[#F7EFD9]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center">
              <ChefHat className="w-4 h-4 text-[#D4AF37]" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[#F7EFD9] tracking-tight">
              Chef Esther&apos;s Kitchen Display System (KDS)
            </h2>
          </div>
          <p className="text-xs text-[#F7EFD9]/60 mt-1">
            Real-time station pipeline, chronological cooking timers, and thermal packaging hand-off.
          </p>
        </div>

        <button
          onClick={fetchTickets}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Screen</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Pipeline Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-sky-950/40 border border-sky-500/30 rounded-2xl">
          <span className="text-[11px] text-sky-400 font-semibold uppercase flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Queued for Cooking
          </span>
          <div className="text-2xl font-black text-sky-200 mt-1">{queuedTickets.length}</div>
          <span className="text-[10px] text-sky-400/80">Awaiting fire</span>
        </div>

        <div className="p-4 bg-amber-950/40 border border-amber-500/30 rounded-2xl">
          <span className="text-[11px] text-amber-400 font-semibold uppercase flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" /> Pot On The Fire
          </span>
          <div className="text-2xl font-black text-amber-200 mt-1">{cookingTickets.length}</div>
          <span className="text-[10px] text-amber-400/80">Active simmering</span>
        </div>

        <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl">
          <span className="text-[11px] text-emerald-400 font-semibold uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Freshly Plated
          </span>
          <div className="text-2xl font-black text-emerald-200 mt-1">{platedTickets.length}</div>
          <span className="text-[10px] text-emerald-400/80">Ready for packaging</span>
        </div>

        <div className="p-4 bg-[#17120F] border border-white/10 rounded-2xl">
          <span className="text-[11px] text-stone-400 font-semibold uppercase flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5" /> Dispatched Today
          </span>
          <div className="text-2xl font-black text-white mt-1">{completedCount}</div>
          <span className="text-[10px] text-stone-400">Handed off to riders</span>
        </div>
      </div>

      {/* Station Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5 scrollbar-none">
        <button
          onClick={() => setSelectedStation('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
            selectedStation === 'all'
              ? 'bg-[#6B1230] text-white border border-[#D4AF37]'
              : 'bg-white/5 text-stone-400 hover:text-white'
          }`}
        >
          All Stations ({tickets.length})
        </button>
        {Object.entries(STATION_LABELS).map(([stationKey, { label, icon }]) => {
          const count = tickets.filter((t) => t.assignedStation === stationKey).length;
          return (
            <button
              key={stationKey}
              onClick={() => setSelectedStation(stationKey)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                selectedStation === stationKey
                  ? 'bg-[#6B1230] text-white border border-[#D4AF37]'
                  : 'bg-white/5 text-stone-400 hover:text-white'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
              <span className="text-[10px] opacity-75">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Ticket Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-stone-400 flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
          <span>Synchronizing Kitchen Tickets...</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center bg-[#17120F] border border-white/10 rounded-2xl p-6">
          <ChefHat className="w-10 h-10 text-stone-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-white">All Kitchen Stations Clear</h3>
          <p className="text-xs text-stone-400 mt-1">
            New customer orders with verified payments will automatically populate tickets here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map((t) => {
            const isQueued = t.status === 'queued';
            const isCooking = t.status === 'cooking';
            const isPlated = t.status === 'plated';
            const isHandedOff = t.status === 'handed_off';
            const stationInfo = STATION_LABELS[t.assignedStation] || {
              label: t.assignedStation,
              icon: '🍳',
            };

            const isActionLoading = actionLoadingId === t.id;

            return (
              <div
                key={t.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  t.priority === 'urgent'
                    ? 'bg-rose-950/30 border-rose-500/80 shadow-rose-900/20 shadow-lg'
                    : isHandedOff
                    ? 'bg-stone-900/40 border-white/5 opacity-60'
                    : 'bg-[#17120F] border-white/10 hover:border-[#D4AF37]/50'
                }`}
              >
                <div>
                  {/* Ticket Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <span className="font-mono text-xs font-bold text-[#D4AF37] block">
                        {t.ticketNumber}
                      </span>
                      <span className="text-[10px] text-stone-400 font-mono">
                        Order #{t.orderCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {t.priority === 'urgent' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white animate-pulse">
                          Urgent
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isQueued
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                            : isCooking
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : isPlated
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-stone-800 text-stone-400'
                        }`}
                      >
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Station & Timestamps */}
                  <div className="py-2.5 flex items-center justify-between text-[11px] text-stone-400">
                    <span className="flex items-center gap-1 font-semibold text-stone-300">
                      <span>{stationInfo.icon}</span>
                      <span>{stationInfo.label}</span>
                    </span>
                    <span className="font-mono text-[10px]">
                      {new Date(t.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Special Instructions */}
                  {t.specialInstructions && (
                    <div className="mb-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-200">
                      <span className="font-bold">Chef Note:</span> {t.specialInstructions}
                    </div>
                  )}

                  {/* Itemized Snapshot */}
                  <div className="space-y-1.5 my-2">
                    {t.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded bg-black/30 border border-white/5"
                      >
                        <span className="font-medium text-white">
                          <span className="text-[#D4AF37] font-bold mr-1.5">
                            {item.quantity}x
                          </span>
                          {item.nameSnapshot}
                        </span>
                        {item.portionSnapshot && (
                          <span className="text-[10px] text-stone-400">
                            {item.portionSnapshot}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workflow Action Buttons */}
                <div className="pt-4 mt-3 border-t border-white/10">
                  {isQueued && (
                    <button
                      onClick={() => handleTicketAction(t.id, 'start_cooking')}
                      disabled={isActionLoading}
                      className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>{isActionLoading ? 'Starting...' : 'Put Pot on Fire'}</span>
                    </button>
                  )}

                  {isCooking && (
                    <button
                      onClick={() => handleTicketAction(t.id, 'mark_plated')}
                      disabled={isActionLoading}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isActionLoading ? 'Plating...' : 'Mark Plated & Ready'}</span>
                    </button>
                  )}

                  {isPlated && (
                    <button
                      onClick={() => handleTicketAction(t.id, 'mark_handed_off')}
                      disabled={isActionLoading}
                      className="w-full py-2 px-3 rounded-xl bg-[#6B1230] hover:bg-[#85163c] text-white border border-[#D4AF37] font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg transition-all"
                    >
                      <PackageCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>{isActionLoading ? 'Handing off...' : 'Hand Off to Packaging'}</span>
                    </button>
                  )}

                  {isHandedOff && (
                    <div className="text-center text-[11px] text-emerald-400/80 font-mono py-1">
                      ✓ Handed off to Packaging &amp; Dispatch
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
