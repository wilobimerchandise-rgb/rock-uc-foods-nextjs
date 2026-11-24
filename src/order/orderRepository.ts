/**
 * ROCK UC FOODS - Order Repository
 * (Playbook v2 Section 8, Section 17 v3 Addendum & Manual GTBank Flow)
 * Authoritative store with BigInt kobo preservation, expiry checks, and audit support.
 */

import { Order, OrderStatus, OrderProofSummary, OrderReopenLog } from '../types/order';

const STORAGE_KEY = 'rock_uc_orders_data_v1';

class OrderRepository {
  private orders: Map<string, Order> = new Map();

  constructor() {
    this.loadInitialOrders();
  }

  private reviveOrder(item: any): Order {
    return {
      ...item,
      deliveryFeeKobo: BigInt(item.deliveryFeeKobo),
      subtotalKobo: BigInt(item.subtotalKobo),
      totalKobo: BigInt(item.totalKobo),
      paidAmountKobo: item.paidAmountKobo !== undefined ? BigInt(item.paidAmountKobo) : undefined,
      discountKobo: item.discountKobo !== undefined ? BigInt(item.discountKobo) : undefined,
      items: (item.items || []).map((i: any) => ({
        ...i,
        unitPriceKoboSnapshot: BigInt(i.unitPriceKoboSnapshot),
        totalKoboSnapshot: BigInt(i.totalKoboSnapshot),
        selectedOptionsSnapshot: (i.selectedOptionsSnapshot || []).map((o: any) => ({
          ...o,
          priceDeltaKobo: o.priceDeltaKobo !== undefined ? BigInt(o.priceDeltaKobo) : 0n,
        })),
      })),
    };
  }

