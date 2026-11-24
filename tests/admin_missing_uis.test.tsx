import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { SiteContentManager } from '../src/components/admin/SiteContentManager';
import { DeliveryZoneManager } from '../src/components/admin/DeliveryZoneManager';
import { StaffOrderManager } from '../src/components/order/StaffOrderManager';
import { StaffPhoneOrderModal } from '../src/components/order/StaffPhoneOrderModal';
import {
  StaffCateringManager,
  buildWeeklyCapacityBuckets,
} from '../src/components/catering/StaffCateringManager';
import { OwnerMenuEditor } from '../src/components/menu/OwnerMenuEditor';
import { PublicMenu } from '../src/components/menu/PublicMenu';
import { CartProvider } from '../src/order/cartContext';
import { DEFAULT_SITE_CONTENT } from '../src/content/types';
import { resetSiteContentForTesting } from '../src/content/service';
import {
  GET as getAdminZones,
  POST as postAdminZones,
} from '../app/api/admin/delivery-zones/route';
import {
  GET as getAdminContent,
  POST as postAdminContent,
} from '../app/api/admin/content/route';
import { POST as postOrders } from '../app/api/orders/route';
import { POST as postAuthLogin } from '../app/api/auth/login/route';
import { POST as postAuthMfaVerify } from '../app/api/auth/mfa/verify/route';
import {
  calculateDeliveryFeeKobo,
  getAllDeliveryZones,
  getDeliveryZoneById,
  resetDeliveryZonesForTesting,
} from '../src/order/deliveryZones';
import { menuRepository } from '../src/menu/data';
import { orderRepository } from '../src/order/orderRepository';
import { globalAuthService, INITIAL_ACCOUNTS } from '../src/auth/wiring';
import { SESSION_COOKIE_NAME } from '../src/auth/cookies';
import { auditLogStore } from '../src/lib/auth';
import { clearAuditLog } from '../src/lib/audit';
import { securityStore } from '../src/security/stepUp';
import { generateTotp } from '../src/security/totp';
import { resetRateLimitStore } from '../src/lib/rate-limit';
import { resetBusinessSettings } from '../src/lib/businessSettings';
import { CateringEvent } from '../src/types/catering';

