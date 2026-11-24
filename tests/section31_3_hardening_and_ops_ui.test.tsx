/**
 * ROCK UC FOODS - Section 31.6 Admin Ops UI + Section 31.3 Hardening Tests (Findings 6, 9, N7)
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams('tab=security'),
}));

import { OpsControlPanel } from '../src/components/admin/OpsControlPanel';
import { AdminInvoiceDetailClient } from '../src/components/admin/AdminInvoiceDetailClient';
import { StaffOrderManager } from '../src/components/order/StaffOrderManager';
import { StaffCateringManager } from '../src/components/catering/StaffCateringManager';
import { DispatchManagerDashboard } from '../src/components/dispatch/DispatchManagerDashboard';
import { CustomerInvoiceView } from '../src/components/invoices/CustomerInvoiceView';
import AdminPage from '../app/admin/page';
import { GET as listAdminInvoices } from '../app/api/admin/invoices/route';
import { GET as getAdminInvoiceDetail } from '../app/api/admin/invoices/[ref]/route';
import { POST as postAdminOps } from '../app/api/admin/ops/route';
import {
  getBusinessBankSettings,
  setBusinessBankSettings,
  hasVerifiedBankSettings,
  resetBusinessSettings,
} from '../src/lib/businessSettings';
import { maskCustomerPhone, canViewUnmaskedCustomerPhone } from '../src/lib/security';
import { globalAuthService, INITIAL_ACCOUNTS } from '../src/auth/wiring';
import { UserProfile, AuthorizationError } from '../src/lib/auth/access';
import { estimateRepository, invoiceRepository, invoiceLinksRepository } from '../src/invoices/repository';
import { createInvoiceFromEstimate } from '../src/invoices/create';
import { issueInvoice } from '../src/invoices/issue';
import { prepareInvoiceShare } from '../src/invoices/share';
import { computeEstimate } from '../src/estimator/compute';
import { getEstimatorConfig } from '../src/estimator/config';
import { clearAuditLog, getAuditEvents } from '../src/lib/audit';
import { resetRateLimitStore } from '../src/lib/rate-limit';
import { orderRepository } from '../src/order/orderRepository';
import { cateringRepository } from '../src/catering/cateringRepository';
import * as fs from 'fs';
import * as path from 'path';

const ownerVerified: UserProfile = {
  id: 'usr-owner-verified',
  role: 'owner',
  isActive: true,
  fullName: 'Chef Esther Kwentua',
  email: 'estherkwentua@gmail.com',
  hasMfaVerified: true,
};

const staffUser: UserProfile = {
  id: 'usr-staff-01',
  role: 'staff',
  isActive: true,
  fullName: 'Kitchen Operations Staff',
  email: 'staff@rockucfoods.com',
  hasMfaVerified: true,
};

function seedEstimateAndInvoice(phone = '08033729125') {
  const config = getEstimatorConfig();
  const guests = 50;
  const computed = computeEstimate(
    { tierId: config.tiers[0].id, guestCount: guests, selectedAddOns: [] },
    config
  );
  const est = estimateRepository.save({
    id: `est-harden-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    configVersion: config.version,
    inputs: { packageId: config.tiers[0].id, guests, addOnIds: [] },
    result: {
      foodSubtotalKobo: computed.foodSubtotalKobo.toString(),
      addOnsSubtotalKobo: computed.addOnsSubtotalKobo.toString(),
      serviceChargeKobo: computed.serviceChargeKobo.toString(),
      logisticsKobo: computed.logisticsKobo.toString(),
      grandTotalKobo: computed.grandTotalKobo.toString(),
      depositKobo: computed.depositKobo.toString(),
      balanceKobo: computed.balanceKobo.toString(),
    },
    contactName: 'Ngozi Chukwu',
    contactPhone: phone,
    createdAt: new Date().toISOString(),
    validUntil: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
  });
  return est;
}

describe('Section 31.6 Admin Ops UI & Section 31.3 Hardening (Findings 6, 9, N7)', () => {
  beforeEach(() => {
    resetBusinessSettings();
    globalAuthService.reset(INITIAL_ACCOUNTS);
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

  describe('1. Section 31.6 Admin Ops Control Panel UI & /admin Fail-Closed RBAC', () => {
    it('renders interactive controls for MFA-verified owner and read-only/restricted notices otherwise', () => {
      const ownerHtml = renderToStaticMarkup(
        <OpsControlPanel currentUserRole="owner" hasMfaVerified={true} />
      );
      expect(ownerHtml).toContain('Operational Kill Switches &amp; Resilience Controls');
      expect(ownerHtml).toContain('Apply Kill Switches');
      expect(ownerHtml).toContain('Save Bank Details');
      expect(ownerHtml).toContain('Check Stale Drafts');
      expect(ownerHtml).toContain('Run Nightly Self-Check');
      expect(ownerHtml).toContain('Run NDPA Redaction');
      expect(ownerHtml).toContain('Run Verification Drills');
      expect(ownerHtml).not.toContain('Read-only mode');

      const unverifiedOwnerHtml = renderToStaticMarkup(
        <OpsControlPanel currentUserRole="owner" hasMfaVerified={false} />
      );
      expect(unverifiedOwnerHtml).toContain('Read-only mode');

      const staffHtml = renderToStaticMarkup(
        <OpsControlPanel currentUserRole="staff" hasMfaVerified={true} />
      );
      expect(staffHtml).toContain('require Owner or Developer access');
      expect(staffHtml).not.toContain('Apply Kill Switches');
    });

    it('app/admin/page.tsx fails closed (403) when session is missing or user is deactivated instead of defaulting to owner', async () => {
      // 1. No session
      globalAuthService.setSession(null);
      const unauthEl = await AdminPage({ searchParams: Promise.resolve({ tab: 'security' }) });
      const unauthHtml = renderToStaticMarkup(unauthEl);
      expect(unauthHtml).toContain('403 Forbidden');
      expect(unauthHtml).not.toContain('Apply Kill Switches');

      // 2. Deactivated owner account
      const disabledUser = INITIAL_ACCOUNTS.find((a) => a.id === 'usr-disabled-01')!;
      globalAuthService.setSession({
        access_token: 'tok-disabled',
        refresh_token: 'ref-disabled',
        expires_at: Date.now() + 3600_000,
        aal: 'aal1',
        user: { id: disabledUser.id, email: disabledUser.email, factors: [] },
      });
      const disabledEl = await AdminPage({ searchParams: Promise.resolve({ tab: 'security' }) });
      const disabledHtml = renderToStaticMarkup(disabledEl);
      expect(disabledHtml).toContain('403 Forbidden');

      // 3. Authenticated MFA-verified owner on tab=security mounts OpsControlPanel
      await globalAuthService.signInWithPassword({
        email: 'estherkwentua@gmail.com',
        password: 'EstherLuxury2026!',
      });
      const sess = await globalAuthService.getSession();
      if (sess.session) sess.session.aal = 'aal2';

      const ownerEl = await AdminPage({ searchParams: Promise.resolve({ tab: 'security' }) });
      const ownerHtml = renderToStaticMarkup(ownerEl);
      expect(ownerHtml).toContain('Loading Security Status...');
      expect(ownerHtml).toContain('Operational Kill Switches &amp; Resilience Controls');
    });
  });

  describe('2. Finding 6: Owner-Verified Bank Details Gate on Issue, Share & Customer View', () => {
    it('blocks issuing and WhatsApp sharing when bank details are cleared or unverified, and renders fallback copy', async () => {
      const est = seedEstimateAndInvoice();
      const draftRes = await createInvoiceFromEstimate(est.id, {
        name: 'Ngozi Chukwu',
        phone: '08033729125',
      });

      // Clear bank details as MFA-verified owner
      setBusinessBankSettings(null, ownerVerified);
      expect(hasVerifiedBankSettings()).toBe(false);
      expect(getBusinessBankSettings()).toBeNull();

      // Issuing is blocked
      expect(() => issueInvoice(draftRes.invoice.id, ownerVerified)).toThrow(
        /owner-verified bank details/
      );

      // Re-verify bank details and issue
      setBusinessBankSettings(
        {
          bankName: 'Moniepoint MFB',
          accountNumber: '6625890251',
          accountName: 'ROCK UC FOODS',
          verifiedByOwner: true,
        },
        ownerVerified
      );
      const issued = issueInvoice(draftRes.invoice.id, ownerVerified);
      expect(issued.status).toBe('issued');

      // Unverify bank details after issuance -> WhatsApp share is blocked (409) & audited
      setBusinessBankSettings(
        {
          bankName: 'Moniepoint MFB',
          accountNumber: '6625890251',
          accountName: 'ROCK UC FOODS',
          verifiedByOwner: false,
        },
        ownerVerified
      );

      await expect(prepareInvoiceShare(issued.publicRef, ownerVerified)).rejects.toThrow(
        /owner-verified bank details/
      );
      const blockAudit = getAuditEvents().find(
        (a) => a.action === 'invoice.share_blocked_no_bank_details'
      );
      expect(blockAudit).toBeDefined();

      // CustomerInvoiceView never hardcodes Zenith Bank Plc when bankDetails is null
      const noBankHtml = renderToStaticMarkup(
        <CustomerInvoiceView
          invoice={{
            publicRef: issued.publicRef,
            revision: 1,
            status: 'issued',
            customerName: 'Ngozi Chukwu',
            customerPhone: '+2348033729125',
            lines: issued.lines,
            formattedTotal: '₦737,500.00',
            formattedDeposit: '₦516,250.00',
            formattedBalance: '₦221,250.00',
            createdAt: issued.createdAt,
            issuedAt: issued.issuedAt,
            pdfDownloadUrl: '/api/invoice/test',
            whatsappProofUrl: 'https://wa.me/2348033729125',
            bankDetails: null,
          }}
        />
      );
      expect(noBankHtml).toContain('Payment details will be sent by ROCK UC FOODS.');
      expect(noBankHtml).not.toContain('Zenith Bank Plc');
      expect(noBankHtml).not.toContain('1228493018');

      // Verify POST /api/admin/ops update_bank_details requires owner MFA and updates settings
      await globalAuthService.signInWithPassword({
        email: 'estherkwentua@gmail.com',
        password: 'EstherLuxury2026!',
      });
      const sess = await globalAuthService.getSession();
      if (sess.session) sess.session.aal = 'aal2';

      const req = new NextRequest('http://localhost:3000/api/admin/ops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
        body: JSON.stringify({
          action: 'update_bank_details',
          bankName: 'Moniepoint MFB',
          accountNumber: '6625890251',
          accountName: 'ROCK UC FOODS',
          verifiedByOwner: true,
        }),
      });
      const opsRes = await postAdminOps(req);
      expect(opsRes.status).toBe(200);
      expect(hasVerifiedBankSettings()).toBe(true);

      // Non-owner cannot mutate business bank settings directly
      expect(() =>
        setBusinessBankSettings(null, staffUser)
      ).toThrow(AuthorizationError);
    });
  });

  describe('3. Finding 9: Staff & Unverified MFA Customer Phone Masking', () => {
    it('masks customer phones for staff and unverified MFA across helpers, UI components, and admin API routes', async () => {
      expect(canViewUnmaskedCustomerPhone('staff', true)).toBe(false);
      expect(canViewUnmaskedCustomerPhone('owner', false)).toBe(false);
      expect(canViewUnmaskedCustomerPhone('owner', true)).toBe(true);

      expect(maskCustomerPhone('+2348033729125', 'staff', true)).toBe('+234 *** *** 9125');
      expect(maskCustomerPhone('+2348033729125', 'owner', false)).toBe('+234 *** *** 9125');
      expect(maskCustomerPhone('+2348033729125', 'owner', true)).toBe('+2348033729125');

      // Seed invoice, order, and catering event
      const est = seedEstimateAndInvoice('08033729125');
      const createdInv = await createInvoiceFromEstimate(est.id, {
        name: 'Tolu Adeleke',
        phone: '08033729125',
      });

      orderRepository.save({
        id: 'ord-mask-1',
        orderCode: 'RUC-MASK-01',
        customerName: 'Tolu Adeleke',
        customerPhone: '+2348033729125',
        deliveryType: 'delivery',
        deliveryAddress: '12 Admiralty Way, Lekki',
        deliveryFeeKobo: 250000n,
        subtotalKobo: 1200000n,
        totalKobo: 1450000n,
        status: 'payment_confirmed',
        policyVersion: '2026-10-15-v3',
        policyAcceptedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 3600_000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      });

      cateringRepository.save({
        id: 'cat-mask-1',
        eventCode: 'EVT-MASK-01',
        clientName: 'Tolu Adeleke',
        clientPhone: '+2348033729125',
        eventDate: '2026-12-20',
        eventType: 'Corporate Dinner',
        guestCount: 80,
        venueAddress: 'Victoria Island, Lagos',
        liveCookingRequested: false,
        status: 'inquiry',
        quotes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // UI components mask full phone for staff
      const staffOrderHtml = renderToStaticMarkup(
        <StaffOrderManager currentUserId="usr-staff-01" currentUserRole="staff" hasMfaVerified={false} />
      );
      expect(staffOrderHtml).toContain('+234 *** *** 9125');
      expect(staffOrderHtml).not.toContain('+2348033729125');

      const staffCateringHtml = renderToStaticMarkup(
        <StaffCateringManager currentUserId="usr-staff-01" currentUserRole="staff" hasMfaVerified={false} />
      );
      expect(staffCateringHtml).toContain('+234 *** *** 9125');
      expect(staffCateringHtml).not.toContain('+2348033729125');

      const staffDispatchHtml = renderToStaticMarkup(
        <DispatchManagerDashboard currentUserRole="staff" hasMfaVerified={false} />
      );
      expect(staffDispatchHtml).not.toContain('+2348033729125');

      const staffInvoiceDetailHtml = renderToStaticMarkup(
        <AdminInvoiceDetailClient
          userRole="staff"
          hasMfaVerified={false}
          invoice={{
            id: createdInv.invoice.id,
            publicRef: createdInv.invoice.publicRef,
            revision: 1,
            status: 'draft',
            customerName: 'Tolu Adeleke',
            customerPhone: '+2348033729125',
            guests: 50,
            lines: createdInv.invoice.lines,
            totalKobo: createdInv.invoice.totalKobo.toString(),
            formattedTotal: '₦737,500.00',
            depositKobo: createdInv.invoice.depositKobo.toString(),
            formattedDeposit: '₦516,250.00',
            balanceKobo: createdInv.invoice.balanceKobo.toString(),
            formattedBalance: '₦221,250.00',
            createdAt: createdInv.invoice.createdAt,
            linksCount: 0,
          }}
        />
      );
      expect(staffInvoiceDetailHtml).toContain('+234 *** *** 9125');
      expect(staffInvoiceDetailHtml).toContain('Masked (Owner + MFA required)');
      expect(staffInvoiceDetailHtml).not.toContain('+2348033729125');

      // API route GET /api/admin/invoices and GET /api/admin/invoices/[ref]
      await globalAuthService.signInWithPassword({
        email: 'staff@rockucfoods.com',
        password: 'StaffService2026!',
      });

      const listRes = await listAdminInvoices(new NextRequest('http://localhost:3000/api/admin/invoices'));
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();
      expect(listJson.invoices[0].customerPhone).toBe('+234 *** *** 9125');

      const detailRes = await getAdminInvoiceDetail(
        new NextRequest(`http://localhost:3000/api/admin/invoices/${createdInv.invoice.publicRef}`),
        { params: Promise.resolve({ ref: createdInv.invoice.publicRef }) }
      );
      expect(detailRes.status).toBe(200);
      const detailJson = await detailRes.json();
      expect(detailJson.customerPhone).toBe('+234 *** *** 9125');

      // MFA-verified owner receives full unmasked phone
      await globalAuthService.signInWithPassword({
        email: 'estherkwentua@gmail.com',
        password: 'EstherLuxury2026!',
      });
      const ownerDetailRes = await getAdminInvoiceDetail(
        new NextRequest(`http://localhost:3000/api/admin/invoices/${createdInv.invoice.publicRef}`),
        { params: Promise.resolve({ ref: createdInv.invoice.publicRef }) }
      );
      expect(ownerDetailRes.status).toBe(200);
      const ownerDetailJson = await ownerDetailRes.json();
      expect(ownerDetailJson.customerPhone).toBe('+2348033729125');
    });
  });

  describe('4. Finding N7: PLAYBOOK.md Alignment', () => {
    it('PLAYBOOK.md documents manual GTBank reconciliation, Section 31.6 ops controls, and migrations 0001-0022', () => {
      const playbookPath = path.resolve(__dirname, '../PLAYBOOK.md');
      const content = fs.readFileSync(playbookPath, 'utf8');

      expect(content).toContain('0001_foundation.sql');
      expect(content).toContain('0022_manual_gtbank_and_db_ops_settings.sql');
      expect(content).toContain('ops_settings');
      expect(content).toContain('Guaranty Trust Bank (GTBank)');
      expect(content).toContain('NDPA 90-Day Retention');
      expect(content).not.toContain('Paystack');
    });
  });
});
