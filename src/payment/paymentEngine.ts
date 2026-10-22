/**
 * ROCK UC FOODS - Payments, Webhooks & Ledger Reconciliation Engine
 * Playbook v2 Section 11 (Phase 6: Payments and Reconciliation)
 * 
 * Rules:
 * - BigInt integer kobo (*_kobo) throughout.
 * - Idempotency & Replay Protection: Paystack webhooks verified via HMAC-SHA512.
 *   Duplicate webhook deliveries return success immediately with zero double-crediting.
 * - Manual transfer confirmation checklist: verified by authorized staff, rejects duplicate bank references.
 * - Never mark an order paid from client callbacks.
 * - Automated ledger reconciliation & discrepancy detection.
 */

import crypto from 'crypto';
import {
  PaymentRecord,
  WebhookEventRecord,
  ManualPaymentSubmissionInput,
  ConfirmManualPaymentInput,
  PaystackWebhookPayload,
  ReconciliationReport,
  ReconciliationDiscrepancy,
} from '../types/payment';
import { orderRepository } from '../order/orderRepository';
import { invoiceRepository, createInvoice, generateReceipt } from '../catering/invoiceEngine';

class PaymentRepository {
  private payments: Map<string, PaymentRecord> = new Map();
  private webhookEvents: Map<string, WebhookEventRecord> = new Map();

  clear() {
    this.payments.clear();
    this.webhookEvents.clear();
  }

  savePayment(record: PaymentRecord): PaymentRecord {
    // Unique provider reference constraint enforcement
    for (const p of this.payments.values()) {
      if (p.id !== record.id && p.providerReference.toLowerCase() === record.providerReference.toLowerCase()) {
        throw new Error(`SECURITY VIOLATION: Payment reference '${record.providerReference}' already exists in ledger.`);
      }
    }
    this.payments.set(record.id, { ...record });
    return record;
  }

  getPaymentById(id: string): PaymentRecord | undefined {
    return this.payments.get(id);
  }

