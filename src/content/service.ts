/**
 * ROCK UC FOODS - Site Content Service & Validation
 * Playbook v9 Section 25 (Phase 2A)
 *
 * Rules:
 * - Content validation checks every field, never throws, and returns all errors.
 * - Any review without permissionConfirmed === true is refused.
 * - Lead time: 1 to 168 hours (shared default: 24).
 * - Owner-only mutation with second-factor rule and optimistic expectedVersion locking (409 on mismatch).
 * - Audit logging with before/after state.
 */

import {
  SiteContent,
  SiteContentVersion,
  DEFAULT_SITE_CONTENT,
} from './types';
import { normalizeNigerianPhone } from '../notifications/phone';
import { auditLogger } from '../lib/audit';

export interface ValidationResult {
  valid: boolean;
  content?: SiteContent;
  errors: string[];
}

export function validateSiteContent(raw: unknown): ValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, errors: ['Site content must be a non-null object.'] };
  }

  const obj = raw as Record<string, unknown>;

  // 1. Contact validation
  const rawContact = obj.contact as Record<string, unknown> | undefined;
  if (!rawContact || typeof rawContact !== 'object') {
    errors.push('contact section is required.');
  }

  let validContact: SiteContent['contact'] | undefined;
  if (rawContact) {
    const rawWhatsapp = String(rawContact.whatsapp || '').trim();
    const phoneNorm = normalizeNigerianPhone(rawWhatsapp);
    if (!phoneNorm.valid) {
      errors.push(`Invalid WhatsApp number: ${phoneNorm.reason || 'Must be a valid Nigerian phone number.'}`);
    }

    const phone = String(rawContact.phone || '').trim();
    if (!phone) {
      errors.push('Contact phone is required.');
    }

    const showEmail = Boolean(rawContact.showEmail);
    const email = String(rawContact.email || '').trim();
    if (showEmail && (!email || !email.includes('@'))) {
      errors.push('A valid email address is required when showEmail is true.');
    }

    const showAddress = Boolean(rawContact.showAddress);
    const address = String(rawContact.address || '').trim();
    if (address.length > 160) {
      errors.push('Contact address cannot exceed 160 characters.');
    }

    const city = String(rawContact.city || 'Lagos').trim();
    if (city !== 'Lagos') {
      errors.push('Service city must strictly be "Lagos".');
    }

    validContact = {
      whatsapp: phoneNorm.valid ? phoneNorm.e164 : rawWhatsapp,
      phone,
      showEmail,
      email,
      showAddress,
      address,
      city: 'Lagos',
    };
  }

  // 2. Hours validation
  const rawHours = obj.hours as Record<string, unknown> | undefined;
  if (!rawHours || typeof rawHours !== 'object') {
    errors.push('hours section is required.');
  }

  let validHours: SiteContent['hours'] | undefined;
  if (rawHours) {
    const orderingOpen247 = Boolean(rawHours.orderingOpen247);
    const kitchenNote = String(rawHours.kitchenNote || '').trim();
    if (kitchenNote.length > 200) {
      errors.push('kitchenNote cannot exceed 200 characters.');
    }

    const leadTimeHours = Number(rawHours.leadTimeHours);
    if (!Number.isInteger(leadTimeHours) || leadTimeHours < 1 || leadTimeHours > 168) {
      errors.push('leadTimeHours must be an integer between 1 and 168 hours.');
    }

    validHours = {
      orderingOpen247,
      kitchenNote,
      leadTimeHours: Number.isInteger(leadTimeHours) && leadTimeHours >= 1 && leadTimeHours <= 168 ? leadTimeHours : 24,
    };
  }

  // 3. Sections validation
  const rawSections = obj.sections;
  if (!Array.isArray(rawSections)) {
    errors.push('sections must be an array.');
  }

  const validSections: SiteContent['sections'] = [];
  if (Array.isArray(rawSections)) {
    rawSections.forEach((sec, idx) => {
      if (!sec || typeof sec !== 'object') {
        errors.push(`Section at index ${idx} must be an object.`);
        return;
      }
      const s = sec as Record<string, unknown>;
      const categorySlug = String(s.categorySlug || '').trim();
      const displayName = String(s.displayName || '').trim();
      const plainLabel = String(s.plainLabel || '').trim();
      const sortOrder = Number(s.sortOrder) || idx + 1;

      if (!categorySlug) {
        errors.push(`Section ${idx}: categorySlug is required.`);
      }
      if (!displayName || displayName.length > 40) {
        errors.push(`Section ${idx}: displayName must be between 1 and 40 characters.`);
      }
      if (!plainLabel || plainLabel.length > 60) {
        errors.push(`Section ${idx}: plainLabel must be between 1 and 60 characters.`);
      }

      validSections.push({
        categorySlug,
        displayName,
        plainLabel,
        sortOrder,
      });
    });
  }

  // 4. Reviews validation
  const rawReviews = obj.reviews;
  if (!Array.isArray(rawReviews)) {
    errors.push('reviews must be an array.');
  }

  const validReviews: SiteContent['reviews'] = [];
  if (Array.isArray(rawReviews)) {
    if (rawReviews.length > 30) {
      errors.push('Cannot exceed maximum of 30 reviews.');
    }

    rawReviews.forEach((rev, idx) => {
      if (!rev || typeof rev !== 'object') {
        errors.push(`Review at index ${idx} must be an object.`);
        return;
      }
      const r = rev as Record<string, unknown>;
      const quote = String(r.quote || '').trim();
      const name = String(r.name || '').trim();
      const dateText = String(r.dateText || '').trim();
      const permissionConfirmed = Boolean(r.permissionConfirmed);

      if (!quote || quote.length > 400) {
        errors.push(`Review ${idx}: quote must be between 1 and 400 characters.`);
      }
      if (!name || name.length > 60) {
        errors.push(`Review ${idx}: name must be between 1 and 60 characters.`);
      }
      if (dateText.length > 20) {
        errors.push(`Review ${idx}: dateText cannot exceed 20 characters.`);
      }

      // STRICT RULE: permissionConfirmed must be true
      if (!permissionConfirmed) {
        errors.push(
          `Review from "${name || `index ${idx}`}" rejected: permissionConfirmed must be true to publish a customer quote.`
        );
      }

      validReviews.push({
        quote,
        name,
        dateText,
        permissionConfirmed,
      });
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    content: {
      contact: validContact!,
      hours: validHours!,
      sections: validSections,
      reviews: validReviews,
    },
    errors: [],
  };
}

// In-Memory store for Site Content Versions
let currentVersionRecord: SiteContentVersion = {
  version: 1,
  content: DEFAULT_SITE_CONTENT,
  note: 'Seeded default site content',
  createdBy: 'owner@rockucfoods.com',
  createdAt: new Date().toISOString(),
};

const versionHistory: SiteContentVersion[] = [currentVersionRecord];

export function getLatestSiteContentVersion(): SiteContentVersion {
  return currentVersionRecord;
}

export function getLatestSiteContent(): SiteContent {
  return currentVersionRecord.content;
}

export interface SaveContentInput {
  content: unknown;
  note?: string;
  expectedVersion: number;
  actorRole: string;
  actorHasMfa: boolean;
  actorId?: string;
  actorIp?: string;
}

export interface SaveContentResult {
  success: boolean;
  version?: SiteContentVersion;
  statusCode: number;
  error?: string;
  errors?: string[];
}

export async function saveSiteContent(input: SaveContentInput): Promise<SaveContentResult> {
  const { content, note, expectedVersion, actorRole, actorHasMfa, actorId, actorIp } = input;

  // RBAC & Second-Factor check: Owner with verified 2FA only
  if (actorRole !== 'owner') {
    auditLogger.logSecurityAlert('UNAUTHORIZED_SITE_CONTENT_EDIT_ATTEMPT', {
      actorRole,
      actorId,
      actorIp,
      reason: 'Only role=owner can edit public site content.',
    });
    return {
      success: false,
      statusCode: 403,
      error: 'Access denied: only the owner with verified second-factor authentication may edit site content.',
    };
  }

  if (!actorHasMfa) {
    auditLogger.logSecurityAlert('MFA_STEP_UP_REQUIRED_SITE_CONTENT', {
      actorRole,
      actorId,
      actorIp,
      reason: 'Second-factor authentication is required to edit site content.',
    });
    return {
      success: false,
      statusCode: 403,
      error: 'Second-factor authentication (AAL2) required to modify site content.',
    };
  }

  // Optimistic concurrency check
  if (expectedVersion !== currentVersionRecord.version) {
    return {
      success: false,
      statusCode: 409,
      error: `Conflict: Expected version ${expectedVersion} does not match current version ${currentVersionRecord.version}.`,
    };
  }

  // Validation
  const validation = validateSiteContent(content);
  if (!validation.valid || !validation.content) {
    return {
      success: false,
      statusCode: 400,
      error: 'Validation failed.',
      errors: validation.errors,
    };
  }

  const before = currentVersionRecord.content;
  const newVersionNumber = currentVersionRecord.version + 1;

  const newRecord: SiteContentVersion = {
    version: newVersionNumber,
    content: validation.content,
    note: (note || '').slice(0, 200),
    createdBy: actorId || 'owner@rockucfoods.com',
    createdAt: new Date().toISOString(),
  };

  // Append-only commit
  versionHistory.push(newRecord);
  currentVersionRecord = newRecord;

  // Audit log
  auditLogger.logEvent('site_content.update', {
    version: newVersionNumber,
    note: newRecord.note,
    actorId,
    actorIp,
    before,
    after: validation.content,
  });

  return {
    success: true,
    statusCode: 200,
    version: newRecord,
  };
}

export function resetSiteContentForTesting(): void {
  currentVersionRecord = {
    version: 1,
    content: DEFAULT_SITE_CONTENT,
    note: 'Reset for testing',
    createdBy: 'system-seed',
    createdAt: new Date().toISOString(),
  };
  versionHistory.length = 0;
  versionHistory.push(currentVersionRecord);
}
