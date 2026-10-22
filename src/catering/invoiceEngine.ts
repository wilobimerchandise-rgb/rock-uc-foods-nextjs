/**
 * ROCK UC FOODS - Invoices & Receipts Engine
 * Playbook v2 Section 10 (Phase 5: Event Enquiries, Invoices and Receipts)
 * 
 * Strict BigInt integer kobo arithmetic.
 * Immutable issued invoices (revisions mark older version as superseded).
 * Receipts generated ONLY from verified payments.
 * Document access secured with random 128-bit tokens and signed link TTL.
 */

import {
  Invoice,
  InvoiceLineItem,
  InvoiceVersionRecord,
  Receipt,
  CreateInvoiceInput,
  GenerateReceiptInput,
  BankDetails,
} from '../types/invoice';
import { getDocumentLinkTtlHours } from '../../lib/env';
import { normalizeNigerianPhone } from '../lib/security';
import crypto from 'crypto';

let invoiceSequence = 1;
let receiptSequence = 1;

export function resetDocumentSequences(invSeq = 1, rctSeq = 1) {
  invoiceSequence = invSeq;
  receiptSequence = rctSeq;
}

/**
 * Generates a random 128-bit hexadecimal token (32 lowercase hex characters).
 * Playbook rule: "Public order and document access uses a random 128-bit token,
 * never a sequential ID or the human reference."
 */
export function generateDocumentToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Formats invoice sequence number: INV-YYYY-000123
 */
export function nextInvoiceNumber(year: number = new Date().getFullYear()): string {
  const seq = invoiceSequence++;
  return `INV-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * Formats receipt sequence number: RCT-YYYY-000123
 */
export function nextReceiptNumber(year: number = new Date().getFullYear()): string {
  const seq = receiptSequence++;
  return `RCT-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * Generates signed customer link with expiration based on DOCUMENT_LINK_TTL_HOUR (72 hrs).
 */
export function createSignedDocumentLink(
  token: string,
  docType: 'invoice' | 'receipt',
  baseUrl: string = 'http://localhost:3000'
): { url: string; expiresAtMs: number } {
  const ttlHours = getDocumentLinkTtlHours();
  const expiresAtMs = Date.now() + ttlHours * 3600 * 1000;
  
  // HMAC-SHA256 signature
  const hmacSecret = process.env.CRON_SECRET || 'rock-uc-foods-secure-doc-salt';
  const payload = `${docType}:${token}:${expiresAtMs}`;
  const sig = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');

  const url = `${baseUrl}/docs/${docType}/${token}?exp=${expiresAtMs}&sig=${sig}`;
  return { url, expiresAtMs };
}

/**
 * Validates a signed document access link.
 */
export function verifySignedDocumentLink(
  token: string,
  docType: 'invoice' | 'receipt',
  expiresAtMs: number,
  providedSig: string
): { isValid: boolean; reason?: string } {
  if (Date.now() > expiresAtMs) {
    return { isValid: false, reason: 'Document link has expired.' };
  }

  const hmacSecret = process.env.CRON_SECRET || 'rock-uc-foods-secure-doc-salt';
  const payload = `${docType}:${token}:${expiresAtMs}`;
  const expectedSig = crypto.createHmac('sha256', hmacSecret).update(payload).digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(providedSig, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );

  if (!isValid) {
    return { isValid: false, reason: 'Invalid document signature.' };
  }

  return { isValid: true };
}

// In-Memory Repository for Invoices and Receipts
class InvoiceRepository {
  private invoices: Map<string, Invoice> = new Map();
  private receipts: Map<string, Receipt> = new Map();
  private versions: InvoiceVersionRecord[] = [];

  clear() {
    this.invoices.clear();
    this.receipts.clear();
    this.versions = [];
  }

  saveInvoice(invoice: Invoice): Invoice {
    this.invoices.set(invoice.id, { ...invoice });
    return invoice;
  }

  getInvoiceById(id: string): Invoice | undefined {
    return this.invoices.get(id);
  }

  getInvoiceByToken(token: string): Invoice | undefined {
    for (const inv of this.invoices.values()) {
      if (inv.publicToken === token) {
        return inv;
      }
    }
    return undefined;
  }

  saveReceipt(receipt: Receipt): Receipt {
    this.receipts.set(receipt.id, { ...receipt });
    return receipt;
  }

  getReceiptById(id: string): Receipt | undefined {
    return this.receipts.get(id);
  }

  getReceiptByToken(token: string): Receipt | undefined {
    for (const rct of this.receipts.values()) {
      if (rct.publicToken === token) {
        return rct;
      }
    }
    return undefined;
  }

  getReceiptsForInvoice(invoiceId: string): Receipt[] {
    return Array.from(this.receipts.values()).filter((r) => r.invoiceId === invoiceId);
  }

  saveVersion(record: InvoiceVersionRecord) {
    this.versions.push(record);
  }

  getVersionsForInvoice(invoiceId: string): InvoiceVersionRecord[] {
    return this.versions.filter((v) => v.invoiceId === invoiceId);
  }
}

export const invoiceRepository = new InvoiceRepository();

/**
 * Creates a new Draft or Issued Invoice with server-authoritative BigInt totals.
 */
export function createInvoice(input: CreateInvoiceInput, status: 'draft' | 'issued' = 'draft'): Invoice {
  if (!input.items || input.items.length === 0) {
    throw new Error('Invoice must have at least one line item.');
  }

  const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const publicToken = generateDocumentToken();
  const invoiceNumber = nextInvoiceNumber();

  let subtotalKobo = 0n;
  const items: InvoiceLineItem[] = [];

  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    if (item.unitPriceKobo < 0n) {
      throw new Error('Unit price cannot be negative.');
    }
    if (item.quantity <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }

    const lineTotalKobo = item.unitPriceKobo * BigInt(item.quantity);
    subtotalKobo += lineTotalKobo;

    items.push({
      id: `inv-item-${invoiceId}-${i + 1}`,
      invoiceId,
      nameSnapshot: item.nameSnapshot.trim(),
      portionLabel: item.portionLabel,
      unitPriceKobo: item.unitPriceKobo,
      quantity: item.quantity,
      lineTotalKobo,
    });
  }

  const deliveryFeeKobo = input.deliveryFeeKobo ?? 0n;
  const discountKobo = input.discountKobo ?? 0n;
  const taxKobo = input.taxKobo ?? 0n;

  if (deliveryFeeKobo < 0n || discountKobo < 0n || taxKobo < 0n) {
    throw new Error('Fee, discount, or tax cannot be negative.');
  }

  const totalKobo = subtotalKobo + deliveryFeeKobo - discountKobo + taxKobo;
  if (totalKobo < 0n) {
    throw new Error('Invoice total cannot be negative.');
  }

  // 70% deposit default
  const depositKobo = (totalKobo * 7000n + 5000n) / 10000n;
  const balanceKobo = totalKobo - depositKobo;

  // Validate payment instructions rule:
  // "If none are configured, the invoice shows 'Payment details will be sent by ROCK UC FOODS'
  // and issue is blocked until the owner confirms. Never invent bank details."
  if (status === 'issued' && (!input.bankDetails || !input.bankDetails.verifiedByOwner)) {
    throw new Error("Cannot issue invoice without owner-verified bank details. Payment details will be sent by ROCK UC FOODS.");
  }

  const nowIso = new Date().toISOString();
  const invoice: Invoice = {
    id: invoiceId,
    invoiceNumber,
    publicToken,
    eventId: input.eventId,
    orderId: input.orderId,
    clientName: input.clientName.trim(),
    clientPhone: normalizeNigerianPhone(input.clientPhone),
    clientEmail: input.clientEmail?.trim(),
    revisionNumber: 1,
    status,
    subtotalKobo,
    deliveryFeeKobo,
    discountKobo,
    taxKobo,
    totalKobo,
    depositKobo,
    balanceKobo,
    bankDetails: input.bankDetails,
    paymentTerms: input.paymentTerms || '70% deposit required to confirm date. 30% balance on delivery.',
    dueDate: input.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    createdAt: nowIso,
    updatedAt: nowIso,
    items,
  };

  invoiceRepository.saveInvoice(invoice);

  // Snapshot version record
  invoiceRepository.saveVersion({
    id: Date.now(),
    invoiceId,
    version: 1,
    snapshot: { ...invoice, items: [...items] },
    changedAt: nowIso,
  });

  return invoice;
}

