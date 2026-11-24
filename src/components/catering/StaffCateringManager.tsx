'use client';

/**
 * ROCK UC FOODS - Staff / Owner Catering & Invoicing Manager
 * (Playbook v2 Section 9, 10, Section 17 v3 Addendum & Section 35)
 */

import React, { useState } from 'react';
import { cateringRepository } from '../../catering/cateringRepository';
import {
  createOrReviseQuote,
  recordQuotePayment,
  calculateBulkRefundNotice,
} from '../../catering/cateringEngine';
import { generateCateringInvoicePdf } from '../../catering/cateringPdf';
import { CateringEvent, CateringQuote } from '../../types/catering';
import { formatNaira, parseNairaToKobo } from '../../lib/money';
import { maskCustomerPhone } from '../../lib/security';
import {
  Calendar,
  Users,
  MapPin,
  FileText,
  Download,
  Plus,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Flame,
  X,
  CreditCard,
  CalendarRange,
} from 'lucide-react';

export interface WeeklyCapacityBucket {
  weekStartIso: string;
  weekLabel: string;
  events: CateringEvent[];
  totalGuests: number;
  liveCookingEventsCount: number;
  depositSecuredCount: number;
  sameDayClashDates: string[];
  isHighLoad: boolean;
}

export function buildWeeklyCapacityBuckets(events: CateringEvent[]): WeeklyCapacityBucket[] {
  const activeEvents = events.filter((ev) => ev.status !== 'cancelled');
  const buckets = new Map<string, CateringEvent[]>();

  for (const ev of activeEvents) {
    const parsed = new Date(`${ev.eventDate}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) continue;
    const utcDay = parsed.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = utcDay === 0 ? -6 : 1 - utcDay;
    const monday = new Date(parsed.getTime() + diffToMonday * 24 * 60 * 60 * 1000);
    const weekStartIso = monday.toISOString().slice(0, 10);
    const existing = buckets.get(weekStartIso) || [];
    existing.push(ev);
    buckets.set(weekStartIso, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStartIso, weekEvents]) => {
      const sorted = weekEvents.slice().sort((a, b) => a.eventDate.localeCompare(b.eventDate));
      const dateCounts = new Map<string, number>();
      let totalGuests = 0;
      let liveCookingEventsCount = 0;
      let depositSecuredCount = 0;

      for (const ev of sorted) {
        totalGuests += Number(ev.guestCount) || 0;
        if (ev.liveCookingRequested) liveCookingEventsCount += 1;
        if (ev.status === 'deposit_paid' || ev.status === 'fully_paid' || ev.status === 'completed') {
          depositSecuredCount += 1;
        }
        dateCounts.set(ev.eventDate, (dateCounts.get(ev.eventDate) || 0) + 1);
      }

      const sameDayClashDates = Array.from(dateCounts.entries())
        .filter(([, count]) => count >= 2)
        .map(([dt]) => dt);

      const mondayDate = new Date(`${weekStartIso}T12:00:00Z`);
      const sundayDate = new Date(mondayDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      const weekLabel = `${weekStartIso} to ${sundayDate.toISOString().slice(0, 10)}`;

      return {
        weekStartIso,
        weekLabel,
        events: sorted,
        totalGuests,
        liveCookingEventsCount,
        depositSecuredCount,
        sameDayClashDates,
        isHighLoad: totalGuests >= 300 || sameDayClashDates.length > 0 || sorted.length >= 3,
      };
    });
}

interface StaffCateringManagerProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  currentUserId: string;
  hasMfaVerified?: boolean;
}

function koboToInputNaira(kobo: bigint): string {
  const whole = kobo / 100n;
  const rem = kobo % 100n;
  return rem === 0n ? whole.toString() : `${whole.toString()}.${rem.toString().padStart(2, '0')}`;
}

export const StaffCateringManager: React.FC<StaffCateringManagerProps> = ({
  currentUserRole,
  currentUserId,
  hasMfaVerified = false,
}) => {
  const isOwnerOrDev = currentUserRole === 'owner' || currentUserRole === 'developer';

  const [events, setEvents] = useState<CateringEvent[]>(() => cateringRepository.getAll());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'weekly'>('list');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Quote Revision Modal
  const [revisionEvent, setRevisionEvent] = useState<CateringEvent | null>(null);
  const [revDepositPct, setRevDepositPct] = useState<number>(70);
  const [revLogisticsNaira, setRevLogisticsNaira] = useState<string>('50000');
  const [revServiceNaira, setRevServiceNaira] = useState<string>('100000');
  const [revNotes, setRevNotes] = useState<string>('');
  const [revItems, setRevItems] = useState<
    { name: string; portionLabel: string; priceNaira: string; quantity: number }[]
  >([
    { name: 'Signature Smoky Party Jollof & Fried Rice', portionLabel: 'Buffet Servings', priceNaira: '5000', quantity: 100 },
    { name: 'Peppered Goat Meat & Asun Live Grill', portionLabel: 'Portions', priceNaira: '3000', quantity: 100 },
  ]);

  // Bulk Refund Preview Modal
  const [refundPreview, setRefundPreview] = useState<{
    event: CateringEvent;
    quote: CateringQuote;
    calc: ReturnType<typeof calculateBulkRefundNotice>;
  } | null>(null);

  const refreshEvents = () => setEvents(cateringRepository.getAll());

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDownloadPdf = async (event: CateringEvent, quote: CateringQuote) => {
    try {
      notify(`Generating official PDF invoice for ${event.eventCode} Rev ${quote.revisionNumber}...`);
      let bankDetailsOverride: { bankName: string; accountName: string; accountNumber: string } | null = null;
      try {
        const res = await fetch('/api/ops/bank-details', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          bankDetailsOverride = data?.configured && data?.bankDetails ? data.bankDetails : null;
        }
      } catch {
        bankDetailsOverride = null;
      }

      const { pdfBytes, filename } = await generateCateringInvoicePdf(event, quote, {
        bankDetails: bankDetailsOverride,
      });

      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      notify(`PDF invoice downloaded: ${filename}`);
    } catch (err: unknown) {
      notify(`PDF generation error: ${(err as Error).message}`, 'error');
    }
  };

  const handleVerifyDeposit = (event: CateringEvent, quote: CateringQuote) => {
    try {
      recordQuotePayment(event.id, quote.id, 'deposit', currentUserId);
      refreshEvents();
      notify(`70% Deposit verified for event ${event.eventCode}. Date secured!`);
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const handleVerifyBalance = (event: CateringEvent, quote: CateringQuote) => {
    try {
      recordQuotePayment(event.id, quote.id, 'balance', currentUserId);
      refreshEvents();
      notify(`Final Balance verified for event ${event.eventCode}. Booking fully paid!`);
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const openRevisionModal = (event: CateringEvent) => {
    setRevisionEvent(event);
    const latestQuote = event.quotes[event.quotes.length - 1];
    if (latestQuote) {
      setRevDepositPct(latestQuote.depositPercentage);
      setRevLogisticsNaira(koboToInputNaira(latestQuote.logisticsFeeKobo));
      setRevServiceNaira(koboToInputNaira(latestQuote.serviceFeeKobo));
      setRevNotes(latestQuote.notes || '');
      setRevItems(
        latestQuote.items.map((i) => ({
          name: i.name,
          portionLabel: i.portionLabel || '',
          priceNaira: koboToInputNaira(i.unitPriceKobo),
          quantity: i.quantity,
        }))
      );
    } else {
      setRevDepositPct(70);
      setRevLogisticsNaira('50000');
      setRevServiceNaira('100000');
      setRevNotes('');
      setRevItems([
        {
          name: 'Smoky Party Jollof & Fried Rice',
          portionLabel: `${event.guestCount} Servings`,
          priceNaira: '5000',
          quantity: event.guestCount,
        },
      ]);
    }
  };

  const handleCommitRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionEvent) return;

    try {
      const logisticsKobo = parseNairaToKobo(revLogisticsNaira || '0');
      const serviceKobo = parseNairaToKobo(revServiceNaira || '0');

      const items = revItems.map((i) => ({
        name: i.name,
        portionLabel: i.portionLabel || undefined,
        unitPriceKobo: parseNairaToKobo(i.priceNaira),
        quantity: Number(i.quantity),
      }));

      const newQuote = createOrReviseQuote({
        eventId: revisionEvent.id,
        depositPercentage: Number(revDepositPct),
        logisticsFeeKobo: logisticsKobo,
        serviceFeeKobo: serviceKobo,
        notes: revNotes || undefined,
        items,
      });

      refreshEvents();
      notify(`Revision ${newQuote.revisionNumber} generated for ${revisionEvent.eventCode}! Total: ${formatNaira(newQuote.totalKobo)}`);
      setRevisionEvent(null);
    } catch (err: unknown) {
      notify((err as Error).message, 'error');
    }
  };

  const handleOpenRefundCalc = (event: CateringEvent, quote: CateringQuote) => {
    const calc = calculateBulkRefundNotice(event, quote, new Date());
    setRefundPreview({ event, quote, calc });
  };

  const filteredEvents = events.filter((ev) => {
    if (filterStatus === 'all') return true;
    return ev.status === filterStatus;
  });

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
              Events &amp; Bulk Catering Quotes
            </h1>
            <span className="text-sm uppercase font-bold px-2.5 py-0.5 rounded-md bg-[#D4AF37] text-[#0B0A09]">
              Role: {currentUserRole}
            </span>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] mt-1">
            Bespoke event catering quotes, 70/30 deposit schedules, revision history, and branded PDF invoices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            data-testid="catering-view-list"
            onClick={() => setViewMode('list')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all ${
              viewMode === 'list'
                ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-card)]'
            }`}
          >
            Event Quotes
          </button>
          <button
            type="button"
            data-testid="catering-view-weekly"
            onClick={() => setViewMode('weekly')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border transition-all inline-flex items-center gap-1.5 ${
              viewMode === 'weekly'
                ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-card)]'
            }`}
          >
            <CalendarRange className="w-4 h-4 shrink-0" />
            <span>Weekly Capacity</span>
          </button>
          <span className="text-sm font-mono price-tabular text-[var(--text-accent)] bg-[var(--bg-card)] px-3.5 py-2 rounded-xl border border-[var(--border-card)] min-h-[44px] inline-flex items-center">
            {events.length} Events Logged
          </span>
        </div>
      </div>

      {/* Weekly Catering Capacity Schedule View */}
      {viewMode === 'weekly' ? (
        <section className="space-y-4" data-testid="catering-weekly-capacity-view">
          {buildWeeklyCapacityBuckets(events).length === 0 ? (
            <div className="p-8 text-center bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] text-sm">
              No active catering events scheduled across upcoming weeks.
            </div>
          ) : (
            buildWeeklyCapacityBuckets(events).map((bucket) => (
              <div
                key={bucket.weekStartIso}
                className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle-card)]">
                  <div>
                    <h2 className="text-lg font-serif font-bold text-[var(--text-primary)]">
                      Week of {bucket.weekLabel}
                    </h2>
                    <p className="text-sm text-[var(--text-body-muted)] price-tabular">
                      {bucket.events.length} Active Event(s) &bull; {bucket.totalGuests} Total Guests &bull;{' '}
                      {bucket.liveCookingEventsCount} Live-Cooking Station(s) &bull; {bucket.depositSecuredCount} Secured
                    </p>
                  </div>

                  <span
                    className={`text-sm font-bold uppercase px-3 py-1 rounded-md border shrink-0 ${
                      bucket.isHighLoad
                        ? 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                        : 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                    }`}
                  >
                    {bucket.sameDayClashDates.length > 0
                      ? `Clash Alert: ${bucket.sameDayClashDates.join(', ')}`
                      : bucket.isHighLoad
                      ? 'High Kitchen Load'
                      : 'Normal Capacity'}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {bucket.events.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-[var(--text-accent)] price-tabular">
                            {ev.eventDate}
                          </span>
                          <span className="font-bold text-[var(--text-primary)]">{ev.clientName}</span>
                          <span className="font-mono text-[var(--text-body-muted)]">({ev.eventCode})</span>
                        </div>
                        <p className="text-[var(--text-body-muted)]">
                          {ev.eventType} &bull; {ev.guestCount} Guests
                          {ev.liveCookingRequested ? ' • Live Cooking Station' : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-md bg-[var(--bg-card)] border border-[var(--border-card)] text-sm font-semibold uppercase text-[var(--text-accent)]">
                          {ev.status.replace(/_/g, ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFilterStatus('all');
                            setViewMode('list');
                          }}
                          className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/60 text-sm font-semibold"
                        >
                          Manage Quote
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      ) : (
      <>
      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto [overscroll-behavior-x:contain] no-scrollbar pb-1 text-sm min-w-0 max-w-full">
        {['all', 'inquiry', 'quote_sent', 'deposit_paid', 'fully_paid', 'completed', 'cancelled'].map((st) => (
          <button
            type="button"
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`min-h-[44px] px-4 py-2 rounded-xl font-semibold shrink-0 transition-all border ${
              filterStatus === st
                ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]'
                : 'bg-[var(--bg-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)] border-[var(--border-subtle-card)]'
            }`}
          >
            {st.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-4 min-w-0">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] text-sm">
            No events found matching this status.
          </div>
        ) : (
          filteredEvents.map((event) => {
            const activeQuote = event.quotes.find((q) => q.status === 'active') || event.quotes[event.quotes.length - 1];

            return (
              <div
                key={event.id}
                className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] hover:border-[var(--border-gold)] rounded-xl p-5 space-y-4 transition-all min-w-0"
              >
                {/* Event Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle-card)]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-bold text-base text-[var(--text-accent)]">
                      {event.eventCode}
                    </span>
                    <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">
                      {event.clientName}
                    </h3>
                    <span
                      className={`text-sm uppercase font-bold px-2.5 py-0.5 rounded-md border ${
                        event.status === 'fully_paid'
                          ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                          : event.status === 'deposit_paid'
                          ? 'bg-[#6B1230] text-[#F7EFD9] border-[#D4AF37]/60'
                          : event.status === 'quote_sent'
                          ? 'bg-[var(--status-info-bg)] text-[var(--status-info-text)] border-[var(--status-info-border)]'
                          : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                      }`}
                    >
                      {event.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-sm text-[var(--text-body-muted)] flex flex-wrap items-center gap-3 price-tabular">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[var(--text-accent)] shrink-0" /> {event.eventDate}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[var(--text-accent)] shrink-0" /> {event.guestCount} Guests
                    </span>
                  </div>
                </div>

                {/* Event Specifications */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-[var(--bg-surface-muted)] p-4 rounded-xl border border-[var(--border-subtle-card)]">
                  <div className="min-w-0">
                    <span className="text-[var(--text-body-muted)] block text-sm uppercase font-semibold tracking-wider">
                      Event &amp; Venue
                    </span>
                    <p className="font-semibold text-[var(--text-primary)] mt-1">{event.eventType}</p>
                    <p className="text-[var(--text-body-muted)] text-sm flex items-center gap-1.5 mt-1 break-words">
                      <MapPin className="w-4 h-4 text-[var(--text-accent)] shrink-0" /> {event.venueAddress}
                    </p>
                    {event.liveCookingRequested && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--status-warning-text)] bg-[var(--status-warning-bg)] px-2.5 py-1 rounded-md border border-[var(--status-warning-border)] mt-2 font-semibold">
                        <Flame className="w-4 h-4 shrink-0" /> Live Cooking Station Requested
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span className="text-[var(--text-body-muted)] block text-sm uppercase font-semibold tracking-wider">
                      Client Contact
                    </span>
                    <p className="font-semibold font-mono price-tabular text-[var(--text-primary)] mt-1">
                      {maskCustomerPhone(event.clientPhone, currentUserRole, hasMfaVerified)}
                    </p>
                    {event.clientEmail && (
                      <p className="text-[var(--text-body-muted)] text-sm break-all">{event.clientEmail}</p>
                    )}
                    {event.specialNotes && (
                      <p className="text-[var(--status-warning-text)] italic text-sm mt-1">
                        Note: {event.specialNotes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Quote Schedule Box */}
                {activeQuote ? (
                  <div className="p-4 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-card)] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                        <span className="font-serif font-bold text-base text-[var(--text-primary)]">
                          Quote Revision {activeQuote.revisionNumber} ({activeQuote.items.length} line items)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-base text-[var(--text-accent)] price-tabular">
                        Total: {formatNaira(activeQuote.totalKobo)}
                      </span>
                    </div>

                    {/* Deposit & Balance Schedule Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-[var(--bg-card)] p-3.5 rounded-xl border border-[var(--border-subtle-card)]">
                      <div>
                        <div className="flex justify-between items-center gap-2 mb-1">
                          <span className="text-[var(--text-body-muted)] text-sm">70% Booking Deposit:</span>
                          <span
                            className={`text-sm font-bold uppercase px-2 py-0.5 rounded-md border ${
                              activeQuote.depositStatus === 'paid'
                                ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                                : 'bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]'
                            }`}
                          >
                            {activeQuote.depositStatus}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[var(--text-primary)] text-base price-tabular">
                          {formatNaira(activeQuote.depositKobo)}
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between items-center gap-2 mb-1">
                          <span className="text-[var(--text-body-muted)] text-sm">30% Final Balance:</span>
                          <span
                            className={`text-sm font-bold uppercase px-2 py-0.5 rounded-md border ${
                              activeQuote.balanceStatus === 'paid'
                                ? 'bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]'
                                : 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border-[var(--border-subtle-card)]'
                            }`}
                          >
                            {activeQuote.balanceStatus}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[var(--text-primary)] text-base price-tabular">
                          {formatNaira(activeQuote.balanceKobo)}
                        </span>
                      </div>
                    </div>

                    {/* Quote Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(event, activeQuote)}
                        className="min-h-[44px] bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/60 px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 shadow"
                      >
                        <Download className="w-4 h-4 text-[#D4AF37] shrink-0" /> Download Official PDF Invoice
                      </button>

                      {isOwnerOrDev && activeQuote.depositStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleVerifyDeposit(event, activeQuote)}
                          className="min-h-[44px] bg-[var(--status-success-bg)] hover:opacity-90 text-[var(--status-success-text)] border border-[var(--status-success-border)] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                        >
                          <CreditCard className="w-4 h-4 shrink-0" /> Confirm 70% Deposit
                        </button>
                      )}

                      {isOwnerOrDev && activeQuote.depositStatus === 'paid' && activeQuote.balanceStatus !== 'paid' && (
                        <button
                          type="button"
                          onClick={() => handleVerifyBalance(event, activeQuote)}
                          className="min-h-[44px] bg-[var(--status-success-bg)] hover:opacity-90 text-[var(--status-success-text)] border border-[var(--status-success-border)] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                        >
                          <CreditCard className="w-4 h-4 shrink-0" /> Confirm 30% Balance
                        </button>
                      )}

                      {isOwnerOrDev && (
                        <button
                          type="button"
                          onClick={() => openRevisionModal(event)}
                          className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] hover:border-[var(--border-gold)] text-[var(--text-primary)] px-4 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 ml-auto"
                        >
                          <Plus className="w-4 h-4 text-[var(--text-accent)] shrink-0" /> Create Revision {event.quotes.length + 1}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenRefundCalc(event, activeQuote)}
                        className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-subtle-card)] hover:border-[var(--border-gold)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)] px-3.5 py-2 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-4 h-4 shrink-0" /> Refund Policy Advice
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[var(--bg-surface-muted)] rounded-xl border border-[var(--border-subtle-card)] flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm text-[var(--text-body-muted)]">
                      No quote generated for this inquiry yet.
                    </span>
                    {isOwnerOrDev && (
                      <button
                        type="button"
                        onClick={() => openRevisionModal(event)}
                        className="btn-luxury px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4 shrink-0" /> Generate Quote Revision 1
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      </>
      )}

      {/* Create / Revise Quote Modal */}
      {revisionEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="catering-revise-modal-title"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-2xl w-full p-6 text-[var(--text-primary)] space-y-4 my-auto">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle-card)]">
              <h3 id="catering-revise-modal-title" className="font-serif font-bold text-lg text-[var(--text-primary)]">
                Generate Quote Revision {revisionEvent.quotes.length + 1} for {revisionEvent.clientName}
              </h3>
              <button
                type="button"
                aria-label="Close Quote Revision modal"
                onClick={() => setRevisionEvent(null)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCommitRevision} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="rev-deposit-pct" className="block text-[var(--text-body-muted)] font-semibold mb-1">
                    Deposit Percentage (%)
                  </label>
                  <input
                    id="rev-deposit-pct"
                    type="number"
                    min={10}
                    max={100}
                    value={revDepositPct}
                    onChange={(e) => setRevDepositPct(Number(e.target.value))}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>

                <div>
                  <label htmlFor="rev-logistics-naira" className="block text-[var(--text-body-muted)] font-semibold mb-1">
                    Logistics / Transport (₦)
                  </label>
                  <input
                    id="rev-logistics-naira"
                    type="text"
                    value={revLogisticsNaira}
                    onChange={(e) => setRevLogisticsNaira(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] font-mono price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>

                <div>
                  <label htmlFor="rev-service-naira" className="block text-[var(--text-body-muted)] font-semibold mb-1">
                    Service &amp; Staff Crew (₦)
                  </label>
                  <input
                    id="rev-service-naira"
                    type="text"
                    value={revServiceNaira}
                    onChange={(e) => setRevServiceNaira(e.target.value)}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] font-mono price-tabular focus:outline-none focus:border-[var(--border-gold)]"
                  />
                </div>
              </div>

              {/* Line items editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-serif font-bold text-[var(--text-accent)]">Menu Line Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRevItems((prev) => [
                        ...prev,
                        { name: 'Gourmet Dish Line', portionLabel: 'Portions', priceNaira: '3500', quantity: 50 },
                      ])
                    }
                    className="min-h-[44px] px-3 rounded-lg text-sm text-[var(--text-accent)] hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-4 h-4" /> Add Item Line
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {revItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-[var(--bg-surface-muted)] p-2.5 rounded-lg border border-[var(--border-subtle-card)]"
                    >
                      <input
                        type="text"
                        aria-label={`Line item ${idx + 1} dish name`}
                        placeholder="Dish Name"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...revItems];
                          updated[idx].name = e.target.value;
                          setRevItems(updated);
                        }}
                        className="sm:col-span-5 min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
                      />
                      <input
                        type="text"
                        aria-label={`Line item ${idx + 1} portion`}
                        placeholder="Portion"
                        value={item.portionLabel}
                        onChange={(e) => {
                          const updated = [...revItems];
                          updated[idx].portionLabel = e.target.value;
                          setRevItems(updated);
                        }}
                        className="sm:col-span-3 min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded px-2.5 py-1.5 text-sm text-[var(--text-primary)]"
                      />
                      <input
                        type="text"
                        aria-label={`Line item ${idx + 1} unit price Naira`}
                        placeholder="Unit ₦"
                        value={item.priceNaira}
                        onChange={(e) => {
                          const updated = [...revItems];
                          updated[idx].priceNaira = e.target.value;
                          setRevItems(updated);
                        }}
                        className="sm:col-span-2 min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded px-2.5 py-1.5 text-sm font-mono price-tabular text-[var(--text-primary)]"
                      />
                      <input
                        type="number"
                        aria-label={`Line item ${idx + 1} quantity`}
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...revItems];
                          updated[idx].quantity = Number(e.target.value);
                          setRevItems(updated);
                        }}
                        className="sm:col-span-2 min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-card)] rounded px-2.5 py-1.5 text-sm font-mono price-tabular text-[var(--text-primary)]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="rev-scope-notes" className="block text-[var(--text-body-muted)] font-semibold mb-1">
                  Revision Scope Notes (Printed on invoice)
                </label>
                <input
                  id="rev-scope-notes"
                  type="text"
                  placeholder="e.g. Includes chafing equipment, live cooking chef, and standard service staff."
                  value={revNotes}
                  onChange={(e) => setRevNotes(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg p-2.5 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-gold)]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[var(--border-subtle-card)]">
                <button
                  type="button"
                  onClick={() => setRevisionEvent(null)}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm border border-[var(--border-subtle-card)] text-[var(--text-body-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-luxury px-6 py-2 rounded-xl text-sm font-bold"
                >
                  Lock &amp; Save Revision {revisionEvent.quotes.length + 1}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Refund Advice Modal */}
      {refundPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-refund-modal-title"
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl max-w-md w-full p-6 text-[var(--text-primary)] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle-card)]">
              <h3 id="bulk-refund-modal-title" className="font-serif font-bold text-lg text-[var(--text-primary)]">
                Bulk Cancellation Advice
              </h3>
              <button
                type="button"
                aria-label="Close Bulk Cancellation modal"
                onClick={() => setRefundPreview(null)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-[var(--text-body-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              Based on Section 17.7 (Master PRD v2 Addendum) for event on{' '}
              <span className="font-bold text-[var(--text-accent)]">{refundPreview.event.eventDate}</span>:
            </p>

            <div className="bg-[var(--bg-surface-muted)] p-4 rounded-xl border border-[var(--border-subtle-card)] space-y-2 text-sm font-mono price-tabular">
              <div className="flex justify-between text-[var(--text-body-muted)]">
                <span>Notice Duration:</span>
                <span className="text-[var(--text-primary)] font-bold">
                  {refundPreview.calc.noticeHours} Hours
                </span>
              </div>
              <div className="flex justify-between text-[var(--text-body-muted)]">
                <span>Refund Tier:</span>
                <span className="text-[var(--text-money-positive)] font-bold">
                  {refundPreview.calc.refundBps / 100}% of Food
                </span>
              </div>
              <div className="flex justify-between text-[var(--text-body-muted)]">
                <span>Eligible Food Refund:</span>
                <span className="text-[var(--text-money-positive)] font-bold">
                  {formatNaira(refundPreview.calc.eligibleFoodRefundKobo)}
                </span>
              </div>
            </div>

            <p className="text-sm text-[var(--text-body-muted)] italic leading-snug">
              {refundPreview.calc.reason}
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setRefundPreview(null)}
                className="btn-luxury px-5 py-2 rounded-xl text-sm font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
