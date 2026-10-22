/**
 * ROCK UC FOODS - KDS, Dispatch & Delivery Tracking Types
 * Playbook v2 Section 13 (Phase 8: KDS, Dispatch, Real-Time Delivery Tracking & Customer Notifications)
 */

import { OrderItemSnapshot, DeliveryType, OrderStatus } from './order';

export type KitchenTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type KitchenTicketStatus = 'queued' | 'cooking' | 'plated' | 'handed_off' | 'cancelled';

export type KitchenStation = 'grill' | 'stew_pot' | 'fryer' | 'salad_prep' | 'packaging';

export interface KitchenTicket {
  id: string;
  orderId: string;
  orderCode: string;
  ticketNumber: string; // KDS-YYYYMMDD-XXXX
  priority: KitchenTicketPriority;
  status: KitchenTicketStatus;
  assignedStation: KitchenStation;
  items: OrderItemSnapshot[];
  specialInstructions?: string;
  cookStartedAt?: string;
  platedAt?: string;
  handedOffAt?: string;
  createdAt: string;
}

export type DispatchStatus = 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'failed';

export interface DispatchAssignment {
  id: string;
  orderId: string;
  orderCode: string;
  riderName: string;
  riderPhone: string;
  riderVehiclePlate?: string;
  dispatchStatus: DispatchStatus;
  pickedUpAt?: string;
  deliveredAt?: string;
  failedReason?: string;
  customerSignatureConfirmed: boolean;
  createdAt: string;
}

export interface CustomerTrackingView {
  orderCode: string;
  customerName: string;
  deliveryAddress?: string;
  deliveryType: DeliveryType;
  status: OrderStatus;
  statusStep: number; // 1: Order Confirmed, 2: In Kitchen, 3: Out for Delivery, 4: Delivered
  progressPercent: number;
  riderName?: string;
  riderPhone?: string;
  items: Array<{ name: string; quantity: number }>;
  createdAt: string;
}

export interface NotificationPayload {
  recipientPhone: string;
  recipientName: string;
  messageType: 'kitchen_started' | 'dispatched' | 'delivered';
  messageText: string;
}
