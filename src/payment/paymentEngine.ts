/**
 * ROCK UC FOODS - Manual GTBank Payment Proof, Admin Verification & Reconciliation Engine
 *
 * Rules:
 * - Zero external payment gateways (no Paystack, no client callbacks marking paid).
 * - BigInt integer kobo (*_kobo) throughout. Never float.
 * - Customer submits proof (senderName, transferTime, optional JPG/PNG/PDF <= 5MB).
 * - File MIME type AND magic bytes verified on server; SHA-256 hash deduplicated across orders.
 * - Rate limited per order and per visitor.
 * - One payment reference confirmed once.
 * - Orders unpaid after 7 hours expire; expired orders cannot be confirmed without explicit audited admin reopen.
 * - Only logged-in admin ('owner' | 'staff' | 'developer') can confirm payment; partial payments recorded as 'partial', never 'paid'.
 */

import crypto from 'crypto';
import {
  PaymentRecord,
  OrderPaymentProof,
  SubmitOrderProofInput,
  ConfirmOrderPaymentInput,
  RecordPartialPaymentInput,
  ReopenExpiredOrderInput,
  ManualPaymentSubmissionInput,
  ConfirmManualPaymentInput,
  ReconciliationReport,
  ReconciliationDiscrepancy,
} from '../types/payment';
import { Order, OrderReopenLog } from '../types/order';
import { orderRepository } from '../order/orderRepository';
import { invoiceRepository, createInvoice, generateReceipt } from '../catering/invoiceEngine';
import { getBusinessBankSettings } from '../lib/businessSettings';
import { checkRateLimit, RateLimitError } from '../lib/rate-limit';
import { recordAudit } from '../lib/audit';
import { AuthorizationError } from '../lib/auth/access';

export const MAX_RECEIPT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_RECEIPT_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const PROOF_LIMIT_PER_ORDER = 5;
export const PROOF_LIMIT_PER_VISITOR = 10;
export const PROOF_WINDOW_MS = 10 * 60 * 1000;

export type ValidatedReceiptMime = (typeof ALLOWED_RECEIPT_MIME_TYPES)[number];

class PaymentRepository {
  private payments: Map<string, PaymentRecord> = new Map();
  private proofs: Map<string, OrderPaymentProof> = new Map();
  private confirmedReferences: Set<string> = new Set();

  clear() {
    this.payments.clear();
    this.proofs.clear();
    this.confirmedReferences.clear();
  }

  savePayment(record: PaymentRecord): PaymentRecord {
    const cleanRef = record.providerReference.trim().toUpperCase();
    for (const p of this.payments.values()) {
      if (p.id !== record.id && p.providerReference.trim().toUpperCase() === cleanRef) {
        throw new Error(`SECURITY VIOLATION: Payment reference '${record.providerReference}' already exists in ledger.`);
      }
    }
    this.payments.set(record.id, { ...record });
    if (record.status === 'verified') {
      this.confirmedReferences.add(cleanRef);
    }
    return record;
  }

  isReferenceConfirmed(reference: string): boolean {
    const clean = reference.trim().toUpperCase();
    if (this.confirmedReferences.has(clean)) return true;
    for (const p of this.payments.values()) {
      if (p.providerReference.trim().toUpperCase() === clean && p.status === 'verified') {
        return true;
      }
    }
    return false;
  }

  markReferenceConfirmed(reference: string): void {
    this.confirmedReferences.add(reference.trim().toUpperCase());
  }

  getPaymentById(id: string): PaymentRecord | undefined {
    return this.payments.get(id);
  }

  getPaymentByReference(ref: string): PaymentRecord | undefined {
    const clean = ref.trim().toLowerCase();
    for (const p of this.payments.values()) {
      if (p.providerReference.trim().toLowerCase() === clean) {
        return p;
      }
    }
    return undefined;
  }

  getPaymentsForOrder(orderId: string): PaymentRecord[] {
    return Array.from(this.payments.values()).filter((p) => p.orderId === orderId);
  }

  getPaymentsForInvoice(invoiceId: string): PaymentRecord[] {
    return Array.from(this.payments.values()).filter((p) => p.invoiceId === invoiceId);
  }

  getAllPayments(): PaymentRecord[] {
    return Array.from(this.payments.values());
  }