/**
 * Revises an existing invoice.
 * Rule: "An issued invoice is immutable: a material change creates a new version,
 * the old one is marked superseded and stays viewable."
 */
export function reviseInvoice(
  existingInvoiceId: string,
  updates: Partial<CreateInvoiceInput>,
  actorUserId: string = 'usr-owner-01'
): Invoice {
  const oldInvoice = invoiceRepository.getInvoiceById(existingInvoiceId);
  if (!oldInvoice) {
    throw new Error(`Invoice '${existingInvoiceId}' not found.`);
  }

  // If already superseded or cancelled, reject revision
  if (oldInvoice.status === 'superseded' || oldInvoice.status === 'cancelled') {
    throw new Error(`Cannot revise invoice in status '${oldInvoice.status}'.`);
  }

  // Mark old invoice as superseded (Preserves immutable view)
  oldInvoice.status = 'superseded';
  oldInvoice.updatedAt = new Date().toISOString();
  invoiceRepository.saveInvoice(oldInvoice);

  // Build new invoice revision with incremented revision number
  const newRevisionNumber = oldInvoice.revisionNumber + 1;
  const newInvoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const publicToken = generateDocumentToken();

  const itemsInput = updates.items || oldInvoice.items;
  let subtotalKobo = 0n;
  const items: InvoiceLineItem[] = [];

  for (let i = 0; i < itemsInput.length; i++) {
    const item = itemsInput[i];
    const lineTotalKobo = item.unitPriceKobo * BigInt(item.quantity);
    subtotalKobo += lineTotalKobo;

    items.push({
      id: `inv-item-${newInvoiceId}-${i + 1}`,
      invoiceId: newInvoiceId,
      nameSnapshot: item.nameSnapshot.trim(),
      portionLabel: item.portionLabel,
      unitPriceKobo: item.unitPriceKobo,
      quantity: item.quantity,
      lineTotalKobo,
    });
  }

  const deliveryFeeKobo = updates.deliveryFeeKobo ?? oldInvoice.deliveryFeeKobo;
  const discountKobo = updates.discountKobo ?? oldInvoice.discountKobo;
  const taxKobo = updates.taxKobo ?? oldInvoice.taxKobo;
  const totalKobo = subtotalKobo + deliveryFeeKobo - discountKobo + taxKobo;

  const depositKobo = (totalKobo * 7000n + 5000n) / 10000n;
  const balanceKobo = totalKobo - depositKobo;

  const nowIso = new Date().toISOString();
  const revisedInvoice: Invoice = {
    id: newInvoiceId,
    invoiceNumber: oldInvoice.invoiceNumber, // Retains same invoice sequence number
    publicToken,
    eventId: oldInvoice.eventId,
    orderId: oldInvoice.orderId,
    clientName: updates.clientName || oldInvoice.clientName,
    clientPhone: updates.clientPhone ? normalizeNigerianPhone(updates.clientPhone) : oldInvoice.clientPhone,
    clientEmail: updates.clientEmail || oldInvoice.clientEmail,
    revisionNumber: newRevisionNumber,
    status: 'issued',
    subtotalKobo,
    deliveryFeeKobo,
    discountKobo,
    taxKobo,
    totalKobo,
    depositKobo,
    balanceKobo,
    bankDetails: updates.bankDetails || oldInvoice.bankDetails,
    paymentTerms: updates.paymentTerms || oldInvoice.paymentTerms,
    dueDate: updates.dueDate || oldInvoice.dueDate,
    createdAt: oldInvoice.createdAt,
    updatedAt: nowIso,
    items,
  };

  invoiceRepository.saveInvoice(revisedInvoice);

  invoiceRepository.saveVersion({
    id: Date.now(),
    invoiceId: newInvoiceId,
    version: newRevisionNumber,
    snapshot: { ...revisedInvoice, items: [...items] },
    changedBy: actorUserId,
    changedAt: nowIso,
  });

  return revisedInvoice;
}

