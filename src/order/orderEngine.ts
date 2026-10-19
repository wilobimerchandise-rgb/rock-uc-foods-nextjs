/**
 * ROCK UC FOODS - Server-Authoritative Ordering Engine
 * (Playbook v2 Section 8 & Section 17 v3 Addendum)
 * Prevents client price tampering, enforces integer kobo arithmetic,
 * normalizes Nigerian telephone contacts, and enforces mandatory policy consent.
 */

import { CreateOrderInput, Order, OrderItemSnapshot } from '../types/order';
import { menuRepository } from '../menu/data';
import { calculateDeliveryFeeKobo } from './deliveryZones';
import { normalizeNigerianPhone } from '../lib/security';
import { validatePolicyConsent } from '../policy/consent';
import { orderRepository } from './orderRepository';

/**
 * Generates collision-resistant, non-sequential order tracking codes.
 * Format: RUC-YYYYMMDD-XXXX (e.g. RUC-20261019-9B2F)
 */
export function generateOrderCode(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without easily confused 0/O, 1/I
  let randomSuffix = '';
  for (let i = 0; i < 4; i++) {
    randomSuffix += chars[Math.floor(Math.random() * chars.length)];
  }

  return `RUC-${dateStr}-${randomSuffix}`;
}

export function validateAndCalculateOrder(input: CreateOrderInput): Order {
  // 1. Mandatory Policy Consent Verification
  validatePolicyConsent({
    acceptedPolicy: input.acceptedPolicy,
    policyVersion: input.policyVersion,
  });

  // 2. Validate Customer Details
  if (!input.customerName || input.customerName.trim().length < 2) {
    throw new Error('Please enter your full name (minimum 2 characters).');
  }

  const normalizedPhone = normalizeNigerianPhone(input.customerPhone);

  // 3. Validate Delivery / Collection
  if (input.deliveryType === 'delivery') {
    if (!input.deliveryAddress || input.deliveryAddress.trim().length < 5) {
      throw new Error('Please provide a complete delivery address in Lagos.');
    }
  }

  const deliveryFeeKobo = calculateDeliveryFeeKobo(input.deliveryType, input.deliveryZoneId);

  // 4. Validate Items & Compute Snapshot Prices Server-Side (Zero Trust on Client Prices)
  if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('Your cart is empty. Please select at least one dish.');
  }

  if (input.items.length > 30) {
    throw new Error('Cart limit exceeded. Maximum 30 distinct menu items per order.');
  }

  const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  let subtotalKobo = 0n;
  const snapshotItems: OrderItemSnapshot[] = [];

  for (let idx = 0; idx < input.items.length; idx++) {
    const itemInput = input.items[idx];
    const menuItem = menuRepository.getItemById(itemInput.menuItemId);

    if (!menuItem) {
      throw new Error(`Item not found in menu: ID '${itemInput.menuItemId}'.`);
    }

    if (menuItem.status !== 'published') {
      throw new Error(`Item '${menuItem.name}' is currently not available for ordering.`);
    }

    if (!menuItem.isAvailable) {
      throw new Error(`Item '${menuItem.name}' is sold out today.`);
    }

    const qty = Math.floor(Number(itemInput.quantity));
    if (isNaN(qty) || qty < 1 || qty > 100) {
      throw new Error(`Invalid quantity for '${menuItem.name}'. Must be between 1 and 100.`);
    }

    const unitPriceKobo = menuItem.priceKobo;
    const itemTotalKobo = unitPriceKobo * BigInt(qty);
    subtotalKobo += itemTotalKobo;

    snapshotItems.push({
      id: `snap-${orderId}-${idx + 1}`,
      orderId,
      menuItemId: menuItem.id,
      nameSnapshot: menuItem.name,
      portionSnapshot: menuItem.portionLabel,
      unitPriceKoboSnapshot: unitPriceKobo,
      quantity: qty,
      totalKoboSnapshot: itemTotalKobo,
    });
  }

  if (subtotalKobo <= 0n) {
    throw new Error('Order subtotal must be greater than zero.');
  }

  const totalKobo = subtotalKobo + deliveryFeeKobo;
  const nowIso = new Date().toISOString();

  const newOrder: Order = {
    id: orderId,
    orderCode: generateOrderCode(),
    customerName: input.customerName.trim(),
    customerPhone: normalizedPhone,
    customerEmail: input.customerEmail ? input.customerEmail.trim() : undefined,
    deliveryType: input.deliveryType,
    deliveryZoneId: input.deliveryType === 'delivery' ? input.deliveryZoneId : undefined,
    deliveryAddress: input.deliveryType === 'delivery' ? input.deliveryAddress?.trim() : undefined,
    deliveryFeeKobo,
    subtotalKobo,
    totalKobo,
    status: 'pending_payment',
    specialInstructions: input.specialInstructions ? input.specialInstructions.trim() : undefined,
    policyVersion: input.policyVersion,
    policyAcceptedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    items: snapshotItems,
  };

  return newOrder;
}

export function createOrder(input: CreateOrderInput): Order {
  const order = validateAndCalculateOrder(input);
  return orderRepository.save(order);
}
