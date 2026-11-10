/**
 * ROCK UC FOODS - Phase 1D Invoice & Estimate Types
 * Playbook v4 Section 20 / Phase 1D
 */

export interface StoredEstimate {
  id: string;
  configVersion: number;
  inputs: {
    packageId: string; // matches tierId in config
    guests: number;
    zoneId?: string;
    addOnIds?: string[];
  };
  result: {
    foodSubtotalKobo: string;
    addOnsSubtotalKobo: string;
    serviceChargeKobo: string;
    logisticsKobo: string;
    grandTotalKobo: string;
    depositKobo: string;
    balanceKobo: string;
  };
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  createdAt: string;
  validUntil: string;
}

export type InvoiceStatus = 'draft' | 'issued' | 'void' | 'superseded';

export interface InvoiceLineItem {
  name: string;
  quantity: number;
  unitPriceKobo: string;
  lineTotalKobo: string;
}

export interface StoredInvoice {
  id: string;
  publicRef: string; // EVT-YYYYMMDD-XXXX
  estimateId: string;
  revision: number;
  status: InvoiceStatus;
  lines: InvoiceLineItem[];
  totalKobo: bigint;
  depositKobo: bigint;
  balanceKobo: bigint;
  accessTokenHash: string;
  issuedBy?: string;
  issuedAt?: string;
  createdAt: string;
  label?: string; // e.g. 'Needs team confirmation' for 21+ guests
  voidReason?: string;
  revisedAt?: string;
  revisedBy?: string;
  revisionReason?: string;
}

export interface InvoiceVersionRecord {
  id: string;
  invoiceId: string;
  revision: number;
  publicRef: string;
  snapshot: StoredInvoice;
  reason: string;
  changedBy: string;
  changedAt: string;
}

export interface InvoiceRevisionInput {
  reason: string;
  inputs: {
    packageId: string;
    guests: number;
    zoneId?: string;
    addOnIds?: string[];
  };
}

export interface InvoiceContactInput {
  name: string;
  phone: string;
  email?: string;
}

export interface StoredInvoiceLink {
  id: string;
  invoiceId: string;
  tokenHash: string; // 64-char SHA-256 hex string, never raw token
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface InvoiceSharePayload {
  url?: string;
  message: string;
  phoneProblem: boolean;
  expiresAt: string;
}