  saveProof(proof: OrderPaymentProof): OrderPaymentProof {
    this.proofs.set(proof.id, { ...proof });
    return proof;
  }

  getProofsForOrder(orderId: string): OrderPaymentProof[] {
    return Array.from(this.proofs.values())
      .filter((p) => p.orderId === orderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  findProofByReceiptHash(hash: string): OrderPaymentProof | undefined {
    for (const proof of this.proofs.values()) {
      if (proof.receiptSha256 === hash) {
        return proof;
      }
    }
    return undefined;
  }

  findProofByReference(reference: string): OrderPaymentProof | undefined {
    const clean = reference.trim().toUpperCase();
    for (const proof of this.proofs.values()) {
      if (proof.paymentReference.trim().toUpperCase() === clean) {
        return proof;
      }
    }
    return undefined;
  }
}

const globalPaymentRepo =
  ((globalThis as any).__rockUcPaymentRepo as PaymentRepository) || new PaymentRepository();
(globalThis as any).__rockUcPaymentRepo = globalPaymentRepo;

export const paymentRepository: PaymentRepository = globalPaymentRepo;

/**
 * Server-side validation of receipt upload type (JPG/PNG/PDF), size (<= 5 MB),
 * magic bytes signature, and SHA-256 digest.
 */
export function validateReceiptFile(file: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Uint8Array;
}): { mimeType: ValidatedReceiptMime; sizeBytes: number; sha256: string } {
  const bytes = file.buffer;
  const actualSize = bytes?.byteLength ?? 0;

  if (!bytes || actualSize === 0 || file.sizeBytes <= 0) {
    throw new Error('Uploaded receipt file is empty.');
  }

  if (actualSize > MAX_RECEIPT_SIZE_BYTES || file.sizeBytes > MAX_RECEIPT_SIZE_BYTES) {
    throw new Error('Receipt file exceeds the maximum allowed size of 5 MB.');
  }

  const normalizedMime = file.mimeType.trim().toLowerCase() === 'image/jpg'
    ? 'image/jpeg'
    : file.mimeType.trim().toLowerCase();

  let detectedMime: ValidatedReceiptMime | null = null;

  // JPEG magic: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    detectedMime = 'image/jpeg';
  }
  // PNG magic: 89 50 4E 47 0D 0A 1A 0A
  else if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    detectedMime = 'image/png';
  }
  // PDF magic: %PDF-
  else if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    detectedMime = 'application/pdf';
  }

  if (!detectedMime || !ALLOWED_RECEIPT_MIME_TYPES.includes(detectedMime)) {
    throw new Error('Unsupported receipt format. Only genuine JPG, PNG, or PDF files are accepted.');
  }

  if (normalizedMime !== detectedMime) {
    throw new Error(
      `Receipt file signature (${detectedMime}) does not match declared file type (${file.mimeType}).`
    );
  }

  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');

  return {
    mimeType: detectedMime,
    sizeBytes: actualSize,
    sha256,
  };
}

function assertLoggedInAdmin(actorRole: string, actorUserId: string, actionLabel: string): void {
  const allowedAdminRoles = ['owner', 'staff', 'developer'];
  if (!actorUserId || !actorUserId.trim() || !allowedAdminRoles.includes(actorRole)) {
    throw new AuthorizationError(
      `Forbidden: Only a logged-in admin can ${actionLabel}.`
    );
  }
}

function assertOrderNotExpiredForPayment(order: Order, nowMs: number): void {
  const expMs = new Date(order.expiresAt).getTime();
  const isTimeExpired = Number.isFinite(expMs) && nowMs > expMs;

  if (order.status === 'expired' || (isTimeExpired && !order.reopenedAt)) {
    if (order.status !== 'expired') {
      orderRepository.updateStatus(order.id, 'expired');
    }
    throw new Error(
      `Order '${order.orderCode}' expired after 7 hours. An admin must explicitly reopen it before payment can be processed.`
    );
  }

  if (isTimeExpired && order.reopenedAt) {
    // Reopened order also passed its extended window
    orderRepository.updateStatus(order.id, 'expired');
    throw new Error(
      `Reopened window for order '${order.orderCode}' has expired. An admin must reopen it again.`
    );
  }
}

/**
 * Customer submits bank transfer proof (never marks the order paid automatically).
 */
