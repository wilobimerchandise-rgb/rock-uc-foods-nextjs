/**
 * ROCK UC FOODS - Event Catering Inquiry Modal
 * (Playbook v2 Section 9 & Section 17 v3 Addendum)
 * Allows corporate clients, event planners, and hosts to request bespoke bulk catering quotes.
 */

import React, { useState } from 'react';
import { createEventInquiry } from '../../catering/cateringEngine';
import { CateringEvent } from '../../types/catering';
import { BUSINESS_CONTACT } from '../../policy/content';
import {
  CalendarDays,
  Users,
  MapPin,
  Flame,
  CheckCircle2,
  AlertCircle,
  X,
  MessageCircle,
  Copy,
  Check,
} from 'lucide-react';

interface EventInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInquirySubmitted?: (event: CateringEvent) => void;
}

export const EventInquiryModal: React.FC<EventInquiryModalProps> = ({
  isOpen,
  onClose,
  onInquirySubmitted,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [eventType, setEventType] = useState('Corporate Gala / Conference');
  const [eventDate, setEventDate] = useState('');
  const [guestCount, setGuestCount] = useState<number>(50);
  const [venueAddress, setVenueAddress] = useState('');
  const [liveCookingRequested, setLiveCookingRequested] = useState(false);
  const [specialNotes, setSpecialNotes] = useState('');

  const [submittedEvent, setSubmittedEvent] = useState<CateringEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const event = createEventInquiry({
        clientName,
        clientPhone,
        clientEmail: clientEmail || undefined,
        eventType,
        eventDate,
        guestCount: Number(guestCount),
        venueAddress,
        liveCookingRequested,
        specialNotes: specialNotes || undefined,
      });

      setSubmittedEvent(event);
      if (onInquirySubmitted) onInquirySubmitted(event);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyEventCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="catering-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-[#17120F] border border-[#D4AF37]/50 rounded-2xl max-w-xl w-full p-6 text-[#F7EFD9] shadow-2xl relative my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#D4AF37]" />
            <h2 id="catering-modal-title" className="font-serif font-bold text-lg sm:text-xl text-[#F7EFD9]">
              Bulk Catering &amp; Event Inquiry
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-1 rounded hover:bg-white/10"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedEvent ? (
          <div className="space-y-4 py-3 text-center">
            <div className="w-12 h-12 bg-emerald-950/80 border border-emerald-600 rounded-full flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <span className="text-xs text-[#D4AF37] uppercase tracking-widest font-semibold block">
                Inquiry Successfully Logged
              </span>
              <h3 className="font-serif font-bold text-xl text-[#F7EFD9] mt-1">
                Thank You, {submittedEvent.clientName}!
              </h3>
              <p className="text-xs text-white/70 max-w-md mx-auto mt-1 leading-relaxed">
                Chef Esther Kwentua will prepare your bespoke itemized quote for {submittedEvent.guestCount} guests on{' '}
                {submittedEvent.eventDate}.
              </p>
            </div>

            <div className="bg-[#0B0A09] p-3 rounded-xl border border-white/10 max-w-xs mx-auto flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] text-white/40 block">Event Reference Code:</span>
                <span className="font-mono font-bold text-[#D4AF37] text-sm">{submittedEvent.eventCode}</span>
              </div>
              <button
                onClick={() => copyEventCode(submittedEvent.eventCode)}
                className="text-white/60 hover:text-white p-1"
                aria-label="Copy reference code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <a
                href={`https://wa.me/2348033729125?text=${encodeURIComponent(
                  `Hello Chef Esther, I have submitted a catering inquiry (${submittedEvent.eventCode}) for ${submittedEvent.eventType} on ${submittedEvent.eventDate} (${submittedEvent.guestCount} guests). Kindly assist with quote.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <MessageCircle className="w-4 h-4" /> Message Chef Esther on WhatsApp
              </a>

              <button
                onClick={onClose}
                className="bg-white/10 hover:bg-white/15 text-white/80 py-2.5 px-4 rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            {error && (
              <div className="p-3 bg-[#B3261E]/90 text-white rounded-lg flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-white/70 mb-1">
                  Full Name / Organization <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bank of Industry / Aisha Bello"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/70 mb-1">
                  Nigerian Phone Number <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0803 372 9125"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-white/70 mb-1">Event Type</label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="Corporate Gala / Conference">Corporate Gala / Conference</option>
                  <option value="Wedding Reception">Wedding Reception</option>
                  <option value="Birthday / Anniversary">Birthday / Anniversary</option>
                  <option value="Private Dining Experience">Private Dining Experience</option>
                  <option value="End of Year Celebration">End of Year Celebration</option>
                  <option value="Funeral Repast / Memorial">Funeral Repast / Memorial</option>
                  <option value="Bespoke Bulk Order">Bespoke Bulk Order</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-white/70 mb-1">
                  Event Date <span className="text-[#D4AF37]">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-white/70 mb-1">
                  Expected Guests <span className="text-[#D4AF37]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    required
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
                  />
                  <Users className="w-3.5 h-3.5 text-white/40 absolute right-3 top-3" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-white/70 mb-1">
                Venue Address &amp; Lagos Location <span className="text-[#D4AF37]">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Landmark Centre, Water Corporation Drive, Victoria Island, Lagos"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-white/70 mb-1">Client Email (For formal PDF quote)</label>
              <input
                type="email"
                placeholder="events@company.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="p-3 bg-[#0B0A09] border border-white/10 rounded-xl">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={liveCookingRequested}
                  onChange={(e) => setLiveCookingRequested(e.target.checked)}
                  className="w-4 h-4 rounded text-[#6B1230] accent-[#D4AF37]"
                />
                <div className="flex items-center gap-1.5 text-xs text-[#F7EFD9]">
                  <Flame className="w-4 h-4 text-[#D4AF37]" />
                  <span className="font-semibold">Request Live Cooking / On-Site Chef Station</span>
                </div>
              </label>
              <p className="text-[10px] text-white/50 pl-6 mt-0.5">
                Chef Esther Kwentua and culinary team will grill and stir authentic dishes live at your event.
              </p>
            </div>

            <div>
              <label className="block text-[11px] text-white/70 mb-1">
                Menu Preferences &amp; Special Instructions
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Jollof rice, peppered goat meat, seafood okro, plantain, mocktails..."
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                className="w-full bg-[#0B0A09] border border-white/10 rounded-lg p-2.5 text-xs text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded text-xs text-white/60 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-luxury px-6 py-2.5 text-xs font-bold rounded-xl shadow-lg flex items-center gap-2"
              >
                <CalendarDays className="w-4 h-4 text-[#D4AF37]" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Catering Inquiry'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
