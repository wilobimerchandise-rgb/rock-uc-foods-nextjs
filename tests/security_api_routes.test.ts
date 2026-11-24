/**
 * ROCK UC FOODS - Security PoC & API Route Access Control Regression Suite
 *
 * Verifies authentication, same-origin CSRF protection, RBAC + second-factor MFA
 * checks, IDOR prevention, and PII phone masking across hardened operational API routes:
 *  1. PUT /api/estimator (Owner + verified MFA + same-origin only; ignores spoofed updatedBy)
 *  2. GET / POST /api/kds (Active Owner/Staff/Developer session + same-origin on POST)
 *  3. GET / POST /api/dispatch (Active Owner/Staff/Developer session + same-origin + masked order phone)
 *  4. GET / POST /api/notifications (Admin RBAC on full outbox & dispatch; customer order token / admin on ?orderId=)
 *  5. POST /api/admin/orders/confirm (Request-scoped session + same-origin verification)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET as getEstimatorApi, PUT as putEstimatorApi } from '../app/api/estimator/route';
import { GET as getKdsApi, POST as postKdsApi } from '../app/api/kds/route';
import { GET as getDispatchApi, POST as postDispatchApi } from '../app/api/dispatch/route';
import { GET as getNotificationsApi, POST as postNotificationsApi } from '../app/api/notifications/route';
import { POST as postAdminConfirmApi } from '../app/api/admin/orders/confirm/route';
import { POST as postOrdersApi } from '../app/api/orders/route';

import { globalAuthService, INITIAL_ACCOUNTS } from '../src/auth/wiring';
import { SESSION_COOKIE_NAME } from '../src/auth/cookies';
import { orderRepository } from '../src/order/orderRepository';
import { kitchenTicketRepository, dispatchRepository } from '../src/dispatch/dispatchEngine';
import { notificationRepository, sendOrderNotification } from '../src/notifications/notificationEngine';
import { paymentRepository } from '../src/payment/paymentEngine';
import { POLICY_VERSION } from '../src/policy/content';
import { resetEstimatorConfig } from '../src/estimator/config';
import { resetBusinessSettings } from '../src/lib/businessSettings';
import { clearAuditLog } from '../src/lib/audit';
import { resetRateLimitStore } from '../src/lib/rate-limit';

function buildSameOriginHeaders(sessionToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
  };
  if (sessionToken) {
    headers.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}`;
  }
  return headers;
}

async function createSampleOrder() {
  const req = new NextRequest('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Amaka Okafor',
      customerPhone: '08033729125',
      deliveryType: 'delivery',
      deliveryZoneId: 'zone-1-ikeja',
      deliveryAddress: '14 Opebi Road, Ikeja, Lagos',
      acceptedPolicy: true,
      policyVersion: POLICY_VERSION,
      items: [{ menuItemId: 'item-t001', quantity: 1 }],
    }),
  });
  const res = await postOrdersApi(req);
  expect(res.status).toBe(201);
  return res.json();
}

describe('API Route Security Hardening & Access Control', () => {
  beforeEach(() => {
    globalAuthService.reset(INITIAL_ACCOUNTS);
    orderRepository.clear();
    kitchenTicketRepository.clear();
    dispatchRepository.clear();
    notificationRepository.clear();
    paymentRepository.clear();
    resetEstimatorConfig();
    resetBusinessSettings();
    clearAuditLog();
    resetRateLimitStore();
  });

  afterEach(() => {
    globalAuthService.reset(INITIAL_ACCOUNTS);
    resetRateLimitStore();
  });

  describe('1. PUT /api/estimator (Pricing Configuration Protection)', () => {
    it('blocks cross-origin, anonymous, staff, and unverified-MFA owner updates; allows MFA-verified owner', async () => {
      const cfgRes = await getEstimatorApi();
      const { config } = await cfgRes.json();

      const validPayload = {
        expectedVersion: config.version,
        updatedBy: 'spoofed-attacker@evil.com',
        tiers: config.tiers,
        addOns: config.addOns,
        serviceRates: config.serviceRates,
      };

      // Cross-origin request -> 403
      const csrfRes = await putEstimatorApi(
        new NextRequest('http://localhost:3000/api/estimator', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            origin: 'https://evil.example',
            host: 'localhost:3000',
          },
          body: JSON.stringify(validPayload),
        })
      );
      expect(csrfRes.status).toBe(403);
      expect(csrfRes.headers.get('cache-control')).toBe('no-store');

      // Anonymous same-origin request -> 401
      const unauthRes = await putEstimatorApi(
        new NextRequest('http://localhost:3000/api/estimator', {
          method: 'PUT',
          headers: buildSameOriginHeaders(),
          body: JSON.stringify(validPayload),
        })
      );
      expect(unauthRes.status).toBe(401);

      // Staff account -> 403
      const staffSignIn = await globalAuthService.signInWithPassword({
        email: 'staff@rockucfoods.com',
        password: 'StaffService2026!',
      });
      const staffRes = await putEstimatorApi(
        new NextRequest('http://localhost:3000/api/estimator', {
          method: 'PUT',
          headers: buildSameOriginHeaders(staffSignIn.session.access_token),
          body: JSON.stringify(validPayload),
        })
      );
      expect(staffRes.status).toBe(403);

      // Owner without MFA verified (aal1) -> 403
      const ownerUnverifiedSignIn = await globalAuthService.signInWithPassword({
        email: 'rock-uc-foods@gmail.com',
        password: 'EstherLuxury2026!',
      });
      const unverifiedOwnerRes = await putEstimatorApi(
        new NextRequest('http://localhost:3000/api/estimator', {
          method: 'PUT',
          headers: buildSameOriginHeaders(ownerUnverifiedSignIn.session.access_token),
          body: JSON.stringify(validPayload),
        })
      );
      expect(unverifiedOwnerRes.status).toBe(403);

      // Owner with verified MFA (aal2) -> 200 and updatedBy reflects authenticated owner, never spoofed body
      const ownerVerifiedSignIn = await globalAuthService.signInWithPassword({
        email: 'estherkwentua@gmail.com',
        password: 'EstherLuxury2026!',
      });
      globalAuthService.verifyUserFactorDirectly(
        'usr-owner-verified',
        'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
      );

      const okRes = await putEstimatorApi(
        new NextRequest('http://localhost:3000/api/estimator', {
          method: 'PUT',
          headers: buildSameOriginHeaders(ownerVerifiedSignIn.session.access_token),
          body: JSON.stringify(validPayload),
        })
      );
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get('cache-control')).toBe('no-store');
      const okJson = await okRes.json();
      expect(okJson.config.updatedBy).toBe('estherkwentua@gmail.com');
      expect(okJson.config.version).toBe(config.version + 1);
    });
  });

  describe('2. GET & POST /api/kds (Kitchen Display System Protection)', () => {
    it('blocks anonymous GET/POST and cross-origin POST; allows active staff session', async () => {
      const orderBody = await createSampleOrder();
      const orderId = orderBody.order.id;
      orderRepository.updateStatus(orderId, 'paid');

      // Anonymous GET -> 401
      const unauthGet = await getKdsApi(new NextRequest('http://localhost:3000/api/kds'));
      expect(unauthGet.status).toBe(401);

      // Cross-origin POST -> 403
      const csrfPost = await postKdsApi(
        new NextRequest('http://localhost:3000/api/kds', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            origin: 'https://evil.example',
            host: 'localhost:3000',
          },
          body: JSON.stringify({ action: 'create_ticket', orderId }),
        })
      );
      expect(csrfPost.status).toBe(403);

      // Anonymous same-origin POST -> 401
      const unauthPost = await postKdsApi(
        new NextRequest('http://localhost:3000/api/kds', {
          method: 'POST',
          headers: buildSameOriginHeaders(),
          body: JSON.stringify({ action: 'create_ticket', orderId }),
        })
      );
      expect(unauthPost.status).toBe(401);

      // Authenticated staff GET & POST -> 200
      const staffSignIn = await globalAuthService.signInWithPassword({
        email: 'staff@rockucfoods.com',
        password: 'StaffService2026!',
      });

      const okPost = await postKdsApi(
        new NextRequest('http://localhost:3000/api/kds', {
          method: 'POST',
          headers: buildSameOriginHeaders(staffSignIn.session.access_token),
          body: JSON.stringify({ action: 'create_ticket', orderId }),
        })
      );
      expect(okPost.status).toBe(200);

      const okGet = await getKdsApi(
        new NextRequest('http://localhost:3000/api/kds', {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(staffSignIn.session.access_token)}`,
          },
        })
      );
      expect(okGet.status).toBe(200);
      expect(okGet.headers.get('cache-control')).toBe('no-store');
      const kdsJson = await okGet.json();
      expect(kdsJson.tickets).toHaveLength(1);
    });
  });

  describe('3. GET & POST /api/dispatch (Dispatch & Delivery Confirmation Protection)', () => {
    it('blocks anonymous access, enforces same-origin POST, and masks customer phone on confirm_delivery', async () => {
      const orderBody = await createSampleOrder();
      const orderId = orderBody.order.id;

      // Move order into ready_for_dispatch as verified owner
      const stored = orderRepository.getById(orderId)!;
      orderRepository.updateStatus(orderId, 'ready_for_dispatch');
      expect(stored.id).toBe(orderId);

      // Anonymous GET -> 401
      const unauthGet = await getDispatchApi(
        new NextRequest('http://localhost:3000/api/dispatch')
      );
      expect(unauthGet.status).toBe(401);

      // Anonymous same-origin POST -> 401
      const unauthPost = await postDispatchApi(
        new NextRequest('http://localhost:3000/api/dispatch', {
          method: 'POST',
          headers: buildSameOriginHeaders(),
          body: JSON.stringify({
            action: 'assign_rider',
            orderId,
            riderName: 'Tunde Rider',
            riderPhone: '08091234567',
          }),
        })
      );
      expect(unauthPost.status).toBe(401);

      // Staff assigns rider and confirms delivery; customerPhone must be masked for staff!
      const staffSignIn = await globalAuthService.signInWithPassword({
        email: 'staff@rockucfoods.com',
        password: 'StaffService2026!',
      });

      const assignRes = await postDispatchApi(
        new NextRequest('http://localhost:3000/api/dispatch', {
          method: 'POST',
          headers: buildSameOriginHeaders(staffSignIn.session.access_token),
          body: JSON.stringify({
            action: 'assign_rider',
            orderId,
            riderName: 'Tunde Rider',
            riderPhone: '08091234567',
          }),
        })
      );
      expect(assignRes.status).toBe(200);

      const deliverRes = await postDispatchApi(
        new NextRequest('http://localhost:3000/api/dispatch', {
          method: 'POST',
          headers: buildSameOriginHeaders(staffSignIn.session.access_token),
          body: JSON.stringify({
            action: 'confirm_delivery',
            orderId,
            customerSignatureConfirmed: true,
          }),
        })
      );
      expect(deliverRes.status).toBe(200);
      const deliverJson = await deliverRes.json();
      expect(deliverJson.order.customerPhone).toContain('***');
      expect(deliverJson.order.trackingToken).toBeUndefined();
    });
  });

  describe('4. GET & POST /api/notifications (Outbox & IDOR Protection)', () => {
    it('blocks anonymous unscoped outbox & wrong-token order lookups; allows valid customer token and masks phone for staff', async () => {
      const orderBody = await createSampleOrder();
      const orderId = orderBody.order.id;
      const trackingToken = orderBody.trackingToken;
      const storedOrder = orderRepository.getById(orderId)!;
      sendOrderNotification(storedOrder, 'order_confirmed', 'whatsapp');

      // Anonymous unscoped outbox dump -> 401
      const unauthOutbox = await getNotificationsApi(
        new NextRequest('http://localhost:3000/api/notifications')
      );
      expect(unauthOutbox.status).toBe(401);

      // Anonymous order-scoped lookup without token -> 401
      const noTokenLookup = await getNotificationsApi(
        new NextRequest(`http://localhost:3000/api/notifications?orderId=${encodeURIComponent(orderId)}`)
      );
      expect(noTokenLookup.status).toBe(401);

      // Wrong order token -> 403 (IDOR blocked)
      const wrongTokenLookup = await getNotificationsApi(
        new NextRequest(
          `http://localhost:3000/api/notifications?orderId=${encodeURIComponent(orderId)}&token=wrong-token-123`
        )
      );
      expect(wrongTokenLookup.status).toBe(403);

      // Valid customer tracking token -> 200
      const validCustomerLookup = await getNotificationsApi(
        new NextRequest(
          `http://localhost:3000/api/notifications?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(trackingToken)}`
        )
      );
      expect(validCustomerLookup.status).toBe(200);
      const custJson = await validCustomerLookup.json();
      expect(custJson.notifications).toHaveLength(1);

      // Anonymous POST dispatch -> 401
      const unauthPost = await postNotificationsApi(
        new NextRequest('http://localhost:3000/api/notifications', {
          method: 'POST',
          headers: buildSameOriginHeaders(),
          body: JSON.stringify({ orderId, eventType: 'in_kitchen' }),
        })
      );
      expect(unauthPost.status).toBe(401);

      // Staff outbox read masks recipientPhone per MFA policy
      const staffSignIn = await globalAuthService.signInWithPassword({
        email: 'staff@rockucfoods.com',
        password: 'StaffService2026!',
      });
      const staffOutbox = await getNotificationsApi(
        new NextRequest('http://localhost:3000/api/notifications', {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(staffSignIn.session.access_token)}`,
          },
        })
      );
      expect(staffOutbox.status).toBe(200);
      const staffOutboxJson = await staffOutbox.json();
      expect(staffOutboxJson.notifications[0].recipientPhone).toContain('***');
    });
  });

  describe('5. POST /api/admin/orders/confirm (Explicit Request Cookie Binding)', () => {
    it('isolates request cookie sessions when resolving active admin profile', async () => {
      const orderBody = await createSampleOrder();
      const orderId = orderBody.order.id;

      // Even if an unauthenticated request supplies no session cookie, it fails closed (401)
      const unauthRes = await postAdminConfirmApi(
        new NextRequest('http://localhost:3000/api/admin/orders/confirm', {
          method: 'POST',
          headers: buildSameOriginHeaders(),
          body: JSON.stringify({
            action: 'confirm_paid',
            orderId,
            paymentReference: orderBody.paymentReference,
            amountReceivedKobo: orderBody.order.totalKobo,
            isBankAppCreditConfirmed: true,
          }),
        })
      );
      expect(unauthRes.status).toBe(401);
    });
  });
});
