/**
 * ROCK UC FOODS - Staff / Owner Catering & Invoicing Manager
 * (Playbook v2 Section 9, 10 & Section 17 v3 Addendum)
 * Manage bespoke event bookings, generate PDF invoices, track revision history,
 * and verify deposit/balance payment schedules.
 */

import React, { useState } from 'react';
import { cateringRepository } from '../../catering/cateringRepository';
import {
  createOrReviseQuote,
  recordQuotePayment,
  calculateBulkRefundNotice,
} from '../../catering/cateringEngine';
import { generateCateringInvoicePdf } from '../../catering/cateringPdf';
import { CateringEvent, CateringQuote, EventStatus } from '../../types/catering';
import { formatNaira, parseNairaToKobo } from '../../lib/money';
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
  Building2,
  Clock,
  Sparkles,
  X,
  CreditCard,
} from 'lucide-react';

interface StaffCateringManagerProps {
  currentUserRole: 'owner' | 'staff' | 'developer';
  currentUserId: string;
}

export const StaffCateringManager: React.FC<StaffCateringManagerProps> = ({
  currentUserRole,
  currentUserId,
}) => {
  const isOwnerOrDev = currentUserRole === 'owner' || currentUserRole === 'developer';

  const [events, setEvents] = useState<CateringEvent[]>(() => cateringRepository.getAll());
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
      const { pdfBytes, filename } = await generateCateringInvoicePdf(event, quote);

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
      setRevLogisticsNaira((Number(latestQuote.logisticsFeeKobo) / 100).toString());
      setRevServiceNaira((Number(latestQuote.serviceFeeKobo) / 100).toString());
      setRevNotes(latestQuote.notes || '');
      setRevItems(
        latestQuote.items.map((i) => ({
          name: i.name,
          portionLabel: i.portionLabel || '',
          priceNaira: (Number(i.unitPriceKobo) / 100).toString(),
          quantity: i.quantity,
        }))
      );
    } else {
      setRevDepositPct(70);
      setRevLogisticsNaira('50000');
      setRevServiceNaira('100000');
      setRevNotes('');
      setRevItems([
        { name: 'Smoky Party Jollof & Fried Rice', portionLabel: `${event.guestCount} Servings`, priceNaira: '5000', quantity: event.guestCount },
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
            <h1 className="text-2xl font-serif font-bold text-[#F7EFD9]">Events &amp; Bulk Catering Quotes</h1>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#D4AF37] text-[#0B0A09]">
              Role: {currentUserRole}
            </span>
          </div>
          <p className="text-xs text-[#F7EFD9]/60 mt-1">
            Bespoke event catering quotes, 70/30 deposit schedules, revision history, and branded PDF invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#D4AF37] bg-[#17120F] px-3 py-1.5 rounded border border-white/10">
            {events.length} Events Logged
          </span>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
        {['all', 'inquiry', 'quote_sent', 'deposit_paid', 'fully_paid', 'completed', 'cancelled'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg font-semibold shrink-0 transition-all ${
              filterStatus === st
                ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                : 'bg-[#17120F] text-white/60 hover:text-white border border-white/5'
            }`}
          >
            {st.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center bg-[#17120F] rounded-xl border border-white/5 text-white/50 text-xs">
            No events found matching this status.
          </div>
        ) : (
          filteredEvents.map((event) => {
            const activeQuote = event.quotes.find((q) => q.status === 'active') || event.quotes[event.quotes.length - 1];

            return (
              <div
                key={event.id}
                className="bg-[#17120F] border border-white/10 hover:border-[#D4AF37]/40 rounded-xl p-5 space-y-4 transition-all"
              >
                {/* Event Top Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-sm text-[#D4AF37]">{event.eventCode}</span>
                    <h3 className="font-serif font-bold text-base text-[#F7EFD9]">{event.clientName}</h3>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        event.status === 'fully_paid'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : event.status === 'deposit_paid'
                          ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                          : event.status === 'quote_sent'
                          ? 'bg-blue-950 text-blue-300 border border-blue-700'
                          : 'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}
                    >
                      {event.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="text-xs text-white/60 flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" /> {event.eventDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#D4AF37]" /> {event.guestCount} Guests
                    </span>
                  </div>
                </div>

                {/* Event Specifications */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#0B0A09] p-3.5 rounded-xl border border-white/5">
                  <div>
                    <span className="text-white/40 block text-[10px] uppercase tracking-wider">Event &amp; Venue</span>
                    <p className="font-semibold text-[#F7EFD9] mt-0.5">{event.eventType}</p>
                    <p className="text-white/70 text-[11px] flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-[#D4AF37] shrink-0" /> {event.venueAddress}
                    </p>
                    {event.liveCookingRequested && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-700 mt-1.5 font-semibold">
                        <Flame className="w-3 h-3 text-amber-400" /> Live Cooking Station Requested
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-white/40 block text-[10px] uppercase tracking-wider">Client Contact</span>
                    <p className="font-semibold text-[#F7EFD9] mt-0.5">{event.clientPhone}</p>
                    {event.clientEmail && <p className="text-white/60 text-[11px]">{event.clientEmail}</p>}
                    {event.specialNotes && (
                      <p className="text-amber-200/80 italic text-[11px] mt-1">Note: {event.specialNotes}</p>
                    )}
                  </div>
                </div>

                {/* Quote Schedule Box */}
                {activeQuote ? (
                  <div className="p-4 bg-[#140F0D] rounded-xl border border-[#D4AF37]/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#D4AF37]" />
                        <span className="font-serif font-bold text-xs text-[#F7EFD9]">
                          Quote Revision {activeQuote.revisionNumber} ({activeQuote.items.length} line items)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-sm text-[#D4AF37]">
                        Total: {formatNaira(activeQuote.totalKobo)}
                      </span>
                    </div>

                    {/* Deposit & Balance Schedule Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#0B0A09] p-3 rounded-lg border border-white/5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-white/60 text-[11px]">70% Booking Deposit:</span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                              activeQuote.depositStatus === 'paid'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                : 'bg-amber-950 text-amber-300 border border-amber-700'
                            }`}
                          >
                            {activeQuote.depositStatus}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[#F7EFD9] text-sm">
                          {formatNaira(activeQuote.depositKobo)}
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-white/60 text-[11px]">30% Final Balance:</span>
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded ${
                              activeQuote.balanceStatus === 'paid'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                : 'bg-black/40 text-white/50 border border-white/10'
                            }`}
                          >
                            {activeQuote.balanceStatus}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[#F7EFD9] text-sm">
                          {formatNaira(activeQuote.balanceKobo)}
                        </span>
                      </div>
                    </div>

                    {/* Quote Action Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleDownloadPdf(event, activeQuote)}
                        className="bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/50 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow"
                      >
                        <Download className="w-3.5 h-3.5 text-[#D4AF37]" /> Download Official PDF Invoice
                      </button>

                      {isOwnerOrDev && activeQuote.depositStatus !== 'paid' && (
                        <button
                          onClick={() => handleVerifyDeposit(event, activeQuote)}
                          className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Confirm 70% Deposit
                        </button>
                      )}

                      {isOwnerOrDev && activeQuote.depositStatus === 'paid' && activeQuote.balanceStatus !== 'paid' && (
                        <button
                          onClick={() => handleVerifyBalance(event, activeQuote)}
                          className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Confirm 30% Balance
                        </button>
                      )}

                      {isOwnerOrDev && (
                        <button
                          onClick={() => openRevisionModal(event)}
                          className="bg-[#17120F] border border-white/15 hover:border-[#D4AF37] text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ml-auto"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#D4AF37]" /> Create Revision {event.quotes.length + 1}
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenRefundCalc(event, activeQuote)}
                        className="bg-black/30 hover:bg-black/60 text-white/60 hover:text-white px-2.5 py-1.5 rounded text-xs flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Refund Policy Advice
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#0B0A09] rounded-xl border border-white/5 flex items-center justify-between">
                    <span className="text-xs text-white/50">No quote generated for this inquiry yet.</span>
                    {isOwnerOrDev && (
                      <button
                        onClick={() => openRevisionModal(event)}
                        className="btn-luxury px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Generate Quote Revision 1
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create / Revise Quote Modal */}
      {revisionEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[#17120F] border border-[#D4AF37] rounded-2xl max-w-2xl w-full p-6 text-[#F7EFD9] space-y-4 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-serif font-bold text-lg text-[#F7EFD9]">
                Generate Quote Revision {revisionEvent.quotes.length + 1} for {revisionEvent.clientName}
              </h3>
              <button onClick={() => setRevisionEvent(null)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCommitRevision} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-white/70 mb-1">Deposit Percentage (%)</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={revDepositPct}
                    onChange={(e) => setRevDepositPct(Number(e.target.value))}
                    className="w-full bg-[#0B0A09] border border-white/10 rounded p-2 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-white/70 mb-1">Logistics / Transport (₦)</label>
                  <input
                    type="text"
                    value={revLogisticsNaira}
                    onChange={(e) => setRevLogisticsNaira(e.target.value)}
                    className="w-full bg-[#0B0A09] border border-white/10 rounded p-2 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-white/70 mb-1">Service &amp; Staff Crew (₦)</label>
                  <input
                    type="text"
                    value={revServiceNaira}
                    onChange={(e) => setRevServiceNaira(e.target.value)}
                    className="w-full bg-[#0B0A09] border border-white/10 rounded p-2 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Line items editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-serif font-bold text-[#D4AF37]">Menu Line Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      setRevItems((prev) => [
                        ...prev,
                        { name: 'Gourmet Dish Line', portionLabel: 'Portions', priceNaira: '3500', quantity: 50 },
                      ])
                    }
                    className="text-[11px] text-[#D4AF37] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Item Line
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {revItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 bg-[#0B0A09] p-2 rounded border border-white/5">
                      <input
                        type="text"
                        placeholder="Dish Name"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...revItems];
                          updated[idx].name = e.target.value;
                          setRevItems(updated);
                        }}
                        className="col-span-5 bg-[#17120F] border border-white/10 rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Portion"
                        value={item.portionLabel}
                        onChange={(e) => {
                          const updated = [...revItems];
                          updated[idx].portionLabel = e.target.value;
                          setRevItems(updated);
                        }}
                        className="col-span-3 bg-[#17120F] border border-white/10 rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Unit ₦"
                        value={item.priceNaira}
                        onChange={(e) => {
                          const updated = [...revItems];
                          updated[idx].priceNaira = e.target.value;
                          setRevItems(updated);
                        }}
                        className="col-span-2 bg-[#17120F] border border-white/10 rounded px-2 py-1 text-xs font-mono"
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...revItems];
                          updated[idx].quantity = Number(e.target.value);
                          setRevItems(updated);
                        }}
                        className="col-span-2 bg-[#17120F] border border-white/10 rounded px-2 py-1 text-xs font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-white/70 mb-1">Revision Scope Notes (Printed on invoice)</label>
                <input
                  type="text"
                  placeholder="e.g. Includes chafing equipment, live cooking chef, and standard service staff."
                  value={revNotes}
                  onChange={(e) => setRevNotes(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded p-2 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setRevisionEvent(null)}
                  className="px-4 py-2 rounded text-white/60 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-luxury px-6 py-2 rounded-xl text-xs font-bold"
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
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#17120F] border border-[#D4AF37] rounded-xl max-w-md w-full p-6 text-[#F7EFD9] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="font-serif font-bold text-base text-[#F7EFD9]">Bulk Cancellation Advice</h3>
              <button onClick={() => setRefundPreview(null)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/80 leading-relaxed">
              Based on Section 17.7 (Master PRD v2 Addendum) for event on{' '}
              <span className="font-bold text-[#D4AF37]">{refundPreview.event.eventDate}</span>:
            </p>

            <div className="bg-[#0B0A09] p-3 rounded-lg border border-white/5 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-white/70">
                <span>Notice Duration:</span>
                <span className="text-[#F7EFD9] font-bold">{refundPreview.calc.noticeHours} Hours</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Refund Tier:</span>
                <span className="text-emerald-400 font-bold">{refundPreview.calc.refundBps / 100}% of Food</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Eligible Food Refund:</span>
                <span className="text-emerald-400 font-bold">
                  {formatNaira(refundPreview.calc.eligibleFoodRefundKobo)}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-white/60 italic leading-snug">
              {refundPreview.calc.reason}
            </p>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRefundPreview(null)}
                className="btn-luxury px-4 py-1.5 rounded-lg text-xs font-bold"
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
