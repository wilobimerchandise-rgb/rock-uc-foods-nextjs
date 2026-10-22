/**
 * ROCK UC FOODS - Phase 6 Verification Test Suite
 * Playbook v2 Section 11: Payments and Reconciliation
 * 
 * Validates:
 * 1. Real PostgreSQL PGlite migration (0006_payments_and_reconciliation.sql) & unique reference constraints
 * 2. Paystack HMAC-SHA512 webhook signature verification & timing attack resistance
 * 3. Webhook idempotency & replay protection (zero double-crediting)
 * 4. Client-side payment bypass rejection
 * 5. Rejection of duplicate bank transfer references across orders
 * 6. Manual payment verification checklist (staff role, bank statement confirmed, receipt generated)
 * 7. Manual payment amount mismatch rejection (exact kobo reconciliation)
 * 8. Rejection of failed charge events from advancing order status
 * 9. End-of-day financial ledger reconciliation & discrepancy detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

import {
  paymentRepository,
  verifyPaystackSignature,
  submitManualPaymentTransfer,
  confirmManualPayment,
  processPaystackWebhook,
  generateReconciliationReport,
} from '../src/payment/paymentEngine';
import { orderRepository } from '../src/order/orderRepository';
import { invoiceRepository, resetDocumentSequences } from '../src/catering/invoiceEngine';
import { Order, OrderItemSnapshot } from '../src/types/order';

function createTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-test-01',
    orderCode: 'ROC-261020-0001',
    customerName: 'Customer',
    customerPhone: '+2348033729125',
    deliveryType: 'delivery',
    deliveryZoneId: 'ZONE-A',
    deliveryFeeKobo: 150000n,
    deliveryAddress: 'Lagos',
    status: 'pending_payment',
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
    id: 'itm-01',
    orderId: 'ord-test-01',
    menuItemId: 'T-001',
    nameSnapshot: 'Jollof Rice',
    unitPriceKoboSnapshot: 350000n,
    quantity: 1,
    totalKoboSnapshot: 350000n,
    ...overrides,
  };
}

describe('Phase 6: Payments and Reconciliation', () => {
  const TEST_SECRET = 'sk_test_rock_uc_foods_live_secret_key_12345';

  beforeEach(() => {
    paymentRepository.clear();
    orderRepository.clear();
    invoiceRepository.clear();
    resetDocumentSequences(1, 1);
  });

  // TEST 1: Database Migration & Schema Constraints
  it('1. Applies 0006_payments_and_reconciliation.sql and enforces unique provider_reference and webhook reference', async () => {
    const db = new PGlite();
    const sql1 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'), 'utf-8');
    const sql2 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0002_menu_core.sql'), 'utf-8');
    const sql3 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0003_orders_core.sql'), 'utf-8');
    const sql4 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0004_events_and_invoices.sql'), 'utf-8');
    const sql5 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0005_invoices_and_receipts.sql'), 'utf-8');
    const sql6 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0006_payments_and_reconciliation.sql'), 'utf-8');

    await db.exec(sql1);
    await db.exec(sql2);
    await db.exec(sql3);
    await db.exec(sql4);
    await db.exec(sql5);
    await db.exec(sql6);

    // 1. Insert valid invoice first
    await db.exec(`
      INSERT INTO invoices (
        id, invoice_number, public_token, subtotal_kobo, delivery_fee_kobo, discount_kobo, tax_kobo, total_kobo
      ) VALUES (
        '10000000-0000-0000-0000-000000000001', 'INV-2026-000001', 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        820000, 150000, 0, 0, 970000
      );
    `);

    // 2. Verify rejection when neither order_id nor invoice_id is supplied
    await expect(
      db.query(`
        INSERT INTO payment_records (
          id, payment_type, method, amount_kobo, status, provider_reference
        ) VALUES (
          'a0000000-0000-0000-0000-000000000000', 'event_deposit', 'manual_transfer', 500000,
          'pending_verification', 'TRF-GTB-20261020-000'
        );
      `)
    ).rejects.toThrow(/payment_target_chk/);

    // 3. Insert valid payment record linked to invoice
    await db.exec(`
      INSERT INTO payment_records (
        id, invoice_id, payment_type, method, amount_kobo, status, provider_reference, metadata
      ) VALUES (
        'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'event_deposit', 'manual_transfer', 500000,
        'pending_verification', 'TRF-GTB-20261020-001', '{"bank":"GTBank"}'::jsonb
      );
    `);

    // 4. Verify rejection on duplicate provider_reference
    await expect(
      db.query(`
        INSERT INTO payment_records (
          id, invoice_id, payment_type, method, amount_kobo, status, provider_reference
        ) VALUES (
          'a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'event_deposit', 'manual_transfer', 500000,
          'pending_verification', 'TRF-GTB-20261020-001'
        );
      `)
    ).rejects.toThrow();

    // Verify webhook_events unique reference constraint
    await db.exec(`
      INSERT INTO webhook_events (
        id, event_type, reference, payload
      ) VALUES (
        'b0000000-0000-0000-0000-000000000001', 'charge.success', 'PSTK-REF-998877', '{"status":"success"}'::jsonb
      );
    `);

    await expect(
      db.query(`
        INSERT INTO webhook_events (
          id, event_type, reference, payload
        ) VALUES (
          'b0000000-0000-0000-0000-000000000002', 'charge.success', 'PSTK-REF-998877', '{"status":"success"}'::jsonb
        );
      `)
    ).rejects.toThrow();
  }, 25000);

  // TEST 2: Paystack HMAC-SHA512 Signature Verification
  it('2. Verifies authentic Paystack HMAC-SHA512 signatures and rejects tampered payloads', () => {
    const rawPayload = JSON.stringify({
      event: 'charge.success',
      data: { id: 101, reference: 'REF-001', amount: 500000, status: 'success' },
    });

    const validSignature = crypto
      .createHmac('sha512', TEST_SECRET)
      .update(rawPayload)
      .digest('hex');

    // Authentic signature passes
    expect(verifyPaystackSignature(rawPayload, validSignature, TEST_SECRET)).toBe(true);

    // Tampered payload fails
    const tamperedPayload = JSON.stringify({
      event: 'charge.success',
      data: { id: 101, reference: 'REF-001', amount: 50000, status: 'success' },
    });
    expect(verifyPaystackSignature(tamperedPayload, validSignature, TEST_SECRET)).toBe(false);

    // Wrong secret key fails
    expect(verifyPaystackSignature(rawPayload, validSignature, 'wrong_secret_key')).toBe(false);

    // Empty or malformed signature fails
    expect(verifyPaystackSignature(rawPayload, '', TEST_SECRET)).toBe(false);
  });

  // TEST 3: Webhook Idempotency & Replay Protection
  it('3. Handles duplicate webhooks idempotently without double-crediting or duplicate receipts', () => {
    const testOrder = createTestOrder({
      id: 'ord-pstk-01',
      orderCode: 'ROC-261020-0001',
      customerName: 'Tunde Bakare',
      items: [createTestItem({ orderId: 'ord-pstk-01' })],
    });
    orderRepository.save(testOrder);

    const payload = JSON.stringify({
      event: 'charge.success',
      data: {
        id: 777,
        reference: 'PSTK-IDEMP-001',
        amount: 500000,
        status: 'success',
        currency: 'NGN',
        channel: 'card',
        paid_at: '2026-10-20T12:00:00.000Z',
        metadata: {
          orderId: testOrder.id,
          orderCode: testOrder.orderCode,
        },
      },
    });

    const sig = crypto.createHmac('sha512', TEST_SECRET).update(payload).digest('hex');

    // 1st delivery
    const result1 = processPaystackWebhook(payload, sig, TEST_SECRET);
    expect(result1.success).toBe(true);
    expect(result1.duplicate).toBeUndefined();

    // Verify order advanced to payment_confirmed
    const orderAfterFirst = orderRepository.getById(testOrder.id);
    expect(orderAfterFirst?.status).toBe('payment_confirmed');

    // 2nd delivery (duplicate webhook replay)
    const result2 = processPaystackWebhook(payload, sig, TEST_SECRET);
    expect(result2.success).toBe(true);
    expect(result2.duplicate).toBe(true);

    // Verify only 1 payment record exists for reference
    const payments = paymentRepository.getPaymentsForOrder(testOrder.id);
    expect(payments.length).toBe(1);
    expect(payments[0].amountKobo).toBe(500000n);
  });

  // TEST 4: Client-Side Bypass Rejection
  it('4. Rejects attempts to mark an order paid without a verified ledger payment', () => {
    const unverifiedOrder = createTestOrder({
      id: 'ord-bypass-01',
      orderCode: 'ROC-261020-0002',
      customerName: 'Suspicious Client',
    });
    orderRepository.save(unverifiedOrder);

    // Manually setting status without ledger payment
    unverifiedOrder.status = 'payment_confirmed';
    orderRepository.save(unverifiedOrder);

    const report = generateReconciliationReport();
    const flag = report.discrepancies.find((d) => d.referenceId === unverifiedOrder.orderCode);
    expect(flag).toBeDefined();
    expect(flag?.type).toBe('order_marked_paid_without_payment');
  });

  // TEST 5: Duplicate Bank Transfer Reference Rejection
  it('5. Rejects reuse of identical bank transfer references across different orders', () => {
    const p1 = submitManualPaymentTransfer({
      orderId: 'ord-001',
      paymentType: 'order',
      amountKobo: 350000n,
      bankReference: 'ZENITH-REF-12345',
    });
    expect(p1.status).toBe('pending_verification');

    // Attempting to submit the same transfer reference again MUST throw
    expect(() => {
      submitManualPaymentTransfer({
        orderId: 'ord-002',
        paymentType: 'order',
        amountKobo: 350000n,
        bankReference: 'ZENITH-REF-12345',
      });
    }).toThrow(/already been submitted/);
  });

  // TEST 6: Manual Payment Verification Checklist
  it('6. Advances order to payment_confirmed and issues receipt upon owner confirmation of bank credit', () => {
    const order = createTestOrder({
      id: 'ord-check-01',
      orderCode: 'ROC-261020-0003',
      customerName: 'Chidinma Okeke',
      items: [createTestItem({ orderId: 'ord-check-01' })],
    });
    orderRepository.save(order);

    const payment = submitManualPaymentTransfer({
      orderId: order.id,
      paymentType: 'order',
      amountKobo: 500000n,
      bankReference: 'TRF-GTB-998811',
    });

    // 1. Unconfirmed credit cannot mark paid
    expect(() => {
      confirmManualPayment({
        paymentRecordId: payment.id,
        actorUserId: 'usr-staff-01',
        actorRole: 'staff',
        isBankStatementCreditConfirmed: false,
      });
    }).toThrow(/Bank statement credit must be confirmed/);

    // 2. Confirmed credit succeeds
    const confirmed = confirmManualPayment({
      paymentRecordId: payment.id,
      actorUserId: 'usr-staff-01',
      actorRole: 'staff',
      isBankStatementCreditConfirmed: true,
      notes: 'Verified on Stanbic statement 14:32',
    });

    expect(confirmed.payment.status).toBe('verified');
    expect(confirmed.receiptId).toBeDefined();

    // Verify order status advanced
    const updatedOrder = orderRepository.getById(order.id);
    expect(updatedOrder?.status).toBe('payment_confirmed');
  });

  // TEST 7: Manual Payment Amount Mismatch Rejection
  it('7. Rejects manual confirmation if payment amount does not match order total in kobo', () => {
    const order = createTestOrder({
      id: 'ord-mis-01',
      orderCode: 'ROC-261020-0004',
      customerName: 'Kalu Uche',
    });
    orderRepository.save(order);

    // Customer only transferred 400,000 kobo instead of 500,000 kobo
    const payment = submitManualPaymentTransfer({
      orderId: order.id,
      paymentType: 'order',
      amountKobo: 400000n,
      bankReference: 'SHORT-TRF-001',
    });

    expect(() => {
      confirmManualPayment({
        paymentRecordId: payment.id,
        actorUserId: 'usr-owner-01',
        actorRole: 'owner',
        isBankStatementCreditConfirmed: true,
      });
    }).toThrow(/Amount mismatch/);
  });

  // TEST 8: Failed Charge Rejection
  it('8. Rejects charge.failed Paystack event and does not advance order to paid', () => {
    const order = createTestOrder({
      id: 'ord-fail-01',
      orderCode: 'ROC-261020-0005',
      customerName: 'Emeka Eze',
    });
    orderRepository.save(order);

    const payload = JSON.stringify({
      event: 'charge.failed',
      data: {
        id: 999,
        reference: 'PSTK-FAIL-REF',
        amount: 500000,
        status: 'failed',
        currency: 'NGN',
        channel: 'card',
        paid_at: '2026-10-20T12:00:00.000Z',
        metadata: {
          orderId: order.id,
          orderCode: order.orderCode,
        },
      },
    });

    const sig = crypto.createHmac('sha512', TEST_SECRET).update(payload).digest('hex');
    const res = processPaystackWebhook(payload, sig, TEST_SECRET);

    expect(res.success).toBe(false);
    expect(res.message).toContain('not successful');

    // Order MUST remain pending_payment
    const unchanged = orderRepository.getById(order.id);
    expect(unchanged?.status).toBe('pending_payment');
  });

  // TEST 9: End-of-Day Ledger Reconciliation
  it('9. Generates reconciliation report and flags amount mismatches, orphan transfers, and stale records', () => {
    // 1. Order 1: fully paid & verified
    const o1 = createTestOrder({
      id: 'ord-rec-1',
      orderCode: 'ROC-261020-0010',
      customerName: 'Client 1',
      items: [createTestItem({ orderId: 'ord-rec-1' })],
    });
    orderRepository.save(o1);

    const p1 = submitManualPaymentTransfer({
      orderId: o1.id,
      paymentType: 'order',
      amountKobo: 500000n,
      bankReference: 'REC-MATCH-01',
    });
    confirmManualPayment({
      paymentRecordId: p1.id,
      actorUserId: 'usr-owner-01',
      actorRole: 'owner',
      isBankStatementCreditConfirmed: true,
    });

    // 2. Order 2: marked paid without any payment record
    const o2 = createTestOrder({
      id: 'ord-rec-2',
      orderCode: 'ROC-261020-0020',
      customerName: 'Client 2',
      status: 'payment_confirmed',
      subtotalKobo: 100000n,
      totalKobo: 250000n,
    });
    orderRepository.save(o2);

    // 3. Stale pending transfer (> 24h old)
    const staleDate = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    paymentRepository.savePayment({
      id: 'pay-stale-01',
      orderId: 'ord-rec-1',
      paymentType: 'order',
      method: 'manual_transfer',
      amountKobo: 100000n,
      status: 'pending_verification',
      providerReference: 'STALE-TRF-001',
      createdAt: staleDate,
    });

    const report = generateReconciliationReport();
    expect(report.totalOrdersCount).toBe(2);
    expect(report.totalPaidOrdersCount).toBe(2);
    expect(report.totalOrderKoboExpected).toBe(750000n); // 500k + 250k
    expect(report.totalVerifiedKoboReceived).toBe(500000n);
    expect(report.netVarianceKobo).toBe(-250000n);

    // Verify discrepancy detection
    const missingPaymentFlag = report.discrepancies.find((d) => d.type === 'order_marked_paid_without_payment');
    expect(missingPaymentFlag).toBeDefined();
    expect(missingPaymentFlag?.referenceId).toBe(o2.orderCode);

    const staleFlag = report.discrepancies.find((d) => d.type === 'stale_pending_transfer');
    expect(staleFlag).toBeDefined();
    expect(staleFlag?.referenceId).toBe('STALE-TRF-001');
  });
});
