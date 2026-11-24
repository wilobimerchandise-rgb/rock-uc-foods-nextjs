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

  const copyEventCode = async (code: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      setError('Could not copy event reference code automatically. Please copy it manually.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="catering-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--ink)]/85 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl max-w-xl w-full p-6 text-[var(--text-primary)] shadow-2xl relative my-auto">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle-card)] mb-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[var(--text-accent)] shrink-0" />
            <h2 id="catering-modal-title" className="font-serif font-bold text-lg sm:text-xl text-[var(--text-primary)]">
              Bulk Catering &amp; Event Inquiry
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-body-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-muted)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedEvent ? (
          <div className="space-y-4 py-3 text-center">
            <div className="w-12 h-12 bg-[var(--status-success-bg)] border border-[var(--status-success-border)] rounded-full flex items-center justify-center mx-auto text-[var(--status-success-text)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <span className="text-sm text-[var(--text-accent)] uppercase tracking-widest font-semibold block">
                Inquiry Successfully Logged
              </span>
              <h3 className="font-serif font-bold text-xl text-[var(--text-primary)] mt-1">
                Thank You, {submittedEvent.clientName}!
              </h3>
              <p className="text-sm text-[var(--text-body-muted)] max-w-md mx-auto mt-1 leading-relaxed">
                Chef Esther Kwentua will prepare your bespoke itemized quote for {submittedEvent.guestCount} guests on{' '}
                {submittedEvent.eventDate}.
              </p>
            </div>

            <div className="bg-[var(--bg-surface-muted)] p-3 rounded-xl border border-[var(--border-subtle-card)] max-w-xs mx-auto flex items-center justify-between gap-2">
              <div className="text-left">
                <span className="text-sm text-[var(--text-body-muted)] block">Event Reference Code:</span>
                <span className="font-mono font-bold text-[var(--text-accent)] text-base">{submittedEvent.eventCode}</span>
              </div>
              <button
                type="button"
                onClick={() => copyEventCode(submittedEvent.eventCode)}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-body-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-card)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                aria-label="Copy reference code"
              >
                {copiedCode ? <Check className="w-5 h-5 text-[var(--status-success-text)]" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={`https://wa.me/2348033729125?text=${encodeURIComponent(
                  `Hello Chef Esther, I have submitted a catering inquiry (${submittedEvent.eventCode}) for ${submittedEvent.eventType} on ${submittedEvent.eventDate} (${submittedEvent.guestCount} guests). Kindly assist with quote.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] bg-[#166534] hover:bg-[#15803D] text-white font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 shadow transition-colors"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Message Chef Esther on WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] bg-[var(--bg-surface-muted)] hover:bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-card)] py-2.5 px-5 rounded-xl text-sm font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {error && (
              <div
                role="alert"
                className="p-3 bg-[var(--status-danger-bg)] border border-[var(--status-danger-border)] text-[var(--status-danger-text)] rounded-lg flex items-center gap-2 text-sm font-semibold"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="catering-client-name" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                  Full Name / Organization <span className="text-[var(--text-accent)]">*</span>
                </label>
                <input
                  id="catering-client-name"
                  type="text"
                  required
                  placeholder="e.g. Bank of Industry / Aisha Bello"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label htmlFor="catering-client-phone" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                  Nigerian Phone Number <span className="text-[var(--text-accent)]">*</span>
                </label>
                <input
                  id="catering-client-phone"
                  type="tel"
                  required
                  placeholder="0803 372 9125"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="catering-event-type" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                  Event Type
                </label>
                <select
                  id="catering-event-type"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
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
                <label htmlFor="catering-event-date" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                  Event Date <span className="text-[var(--text-accent)]">*</span>
                </label>
                <input
                  id="catering-event-date"
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                />
              </div>

              <div>
                <label htmlFor="catering-guest-count" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                  Expected Guests <span className="text-[var(--text-accent)]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="catering-guest-count"
                    type="number"
                    min={10}
                    max={5000}
                    required
                    value={guestCount}
                    onChange={(e) => setGuestCount(Number(e.target.value))}
                    className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg pl-3 pr-9 py-2 text-sm text-[var(--text-primary)] price-tabular focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                  />
                  <Users className="w-4 h-4 text-[var(--text-body-muted)] absolute right-3 top-3.5 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="catering-venue-address" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                Venue Address &amp; Lagos Location <span className="text-[var(--text-accent)]">*</span>
              </label>
              <div className="relative">
                <input
                  id="catering-venue-address"
                  type="text"
                  required
                  placeholder="e.g. Landmark Centre, Water Corporation Drive, Victoria Island, Lagos"
                  value={venueAddress}
                  onChange={(e) => setVenueAddress(e.target.value)}
                  className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg pl-3 pr-9 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                />
                <MapPin className="w-4 h-4 text-[var(--text-body-muted)] absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="catering-client-email" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                Client Email (For formal PDF quote)
              </label>
              <input
                id="catering-client-email"
                type="email"
                placeholder="events@company.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full min-h-[44px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
              />
            </div>

            <div className="p-3 bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] rounded-xl">
              <label htmlFor="catering-live-cooking" className="flex items-start gap-3 cursor-pointer">
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <input
                    id="catering-live-cooking"
                    type="checkbox"
                    checked={liveCookingRequested}
                    onChange={(e) => setLiveCookingRequested(e.target.checked)}
                    className="peer appearance-none w-11 h-11 rounded-lg border border-[var(--border-card)] bg-[var(--bg-primary)] checked:bg-[var(--cta-wine-bg)] checked:border-[var(--border-gold)] cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                  />
                  <Check className="w-5 h-5 text-[var(--cream)] pointer-events-none absolute opacity-0 peer-checked:opacity-100" />
                </div>
                <div className="pt-1">
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)] font-semibold">
                    <Flame className="w-4 h-4 text-[var(--text-accent)] shrink-0" />
                    <span>Request Live Cooking / On-Site Chef Station</span>
                  </div>
                  <p className="text-sm text-[var(--text-body-muted)] mt-1 leading-relaxed">
                    Chef Esther Kwentua and culinary team will grill and stir authentic dishes live at your event.
                  </p>
                </div>
              </label>
            </div>

            <div>
              <label htmlFor="catering-special-notes" className="block text-sm font-medium text-[var(--text-body-muted)] mb-1">
                Menu Preferences &amp; Special Instructions
              </label>
              <textarea
                id="catering-special-notes"
                rows={2}
                placeholder="e.g. Jollof rice, peppered goat meat, seafood okro, plantain, mocktails..."
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
                className="w-full min-h-[80px] bg-[var(--bg-primary)] border border-[var(--border-card)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
              />
            </div>

            <div className="pt-2 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold text-[var(--text-body-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)] transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-luxury min-h-[44px] px-6 py-2.5 text-sm font-bold rounded-xl shadow-lg inline-flex items-center gap-2 disabled:opacity-50"
              >
                <CalendarDays className="w-4 h-4 text-[var(--gold-light)] shrink-0" />
                <span>{isSubmitting ? 'Submitting...' : 'Submit Catering Inquiry'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