export function submitOrderPaymentProof(
  input: SubmitOrderProofInput,
  nowMs: number = Date.now()
): { order: Order; proof: OrderPaymentProof } {
  const order = input.orderId
    ? orderRepository.getById(input.orderId)
    : input.orderCode
    ? orderRepository.getByCode(input.orderCode)
    : undefined;

  if (!order) {
    throw new Error('Order not found for payment proof submission.');
  }

  // Per-order and per-visitor rate limiting (fail closed 429)
  const orderRate = checkRateLimit(
    `proof:order:${order.id}`,
    PROOF_LIMIT_PER_ORDER,
    PROOF_WINDOW_MS
  );
  if (!orderRate.allowed) {
    throw new RateLimitError('Too many proof upload attempts for this order. Please wait and try again.');
  }

  const visitorKey = `proof:visitor:${input.visitorIpHash || 'unknown'}`;
  const visitorRate = checkRateLimit(visitorKey, PROOF_LIMIT_PER_VISITOR, PROOF_WINDOW_MS);
  if (!visitorRate.allowed) {
    throw new RateLimitError('Rate limit exceeded for payment proof submissions. Please try again later.');
  }

  // Block expired or already paid/cancelled orders
  if (order.status === 'paid' || order.status === 'payment_confirmed') {
    throw new Error(`Order '${order.orderCode}' is already confirmed as paid.`);
  }
  if (order.status === 'cancelled') {
    throw new Error(`Order '${order.orderCode}' was cancelled.`);
  }
  assertOrderNotExpiredForPayment(order, nowMs);

  const allowedProofSubmitStatuses = ['pending_payment', 'proof_submitted', 'rejected', 'partial'];
  if (!allowedProofSubmitStatuses.includes(order.status)) {
    throw new Error(`Cannot submit payment proof while order status is '${order.status}'.`);
  }

  const senderName = (input.senderName || '').trim();
  if (senderName.length < 2 || senderName.length > 100) {
    throw new Error('Sender name must be between 2 and 100 characters.');
  }

  const transferTimeRaw = (input.transferTime || '').trim();
  const transferMs = Date.parse(transferTimeRaw);
  if (!transferTimeRaw || Number.isNaN(transferMs)) {
    throw new Error('Please provide a valid transfer date and time.');
  }
  if (transferMs > nowMs + 5 * 60 * 1000) {
    throw new Error('Transfer time cannot be in the future.');
  }

  const cleanRef = (input.paymentReference || order.paymentReference || '').trim().toUpperCase();
  if (cleanRef.length < 6) {
    throw new Error('A valid payment reference (minimum 6 characters) is required.');
  }

  // Prevent reusing a reference confirmed on any order or submitted for another order
  if (paymentRepository.isReferenceConfirmed(cleanRef)) {
    throw new Error(`Duplicate reference: Payment reference '${cleanRef}' has already been confirmed.`);
  }
  const refUsedElsewhere = orderRepository.getByPaymentReference(cleanRef);
  if (refUsedElsewhere && refUsedElsewhere.id !== order.id) {
    throw new Error(`Duplicate reference: Payment reference '${cleanRef}' belongs to another order.`);
  }
  const existingProofRef = paymentRepository.findProofByReference(cleanRef);
  if (existingProofRef && existingProofRef.orderId !== order.id) {
    throw new Error(`Duplicate reference: Payment reference '${cleanRef}' has already been used on another order.`);
  }

  let validatedReceipt:
    | { mimeType: ValidatedReceiptMime; sizeBytes: number; sha256: string }
    | undefined;

  if (input.receiptFile) {
    validatedReceipt = validateReceiptFile(input.receiptFile);

    // Reject duplicate receipt image/PDF hash across DIFFERENT orders
    const existingByHash = paymentRepository.findProofByReceiptHash(validatedReceipt.sha256);
    if (existingByHash && existingByHash.orderId !== order.id) {
      throw new Error(
        `Duplicate proof: This receipt file has already been submitted on another order (${existingByHash.orderCode}).`
      );
    }
    const existingLedgerHash = paymentRepository
      .getAllPayments()
      .find((p) => p.receiptSha256 === validatedReceipt!.sha256 && p.orderId !== order.id);
    if (existingLedgerHash) {
      throw new Error('Duplicate proof: Receipt image hash already exists on a different order.');
    }
  }

  const nowIso = new Date(nowMs).toISOString();
  const proof: OrderPaymentProof = {
    id: `prf-${crypto.randomUUID()}`,
    orderId: order.id,
    orderCode: order.orderCode,
    paymentReference: cleanRef,
    senderName,
    transferTime: new Date(transferMs).toISOString(),
    receiptFileName: input.receiptFile?.fileName,
    receiptMimeType: validatedReceipt?.mimeType,
    receiptSizeBytes: validatedReceipt?.sizeBytes,
    receiptSha256: validatedReceipt?.sha256,
    status: 'proof_submitted',
    submittedByIpHash: input.visitorIpHash,
    createdAt: nowIso,
  };

  paymentRepository.saveProof(proof);

  const updatedOrder = orderRepository.updateStatus(order.id, 'proof_submitted', {
    paymentReference: cleanRef,
    rejectionReason: undefined,
    proofSummary: {
      id: proof.id,
      senderName: proof.senderName,
      transferTime: proof.transferTime,
      paymentReference: proof.paymentReference,
      receiptFileName: proof.receiptFileName,
      receiptMimeType: proof.receiptMimeType,
      receiptSizeBytes: proof.receiptSizeBytes,
      receiptSha256: proof.receiptSha256,
      submittedAt: nowIso,
    },
  });

  recordAudit({
    action: 'order.proof_submitted',
    entity: 'order',
    entityId: order.id,
    actorId: 'customer',
    actorRole: 'customer',
    details: {
      orderCode: order.orderCode,
      hasReceiptFile: Boolean(validatedReceipt),
    },
  });

  return { order: updatedOrder, proof };
}

