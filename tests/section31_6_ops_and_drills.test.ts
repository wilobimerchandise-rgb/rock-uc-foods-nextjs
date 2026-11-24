/**
 * ROCK UC FOODS - Section 31.6 Operational Kill Switches, Proactive Alerts & Live Verification Drills
 * Also covers Section 31.5 Findings 5, 7, 8 verification.
 * All operational kill switches are DB-backed settings editable by Owner + MFA only (zero env secrets).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isInvoiceRequestsPaused,
  isWhatsappSendPaused,
  getKillSwitchStatus,
  setKillSwitchState,
  checkStaleDraftInvoices,
  attachAuditFailureAlertMonitor,
  resetOperationalState,
  ServiceUnavailableError,
  OperationalAlert,
} from '../src/lib/operations';
import {
  clearAuditLog,
  getAuditEvents,
  recordAudit,
  setAuditPersistenceWriter,
  getAuditFailureCount,
  resetAuditFailureState,
} from '../src/lib/audit';
import { runOperationalDrills } from '../src/lib/drills';
import { resetRateLimitStore } from '../src/lib/rate-limit';
import { AuthorizationError, UserProfile } from '../src/lib/auth/access';
import {
  estimateRepository,
  invoiceRepository,
  invoiceLinksRepository,
} from '../src/invoices/repository';
import { computeEstimate } from '../src/estimator/compute';
import { getEstimatorConfig } from '../src/estimator/config';
import { createInvoiceFromEstimate } from '../src/invoices/create';
import { issueInvoice } from '../src/invoices/issue';
import { prepareInvoiceShare } from '../src/invoices/share';
import {
  sendOrderNotification,
  notificationRepository,
} from '../src/notifications/notificationEngine';
import { Order } from '../src/types/order';

const ownerVerified: UserProfile = {
  id: 'usr-owner-01',
  role: 'owner',
  isActive: true,
  fullName: 'Chef Esther',
  email: 'estherkwentua@gmail.com',
  hasMfaVerified: true,
};

const ownerUnverified: UserProfile = {
  ...ownerVerified,
  hasMfaVerified: false,
};

const staffUser: UserProfile = {
  id: 'usr-staff-01',
  role: 'staff',
  isActive: true,
  fullName: 'Kitchen Staff',
  email: 'staff@rockucfoods.com',
  hasMfaVerified: true,
};

function seedValidEstimate(
  overrides: { id?: string; guests?: number; validUntil?: string; phone?: string } = {}
) {
  const config = getEstimatorConfig();
  const guests = overrides.guests ?? 30;
  const computed = computeEstimate(
    { tierId: config.tiers[0].id, guestCount: guests, selectedAddOns: [] },
    config
  );
  const id = overrides.id ?? `est-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return estimateRepository.save({
    id,
    configVersion: config.version,
    inputs: {
      packageId: config.tiers[0].id,
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
    validUntil: overrides.validUntil ?? new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    contactPhone: overrides.phone,
  });
}

describe('Section 31.6: DB-Backed Operational Kill Switches, Alerts & Live Drills', () => {
  beforeEach(() => {
    resetOperationalState();
    resetAuditFailureState();
    clearAuditLog();
    resetRateLimitStore();
    estimateRepository.clear();
    invoiceRepository.clear();
    invoiceLinksRepository.clear();
    notificationRepository.clear();
  });

  afterEach(() => {
    setAuditPersistenceWriter(null);
  });

  describe('1. Operational Kill Switches (DB-Backed Admin Controls)', () => {
    it('blocks customer invoice creation (503) when owner pauses invoice requests in DB settings', async () => {
      setKillSwitchState({ invoiceRequestsPaused: true }, ownerVerified, 'Routine maintenance');
      expect(isInvoiceRequestsPaused()).toBe(true);

      const est = seedValidEstimate();

      let caught: unknown;
      try {
        await createInvoiceFromEstimate(est.id, { name: 'Ada Lovelace', phone: '08033729125' });
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ServiceUnavailableError);
      expect((caught as ServiceUnavailableError).statusCode).toBe(503);
      expect((caught as Error).message).toContain('+2348033729125');

      const audits = getAuditEvents().filter(
        (a) => a.action === 'ops.invoice_request_blocked_by_kill_switch'
      );
      expect(audits.length).toBe(1);
    });

    it('enforces Owner + Second-Factor MFA to toggle DB operational switches at runtime', () => {
      expect(() =>
        setKillSwitchState({ invoiceRequestsPaused: true }, staffUser, 'Staff attempt')
      ).toThrow(AuthorizationError);

      expect(() =>
        setKillSwitchState({ invoiceRequestsPaused: true }, ownerUnverified, 'Missing MFA')
      ).toThrow(AuthorizationError);

      const updated = setKillSwitchState(
        { invoiceRequestsPaused: true, whatsappSendPaused: true },
        ownerVerified,
        'Emergency menu pricing maintenance'
      );

      expect(updated.invoiceRequestsPaused).toBe(true);
      expect(updated.whatsappSendPaused).toBe(true);
      expect(updated.updatedBy).toBe(ownerVerified.id);

      const audit = getAuditEvents().find((a) => a.action === 'ops.kill_switch_updated');
      expect(audit).toBeDefined();
      expect(audit?.details?.invoiceRequestsPaused).toBe(true);
    });

    it('blocks WhatsApp invoice share (503) and pauses WhatsApp outbox dispatch when DB whatsappSendPaused is active', async () => {
      const est = seedValidEstimate();
      const created = await createInvoiceFromEstimate(est.id, {
        name: 'Tunde Bakare',
        phone: '08033729125',
      });
      issueInvoice(created.invoice.id, ownerVerified);

      setKillSwitchState({ whatsappSendPaused: true }, ownerVerified, 'WhatsApp outage pause');
      expect(isWhatsappSendPaused()).toBe(true);

      await expect(prepareInvoiceShare(created.invoice.publicRef, ownerVerified)).rejects.toThrow(
        ServiceUnavailableError
      );

      const sampleOrder: Order = {
        id: 'ord-ks-01',
        orderCode: 'RUC-20261112-KS01',
        customerName: 'Ngozi Okafor',
        customerPhone: '+2348033729125',
        deliveryType: 'collection',
        deliveryFeeKobo: 0n,
        subtotalKobo: 350000n,
        totalKobo: 350000n,
        status: 'paid',
        policyVersion: '2026-10-15-v3',
        policyAcceptedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 3600 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      };

      const waNotif = sendOrderNotification(sampleOrder, 'order_confirmed', 'whatsapp');
      expect(waNotif.status).toBe('failed');
      expect(waNotif.whatsAppUrl).toBeUndefined();
      expect(waNotif.errorMessage).toContain('admin WhatsApp operational setting');

      // SMS fallback still dispatches normally
      const smsNotif = sendOrderNotification(sampleOrder, 'order_confirmed', 'sms');
      expect(smsNotif.status).toBe('sent');
    });
  });

  describe('2. Proactive Alerts (Draft > 2 Hours & Audit Write Failure)', () => {
    it('fires alert once when a draft invoice waits > 2 hours, without leaking customer PII', async () => {
      const now = Date.now();
      const threeHoursAgo = now - 3 * 60 * 60 * 1000;
      const oneHourAgo = now - 1 * 60 * 60 * 1000;

      const estOld = seedValidEstimate({ id: 'est-stale-1' });
      const oldDraft = await createInvoiceFromEstimate(
        estOld.id,
        { name: 'Stale Client', phone: '08031112233', email: 'private@client.ng' },
        { nowMs: threeHoursAgo }
      );

      const estFresh = seedValidEstimate({ id: 'est-fresh-1', guests: 40 });
      await createInvoiceFromEstimate(
        estFresh.id,
        { name: 'Fresh Client', phone: '08039998877' },
        { nowMs: oneHourAgo }
      );

      const capturedAlerts: OperationalAlert[] = [];
      const firstRun = await checkStaleDraftInvoices({
        nowMs: now,
        sendAlertFn: (alert) => {
          capturedAlerts.push(alert);
        },
      });

      expect(firstRun.staleDrafts.length).toBe(1);
      expect(firstRun.staleDrafts[0].publicRef).toBe(oldDraft.invoice.publicRef);
      expect(firstRun.staleDrafts[0].waitingMinutes).toBeGreaterThanOrEqual(180);
      expect(firstRun.alertsDispatched.length).toBe(1);

      const serialized = JSON.stringify(capturedAlerts[0]);
      expect(serialized).not.toContain('08031112233');
      expect(serialized).not.toContain('+2348031112233');
      expect(serialized).not.toContain('private@client.ng');
      expect(capturedAlerts[0].recipients).toContain('estherkwentua@gmail.com');

      const secondRun = await checkStaleDraftInvoices({
        nowMs: now + 60000,
        sendAlertFn: (alert) => {
          capturedAlerts.push(alert);
        },
      });
      expect(secondRun.staleDrafts.length).toBe(1);
      expect(secondRun.staleDrafts[0].alreadyAlerted).toBe(true);
      expect(secondRun.alertsDispatched.length).toBe(0);
    });

    it('captures audit persistence errors and triggers immediate critical operational alert', () => {
      const receivedAlerts: OperationalAlert[] = [];
      const unsub = attachAuditFailureAlertMonitor((alert) => {
        receivedAlerts.push(alert);
      });

      setAuditPersistenceWriter(() => {
        throw new Error('Disk full / PostgreSQL audit table unavailable');
      });

      recordAudit({
        action: 'invoice.issued',
        entity: 'invoice',
        entityId: 'inv-audit-fail-01',
        actorId: 'usr-owner-01',
        actorRole: 'owner',
      });

      unsub();

      expect(getAuditFailureCount()).toBe(1);
      expect(receivedAlerts.length).toBe(1);
      expect(receivedAlerts[0].type).toBe('audit_write_failure');
      expect(receivedAlerts[0].severity).toBe('critical');
      expect(receivedAlerts[0].message).toContain('invoice.issued');
    });
  });

  describe('3. Live Verification Drills (Limiter Down, DB Down, DB Operational Switches)', () => {
    it('passes all fault-injection drills and restores clean operational state', async () => {
      const result = await runOperationalDrills(ownerVerified);

      expect(result.allPassed).toBe(true);
      expect(result.steps.map((s) => s.name)).toEqual([
        'drill_limiter_down_fail_closed',
        'drill_database_down_graceful_handoff',
        'drill_audit_write_failure_alert',
        'drill_kill_switches_block_traffic',
      ]);
      for (const step of result.steps) {
        expect(step.passed).toBe(true);
      }

      const status = getKillSwitchStatus();
      expect(status.invoiceRequestsPaused).toBe(false);
      expect(status.whatsappSendPaused).toBe(false);
    });
  });

  describe('4. Section 31 Findings 5, 7, 8 Verification', () => {
    it('Finding 5: refuses owner issuance of draft invoice once estimate validity (48h) expires', async () => {
      const now = Date.now();
      const est = seedValidEstimate({
        validUntil: new Date(now + 48 * 3600 * 1000).toISOString(),
      });
      const draft = await createInvoiceFromEstimate(
        est.id,
        { name: 'Bisi Adebayo', phone: '08035554433' },
        { nowMs: now }
      );

      const tenDaysLaterIso = new Date(now + 10 * 24 * 3600 * 1000).toISOString();
      expect(() =>
        issueInvoice(draft.invoice.id, ownerVerified, { nowIso: tenDaysLaterIso })
      ).toThrow(/has expired/);
    });

    it('Finding 7: returns existing unexpired draft for same phone & inputs instead of 429 lockout', async () => {
      const est1 = seedValidEstimate({ id: 'est-f7-1', guests: 50 });
      const created = await createInvoiceFromEstimate(
        est1.id,
        { name: 'Genuine Client', phone: '08037776655' },
        { ip: '192.168.1.99' }
      );

      const est2 = seedValidEstimate({ id: 'est-f7-2', guests: 50 });
      const replayed = await createInvoiceFromEstimate(
        est2.id,
        { name: 'Genuine Client', phone: '08037776655' },
        {
          ip: '192.168.1.99',
          checkRateLimitFn: () => ({ allowed: false, remaining: 0, resetInMs: 600000 }),
        }
      );

      expect(replayed.isExisting).toBe(true);
      expect(replayed.invoice.id).toBe(created.invoice.id);
    });

    it('Finding 8: sorts drafts first and auto-expires drafts whose estimate validity elapsed', async () => {
      const now = Date.now();
      const estIssued = seedValidEstimate({ id: 'est-f8-issued', guests: 25 });
      const issuedRes = await createInvoiceFromEstimate(estIssued.id, {
        name: 'Issued Client',
        phone: '08031110001',
      });
      issueInvoice(issuedRes.invoice.id, ownerVerified);

      const estActiveDraft = seedValidEstimate({ id: 'est-f8-active', guests: 35 });
      const activeDraftRes = await createInvoiceFromEstimate(estActiveDraft.id, {
        name: 'Active Draft Client',
        phone: '08031110002',
      });

      const estExpiredDraft = seedValidEstimate({
        id: 'est-f8-expired',
        guests: 45,
        validUntil: new Date(now + 1000).toISOString(),
      });
      const expiredDraftRes = await createInvoiceFromEstimate(
        estExpiredDraft.id,
        { name: 'Expired Draft Client', phone: '08031110003' },
        { nowMs: now }
      );

      estExpiredDraft.validUntil = new Date(now - 60 * 1000).toISOString();
      estimateRepository.save(estExpiredDraft);

      const listed = invoiceRepository.getAll({ autoExpireDrafts: true });
      expect(listed[0].id).toBe(activeDraftRes.invoice.id);
      expect(listed[0].status).toBe('draft');

      const expiredAfter = invoiceRepository.getById(expiredDraftRes.invoice.id);
      expect(expiredAfter?.status).toBe('void');
      expect(expiredAfter?.voidReason).toContain('Auto-expired');
    });
  });
});
