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

export type InvoiceStatus = 'draft' | 'issued' | 'void';

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
}

export interface InvoiceContactInput {
  name: string;
  phone: string;
  email?: string;
}
