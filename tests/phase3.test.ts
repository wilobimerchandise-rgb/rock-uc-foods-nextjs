/**
 * ROCK UC FOODS - Phase 3 Verification Test Suite
 * Validates Individual Ordering Engine:
 * - Real PostgreSQL PGlite migration (0003_orders_core.sql)
 * - Server-authoritative snapshot pricing (Zero client price trust)
 * - Delivery zones & fee calculations in BigInt kobo
 * - Mandatory refund policy consent gate
 * - Nigerian E.164 phone normalization
 * - Non-sequential collision-resistant order codes
 * - Order repository status lifecycle and audit records
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import { validateAndCalculateOrder, createOrder, generateOrderCode } from '../src/order/orderEngine';
import { calculateDeliveryFeeKobo, LAGOS_DELIVERY_ZONES } from '../src/order/deliveryZones';
import { orderRepository } from '../src/order/orderRepository';
import { POLICY_VERSION } from '../src/policy/content';
import { menuRepository } from '../src/menu/data';

describe('Phase 3: Real PostgreSQL PGlite Database Migration (0003_orders_core.sql)', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();
    const foundationSql = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'),
      'utf-8'
    );
    const menuSql = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/0002_menu_core.sql'),
      'utf-8'
    );
    const ordersSql = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/0003_orders_core.sql'),
      'utf-8'
    );

    await db.exec(foundationSql);
    await db.exec(menuSql);
    await db.exec(ordersSql);
  });

  it('Seeds 5 standard Lagos delivery zones with BigInt kobo fees', async () => {
    const res = await db.query('SELECT code, name, fee_kobo FROM delivery_zones ORDER BY sort_order ASC');
    expect(res.rows.length).toBe(5);

    const zones = res.rows as any[];
    expect(zones[0].code).toBe('ZONE_1');
    expect(BigInt(zones[0].fee_kobo)).toBe(250000n); // ₦2,500.00
    expect(zones[1].code).toBe('ZONE_2');
    expect(BigInt(zones[1].fee_kobo)).toBe(350000n); // ₦3,500.00
    expect(zones[4].code).toBe('ZONE_5');
    expect(BigInt(zones[4].fee_kobo)).toBe(500000n); // ₦5,000.00
  });

  it('Rejects order insertion if total_kobo does not equal subtotal + delivery_fee', async () => {
    // Insert dummy category and item with valid hex UUIDs
    await db.exec(`
      INSERT INTO menu_categories (id, name) VALUES ('c0000000-0000-0000-0000-000000000001', 'Rice');
      INSERT INTO menu_items (id, category_id, name, price_kobo, status)
      VALUES ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Jollof', 650000, 'published');
    `);

    // Tampered total: subtotal 650000 + delivery 250000 should be 900000, but client tries 500000
    await expect(
      db.query(`
        INSERT INTO orders (
          order_code, customer_name, customer_phone, delivery_type,
          delivery_fee_kobo, subtotal_kobo, total_kobo, policy_version
        ) VALUES (
          'RUC-20261019-A1B2', 'Chioma Okafor', '+2348033729125', 'collection',
          0, 650000, 500000, '2026-10-15-v3'
        );
      `)
    ).rejects.toThrow(/orders_total_reconciliation_chk/);
  });

  it('Rejects order_items snapshot if total does not equal unit_price * quantity', async () => {
    await db.exec(`
      INSERT INTO menu_categories (id, name) VALUES ('c0000000-0000-0000-0000-000000000002', 'Proteins');
      INSERT INTO menu_items (id, category_id, name, price_kobo, status)
      VALUES ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'Beef', 300000, 'published');
      INSERT INTO orders (
        id, order_code, customer_name, customer_phone, delivery_type,
        delivery_fee_kobo, subtotal_kobo, total_kobo, policy_version
      ) VALUES (
        'b0000000-0000-0000-0000-000000000001', 'RUC-20261019-B2C3', 'Emeka Obi', '+2348033729125', 'collection',
        0, 600000, 600000, '2026-10-15-v3'
      );
    `);

    // Tampered item total: 2 * 300000 should be 600000, but client sends 100000
    await expect(
      db.query(`
        INSERT INTO order_items (
          order_id, menu_item_id, name_snapshot, unit_price_kobo_snapshot, quantity, total_kobo_snapshot
        ) VALUES (
          'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Beef', 300000, 2, 100000
        );
      `)
    ).rejects.toThrow(/order_items_total_snapshot_chk/);
  });
});

describe('Phase 3: Server-Authoritative Price Calculation & Anti-Tampering Engine', () => {
  it('Calculates subtotal and total strictly from repository prices (ignores client tampering)', () => {
    const publishedItems = menuRepository.getItems(false);
    expect(publishedItems.length).toBeGreaterThanOrEqual(2);

    const item1 = publishedItems[0];
    const item2 = publishedItems[1];

    const order = validateAndCalculateOrder({
      customerName: 'Amina Bello',
      customerPhone: '08033729125',
      deliveryType: 'delivery',
      deliveryZoneId: 'zone-1-ikeja',
      deliveryAddress: '10 Oba Akran Avenue, Ikeja, Lagos',
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
      items: [
        { menuItemId: item1.id, quantity: 2 },
        { menuItemId: item2.id, quantity: 1 },
      ],
    });

    const expectedSubtotal = item1.priceKobo * 2n + item2.priceKobo * 1n;
    const expectedDelivery = 250000n; // Zone 1
    const expectedTotal = expectedSubtotal + expectedDelivery;

    expect(order.subtotalKobo).toBe(expectedSubtotal);
    expect(order.deliveryFeeKobo).toBe(expectedDelivery);
    expect(order.totalKobo).toBe(expectedTotal);
    expect(order.items.length).toBe(2);
    expect(order.items[0].unitPriceKoboSnapshot).toBe(item1.priceKobo);
    expect(order.items[0].totalKoboSnapshot).toBe(item1.priceKobo * 2n);
  });

  it('Calculates ₦0.00 delivery fee for Self-Collection', () => {
    const publishedItems = menuRepository.getItems(false);
    const item = publishedItems[0];

    const order = validateAndCalculateOrder({
      customerName: 'Babatunde Raji',
      customerPhone: '+2348033729125',
      deliveryType: 'collection',
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
      items: [{ menuItemId: item.id, quantity: 1 }],
    });

    expect(order.deliveryType).toBe('collection');
    expect(order.deliveryFeeKobo).toBe(0n);
    expect(order.totalKobo).toBe(order.subtotalKobo);
  });

  it('Rejects order if customer attempts to checkout without accepting the Refund Policy', () => {
    const publishedItems = menuRepository.getItems(false);
    const item = publishedItems[0];

    expect(() =>
      validateAndCalculateOrder({
        customerName: 'Fraud Attempter',
        customerPhone: '08033729125',
        deliveryType: 'collection',
        acceptedPolicy: false,
        policyVersion: POLICY_VERSION,
        items: [{ menuItemId: item.id, quantity: 1 }],
      })
    ).toThrow(/Refund & Cancellation Policy/);
  });

  it('Rejects order with stale policy version', () => {
    const publishedItems = menuRepository.getItems(false);
    const item = publishedItems[0];

    expect(() =>
      validateAndCalculateOrder({
        customerName: 'Stale Policy User',
        customerPhone: '08033729125',
        deliveryType: 'collection',
        acceptedPolicy: true,
        policyVersion: '2025-01-01-old',
        items: [{ menuItemId: item.id, quantity: 1 }],
      })
    ).toThrow(/Stale policy version/);
  });

  it('Normalizes local Nigerian telephone numbers to E.164 (+234)', () => {
    const publishedItems = menuRepository.getItems(false);
    const item = publishedItems[0];

    const order = validateAndCalculateOrder({
      customerName: 'Kalu Uche',
      customerPhone: '0803 372 9125',
      deliveryType: 'collection',
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
      items: [{ menuItemId: item.id, quantity: 1 }],
    });

    expect(order.customerPhone).toBe('+2348033729125');
  });

  it('Generates secure collision-resistant order tracking codes matching RUC-YYYYMMDD-XXXX', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateOrderCode();
      expect(code).toMatch(/^RUC-[0-9]{8}-[A-Z0-9]{4}$/);
    }
  });
});

describe('Phase 3: Order Repository & Status Lifecycle', () => {
  it('Persists order and allows full status progression', () => {
    const publishedItems = menuRepository.getItems(false);
    const item = publishedItems[0];

    const order = createOrder({
      customerName: 'Zainab Ahmed',
      customerPhone: '08033729125',
      deliveryType: 'collection',
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
      items: [{ menuItemId: item.id, quantity: 1 }],
    });

    expect(order.status).toBe('pending_payment');

    // 1. Verify Payment
    const verified = orderRepository.updateStatus(order.id, 'payment_confirmed', {
      actorUserId: 'usr-owner-01',
      paymentReference: 'WEMA-98127391',
    });
    expect(verified.status).toBe('payment_confirmed');
    expect(verified.paymentVerifiedAt).toBeDefined();

    // 2. Kitchen cooking
    const cooking = orderRepository.updateStatus(order.id, 'in_kitchen');
    expect(cooking.status).toBe('in_kitchen');

    // 3. Out for delivery
    const outForDelivery = orderRepository.updateStatus(order.id, 'out_for_delivery');
    expect(outForDelivery.status).toBe('out_for_delivery');

    // 4. Delivered
    const delivered = orderRepository.updateStatus(order.id, 'delivered');
    expect(delivered.status).toBe('delivered');

    // 5. Query by code
    const found = orderRepository.getByCode(order.orderCode);
    expect(found).toBeDefined();
    expect(found?.id).toBe(order.id);
  });
});
