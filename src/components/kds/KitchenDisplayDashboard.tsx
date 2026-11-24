'use client';

/**
 * ROCK UC FOODS - Interactive Kitchen Display System (KDS) Dashboard
 * Playbook v2 Section 13 / Phase 4 Real-Time KDS & Section 35
 */

import React, { useState, useEffect } from 'react';
import {
  Flame,
  ChefHat,
  Clock,
  AlertTriangle,
  RefreshCw,
  Check,
  PackageCheck,
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
      const url =
        selectedStation === 'all'
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

  const queuedTickets = tickets.filter((t) => t.status === 'queued');
  const cookingTickets = tickets.filter((t) => t.status === 'cooking');
  const platedTickets = tickets.filter((t) => t.status === 'plated');
  const completedCount = tickets.filter((t) => t.status === 'handed_off').length;

  return (
    <div className="space-y-6 text-[var(--text-primary)] min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle-card)]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center shrink-0">
              <ChefHat className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Chef Esther&apos;s Kitchen Display System (KDS)
            </h2>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Real-time station pipeline, chronological cooking timers, and thermal packaging hand-off.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTickets}
          disabled={loading}
          className="min-h-[44px] inline-flex items-center justify-center space-x-2 px-4 py-2 bg-[var(--bg-card)] hover:border-[var(--border-gold)] border border-[var(--border-card)] text-[var(--text-primary)] rounded-xl text-sm font-semibold transition-colors shrink-0"
        >
          <RefreshCw className={`w-4 h-4 text-[var(--text-accent)] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Screen</span>
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-3.5 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] rounded-xl text-sm text-[var(--status-danger-text)] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* KPI Pipeline Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[var(--status-info-bg)] border border-[var(--status-info-border)] rounded-2xl">
          <span className="text-sm text-[var(--status-info-text)] font-semibold uppercase flex items-center gap-1.5">
            <Clock className="w-4 h-4 shrink-0" /> Queued for Cooking
          </span>
          <div className="text-2xl font-black text-[var(--status-info-text)] price-tabular mt-1">
            {queuedTickets.length}
          </div>
          <span className="text-sm text-[var(--status-info-text)] opacity-90">Awaiting fire</span>
        </div>

        <div className="p-4 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-2xl">
          <span className="text-sm text-[var(--status-warning-text)] font-semibold uppercase flex items-center gap-1.5">
            <Flame className="w-4 h-4 shrink-0" /> Pot On The Fire
          </span>
          <div className="text-2xl font-black text-[var(--status-warning-text)] price-tabular mt-1">
            {cookingTickets.length}
          </div>
          <span className="text-sm text-[var(--status-warning-text)] opacity-90">Active simmering</span>
        </div>

        <div className="p-4 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-2xl">
          <span className="text-sm text-[var(--status-success-text)] font-semibold uppercase flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 shrink-0" /> Freshly Plated
          </span>
          <div className="text-2xl font-black text-[var(--status-success-text)] price-tabular mt-1">
            {platedTickets.length}
          </div>
          <span className="text-sm text-[var(--status-success-text)] opacity-90">Ready for packaging</span>
        </div>

        <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-2xl">
          <span className="text-sm text-[var(--text-body-muted)] font-semibold uppercase flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4 shrink-0" /> Dispatched Today
          </span>
          <div className="text-2xl font-black text-[var(--text-primary)] price-tabular mt-1">
            {completedCount}
          </div>
          <span className="text-sm text-[var(--text-body-muted)]">Handed off to riders</span>
        </div>
      </div>

      {/* Station Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto [overscroll-behavior-x:contain] no-scrollbar pb-2 border-b border-[var(--border-subtle-card)] min-w-0 max-w-full">
        <button
          type="button"
          onClick={() => setSelectedStation('all')}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 border ${
            selectedStation === 'all'
              ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
              : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:text-[var(--text-primary)]'
          }`}
        >
          All Stations ({tickets.length})
        </button>
        {Object.entries(STATION_LABELS).map(([stationKey, { label, icon }]) => {
          const count = tickets.filter((t) => t.assignedStation === stationKey).length;
          return (
            <button
              type="button"
              key={stationKey}
              onClick={() => setSelectedStation(stationKey)}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 border ${
                selectedStation === stationKey
                  ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                  : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{label}</span>
              <span className="opacity-80 price-tabular">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Ticket Grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-[var(--text-body-muted)] flex items-center justify-center space-x-2">
          <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-accent)]" />
          <span>Synchronizing Kitchen Tickets...</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-2xl p-6">
          <ChefHat className="w-10 h-10 text-[var(--text-body-muted)] mx-auto mb-2" />
          <h3 className="text-base font-bold text-[var(--text-primary)]">
            All Kitchen Stations Clear
          </h3>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            New customer orders with verified payments will automatically populate tickets here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
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
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between min-w-0 ${
                  t.priority === 'urgent'
                    ? 'bg-[var(--status-danger-bg)] border-[var(--status-danger-border)] shadow-lg'
                    : isHandedOff
                    ? 'bg-[var(--bg-surface-muted)] border-[var(--border-subtle-card)] opacity-80'
                    : 'bg-[var(--bg-card)] border-[var(--border-subtle-card)] hover:border-[var(--border-gold)]'
                }`}
              >
                <div className="min-w-0">
                  {/* Ticket Header */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle-card)]">
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-bold text-[var(--text-accent)] block truncate">
                        {t.ticketNumber}
                      </span>
                      <span className="text-sm text-[var(--text-body-muted)] font-mono">
                        Order #{t.orderCode}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {t.priority === 'urgent' && (
                        <span className="px-2 py-0.5 rounded-md text-sm font-bold uppercase tracking-wider bg-[#B3261E] text-white">
                          Urgent
                        </span>
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-sm font-bold uppercase tracking-wider border ${
                          isQueued
                            ? 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]'
                            : isCooking
                            ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                            : isPlated
                            ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                            : 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)]'
                        }`}
                      >
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Station & Timestamps */}
                  <div className="py-2.5 flex items-center justify-between gap-2 text-sm text-[var(--text-body-muted)]">
                    <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)] min-w-0 truncate">
                      <span aria-hidden="true">{stationInfo.icon}</span>
                      <span className="truncate">{stationInfo.label}</span>
                    </span>
                    <span className="font-mono text-sm price-tabular shrink-0">
                      {new Date(t.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Special Instructions */}
                  {t.specialInstructions && (
                    <div className="mb-3 p-2.5 bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] rounded-lg text-sm text-[var(--status-warning-text)]">
                      <span className="font-bold">Chef Note:</span> {t.specialInstructions}
                    </div>
                  )}

                  {/* Itemized Snapshot */}
                  <div className="space-y-1.5 my-2">
                    {t.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 text-sm py-1.5 px-2.5 rounded bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]"
                      >
                        <span className="font-medium text-[var(--text-primary)] min-w-0 break-words">
                          <span className="text-[var(--text-accent)] font-bold mr-1.5">
                            {item.quantity}x
                          </span>
                          {item.nameSnapshot}
                        </span>
                        {item.portionSnapshot && (
                          <span className="text-sm text-[var(--text-body-muted)] shrink-0">
                            {item.portionSnapshot}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workflow Action Buttons */}
                <div className="pt-4 mt-3 border-t border-[var(--border-subtle-card)]">
                  {isQueued && (
                    <button
                      type="button"
                      onClick={() => handleTicketAction(t.id, 'start_cooking')}
                      disabled={isActionLoading}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#92400E] hover:bg-[#78350F] text-white font-bold text-sm flex items-center justify-center gap-2 shadow transition-colors"
                    >
                      <Flame className="w-4 h-4 shrink-0" />
                      <span>{isActionLoading ? 'Starting...' : 'Put Pot on Fire'}</span>
                    </button>
                  )}

                  {isCooking && (
                    <button
                      type="button"
                      onClick={() => handleTicketAction(t.id, 'mark_plated')}
                      disabled={isActionLoading}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white font-bold text-sm flex items-center justify-center gap-2 shadow transition-colors"
                    >
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{isActionLoading ? 'Plating...' : 'Mark Plated & Ready'}</span>
                    </button>
                  )}

                  {isPlated && (
                    <button
                      type="button"
                      onClick={() => handleTicketAction(t.id, 'mark_handed_off')}
                      disabled={isActionLoading}
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-[#6B1230] hover:bg-[#85163c] text-[#F7EFD9] border border-[#D4AF37] font-bold text-sm flex items-center justify-center gap-2 shadow transition-colors"
                    >
                      <PackageCheck className="w-4 h-4 text-[#D4AF37] shrink-0" />
                      <span>{isActionLoading ? 'Handing off...' : 'Hand Off to Packaging'}</span>
                    </button>
                  )}

                  {isHandedOff && (
                    <div className="text-center text-sm text-[var(--text-money-positive)] font-mono py-2">
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