/**
 * Admin explicitly confirms full bank payment after checking GTBank app.
 * - Admin only
 * - Cannot double-confirm or reuse payment reference
 * - Cannot confirm expired order unless explicitly reopened
 * - Cannot confirm amount != order total
 */
export function confirmOrderBankTransfer(input: ConfirmOrderPaymentInput): {
  order: Order;
  payment: PaymentRecord;
  receiptId: string;
} {
  assertLoggedInAdmin(input.actorRole, input.actorUserId, 'confirm order bank payment');

  if (!input.isBankAppCreditConfirmed) {
    throw new Error('Confirmation checklist failed: Check GTBank app credit before confirming payment.');
  }

  const nowMs = input.nowMs ?? Date.now();
  const order = orderRepository.getById(input.orderId);
  if (!order) {
    throw new Error(`Order '${input.orderId}' not found.`);
  }

  if (
    order.status === 'paid' ||
    order.status === 'payment_confirmed' ||
    order.status === 'in_kitchen' ||
    order.status === 'ready_for_dispatch' ||
    order.status === 'out_for_delivery' ||
    order.status === 'delivered'
  ) {
    throw new Error(`Double confirm blocked: Order '${order.orderCode}' is already paid.`);
  }

  if (order.status === 'cancelled') {
    throw new Error(`Cannot confirm cancelled order '${order.orderCode}'.`);
  }

  assertOrderNotExpiredForPayment(order, nowMs);

  const cleanRef = (input.paymentReference || '').trim().toUpperCase();
  if (!cleanRef || cleanRef.length < 4) {
    throw new Error('Payment reference is required for confirmation.');
  }

  if (order.paymentReference && cleanRef !== order.paymentReference.trim().toUpperCase()) {
    throw new Error(
      `Reference mismatch: Order expects narration reference '${order.paymentReference}', got '${cleanRef}'.`
    );
  }

  if (paymentRepository.isReferenceConfirmed(cleanRef)) {
    throw new Error(`Duplicate reference: Payment reference '${cleanRef}' has already been confirmed.`);
  }

  if (input.amountReceivedKobo <= 0n) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  if (input.amountReceivedKobo !== order.totalKobo) {
    throw new Error(
      `Amount mismatch: Confirmed amount (${input.amountReceivedKobo} kobo) differs from order total (${order.totalKobo} kobo). Partial payments must be recorded as partial, not paid.`
    );
  }

  const nowIso = new Date(nowMs).toISOString();
  const bankSettings = getBusinessBankSettings();

  const paymentRecord: PaymentRecord = {
    id: `pay-${crypto.randomUUID()}`,
    orderId: order.id,
    paymentType: 'order',
    method: 'manual_transfer',
    amountKobo: input.amountReceivedKobo,
    status: 'verified',
    providerReference: cleanRef,
    verifiedBy: input.actorUserId,
    verifiedByName: input.actorName,
    verifiedAt: nowIso,
    receiptSha256: order.proofSummary?.receiptSha256,
    metadata: {
      bankName: bankSettings?.bankName || 'Guaranty Trust Bank (GTBank)',
      accountNumberLast4: bankSettings?.accountNumber?.slice(-4) || '0627',
      notes: input.notes,
    },
    createdAt: nowIso,
  };

  paymentRepository.savePayment(paymentRecord);
  paymentRepository.markReferenceConfirmed(cleanRef);

  const updatedOrder = orderRepository.updateStatus(order.id, 'paid', {
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    paymentReference: cleanRef,
    paidAmountKobo: input.amountReceivedKobo,
  });

  // Ensure invoice + official receipt exist
  let linkedInvoice = invoiceRepository.getInvoiceById(`inv-ord-${order.id}`);
  if (!linkedInvoice) {
    linkedInvoice = createInvoice(
      {
        orderId: order.id,
        clientName: order.customerName,
        clientPhone: order.customerPhone,
        items: order.items.map((i) => ({
          nameSnapshot: i.nameSnapshot,
          portionLabel: i.portionSnapshot,
          unitPriceKobo: i.unitPriceKoboSnapshot,
          quantity: i.quantity,
        })),
        deliveryFeeKobo: order.deliveryFeeKobo,
        discountKobo: order.discountKobo,
        bankDetails: bankSettings
          ? {
              bankName: bankSettings.bankName,
              accountNumber: bankSettings.accountNumber,
              accountName: bankSettings.accountName,
              verifiedByOwner: true,
            }
          : undefined,
      },
      'issued'
    );
  }

  const receipt = generateReceipt({
    invoiceId: linkedInvoice.id,
    paymentId: cleanRef,
    paymentDate: nowIso.split('T')[0],
    paymentMethod: 'manual_transfer',
    amountReceivedKobo: input.amountReceivedKobo,
    isDeliveryTimeframeConfirmed: true,
    actorUserId: input.actorUserId,
  });

  recordAudit({
    action: 'order.payment_confirmed',
    entity: 'order',
    entityId: order.id,
    actorId: input.actorUserId,
    actorRole: input.actorRole as any,
    details: {
      orderCode: order.orderCode,
      paymentReference: cleanRef,
      amountKobo: input.amountReceivedKobo.toString(),
      verifiedAt: nowIso,
    },
  });

  return {
    order: updatedOrder,
    payment: paymentRecord,
    receiptId: receipt.id,
  };
}

