/**
 * ROCK UC FOODS - Security, MFA & Step-Up Types
 * Playbook v4 Section 23
 */

export type UserRole = 'owner' | 'staff' | 'developer' | 'system';

export type SensitiveOperation =
  | 'price_update'
  | 'bank_details_update'
  | 'reconciliation_confirm'
  | 'admin_settings_access'
  | 'menu_item_delete';

export interface MfaCredential {
  userId: string;
  secret: string; // Base32 encoded secret
  isEnabled: boolean;
  backupCodes: string[]; // 8-char codes
  lastUsedStep: number;
  createdAt: string;
  updatedAt: string;
}

export interface StepUpSession {
  token: string;
  userId: string;
  purpose: SensitiveOperation;
  expiresAt: number; // Unix timestamp ms
  createdAt: string;
}

export interface SecurityAuditEvent {
  id: string;
  actorUserId: string;
  actorRole: UserRole;
  eventType:
    | 'mfa.enrolled'
    | 'mfa.verified'
    | 'mfa.failed'
    | 'mfa.backup_code_used'
    | 'step_up.granted'
    | 'step_up.verified'
    | 'step_up.rejected'
    | 'unauthorized_action_blocked';
  ipAddress?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}
