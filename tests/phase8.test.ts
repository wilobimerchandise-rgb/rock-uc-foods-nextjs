/**
 * ROCK UC FOODS - Phase 8 Verification Test Suite
 * Playbook v2 Section 13: KDS, Dispatch, Real-Time Delivery Tracking & Customer Notifications
 * 
 * Validates:
 * 1. Real PostgreSQL PGlite migration (0008_kds_and_dispatch.sql) & schema check constraints
 * 2. KDS ticket generation on paid order with KDS-YYYYMMDD-XXXX formatting & station assignment
 * 3. Chronological sequence enforcement (queued -> cooking -> plated -> handed_off)
 * 4. Automatic advancement to ready_for_dispatch upon kitchen hand-off
 * 5. Rider dispatch assignment with strict Nigerian phone regex (+234...)
 * 6. Delivery completion & double-delivery protection
 * 7. IDOR protection on public order tracking token (zero sequential ID crawling)
 * 8. Status step & progress percentage synchronization
 * 9. Multi-channel customer notification message formatting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

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
  ensureOrderTrackingToken,
  getTrackingViewByToken,
  formatCustomerNotification,
} from '../src/dispatch/dispatchEngine';
import { orderRepository } from '../src/order/orderRepository';
import { Order, OrderItemSnapshot } from '../src/types/order';

function createTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-test-p8-01',
    orderCode: 'ROC-261021-8001',
    customerName: 'Chinedu Eze',
    customerPhone: '+2348033729125',
    deliveryType: 'delivery',
    deliveryZoneId: 'ZONE-A',
    deliveryFeeKobo: 150000n,
    deliveryAddress: 'Ikoyi, Lagos',
    status: 'payment_confirmed',
    subtotalKobo: 550000n,
    totalKobo: 700000n,
    policyVersion: 'v2',
    policyAcceptedAt: new Date().toISOString(),
    createdAt: '2026-10-21T12:00:00.000Z',
    updatedAt: '2026-10-21T12:00:00.000Z',
    items: [],
    ...overrides,
  };
}

function createTestItem(overrides: Partial<OrderItemSnapshot> = {}): OrderItemSnapshot {
  return {
    id: 'itm-p8-01',
    orderId: 'ord-test-p8-01',
    menuItemId: 'T-001',
    nameSnapshot: 'Grilled Jumbo Tilapia with Fried Plantain',
    unitPriceKoboSnapshot: 550000n,
    quantity: 1,
    totalKoboSnapshot: 550000n,
    ...overrides,
  };
}

describe('Phase 8: KDS, Dispatch, Real-Time Delivery Tracking & Customer Notifications', () => {
  beforeEach(() => {
    kitchenTicketRepository.clear();
    dispatchRepository.clear();
    orderRepository.clear();
    resetKdsSequence(1);
  });

  // TEST 1: Database Migration & Schema Constraints
  it('1. Applies 0008_kds_and_dispatch.sql and enforces ticket regex, cooking chronology, and rider phone format', async () => {
    const db = new PGlite();
    const sql1 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'), 'utf-8');
    const sql2 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0002_menu_core.sql'), 'utf-8');
    const sql3 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0003_orders_core.sql'), 'utf-8');
    const sql4 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0004_events_and_invoices.sql'), 'utf-8');
    const sql5 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0005_invoices_and_receipts.sql'), 'utf-8');
    const sql6 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0006_payments_and_reconciliation.sql'), 'utf-8');
    const sql7 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0007_promotions_and_reports.sql'), 'utf-8');
    const sql8 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0008_kds_and_dispatch.sql'), 'utf-8');

    await db.exec(sql1);
    await db.exec(sql2);
    await db.exec(sql3);
    await db.exec(sql4);
    await db.exec(sql5);
    await db.exec(sql6);
    await db.exec(sql7);
    await db.exec(sql8);

    // 1. Insert seed order
    await db.exec(`
      INSERT INTO orders (
        id, order_code, customer_name, customer_phone, delivery_type, delivery_fee_kobo,
        delivery_address, subtotal_kobo, total_kobo, policy_version, tracking_token
      ) VALUES (
        'd0000000-0000-0000-0000-000000000001', 'RUC-20261021-A1B2', 'Amina Yusuf', '+2348033729125',
        'delivery', 150000, 'Victoria Island', 350000, 500000, 'v2', '0123456789abcdef0123456789abcdef'
      );
    `);

    // 2. Reject invalid KDS ticket format
    await expect(
      db.query(`
        INSERT INTO kitchen_tickets (
          id, order_id, ticket_number, priority, status
        ) VALUES (
          'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001',
          'INVALID-TICKET-01', 'normal', 'queued'
        );
      `)
    ).rejects.toThrow();

    // 3. Reject cooking time violation (plated_at earlier than cook_started_at)
    await expect(
      db.query(`
        INSERT INTO kitchen_tickets (
          id, order_id, ticket_number, priority, status, cook_started_at, plated_at
        ) VALUES (
          'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001',
          'KDS-20261021-0001', 'normal', 'plated',
          '2026-10-21 14:00:00+00', '2026-10-21 13:30:00+00'
        );
      `)
    ).rejects.toThrow(/cooking_time_chk/);

    // 4. Reject invalid rider phone format
    await expect(
      db.query(`
        INSERT INTO dispatch_assignments (
          id, order_id, rider_name, rider_phone, dispatch_status
        ) VALUES (
          'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001',
          'Musa', '08012345678', 'assigned'
        );
      `)
    ).rejects.toThrow();
  }, 25000);

  // TEST 2: KDS Ticket Generation
  it('2. Generates KDS ticket with KDS-YYYYMMDD-XXXX numbering and station assignment for paid orders', () => {
    const unpaidOrder = createTestOrder({ id: 'ord-unpaid-01', status: 'pending_payment' });
    orderRepository.save(unpaidOrder);

    // Unpaid order cannot enter kitchen
    expect(() => createKitchenTicketForOrder(unpaidOrder.id)).toThrow(/must be payment_confirmed/);

    // Paid order generates ticket
    const paidOrder = createTestOrder({
      id: 'ord-paid-01',
      status: 'payment_confirmed',
      items: [createTestItem({ nameSnapshot: 'Charcoal Grilled Suya Platter' })],
    });
    orderRepository.save(paidOrder);

    const ticket = createKitchenTicketForOrder(paidOrder.id);
    expect(ticket.ticketNumber).toBe('KDS-20261021-0001');
    expect(ticket.status).toBe('queued');
    expect(ticket.assignedStation).toBe('grill');

    // Order status advanced to in_kitchen
    const updated = orderRepository.getById(paidOrder.id);
    expect(updated?.status).toBe('in_kitchen');
  });

  // TEST 3: Chronological Kitchen Sequence
  it('3. Enforces chronological sequence from cooking to plating and rejects negative time diffs', () => {
    const order = createTestOrder({ id: 'ord-seq-01', status: 'payment_confirmed' });
    orderRepository.save(order);
    const ticket = createKitchenTicketForOrder(order.id);

    // 1. Cannot plate while queued
    expect(() => markPlated(ticket.id)).toThrow(/Must be cooking/);

    // 2. Start cooking
    startCooking(ticket.id, '2026-10-21T12:05:00.000Z');
    const inCooking = kitchenTicketRepository.getById(ticket.id);
    expect(inCooking?.status).toBe('cooking');

    // 3. Reject plated time before cook started
    expect(() => markPlated(ticket.id, '2026-10-21T12:00:00.000Z')).toThrow(/cannot be earlier/);

    // 4. Mark plated with valid time
    markPlated(ticket.id, '2026-10-21T12:20:00.000Z');
    const plated = kitchenTicketRepository.getById(ticket.id);
    expect(plated?.status).toBe('plated');
  });

  // TEST 4: Kitchen Hand-off to Dispatch
  it('4. Advances order status to ready_for_dispatch once all items are handed off', () => {
    const order = createTestOrder({ id: 'ord-handoff-01', status: 'payment_confirmed' });
    orderRepository.save(order);
    const ticket = createKitchenTicketForOrder(order.id);

    startCooking(ticket.id, '2026-10-21T12:05:00.000Z');
    markPlated(ticket.id, '2026-10-21T12:20:00.000Z');
    markHandedOff(ticket.id, '2026-10-21T12:22:00.000Z');

    const updatedOrder = orderRepository.getById(order.id);
    expect(updatedOrder?.status).toBe('ready_for_dispatch');
  });

  // TEST 5: Rider Dispatch Assignment
  it('5. Assigns delivery rider with Nigerian phone validation and marks order out_for_delivery', () => {
    const order = createTestOrder({ id: 'ord-dispatch-01', status: 'ready_for_dispatch' });
    orderRepository.save(order);

    // Invalid phone number format rejected
    expect(() =>
      assignRiderToOrder({
        orderId: order.id,
        riderName: 'Babajide Adeleke',
        riderPhone: '08033729125', // missing +234
      })
    ).toThrow(/Must follow Nigerian international format/);

    // Valid assignment succeeds
    const assignment = assignRiderToOrder({
      orderId: order.id,
      riderName: 'Babajide Adeleke',
      riderPhone: '+2348033729125',
      riderVehiclePlate: 'LAG-419-XY',
    });

    expect(assignment.riderName).toBe('Babajide Adeleke');
    expect(assignment.dispatchStatus).toBe('assigned');

    const updatedOrder = orderRepository.getById(order.id);
    expect(updatedOrder?.status).toBe('out_for_delivery');
  });

  // TEST 6: Delivery Completion
  it('6. Confirms delivery and marks order delivered with protection against duplicate confirmation', () => {
    const order = createTestOrder({ id: 'ord-del-01', status: 'ready_for_dispatch' });
    orderRepository.save(order);

    const assignment = assignRiderToOrder({
      orderId: order.id,
      riderName: 'Emeka Driver',
      riderPhone: '+2348033729125',
    });

    confirmDelivery({ dispatchId: assignment.id });

    const deliveredOrder = orderRepository.getById(order.id);
    expect(deliveredOrder?.status).toBe('delivered');

    // Duplicate delivery attempt rejected
    expect(() => confirmDelivery({ dispatchId: assignment.id })).toThrow(/already been marked as delivered/);
  });

  // TEST 7: IDOR Protection on Order Tracking
  it('7. Rejects sequential order IDs and only exposes tracking view via cryptographically secure token', () => {
    const order = createTestOrder({ id: 'ord-idor-01' });
    orderRepository.save(order);

    const secureToken = ensureOrderTrackingToken(order);
    expect(secureToken.length).toBeGreaterThanOrEqual(32);

    // 1. Attempting sequential ID crawling returns null
    expect(getTrackingViewByToken('1')).toBeNull();
    expect(getTrackingViewByToken('ord-idor-01')).toBeNull();
    expect(getTrackingViewByToken('')).toBeNull();
    expect(getTrackingViewByToken('short-token')).toBeNull();

    // 2. Valid token retrieves clean customer view without internal UUIDs or secrets
    const view = getTrackingViewByToken(secureToken);
    expect(view).not.toBeNull();
    expect(view?.orderCode).toBe(order.orderCode);
    expect(view?.customerName).toBe(order.customerName);
    // Does not leak order.id or payment tokens
    expect((view as unknown as Record<string, unknown>).id).toBeUndefined();
  });

  // TEST 8: Status Step & Progress Synchronization
  it('8. Synchronizes statusStep and progressPercent across the fulfillment lifecycle', () => {
    const order = createTestOrder({ id: 'ord-steps-01', status: 'payment_confirmed' });
    orderRepository.save(order);
    const token = ensureOrderTrackingToken(order);

    expect(getTrackingViewByToken(token)?.progressPercent).toBe(25);

    order.status = 'in_kitchen';
    orderRepository.save(order);
    expect(getTrackingViewByToken(token)?.progressPercent).toBe(50);

    order.status = 'ready_for_dispatch';
    orderRepository.save(order);
    expect(getTrackingViewByToken(token)?.progressPercent).toBe(65);

    order.status = 'out_for_delivery';
    orderRepository.save(order);
    expect(getTrackingViewByToken(token)?.progressPercent).toBe(85);

    order.status = 'delivered';
    orderRepository.save(order);
    expect(getTrackingViewByToken(token)?.progressPercent).toBe(100);
  });

  // TEST 9: Notification Formatting
  it('9. Formats customer notifications with real tracking links and rider credentials', () => {
    const order = createTestOrder({ id: 'ord-notif-01', status: 'ready_for_dispatch' });
    orderRepository.save(order);

    assignRiderToOrder({
      orderId: order.id,
      riderName: 'Sunday James',
      riderPhone: '+2348021112233',
    });

    const notif = formatCustomerNotification(order, 'dispatched', 'https://rockucfoods.ng');
    expect(notif.recipientPhone).toBe(order.customerPhone);
    expect(notif.messageText).toContain('Sunday James');
    expect(notif.messageText).toContain('+2348021112233');
    expect(notif.messageText).toContain('https://rockucfoods.ng/track/');
  });
});
