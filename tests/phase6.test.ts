/**
 * ROCK UC FOODS - Phase 6 Verification Test Suite
 * Payments and Reconciliation (Manual GTBank Transfer Flow, Zero Paystack)
 *
 * Validates:
 * 1. Real PostgreSQL PGlite migrations (0006 + 0022) & unique reference / receipt_sha256 constraints
 * 2. Client-side bypass rejection (paid status without verified ledger record flagged)
 * 3. Rejection of duplicate bank transfer references across orders
 * 4. Manual payment verification checklist (admin role, bank credit confirmed, receipt generated)
 * 5. Manual payment amount mismatch & partial payment enforcement in integer kobo
 * 6. End-of-day financial ledger reconciliation & discrepancy detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

import {
  paymentRepository,
  submitManualPaymentTransfer,
  confirmManualPayment,
  confirmOrderBankTransfer,
  recordPartialOrderPayment,
  generateReconciliationReport,
} from '../src/payment/paymentEngine';
import { orderRepository } from '../src/order/orderRepository';
import { invoiceRepository, resetDocumentSequences } from '../src/catering/invoiceEngine';
import { Order, OrderItemSnapshot } from '../src/types/order';
import { resetBusinessSettings } from '../src/lib/businessSettings';

function createTestOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-test-01',
    orderCode: 'RUC-20261020-A1B2',
    paymentReference: 'RUC-9K4M2P',
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
    expiresAt: new Date(Date.now() + 7 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    ...overrides,
  } as Order;
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

describe('Phase 6: Manual GTBank Payments & Reconciliation', () => {
  beforeEach(() => {
    resetBusinessSettings();
    paymentRepository.clear();
    orderRepository.clear();
    invoiceRepository.clear();
    resetDocumentSequences(1, 1);
  });

  // TEST 1: Real PostgreSQL Migration & Schema Constraints
  it('1. Applies 0006 & 0022 migrations and enforces unique provider_reference and GTBank 10-digit settings', async () => {
    const db = new PGlite();
    await db.exec(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
      END $$;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$ LANGUAGE sql;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb AS $$ SELECT jsonb_build_object('role', 'owner', 'sub', '00000000-0000-0000-0000-000000000001') $$ LANGUAGE sql;
    `);

    const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await db.exec(sql);
    }

    // 1. Verify GTBank default record & exact 10-digit account string with leading zeros
    const bankRes = await db.query<{ value: { bankName: string; accountName: string; accountNumber: string } }>(
      `SELECT value FROM business_settings WHERE key = 'bank_transfer_details';`
    );
    expect(bankRes.rows[0].value.bankName).toBe('Guaranty Trust Bank (GTBank)');
    expect(bankRes.rows[0].value.accountName).toBe('Esther Kwentua');
    expect(bankRes.rows[0].value.accountNumber).toBe('0013190627');

    // 2. Verify invalid account number (< 10 digits) fails DB check constraint
    await expect(
      db.query(`
        UPDATE business_settings
        SET value = '{"bankName":"GTBank","accountName":"Esther Kwentua","accountNumber":"12345"}'::jsonb
        WHERE key = 'bank_transfer_details';
      `)
    ).rejects.toThrow();

    // 3. Insert valid invoice & enforce payment_target_chk + unique provider_reference
    await db.exec(`
      INSERT INTO invoices (
        id, public_ref, lines, total_kobo, deposit_kobo, balance_kobo, access_token_hash
      ) VALUES (
        '10000000-0000-0000-0000-000000000001', 'EVT-20261020-A2B3', '[]'::jsonb,
        970000, 679000, 291000, 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
      );
    `);

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

    await db.exec(`
      INSERT INTO payment_records (
        id, invoice_id, payment_type, method, amount_kobo, status, provider_reference, metadata
      ) VALUES (
        'a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'event_deposit', 'manual_transfer', 500000,
        'pending_verification', 'TRF-GTB-20261020-001', '{"bank":"GTBank"}'::jsonb
      );
    `);

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
  }, 30000);

  // TEST 2: Client-Side Bypass Rejection
  it('2. Flags orders marked paid without a verified ledger payment', () => {
    const unverifiedOrder = createTestOrder({
      id: 'ord-bypass-01',
      orderCode: 'RUC-20261020-B2B2',
      customerName: 'Suspicious Client',
    });
    unverifiedOrder.status = 'paid';
    orderRepository.save(unverifiedOrder);

    const report = generateReconciliationReport();
    const flag = report.discrepancies.find((d) => d.referenceId === unverifiedOrder.orderCode);
    expect(flag).toBeDefined();
    expect(flag?.type).toBe('order_marked_paid_without_payment');
  });

  // TEST 3: Duplicate Bank Transfer Reference Rejection
  it('3. Rejects reuse of identical bank transfer references across different orders', () => {
    const p1 = submitManualPaymentTransfer({
      orderId: 'ord-001',
      paymentType: 'order',
      amountKobo: 350000n,
      bankReference: 'GTB-REF-12345',
    });
    expect(p1.status).toBe('pending_verification');

    expect(() => {
      submitManualPaymentTransfer({
        orderId: 'ord-002',
        paymentType: 'order',
        amountKobo: 350000n,
        bankReference: 'GTB-REF-12345',
      });
    }).toThrow(/already been submitted/);
  });

  // TEST 4: Admin Manual Verification Checklist
  it('4. Advances order to paid and issues receipt upon admin confirmation of GTBank credit', () => {
    const order = createTestOrder({
      id: 'ord-check-01',
      orderCode: 'RUC-20261020-C3C3',
      paymentReference: 'RUC-X7Y8Z9',
      customerName: 'Chidinma Okeke',
      items: [createTestItem({ orderId: 'ord-check-01' })],
    });
    orderRepository.save(order);

    expect(() =>
      confirmOrderBankTransfer({
        orderId: order.id,
        paymentReference: 'RUC-X7Y8Z9',
        amountReceivedKobo: 500000n,
        isBankAppCreditConfirmed: false,
        actorUserId: 'usr-owner-verified',
        actorRole: 'owner',
      })
    ).toThrow(/Check GTBank app credit/);

    const confirmed = confirmOrderBankTransfer({
      orderId: order.id,
      paymentReference: 'RUC-X7Y8Z9',
      amountReceivedKobo: 500000n,
      isBankAppCreditConfirmed: true,
      actorUserId: 'usr-owner-verified',
      actorRole: 'owner',
      actorName: 'Chef Esther Kwentua',
    });

    expect(confirmed.payment.status).toBe('verified');
    expect(confirmed.receiptId).toBeDefined();

    const updatedOrder = orderRepository.getById(order.id);
    expect(updatedOrder?.status).toBe('paid');
    expect(updatedOrder?.paidAmountKobo).toBe(500000n);
  });

  // TEST 5: Partial & Amount Mismatch Enforcement
  it('5. Rejects confirmation when amount != order total and records partial strictly as partial', () => {
    const order = createTestOrder({
      id: 'ord-mis-01',
      orderCode: 'RUC-20261020-M4M4',
      paymentReference: 'RUC-PART01',
      customerName: 'Kalu Uche',
      totalKobo: 500000n,
    });
    orderRepository.save(order);

    expect(() =>
      confirmOrderBankTransfer({
        orderId: order.id,
        paymentReference: 'RUC-PART01',
        amountReceivedKobo: 300000n,
        isBankAppCreditConfirmed: true,
        actorUserId: 'usr-owner-verified',
        actorRole: 'owner',
      })
    ).toThrow(/partial/i);

    const partial = recordPartialOrderPayment({
      orderId: order.id,
      paymentReference: 'RUC-PART01-1',
      amountReceivedKobo: 300000n,
      isBankAppCreditConfirmed: true,
      actorUserId: 'usr-owner-verified',
      actorRole: 'owner',
    });

    expect(partial.order.status).toBe('partial');
    expect(partial.order.paidAmountKobo).toBe(300000n);
  });

  // TEST 6: End-of-Day Ledger Reconciliation
  it('6. Generates reconciliation report in exact BigInt kobo and flags discrepancies', () => {
    const o1 = createTestOrder({
      id: 'ord-rec-1',
      orderCode: 'RUC-20261020-R1R1',
      paymentReference: 'RUC-REC001',
      customerName: 'Client 1',
      items: [createTestItem({ orderId: 'ord-rec-1' })],
    });
    orderRepository.save(o1);

    const p1 = submitManualPaymentTransfer({
      orderId: o1.id,
      paymentType: 'order',
      amountKobo: 500000n,
      bankReference: 'RUC-REC001',
    });
    confirmManualPayment({
      paymentRecordId: p1.id,
      actorUserId: 'usr-owner-01',
      actorRole: 'owner',
      isBankStatementCreditConfirmed: true,
    });

    const o2 = createTestOrder({
      id: 'ord-rec-2',
      orderCode: 'RUC-20261020-R2R2',
      customerName: 'Client 2',
      status: 'paid',
      subtotalKobo: 100000n,
      totalKobo: 250000n,
    });
    orderRepository.save(o2);

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
    expect(report.totalOrderKoboExpected).toBe(750000n);
    expect(report.totalVerifiedKoboReceived).toBe(500000n);
    expect(report.netVarianceKobo).toBe(-250000n);

    const missingPaymentFlag = report.discrepancies.find(
      (d) => d.type === 'order_marked_paid_without_payment'
    );
    expect(missingPaymentFlag?.referenceId).toBe(o2.orderCode);

    const staleFlag = report.discrepancies.find((d) => d.type === 'stale_pending_transfer');
    expect(staleFlag?.referenceId).toBe('STALE-TRF-001');
  });
});
