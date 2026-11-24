/**
 * ROCK UC FOODS - Order and Delivery Type Definitions
 * (Playbook v2 Section 7, 8, 11 & Manual GTBank Transfer Flow)
 * Monetary values are strictly BigInt integer kobo.
 */

export type DeliveryType = 'delivery' | 'collection';

export type OrderStatus =
  | 'pending_payment'
  | 'proof_submitted'
  | 'partial'
  | 'paid'
  | 'payment_confirmed'
  | 'in_kitchen'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'delivered'
  | 'expired'
  | 'rejected'
  | 'cancelled';

export interface DeliveryZone {
  id: string;
  code: string;
  name: string;
  areas: string[];
  feeKobo: bigint;
  isActive: boolean;
  sortOrder: number;
}

export interface OrderItemSnapshot {
  id: string;
  orderId: string;
  menuItemId: string;
  nameSnapshot: string;
  portionSnapshot?: string;
  selectedTierName?: string;
  selectedOptionsSnapshot?: Array<{ id: string; name: string; priceDeltaKobo: bigint }>;
  unitPriceKoboSnapshot: bigint;
  quantity: number;
  totalKoboSnapshot: bigint;
}

export interface OrderReopenLog {
  id: string;
  reopenedBy: string;
  reopenedByName?: string;
  reason: string;
  previousExpiresAt: string;
  newExpiresAt: string;
  reopenedAt: string;
}

export interface OrderProofSummary {
  id: string;
  senderName: string;
  transferTime: string;
  paymentReference: string;
  receiptFileName?: string;
  receiptMimeType?: 'image/jpeg' | 'image/png' | 'application/pdf';
  receiptSizeBytes?: number;
  receiptSha256?: string;
  submittedAt: string;
}

export interface Order {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: DeliveryType;
  deliveryZoneId?: string;
  deliveryAddress?: string;
  deliveryFeeKobo: bigint;
  subtotalKobo: bigint;
  totalKobo: bigint;
  paidAmountKobo?: bigint;
  status: OrderStatus;
  specialInstructions?: string;
  policyVersion: string;
  policyAcceptedAt: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  paymentVerifiedByName?: string;
  paymentReference?: string; // Server-generated non-sequential RUC-XXXXXX narration reference
  proofSummary?: OrderProofSummary;
  rejectionReason?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  reopenLogs?: OrderReopenLog[];
  discountKobo?: bigint;
  promoCodeId?: string;
  trackingToken?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItemSnapshot[];
}

export interface CartItemInput {
  menuItemId: string;
  quantity: number;
  selectedTierId?: string;
  selectedOptionIds?: string[];
}

export interface CreateOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryType: DeliveryType;
  deliveryZoneId?: string;
  deliveryAddress?: string;
  specialInstructions?: string;
  acceptedPolicy: boolean;
  policyVersion: string;
  promoCode?: string;
  promoCodeId?: string;
  items: CartItemInput[];
}