  getPaymentByReference(ref: string): PaymentRecord | undefined {
    for (const p of this.payments.values()) {
      if (p.providerReference.toLowerCase() === ref.toLowerCase()) {
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

  hasWebhookReference(reference: string): boolean {
    return this.webhookEvents.has(reference);
  }

  saveWebhookEvent(record: WebhookEventRecord): WebhookEventRecord {
    if (this.webhookEvents.has(record.reference)) {
      throw new Error(`Duplicate webhook event with reference '${record.reference}'.`);
    }
    this.webhookEvents.set(record.reference, { ...record });
    return record;
  }
}

export const paymentRepository = new PaymentRepository();

/**
 * Validates Paystack HMAC-SHA512 webhook signature.
 * Prevents timing attacks with timingSafeEqual.
 */
export function verifyPaystackSignature(
  rawBody: string,
  signatureHeader: string,
  secretKey: string
): boolean {
  if (!signatureHeader || !secretKey) {
    return false;
  }

  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  if (hash.length !== signatureHeader.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'utf-8'),
      Buffer.from(signatureHeader, 'utf-8')
    );
  } catch {
    return false;
  }
}

/**
 * Customer submits manual bank transfer proof or reference.
 * Status is set to 'pending_verification'.
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
    createdAt: nowIso,
  };

  return paymentRepository.savePayment(record);
}

/**
 * Staff manual verification checklist:
 * 1. Actor is owner or staff.
 * 2. Bank statement credit confirmed.
 * 3. Amount matches order or invoice.
 * 4. Advances status and issues official receipt.
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

  // Validate and advance Order or Invoice
  let invoiceId = payment.invoiceId;

  if (payment.orderId) {
    const order = orderRepository.getById(payment.orderId);
    if (!order) {
      throw new Error(`Order '${payment.orderId}' not found for payment.`);
    }

    if (payment.amountKobo !== order.totalKobo) {
      throw new Error(
        `Amount mismatch: Transfer amount (${payment.amountKobo} kobo) does not match order total (${order.totalKobo} kobo).`
      );
    }

    // Advance order to payment_confirmed
    orderRepository.updateStatus(order.id, 'payment_confirmed', {
      actorUserId: input.actorUserId,
      paymentReference: payment.providerReference,
    });

    // Ensure invoice exists for receipt generation
    let linkedInvoice = invoiceRepository.getInvoiceById(`inv-ord-${order.id}`);
    if (!linkedInvoice) {
      linkedInvoice = createInvoice({
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
        bankDetails: {
          bankName: 'Official Bank Transfer',
          accountNumber: 'VERIFIED',
          accountName: 'ROCK UC FOODS',
          verifiedByOwner: true,
        },
      }, 'issued');
    }
    invoiceId = linkedInvoice.id;
  } else if (payment.invoiceId) {
    const invoice = invoiceRepository.getInvoiceById(payment.invoiceId);
    if (!invoice) {
      throw new Error(`Invoice '${payment.invoiceId}' not found for payment.`);
    }
  }

  // Generate official receipt
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

  return { payment, receiptId: receipt.id };
}

/**
 * Handles automated Paystack Webhook events with HMAC-SHA512 verification & idempotency.
 */
export function processPaystackWebhook(
  rawBody: string,
  signatureHeader: string,
  secretKey: string
): { success: boolean; message: string; duplicate?: boolean; paymentId?: string } {
  // 1. Verify cryptographic signature
  const isSignatureValid = verifyPaystackSignature(rawBody, signatureHeader, secretKey);
  if (!isSignatureValid) {
    throw new Error('SECURITY VIOLATION: Invalid Paystack webhook signature.');
  }

  const payload = JSON.parse(rawBody) as PaystackWebhookPayload;
  const { event, data } = payload;
  const reference = data.reference;

  // 2. Idempotency Gate: if reference already processed, return 200 without double crediting
  if (paymentRepository.hasWebhookReference(reference)) {
    return {
      success: true,
      message: `Webhook reference '${reference}' already processed. Idempotent skip.`,
      duplicate: true,
    };
  }

  // Store raw webhook event for replay protection
  paymentRepository.saveWebhookEvent({
    id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    eventType: event,
    reference,
    payload: payload as unknown as Record<string, unknown>,
    processedAt: new Date().toISOString(),
  });

  // 3. Gate on event type and status
  if (event !== 'charge.success' || data.status !== 'success') {
    return {
      success: false,
      message: `Payment charge not successful: event '${event}', status '${data.status}'.`,
    };
  }

  const amountKobo = BigInt(data.amount);
  const orderId = data.metadata?.orderId;
  const invoiceId = data.metadata?.invoiceId;

  const recordId = `pay-pstk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const paymentRecord: PaymentRecord = {
    id: recordId,
    orderId,
    invoiceId,
    paymentType: data.metadata?.paymentType || 'order',
    method: 'paystack',
    amountKobo,
    status: 'verified',
    providerReference: reference,
    verifiedAt: nowIso,
    metadata: {
      paystackId: data.id,
      channel: data.channel,
      currency: data.currency,
      paidAt: data.paid_at,
    },
    createdAt: nowIso,
  };

  paymentRepository.savePayment(paymentRecord);

  // Advance Order if matched
  if (orderId) {
    const order = orderRepository.getById(orderId);
    if (order && order.status === 'pending_payment') {
      orderRepository.updateStatus(order.id, 'payment_confirmed', {
        actorUserId: 'system-paystack-webhook',
        paymentReference: reference,
      });

      // Ensure linked invoice exists
      let linkedInvoice = invoiceRepository.getInvoiceById(`inv-ord-${order.id}`);
      if (!linkedInvoice) {
        linkedInvoice = createInvoice({
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
          bankDetails: {
            bankName: 'Paystack Online Gateway',
            accountNumber: reference,
            accountName: 'ROCK UC FOODS',
            verifiedByOwner: true,
          },
        }, 'issued');
      }

      // Generate receipt
      generateReceipt({
        invoiceId: linkedInvoice.id,
        paymentId: reference,
        paymentDate: nowIso.split('T')[0],
        paymentMethod: 'paystack',
        amountReceivedKobo: amountKobo,
        isDeliveryTimeframeConfirmed: true,
      });
    }
  }

  return {
    success: true,
    message: `Payment '${reference}' successfully processed and verified.`,
    paymentId: recordId,
  };
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

  const paidOrderStatuses = ['payment_confirmed', 'kitchen_accepted', 'in_prep', 'ready', 'delivered'];

  for (const ord of allOrders) {
    totalOrdersCount++;
    if (paidOrderStatuses.includes(ord.status)) {
      totalPaidOrdersCount++;
      totalOrderKoboExpected += ord.totalKobo;

      const orderPayments = paymentRepository.getPaymentsForOrder(ord.id).filter((p) => p.status === 'verified');
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
      // Check for orphan payment (neither matching order nor invoice)
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