/**
 * Records a partial bank payment (< order total) strictly as status 'partial', NEVER 'paid'.
 */
export function recordPartialOrderPayment(input: RecordPartialPaymentInput): {
  order: Order;
  payment: PaymentRecord;
} {
  assertLoggedInAdmin(input.actorRole, input.actorUserId, 'record a partial payment');

  if (!input.isBankAppCreditConfirmed) {
    throw new Error('Bank credit must be confirmed before recording a partial payment.');
  }

  const nowMs = input.nowMs ?? Date.now();
  const order = orderRepository.getById(input.orderId);
  if (!order) {
    throw new Error(`Order '${input.orderId}' not found.`);
  }

  if (order.status === 'paid' || order.status === 'payment_confirmed') {
    throw new Error(`Order '${order.orderCode}' is already paid in full.`);
  }
  assertOrderNotExpiredForPayment(order, nowMs);

  if (input.amountReceivedKobo <= 0n) {
    throw new Error('Partial payment amount must be greater than zero.');
  }

  if (input.amountReceivedKobo >= order.totalKobo) {
    throw new Error('Full or excess amount cannot be recorded as partial payment.');
  }

  const previousPaid = order.paidAmountKobo ?? 0n;
  const cumulativePaid = previousPaid + input.amountReceivedKobo;
  if (cumulativePaid >= order.totalKobo) {
    throw new Error(
      'Cumulative amount reaches full order total; use exact full confirmation once remaining balance is verified.'
    );
  }

  const cleanRef = (input.paymentReference || '').trim().toUpperCase();
  if (!cleanRef || cleanRef.length < 4) {
    throw new Error('Unique partial transfer reference is required.');
  }

  const nowIso = new Date(nowMs).toISOString();
  const paymentRecord: PaymentRecord = {
    id: `pay-part-${crypto.randomUUID()}`,
    orderId: order.id,
    paymentType: 'order',
    method: 'manual_transfer',
    amountKobo: input.amountReceivedKobo,
    status: 'partial',
    providerReference: cleanRef,
    verifiedBy: input.actorUserId,
    verifiedByName: input.actorName,
    verifiedAt: nowIso,
    metadata: { partial: true, notes: input.notes },
    createdAt: nowIso,
  };

  paymentRepository.savePayment(paymentRecord);

  const updatedOrder = orderRepository.updateStatus(order.id, 'partial', {
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    paidAmountKobo: cumulativePaid,
  });

  recordAudit({
    action: 'order.partial_payment_recorded',
    entity: 'order',
    entityId: order.id,
    actorId: input.actorUserId,
    actorRole: input.actorRole as any,
    details: {
      orderCode: order.orderCode,
      partialAmountKobo: input.amountReceivedKobo.toString(),
      cumulativePaidKobo: cumulativePaid.toString(),
      expectedTotalKobo: order.totalKobo.toString(),
    },
  });

  return { order: updatedOrder, payment: paymentRecord };
}

