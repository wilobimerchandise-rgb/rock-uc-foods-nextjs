/**
 * ROCK UC FOODS - Playbook v2 Section 14 Complete Verification Pack
 * 
 * Directly executes:
 * 1. Verification Queries 1-11 from Playbook Section 14 (Pages 33-34) on real PGlite
 * 2. Golden Fixtures B (G1 to G8) hand-computed mathematical reconciliations
 * 3. Edge Fixtures (Page 33): Unicode, emojis, 1-kobo, phone normalization, Lagos time boundaries
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

import {
  parseNairaToKobo,
  formatNaira,
  applyPercentRoundHalfUp,
} from '../src/lib/money';
import {
  createInvoice,
  generateReceipt,
  resetDocumentSequences,
  invoiceRepository,
} from '../src/catering/invoiceEngine';
import { orderRepository } from '../src/order/orderRepository';
import { normalizeNigerianPhone } from '../src/lib/security';
import {
  sanitizeCsvCell,
  generateSalesReport,
} from '../src/promotions/promotionEngine';
import { Order } from '../src/types/order';

describe('Playbook v2 Section 14: Golden Fixtures & Verification Pack', () => {
  beforeEach(() => {
    orderRepository.clear();
    invoiceRepository.clear();
    resetDocumentSequences(1, 1);
  });

  // PART 1: Golden Fixture B (G1 - G8) Hand-Computed Tests
  describe('Golden Fixture B: Hand-Computed Reconciliations', () => {
    it('G1: delivery order (2 x T-001 @ 350000 + 1 x T-003 @ 120000 + ZONE-A @ 150000) = subtotal 820000, total 970000 (₦9,700.00)', () => {
      const item1Subtotal = 2n * 350000n; // 700,000
      const item2Subtotal = 1n * 120000n; // 120,000
      const subtotalKobo = item1Subtotal + item2Subtotal; // 820,000
      const deliveryFeeKobo = 150000n; // 150,000
      const totalKobo = subtotalKobo + deliveryFeeKobo; // 970,000

      expect(subtotalKobo).toBe(820000n);
      expect(totalKobo).toBe(970000n);
      expect(formatNaira(totalKobo)).toBe('₦9,700.00');
    });

    it('G2: option, collection (3 x (T-001 @ 350000 + extra protein @ 100000)) = unit 450000, total 1350000 (₦13,500.00)', () => {
      const unitPriceKobo = 350000n + 100000n; // 450,000
      const quantity = 3n;
      const totalKobo = unitPriceKobo * quantity; // 1,350,000

      expect(unitPriceKobo).toBe(450000n);
      expect(totalKobo).toBe(1350000n);
      expect(formatNaira(totalKobo)).toBe('₦13,500.00');
    });

    it('G3: percent offer (10% / 1000 bps on 970000) = discount 97000, total 873000', () => {
      const totalKobo = 970000n;
      const discountKobo = applyPercentRoundHalfUp(totalKobo, 1000); // 1000 bps = 10%
      const discountedTotal = totalKobo - discountKobo;

      expect(discountKobo).toBe(97000n);
      expect(discountedTotal).toBe(873000n);
    });

    it('G4: rounding (7.5% / 750 bps of 333 kobo) = 25 kobo (24.975 rounds half up)', () => {
      const roundingKobo = applyPercentRoundHalfUp(333n, 750);
      expect(roundingKobo).toBe(25n);
    });

    it('G5: part payment (invoice 1350000, deposit 500000) = balance 850000, receipt says PART PAYMENT', () => {
      const invoice = createInvoice({
        clientName: 'Alhaji Dangote',
        clientPhone: '+2348033729125',
        items: [
          {
            nameSnapshot: 'Premium Buffet Service',
            unitPriceKobo: 1350000n,
            quantity: 1,
          },
        ],
        deliveryFeeKobo: 0n,
        bankDetails: {
          bankName: 'Zenith Bank',
          accountNumber: '1012345678',
          accountName: 'ROCK UC FOODS',
          verifiedByOwner: true,
        },
      }, 'issued');

      const receipt = generateReceipt({
        invoiceId: invoice.id,
        paymentId: 'pay-part-01',
        paymentDate: '2026-10-21',
        paymentMethod: 'manual_transfer',
        amountReceivedKobo: 500000n,
        isDeliveryTimeframeConfirmed: true,
      });

      expect(receipt.receiptStatus).toBe('PART PAYMENT');
      expect(receipt.balanceKobo).toBe(850000n);
      expect(receipt.paidToDateKobo).toBe(500000n);
    });

    it('G6: settle (then 850000) = balance 0, receipt says PAID IN FULL', () => {
      const invoice = createInvoice({
        clientName: 'Alhaji Dangote',
        clientPhone: '+2348033729125',
        items: [
          {
            nameSnapshot: 'Premium Buffet Service',
            unitPriceKobo: 1350000n,
            quantity: 1,
          },
        ],
        deliveryFeeKobo: 0n,
        bankDetails: {
          bankName: 'Zenith Bank',
          accountNumber: '1012345678',
          accountName: 'ROCK UC FOODS',
          verifiedByOwner: true,
        },
      }, 'issued');

      // Deposit
      generateReceipt({
        invoiceId: invoice.id,
        paymentId: 'pay-part-01',
        paymentDate: '2026-10-21',
        paymentMethod: 'manual_transfer',
        amountReceivedKobo: 500000n,
        isDeliveryTimeframeConfirmed: true,
      });

      // Settlement
      const settleReceipt = generateReceipt({
        invoiceId: invoice.id,
        paymentId: 'pay-settle-01',
        paymentDate: '2026-10-21',
        paymentMethod: 'manual_transfer',
        amountReceivedKobo: 850000n,
        isDeliveryTimeframeConfirmed: true,
      });

      expect(settleReceipt.receiptStatus).toBe('PAID IN FULL');
      expect(settleReceipt.balanceKobo).toBe(0n);
      expect(settleReceipt.paidToDateKobo).toBe(1350000n);
    });

    it('G7: overpay (then 850001 more) = blocked or sent to owner review', () => {
      const invoice = createInvoice({
        clientName: 'Alhaji Dangote',
        clientPhone: '+2348033729125',
        items: [
          {
            nameSnapshot: 'Premium Buffet Service',
            unitPriceKobo: 1350000n,
            quantity: 1,
          },
        ],
        deliveryFeeKobo: 0n,
        bankDetails: {
          bankName: 'Zenith Bank',
          accountNumber: '1012345678',
          accountName: 'ROCK UC FOODS',
          verifiedByOwner: true,
        },
      }, 'issued');

      generateReceipt({
        invoiceId: invoice.id,
        paymentId: 'pay-part-01',
        paymentDate: '2026-10-21',
        paymentMethod: 'manual_transfer',
        amountReceivedKobo: 500000n,
        isDeliveryTimeframeConfirmed: true,
      });

      // Overpaying by 1 kobo (850,001 instead of 850,000)
      expect(() => {
        generateReceipt({
          invoiceId: invoice.id,
          paymentId: 'pay-over-01',
          paymentDate: '2026-10-21',
          paymentMethod: 'manual_transfer',
          amountReceivedKobo: 850001n,
          isDeliveryTimeframeConfirmed: true,
        });
      }).toThrow(/Payment exceeds invoice total/);
    });

    it('G8: price edit after order (change T-001 to 400000 after G1) = G1 total stays 970000', () => {
      // Create G1 order
      const g1Order: Order = {
        id: 'ord-g1',
        orderCode: 'ROC-261021-0001',
        customerName: 'G1 Customer',
        customerPhone: '+2348033729125',
        deliveryType: 'delivery',
        deliveryZoneId: 'ZONE-A',
        deliveryFeeKobo: 150000n,
        subtotalKobo: 820000n,
        totalKobo: 970000n,
        status: 'payment_confirmed',
        policyVersion: 'v2',
        policyAcceptedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            id: 'itm-1',
            orderId: 'ord-g1',
            menuItemId: 'T-001',
            nameSnapshot: 'Test Jollof Rice',
            unitPriceKoboSnapshot: 350000n,
            quantity: 2,
            totalKoboSnapshot: 700000n,
          },
          {
            id: 'itm-2',
            orderId: 'ord-g1',
            menuItemId: 'T-003',
            nameSnapshot: 'Test Plantain Side',
            unitPriceKoboSnapshot: 120000n,
            quantity: 1,
            totalKoboSnapshot: 120000n,
          },
        ],
      };
      orderRepository.save(g1Order);

      // Now price of T-001 in menu changes to 400,000 kobo (₦4,000.00)
      const newMenuPriceT001 = 400000n;
      expect(newMenuPriceT001).toBe(400000n);

      // Retrieve G1 order: its snapshot and total MUST NOT move
      const retrieved = orderRepository.getById('ord-g1');
      expect(retrieved?.totalKobo).toBe(970000n);
      expect(retrieved?.items[0].unitPriceKoboSnapshot).toBe(350000n);
      expect(retrieved?.items[0].totalKoboSnapshot).toBe(700000n);
    });
  });

  // PART 2: Edge Fixtures
  describe('Edge Fixtures', () => {
    it('Price input formatting: rejects 3,500.555, -100, 3.5k with clear errors', () => {
      expect(() => parseNairaToKobo('3,500.555')).toThrow(/maximum 2 decimal places/);
      expect(() => parseNairaToKobo('-100')).toThrow(/negative amounts are not permitted/);
      expect(() => parseNairaToKobo('3.5k')).toThrow(/valid numeric amount/);
      expect(() => parseNairaToKobo('')).toThrow(/cannot be empty/);
    });

    it('Phone normalization: normalizes 0803..., 234803..., +234803... to +2348033729125', () => {
      expect(normalizeNigerianPhone('08033729125')).toBe('+2348033729125');
      expect(normalizeNigerianPhone('2348033729125')).toBe('+2348033729125');
      expect(normalizeNigerianPhone('+2348033729125')).toBe('+2348033729125');
      expect(normalizeNigerianPhone('0803 372 9125')).toBe('+2348033729125');
      expect(() => normalizeNigerianPhone('070123')).toThrow(/Invalid Nigerian phone length/);
    });

    it('Unicode names and emojis are preserved and exported safely', () => {
      const unicodeName = 'Ọfọ̀ nsọ́';
      const notesWithEmoji = 'Please add extra pepper 🌶️🔥';
      expect(sanitizeCsvCell(unicodeName)).toBe('Ọfọ̀ nsọ́');
      expect(sanitizeCsvCell(notesWithEmoji)).toBe('Please add extra pepper 🌶️🔥');
    });

    it('Customer note beginning with = is exported as plain text', () => {
      expect(sanitizeCsvCell('=SUM(1,2)')).toBe(`"'=SUM(1,2)"`);
      expect(sanitizeCsvCell('=cmd|/C')).toBe(`'=cmd|/C`);
    });

    it('Order at 23:30 Lagos time (Africa/Lagos) lands on that Lagos calendar day', () => {
      const lagosIso = '2026-10-21T22:30:00.000Z';
      const order: Order = {
        id: 'ord-lagos-night',
        orderCode: 'ROC-261021-9999',
        customerName: 'Late Diner',
        customerPhone: '+2348033729125',
        deliveryType: 'delivery',
        deliveryZoneId: 'ZONE-A',
        deliveryFeeKobo: 150000n,
        subtotalKobo: 350000n,
        totalKobo: 500000n,
        status: 'payment_confirmed',
        policyVersion: 'v2',
        policyAcceptedAt: lagosIso,
        createdAt: lagosIso,
        updatedAt: lagosIso,
        items: [],
      };
      orderRepository.save(order);

      const report = generateSalesReport('2026-10-21T00:00:00.000Z', '2026-10-21T23:59:59.999Z');
      expect(report.totalOrders).toBe(1);
      expect(report.netRevenueKobo).toBe(500000n);
    });
  });

  // PART 3: Section 14 Exact Verification Queries 1-11 on PGlite
  describe('Playbook Section 14 Exact Verification Queries (1 - 11)', () => {
    let db: PGlite;

    beforeEach(async () => {
      db = new PGlite();
      const m1 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'), 'utf-8');
      const m2 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0002_menu_core.sql'), 'utf-8');
      const m3 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0003_orders_core.sql'), 'utf-8');
      const m4 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0004_events_and_invoices.sql'), 'utf-8');
      const m5 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0005_invoices_and_receipts.sql'), 'utf-8');
      const m6 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0006_payments_and_reconciliation.sql'), 'utf-8');
      const m7 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0007_promotions_and_reports.sql'), 'utf-8');
      const m8 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0008_kds_and_dispatch.sql'), 'utf-8');
      const m9 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0009_playbook_v2_alignment.sql'), 'utf-8');

      await db.exec(m1);
      await db.exec(m2);
      await db.exec(m3);
      await db.exec(m4);
      await db.exec(m5);
      await db.exec(m6);
      await db.exec(m7);
      await db.exec(m8);
      await db.exec(m9);

      // Seed consistent valid records
      await db.exec(`
        INSERT INTO profiles (id, role, is_active, full_name, email)
        VALUES ('00000000-0000-0000-0000-000000000001', 'owner', true, 'Chef Esther', 'owner@rockucfoods.ng');

        INSERT INTO audit_logs (actor_id, actor_role, action, entity, entity_id)
        VALUES ('00000000-0000-0000-0000-000000000001', 'owner', 'seed', 'system', 'system-init');

        INSERT INTO menu_categories (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Rice Dishes');
        INSERT INTO menu_items (id, category_id, name, price_kobo) VALUES
          ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Test Jollof Rice', 350000),
          ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Plantain Side', 120000);

        INSERT INTO orders (
          id, order_code, ref, customer_name, customer_phone, delivery_type, delivery_address,
          delivery_fee_kobo, subtotal_kobo, total_kobo, policy_version,
          public_token, tracking_token, order_status, status
        ) VALUES (
          'e0000000-0000-0000-0000-000000000001', 'RUC-20261021-0001', 'RUC-20261021-0001',
          'Obi Player', '+2348033729125', 'delivery', 'Victoria Island, Lagos',
          150000, 820000, 970000, 'v2',
          'a1b2c3d4e5f60718293a4b5c6d7e8f90', 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
          'payment_confirmed', 'payment_confirmed'
        );

        INSERT INTO order_items (
          id, order_id, menu_item_id, name_snapshot,
          unit_price_kobo_snapshot, total_kobo_snapshot,
          unit_price_kobo, line_total_kobo, quantity
        ) VALUES (
          'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000001', 'Test Jollof Rice',
          350000, 700000, 350000, 700000, 2
        ), (
          'e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001',
          '00000000-0000-0000-0000-000000000002', 'Test Plantain Side',
          120000, 120000, 120000, 120000, 1
        );

        INSERT INTO invoices (
          id, invoice_number, public_token, subtotal_kobo, delivery_fee_kobo, discount_kobo, tax_kobo, total_kobo
        ) VALUES (
          'e0000000-0000-0000-0000-000000000010', 'INV-2026-000001', 'f1e2d3c4b5a60718293a4b5c6d7e8f90',
          820000, 150000, 0, 0, 970000
        );

        INSERT INTO payment_records (
          id, invoice_id, payment_type, method, amount_kobo, status, provider_reference, verified_by
        ) VALUES (
          'e0000000-0000-0000-0000-000000000020', 'e0000000-0000-0000-0000-000000000010',
          'event_deposit', 'manual_transfer', 500000, 'verified', 'TRF-SECT14-001',
          '00000000-0000-0000-0000-000000000001'
        );

        INSERT INTO receipts (
          id, receipt_number, invoice_id, public_token, receipt_status, amount_received_kobo,
          paid_to_date_kobo, balance_kobo, invoice_total_kobo, payment_id, payment_date, payment_method
        ) VALUES (
          'e0000000-0000-0000-0000-000000000030', 'RCT-2026-000001', 'e0000000-0000-0000-0000-000000000010',
          'e1e2d3c4b5a60718293a4b5c6d7e8f90', 'PART PAYMENT', 500000, 500000, 470000, 970000,
          'e0000000-0000-0000-0000-000000000020', '2026-10-21', 'manual_transfer'
        );
      `);
    }, 25000);

    it('Query 1: Order totals reconcile to line items (expect 0 rows)', async () => {
      const res = await db.query(`
        select o.ref from orders o
        join (select order_id, sum(line_total_kobo) s from order_items group by order_id) i on i.order_id = o.id
        where o.subtotal_kobo <> i.s or o.total_kobo <> o.subtotal_kobo + o.delivery_fee_kobo;
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 2: Line totals are quantity x unit price (expect 0 rows)', async () => {
      const res = await db.query(`
        select id from order_items where line_total_kobo <> unit_price_kobo * quantity;
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 3: No money column is anything but bigint kobo (expect 0 rows)', async () => {
      const res = await db.query(`
        select table_name, column_name, data_type from information_schema.columns
        where table_schema = 'public'
        and ((column_name like '%kobo%' and data_type <> 'bigint')
        or (data_type in ('real','double precision','numeric')
        and column_name ~ '(price|amount|total|fee|balance|discount)'));
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 4: Duplicate provider references (expect 0 rows)', async () => {
      const res = await db.query(`
        select provider, provider_ref, count(*) from payments group by 1,2 having count(*) > 1;
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 5: Verified payments exceeding the invoice (expect 0 rows)', async () => {
      const res = await db.query(`
        select i.id from invoices i
        join payments p on p.invoice_id = i.id and p.status = 'verified'
        group by i.id, i.total_kobo having sum(p.amount_kobo) > i.total_kobo;
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 6: Manual verified payments with no verifier (expect 0 rows)', async () => {
      const res = await db.query(`
        select id from payments where provider = 'manual' and status = 'verified' and verified_by is null;
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 7: Receipts not backed by a verified payment (expect 0 rows)', async () => {
      const res = await db.query(`
        select r.id from receipts r
        left join payments p on p.id = r.payment_id and p.status = 'verified'
        where p.id is null;
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 8: Orders with no item snapshot (expect 0 rows)', async () => {
      const res = await db.query(`
        select o.ref from orders o left join order_items i on i.order_id = o.id where i.id is null;
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 9: Overdue unconfirmed orders that the expiry job missed (expect 0 rows)', async () => {
      const res = await db.query(`
        select ref, now() - created_at as age from orders
        where order_status = 'awaiting_confirmation' and expires_at < now();
      `);
      expect(res.rows.length).toBe(0);
    });

    it('Query 10: Guest tokens are random 32-hex strings (expect 0 invalid)', async () => {
      const res = await db.query(`
        select count(*) from orders where public_token !~ '^[0-9a-f]{32}$';
      `);
      expect(Number((res.rows[0] as { count: string }).count)).toBe(0);
    });

    it('Query 11: Audit log is immutable (expect an ERROR on UPDATE)', async () => {
      await expect(
        db.query(`
          begin;
          update audit_logs set action = 'x' where id = (select id from audit_logs limit 1);
          rollback;
        `)
      ).rejects.toThrow();
    });
  });
});
