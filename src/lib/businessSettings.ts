/**
 * ROCK UC FOODS - Database-Backed Business & Verified Bank Settings Repository
 * Playbook v2 Section 10.4, Section 31.3 (Finding 6) & Manual GTBank Transfer Flow
 *
 * Rules:
 * - Official default bank details stored in settings record (never env secrets):
 *   BANK_NAME = "Guaranty Trust Bank (GTBank)"
 *   ACCOUNT_NAME = "Esther Kwentua"
 *   ACCOUNT_NUMBER = "0013190627" (strictly 10-digit string, preserving leading zeros)
 * - Empty state when bank details missing/unverified blocks checkout with:
 *   "Payment details unavailable, contact us on 08033729125"
 * - Also provides the DB-backed key/value settings table for admin-only operational toggles.
 */

import { BankDetails } from '../types/invoice';
import { requireRole, UserProfile } from './auth/access';
import { recordAudit } from './audit';

export const BANK_NAME = 'Guaranty Trust Bank (GTBank)';
export const ACCOUNT_NAME = 'Esther Kwentua';
export const ACCOUNT_NUMBER = '0013190627';

export const MISSING_BANK_DETAILS_CHECKOUT_MESSAGE =
  'Payment details unavailable, contact us on 08033729125';

export interface StoredBusinessBankSettings extends BankDetails {
  updatedAt: string;
  updatedBy: string;
}

export interface StoredOpsSettings {
  invoiceRequestsPaused: boolean;
  whatsappSendPaused: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

const DEFAULT_VERIFIED_BANK_DETAILS: StoredBusinessBankSettings = {
  bankName: BANK_NAME,
  accountNumber: ACCOUNT_NUMBER,
  accountName: ACCOUNT_NAME,
  verifiedByOwner: true,
  updatedAt: '2026-10-15T00:00:00.000Z',
  updatedBy: 'usr-owner-verified',
};

const DEFAULT_OPS_SETTINGS: StoredOpsSettings = {
  invoiceRequestsPaused: false,
  whatsappSendPaused: false,
  updatedAt: null,
  updatedBy: null,
};

interface BusinessSettingsDbStore {
  bank_transfer_details: StoredBusinessBankSettings | null;
  ops_settings: StoredOpsSettings;
}

const settingsStore: BusinessSettingsDbStore =
  ((globalThis as any).__rockUcBusinessSettingsDb as BusinessSettingsDbStore) || {
    bank_transfer_details: { ...DEFAULT_VERIFIED_BANK_DETAILS },
    ops_settings: { ...DEFAULT_OPS_SETTINGS },
  };
(globalThis as any).__rockUcBusinessSettingsDb = settingsStore;

/**
 * Validates that accountNumber is a string of exact 10 digits (e.g. "0013190627").
 * Never accepts numeric values so leading zeros are guaranteed preserved.
 */
export function validateBankAccountNumber(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new Error('Bank account number must be stored as a 10-digit string to preserve leading zeros.');
  }
  const trimmed = raw.trim();
  if (!/^\d{10}$/.test(trimmed)) {
    throw new Error('Nigerian NUBAN bank account number must be exactly 10 digits.');
  }
  return trimmed;
}

export function getBusinessBankSettings(): StoredBusinessBankSettings | null {
  const row = settingsStore.bank_transfer_details;
  if (!row) return null;
  if (typeof row.accountNumber !== 'string' || !/^\d{10}$/.test(row.accountNumber)) {
    return null;
  }
  return { ...row };
}

export function hasVerifiedBankSettings(override?: BankDetails | null): boolean {
  const target = override !== undefined ? override : settingsStore.bank_transfer_details;
  if (!target) return false;
  return Boolean(
    target.verifiedByOwner &&
      typeof target.bankName === 'string' &&
      target.bankName.trim().length > 0 &&
      typeof target.accountName === 'string' &&
      target.accountName.trim().length > 0 &&
      typeof target.accountNumber === 'string' &&
      /^\d{10}$/.test(target.accountNumber.trim())
  );
}

/**
 * Owner/Admin + Second-Factor MFA only: sets or clears owner-verified bank details.
 */
export function setBusinessBankSettings(
  details: BankDetails | null,
  actor: UserProfile
): StoredBusinessBankSettings | null {
  requireRole(['owner'], actor, 'update business bank settings', 'business-settings', {
    requireSecondFactor: true,
  });

  const nowIso = new Date().toISOString();

  if (details === null) {
    settingsStore.bank_transfer_details = null;
    recordAudit({
      action: 'settings.bank_details_cleared',
      entity: 'business_settings',
      entityId: 'bank_transfer_details',
      actorId: actor.id,
      actorRole: actor.role,
      details: { clearedAt: nowIso },
    });
    return null;
  }

  const bankName = typeof details.bankName === 'string' ? details.bankName.trim() : '';
  const accountName = typeof details.accountName === 'string' ? details.accountName.trim() : '';

  if (!bankName || !accountName) {
    throw new Error('Bank name, account number, and account name are all required.');
  }

  const accountNumber = validateBankAccountNumber(details.accountNumber);

  settingsStore.bank_transfer_details = {
    bankName,
    accountNumber,
    accountName,
    verifiedByOwner: Boolean(details.verifiedByOwner),
    updatedAt: nowIso,
    updatedBy: actor.id,
  };

  recordAudit({
    action: 'settings.bank_details_updated',
    entity: 'business_settings',
    entityId: 'bank_transfer_details',
    actorId: actor.id,
    actorRole: actor.role,
    details: {
      bankName,
      verifiedByOwner: settingsStore.bank_transfer_details.verifiedByOwner,
      accountNumberLast4: accountNumber.slice(-4),
    },
  });

  return { ...settingsStore.bank_transfer_details };
}

/**
 * Reads DB-backed operational toggles (replaces legacy env kill switches).
 */
export function getDbOpsSettings(): StoredOpsSettings {
  return { ...settingsStore.ops_settings };
}

export function setDbOpsSettings(
  updates: Partial<Pick<StoredOpsSettings, 'invoiceRequestsPaused' | 'whatsappSendPaused'>>,
  actor: UserProfile
): StoredOpsSettings {
  requireRole(['owner'], actor, 'update operational settings', 'business-settings', {
    requireSecondFactor: true,
  });

  const nowIso = new Date().toISOString();
  if (typeof updates.invoiceRequestsPaused === 'boolean') {
    settingsStore.ops_settings.invoiceRequestsPaused = updates.invoiceRequestsPaused;
  }
  if (typeof updates.whatsappSendPaused === 'boolean') {
    settingsStore.ops_settings.whatsappSendPaused = updates.whatsappSendPaused;
  }
  settingsStore.ops_settings.updatedAt = nowIso;
  settingsStore.ops_settings.updatedBy = actor.id;

  return { ...settingsStore.ops_settings };
}

export function resetDbOpsSettings(): void {
  settingsStore.ops_settings = { ...DEFAULT_OPS_SETTINGS };
}

export function resetBusinessSettings(): void {
  settingsStore.bank_transfer_details = { ...DEFAULT_VERIFIED_BANK_DETAILS };
  settingsStore.ops_settings = { ...DEFAULT_OPS_SETTINGS };
}
