/**
 * ROCK UC FOODS - Kitchen Display System (KDS), Dispatch & Tracking Engine
 * Playbook v2 Section 13 (Phase 8: KDS, Dispatch, Real-Time Tracking & Customer Notifications)
 * 
 * Rules:
 * - Kitchen tickets follow strictly KDS-YYYYMMDD-XXXX formatting.
 * - Cooking, plating, and hand-off timestamps enforce chronological monotonicity.
 * - Rider assignment strictly validates Nigerian phone format (+234...).
 * - Customer tracking is token-based to eliminate IDOR and sequential ID crawling.
 */

import crypto from 'crypto';
import {
  KitchenTicket,
  KitchenTicketPriority,
  KitchenStation,
  DispatchAssignment,
  CustomerTrackingView,
  NotificationPayload,
} from '../types/dispatch';
import { Order } from '../types/order';
import { orderRepository } from '../order/orderRepository';

let ticketSeq = 1;

export function resetKdsSequence(val = 1): void {
  ticketSeq = val;
}

function generateKdsTicketNumber(dateStr = new Date().toISOString()): string {
  const yyyymmdd = dateStr.slice(0, 10).replace(/-/g, '');
  const numPart = String(ticketSeq++).padStart(4, '0');
  return `KDS-${yyyymmdd}-${numPart}`;
}

export function determineStationForOrder(order: Order): KitchenStation {
  const text = order.items.map((i) => i.nameSnapshot.toLowerCase()).join(' ');
  if (text.includes('grilled') || text.includes('suya') || text.includes('fish') || text.includes('bbq')) {
    return 'grill';
  }
  if (text.includes('soup') || text.includes('stew') || text.includes('sauce') || text.includes('egusi') || text.includes('ogbono')) {
    return 'stew_pot';
  }
  if (text.includes('fried') || text.includes('plantain') || text.includes('dodo') || text.includes('chips')) {
    return 'fryer';
  }
  if (text.includes('salad') || text.includes('coleslaw')) {
    return 'salad_prep';
  }
  return 'packaging';
}

class KitchenTicketRepository {
  private tickets: Map<string, KitchenTicket> = new Map();

  clear() {
    this.tickets.clear();
  }

  save(ticket: KitchenTicket): KitchenTicket {
    this.tickets.set(ticket.id, ticket);
    return ticket;
  }

  getById(id: string): KitchenTicket | undefined {
    return this.tickets.get(id);
  }

  getByOrderId(orderId: string): KitchenTicket[] {
    return Array.from(this.tickets.values()).filter((t) => t.orderId === orderId);
  }

  getAll(): KitchenTicket[] {
    return Array.from(this.tickets.values());
  }
}

export const kitchenTicketRepository = new KitchenTicketRepository();

class DispatchRepository {
  private assignments: Map<string, DispatchAssignment> = new Map();

  clear() {
    this.assignments.clear();
  }

  save(assignment: DispatchAssignment): DispatchAssignment {
    this.assignments.set(assignment.id, assignment);
    return assignment;
  }

  getById(id: string): DispatchAssignment | undefined {
    return this.assignments.get(id);
  }

  getByOrderId(orderId: string): DispatchAssignment | undefined {
    return Array.from(this.assignments.values()).find((a) => a.orderId === orderId);
  }

  getAll(): DispatchAssignment[] {
    return Array.from(this.assignments.values());
  }
}

export const dispatchRepository = new DispatchRepository();

/**
 * Creates a KDS ticket when an order is verified and ready for the kitchen.
 */
export function createKitchenTicketForOrder(
  orderId: string,
  priority: KitchenTicketPriority = 'normal'
): KitchenTicket {
  const order = orderRepository.getById(orderId);
  if (!order) {
    throw new Error(`Order '${orderId}' not found.`);
  }

  if (order.status !== 'payment_confirmed' && order.status !== 'in_kitchen') {
    throw new Error(`Cannot create kitchen ticket for order with status '${order.status}'. Order must be payment_confirmed.`);
  }

  const station = determineStationForOrder(order);
  const ticketNumber = generateKdsTicketNumber(order.createdAt);

  const ticket: KitchenTicket = {
    id: `kds-${crypto.randomUUID()}`,
    orderId: order.id,
    orderCode: order.orderCode,
    ticketNumber,
    priority,
    status: 'queued',
    assignedStation: station,
    items: order.items,
    specialInstructions: order.specialInstructions,
    createdAt: new Date().toISOString(),
  };

  kitchenTicketRepository.save(ticket);

  // Advance order status to in_kitchen if still payment_confirmed
  if (order.status === 'payment_confirmed') {
    order.status = 'in_kitchen';
    order.updatedAt = new Date().toISOString();
    orderRepository.save(order);
  }

  return ticket;
}