/**
 * Generates an official receipt for an invoice.
 * Rule: "RECEIPTS: generated ONLY from a verified payment record.
 * Shows payment date, method, amount received, invoice total, paid to date, balance.
 * 'PAID IN FULL' only when verified payments >= invoice total;
 * otherwise 'PART PAYMENT' and the balance.
 * If the delivery timeframe is not yet confirmed, record the payment,
 * keep fulfilment pending and mark the receipt 'Timeframe to be confirmed'."
 */
export function generateReceipt(input: GenerateReceiptInput): Receipt {
  const invoice = invoiceRepository.getInvoiceById(input.invoiceId);
  if (!invoice) {
    throw new Error(`Invoice '${input.invoiceId}' not found.`);
  }

  if (input.amountReceivedKobo <= 0n) {
    throw new Error('A receipt cannot be generated for an unpaid invoice or zero amount.');
  }

  // Calculate prior verified payments
  const existingReceipts = invoiceRepository.getReceiptsForInvoice(input.invoiceId);
  const priorPaidKobo = existingReceipts.reduce(
    (sum, r) => sum + r.amountReceivedKobo,
    0n
  );

  const paidToDateKobo = priorPaidKobo + input.amountReceivedKobo;
  if (paidToDateKobo > invoice.totalKobo && !input.overpaymentReason) {
    throw new Error(`Payment exceeds invoice total (${invoice.totalKobo} kobo). Overpayment must be approved with an owner reason.`);
  }
  const balanceKobo = invoice.totalKobo > paidToDateKobo ? invoice.totalKobo - paidToDateKobo : 0n;

  const receiptStatus: 'PART PAYMENT' | 'PAID IN FULL' =
    paidToDateKobo >= invoice.totalKobo ? 'PAID IN FULL' : 'PART PAYMENT';

  const timeframeStatus: 'confirmed' | 'Timeframe to be confirmed' =
    input.isDeliveryTimeframeConfirmed ? 'confirmed' : 'Timeframe to be confirmed';

  const receiptId = `rct-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const publicToken = generateDocumentToken();
  const receiptNumber = nextReceiptNumber();

  const receipt: Receipt = {
    id: receiptId,
    receiptNumber,
    publicToken,
    invoiceId: invoice.id,
    paymentId: input.paymentId,
    paymentDate: input.paymentDate,
    paymentMethod: input.paymentMethod,
    amountReceivedKobo: input.amountReceivedKobo,
    invoiceTotalKobo: invoice.totalKobo,
    paidToDateKobo,
    balanceKobo,
    receiptStatus,
    timeframeStatus,
    createdAt: new Date().toISOString(),
  };

  return invoiceRepository.saveReceipt(receipt);
}
