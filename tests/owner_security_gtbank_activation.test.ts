/**
 * ROCK UC FOODS - Owner Security & GTBank Activation End-to-End Integration Suite
 *
 * Covers:
 * 1. Cookie-scoped login (`usr-owner-01` -> `/api/auth/mfa/start` -> `/api/auth/mfa/verify` -> `aal2`)
 * 2. Cross-session isolation (anonymous or foreign requests never inherit `currentSession`)
 * 3. `aal1` second-factor gate (`usr-owner-verified` blocked at `aal1` from `/admin` & bank mutations until TOTP verify)
 * 4. `/api/security/mfa` & `/api/security/step-up` IDOR/CSRF/RBAC/duplicate-enrollment defense
 * 5. GTBank Activation (`Guaranty Trust Bank (GTBank)`, `Esther Kwentua`, `"0013190627"`) lifecycle:
 *    - Clear -> unverified -> fail-closed across `/api/ops/bank-details`, `/api/orders` (503),
 *      `issueInvoice` (error/409), and `generateCateringInvoicePdf`
 *    - Activate `"0013190627"` -> immediate live propagation preserving `"00"` leading zeros
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

import {
  globalAuthService,
  INITIAL_ACCOUNTS,
  resolveSessionFromRequest,
  hasSessionVerifiedMfa,
  getProfileFromService,
} from '../src/auth/wiring';
import { SESSION_COOKIE_NAME } from '../src/auth/cookies';
import { decideAdminAccess } from '../src/auth/admin-gate';
import { generateTotp, generateTotpForStep } from '../src/security/totp';
import { securityStore } from '../src/security/stepUp';
import {
  BANK_NAME,
  ACCOUNT_NAME,
  ACCOUNT_NUMBER,
  MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
  getBusinessBankSettings,
  hasVerifiedBankSettings,
  resetBusinessSettings,
} from '../src/lib/businessSettings';
import { clearAuditLog, getAuditEvents } from '../src/lib/audit';
import { resetRateLimitStore } from '../src/lib/rate-limit';
import { estimateRepository, invoiceRepository, invoiceLinksRepository } from '../src/invoices/repository';
import { computeEstimate } from '../src/estimator/compute';
import { getEstimatorConfig } from '../src/estimator/config';
import { createInvoiceFromEstimate } from '../src/invoices/create';
import { issueInvoice } from '../src/invoices/issue';
import { cateringRepository } from '../src/catering/cateringRepository';
import { generateCateringInvoicePdf } from '../src/catering/cateringPdf';
import { orderRepository } from '../src/order/orderRepository';
import { POLICY_VERSION } from '../src/policy/content';

import { POST as postAuthLogin } from '../app/api/auth/login/route';
import { POST as postAuthMfaStart } from '../app/api/auth/mfa/start/route';
import { POST as postAuthMfaVerify } from '../app/api/auth/mfa/verify/route';
import { POST as postAuthLogout } from '../app/api/auth/logout/route';
import { GET as getSecurityMfa, POST as postSecurityMfa } from '../app/api/security/mfa/route';
import { POST as postSecurityStepUp } from '../app/api/security/step-up/route';
import { GET as getAdminOps, POST as postAdminOps } from '../app/api/admin/ops/route';
import { GET as getBankDetails, POST as postBankDetails } from '../app/api/ops/bank-details/route';
import { POST as postOrdersApi } from '../app/api/orders/route';
import { GET as getAdminUsers } from '../app/api/admin/users/route';

function extractCookieValue(res: Response, cookieName: string): string | null {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const regex = new RegExp(`${cookieName}=([^;]+)`);
  const match = setCookie.match(regex);
  return match ? decodeURIComponent(match[1]) : null;
}

function makeAuthedRequest(
  url: string,
  options: {
    method?: string;
    cookieToken?: string | null;
    origin?: string | null;
    body?: unknown;
  } = {}
): NextRequest {
  const headers: Record<string, string> = {
    host: 'localhost:3000',
  };
  if (options.cookieToken) {
    headers['cookie'] = `${SESSION_COOKIE_NAME}=${encodeURIComponent(options.cookieToken)}`;
  }
  if (options.origin !== null) {
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

describe('Owner Security & GTBank Activation End-to-End', () => {
  beforeEach(() => {
    resetBusinessSettings();
    globalAuthService.reset(INITIAL_ACCOUNTS);
    securityStore.clear();
    // Re-seed verified owner & developer credentials cleanly
    securityStore.syncVerifiedTotpCredential('usr-owner-verified', 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    securityStore.syncVerifiedTotpCredential('usr-dev-01', 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
    estimateRepository.clear();
    invoiceRepository.clear();
    invoiceLinksRepository.clear();
    orderRepository.clear();
    cateringRepository.clear();
    clearAuditLog();
    resetRateLimitStore();
  });

  afterEach(() => {
    resetBusinessSettings();
    globalAuthService.reset(INITIAL_ACCOUNTS);
  });

  it('completes cookie-scoped owner enrollment & verification flow (`rock-uc-foods@gmail.com`) without leaking sessions across visitors', async () => {
    // 1. Owner without prior MFA logs in -> step = mfa_enrol, aal = aal1
    const loginReq = makeAuthedRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { email: 'rock-uc-foods@gmail.com', password: 'EstherLuxury2026!' },
    });
    const loginRes = await postAuthLogin(loginReq);
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.step).toBe('enrol');
    expect(loginBody.role).toBe('owner');
    expect(loginBody.next).toBe('/admin');

    const ownerCookie = extractCookieValue(loginRes, SESSION_COOKIE_NAME);
    expect(ownerCookie).toBeTruthy();

    // 2. While still at aal1, owner cookie is blocked from `/admin` gate and `/api/admin/ops`
    const ownerSessionAtAal1 = await resolveSessionFromRequest(
      makeAuthedRequest('http://localhost:3000/api/admin/ops', { cookieToken: ownerCookie })
    );
    expect(hasSessionVerifiedMfa(ownerSessionAtAal1.session)).toBe(false);

    const aal1OpsRes = await postAdminOps(
      makeAuthedRequest('http://localhost:3000/api/admin/ops', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: { action: 'update_bank_details', clear: true },
      })
    );
    expect(aal1OpsRes.status).toBe(403);

    // 3. Anonymous or foreign request CANNOT inherit this owner session!
    const anonOpsRes = await getAdminOps(makeAuthedRequest('http://localhost:3000/api/admin/ops'));
    expect(anonOpsRes.status).toBe(401);

    const anonUsersRes = await getAdminUsers(
      makeAuthedRequest('http://localhost:3000/api/admin/users')
    );
    expect(anonUsersRes.status).toBe(401);

    // 4. Start MFA enrollment using the owner cookie
    const startRes = await postAuthMfaStart(
      makeAuthedRequest('http://localhost:3000/api/auth/mfa/start', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {},
      })
    );
    expect(startRes.status).toBe(200);
    const startBody = await startRes.json();
    expect(startBody.factorId).toBeTruthy();
    expect(startBody.secret).toMatch(/^[A-Z2-7]+$/);

    // 5. Complete MFA verification with RFC 6238 6-digit TOTP generated from enrolled secret
    const code = generateTotp(startBody.secret);
    const verifyRes = await postAuthMfaVerify(
      makeAuthedRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: { factorId: startBody.factorId, code },
      })
    );
    expect(verifyRes.status).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.next).toBe('/admin');

    // 6. Now cookie resolves as verified MFA (aal2)
    const ownerSessionAtAal2 = await resolveSessionFromRequest(
      makeAuthedRequest('http://localhost:3000/api/admin/ops', { cookieToken: ownerCookie })
    );
    expect(hasSessionVerifiedMfa(ownerSessionAtAal2.session)).toBe(true);

    // 7. `/api/security/mfa` GET shows synced enabled status for authenticated user,
    // and POST rejects duplicate enrollment with 409 even if caller tries IDOR userId spoofing.
    const mfaGetRes = await getSecurityMfa(
      makeAuthedRequest('http://localhost:3000/api/security/mfa', { cookieToken: ownerCookie })
    );
    expect(mfaGetRes.status).toBe(200);
    const mfaGetBody = await mfaGetRes.json();
    expect(mfaGetBody.isEnabled).toBe(true);
    expect(mfaGetBody.accountEmail).toBe('rock-uc-foods@gmail.com');
    expect(mfaGetBody.role).toBe('owner');

    const dupEnrollRes = await postSecurityMfa(
      makeAuthedRequest('http://localhost:3000/api/security/mfa', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {
          userId: 'usr-staff-01', // IDOR attempt must be ignored
          secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
          code: generateTotp('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'),
        },
      })
    );
    expect(dupEnrollRes.status).toBe(409);

    // 8. Logout invalidates the cookie token permanently
    const logoutRes = await postAuthLogout(
      makeAuthedRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {},
      })
    );
    expect(logoutRes.status).toBe(200);

    const afterLogoutRes = await getAdminOps(
      makeAuthedRequest('http://localhost:3000/api/admin/ops', { cookieToken: ownerCookie })
    );
    expect(afterLogoutRes.status).toBe(401);
  });

  it('enforces aal2 for pre-enrolled owner (`estherkwentua@gmail.com`) at /admin gate & blocks staff/unauth/CSRF on /api/security/*', async () => {
    // 1. Pre-enrolled owner logs in with password only -> aal1
    const loginRes = await postAuthLogin(
      makeAuthedRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: { email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' },
      })
    );
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json();
    expect(loginBody.step).toBe('verify');
    expect(loginBody.next).toBe('/admin');
    const cookieAtAal1 = extractCookieValue(loginRes, SESSION_COOKIE_NAME);
    expect(cookieAtAal1).toBeTruthy();

    // Admin gate MUST redirect to /login/mfa while session is aal1!
    const aal1SessionRes = await resolveSessionFromRequest(
      makeAuthedRequest('http://localhost:3000/admin?tab=security', { cookieToken: cookieAtAal1 })
    );
    const gateAtAal1 = await decideAdminAccess(
      {
        getUserProfile: async () => {
          const user = aal1SessionRes.session?.user;
          if (!user) return null;
          const base = await getProfileFromService(user.id);
          if (!base) return null;
          return {
            ...base,
            hasMfaVerified: hasSessionVerifiedMfa(aal1SessionRes.session, base.hasMfaVerified),
          };
        },
      },
      '/admin?tab=security'
    );
    expect(gateAtAal1.action).toBe('redirect');
    if (gateAtAal1.action === 'redirect') {
      expect(gateAtAal1.destination).toContain('/login/mfa');
    }

    // Bank activation blocked at aal1
    const aal1BankRes = await postBankDetails(
      makeAuthedRequest('http://localhost:3000/api/ops/bank-details', {
        method: 'POST',
        cookieToken: cookieAtAal1,
        body: { clear: true },
      })
    );
    expect(aal1BankRes.status).toBe(403);

    // Complete MFA verify for pre-enrolled factor
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const verifyRes = await postAuthMfaVerify(
      makeAuthedRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        cookieToken: cookieAtAal1,
        body: { factorId: 'factor-owner-01', code: generateTotp(secret) },
      })
    );
    expect(verifyRes.status).toBe(200);

    // Admin gate now allows access at aal2
    const aal2SessionRes = await resolveSessionFromRequest(
      makeAuthedRequest('http://localhost:3000/admin?tab=security', { cookieToken: cookieAtAal1 })
    );
    const gateAtAal2 = await decideAdminAccess(
      {
        getUserProfile: async () => {
          const user = aal2SessionRes.session?.user;
          if (!user) return null;
          const base = await getProfileFromService(user.id);
          if (!base) return null;
          return {
            ...base,
            hasMfaVerified: hasSessionVerifiedMfa(aal2SessionRes.session, base.hasMfaVerified),
          };
        },
      },
      '/admin?tab=security'
    );
    expect(gateAtAal2.action).toBe('allow');

    // Step-up check uses server session userId (not client-forged userId) and accepts valid backup code + next TOTP step
    const ownerCred = securityStore.getMfaCredential('usr-owner-verified');
    expect(ownerCred?.backupCodes.length).toBeGreaterThan(0);
    const validBackupCode = ownerCred!.backupCodes[0];

    const stepUpRes = await postSecurityStepUp(
      makeAuthedRequest('http://localhost:3000/api/security/step-up', {
        method: 'POST',
        cookieToken: cookieAtAal1,
        body: {
          userId: 'usr-staff-01',
          userRole: 'staff',
          code: validBackupCode,
          purpose: 'security_settings',
        },
      })
    );
    expect(stepUpRes.status).toBe(200);
    const stepUpBody = await stepUpRes.json();
    expect(stepUpBody.success).toBe(true);
    expect(stepUpBody.stepUpToken).toMatch(/^stp-/);

    // Backup code is single-use: replaying it is rejected with 401
    const replayBackupRes = await postSecurityStepUp(
      makeAuthedRequest('http://localhost:3000/api/security/step-up', {
        method: 'POST',
        cookieToken: cookieAtAal1,
        body: {
          code: validBackupCode,
          purpose: 'security_settings',
        },
      })
    );
    expect(replayBackupRes.status).toBe(401);

    // CSRF rejection on foreign origin for /api/security/step-up
    const csrfRes = await postSecurityStepUp(
      makeAuthedRequest('http://localhost:3000/api/security/step-up', {
        method: 'POST',
        cookieToken: cookieAtAal1,
        origin: 'https://evil.example.com',
        body: { code: 'RECV-0002', purpose: 'security_settings' },
      })
    );
    expect(csrfRes.status).toBe(403);

    // Staff cannot access /api/security/mfa or /api/security/step-up
    const staffLoginRes = await postAuthLogin(
      makeAuthedRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: { email: 'staff@rockucfoods.com', password: 'StaffService2026!' },
      })
    );
    const staffCookie = extractCookieValue(staffLoginRes, SESSION_COOKIE_NAME);
    expect(staffCookie).toBeTruthy();

    const staffStepUpRes = await postSecurityStepUp(
      makeAuthedRequest('http://localhost:3000/api/security/step-up', {
        method: 'POST',
        cookieToken: staffCookie,
        body: { code: '123456', purpose: 'security_settings' },
      })
    );
    expect(staffStepUpRes.status).toBe(403);

    // Unauthenticated rejected with 401 on /api/security/mfa
    const unauthMfaRes = await getSecurityMfa(
      makeAuthedRequest('http://localhost:3000/api/security/mfa')
    );
    expect(unauthMfaRes.status).toBe(401);
  });

  it('verifies full GTBank Activation lifecycle (`0013190627`) across bank API, checkout (503/201), invoice issuance, and catering PDF', async () => {
    // Authenticate pre-enrolled owner to aal2 cookie
    const loginRes = await postAuthLogin(
      makeAuthedRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: { email: 'estherkwentua@gmail.com', password: 'EstherLuxury2026!' },
      })
    );
    const ownerCookie = extractCookieValue(loginRes, SESSION_COOKIE_NAME);
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
    const currentStep = Math.floor(Date.now() / 1000 / 30);
    await postAuthMfaVerify(
      makeAuthedRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: { factorId: 'factor-owner-01', code: generateTotpForStep(secret, currentStep) },
      })
    );

    // Seed a draft invoice + catering event
    const config = getEstimatorConfig();
    const computed = computeEstimate(
      { tierId: config.tiers[0].id, guestCount: 50, selectedAddOns: [] },
      config
    );
    const est = estimateRepository.save({
      id: `est-gtbank-${Date.now()}`,
      configVersion: config.version,
      inputs: { packageId: config.tiers[0].id, guests: 50, addOnIds: [] },
      result: {
        foodSubtotalKobo: computed.foodSubtotalKobo.toString(),
        addOnsSubtotalKobo: computed.addOnsSubtotalKobo.toString(),
        serviceChargeKobo: computed.serviceChargeKobo.toString(),
        logisticsKobo: computed.logisticsKobo.toString(),
        grandTotalKobo: computed.grandTotalKobo.toString(),
        depositKobo: computed.depositKobo.toString(),
        balanceKobo: computed.balanceKobo.toString(),
      },
      contactName: 'Amaka Okafor',
      contactPhone: '08033729125',
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    });
    const draftRes = await createInvoiceFromEstimate(est.id, {
      name: 'Amaka Okafor',
      phone: '08033729125',
    });

    // 1. Clear GTBank settings via `/api/admin/ops`
    const clearRes = await postAdminOps(
      makeAuthedRequest('http://localhost:3000/api/admin/ops', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: { action: 'update_bank_details', clear: true },
      })
    );
    expect(clearRes.status).toBe(200);
    expect(hasVerifiedBankSettings()).toBe(false);

    // Public `/api/ops/bank-details` fails closed
    const publicUnconfRes = await getBankDetails();
    const publicUnconfBody = await publicUnconfRes.json();
    expect(publicUnconfBody.configured).toBe(false);
    expect(publicUnconfBody.bankDetails).toBeNull();
    expect(publicUnconfBody.message).toBe(MISSING_BANK_DETAILS_CHECKOUT_MESSAGE);

    // Order checkout blocks cleanly with 503
    const orderBlockedRes = await postOrdersApi(
      makeAuthedRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: {
          customerName: 'Amaka Okafor',
          customerPhone: '08033729125',
          deliveryType: 'collection',
          acceptedPolicy: true,
          policyVersion: POLICY_VERSION,
          items: [{ menuItemId: 'item-t001', quantity: 1 }],
        },
      })
    );
    expect(orderBlockedRes.status).toBe(503);
    const orderBlockedBody = await orderBlockedRes.json();
    expect(orderBlockedBody.error).toBe(MISSING_BANK_DETAILS_CHECKOUT_MESSAGE);

    // Issuing invoice throws while bank details missing
    expect(() =>
      issueInvoice(draftRes.invoice.id, {
        id: 'usr-owner-verified',
        role: 'owner',
        isActive: true,
        fullName: 'Chef Esther Kwentua',
        hasMfaVerified: true,
      })
    ).toThrow(/owner-verified bank details/);

    // Catering PDF hides bank details and omits account number while unconfigured
    const cateringEvent = cateringRepository.save({
      id: 'evt-gtbank-test',
      eventCode: 'EVT-20261125-GT01',
      clientName: 'Amaka Okafor',
      clientPhone: '+2348033729125',
      clientEmail: 'amaka@example.com',
      eventType: 'Corporate Gala',
      eventDate: '2026-11-25',
      guestCount: 50,
      venueAddress: 'Victoria Island, Lagos',
      liveCookingRequested: true,
      specialNotes: 'Verified bank gate test event',
      status: 'quote_sent',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      quotes: [
        {
          id: 'quote-gtbank-test',
          eventId: 'evt-gtbank-test',
          revisionNumber: 1,
          foodSubtotalKobo: 50000000n,
          logisticsFeeKobo: 5000000n,
          serviceFeeKobo: 5000000n,
          totalKobo: 60000000n,
          depositPercentage: 70,
          depositKobo: 42000000n,
          balanceKobo: 18000000n,
          depositStatus: 'unpaid',
          balanceStatus: 'unpaid',
          status: 'active',
          notes: 'Test quote',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'qli-gtbank-test-1',
              quoteId: 'quote-gtbank-test',
              name: 'Smoky Party Jollof',
              portionLabel: 'Plates',
              unitPriceKobo: 1000000n,
              quantity: 50,
              totalKobo: 50000000n,
            },
          ],
        },
      ],
    });
    const cateringQuote = cateringEvent.quotes[0];
    const unconfPdf = await generateCateringInvoicePdf(cateringEvent, cateringQuote);
    expect(unconfPdf.pdfBytes.length).toBeGreaterThan(1500);
    const unconfPdfStr = Buffer.from(unconfPdf.pdfBytes).toString('latin1');
    expect(unconfPdfStr).not.toContain(ACCOUNT_NUMBER);

    // 2. Reject invalid non-10-digit NUBAN (leading-zero truncation protection)
    const badNubanRes = await postBankDetails(
      makeAuthedRequest('http://localhost:3000/api/ops/bank-details', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {
          bankName: BANK_NAME,
          accountName: ACCOUNT_NAME,
          accountNumber: '13190627', // missing leading 00
          verifiedByOwner: true,
        },
      })
    );
    expect(badNubanRes.status).toBe(400);

    // 3. Activate official GTBank details via `/api/admin/ops`
    const activateRes = await postAdminOps(
      makeAuthedRequest('http://localhost:3000/api/admin/ops', {
        method: 'POST',
        cookieToken: ownerCookie,
        body: {
          action: 'update_bank_details',
          bankName: BANK_NAME,
          accountName: ACCOUNT_NAME,
          accountNumber: ACCOUNT_NUMBER,
          verifiedByOwner: true,
        },
      })
    );
    expect(activateRes.status).toBe(200);
    const activateBody = await activateRes.json();
    expect(activateBody.bankSettings.accountNumber).toBe('0013190627');
    expect(activateBody.bankSettings.bankName).toBe('Guaranty Trust Bank (GTBank)');
    expect(activateBody.bankSettings.accountName).toBe('Esther Kwentua');
    expect(activateBody.bankSettings.verifiedByOwner).toBe(true);

    // Stored settings preserve leading zeros
    const stored = getBusinessBankSettings();
    expect(stored?.accountNumber).toBe('0013190627');
    expect(stored?.accountNumber.length).toBe(10);

    // Public `/api/ops/bank-details` returns live verified GTBank details
    const publicLiveRes = await getBankDetails();
    const publicLiveBody = await publicLiveRes.json();
    expect(publicLiveBody.configured).toBe(true);
    expect(publicLiveBody.bankDetails).toEqual({
      bankName: 'Guaranty Trust Bank (GTBank)',
      accountName: 'Esther Kwentua',
      accountNumber: '0013190627',
    });

    // Order checkout succeeds (201) and echoes live GTBank details
    const orderOkRes = await postOrdersApi(
      makeAuthedRequest('http://localhost:3000/api/orders', {
        method: 'POST',
        body: {
          customerName: 'Amaka Okafor',
          customerPhone: '08033729125',
          deliveryType: 'collection',
          acceptedPolicy: true,
          policyVersion: POLICY_VERSION,
          items: [{ menuItemId: 'item-t001', quantity: 1 }],
        },
      })
    );
    expect(orderOkRes.status).toBe(201);
    const orderOkBody = await orderOkRes.json();
    expect(orderOkBody.bankDetails.accountNumber).toBe('0013190627');

    // Invoice issuance now succeeds
    const issued = issueInvoice(draftRes.invoice.id, {
      id: 'usr-owner-verified',
      role: 'owner',
      isActive: true,
      fullName: 'Chef Esther Kwentua',
      hasMfaVerified: true,
    });
    expect(issued.status).toBe('issued');

    // Catering PDF generated after activation succeeds and is valid PDF bytes
    const livePdf = await generateCateringInvoicePdf(cateringEvent, cateringQuote);
    expect(livePdf.pdfBytes.length).toBeGreaterThan(unconfPdf.pdfBytes.length - 100);

    // Audit trail recorded both clear & activate actions
    const auditActions = getAuditEvents().map((a) => a.action);
    expect(auditActions).toContain('settings.bank_details_cleared');
    expect(auditActions).toContain('settings.bank_details_updated');
  });
});
