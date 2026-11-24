/**
 * ROCK UC FOODS - Section 31.6 "Next" Features Tests
 * Covers:
 * 1. Read-Only Customer Invoice Preview (zero link minting, role enforcement, UI render)
 * 2. Nightly Invoice Self-Check (valid & revised invoices pass; drifted totals/broken 70/30 fail)
 * 3. NDPA Customer Phone Retention & Redaction (>90d terminal orders/estimates/outbox redacted; kobo intact)
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));
import { buildCustomerInvoicePreview } from '../src/invoices/preview';
import { runNightlyInvoiceSelfCheck } from '../src/invoices/selfCheck';
import { pruneExpiredCustomerPhones, NDPA_REDACTED_MARKER } from '../src/lib/ndpaRetention';
import {
  estimateRepository,
  invoiceRepository,
  invoiceLinksRepository,
  invoiceVersionsRepository,
} from '../src/invoices/repository';
import { createInvoiceFromEstimate } from '../src/invoices/create';
import { issueInvoice } from '../src/invoices/issue';
import { reviseInvoice } from '../src/invoices/revise';
import { computeEstimate } from '../src/estimator/compute';
import { getEstimatorConfig, resetEstimatorConfig } from '../src/estimator/config';
import { orderRepository } from '../src/order/orderRepository';
import { notificationRepository, sendOrderNotification } from '../src/notifications/notificationEngine';
import { clearAuditLog, getAuditEvents } from '../src/lib/audit';
import { resetRateLimitStore } from '../src/lib/rate-limit';
import { resetOperationalState } from '../src/lib/operations';
import { AuthorizationError, UserProfile } from '../src/lib/auth/access';
import { AdminInvoiceDetailClient } from '../src/components/admin/AdminInvoiceDetailClient';
import { Order } from '../src/types/order';

const ownerVerified: UserProfile = {
  id: 'usr-owner-01',
  role: 'owner',
  isActive: true,
  fullName: 'Chef Esther',
  email: 'estherkwentua@gmail.com',
  hasMfaVerified: true,
};

const staffUser: UserProfile = {
  id: 'usr-staff-01',
  role: 'staff',
  isActive: true,
  fullName: 'Kitchen Staff',
  email: 'staff@rockucfoods.com',
  hasMfaVerified: true,
};

const customerUser: UserProfile = {
  id: 'usr-cust-01',
  role: 'customer' as any,
  isActive: true,
  fullName: 'Customer',
  email: 'cust@example.com',
  hasMfaVerified: false,
};

function seedEstimate(id: string, guests = 30, tierId = 'tier-bronze', validUntilIso?: string) {
  const config = getEstimatorConfig();
  const computed = computeEstimate({ tierId, guestCount: guests, selectedAddOns: [] }, config);
  return estimateRepository.save({
    id,
    configVersion: config.version,
    inputs: {
      packageId: tierId,
      guests,
      addOnIds: [],
    },
    result: {
      foodSubtotalKobo: computed.foodSubtotalKobo.toString(),
      addOnsSubtotalKobo: computed.addOnsSubtotalKobo.toString(),
      serviceChargeKobo: computed.serviceChargeKobo.toString(),
      logisticsKobo: computed.logisticsKobo.toString(),
      grandTotalKobo: computed.grandTotalKobo.toString(),
      depositKobo: computed.depositKobo.toString(),
      balanceKobo: computed.balanceKobo.toString(),
    },
    createdAt: new Date().toISOString(),
    validUntil: validUntilIso ?? new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    contactName: 'Chidinma Okafor',
    contactPhone: '+2348033729125',
  });
}

describe('Section 31.6 Next Features: Preview, Nightly Self-Check & NDPA Pruning', () => {
  beforeEach(() => {
    resetEstimatorConfig();
    resetOperationalState();
    clearAuditLog();
    resetRateLimitStore();
    estimateRepository.clear();
    invoiceRepository.clear();
    invoiceLinksRepository.clear();
    invoiceVersionsRepository.clear();
    orderRepository.clear();
    notificationRepository.clear();
  });

  describe('1. Read-Only Customer Invoice Preview', () => {
    it('builds accurate customer preview & WhatsApp wording without minting a share link', async () => {
      const est = seedEstimate('est-preview-01', 40);
      const { invoice } = await createInvoiceFromEstimate(est.id, {
        name: 'Chidinma Okafor',
        phone: '08033729125',
      });

      const preview = buildCustomerInvoicePreview(invoice.publicRef, staffUser);

      expect(preview.publicRef).toBe(invoice.publicRef);
      expect(preview.customerFirstName).toBe('Chidinma');
      expect(preview.guests).toBe(40);
      expect(preview.isDraftNotice).toBe(true);
      expect(preview.whatsAppMessagePreview).toContain('Chidinma');
      expect(preview.whatsAppMessagePreview).toContain(invoice.publicRef);
      expect(preview.formattedTotal).toMatch(/^₦/);

      // Must NOT mint any live share links
      expect(invoiceLinksRepository.getLinksByInvoiceId(invoice.id).length).toBe(0);

      // Customer role must be denied
      expect(() => buildCustomerInvoicePreview(invoice.publicRef, customerUser)).toThrow(
        AuthorizationError
      );
    });

    it('renders "Preview as customer" button on AdminInvoiceDetailClient for draft and issued states', () => {
      const html = renderToStaticMarkup(
        <AdminInvoiceDetailClient
          userRole="owner"
          invoice={{
            id: 'inv-ui-1',
            publicRef: 'INV-2026-0001',
            revision: 1,
            status: 'issued',
            customerName: 'Chidinma Okafor',
            customerPhone: '+2348033729125',
            guests: 40,
            lines: [
              {
                name: 'Bronze Feast, 40 guests',
                quantity: 40,
                unitPriceKobo: '1250000',
                lineTotalKobo: '50000000',
              },
            ],
            totalKobo: '60000000',
            formattedTotal: '₦600,000.00',
            depositKobo: '42000000',
            formattedDeposit: '₦420,000.00',
            balanceKobo: '18000000',
            formattedBalance: '₦180,000.00',
            createdAt: new Date().toISOString(),
            linksCount: 0,
          }}
        />
      );

      expect(html).toContain('Preview as customer');
      expect(html).toContain('Send invoice on WhatsApp');

      const draftHtml = renderToStaticMarkup(
        <AdminInvoiceDetailClient
          userRole="staff"
          invoice={{
            id: 'inv-ui-2',
            publicRef: 'INV-2026-0002',
            revision: 1,
            status: 'draft',
            customerName: 'Chidinma Okafor',
            customerPhone: '+2348033729125',
            guests: 40,
            lines: [],
            totalKobo: '60000000',
            formattedTotal: '₦600,000.00',
            depositKobo: '42000000',
            formattedDeposit: '₦420,000.00',
            balanceKobo: '18000000',
            formattedBalance: '₦180,000.00',
            createdAt: new Date().toISOString(),
            linksCount: 0,
          }}
        />
      );
      expect(draftHtml).toContain('Preview as customer');
    });
  });

  describe('2. Nightly Invoice Self-Check', () => {
    it('passes on valid draft, issued, and revised invoices, and skips void invoices', async () => {
      const est1 = seedEstimate('est-sc-1', 30);
      const { invoice: inv1 } = await createInvoiceFromEstimate(est1.id, {
        name: 'Tola Adeyemi',
        phone: '08031112233',
      });
      issueInvoice(inv1.id, ownerVerified);
      reviseInvoice(
        inv1.id,
        {
          reason: 'Guest increase to 45',
          inputs: { packageId: 'tier-bronze', guests: 45, addOnIds: [] },
        },
        ownerVerified
      );

      const estVoid = seedEstimate('est-sc-void', 25);
      const { invoice: invVoid } = await createInvoiceFromEstimate(estVoid.id, {
        name: 'Void Client',
        phone: '08031114455',
      });
      invVoid.status = 'void';
      invVoid.totalKobo = 1n; // intentionally odd, should be skipped because void
      invoiceRepository.save(invVoid);

      const report = runNightlyInvoiceSelfCheck();
      expect(report.passed).toBe(true);
      expect(report.checkedCount).toBe(1);
      expect(report.skippedCount).toBe(1);
      expect(report.mismatches.length).toBe(0);

      const audit = getAuditEvents().find((a) => a.action === 'ops.nightly_self_check');
      expect(audit).toBeDefined();
      expect(audit?.details?.passed).toBe(true);
    });

    it('detects tampered kobo total and broken 70/30 deposit/balance split without mutating saved data', async () => {
      const est = seedEstimate('est-sc-tamper', 35);
      const { invoice } = await createInvoiceFromEstimate(est.id, {
        name: 'Tamper Check',
        phone: '08039990001',
      });

      const originalTotal = invoice.totalKobo;
      invoice.totalKobo = originalTotal + 50000n; // corrupt total so split breaks too
      invoiceRepository.save(invoice);

      let callbackFired = false;
      const report = runNightlyInvoiceSelfCheck({
        onMismatchDetected: () => {
          callbackFired = true;
        },
      });

      expect(report.passed).toBe(false);
      expect(callbackFired).toBe(true);
      expect(report.mismatches.length).toBe(1);
      expect(report.mismatches[0].publicRef).toBe(invoice.publicRef);
    });
  });

  describe('3. NDPA Customer Phone Retention & Redaction', () => {
    it('redacts phone & email on >90-day terminal orders, expired estimates, and outbox while keeping active records & kobo totals intact', () => {
      const now = Date.UTC(2026, 10, 13, 12, 0, 0);
      const oldIso = new Date(now - 95 * 24 * 60 * 60 * 1000).toISOString();
      const recentIso = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

      const oldTerminalOrder: Order = {
        id: 'ord-ndpa-old',
        orderCode: 'RUC-20260801-OLD1',
        customerName: 'Old Customer',
        customerPhone: '+2348035556677',
        customerEmail: 'old@example.com',
        deliveryType: 'collection',
        deliveryFeeKobo: 0n,
        subtotalKobo: 1200000n,
        totalKobo: 1200000n,
        status: 'delivered',
        policyVersion: '2026-10-15-v3',
        policyAcceptedAt: oldIso,
        expiresAt: oldIso,
        createdAt: oldIso,
        updatedAt: oldIso,
        items: [],
      };
      orderRepository.save(oldTerminalOrder);

      const activeOrder: Order = {
        ...oldTerminalOrder,
        id: 'ord-ndpa-active',
        orderCode: 'RUC-20261110-ACT1',
        customerPhone: '+2348038889900',
        status: 'in_kitchen',
        createdAt: recentIso,
        updatedAt: recentIso,
      };
      orderRepository.save(activeOrder);

      // Old expired estimate
      seedEstimate('est-ndpa-old', 30, 'tier-bronze', oldIso);
      // Recent estimate
      seedEstimate('est-ndpa-recent', 30, 'tier-bronze', new Date(now + 86400000).toISOString());

      // Old notification outbox entry
      const oldNotif = sendOrderNotification(oldTerminalOrder, 'delivered', 'whatsapp');
      notificationRepository.saveNotification({
        ...oldNotif,
        createdAt: oldIso,
      });

      const result = pruneExpiredCustomerPhones({ nowMs: now, retentionDays: 90 });

      expect(result.ordersPruned).toBe(1);
      expect(result.estimatesPruned).toBe(1);
      expect(result.notificationsPruned).toBe(1);

      const updatedOldOrder = orderRepository.getById('ord-ndpa-old')!;
      expect(updatedOldOrder.customerPhone).toBe(NDPA_REDACTED_MARKER);
      expect(updatedOldOrder.customerEmail).toBeUndefined();
      expect(updatedOldOrder.totalKobo).toBe(1200000n); // Financial ledger preserved

      const untouchedActiveOrder = orderRepository.getById('ord-ndpa-active')!;
      expect(untouchedActiveOrder.customerPhone).toBe('+2348038889900');

      const updatedOldEst = estimateRepository.getById('est-ndpa-old')!;
      expect(updatedOldEst.contactPhone).toBe(NDPA_REDACTED_MARKER);

      const recentEst = estimateRepository.getById('est-ndpa-recent')!;
      expect(recentEst.contactPhone).toBe('+2348033729125');

      const prunedAudit = getAuditEvents().find((a) => a.action === 'compliance.ndpa_phone_pruned');
      expect(prunedAudit).toBeDefined();
      expect(JSON.stringify(prunedAudit)).not.toContain('8035556677');
    });
  });
});
