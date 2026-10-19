/**
 * ROCK UC FOODS - Catering Quotes & Revision Engine
 * (Playbook v2 Section 9, 10 & Section 17 v3 Addendum)
 * Enforces BigInt integer kobo arithmetic, immutable revision tracking,
 * zero-loss deposit/balance scheduling, and deterministic bulk cancellation policies.
 */

import {
  CateringEvent,
  CateringQuote,
  CreateEventInquiryInput,
  CreateQuoteInput,
  QuoteLineItem,
} from '../types/catering';
import { cateringRepository } from './cateringRepository';
import { normalizeNigerianPhone } from '../lib/security';
import { applyPercentRoundHalfUp } from '../lib/money';
import { bulkRefundBps } from '../policy/refund';

export function generateEventCode(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomSuffix = '';
  for (let i = 0; i < 4; i++) {
    randomSuffix += chars[Math.floor(Math.random() * chars.length)];
  }

  return `EVT-${dateStr}-${randomSuffix}`;
}

export function createEventInquiry(input: CreateEventInquiryInput): CateringEvent {
  if (!input.clientName || input.clientName.trim().length < 2) {
    throw new Error('Client name must be at least 2 characters.');
  }

  const normalizedPhone = normalizeNigerianPhone(input.clientPhone);

  if (!input.eventDate || !input.eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    throw new Error('Please select a valid event date in YYYY-MM-DD format.');
  }

  if (input.guestCount < 10 || input.guestCount > 5000) {
    throw new Error('Guest count must be between 10 and 5,000 guests.');
  }

  if (!input.venueAddress || input.venueAddress.trim().length < 5) {
    throw new Error('Please specify the full venue address or event location in Lagos.');
  }

  const eventId = `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const newEvent: CateringEvent = {
    id: eventId,
    eventCode: generateEventCode(),
    clientName: input.clientName.trim(),
    clientPhone: normalizedPhone,
    clientEmail: input.clientEmail ? input.clientEmail.trim() : undefined,
    eventType: input.eventType,
    eventDate: input.eventDate,
    guestCount: input.guestCount,
    venueAddress: input.venueAddress.trim(),
    liveCookingRequested: Boolean(input.liveCookingRequested),
    specialNotes: input.specialNotes ? input.specialNotes.trim() : undefined,
    status: 'inquiry',
    createdAt: nowIso,
    updatedAt: nowIso,
    quotes: [],
  };

  return cateringRepository.save(newEvent);
}

export function createOrReviseQuote(input: CreateQuoteInput): CateringQuote {
  const event = cateringRepository.getById(input.eventId);
  if (!event) {
    throw new Error(`Catering event '${input.eventId}' not found.`);
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('At least one menu item line is required to generate a quote.');
  }

  const quoteId = `quote-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const revisionNumber = event.quotes.length + 1;

  let foodSubtotalKobo = 0n;
  const quoteItems: QuoteLineItem[] = [];

  for (let idx = 0; idx < input.items.length; idx++) {
    const item = input.items[idx];
    if (item.unitPriceKobo < 0n) {
      throw new Error(`Line item price cannot be negative.`);
    }
    if (item.quantity <= 0) {
      throw new Error(`Line item quantity must be greater than zero.`);
    }

    const lineTotalKobo = item.unitPriceKobo * BigInt(item.quantity);
    foodSubtotalKobo += lineTotalKobo;

    quoteItems.push({
      id: `qline-${quoteId}-${idx + 1}`,
      quoteId,
      name: item.name.trim(),
      portionLabel: item.portionLabel,
      description: item.description,
      unitPriceKobo: item.unitPriceKobo,
      quantity: item.quantity,
      totalKobo: lineTotalKobo,
    });
  }

  const logisticsFeeKobo = input.logisticsFeeKobo >= 0n ? input.logisticsFeeKobo : 0n;
  const serviceFeeKobo = input.serviceFeeKobo >= 0n ? input.serviceFeeKobo : 0n;
  const totalKobo = foodSubtotalKobo + logisticsFeeKobo + serviceFeeKobo;

  const depositPercentage = input.depositPercentage || 70;
  if (depositPercentage < 10 || depositPercentage > 100) {
    throw new Error('Deposit percentage must be between 10% and 100%.');
  }

  // Exact integer kobo rounding without 1-kobo loss
  const depositKobo = applyPercentRoundHalfUp(totalKobo, depositPercentage * 100);
  const balanceKobo = totalKobo - depositKobo;

  if (depositKobo + balanceKobo !== totalKobo) {
    throw new Error('Schedule reconciliation failure: deposit + balance must equal total.');
  }

  // Mark all previous active quotes as superseded (Immutable history)
  for (const prevQuote of event.quotes) {
    if (prevQuote.status === 'active') {
      prevQuote.status = 'superseded';
      prevQuote.updatedAt = new Date().toISOString();
    }
  }

  const newQuote: CateringQuote = {
    id: quoteId,
    eventId: event.id,
    revisionNumber,
    foodSubtotalKobo,
    logisticsFeeKobo,
    serviceFeeKobo,
    totalKobo,
    depositPercentage,
    depositKobo,
    balanceKobo,
    depositStatus: 'unpaid',
    balanceStatus: 'unpaid',
    status: 'active',
    notes: input.notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: quoteItems,
  };

  event.quotes.push(newQuote);
  if (event.status === 'inquiry') {
    event.status = 'quote_sent';
  }
  event.updatedAt = new Date().toISOString();
  cateringRepository.save(event);

  return newQuote;
}

