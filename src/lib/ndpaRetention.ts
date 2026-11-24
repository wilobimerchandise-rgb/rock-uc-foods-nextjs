/**
 * ROCK UC FOODS - NDPA Customer Phone Retention & Redaction Utility
 * Playbook v2 Section 31.6 ("Automatic removal of old phone numbers (Nigeria Data Protection Act)")
 *
 * Redacts personal contact details (phone numbers & emails) from completed/expired orders,
 * expired estimates, and historical outbox notifications after the retention window,
 * while strictly preserving all bigint kobo totals, line item snapshots, and order codes.
 */

import { orderRepository } from '../order/orderRepository';
import { estimateRepository } from '../invoices/repository';
import { notificationRepository } from '../notifications/notificationEngine';
import { recordAudit } from './audit';
import { logInfo } from './logger';
import { OrderStatus } from '../types/order';

export const DEFAULT_NDPA_RETENTION_DAYS = 90;
export const NDPA_REDACTED_MARKER = '[REDACTED_NDPA]';

const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>(['delivered', 'cancelled']);

export interface NdpaPruneResult {
  executedAt: string;
  retentionDays: number;
  cutoffIso: string;
  ordersPruned: number;
  estimatesPruned: number;
  notificationsPruned: number;
}

export function pruneExpiredCustomerPhones(
  options: {
    nowMs?: number;
    retentionDays?: number;
  } = {}
): NdpaPruneResult {
  const { nowMs = Date.now(), retentionDays = DEFAULT_NDPA_RETENTION_DAYS } = options;

  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    throw new Error('NDPA retentionDays must be at least 1 day.');
  }

  const cutoffMs = nowMs - retentionDays * 24 * 60 * 60 * 1000;
  const executedAt = new Date(nowMs).toISOString();
  const cutoffIso = new Date(cutoffMs).toISOString();

  let ordersPruned = 0;
  let estimatesPruned = 0;
  let notificationsPruned = 0;

  // 1. Prune terminal orders older than cutoff while keeping financial & item snapshots intact
  for (const order of orderRepository.getAll()) {
    const isTerminal = TERMINAL_ORDER_STATUSES.has(order.status);
    const isExpiredPending =
      order.status === 'pending_payment' &&
      Boolean(order.expiresAt) &&
      new Date(order.expiresAt).getTime() < cutoffMs;
    if (!isTerminal && !isExpiredPending) continue;
    const referenceMs = new Date(order.updatedAt || order.createdAt).getTime();
    if (referenceMs >= cutoffMs) continue;

    const needsPhoneRedact = order.customerPhone !== NDPA_REDACTED_MARKER;
    const needsEmailRedact = Boolean(order.customerEmail);
    if (needsPhoneRedact || needsEmailRedact) {
      orderRepository.save({
        ...order,
        customerPhone: NDPA_REDACTED_MARKER,
        customerEmail: undefined,
      });
      ordersPruned += 1;
    }
  }

  // 2. Prune expired estimates older than cutoff
  for (const est of estimateRepository.getAll()) {
    const validUntilMs = new Date(est.validUntil).getTime();
    if (validUntilMs >= cutoffMs) continue;

    const needsPhoneRedact = Boolean(est.contactPhone && est.contactPhone !== NDPA_REDACTED_MARKER);
    const needsEmailRedact = Boolean(est.contactEmail);
    if (needsPhoneRedact || needsEmailRedact) {
      estimateRepository.save({
        ...est,
        contactPhone: est.contactPhone ? NDPA_REDACTED_MARKER : undefined,
        contactEmail: undefined,
      });
      estimatesPruned += 1;
    }
  }

  // 3. Prune historical notification outbox entries older than cutoff
  for (const notif of notificationRepository.getAllNotifications()) {
    const createdMs = new Date(notif.createdAt).getTime();
    if (createdMs >= cutoffMs) continue;

    const needsPhoneRedact = notif.recipientPhone !== NDPA_REDACTED_MARKER;
    const needsUrlRedact = Boolean(notif.whatsAppUrl);
    if (needsPhoneRedact || needsUrlRedact) {
      notificationRepository.saveNotification({
        ...notif,
        recipientPhone: NDPA_REDACTED_MARKER,
        whatsAppUrl: undefined,
      });
      notificationsPruned += 1;
    }
  }

  // Record audit with zero PII (counts only)
  recordAudit({
    action: 'compliance.ndpa_phone_pruned',
    entity: 'customer_pii',
    entityId: cutoffIso.slice(0, 10),
    actorId: 'system',
    actorRole: 'system',
    details: {
      retentionDays,
      ordersPruned,
      estimatesPruned,
      notificationsPruned,
    },
  });

  logInfo('NDPA customer phone retention sweep completed', {
    retentionDays,
    ordersPruned,
    estimatesPruned,
    notificationsPruned,
  });

  return {
    executedAt,
    retentionDays,
    cutoffIso,
    ordersPruned,
    estimatesPruned,
    notificationsPruned,
  };
}