/**
 * Marks kitchen cooking started.
 */
export function startCooking(ticketId: string, cookStartedAt = new Date().toISOString()): KitchenTicket {
  const ticket = kitchenTicketRepository.getById(ticketId);
  if (!ticket) {
    throw new Error(`Kitchen ticket '${ticketId}' not found.`);
  }
  if (ticket.status !== 'queued') {
    throw new Error(`Cannot start cooking ticket in '${ticket.status}' status. Must be queued.`);
  }

  ticket.status = 'cooking';
  ticket.cookStartedAt = cookStartedAt;
  return kitchenTicketRepository.save(ticket);
}

/**
 * Marks kitchen dish plated. Enforces chronological order.
 */
export function markPlated(ticketId: string, platedAt = new Date().toISOString()): KitchenTicket {
  const ticket = kitchenTicketRepository.getById(ticketId);
  if (!ticket) {
    throw new Error(`Kitchen ticket '${ticketId}' not found.`);
  }
  if (ticket.status !== 'cooking') {
    throw new Error(`Cannot mark plated from status '${ticket.status}'. Must be cooking.`);
  }

  if (ticket.cookStartedAt && new Date(platedAt).getTime() < new Date(ticket.cookStartedAt).getTime()) {
    throw new Error('Plated timestamp cannot be earlier than cook started timestamp.');
  }

  ticket.status = 'plated';
  ticket.platedAt = platedAt;
  return kitchenTicketRepository.save(ticket);
}

/**
 * Marks kitchen dish handed off to packaging/dispatch.
 * When all tickets for the order are handed off, order advances to ready_for_dispatch.
 */
export function markHandedOff(ticketId: string, handedOffAt = new Date().toISOString()): KitchenTicket {
  const ticket = kitchenTicketRepository.getById(ticketId);
  if (!ticket) {
    throw new Error(`Kitchen ticket '${ticketId}' not found.`);
  }
  if (ticket.status !== 'plated') {
    throw new Error(`Cannot hand off dish from status '${ticket.status}'. Must be plated.`);
  }

  if (ticket.platedAt && new Date(handedOffAt).getTime() < new Date(ticket.platedAt).getTime()) {
    throw new Error('Handed off timestamp cannot be earlier than plated timestamp.');
  }

  ticket.status = 'handed_off';
  ticket.handedOffAt = handedOffAt;
  kitchenTicketRepository.save(ticket);

  // Check all tickets for this order
  const orderTickets = kitchenTicketRepository.getByOrderId(ticket.orderId);
  const allHandedOff = orderTickets.every((t) => t.status === 'handed_off');

  if (allHandedOff) {
    const order = orderRepository.getById(ticket.orderId);
    if (order && order.status === 'in_kitchen') {
      order.status = 'ready_for_dispatch';
      order.updatedAt = new Date().toISOString();
      orderRepository.save(order);
    }
  }

  return ticket;
}

/**
 * Assigns delivery rider to order. Validates Nigerian phone (+234...).
 */
export function assignRiderToOrder(params: {
  orderId: string;
  riderName: string;
  riderPhone: string;
  riderVehiclePlate?: string;
}): DispatchAssignment {
  const { orderId, riderName, riderPhone, riderVehiclePlate } = params;

  const order = orderRepository.getById(orderId);
  if (!order) {
    throw new Error(`Order '${orderId}' not found.`);
  }

  if (order.status !== 'ready_for_dispatch' && order.status !== 'in_kitchen') {
    throw new Error(`Cannot assign rider to order in status '${order.status}'. Order must be ready_for_dispatch.`);
  }

  if (!riderName || riderName.trim().length < 2) {
    throw new Error('Rider name must be at least 2 characters.');
  }

  const phoneRegex = /^\+234[0-9]{10}$/;
  if (!phoneRegex.test(riderPhone.trim())) {
    throw new Error(`Invalid rider phone '${riderPhone}'. Must follow Nigerian international format (+2348012345678).`);
  }

  const assignment: DispatchAssignment = {
    id: `dsp-${crypto.randomUUID()}`,
    orderId: order.id,
    orderCode: order.orderCode,
    riderName: riderName.trim(),
    riderPhone: riderPhone.trim(),
    riderVehiclePlate: riderVehiclePlate?.trim(),
    dispatchStatus: 'assigned',
    customerSignatureConfirmed: false,
    createdAt: new Date().toISOString(),
  };

  dispatchRepository.save(assignment);

  // Advance order status to out_for_delivery
  order.status = 'out_for_delivery';
  order.updatedAt = new Date().toISOString();
  orderRepository.save(order);

  return assignment;
}

