/**
 * ROCK UC FOODS - Events, Bulk Catering Quotes & Invoicing Type Definitions
 * (Playbook v2 Section 9, 10 & Section 17 v3 Addendum)
 * Monetary values are strictly BigInt integer kobo.
 */

export type EventStatus =
  | 'inquiry'
  | 'quote_sent'
  | 'deposit_paid'
  | 'fully_paid'
  | 'in_prep'
  | 'completed'
  | 'cancelled';

export type QuoteStatus = 'draft' | 'active' | 'superseded' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface QuoteLineItem {
  id: string;
  quoteId: string;
  name: string;
  portionLabel?: string;
  description?: string;
  unitPriceKobo: bigint;
  quantity: number;
  totalKobo: bigint;
}

export interface CateringQuote {
  id: string;
  eventId: string;
  revisionNumber: number;
  foodSubtotalKobo: bigint;
  logisticsFeeKobo: bigint;
  serviceFeeKobo: bigint;
  totalKobo: bigint;
  depositPercentage: number; // e.g. 70
  depositKobo: bigint;
  balanceKobo: bigint;
  depositStatus: PaymentStatus;
  balanceStatus: 'unpaid' | 'paid';
  depositPaidAt?: string;
  balancePaidAt?: string;
  depositVerifiedBy?: string;
  balanceVerifiedBy?: string;
  status: QuoteStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: QuoteLineItem[];
}

export interface CateringEvent {
  id: string;
  eventCode: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  eventType: string;
  eventDate: string; // YYYY-MM-DD
  guestCount: number;
  venueAddress: string;
  liveCookingRequested: boolean;
  specialNotes?: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  quotes: CateringQuote[];
}

export interface CreateEventInquiryInput {
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  eventType: string;
  eventDate: string;
  guestCount: number;
  venueAddress: string;
  liveCookingRequested?: boolean;
  specialNotes?: string;
  requestedDishes?: { name: string; quantity: number }[];
}

export interface CreateQuoteInput {
  eventId: string;
  depositPercentage?: number; // defaults to 70%
  logisticsFeeKobo: bigint;
  serviceFeeKobo: bigint;
  notes?: string;
  items: {
    name: string;
    portionLabel?: string;
    description?: string;
    unitPriceKobo: bigint;
    quantity: number;
  }[];
}