/**
 * Logged-in admin rejects an unverified or invalid proof.
 */
export function rejectOrderPaymentProof(input: {
  orderId: string;
  actorUserId: string;
  actorRole: string;
  reason: string;
}): Order {
  assertLoggedInAdmin(input.actorRole, input.actorUserId, 'reject order payment proof');

  const reason = (input.reason || '').trim();
  if (reason.length < 3) {
    throw new Error('A rejection reason (minimum 3 characters) is required.');
  }

  const order = orderRepository.getById(input.orderId);
  if (!order) {
    throw new Error(`Order '${input.orderId}' not found.`);
  }
  if (order.status === 'paid' || order.status === 'payment_confirmed') {
    throw new Error('Cannot reject an order that is already confirmed paid.');
  }

  const updated = orderRepository.updateStatus(order.id, 'rejected', {
    rejectionReason: reason,
  });

  recordAudit({
    action: 'order.proof_rejected',
    entity: 'order',
    entityId: order.id,
    actorId: input.actorUserId,
    actorRole: input.actorRole as any,
    details: { orderCode: order.orderCode, reason },
  });

  return updated;
}

/**
 * Admin explicitly reopens an expired order and logs who reopened it, why, and when.
 */
export function reopenExpiredOrder(input: ReopenExpiredOrderInput): Order {
  assertLoggedInAdmin(input.actorRole, input.actorUserId, 'reopen an expired order');

  const reason = (input.reason || '').trim();
  if (reason.length < 3) {
    throw new Error('An explicit reason (minimum 3 characters) is required to reopen an expired order.');
  }

  const nowMs = input.nowMs ?? Date.now();
  const order = orderRepository.getById(input.orderId);
  if (!order) {
    throw new Error(`Order '${input.orderId}' not found.`);
  }

  const isExpiredByTime = nowMs > new Date(order.expiresAt).getTime();
  if (order.status !== 'expired' && !isExpiredByTime) {
    throw new Error(`Order '${order.orderCode}' is not expired.`);
  }

  const extendHours = input.extendHours && input.extendHours > 0 ? input.extendHours : 7;
  const nowIso = new Date(nowMs).toISOString();
  const newExpiresAt = new Date(nowMs + extendHours * 60 * 60 * 1000).toISOString();

  const reopenLog: OrderReopenLog = {
    id: `reopen-${crypto.randomUUID()}`,
    reopenedBy: input.actorUserId,
    reopenedByName: input.actorName,
    reason,
    previousExpiresAt: order.expiresAt,
    newExpiresAt,
    reopenedAt: nowIso,
  };

  const restoredStatus = order.proofSummary ? 'proof_submitted' : 'pending_payment';

  const updated = orderRepository.updateStatus(order.id, restoredStatus, {
    reopenedAt: nowIso,
    reopenedBy: input.actorUserId,
    reopenReason: reason,
    expiresAt: newExpiresAt,
    reopenLog,
  });

  recordAudit({
    action: 'order.expired_reopened',
    entity: 'order',
    entityId: order.id,
    actorId: input.actorUserId,
    actorRole: input.actorRole as any,
    details: {
      orderCode: order.orderCode,
      reason,
      previousExpiresAt: order.expiresAt,
      newExpiresAt,
    },
  });

  return updated;
}

