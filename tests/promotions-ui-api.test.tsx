/**
 * ROCK UC FOODS - Phase 7: Promotions & Reports Integration Tests
 * Playbook v2 Section 12: Reports, Promotions and Exports
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  promoRepository,
  validateAndCalculatePromo,
  generateSalesReport,
  sanitizeCsvCell,
  exportOrdersToCsv,
} from '../src/promotions/promotionEngine';
import { orderRepository } from '../src/order/orderRepository';
import { createOrder } from '../src/order/orderEngine';
import { POLICY_VERSION } from '../src/policy/content';
import { Order } from '../src/types/order';

describe('Phase 7: Promotions, Coupon Engine, Sales Reports & CSV Exports', () => {
  beforeEach(() => {
    promoRepository.clear();
    orderRepository.clear();
  });

  describe('1. Promo Code Validation & Discount Engine', () => {
    it('applies percentage promo with accurate BigInt kobo calculation', () => {
      promoRepository.save({
        id: 'promo-10',
        code: 'WELCOME10',
        discountType: 'percentage',
        discountValue: 10n, // 10%
        minOrderKobo: 200000n, // ₦2,000.00
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
        usedCount: 0,
        createdAt: new Date().toISOString(),
      });

      // Subtotal: ₦5,000.00 (500000n)
      const res = validateAndCalculatePromo('WELCOME10', 500000n);
      expect(res.isValid).toBe(true);
      expect(res.discountKobo).toBe(50000n); // 10% of 500k = 50,000 kobo (₦500.00)
    });

    it('rejects promo code if subtotal is below minimum order threshold', () => {
      promoRepository.save({
        id: 'promo-min',
        code: 'BIGSPEND',
        discountType: 'fixed_amount',
        discountValue: 50000n,
        minOrderKobo: 1000000n, // ₦10,000.00 min
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
        usedCount: 0,
        createdAt: new Date().toISOString(),
      });

      // Subtotal: ₦8,000.00 (800000n)
      const res = validateAndCalculatePromo('BIGSPEND', 800000n);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('below the minimum threshold');
    });

    it('caps percentage discount at maxDiscountKobo', () => {
      promoRepository.save({
        id: 'promo-cap',
        code: 'HALF50',
        discountType: 'percentage',
        discountValue: 50n, // 50%
        minOrderKobo: 0n,
        maxDiscountKobo: 150000n, // Capped at ₦1,500.00 (150,000 kobo)
        startDate: new Date(Date.now() - 3600000).toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
        usedCount: 0,
        createdAt: new Date().toISOString(),
      });

      // Subtotal: ₦10,000.00 (1000000n) -> 50% is 500,000 kobo, but cap is 150,000 kobo
      const res = validateAndCalculatePromo('HALF50', 1000000n);
      expect(res.isValid).toBe(true);
      expect(res.discountKobo).toBe(150000n);
    });

    it('rejects expired promo code', () => {
      promoRepository.save({
        id: 'promo-exp',
        code: 'EXPIRED20',
        discountType: 'percentage',
        discountValue: 20n,
        minOrderKobo: 0n,
        startDate: new Date(Date.now() - 7200000).toISOString(),
        endDate: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
        isActive: true,
        usedCount: 0,
        createdAt: new Date().toISOString(),
      });

      const res = validateAndCalculatePromo('EXPIRED20', 500000n);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('expired');
    });
  });

  describe('2. Sales Reports Aggregation & Zone Analytics', () => {
    it('aggregates gross revenue, delivery fees, zone breakdown, and item popularity', () => {
      const order1: Order = {
        id: 'ord-rep-1',
        orderCode: 'ROC-261030-0001',
        customerName: 'Client Island',
        customerPhone: '+2348033729125',
        deliveryType: 'delivery',
        deliveryZoneId: 'ZONE-A',
        deliveryFeeKobo: 150000n, // ₦1,500.00
        subtotalKobo: 700000n, // ₦7,000.00
        totalKobo: 850000n, // ₦8,500.00
        status: 'payment_confirmed',
        policyVersion: 'v4.0',
        policyAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 'it-1',
            orderId: 'ord-rep-1',
            menuItemId: 'dish-jollof',
            nameSnapshot: 'Royal Jollof Rice with Grilled Tilapia',
            unitPriceKoboSnapshot: 350000n,
            quantity: 2,
            totalKoboSnapshot: 700000n,
          },
        ],
      };

      const order2: Order = {
        id: 'ord-rep-2',
        orderCode: 'ROC-261030-0002',
        customerName: 'Client Mainland',
        customerPhone: '+2348021112233',
        deliveryType: 'delivery',
        deliveryZoneId: 'ZONE-B',
        deliveryFeeKobo: 250000n, // ₦2,500.00
        subtotalKobo: 500000n, // ₦5,000.00
        totalKobo: 750000n, // ₦7,500.00
        status: 'delivered',
        policyVersion: 'v4.0',
        policyAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 'it-2',
            orderId: 'ord-rep-2',
            menuItemId: 'dish-jollof',
            nameSnapshot: 'Royal Jollof Rice with Grilled Tilapia',
            unitPriceKoboSnapshot: 350000n,
            quantity: 1,
            totalKoboSnapshot: 350000n,
          },
          {
            id: 'it-3',
            orderId: 'ord-rep-2',
            menuItemId: 'dish-plantain',
            nameSnapshot: 'Crispy Dodo Plantain',
            unitPriceKoboSnapshot: 150000n,
            quantity: 1,
            totalKoboSnapshot: 150000n,
          },
        ],
      };

      orderRepository.save(order1);
      orderRepository.save(order2);

      const report = generateSalesReport();
      expect(report.totalOrders).toBe(2);
      expect(report.grossRevenueKobo).toBe(1200000n); // 700k + 500k
      expect(report.totalDeliveryFeesKobo).toBe(400000n); // 150k + 250k
      expect(report.netRevenueKobo).toBe(1600000n); // 850k + 750k
      expect(report.averageOrderValueKobo).toBe(800000n); // 1600k / 2

      // Zone Breakdown
      expect(report.zoneBreakdown['ZONE-A'].orderCount).toBe(1);
      expect(report.zoneBreakdown['ZONE-A'].revenueKobo).toBe(850000n);
      expect(report.zoneBreakdown['ZONE-B'].orderCount).toBe(1);
      expect(report.zoneBreakdown['ZONE-B'].revenueKobo).toBe(750000n);

      // Item Popularity
      expect(report.itemPopularity[0].menuItemId).toBe('dish-jollof');
      expect(report.itemPopularity[0].quantity).toBe(3); // 2 + 1
      expect(report.itemPopularity[0].revenueKobo).toBe(1050000n);
    });
  });

  describe('3. CSV Export Formula Injection Sanitization', () => {
    it('prepends single quote to dangerous characters (=, +, -, @, \\t, \\r)', () => {
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe(`'=SUM(A1:A10)`);
      expect(sanitizeCsvCell('+123456789')).toBe(`'+123456789`);
      expect(sanitizeCsvCell('-cmd|/C calc.exe')).toBe(`'-cmd|/C calc.exe`);
      expect(sanitizeCsvCell('@IMPORTXML')).toBe(`'@IMPORTXML`);
    });

    it('exports orders to CSV with formula injection protection and formatted ₦ amounts', () => {
      const maliciousOrder: Order = {
        id: 'ord-malicious',
        orderCode: '=HYPERLINK("http://evil.com")',
        customerName: '+Attacker Name',
        customerPhone: '+2348033729125',
        deliveryType: 'collection',
        deliveryFeeKobo: 0n,
        subtotalKobo: 500000n,
        totalKobo: 500000n,
        status: 'payment_confirmed',
        policyVersion: 'v4.0',
        policyAcceptedAt: new Date().toISOString(),
        createdAt: '2026-10-30T10:00:00.000Z',
        updatedAt: '2026-10-30T10:00:00.000Z',
        items: [],
      };

      const csv = exportOrdersToCsv([maliciousOrder]);
      expect(csv).toContain('Order Code,Date,Customer Name');
      // Must be safely escaped with apostrophe
      expect(csv).toContain(`"'=HYPERLINK(""http://evil.com"")"`);
      expect(csv).toContain(`'+Attacker Name`);
      expect(csv).toContain('₦5,000.00');
    });
  });

  describe('4. Order Checkout with Promo Code Integration', () => {
    it('creates order with promoCodeId and deducts discount from totalKobo', () => {
      const order = createOrder({
        customerName: 'Obi Test',
        customerPhone: '08033729125',
        deliveryType: 'collection',
        acceptedPolicy: true,
        policyVersion: POLICY_VERSION,
        promoCodeId: 'promo-10',
        discountKobo: 50000n, // ₦500.00 discount
        items: [
          {
            menuItemId: 'item-t001',
            quantity: 1,
          },
        ],
      });

      expect(order.subtotalKobo).toBe(350000n);
      expect(order.discountKobo).toBe(50000n);
      expect(order.deliveryFeeKobo).toBe(0n);
      // Total = 350,000 - 50,000 = 300,000 kobo (₦3,000.00)
      expect(order.totalKobo).toBe(300000n);
      expect(order.promoCodeId).toBe('promo-10');
    });
  });
});
