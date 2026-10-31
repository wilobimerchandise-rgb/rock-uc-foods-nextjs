/**
 * ROCK UC FOODS - Phase 4: KDS & Dispatch Integration Tests
 * Playbook v2 Section 13 / Phase 4 Real-time KDS & Dispatch
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  kitchenTicketRepository,
  dispatchRepository,
  resetKdsSequence,
  createKitchenTicketForOrder,
  startCooking,
  markPlated,
  markHandedOff,
  assignRiderToOrder,
  confirmDelivery,
  determineStationForOrder,
} from '../src/dispatch/dispatchEngine';
import { orderRepository } from '../src/order/orderRepository';
import { notificationRepository } from '../src/notifications/notificationEngine';
import { Order, OrderItemSnapshot } from '../src/types/order';

function createMockOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-kds-test-01',
    orderCode: 'ROC-261029-KDS1',
    customerName: 'Adewale Adeleke',
    customerPhone: '+2348033729125',
    deliveryType: 'delivery',
    deliveryAddress: 'Lekki Phase 1, Lagos',
    status: 'payment_confirmed',
    subtotalKobo: 500000n,
    deliveryFeeKobo: 150000n,
    totalKobo: 650000n,
    policyVersion: 'v4.0',
    policyAcceptedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    ...overrides,
  };
}

function createMockItem(name: string): OrderItemSnapshot {
  return {
    id: `item-${Math.random().toString(36).substring(2, 6)}`,
    orderId: 'ord-kds-test-01',
    menuItemId: 'dish-01',
    nameSnapshot: name,
    unitPriceKoboSnapshot: 500000n,
    quantity: 1,
    totalKoboSnapshot: 500000n,
  };
}

describe('Phase 4: Real-time Kitchen Display System (KDS) & Dispatch', () => {
  beforeEach(() => {
    kitchenTicketRepository.clear();
    dispatchRepository.clear();
    orderRepository.clear();
    notificationRepository.clear();
    resetKdsSequence(1);
  });

  describe('1. Kitchen Station Assignment & Routing', () => {
    it('routes grilled items and suya to grill station', () => {
      const order = createMockOrder({ items: [createMockItem('Grilled Jumbo Tilapia')] });
      expect(determineStationForOrder(order)).toBe('grill');
    });

    it('routes soups, stews, and egusi to stew_pot station', () => {
      const order = createMockOrder({ items: [createMockItem('Seafood Okro Soup with Pounded Yam')] });
      expect(determineStationForOrder(order)).toBe('stew_pot');
    });

    it('routes fried dodo and chips to fryer station', () => {
      const order = createMockOrder({ items: [createMockItem('Crispy Fried Plantain')] });
      expect(determineStationForOrder(order)).toBe('fryer');
    });

    it('routes coleslaw and salad to salad_prep station', () => {
      const order = createMockOrder({ items: [createMockItem('Chef Esther Luxury Salad')] });
      expect(determineStationForOrder(order)).toBe('salad_prep');
    });
  });

  describe('2. Chronological State Progression & Monotonicity', () => {
    it('creates ticket with valid KDS-YYYYMMDD-XXXX format and advances order to in_kitchen', () => {
      const order = createMockOrder({ items: [createMockItem('Grilled Fish')] });
      orderRepository.save(order);

      const ticket = createKitchenTicketForOrder(order.id, 'urgent');
      expect(ticket.ticketNumber).toMatch(/^KDS-[0-9]{8}-[0-9]{4}$/);
      expect(ticket.status).toBe('queued');
      expect(ticket.priority).toBe('urgent');

      const updated = orderRepository.getById(order.id);
      expect(updated?.status).toBe('in_kitchen');
    });

    it('enforces queued -> cooking -> plated -> handed_off lifecycle', () => {
      const order = createMockOrder({ items: [createMockItem('Grilled Fish')] });
      orderRepository.save(order);

      const ticket = createKitchenTicketForOrder(order.id);

      // Cannot jump from queued straight to plated
      expect(() => markPlated(ticket.id)).toThrow(/Must be cooking/);

      // Start cooking
      const cooking = startCooking(ticket.id);
      expect(cooking.status).toBe('cooking');
      expect(cooking.cookStartedAt).toBeDefined();

      // Cannot jump from cooking straight to handed_off
      expect(() => markHandedOff(ticket.id)).toThrow(/Must be plated/);

      // Mark plated
      const plated = markPlated(ticket.id);
      expect(plated.status).toBe('plated');
      expect(plated.platedAt).toBeDefined();

      // Hand off to packaging
      const handedOff = markHandedOff(ticket.id);
      expect(handedOff.status).toBe('handed_off');
      expect(handedOff.handedOffAt).toBeDefined();

      // Order advances to ready_for_dispatch
      const finalOrder = orderRepository.getById(order.id);
      expect(finalOrder?.status).toBe('ready_for_dispatch');
    });
  });

  describe('3. Rider Dispatch & Delivery Handover', () => {
    it('assigns rider with strict Nigerian phone regex (+234...) and advances order to out_for_delivery', () => {
      const order = createMockOrder({
        status: 'ready_for_dispatch',
        items: [createMockItem('Grilled Fish')],
      });
      orderRepository.save(order);

      // Invalid phone format throws
      expect(() =>
        assignRiderToOrder({
          orderId: order.id,
          riderName: 'Babatunde Lawal',
          riderPhone: '08033729125', // Not E.164
        })
      ).toThrow(/Must follow Nigerian international format/);

      // Valid E.164 phone succeeds
      const assignment = assignRiderToOrder({
        orderId: order.id,
        riderName: 'Babatunde Lawal',
        riderPhone: '+2348033729125',
        riderVehiclePlate: 'KJA-482-XA',
      });

      expect(assignment.dispatchStatus).toBe('assigned');
      expect(assignment.riderName).toBe('Babatunde Lawal');

      const dispatchedOrder = orderRepository.getById(order.id);
      expect(dispatchedOrder?.status).toBe('out_for_delivery');
    });

    it('confirms delivery and prevents double-delivery', () => {
      const order = createMockOrder({
        status: 'ready_for_dispatch',
        items: [createMockItem('Grilled Fish')],
      });
      orderRepository.save(order);

      assignRiderToOrder({
        orderId: order.id,
        riderName: 'Babatunde Lawal',
        riderPhone: '+2348033729125',
      });

      // Confirm delivery
      const delivered = confirmDelivery({
        orderId: order.id,
        customerSignatureConfirmed: true,
      });

      expect(delivered.dispatchStatus).toBe('delivered');
      expect(delivered.customerSignatureConfirmed).toBe(true);

      const updatedOrder = orderRepository.getById(order.id);
      expect(updatedOrder?.status).toBe('delivered');

      // Re-confirming delivery throws
      expect(() =>
        confirmDelivery({
          orderId: order.id,
          customerSignatureConfirmed: true,
        })
      ).toThrow(/already been marked as delivered/);
    });
  });
});
