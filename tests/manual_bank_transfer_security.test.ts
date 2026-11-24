/**
 * ROCK UC FOODS - Step 5: Manual Nigerian Bank Transfer Security & Money Test Suite
 *
 * Independent hand-computed expectations (NEVER derived from code under test):
 *  - item-t001 (Smoked Jollof) 350000 kobo + opt-t001-fish (Catfish) 250000 kobo = 600000 kobo/unit
 *  - Qty 2 of item-t001+fish = 2 * 600000 = 1200000 kobo
 *  - item-t004 size tier M (Zobo) = 250000 kobo
 *  - Lagos Zone 1 Ikeja delivery = 250000 kobo
 *  - Hand-computed expected total = 1200000 + 250000 + 250000 = 1700000 kobo (₦17,000.00)
 *
 * Covers ALL 10 mandated checks + rate limits + zero payment env var boot:
 *  1. Duplicate payment reference rejected (both proof & confirm)
 *  2. Duplicate receipt image SHA-256 hash rejected across different orders (+ spoofed MIME/magic bytes/size > 5MB)
 *  3. Expired order (> 7 hours) cannot be confirmed without audited admin reopen
 *  4. Wrong owner / missing token blocked (no IDOR on orders list, single view, proof submit)
 *  5. Client amount / discount tampering rejected (server recalculates hand-verified bigint kobo)
 *  6. Missing bank details blocks checkout with "Payment details unavailable, contact us on 08033729125"
 *  7. Partial payment cannot mark paid (strictly stored as 'partial')
 *  8. Double confirm blocked on already-paid order
 *  9. Non-admin / unauthenticated confirm attempt blocked (401/403)
 * 10. Non-10-digit or numeric account numbers rejected; "0013190627" preserved as string with leading zeros
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

import {
  BANK_NAME,
  ACCOUNT_NAME,
  ACCOUNT_NUMBER,
  MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
  validateBankAccountNumber,
  getBusinessBankSettings,
  setBusinessBankSettings,
  resetBusinessSettings,
} from '../src/lib/businessSettings';
import { orderRepository } from '../src/order/orderRepository';
import {
  paymentRepository,
  submitOrderPaymentProof,
  confirmOrderBankTransfer,
  recordPartialOrderPayment,
  reopenExpiredOrder,
} from '../src/payment/paymentEngine';
import { POLICY_VERSION } from '../src/policy/content';
import { globalAuthService, INITIAL_ACCOUNTS } from '../src/auth/wiring';
import { AuthorizationError, UserProfile } from '../src/lib/auth/access';
import { clearAuditLog, getAuditEvents } from '../src/lib/audit';
import { resetRateLimitStore } from '../src/lib/rate-limit';
import { invoiceRepository, resetDocumentSequences } from '../src/catering/invoiceEngine';

import { POST as postOrdersApi, GET as getOrdersApi } from '../app/api/orders/route';
import { GET as getSingleOrderApi } from '../app/api/orders/[code]/route';
import { POST as postOrderProofApi } from '../app/api/orders/[code]/proof/route';
import { POST as postAdminConfirmApi } from '../app/api/admin/orders/confirm/route';
import { GET as getBankDetailsApi } from '../app/api/ops/bank-details/route';

const ownerVerified: UserProfile = {
  id: 'usr-owner-verified',
  role: 'owner',
  isActive: true,
  fullName: 'Chef Esther Kwentua (Verified MFA)',
  email: 'estherkwentua@gmail.com',
  hasMfaVerified: true,
};

const FAKE_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

const FAKE_JPG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

async function createSampleOrderViaApi(overrides: Record<string, unknown> = {}) {
  const req = new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Tunde Balogun',
      customerPhone: '08033729125',
      deliveryType: 'delivery',
      deliveryZoneId: 'zone-1-ikeja',
      deliveryAddress: '24 Allen Avenue, Ikeja, Lagos',
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
      items: [
        { menuItemId: 'item-t001', quantity: 2, selectedOptionIds: ['opt-t001-fish'] },
        { menuItemId: 'item-t004', quantity: 1, selectedTierId: 'tier-t004-m' },
      ],
      ...overrides,
    }),
  });
  const res = await postOrdersApi(req);
  const body = await res.json();
  return { res, body };
}

describe('Step 5: Manual Nigerian Bank Transfer Security & Money Verification', () => {
  beforeEach(() => {
    resetBusinessSettings();
    globalAuthService.reset(INITIAL_ACCOUNTS);
    orderRepository.clear();
    paymentRepository.clear();
    invoiceRepository.clear();
    resetDocumentSequences(1, 1);
    clearAuditLog();
    resetRateLimitStore();
  });

  afterEach(() => {
    resetBusinessSettings();
    globalAuthService.reset(INITIAL_ACCOUNTS);
    resetRateLimitStore();
  });

  it('0. Operates with zero payment environment variables and exact GTBank settings record', async () => {
    expect(process.env.ENABLE_PAYSTACK).toBeUndefined();
    expect(process.env.PAYSTACK_SECRET_KEY).toBeUndefined();
    expect(process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY).toBeUndefined();
    expect(process.env.KILL_SWITCH_INVOICE_REQUESTS).toBeUndefined();
    expect(process.env.KILL_SWITCH_WHATSAPP_SEND).toBeUndefined();

    expect(BANK_NAME).toBe('Guaranty Trust Bank (GTBank)');
    expect(ACCOUNT_NAME).toBe('Esther Kwentua');
    expect(ACCOUNT_NUMBER).toBe('0013190627');
    expect(typeof ACCOUNT_NUMBER).toBe('string');

    const res = await getBankDetailsApi();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.configured).toBe(true);
    expect(json.bankDetails.bankName).toBe('Guaranty Trust Bank (GTBank)');
    expect(json.bankDetails.accountName).toBe('Esther Kwentua');
    expect(json.bankDetails.accountNumber).toBe('0013190627');
  });

  it('1. Rejects account numbers that are numeric or not exactly 10 digits, preserving leading zeros', () => {
    // Valid 10-digit string preserves "00"
    expect(validateBankAccountNumber('0013190627')).toBe('0013190627');
    const saved = getBusinessBankSettings();
    expect(saved?.accountNumber).toBe('0013190627');
    expect(typeof saved?.accountNumber).toBe('string');

    // Numeric input rejected (would drop leading zeros -> 13190627)
    expect(() => validateBankAccountNumber(13190627)).toThrow(/10-digit string/);
    expect(() => validateBankAccountNumber('123456789')).toThrow(/10 digits/);
    expect(() => validateBankAccountNumber('00131906279')).toThrow(/10 digits/);
    expect(() => validateBankAccountNumber('001319062A')).toThrow(/10 digits/);

    expect(() =>
      setBusinessBankSettings(
        {
          bankName: BANK_NAME,
          accountName: ACCOUNT_NAME,
          accountNumber: '001319',
          verifiedByOwner: true,
        },
        ownerVerified
      )
    ).toThrow(/10 digits/);
  });

  it('2. Blocks checkout with exact fallback copy when bank details are missing or cleared', async () => {
    setBusinessBankSettings(null, ownerVerified);

    const bankRes = await getBankDetailsApi();
    const bankJson = await bankRes.json();
    expect(bankJson.configured).toBe(false);
    expect(bankJson.message).toBe('Payment details unavailable, contact us on 08033729125');

    const { res, body } = await createSampleOrderViaApi();
    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toBe(MISSING_BANK_DETAILS_CHECKOUT_MESSAGE);
  });

  it('3. Ignores client amount / discount tampering and recomputes exact hand-verified integer kobo on server', async () => {
    const { res, body } = await createSampleOrderViaApi({
      id: 'ord-forged-123',
      orderCode: 'RUC-FORGED-0001',
      paymentReference: 'RUC-CUSTOM',
      totalKobo: '100',
      subtotalKobo: '100',
      discountKobo: '1600000',
      deliveryFeeKobo: '0',
      status: 'paid',
    });

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    // Hand-computed expected values:
    // Food subtotal: (350,000 + 250,000) * 2 + 250,000 = 1,450,000 kobo
    // Delivery Zone 1 Ikeja: 250,000 kobo
    // Grand Total: 1,700,000 kobo
    expect(body.order.subtotalKobo).toBe('1450000');
    expect(body.order.deliveryFeeKobo).toBe('250000');
    expect(body.order.totalKobo).toBe('1700000');
    expect(body.order.status).toBe('pending_payment');
    expect(body.order.id).not.toBe('ord-forged-123');
    expect(body.order.paymentReference).toMatch(/^RUC-[A-Z0-9]{6}$/);
    expect(body.order.paymentReference).not.toBe('RUC-CUSTOM');

    // Never drops to sequential IDs across 2 orders
    const second = await createSampleOrderViaApi();
    expect(second.body.order.paymentReference).not.toBe(body.order.paymentReference);
  });

  it('4. Prevents IDOR: wrong owner, missing token, or unauthenticated list attempt returns 401/403', async () => {
    const { body } = await createSampleOrderViaApi();
    const orderCode = body.orderCode;
    const validToken = body.trackingToken;

    // Unauthenticated listing of all orders is blocked (401)
    const unauthList = await getOrdersApi(new NextRequest('http://localhost:3000/api/orders'));
    expect(unauthList.status).toBe(401);

    // Viewing order with no token or cookie -> 401
    const noTokenRes = await getSingleOrderApi(
      new NextRequest(`http://localhost:3000/api/orders/${orderCode}`),
      { params: Promise.resolve({ code: orderCode }) }
    );
    expect(noTokenRes.status).toBe(401);

    // Viewing with another user's/wrong token -> 403
    const wrongTokenRes = await getSingleOrderApi(
      new NextRequest(`http://localhost:3000/api/orders/${orderCode}?token=deadbeef0000deadbeef0000deadbeef`),
      { params: Promise.resolve({ code: orderCode }) }
    );
    expect(wrongTokenRes.status).toBe(403);

    // Submitting proof with wrong token -> 403
    const wrongProofRes = await postOrderProofApi(
      new NextRequest(`http://localhost:3000/api/orders/${orderCode}/proof?token=wrongtoken1234`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: 'Attacker',
          transferTime: new Date().toISOString(),
        }),
      }),
      { params: Promise.resolve({ code: orderCode }) }
    );
    expect(wrongProofRes.status).toBe(403);

    // Valid token succeeds (200)
    const validRes = await getSingleOrderApi(
      new NextRequest(`http://localhost:3000/api/orders/${orderCode}?token=${validToken}`),
      { params: Promise.resolve({ code: orderCode }) }
    );
    expect(validRes.status).toBe(200);
  });

  it('5. Rejects duplicate payment references and duplicate receipt SHA-256 hashes across orders', async () => {
    const order1 = await createSampleOrderViaApi();
    const order2 = await createSampleOrderViaApi();

    const proof1 = submitOrderPaymentProof({
      orderId: order1.body.order.id,
      senderName: 'Tunde Balogun',
      transferTime: new Date().toISOString(),
      paymentReference: order1.body.paymentReference,
      receiptFile: {
        fileName: 'gtb-receipt.png',
        mimeType: 'image/png',
        sizeBytes: FAKE_PNG_BYTES.byteLength,
        buffer: FAKE_PNG_BYTES,
      },
      visitorIpHash: 'visitor-hash-1',
    });
    expect(proof1.order.status).toBe('proof_submitted');

    // Attempt to reuse order1's paymentReference on order2
    expect(() =>
      submitOrderPaymentProof({
        orderId: order2.body.order.id,
        senderName: 'Impostor',
        transferTime: new Date().toISOString(),
        paymentReference: order1.body.paymentReference,
        visitorIpHash: 'visitor-hash-2',
      })
    ).toThrow(/Duplicate reference/);

    // Attempt to reuse identical receipt PNG image hash on order2 (with its own reference)
    expect(() =>
      submitOrderPaymentProof({
        orderId: order2.body.order.id,
        senderName: 'Impostor Same Receipt',
        transferTime: new Date().toISOString(),
        paymentReference: order2.body.paymentReference,
        receiptFile: {
          fileName: 'renamed-copy.png',
          mimeType: 'image/png',
          sizeBytes: FAKE_PNG_BYTES.byteLength,
          buffer: FAKE_PNG_BYTES,
        },
        visitorIpHash: 'visitor-hash-2',
      })
    ).toThrow(/Duplicate proof/);

    // Spoofed file type (claiming image/jpeg while bytes are PNG) & > 5 MB file rejected
    expect(() =>
      submitOrderPaymentProof({
        orderId: order2.body.order.id,
        senderName: 'Spoofed MIME',
        transferTime: new Date().toISOString(),
        paymentReference: order2.body.paymentReference,
        receiptFile: {
          fileName: 'fake.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: FAKE_PNG_BYTES.byteLength,
          buffer: FAKE_PNG_BYTES,
        },
        visitorIpHash: 'visitor-hash-3',
      })
    ).toThrow(/signature/);

    expect(() =>
      submitOrderPaymentProof({
        orderId: order2.body.order.id,
        senderName: 'Too Large',
        transferTime: new Date().toISOString(),
        paymentReference: order2.body.paymentReference,
        receiptFile: {
          fileName: 'huge.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 6 * 1024 * 1024,
          buffer: FAKE_JPG_BYTES,
        },
        visitorIpHash: 'visitor-hash-4',
      })
    ).toThrow(/5 MB/);
  });

  it('6. Expires unpaid orders after 7 hours and requires explicit logged admin reopen before confirm', () => {
    const orderRes = createSampleOrderViaApi();
    return orderRes.then(({ body }) => {
      const ordId = body.order.id;
      const ordRef = body.paymentReference;
      const eightHoursLater = Date.now() + 8 * 60 * 60 * 1000;

      // Attempting confirmation 8 hours later fails (order expired at 7h)
      expect(() =>
        confirmOrderBankTransfer({
          orderId: ordId,
          paymentReference: ordRef,
          amountReceivedKobo: 1700000n,
          isBankAppCreditConfirmed: true,
          actorUserId: 'usr-owner-verified',
          actorRole: 'owner',
          nowMs: eightHoursLater,
        })
      ).toThrow(/expired after 7 hours/);

      const expiredOrder = orderRepository.getById(ordId)!;
      expect(expiredOrder.status).toBe('expired');

      // Non-admin cannot reopen
      expect(() =>
        reopenExpiredOrder({
          orderId: ordId,
          actorUserId: 'cust-1',
          actorRole: 'customer',
          reason: 'Customer paid late',
          nowMs: eightHoursLater,
        })
      ).toThrow(AuthorizationError);

      // Admin explicitly reopens with reason (logged & audited)
      const reopened = reopenExpiredOrder({
        orderId: ordId,
        actorUserId: 'usr-owner-verified',
        actorRole: 'owner',
        actorName: 'Chef Esther Kwentua',
        reason: 'Customer transfer settled after bank downtime; verified in GTBank app',
        nowMs: eightHoursLater,
      });

      expect(reopened.status).toBe('pending_payment');
      expect(reopened.reopenedBy).toBe('usr-owner-verified');
      expect(reopened.reopenLogs?.length).toBe(1);

      const reopenAudit = getAuditEvents().find((e) => e.action === 'order.expired_reopened');
      expect(reopenAudit).toBeDefined();

      // Now confirmation succeeds cleanly
      const confirmed = confirmOrderBankTransfer({
        orderId: ordId,
        paymentReference: ordRef,
        amountReceivedKobo: 1700000n,
        isBankAppCreditConfirmed: true,
        actorUserId: 'usr-owner-verified',
        actorRole: 'owner',
        actorName: 'Chef Esther Kwentua',
        nowMs: eightHoursLater + 1000,
      });
      expect(confirmed.order.status).toBe('paid');
    });
  });

  it('7. Enforces partial payment rule, blocks double confirm, and blocks non-admin confirm attempts (401/403)', async () => {
    const { body } = await createSampleOrderViaApi();
    const orderId = body.order.id;
    const payRef = body.paymentReference;

    // Unauthenticated POST /api/admin/orders/confirm -> 401
    const unauthConfirm = await postAdminConfirmApi(
      new NextRequest('http://localhost:3000/api/admin/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
        body: JSON.stringify({
          action: 'confirm_paid',
          orderId,
          paymentReference: payRef,
          amountReceivedKobo: '1700000',
          isBankAppCreditConfirmed: true,
        }),
      })
    );
    expect(unauthConfirm.status).toBe(401);

    // Non-admin direct engine confirm -> AuthorizationError
    expect(() =>
      confirmOrderBankTransfer({
        orderId,
        paymentReference: payRef,
        amountReceivedKobo: 1700000n,
        isBankAppCreditConfirmed: true,
        actorUserId: 'attacker-cust-01',
        actorRole: 'customer',
      })
    ).toThrow(AuthorizationError);

    // Partial payment (1,000,000 kobo of 1,700,000 kobo) cannot confirm paid
    await globalAuthService.signInWithPassword({
      email: 'estherkwentua@gmail.com',
      password: 'EstherLuxury2026!',
    });

    const badConfirmPartial = await postAdminConfirmApi(
      new NextRequest('http://localhost:3000/api/admin/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
        body: JSON.stringify({
          action: 'confirm_paid',
          orderId,
          paymentReference: payRef,
          amountReceivedKobo: '1000000',
          isBankAppCreditConfirmed: true,
        }),
      })
    );
    expect(badConfirmPartial.status).toBe(409);

    // Recording as partial stores status = 'partial', NEVER 'paid'
    const partialRes = recordPartialOrderPayment({
      orderId,
      paymentReference: `${payRef}-PART1`,
      amountReceivedKobo: 1000000n,
      isBankAppCreditConfirmed: true,
      actorUserId: 'usr-owner-verified',
      actorRole: 'owner',
      actorName: 'Chef Esther Kwentua',
    });
    expect(partialRes.order.status).toBe('partial');
    expect(partialRes.order.paidAmountKobo).toBe(1000000n);

    // Confirm exact full amount (1,700,000 kobo) succeeds as logged-in admin
    const confirmOk = await postAdminConfirmApi(
      new NextRequest('http://localhost:3000/api/admin/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
        body: JSON.stringify({
          action: 'confirm_paid',
          orderId,
          paymentReference: payRef,
          amountReceivedNaira: '17000.00',
          isBankAppCreditConfirmed: true,
        }),
      })
    );
    expect(confirmOk.status).toBe(200);
    const confirmJson = await confirmOk.json();
    expect(confirmJson.order.status).toBe('paid');
    expect(confirmJson.order.paidAmountKobo).toBe('1700000');

    // Double confirm blocked (409)
    const doubleConfirm = await postAdminConfirmApi(
      new NextRequest('http://localhost:3000/api/admin/orders/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
        body: JSON.stringify({
          action: 'confirm_paid',
          orderId,
          paymentReference: payRef,
          amountReceivedKobo: '1700000',
          isBankAppCreditConfirmed: true,
        }),
      })
    );
    expect(doubleConfirm.status).toBe(409);
  });

  it('8. Rate limits proof uploads per order (5 / 10m) and per visitor (10 / 10m)', async () => {
    const order = await createSampleOrderViaApi();
    const orderCode = order.body.orderCode;
    const token = order.body.trackingToken;

    // 5 submissions pass on different transfer attempts on same order; 6th returns 429
    for (let i = 1; i <= 5; i++) {
      const res = await postOrderProofApi(
        new NextRequest(`http://localhost:3000/api/orders/${orderCode}/proof?token=${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '41.58.100.1',
          },
          body: JSON.stringify({
            senderName: `Sender Try ${i}`,
            transferTime: new Date().toISOString(),
            paymentReference: order.body.paymentReference,
          }),
        }),
        { params: Promise.resolve({ code: orderCode }) }
      );
      expect(res.status).toBe(200);
    }

    const sixthOrderAttempt = await postOrderProofApi(
      new NextRequest(`http://localhost:3000/api/orders/${orderCode}/proof?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '41.58.100.2',
        },
        body: JSON.stringify({
          senderName: 'Sender Try 6',
          transferTime: new Date().toISOString(),
          paymentReference: order.body.paymentReference,
        }),
      }),
      { params: Promise.resolve({ code: orderCode }) }
    );
    expect(sixthOrderAttempt.status).toBe(429);

    // Per-visitor limit across different orders (10 / 10m from same IP)
    for (let j = 0; j < 10; j++) {
      const ord = await createSampleOrderViaApi();
      const res = await postOrderProofApi(
        new NextRequest(
          `http://localhost:3000/api/orders/${ord.body.orderCode}/proof?token=${ord.body.trackingToken}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-forwarded-for': '102.89.45.77',
            },
            body: JSON.stringify({
              senderName: `Visitor Burst ${j}`,
              transferTime: new Date().toISOString(),
              paymentReference: ord.body.paymentReference,
            }),
          }
        ),
        { params: Promise.resolve({ code: ord.body.orderCode }) }
      );
      expect(res.status).toBe(200);
    }

    const extraVisitorOrd = await createSampleOrderViaApi();
    const blockedVisitorRes = await postOrderProofApi(
      new NextRequest(
        `http://localhost:3000/api/orders/${extraVisitorOrd.body.orderCode}/proof?token=${extraVisitorOrd.body.trackingToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '102.89.45.77',
          },
          body: JSON.stringify({
            senderName: 'Visitor Burst 11',
            transferTime: new Date().toISOString(),
            paymentReference: extraVisitorOrd.body.paymentReference,
          }),
        }
      ),
      { params: Promise.resolve({ code: extraVisitorOrd.body.orderCode }) }
    );
    expect(blockedVisitorRes.status).toBe(429);
  });

  it('9. Confirms Paystack route and env keys are completely deleted from repo', () => {
    expect(
      fs.existsSync(path.resolve(__dirname, '../app/api/webhooks/paystack/route.ts'))
    ).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '../tests/webhooks.test.tsx'))).toBe(false);
  });
});
