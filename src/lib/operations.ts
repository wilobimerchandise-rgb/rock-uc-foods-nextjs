/**
 * ROCK UC FOODS - Operational Kill Switches & Proactive Alerts
 * Playbook v2 Section 31.6 (Operational Readiness)
 *
 * Features:
 * 1. Kill switches for customer invoice requests and WhatsApp sending (env + owner runtime toggle).
 * 2. Stale draft monitoring: alerts Chef Esther & team when any draft invoice waits > 2 hours.
 * 3. Audit write failure alerting: captures and dispatches immediate operational alerts if audit logging fails.
 */

import { invoiceRepository, estimateRepository } from '../invoices/repository';
import { requireRole, UserProfile } from './auth/access';
import { recordAudit, onAuditWriteFailure } from './audit';
import { logWarn, logError } from './logger';
import { getDbOpsSettings, setDbOpsSettings, resetDbOpsSettings } from './businessSettings';

export const DRAFT_STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours (Section 31.6)

export const DEFAULT_ALERT_RECIPIENTS = [
  'rock-uc-foods@gmail.com',
  'estherkwentua@gmail.com',
];

export class ServiceUnavailableError extends Error {
  public statusCode = 503;
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export interface KillSwitchState {
  invoiceRequestsPaused: boolean;
  whatsappSendPaused: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface OperationalAlert {
  id: string;
  type: 'stale_draft_invoice' | 'audit_write_failure' | 'kill_switch_activated';
  severity: 'warning' | 'critical';
  message: string;
  entityId: string;
  publicRef?: string;
  waitingMinutes?: number;
  recipients: string[];
  createdAt: string;
}

interface RuntimeOpsState {
  alertedStaleDraftIds: Set<string>;
  alertsLog: OperationalAlert[];
}

const opsState: RuntimeOpsState = {
  alertedStaleDraftIds: new Set<string>(),
  alertsLog: [],
};

export function isInvoiceRequestsPaused(): boolean {
  return getDbOpsSettings().invoiceRequestsPaused;
}

export function isWhatsappSendPaused(): boolean {
  return getDbOpsSettings().whatsappSendPaused;
}

export function getKillSwitchStatus(): KillSwitchState {
  return getDbOpsSettings();
}

/**
 * Admin/Owner-only with second-factor rule: persists operational toggles in database settings.
 */
export function setKillSwitchState(
  switches: Partial<{ invoiceRequestsPaused: boolean; whatsappSendPaused: boolean }>,
  actor: UserProfile,
  reason: string = 'Owner operational toggle'
): KillSwitchState {
  requireRole(['owner'], actor, 'update operational kill switches', 'ops-kill-switches', {
    requireSecondFactor: true,
  });

  if (!reason || reason.trim().length < 3) {
    throw new Error('A brief reason (minimum 3 characters) is required to toggle kill switches.');
  }

  const nowIso = new Date().toISOString();
  const status = setDbOpsSettings(switches, actor);

  recordAudit({
    action: 'ops.kill_switch_updated',
    entity: 'operations',
    entityId: 'kill-switches',
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      invoiceRequestsPaused: status.invoiceRequestsPaused,
      whatsappSendPaused: status.whatsappSendPaused,
      reason: reason.trim(),
    },
  });

  if (status.invoiceRequestsPaused || status.whatsappSendPaused) {
    const alert: OperationalAlert = {
      id: `alert-ks-${Date.now()}`,
      type: 'kill_switch_activated',
      severity: 'warning',
      message: `Kill switch updated by owner: invoiceRequestsPaused=${status.invoiceRequestsPaused}, whatsappSendPaused=${status.whatsappSendPaused}`,
      entityId: 'kill-switches',
      recipients: getConfiguredAlertRecipients(),
      createdAt: nowIso,
    };
    opsState.alertsLog.push(alert);
    logWarn(alert.message, { entityId: alert.entityId });
  }

  return status;
}

export function getConfiguredAlertRecipients(): string[] {
  const raw = process.env.ORDER_ALERT_EMAILS;
  if (!raw || !raw.trim()) return [...DEFAULT_ALERT_RECIPIENTS];
  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
  return parsed.length > 0 ? parsed : [...DEFAULT_ALERT_RECIPIENTS];
}

export interface StaleDraftCheckResult {
  checkedAt: string;
  staleDrafts: Array<{
    invoiceId: string;
    publicRef: string;
    createdAt: string;
    waitingMinutes: number;
    alreadyAlerted: boolean;
  }>;
  alertsDispatched: OperationalAlert[];
}

/**
 * Scans draft invoices and fires alerts when any draft has waited > 2 hours
 * without owner review/issuance (and has not yet expired).
 * Never includes customer phone, email, or access token in alerts or audits.
 */
export async function checkStaleDraftInvoices(
  options: {
    nowMs?: number;
    thresholdMs?: number;
    forceResend?: boolean;
    sendAlertFn?: (alert: OperationalAlert) => Promise<void> | void;
  } = {}
): Promise<StaleDraftCheckResult> {
  const {
    nowMs = Date.now(),
    thresholdMs = DRAFT_STALE_THRESHOLD_MS,
    forceResend = false,
    sendAlertFn,
  } = options;

  const checkedAt = new Date(nowMs).toISOString();
  const invoices = invoiceRepository.getAll({ autoExpireDrafts: true });
  const staleDrafts: StaleDraftCheckResult['staleDrafts'] = [];
  const alertsDispatched: OperationalAlert[] = [];
  const recipients = getConfiguredAlertRecipients();

  for (const inv of invoices) {
    if (inv.status !== 'draft') continue;

    // Skip if underlying estimate already expired
    const est = estimateRepository.getById(inv.estimateId);
    if (est && new Date(est.validUntil).getTime() <= nowMs) {
      continue;
    }

    const createdMs = new Date(inv.createdAt).getTime();
    const ageMs = nowMs - createdMs;
    if (ageMs <= thresholdMs) continue;

    const waitingMinutes = Math.floor(ageMs / 60000);
    const alreadyAlerted = opsState.alertedStaleDraftIds.has(inv.id);

    staleDrafts.push({
      invoiceId: inv.id,
      publicRef: inv.publicRef,
      createdAt: inv.createdAt,
      waitingMinutes,
      alreadyAlerted,
    });

    if (!alreadyAlerted || forceResend) {
      const alert: OperationalAlert = {
        id: `alert-draft-${inv.publicRef}-${nowMs}`,
        type: 'stale_draft_invoice',
        severity: 'warning',
        message: `Draft invoice ${inv.publicRef} has been waiting ${waitingMinutes} minutes (> 2 hours) for owner review.`,
        entityId: inv.id,
        publicRef: inv.publicRef,
        waitingMinutes,
        recipients,
        createdAt: checkedAt,
      };

      try {
        if (sendAlertFn) {
          await sendAlertFn(alert);
        } else {
          logWarn(alert.message, { publicRef: inv.publicRef, waitingMinutes });
        }
        opsState.alertedStaleDraftIds.add(inv.id);
        opsState.alertsLog.push(alert);
        alertsDispatched.push(alert);

        recordAudit({
          action: 'ops.stale_draft_alert',
          entity: 'invoice',
          entityId: inv.id,
          actorId: 'system',
          actorRole: 'system',
          details: {
            publicRef: inv.publicRef,
            waitingMinutes,
          },
        });
      } catch (err) {
        logError('Failed to dispatch stale draft alert', err, { publicRef: inv.publicRef });
      }
    }
  }

  return {
    checkedAt,
    staleDrafts,
    alertsDispatched,
  };
}

/**
 * Registers the operational alert listener onto audit write failures.
 * Idempotent: returns unsubscribe handler.
 */
export function attachAuditFailureAlertMonitor(
  customNotifier?: (alert: OperationalAlert) => void
): () => void {
  return onAuditWriteFailure((error, event) => {
    const alert: OperationalAlert = {
      id: `alert-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'audit_write_failure',
      severity: 'critical',
      message: `Audit log write failed for action '${event.action}' on entity '${event.entity}'.`,
      entityId: event.entityId,
      recipients: getConfiguredAlertRecipients(),
      createdAt: new Date().toISOString(),
    };
    opsState.alertsLog.push(alert);
    logError(alert.message, error, {
      action: event.action,
      entity: event.entity,
    });
    if (customNotifier) {
      customNotifier(alert);
    }
  });
}

export function getOperationalAlerts(): OperationalAlert[] {
  return [...opsState.alertsLog];
}

export function resetOperationalState(): void {
  resetDbOpsSettings();
  opsState.alertedStaleDraftIds.clear();
  opsState.alertsLog.length = 0;
}
