/**
 * ROCK UC FOODS - Invoices & Receipts Type Definitions
 * Playbook v2 Section 10 (Phase 5)
 * All monetary amounts are strictly BigInt integer kobo.
 */

export type InvoiceStatus = 'draft' | 'issued' | 'revised' | 'cancelled' | 'superseded';

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  verifiedByOwner: boolean;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  nameSnapshot: string;
  portionLabel?: string;
  unitPriceKobo: bigint;
  quantity: number;
  lineTotalKobo: bigint;
}

export interface InvoiceVersionRecord {
  id: number;
  invoiceId: string;
  version: number;
  snapshot: Record<string, unknown>;
  changedBy?: string;
  changedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // INV-YYYY-000123
  publicToken: string;   // 128-bit hex (32 characters)
  eventId?: string;
  orderId?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  revisionNumber: number;
  status: InvoiceStatus;
  subtotalKobo: bigint;
  deliveryFeeKobo: bigint;
  discountKobo: bigint;
  taxKobo: bigint;
  totalKobo: bigint;
  depositKobo: bigint;
  balanceKobo: bigint;
  bankDetails?: BankDetails;
  paymentTerms: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  items: InvoiceLineItem[];
}

export interface Receipt {
  id: string;
  receiptNumber: string; // RCT-YYYY-000123
  publicToken: string;   // 128-bit hex (32 characters)
  invoiceId: string;
  paymentId: string;
  paymentDate: string;
  paymentMethod: 'manual_transfer' | 'paystack' | 'bank_deposit';
  amountReceivedKobo: bigint;
  invoiceTotalKobo: bigint;
  paidToDateKobo: bigint;
  balanceKobo: bigint;
  receiptStatus: 'PART PAYMENT' | 'PAID IN FULL';
  timeframeStatus: 'confirmed' | 'Timeframe to be confirmed';
  createdAt: string;
}

export interface CreateInvoiceInput {
  eventId?: string;
  orderId?: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  items: {
    nameSnapshot: string;
    portionLabel?: string;
    unitPriceKobo: bigint;
    quantity: number;
  }[];
  deliveryFeeKobo?: bigint;
  discountKobo?: bigint;
  taxKobo?: bigint;
  paymentTerms?: string;
  dueDate?: string;
  bankDetails?: BankDetails;
}

export interface GenerateReceiptInput {
  invoiceId: string;
  paymentId: string;
  paymentDate: string;
  paymentMethod: 'manual_transfer' | 'paystack' | 'bank_deposit';
  amountReceivedKobo: bigint;
  isDeliveryTimeframeConfirmed: boolean;
  overpaymentReason?: string;
  actorUserId?: string;
}
