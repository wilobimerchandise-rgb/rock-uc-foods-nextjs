/**
 * ROCK UC FOODS - Order and Delivery Type Definitions
 * (Playbook v2 Section 7, 8, 11 & Section 17 v3 Addendum)
 * Monetary values are strictly BigInt integer kobo.
 */

export type DeliveryType = 'delivery' | 'collection';

export type OrderStatus =
  | 'pending_payment'
  | 'payment_confirmed'
  | 'in_kitchen'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'delivered'
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
  unitPriceKoboSnapshot: bigint;
  quantity: number;
  totalKoboSnapshot: bigint;
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
  status: OrderStatus;
  specialInstructions?: string;
  policyVersion: string;
  policyAcceptedAt: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  paymentReference?: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItemSnapshot[];
}

export interface CartItemInput {
  menuItemId: string;
  quantity: number;
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
  items: CartItemInput[];
}
