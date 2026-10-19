/**
 * ROCK UC FOODS - Order Repository
 * (Playbook v2 Section 8 & Section 17 v3 Addendum)
 * Authoritative in-memory data store with browser persistence and audit logging.
 */

import { Order, OrderStatus } from '../types/order';

const STORAGE_KEY = 'rock_uc_orders_data_v1';

class OrderRepository {
  private orders: Map<string, Order> = new Map();

  constructor() {
    this.loadInitialOrders();
  }

  private loadInitialOrders(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const revived: Order = {
                ...item,
                deliveryFeeKobo: BigInt(item.deliveryFeeKobo),
                subtotalKobo: BigInt(item.subtotalKobo),
                totalKobo: BigInt(item.totalKobo),
                items: (item.items || []).map((i: any) => ({
                  ...i,
                  unitPriceKoboSnapshot: BigInt(i.unitPriceKoboSnapshot),
                  totalKoboSnapshot: BigInt(i.totalKoboSnapshot),
                })),
              };
              this.orders.set(revived.id, revived);
            }
            return;
          }
        }
      } catch {
        // storage unreadable, fallback to default seed
      }
    }

    // Default Seed Order for demonstration
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
      status: 'payment_confirmed',
      specialInstructions: 'Extra spicy pepper sauce, please deliver by 1:30 PM.',
      policyVersion: '2026-10-15-v3',
      policyAcceptedAt: new Date(Date.now() - 3600000).toISOString(),
      paymentVerifiedAt: new Date(Date.now() - 1800000).toISOString(),
      paymentVerifiedBy: 'usr-owner-01',
      paymentReference: 'WEMA-TRF-982341829',
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
          items: o.items.map((i) => ({
            ...i,
            unitPriceKoboSnapshot: i.unitPriceKoboSnapshot.toString(),
            totalKoboSnapshot: i.totalKoboSnapshot.toString(),
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
      if (order.orderCode === trimmed || order.id === trimmed) {
        return order;
      }
    }
    return undefined;
  }

  public getAll(): Order[] {
    return Array.from(this.orders.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public updateStatus(
    orderId: string,
    status: OrderStatus,
    options?: { actorUserId?: string; paymentReference?: string }
  ): Order {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order with ID '${orderId}' not found.`);
    }

    const updated: Order = {
      ...order,
      status,
      updatedAt: new Date().toISOString(),
      ...(options?.paymentReference ? { paymentReference: options.paymentReference } : {}),
      ...(status === 'payment_confirmed' && !order.paymentVerifiedAt
        ? {
            paymentVerifiedAt: new Date().toISOString(),
            paymentVerifiedBy: options?.actorUserId || 'usr-owner-01',
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

export const orderRepository = new OrderRepository();