/**
 * Legacy helper for manual bank transfers on orders or invoices.
 */
export function submitManualPaymentTransfer(input: ManualPaymentSubmissionInput): PaymentRecord {
  if (!input.orderId && !input.invoiceId) {
    throw new Error('Payment target required: must specify orderId or invoiceId.');
  }

  const cleanRef = input.bankReference.trim();
  if (cleanRef.length < 4) {
    throw new Error('Bank transfer reference must be at least 4 characters.');
  }

  if (input.amountKobo <= 0n) {
    throw new Error('Transfer amount must be greater than zero.');
  }

  const existing = paymentRepository.getPaymentByReference(cleanRef);
  if (existing) {
    throw new Error(`Duplicate reference: Transfer reference '${cleanRef}' has already been submitted.`);
  }

  const recordId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const record: PaymentRecord = {
    id: recordId,
    orderId: input.orderId,
    invoiceId: input.invoiceId,
    paymentType: input.paymentType,
    method: 'manual_transfer',
    amountKobo: input.amountKobo,
    status: 'pending_verification',
    providerReference: cleanRef,
    proofImageUrl: input.proofImageUrl,
    receiptSha256: input.receiptSha256,
    createdAt: nowIso,
  };

  return paymentRepository.savePayment(record);
}

/**
 * Staff/Owner manual verification checklist for ledger records.
 */
