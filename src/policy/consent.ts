/**
 * ROCK UC FOODS - Checkout Policy Consent Verification Gate
 * (Playbook v2 Section 17.2 & 17.7)
 * Ensures every submitted order verifies policy acceptance server-side against current version.
 */

import { POLICY_VERSION } from './content';

export interface PolicyConsentPayload {
  acceptedPolicy: boolean;
  policyVersion: string;
}

export interface PolicyAcceptanceRecord {
  orderId: string;
  acceptedPolicy: true;
  policyVersion: string;
  ipHash?: string;
  userAgent?: string;
  acceptedAt: string; // ISO 8601 UTC
}

export class PolicyConsentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolicyConsentError';
  }
}

/**
 * Validates that customer explicitly agreed to the live refund policy before order creation.
 * Rejects false, missing, non-boolean, or stale version consents.
 */
export function validatePolicyConsent(payload: unknown): PolicyConsentPayload {
  if (!payload || typeof payload !== 'object') {
    throw new PolicyConsentError('Missing policy acceptance data.');
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.acceptedPolicy !== 'boolean' || p.acceptedPolicy !== true) {
    throw new PolicyConsentError(
      'You must agree to the Refund & Cancellation Policy before placing an order.'
    );
  }

  if (typeof p.policyVersion !== 'string' || p.policyVersion.trim() !== POLICY_VERSION) {
    throw new PolicyConsentError(
      `Stale policy version accepted (${String(p.policyVersion)}). Please refresh and accept the current policy (${POLICY_VERSION}).`
    );
  }

  return {
    acceptedPolicy: true,
    policyVersion: POLICY_VERSION,
  };
}

/**
 * Creates an immutable acceptance record to append to the order.
 */
export function createPolicyAcceptanceRecord(
  orderId: string,
  ipHash?: string,
  userAgent?: string
): PolicyAcceptanceRecord {
  return {
    orderId,
    acceptedPolicy: true,
    policyVersion: POLICY_VERSION,
    ipHash,
    userAgent,
    acceptedAt: new Date().toISOString(),
  };
}