function makeReq(
  url: string,
  options: { method?: string; cookieToken?: string; origin?: string; body?: unknown } = {}
): NextRequest {
  const headers: Record<string, string> = {
    host: 'localhost:3000',
  };
  if (options.cookieToken) {
    headers['cookie'] = `${SESSION_COOKIE_NAME}=${options.cookieToken}`;
  }
  if ((options.method || 'GET').toUpperCase() !== 'GET') {
    headers['origin'] = options.origin || 'http://localhost:3000';
  }
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  return new NextRequest(url, {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

function extractSessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`).exec(setCookie);
  return match ? match[1] : '';
}

function generateValidTotp(secret: string): string {
  return generateTotp(secret);
}

describe('Option B: Missing Admin UIs & Phase 4 Ops Screens', () => {
  beforeEach(() => {
    resetBusinessSettings();
    resetDeliveryZonesForTesting();
    resetSiteContentForTesting();
    menuRepository.resetForTesting();
    orderRepository.clear();
    globalAuthService.reset(INITIAL_ACCOUNTS);
    securityStore.clear();
    securityStore.syncVerifiedTotpCredential('usr-owner-verified', 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    clearAuditLog();
    resetRateLimitStore();
  });

  afterEach(() => {
    resetBusinessSettings();
    resetDeliveryZonesForTesting();
    resetSiteContentForTesting();
    menuRepository.resetForTesting();
    globalAuthService.reset(INITIAL_ACCOUNTS);
  });

  it('1. SiteContentManager renders Section 35 compliant controls and gates non-owner / unverified sessions', () => {
    const staffHtml = renderToStaticMarkup(
      <SiteContentManager currentUserRole="staff" hasMfaVerified={false} />
    );
    expect(staffHtml).toContain('Site Content CMS');
    expect(staffHtml).toContain('Read-Only Preview (Owner + Verified 2FA Required to Publish)');
    expect(staffHtml).toContain('min-h-[44px]');
    expect(staffHtml).toContain('w-11 h-11');
    expect(staffHtml).not.toMatch(/\btext-(xs|\[10px\]|\[11px\]|\[12px\])\b/);

    const ownerHtml = renderToStaticMarkup(
      <SiteContentManager currentUserRole="owner" hasMfaVerified={true} />
    );
    expect(ownerHtml).toContain('Publish Site Content (v2)');
    expect(ownerHtml).not.toContain('Read-Only Preview');
  });

  it('2. /api/admin/content enforces Owner+MFA, permissionConfirmed on reviews, and optimistic concurrency 409', async () => {
    const loginRes = await postAuthLogin(
      makeReq('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: {
          email: 'estherkwentua@gmail.com',
          password: 'EstherLuxury2026!',
        },
      })
    );
    expect(loginRes.status).toBe(200);
    const ownerCookie = extractSessionCookie(loginRes);
    expect(ownerCookie).toBeTruthy();

    const mfaRes = await postAuthMfaVerify(
      makeReq('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {
          factorId: 'factor-owner-01',
          code: generateValidTotp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
        },
      })
    );
    expect(mfaRes.status).toBe(200);

    const getRes = await getAdminContent();
    expect(getRes.status).toBe(200);
    const current = await getRes.json();
    expect(current.version).toBe(1);

    // Reject unconfirmed customer quote review
    const unconfirmedPost = await postAdminContent(
      makeReq('http://localhost:3000/api/admin/content', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {
          expectedVersion: 1,
          note: 'Try unconfirmed review',
          content: {
            ...DEFAULT_SITE_CONTENT,
            reviews: [
              {
                quote: 'Best party jollof in VI!',
                name: 'Tola A.',
                dateText: 'Nov 2026',
                permissionConfirmed: false,
              },
            ],
          },
        },
      })
    );
    expect(unconfirmedPost.status).toBe(400);

    // Publish valid v2 update
    const okPost = await postAdminContent(
      makeReq('http://localhost:3000/api/admin/content', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {
          expectedVersion: 1,
          note: 'Verified review + holiday hours',
          content: {
            ...DEFAULT_SITE_CONTENT,
            hours: { ...DEFAULT_SITE_CONTENT.hours, leadTimeHours: 12 },
            reviews: [
              {
                quote: 'Our wedding jollof pot finished in 15 minutes!',
                name: 'Chef Guest Amaka',
                dateText: 'Nov 2026',
                permissionConfirmed: true,
              },
            ],
          },
        },
      })
    );
    expect(okPost.status).toBe(200);
    const updated = await okPost.json();
    expect(updated.version).toBe(2);

    // Stale expectedVersion returns 409 Conflict
    const stalePost = await postAdminContent(
      makeReq('http://localhost:3000/api/admin/content', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {
          expectedVersion: 1,
          content: DEFAULT_SITE_CONTENT,
        },
      })
    );
    expect(stalePost.status).toBe(409);
  });

  it('3. MenuRepository & OwnerMenuEditor support size tiers (mutually exclusive with base price), options, and photo persistence', () => {
    const savedTiered = menuRepository.saveItem(
      {
        categoryId: 'cat-drinks',
        name: 'Luxury Tiger Nut Milk',
        description: 'Cold pressed date and coconut blend',
        priceKobo: 0n,
        portionLabel: 'Bottled',
        status: 'published',
        photoUrl: '/assets/tigernut.jpg',
        imagePath: '/assets/tigernut.jpg',
        imageAlt: 'Chilled bottle of Tiger Nut Milk',
        showHeat: false,
        availabilityNote: 'Served chilled daily',
        allergens: ['nuts'],
        sizeTiers: [
          { id: 't-sm', itemId: 'tmp', label: 'S', priceKobo: 180000n, active: true, sortOrder: 1 },
          { id: 't-lg', itemId: 'tmp', label: 'L', priceKobo: 360000n, active: true, sortOrder: 2 },
        ],
        optionGroups: [
          {
            id: 'grp-ice',
            itemId: 'tmp',
            name: 'Serving Preference',
            minSelect: 0,
            maxSelect: 1,
            options: [
              { id: 'opt-spiced', groupId: 'grp-ice', name: 'Extra Ginger Boost', priceDeltaKobo: 25000n, isAvailable: true, sortOrder: 1 },
            ],
          },
        ],
      },
      'usr-owner-01'
    );

    expect(savedTiered.priceKobo).toBe(0n);
    expect(savedTiered.sizeTiers?.length).toBe(2);
    expect(savedTiered.photoUrl).toBe('/assets/tigernut.jpg');

    // Enforces mutual exclusivity: base price + tiers rejected
    expect(() =>
      menuRepository.saveItem(
        {
          categoryId: 'cat-rice',
          name: 'Invalid Hybrid Item',
          priceKobo: 100000n,
          sizeTiers: [{ id: 'x', itemId: 'y', label: 'M', priceKobo: 150000n, active: true, sortOrder: 1 }],
        },
        'usr-owner-01'
      )
    ).toThrow(/cannot have both a base price and size tiers/i);

    const editorHtml = renderToStaticMarkup(
      <OwnerMenuEditor currentUserRole="owner" currentUserId="usr-owner-01" />
    );
    expect(editorHtml).toContain('Size Tiers:');
    expect(editorHtml).toContain('Photo set');
    expect(editorHtml).toContain('option group(s)');

    const publicHtml = renderToStaticMarkup(
      <CartProvider>
        <PublicMenu />
      </CartProvider>
    );
    expect(publicHtml).toContain('src="/assets/tigernut.jpg"');
    expect(publicHtml).toContain('alt="Chilled bottle of Tiger Nut Milk"');
  });

  it('4. DeliveryZoneManager & /api/admin/delivery-zones enforce owner+MFA RBAC, BigInt kobo fee updates, and active zone checks', async () => {
    // Anonymous blocked
    const anonGet = await getAdminZones(makeReq('http://localhost:3000/api/admin/delivery-zones'));
    expect(anonGet.status).toBe(401);

    // Staff login can read but CANNOT mutate
    const staffLoginRes = await postAuthLogin(
      makeReq('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: { email: 'staff@rockucfoods.com', password: 'StaffService2026!' },
      })
    );
    const staffCookie = extractSessionCookie(staffLoginRes);
    const staffGet = await getAdminZones(
      makeReq('http://localhost:3000/api/admin/delivery-zones', { cookieToken: staffCookie })
    );
    expect(staffGet.status).toBe(200);

    const staffMutate = await postAdminZones(
      makeReq('http://localhost:3000/api/admin/delivery-zones', {
        method: 'POST',
        cookieToken: staffCookie,
        body: { id: 'zone-1-ikeja', feeNaira: '2800.00', isActive: true },
      })
    );
    expect(staffMutate.status).toBe(403);

    // Owner with MFA verified updates Zone 1 to ₦2,800.00 and pauses Zone 5
    const ownerLoginRes = await postAuthLogin(
      makeReq('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: {
          email: 'estherkwentua@gmail.com',
          password: 'EstherLuxury2026!',
        },
      })
    );
    expect(ownerLoginRes.status).toBe(200);
    const ownerCookie = extractSessionCookie(ownerLoginRes);

    const ownerMfaRes = await postAuthMfaVerify(
      makeReq('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {
          factorId: 'factor-owner-01',
          code: generateValidTotp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
        },
      })
    );
    expect(ownerMfaRes.status).toBe(200);

    const ownerUpdateRes = await postAdminZones(
      makeReq('http://localhost:3000/api/admin/delivery-zones', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: { id: 'zone-1-ikeja', feeNaira: '2800.00', isActive: true },
      })
    );
    expect(ownerUpdateRes.status).toBe(200);
    expect(getDeliveryZoneById('zone-1-ikeja')?.feeKobo).toBe(280000n);
    expect(calculateDeliveryFeeKobo('delivery', 'zone-1-ikeja')).toBe(280000n);

    const pauseRes = await postAdminZones(
      makeReq('http://localhost:3000/api/admin/delivery-zones', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: { id: 'zone-5-outer', isActive: false },
      })
    );
    expect(pauseRes.status).toBe(200);
    expect(() => calculateDeliveryFeeKobo('delivery', 'zone-5-outer')).toThrow(/active delivery zone/i);
    expect(getAllDeliveryZones(false).some((z) => z.id === 'zone-5-outer')).toBe(false);
    expect(auditLogStore.some((e: { action: string }) => e.action === 'UPDATE_DELIVERY_ZONE')).toBe(true);

    const zonesUiHtml = renderToStaticMarkup(
      <DeliveryZoneManager currentUserRole="owner" hasMfaVerified={true} />
    );
    expect(zonesUiHtml).toContain('Lagos Delivery Zones &amp; Fees');
    expect(zonesUiHtml).toContain('₦2,800.00');
    expect(zonesUiHtml).not.toMatch(/\btext-(xs|\[10px\]|\[11px\]|\[12px\])\b/);
  });

  it('5. StaffOrderManager renders Phone/WhatsApp order button and modal works with server-authoritative /api/orders', async () => {
    resetBusinessSettings();

    const ordersUiHtml = renderToStaticMarkup(
      <StaffOrderManager currentUserRole="staff" currentUserId="usr-staff-01" />
    );
    expect(ordersUiHtml).toContain('data-testid="open-phone-order-modal-btn"');
    expect(ordersUiHtml).toContain('New Phone / WhatsApp Order');

    const modalHtml = renderToStaticMarkup(
      <StaffPhoneOrderModal onClose={() => {}} onOrderCreated={() => {}} />
    );
    expect(modalHtml).toContain('role="dialog"');
    expect(modalHtml).toContain('Log Phone / WhatsApp Order');
    expect(modalHtml).toContain('w-11 h-11');
    expect(modalHtml).toContain('min-h-[44px]');
    expect(modalHtml).not.toMatch(/\btext-(xs|\[10px\]|\[11px\]|\[12px\])\b/);

    // Simulate backend call for phone order with item-t004 size tier 'L' (₦4,000) + Zone 1 delivery (₦2,500)
    const apiRes = await postOrders(
      makeReq('http://localhost:3000/api/orders', {
        method: 'POST',
        body: {
          customerName: 'Phone Caller Chinedu',
          customerPhone: '08033729125',
          deliveryType: 'delivery',
          deliveryZoneId: 'zone-1-ikeja',
          deliveryAddress: '14 Allen Avenue, Ikeja, Lagos',
          specialInstructions: '[Phone Order] Gate code 4411',
          acceptedPolicy: true,
          policyVersion: '2026-10-15-v3',
          items: [{ menuItemId: 'item-t004', selectedTierId: 'tier-t004-l', quantity: 2 }],
        },
      })
    );
    expect(apiRes.status).toBe(201);
    const created = await apiRes.json();
    expect(created.order.subtotalKobo).toBe('800000'); // 2 * 400000
    expect(created.order.deliveryFeeKobo).toBe('250000');
    expect(created.order.totalKobo).toBe('1050000');
    expect(created.paymentReference).toMatch(/^RUC-[2-9A-Z]{6}$/);
  });

  it('6. Weekly Catering Capacity View groups active events by Lagos week & flags same-day clashes or heavy load', () => {
    const sampleEvents: CateringEvent[] = [
      {
        id: 'ev-1',
        eventCode: 'EVT-1',
        clientName: 'Alpha Wedding',
        clientPhone: '+2348030000001',
        eventType: 'Wedding',
        eventDate: '2026-11-20',
        guestCount: 200,
        venueAddress: 'Lekki Phase 1',
        liveCookingRequested: true,
        status: 'deposit_paid',
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-01T00:00:00Z',
        quotes: [],
      },
      {
        id: 'ev-2',
        eventCode: 'EVT-2',
        clientName: 'Beta Reception',
        clientPhone: '+2348030000002',
        eventType: 'Corporate',
        eventDate: '2026-11-20', // Same date clash
        guestCount: 150,
        venueAddress: 'Victoria Island',
        liveCookingRequested: false,
        status: 'quote_sent',
        createdAt: '2026-11-02T00:00:00Z',
        updatedAt: '2026-11-02T00:00:00Z',
        quotes: [],
      },
      {
        id: 'ev-cancelled',
        eventCode: 'EVT-3',
        clientName: 'Cancelled Party',
        clientPhone: '+2348030000003',
        eventType: 'Birthday',
        eventDate: '2026-11-21',
        guestCount: 500,
        venueAddress: 'Ikeja',
        liveCookingRequested: true,
        status: 'cancelled',
        createdAt: '2026-11-03T00:00:00Z',
        updatedAt: '2026-11-03T00:00:00Z',
        quotes: [],
      },
    ];

    const buckets = buildWeeklyCapacityBuckets(sampleEvents);
    expect(buckets.length).toBe(1);
    expect(buckets[0].weekStartIso).toBe('2026-11-16'); // Monday of Nov 20 2026
    expect(buckets[0].events.length).toBe(2); // Cancelled excluded
    expect(buckets[0].totalGuests).toBe(350);
    expect(buckets[0].liveCookingEventsCount).toBe(1);
    expect(buckets[0].depositSecuredCount).toBe(1);
    expect(buckets[0].sameDayClashDates).toEqual(['2026-11-20']);
    expect(buckets[0].isHighLoad).toBe(true);

    const cateringHtml = renderToStaticMarkup(
      <StaffCateringManager currentUserRole="staff" currentUserId="usr-staff-01" />
    );
    expect(cateringHtml).toContain('data-testid="catering-view-weekly"');
    expect(cateringHtml).toContain('Weekly Capacity');
  });
});
