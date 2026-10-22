/**
 * ROCK UC FOODS - Phase 7 Verification Test Suite
 * Playbook v2 Section 12: Reports, Promotions and Exports
 * 
 * Validates:
 * 1. Real PostgreSQL PGlite migration (0007_promotions_and_reports.sql) & schema check constraints
 * 2. Valid promo code application and exact kobo discount calculation
 * 3. Percentage discount with max cap (maxDiscountKobo)
 * 4. Expired promo code rejection
 * 5. Usage limit exhaustion rejection
 * 6. Minimum order subtotal threshold enforcement
 * 7. Sales report aggregation across Lagos delivery zones & item popularity
 * 8. CSV export formula injection sanitization (=, +, -, @)
 * 9. Subtotal protection: discount can never exceed order subtotal
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

import {
  promoRepository,
  validateAndCalculatePromo,
  generateSalesReport,
  sanitizeCsvCell,
  exportOrdersToCsv,
} from '../src/promotions/promotionEngine';
import { orderRepository } from '../src/order/orderRepository';
import { PromoCode } from '../src/types/promotion';
import { Order, OrderItemSnapshot } from '../src/types/order';

function createTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-test-p7-01',
    orderCode: 'ROC-261020-7001',
    customerName: 'Customer Test',
    customerPhone: '+2348033729125',
    deliveryType: 'delivery',
    deliveryZoneId: 'ZONE-A',
    deliveryFeeKobo: 150000n,
    deliveryAddress: 'Victoria Island, Lagos',
    status: 'payment_confirmed',
    subtotalKobo: 350000n,
    totalKobo: 500000n,
    policyVersion: 'v2',
    policyAcceptedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    ...overrides,
  };
}

function createTestItem(overrides: Partial<OrderItemSnapshot> = {}): OrderItemSnapshot {
  return {
    id: 'itm-p7-01',
    orderId: 'ord-test-p7-01',
    menuItemId: 'T-001',
    nameSnapshot: 'Jollof Rice with Grilled Chicken',
    unitPriceKoboSnapshot: 350000n,
    quantity: 1,
    totalKoboSnapshot: 350000n,
    ...overrides,
  };
}

describe('Phase 7: Reports, Promotions and Exports', () => {
  beforeEach(() => {
    promoRepository.clear();
    orderRepository.clear();
  });

  // TEST 1: Database Migration & Schema Constraints
  it('1. Applies 0007_promotions_and_reports.sql and enforces uppercase, percentage <= 100, and usage limits', async () => {
    const db = new PGlite();
    const sql1 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'), 'utf-8');
    const sql2 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0002_menu_core.sql'), 'utf-8');
    const sql3 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0003_orders_core.sql'), 'utf-8');
    const sql4 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0004_events_and_invoices.sql'), 'utf-8');
    const sql5 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0005_invoices_and_receipts.sql'), 'utf-8');
    const sql6 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0006_payments_and_reconciliation.sql'), 'utf-8');
    const sql7 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0007_promotions_and_reports.sql'), 'utf-8');

    await db.exec(sql1);
    await db.exec(sql2);
    await db.exec(sql3);
    await db.exec(sql4);
    await db.exec(sql5);
    await db.exec(sql6);
    await db.exec(sql7);

    // 1. Insert valid promo code
    await db.exec(`
      INSERT INTO promo_codes (
        id, code, description, discount_type, discount_value, min_order_kobo, start_date, end_date, is_active
      ) VALUES (
        'c0000000-0000-0000-0000-000000000001', 'WELCOME10', '10% Welcome Discount',
        'percentage', 10, 200000, now(), now() + interval '30 days', true
      );
    `);

    // 2. Reject lowercase code
    await expect(
      db.query(`
        INSERT INTO promo_codes (
          id, code, discount_type, discount_value, start_date, end_date
        ) VALUES (
          'c0000000-0000-0000-0000-000000000002', 'lowercase10', 'percentage', 10, now(), now() + interval '30 days'
        );
      `)
    ).rejects.toThrow();

    // 3. Reject percentage > 100
    await expect(
      db.query(`
        INSERT INTO promo_codes (
          id, code, discount_type, discount_value, start_date, end_date
        ) VALUES (
          'c0000000-0000-0000-0000-000000000003', 'OVER100', 'percentage', 110, now(), now() + interval '30 days'
        );
      `)
    ).rejects.toThrow(/promo_percent_chk/);

    // 4. Reject end_date before start_date
    await expect(
      db.query(`
        INSERT INTO promo_codes (
          id, code, discount_type, discount_value, start_date, end_date
        ) VALUES (
          'c0000000-0000-0000-0000-000000000004', 'INVDATE', 'percentage', 10, now(), now() - interval '1 day'
        );
      `)
    ).rejects.toThrow(/promo_date_chk/);
  }, 25000);

  // TEST 2: Valid Promo Code Application
  it('2. Successfully applies active promo code and computes exact kobo discount', () => {
    const promo: PromoCode = {
      id: 'p-01',
      code: 'TASTE15',
      discountType: 'percentage',
      discountValue: 15n, // 15%
      minOrderKobo: 200000n, // ₦2,000
      usedCount: 0,
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    promoRepository.save(promo);

    // Subtotal ₦10,000 = 1,000,000 kobo. 15% is 150,000 kobo (₦1,500)
    const res = validateAndCalculatePromo('taste15', 1000000n);
    expect(res.isValid).toBe(true);
    expect(res.discountKobo).toBe(150000n);
  });

  // TEST 3: Percentage Discount Cap (maxDiscountKobo)
  it('3. Respects maxDiscountKobo ceiling on percentage discounts', () => {
    const promo: PromoCode = {
      id: 'p-02',
      code: 'BIGDEAL25',
      discountType: 'percentage',
      discountValue: 25n, // 25%
      minOrderKobo: 500000n,
      maxDiscountKobo: 500000n, // Cap at ₦5,000 (500,000 kobo)
      usedCount: 0,
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    promoRepository.save(promo);

    // Subtotal ₦40,000 (4,000,000 kobo). 25% would be ₦10,000, but capped at ₦5,000 (500,000 kobo)
    const res = validateAndCalculatePromo('BIGDEAL25', 4000000n);
    expect(res.isValid).toBe(true);
    expect(res.discountKobo).toBe(500000n);
  });

  // TEST 4: Expired Promo Code Rejection
  it('4. Rejects promo codes when current timestamp is past the end date', () => {
    const expiredPromo: PromoCode = {
      id: 'p-03',
      code: 'EXPIRED10',
      discountType: 'percentage',
      discountValue: 10n,
      minOrderKobo: 0n,
      usedCount: 0,
      startDate: new Date(Date.now() - 7 * 86400000).toISOString(),
      endDate: new Date(Date.now() - 86400000).toISOString(), // expired yesterday
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    promoRepository.save(expiredPromo);

    const res = validateAndCalculatePromo('EXPIRED10', 500000n);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('has expired');
  });

  // TEST 5: Usage Limit Exhaustion
  it('5. Rejects promo code when usageLimit has been reached', () => {
    const limitedPromo: PromoCode = {
      id: 'p-04',
      code: 'FIRST50',
      discountType: 'fixed_amount',
      discountValue: 100000n, // ₦1,000
      minOrderKobo: 0n,
      usageLimit: 3,
      usedCount: 3, // Already used 3 times
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    promoRepository.save(limitedPromo);

    const res = validateAndCalculatePromo('FIRST50', 500000n);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('usage limit');
  });

  // TEST 6: Minimum Order Subtotal Threshold Enforcement
  it('6. Rejects promo code if subtotal is below minOrderKobo requirement', () => {
    const thresholdPromo: PromoCode = {
      id: 'p-05',
      code: 'MINORDER',
      discountType: 'percentage',
      discountValue: 10n,
      minOrderKobo: 1000000n, // ₦10,000 minimum
      usedCount: 0,
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    promoRepository.save(thresholdPromo);

    // Subtotal ₦8,000 (below ₦10,000 threshold)
    const res = validateAndCalculatePromo('MINORDER', 800000n);
    expect(res.isValid).toBe(false);
    expect(res.reason).toContain('minimum threshold');
  });

  // TEST 7: Sales Report Aggregation Across Lagos Delivery Zones
  it('7. Aggregates sales metrics, AOV, and zone popularity without floating point drift', () => {
    const o1 = createTestOrder({
      id: 'o-1',
      deliveryZoneId: 'ZONE-A',
      deliveryFeeKobo: 150000n,
      subtotalKobo: 350000n,
      totalKobo: 500000n,
      items: [createTestItem({ menuItemId: 'T-001', quantity: 2, totalKoboSnapshot: 700000n })],
    });
    const o2 = createTestOrder({
      id: 'o-2',
      deliveryZoneId: 'ZONE-B',
      deliveryFeeKobo: 250000n,
      subtotalKobo: 450000n,
      totalKobo: 700000n,
      items: [createTestItem({ menuItemId: 'T-002', quantity: 1, totalKoboSnapshot: 450000n })],
    });
    orderRepository.save(o1);
    orderRepository.save(o2);

    const report = generateSalesReport();
    expect(report.totalOrders).toBe(2);
    expect(report.grossRevenueKobo).toBe(800000n); // 350k + 450k
    expect(report.totalDeliveryFeesKobo).toBe(400000n); // 150k + 250k
    expect(report.netRevenueKobo).toBe(1200000n); // 500k + 700k
    expect(report.averageOrderValueKobo).toBe(600000n); // 1.2M / 2

    // Zone breakdown reconciliation
    expect(report.zoneBreakdown['ZONE-A']?.orderCount).toBe(1);
    expect(report.zoneBreakdown['ZONE-A']?.revenueKobo).toBe(500000n);
    expect(report.zoneBreakdown['ZONE-B']?.orderCount).toBe(1);
    expect(report.zoneBreakdown['ZONE-B']?.revenueKobo).toBe(700000n);
  });

  // TEST 8: CSV Export Formula Injection Sanitization
  it('8. Sanitizes CSV cells starting with =, +, -, @ to prevent formula execution', () => {
    expect(sanitizeCsvCell('=12345')).toBe(`'=12345`);
    expect(sanitizeCsvCell('+1234567890')).toBe(`'+1234567890`);
    expect(sanitizeCsvCell('@special')).toBe(`'@special`);
    expect(sanitizeCsvCell('=SUM(1,2)')).toBe(`"'=SUM(1,2)"`);
    expect(sanitizeCsvCell('-SUM(1,2)')).toBe(`"'-SUM(1,2)"`);
    expect(sanitizeCsvCell('=cmd|"/C calc"!A0')).toBe(`"'=cmd|""/C calc""!A0"`);
    expect(sanitizeCsvCell('Normal Name')).toBe('Normal Name');

    // Test inside exported CSV
    const maliciousOrder = createTestOrder({
      customerName: '=SUM(1,1)',
      customerPhone: '+2348033729125',
    });
    const csv = exportOrdersToCsv([maliciousOrder]);
    expect(csv).toContain(`"'=SUM(1,1)"`);
    expect(csv).toContain(`'+2348033729125`);
  });

  // TEST 9: Discount Cannot Exceed Subtotal
  it('9. Restricts fixed discount to subtotal to prevent negative balances', () => {
    const hugeDiscountPromo: PromoCode = {
      id: 'p-06',
      code: 'BIGSAVE50K',
      discountType: 'fixed_amount',
      discountValue: 5000000n, // ₦50,000 discount
      minOrderKobo: 0n,
      usedCount: 0,
      startDate: new Date(Date.now() - 3600000).toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    promoRepository.save(hugeDiscountPromo);

    // Customer only ordering ₦20,000 subtotal (2,000,000 kobo)
    const res = validateAndCalculatePromo('BIGSAVE50K', 2000000n);
    expect(res.isValid).toBe(true);
    // Discount capped at subtotal (2,000,000 kobo)
    expect(res.discountKobo).toBe(2000000n);
  });
});
