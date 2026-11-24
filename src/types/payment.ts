/**
 * ROCK UC FOODS - Payment & Reconciliation Type Definitions
 * Playbook v2 Section 11 & Manual GTBank Transfer Flow
 * All monetary amounts are strictly BigInt integer kobo.
 */

export type PaymentType = 'order' | 'event_deposit' | 'event_balance';
export type PaymentMethod = 'manual_transfer';
export type PaymentRecordStatus = 'pending_verification' | 'partial' | 'verified' | 'rejected' | 'refunded';

export interface PaymentRecord {
  id: string;
  orderId?: string;
  invoiceId?: string;
  paymentType: PaymentType;
  method: PaymentMethod;
  amountKobo: bigint;
  status: PaymentRecordStatus;
  providerReference: string; // Server-generated RUC-XXXXXX or customer bank transfer ref
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  proofImageUrl?: string;
  receiptSha256?: string;
  rejectionReason?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface OrderPaymentProof {
  id: string;
  orderId: string;
  orderCode: string;
  paymentReference: string;
  senderName: string;
  transferTime: string;
  receiptFileName?: string;
  receiptMimeType?: 'image/jpeg' | 'image/png' | 'application/pdf';
  receiptSizeBytes?: number;
  receiptSha256?: string;
  status: 'proof_submitted' | 'partial' | 'paid' | 'rejected';
  submittedByIpHash?: string;
  createdAt: string;
}

export interface SubmitOrderProofInput {
  orderId?: string;
  orderCode?: string;
  senderName: string;
  transferTime: string;
  paymentReference?: string;
  visitorIpHash?: string;
  receiptFile?: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    buffer: Uint8Array;
  };
}

export interface ConfirmOrderPaymentInput {
  orderId: string;
  actorUserId: string;
  actorName?: string;
  actorRole: 'owner' | 'staff' | 'developer' | 'customer' | string;
  amountReceivedKobo: bigint;
  paymentReference: string;
  isBankAppCreditConfirmed: boolean;
  notes?: string;
  nowMs?: number;
}

export interface RecordPartialPaymentInput {
  orderId: string;
  actorUserId: string;
  actorName?: string;
  actorRole: 'owner' | 'staff' | 'developer' | 'customer' | string;
  amountReceivedKobo: bigint;
  paymentReference: string;
  isBankAppCreditConfirmed: boolean;
  notes?: string;
  nowMs?: number;
}

export interface ReopenExpiredOrderInput {
  orderId: string;
  actorUserId: string;
  actorName?: string;
  actorRole: 'owner' | 'staff' | 'developer' | 'customer' | string;
  reason: string;
  extendHours?: number;
  nowMs?: number;
}

export interface ManualPaymentSubmissionInput {
  orderId?: string;
  invoiceId?: string;
  paymentType: PaymentType;
  amountKobo: bigint;
  bankReference: string;
  proofImageUrl?: string;
  receiptSha256?: string;
}

export interface ConfirmManualPaymentInput {
  paymentRecordId: string;
  actorUserId: string;
  actorRole: 'owner' | 'staff' | 'developer';
  isBankStatementCreditConfirmed: boolean;
  notes?: string;
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
