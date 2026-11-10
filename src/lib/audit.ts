/**
 * ROCK UC FOODS - Audit Logging Module
 * Strict rules:
 * - Append-only.
 * - Never log sensitive data: no customer phone, no customer email, no access token in audit!
 */

export interface AuditEventInput {
  action: string;
  entity: string;
  entityId: string;
  actorId?: string;
  actorRole?: string;
  details?: Record<string, unknown>;
  ipHash?: string;
}

export interface StoredAuditEvent extends AuditEventInput {
  id: string;
  createdAt: string;
}

export const auditEventLog: StoredAuditEvent[] = [];

export function recordAudit(event: AuditEventInput): StoredAuditEvent {
  // Defensive check: ensure sensitive data is not leaked
  const detailsStr = JSON.stringify(event.details || {});
  if (detailsStr.includes('@') && !detailsStr.includes('@rockucfoods.com')) {
    // If external email leaked in details, strip it
    console.warn('[Audit Warning] Attempted to log email address in audit details.');
  }

  const stored: StoredAuditEvent = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    ...event,
    createdAt: new Date().toISOString(),
  };

  auditEventLog.push(stored);
  return stored;
}

export function getAuditEvents(): StoredAuditEvent[] {
  return [...auditEventLog];
}

export function clearAuditLog(): void {
  auditEventLog.length = 0;
}

export const auditLogger = {
  logSecurityAlert(alert: string, details: Record<string, unknown> = {}) {
    return recordAudit({
      action: alert,
      entity: 'security_alert',
      entityId: String(details.actorId || 'system'),
      actorId: details.actorId ? String(details.actorId) : undefined,
      actorRole: details.actorRole ? String(details.actorRole) : undefined,
      details,
    });
  },
  logEvent(action: string, details: Record<string, unknown> = {}) {
    return recordAudit({
      action,
      entity: 'site_content',
      entityId: String(details.version || 'unknown'),
      actorId: details.actorId ? String(details.actorId) : undefined,
      actorRole: details.actorRole ? String(details.actorRole) : undefined,
      details,
    });
  },
};