export function recordQuotePayment(
  eventId: string,
  quoteId: string,
  paymentType: 'deposit' | 'balance',
  actorUserId: string = 'usr-owner-01'
): CateringQuote {
  const event = cateringRepository.getById(eventId);
  if (!event) throw new Error(`Event '${eventId}' not found.`);

  const quote = event.quotes.find((q) => q.id === quoteId);
  if (!quote) throw new Error(`Quote '${quoteId}' not found on event.`);

  const nowIso = new Date().toISOString();

  if (paymentType === 'deposit') {
    quote.depositStatus = 'paid';
    quote.depositPaidAt = nowIso;
    quote.depositVerifiedBy = actorUserId;
    if (quote.balanceStatus === 'paid') {
      event.status = 'fully_paid';
    } else {
      event.status = 'deposit_paid';
    }
  } else {
    quote.balanceStatus = 'paid';
    quote.balancePaidAt = nowIso;
    quote.balanceVerifiedBy = actorUserId;
    if (quote.depositStatus === 'paid') {
      event.status = 'fully_paid';
    }
  }

  quote.updatedAt = nowIso;
  event.updatedAt = nowIso;
  cateringRepository.save(event);

  return quote;
}

export function calculateBulkRefundNotice(
  event: CateringEvent,
  quote: CateringQuote,
  cancellationDate: Date = new Date()
): { noticeHours: number; refundBps: number; eligibleFoodRefundKobo: bigint; reason: string } {
  // Event starts at 09:00 AM Lagos time (UTC+1)
  const eventDateTime = new Date(`${event.eventDate}T09:00:00+01:00`);
  const diffMs = eventDateTime.getTime() - cancellationDate.getTime();
  const noticeHours = Math.floor(diffMs / (1000 * 60 * 60));

  const refundBps = bulkRefundBps(noticeHours);
  const eligibleFoodRefundKobo = applyPercentRoundHalfUp(quote.foodSubtotalKobo, refundBps);

  let reason = '';
  if (noticeHours >= 72) {
    reason = `Notice of ${noticeHours} hours provided (72h+). Eligible for 80% food subtotal refund. Logistics & setup non-refundable.`;
  } else if (noticeHours >= 48) {
    reason = `Notice of ${noticeHours} hours provided (48-72h). Eligible for 50% food subtotal refund. Logistics & setup non-refundable.`;
  } else if (noticeHours >= 24) {
    reason = `Notice of ${noticeHours} hours provided (24-48h). Eligible for 25% food subtotal refund. Logistics & setup non-refundable.`;
  } else {
    reason = `Notice of ${noticeHours} hours provided (less than 24h). Fresh perishables purchased. Non-refundable per Section 17.7.`;
  }

  return {
    noticeHours,
    refundBps,
    eligibleFoodRefundKobo,
    reason,
  };
}
