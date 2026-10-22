/**
 * ROCK UC FOODS - Payment & Reconciliation Type Definitions
 * Playbook v2 Section 11 (Phase 6)
 * All monetary amounts are strictly BigInt integer kobo.
 */

export type PaymentType = 'order' | 'event_deposit' | 'event_balance';
export type PaymentMethod = 'manual_transfer' | 'paystack';
export type PaymentRecordStatus = 'pending_verification' | 'verified' | 'rejected' | 'refunded';

export interface PaymentRecord {
  id: string;
  orderId?: string;
  invoiceId?: string;
  paymentType: PaymentType;
  method: PaymentMethod;
  amountKobo: bigint;
  status: PaymentRecordStatus;
  providerReference: string; // Paystack ref or customer bank transfer ref
  verifiedBy?: string;
  verifiedAt?: string;
  proofImageUrl?: string;
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WebhookEventRecord {
  id: string;
  eventType: string;
  reference: string;
  payload: Record<string, unknown>;
  processedAt: string;
}

export interface ManualPaymentSubmissionInput {
  orderId?: string;
  invoiceId?: string;
  paymentType: PaymentType;
  amountKobo: bigint;
  bankReference: string;
  proofImageUrl?: string;
}

export interface ConfirmManualPaymentInput {
  paymentRecordId: string;
  actorUserId: string;
  actorRole: 'owner' | 'staff' | 'developer';
  isBankStatementCreditConfirmed: boolean;
  notes?: string;
}

export interface PaystackWebhookPayload {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number; // In kobo per Paystack spec
    status: string; // 'success', 'failed', 'abandoned'
    currency: string;
    channel: string;
    paid_at: string;
    metadata?: {
      orderId?: string;
      orderCode?: string;
      invoiceId?: string;
      invoiceNumber?: string;
      paymentType?: PaymentType;
      clientPhone?: string;
    };
  };
}

export interface ReconciliationDiscrepancy {
  type: 'order_marked_paid_without_payment' | 'amount_mismatch' | 'orphan_payment' | 'stale_pending_transfer';
  referenceId: string;
  expectedKobo?: bigint;
  actualKobo?: bigint;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ReconciliationReport {
  timestamp: string;
  totalOrdersCount: number;
  totalPaidOrdersCount: number;
  totalOrderKoboExpected: bigint;
  totalVerifiedKoboReceived: bigint;
  netVarianceKobo: bigint;
  discrepancies: ReconciliationDiscrepancy[];
}