export function confirmManualPayment(input: ConfirmManualPaymentInput): {
  payment: PaymentRecord;
  receiptId: string;
} {
  const allowedRoles = ['owner', 'staff', 'developer'];
  if (!allowedRoles.includes(input.actorRole)) {
    throw new Error(`Unauthorized: Role '${input.actorRole}' cannot verify payments.`);
  }

  if (!input.isBankStatementCreditConfirmed) {
    throw new Error('Verification checklist failure: Bank statement credit must be confirmed before marking paid.');
  }

  const payment = paymentRepository.getPaymentById(input.paymentRecordId);
  if (!payment) {
    throw new Error(`Payment record '${input.paymentRecordId}' not found.`);
  }

  if (payment.status === 'verified') {
    throw new Error(`Payment '${input.paymentRecordId}' is already verified.`);
  }

  const nowIso = new Date().toISOString();
  let invoiceId = payment.invoiceId;
  const bankSettings = getBusinessBankSettings();

  if (payment.orderId) {
    const order = orderRepository.getById(payment.orderId);
    if (!order) {
      throw new Error(`Order '${payment.orderId}' not found for payment.`);
    }

    assertOrderNotExpiredForPayment(order, Date.now());

    if (payment.amountKobo !== order.totalKobo) {
      throw new Error(
        `Amount mismatch: Transfer amount (${payment.amountKobo} kobo) does not match order total (${order.totalKobo} kobo).`
      );
    }

    orderRepository.updateStatus(order.id, 'paid', {
      actorUserId: input.actorUserId,
      paymentReference: payment.providerReference,
      paidAmountKobo: payment.amountKobo,
    });

    let linkedInvoice = invoiceRepository.getInvoiceById(`inv-ord-${order.id}`);
    if (!linkedInvoice) {
      linkedInvoice = createInvoice(
        {
          orderId: order.id,
          clientName: order.customerName,
          clientPhone: order.customerPhone,
          items: order.items.map((i) => ({
            nameSnapshot: i.nameSnapshot,
            portionLabel: i.portionSnapshot,
            unitPriceKobo: i.unitPriceKoboSnapshot,
            quantity: i.quantity,
          })),
          deliveryFeeKobo: order.deliveryFeeKobo,
          bankDetails: bankSettings
            ? {
                bankName: bankSettings.bankName,
                accountNumber: bankSettings.accountNumber,
                accountName: bankSettings.accountName,
                verifiedByOwner: true,
              }
            : undefined,
        },
        'issued'
      );
    }
    invoiceId = linkedInvoice.id;
  } else if (payment.invoiceId) {
    const invoice = invoiceRepository.getInvoiceById(payment.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice '${payment.invoiceId}' not found for payment.`);
    }
  }

  const receipt = generateReceipt({
    invoiceId: invoiceId!,
    paymentId: payment.providerReference,
    paymentDate: nowIso.split('T')[0],
    paymentMethod: 'manual_transfer',
    amountReceivedKobo: payment.amountKobo,
    isDeliveryTimeframeConfirmed: true,
    actorUserId: input.actorUserId,
  });

  payment.status = 'verified';
  payment.verifiedBy = input.actorUserId;
  payment.verifiedAt = nowIso;
  if (input.notes) {
    payment.metadata = { ...(payment.metadata || {}), verificationNotes: input.notes };
  }

  paymentRepository.savePayment(payment);
  paymentRepository.markReferenceConfirmed(payment.providerReference);

  return { payment, receiptId: receipt.id };
}

/**
 * End-of-day Financial Reconciliation Engine
 * Compares all paid orders against verified payment ledger records in BigInt kobo.
 */
export function generateReconciliationReport(): ReconciliationReport {
  const allOrders = orderRepository.getAll();
  const allPayments = paymentRepository.getAllPayments();
  const discrepancies: ReconciliationDiscrepancy[] = [];

  let totalOrdersCount = 0;
  let totalPaidOrdersCount = 0;
  let totalOrderKoboExpected = 0n;
  let totalVerifiedKoboReceived = 0n;

  const paidOrderStatuses = [
    'paid',
    'payment_confirmed',
    'in_kitchen',
    'ready_for_dispatch',
    'out_for_delivery',
    'delivered',
  ];

  for (const ord of allOrders) {
    totalOrdersCount++;
    if (paidOrderStatuses.includes(ord.status)) {
      totalPaidOrdersCount++;
      totalOrderKoboExpected += ord.totalKobo;

      const orderPayments = paymentRepository
        .getPaymentsForOrder(ord.id)
        .filter((p) => p.status === 'verified');
      if (orderPayments.length === 0) {
        discrepancies.push({
          type: 'order_marked_paid_without_payment',
          referenceId: ord.orderCode,
          expectedKobo: ord.totalKobo,
          description: `Order ${ord.orderCode} is marked '${ord.status}' but has NO verified payment record in ledger.`,
          severity: 'high',
        });
      } else {
        const sumPaidKobo = orderPayments.reduce((acc, p) => acc + p.amountKobo, 0n);
        if (sumPaidKobo !== ord.totalKobo) {
          discrepancies.push({
            type: 'amount_mismatch',
            referenceId: ord.orderCode,
            expectedKobo: ord.totalKobo,
            actualKobo: sumPaidKobo,
            description: `Order ${ord.orderCode} expected ${ord.totalKobo} kobo, but verified payments sum to ${sumPaidKobo} kobo.`,
            severity: 'high',
          });
        }
      }
    }
  }

  const nowMs = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  for (const p of allPayments) {
    if (p.status === 'verified') {
      totalVerifiedKoboReceived += p.amountKobo;
      if (!p.orderId && !p.invoiceId) {
        discrepancies.push({
          type: 'orphan_payment',
          referenceId: p.providerReference,
          actualKobo: p.amountKobo,
          description: `Verified payment '${p.providerReference}' has no linked order or invoice.`,
          severity: 'medium',
        });
      }
    } else if (p.status === 'pending_verification') {
      const createdMs = new Date(p.createdAt).getTime();
      if (nowMs - createdMs > ONE_DAY_MS) {
        discrepancies.push({
          type: 'stale_pending_transfer',
          referenceId: p.providerReference,
          actualKobo: p.amountKobo,
          description: `Manual transfer '${p.providerReference}' has been pending verification for over 24 hours.`,
          severity: 'low',
        });
      }
    }
  }

  const netVarianceKobo = totalVerifiedKoboReceived - totalOrderKoboExpected;

  return {
    timestamp: new Date().toISOString(),
    totalOrdersCount,
    totalPaidOrdersCount,
    totalOrderKoboExpected,
    totalVerifiedKoboReceived,
    netVarianceKobo,
    discrepancies,
  };
}
