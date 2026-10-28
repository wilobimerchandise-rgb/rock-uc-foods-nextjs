/**
 * ROCK UC FOODS - Paystack Webhook & Idempotency Tests
 * Playbook v4 Section 21
 */

import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  verifyPaystackSignature,
  processPaystackWebhook,
  paymentRepository,
} from '../src/payment/paymentEngine';
import { orderRepository } from '../src/order/orderRepository';
import { Order } from '../src/types/order';

const TEST_SECRET = 'pstk_test_secret_key_rockucfoods_998877';

function signPayload(body: string, secret: string = TEST_SECRET): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

describe('Playbook Section 21: Paystack Webhook & Cryptographic Verification', () => {
  const sampleOrder: Order = {
    id: 'ord-test-wh-01',
    orderCode: 'ROC-20261028-TEST',
    trackingToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    customerName: 'Chidiebere Okonkwo',
    customerPhone: '08033729125',
    deliveryType: 'delivery',
    deliveryAddress: 'Victoria Island, Lagos',
    status: 'pending_payment',
    policyVersion: 'v4.0',
    policyAcceptedAt: new Date().toISOString(),
    items: [
      {
        id: 'item-wh-01',
        orderId: 'ord-test-wh-01',
        menuItemId: 'dish-jollof-01',
        nameSnapshot: 'Signature Luxury Jollof Rice',
        portionSnapshot: 'Serves 1',
        unitPriceKoboSnapshot: 350000n,
        quantity: 1,
        totalKoboSnapshot: 350000n,
      },
    ],
    subtotalKobo: 350000n,
    deliveryFeeKobo: 100000n,
    totalKobo: 450000n, // ₦4,500.00
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    paymentRepository.clear();
    orderRepository.clear();
    orderRepository.save(sampleOrder);
  });

  describe('1. HMAC-SHA512 Signature Verification', () => {
    it('accepts valid cryptographic HMAC signature', () => {
      const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-01' } });
      const validSig = signPayload(rawBody);

      expect(verifyPaystackSignature(rawBody, validSig, TEST_SECRET)).toBe(true);
    });

    it('rejects invalid signature string', () => {
      const rawBody = JSON.stringify({ event: 'charge.success', data: { reference: 'ref-01' } });
      const fakeSig = 'a'.repeat(128);

      expect(verifyPaystackSignature(rawBody, fakeSig, TEST_SECRET)).toBe(false);
    });

    it('rejects missing or empty signature', () => {
      const rawBody = JSON.stringify({ event: 'charge.success' });
      expect(verifyPaystackSignature(rawBody, '', TEST_SECRET)).toBe(false);
    });

    it('rejects tampered raw body even with authentic original signature', () => {
      const originalBody = JSON.stringify({ event: 'charge.success', amount: 450000 });
      const sig = signPayload(originalBody);

      const tamperedBody = JSON.stringify({ event: 'charge.success', amount: 50000 });
      expect(verifyPaystackSignature(tamperedBody, sig, TEST_SECRET)).toBe(false);
    });
  });

  describe('2. Idempotency & Replay Protection', () => {
    it('successfully processes valid charge.success and advances order to payment_confirmed', () => {
      const payload = {
        event: 'charge.success',
        data: {
          id: 1234567,
          reference: 'PSTK-REF-VALID-01',
          amount: 450000, // 450,000 kobo (matches order total)
          status: 'success',
          channel: 'card',
          currency: 'NGN',
          paid_at: new Date().toISOString(),
          metadata: {
            orderId: sampleOrder.id,
            paymentType: 'order',
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody);

      const result = processPaystackWebhook(rawBody, signature, TEST_SECRET);
      expect(result.success).toBe(true);
      expect(result.duplicate).toBeUndefined();

      // Check order status advanced
      const updatedOrder = orderRepository.getById(sampleOrder.id);
      expect(updatedOrder?.status).toBe('payment_confirmed');
    });

    it('returns success immediately without double-crediting on duplicate webhook delivery', () => {
      const payload = {
        event: 'charge.success',
        data: {
          id: 999888,
          reference: 'PSTK-REF-IDEMPOTENT-01',
          amount: 450000,
          status: 'success',
          channel: 'bank_transfer',
          currency: 'NGN',
          paid_at: new Date().toISOString(),
          metadata: {
            orderId: sampleOrder.id,
          },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody);

      // First delivery: processes
      const res1 = processPaystackWebhook(rawBody, signature, TEST_SECRET);
      expect(res1.success).toBe(true);
      expect(res1.duplicate).toBeUndefined();

      // Second identical delivery: idempotent skip
      const res2 = processPaystackWebhook(rawBody, signature, TEST_SECRET);
      expect(res2.success).toBe(true);
      expect(res2.duplicate).toBe(true);
      expect(res2.message).toContain('already processed');

      // Verify only 1 payment record exists in repository
      const payments = paymentRepository.getPaymentsForOrder(sampleOrder.id);
      expect(payments.length).toBe(1);
    });

    it('rejects failed charge event without confirming order', () => {
      const payload = {
        event: 'charge.failed',
        data: {
          reference: 'PSTK-REF-FAILED-01',
          status: 'failed',
          amount: 450000,
          metadata: { orderId: sampleOrder.id },
        },
      };

      const rawBody = JSON.stringify(payload);
      const signature = signPayload(rawBody);

      const res = processPaystackWebhook(rawBody, signature, TEST_SECRET);
      expect(res.success).toBe(false);

      // Order must remain pending_payment
      const order = orderRepository.getById(sampleOrder.id);
      expect(order?.status).toBe('pending_payment');
    });
  });
});