  private loadInitialOrders(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const revived = this.reviveOrder(item);
              this.orders.set(revived.id, revived);
            }
            return;
          }
        }
      } catch {
        // storage unreadable, fallback to default seed
      }
    }

    // Default Seed Order for demonstration (paid & confirmed via GTBank)
    const seedOrder: Order = {
      id: 'ord-seed-001',
      orderCode: 'RUC-20261019-7F4A',
      customerName: 'Adewale Johnson',
      customerPhone: '+2348033729125',
      customerEmail: 'adewale@example.com',
      deliveryType: 'delivery',
      deliveryZoneId: 'zone-1-ikeja',
      deliveryAddress: '14 Isaac John Street, GRA, Ikeja, Lagos',
      deliveryFeeKobo: 250000n, // ₦2,500.00
      subtotalKobo: 950000n, // ₦9,500.00
      totalKobo: 1200000n, // ₦12,000.00
      paidAmountKobo: 1200000n,
      status: 'paid',
      specialInstructions: 'Extra spicy pepper sauce, please deliver by 1:30 PM.',
      policyVersion: '2026-10-15-v3',
      policyAcceptedAt: new Date(Date.now() - 3600000).toISOString(),
      paymentVerifiedAt: new Date(Date.now() - 1800000).toISOString(),
      paymentVerifiedBy: 'usr-owner-01',
      paymentVerifiedByName: 'Chef Esther Kwentua',
      paymentReference: 'RUC-9K4M2P',
      expiresAt: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 1800000).toISOString(),
      items: [
        {
          id: 'item-snap-01',
          orderId: 'ord-seed-001',
          menuItemId: 'item-01-jollof-smoked',
          nameSnapshot: 'Signature Smoky Party Jollof Rice (Standard Pack)',
          portionSnapshot: 'Serves 1-2',
          unitPriceKoboSnapshot: 650000n,
          quantity: 1,
          totalKoboSnapshot: 650000n,
        },
        {
          id: 'item-snap-02',
          orderId: 'ord-seed-001',
          menuItemId: 'item-03-peppered-beef',
          nameSnapshot: 'Slow-Braised Peppered Beef Bites',
          portionSnapshot: 'Serves 1',
          unitPriceKoboSnapshot: 300000n,
          quantity: 1,
          totalKoboSnapshot: 300000n,
        },
      ],
    };

    this.orders.set(seedOrder.id, seedOrder);
  }

  private persist(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const serialized = Array.from(this.orders.values()).map((o) => ({
          ...o,
          deliveryFeeKobo: o.deliveryFeeKobo.toString(),
          subtotalKobo: o.subtotalKobo.toString(),
          totalKobo: o.totalKobo.toString(),
          paidAmountKobo: o.paidAmountKobo !== undefined ? o.paidAmountKobo.toString() : undefined,
          discountKobo: o.discountKobo !== undefined ? o.discountKobo.toString() : undefined,
          items: o.items.map((i) => ({
            ...i,
            unitPriceKoboSnapshot: i.unitPriceKoboSnapshot.toString(),
            totalKoboSnapshot: i.totalKoboSnapshot.toString(),
            selectedOptionsSnapshot: (i.selectedOptionsSnapshot || []).map((opt) => ({
              ...opt,
              priceDeltaKobo: opt.priceDeltaKobo ? opt.priceDeltaKobo.toString() : '0',
            })),
          })),
        }));
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      } catch {
        // ignore storage quota errors
      }
    }
  }

  public save(order: Order): Order {
    this.orders.set(order.id, order);
    this.persist();
    return order;
  }

  public getById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  public getByCode(code: string): Order | undefined {
    const trimmed = code.trim().toUpperCase();
    for (const order of this.orders.values()) {
      if (order.orderCode.toUpperCase() === trimmed || order.id.toUpperCase() === trimmed) {
        return order;
      }
    }
    return undefined;
  }

  public getByPaymentReference(paymentRef: string): Order | undefined {
    const trimmed = paymentRef.trim().toUpperCase();
    for (const order of this.orders.values()) {
      if (order.paymentReference && order.paymentReference.toUpperCase() === trimmed) {
        return order;
      }
    }
    return undefined;
  }

  public hasPaymentReference(paymentRef: string): boolean {
    return Boolean(this.getByPaymentReference(paymentRef));
  }

  public getAll(options?: { expireStale?: boolean; nowMs?: number }): Order[] {
    const nowMs = options?.nowMs ?? Date.now();
    if (options?.expireStale) {
      for (const order of this.orders.values()) {
        this.syncExpiry(order.id, nowMs);
      }
    }
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Transitions unpaid orders past their 7-hour window to 'expired' cleanly.
   */
  public syncExpiry(orderId: string, nowMs: number = Date.now()): Order | undefined {
    const order = this.orders.get(orderId);
    if (!order) return undefined;

    const expirableStatuses: OrderStatus[] = ['pending_payment', 'proof_submitted', 'rejected'];
    if (expirableStatuses.includes(order.status)) {
      const expMs = new Date(order.expiresAt).getTime();
      if (Number.isFinite(expMs) && nowMs > expMs) {
        const updated: Order = {
          ...order,
          status: 'expired',
          updatedAt: new Date(nowMs).toISOString(),
        };
        this.orders.set(orderId, updated);
        this.persist();
        return updated;
      }
    }
    return order;
  }

  public updateStatus(
    orderId: string,
    status: OrderStatus,
    options?: {
      actorUserId?: string;
      actorName?: string;
      paymentReference?: string;
      paidAmountKobo?: bigint;
      proofSummary?: OrderProofSummary;
      rejectionReason?: string;
      reopenedAt?: string;
      reopenedBy?: string;
      reopenReason?: string;
      reopenLog?: OrderReopenLog;
      expiresAt?: string;
    }
  ): Order {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order with ID '${orderId}' not found.`);
    }

    const nowIso = new Date().toISOString();
    const isPaidTransition = status === 'paid' || status === 'payment_confirmed';

    const updated: Order = {
      ...order,
      status,
      updatedAt: nowIso,
      ...(options?.paymentReference ? { paymentReference: options.paymentReference } : {}),
      ...(options?.paidAmountKobo !== undefined ? { paidAmountKobo: options.paidAmountKobo } : {}),
      ...(options?.proofSummary ? { proofSummary: options.proofSummary } : {}),
      ...(options?.rejectionReason !== undefined ? { rejectionReason: options.rejectionReason } : {}),
      ...(options?.expiresAt ? { expiresAt: options.expiresAt } : {}),
      ...(options?.reopenedAt ? { reopenedAt: options.reopenedAt } : {}),
      ...(options?.reopenedBy ? { reopenedBy: options.reopenedBy } : {}),
      ...(options?.reopenReason ? { reopenReason: options.reopenReason } : {}),
      ...(options?.reopenLog
        ? { reopenLogs: [...(order.reopenLogs || []), options.reopenLog] }
        : {}),
      ...(isPaidTransition && !order.paymentVerifiedAt
        ? {
            paymentVerifiedAt: nowIso,
            paymentVerifiedBy: options?.actorUserId || 'usr-owner-01',
            ...(options?.actorName ? { paymentVerifiedByName: options.actorName } : {}),
          }
        : {}),
    };

    this.orders.set(orderId, updated);
    this.persist();
    return updated;
  }

  public clear(): void {
    this.orders.clear();
    this.persist();
  }
}

const globalRepo = ((globalThis as any).__rockUcOrderRepo as OrderRepository) || new OrderRepository();
(globalThis as any).__rockUcOrderRepo = globalRepo;

export const orderRepository: OrderRepository = globalRepo;
