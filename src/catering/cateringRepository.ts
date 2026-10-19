/**
 * ROCK UC FOODS - Catering Events & Quotes Repository
 * (Playbook v2 Section 9, 10 & Section 17 v3 Addendum)
 * Authoritative data store with revision history and BigInt kobo arithmetic.
 */

import { CateringEvent, CateringQuote, EventStatus, PaymentStatus } from '../types/catering';

const CATERING_STORAGE_KEY = 'rock_uc_catering_events_v1';

class CateringRepository {
  private events: Map<string, CateringEvent> = new Map();

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(CATERING_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const ev of parsed) {
              const revived: CateringEvent = {
                ...ev,
                quotes: (ev.quotes || []).map((q: any) => ({
                  ...q,
                  foodSubtotalKobo: BigInt(q.foodSubtotalKobo),
                  logisticsFeeKobo: BigInt(q.logisticsFeeKobo),
                  serviceFeeKobo: BigInt(q.serviceFeeKobo),
                  totalKobo: BigInt(q.totalKobo),
                  depositKobo: BigInt(q.depositKobo),
                  balanceKobo: BigInt(q.balanceKobo),
                  items: (q.items || []).map((i: any) => ({
                    ...i,
                    unitPriceKobo: BigInt(i.unitPriceKobo),
                    totalKobo: BigInt(i.totalKobo),
                  })),
                })),
              };
              this.events.set(revived.id, revived);
            }
            return;
          }
        }
      } catch {
        // fallback
      }
    }

    // Seed Initial Luxury Catering Event for Demo
    const seedEvent: CateringEvent = {
      id: 'evt-seed-001',
      eventCode: 'EVT-20261120-4K9P',
      clientName: 'Chevron Nigeria Staff Cooperative',
      clientPhone: '+2348033729125',
      clientEmail: 'events@chevroncoop.ng',
      eventType: 'Corporate Annual Gala',
      eventDate: '2026-11-20',
      guestCount: 150,
      venueAddress: 'The Civic Centre, Ozumba Mbadiwe Avenue, Victoria Island, Lagos',
      liveCookingRequested: true,
      specialNotes: 'Live peppered snail and smoky party jollof station. Premium chaffing dishes requested.',
      status: 'deposit_paid',
      createdAt: '2026-10-15T09:00:00.000Z',
      updatedAt: '2026-10-16T14:30:00.000Z',
      quotes: [
        {
          id: 'quote-seed-001',
          eventId: 'evt-seed-001',
          revisionNumber: 1,
          foodSubtotalKobo: 125000000n, // ₦1,250,000.00
          logisticsFeeKobo: 5000000n,    // ₦50,000.00
          serviceFeeKobo: 10000000n,     // ₦100,000.00 (Live chef & serving team)
          totalKobo: 140000000n,         // ₦1,400,000.00
          depositPercentage: 70,
          depositKobo: 98000000n,        // ₦980,000.00 (70% commitment deposit)
          balanceKobo: 42000000n,        // ₦420,000.00 (30% balance due 48h prior)
          depositStatus: 'paid',
          balanceStatus: 'unpaid',
          depositPaidAt: '2026-10-16T14:30:00.000Z',
          depositVerifiedBy: 'usr-owner-01',
          status: 'active',
          notes: 'Revision 1: Includes live cooking crew, bespoke chaffing equipment, and setup.',
          createdAt: '2026-10-15T11:00:00.000Z',
          updatedAt: '2026-10-16T14:30:00.000Z',
          items: [
            {
              id: 'qitem-01',
              quoteId: 'quote-seed-001',
              name: 'Signature Smoky Party Jollof & Fried Rice (Twin Buffet)',
              portionLabel: '150 Buffet Servings',
              unitPriceKobo: 500000n,
              quantity: 150,
              totalKobo: 75000000n, // ₦750,000.00
            },
            {
              id: 'qitem-02',
              quoteId: 'quote-seed-001',
              name: 'Slow-Braised Peppered Beef & Asun Live Grill',
              portionLabel: '150 Gourmet Portions',
              unitPriceKobo: 300000n,
              quantity: 150,
              totalKobo: 45000000n, // ₦450,000.00
            },
            {
              id: 'qitem-03',
              quoteId: 'quote-seed-001',
              name: 'Crispy Sweet Plantain Dodo Bites & Coleslaw Salad',
              portionLabel: '150 Sides',
              unitPriceKobo: 33333n + 1n,
              quantity: 150,
              totalKobo: 5000000n, // ₦50,000.00
            },
          ],
        },
      ],
    };

    this.events.set(seedEvent.id, seedEvent);
  }

  private persist(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const serialized = Array.from(this.events.values()).map((ev) => ({
          ...ev,
          quotes: ev.quotes.map((q) => ({
            ...q,
            foodSubtotalKobo: q.foodSubtotalKobo.toString(),
            logisticsFeeKobo: q.logisticsFeeKobo.toString(),
            serviceFeeKobo: q.serviceFeeKobo.toString(),
            totalKobo: q.totalKobo.toString(),
            depositKobo: q.depositKobo.toString(),
            balanceKobo: q.balanceKobo.toString(),
            items: q.items.map((i) => ({
              ...i,
              unitPriceKobo: i.unitPriceKobo.toString(),
              totalKobo: i.totalKobo.toString(),
            })),
          })),
        }));
        window.localStorage.setItem(CATERING_STORAGE_KEY, JSON.stringify(serialized));
      } catch {
        // ignore
      }
    }
  }

  public save(event: CateringEvent): CateringEvent {
    this.events.set(event.id, event);
    this.persist();
    return event;
  }

  public getById(id: string): CateringEvent | undefined {
    return this.events.get(id);
  }

  public getByCode(code: string): CateringEvent | undefined {
    const trimmed = code.trim().toUpperCase();
    for (const ev of this.events.values()) {
      if (ev.eventCode === trimmed || ev.id === trimmed) {
        return ev;
      }
    }
    return undefined;
  }

  public getAll(): CateringEvent[] {
    return Array.from(this.events.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public updateStatus(eventId: string, status: EventStatus): CateringEvent {
    const ev = this.events.get(eventId);
    if (!ev) {
      throw new Error(`Event with ID '${eventId}' not found.`);
    }
    ev.status = status;
    ev.updatedAt = new Date().toISOString();
    this.persist();
    return ev;
  }

  public clear(): void {
    this.events.clear();
    this.persist();
  }
}

export const cateringRepository = new CateringRepository();