/**
 * Confirms order delivery upon handoff to customer.
 */
export function confirmDelivery(params: {
  dispatchId: string;
  deliveredAt?: string;
  customerSignatureConfirmed?: boolean;
}): DispatchAssignment {
  const { dispatchId, deliveredAt = new Date().toISOString(), customerSignatureConfirmed = true } = params;

  const assignment = dispatchRepository.getById(dispatchId);
  if (!assignment) {
    throw new Error(`Dispatch assignment '${dispatchId}' not found.`);
  }

  if (assignment.dispatchStatus === 'delivered') {
    throw new Error('Order has already been marked as delivered.');
  }

  assignment.dispatchStatus = 'delivered';
  assignment.deliveredAt = deliveredAt;
  assignment.customerSignatureConfirmed = customerSignatureConfirmed;
  dispatchRepository.save(assignment);

  // Advance order status to delivered
  const order = orderRepository.getById(assignment.orderId);
  if (order) {
    order.status = 'delivered';
    order.updatedAt = new Date().toISOString();
    orderRepository.save(order);
  }

  return assignment;
}

/**
 * Generates or retrieves a cryptographically random public tracking token for an order.
 * Eliminates sequential ID crawling and IDOR vulnerabilities.
 */
export function ensureOrderTrackingToken(order: Order): string {
  if (order.trackingToken && order.trackingToken.length >= 16) {
    return order.trackingToken;
  }
  const token = crypto.randomBytes(16).toString('hex');
  order.trackingToken = token;
  orderRepository.save(order);
  return token;
}

/**
 * Retrieves public tracking view by token.
 * Prevents IDOR by rejecting non-token queries or sequential IDs.
 */
export function getTrackingViewByToken(token: string): CustomerTrackingView | null {
  if (!token || typeof token !== 'string' || token.trim().length < 16) {
    return null;
  }

  const allOrders = orderRepository.getAll();
  const order = allOrders.find((o) => o.trackingToken === token.trim());
  if (!order) {
    return null;
  }

  const assignment = dispatchRepository.getByOrderId(order.id);

  let statusStep = 1;
  let progressPercent = 25;

  if (order.status === 'in_kitchen') {
    statusStep = 2;
    progressPercent = 50;
  } else if (order.status === 'ready_for_dispatch') {
    statusStep = 2;
    progressPercent = 65;
  } else if (order.status === 'out_for_delivery') {
    statusStep = 3;
    progressPercent = 85;
  } else if (order.status === 'delivered') {
    statusStep = 4;
    progressPercent = 100;
  }

  return {
    orderCode: order.orderCode,
    customerName: order.customerName,
    deliveryAddress: order.deliveryAddress,
    deliveryType: order.deliveryType,
    status: order.status,
    statusStep,
    progressPercent,
    riderName: assignment?.riderName,
    riderPhone: assignment?.riderPhone,
    items: order.items.map((i) => ({ name: i.nameSnapshot, quantity: i.quantity })),
    createdAt: order.createdAt,
  };
}

/**
 * Formats WhatsApp / SMS customer notification messages.
 */
export function formatCustomerNotification(
  order: Order,
  type: 'kitchen_started' | 'dispatched' | 'delivered',
  appBaseUrl = 'https://rockucfoods.ng'
): NotificationPayload {
  const token = ensureOrderTrackingToken(order);
  const trackUrl = `${appBaseUrl}/track/${token}`;
  const firstName = order.customerName.split(' ')[0];

  let messageText = '';

  if (type === 'kitchen_started') {
    messageText = `Hello ${firstName}, your ROCK UC FOODS order ${order.orderCode} has been verified and our executive chef is preparing your dishes! Track your order live here: ${trackUrl}`;
  } else if (type === 'dispatched') {
    const assignment = dispatchRepository.getByOrderId(order.id);
    const riderInfo = assignment ? `with rider ${assignment.riderName} (${assignment.riderPhone})` : 'with our courier';
    messageText = `Hello ${firstName}, your luxury meal ${order.orderCode} is on the way ${riderInfo}! Real-time tracking: ${trackUrl}`;
  } else {
    messageText = `Hello ${firstName}, your ROCK UC FOODS order ${order.orderCode} has been delivered safely. Taste the luxury! Enjoy your meal.`;
  }

  return {
    recipientPhone: order.customerPhone,
    recipientName: order.customerName,
    messageType: type,
    messageText,
  };
}
