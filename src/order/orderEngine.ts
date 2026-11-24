/**
 * ROCK UC FOODS - Server-Authoritative Ordering Engine
 * (Playbook v2 Section 8, Section 17 v3 Addendum & Manual GTBank Transfer Flow)
 *
 * Security & Money Rules:
 * - Zero client trust: subtotal, delivery fee, promo discount, and total are computed
 *   strictly on the server in BigInt integer kobo.
 * - Server-generated random, non-sequential payment reference (RUC-XXXXXX).
 * - CSPRNG 128-bit trackingToken bound to customer ownership.
 * - Checkout blocked if bank details are missing/unverified:
 *   "Payment details unavailable, contact us on 08033729125"
 * - Unpaid orders expire automatically after 7 hours.
 */

import crypto from 'crypto';
import { CreateOrderInput, Order, OrderItemSnapshot } from '../types/order';
import { menuRepository } from '../menu/data';
import { calculateDeliveryFeeKobo } from './deliveryZones';
import { normalizeNigerianPhone } from '../lib/security';
import { validatePolicyConsent } from '../policy/consent';
import { orderRepository } from './orderRepository';
import { getOrderablePrice } from '../menu/pricing';
import {
  hasVerifiedBankSettings,
  MISSING_BANK_DETAILS_CHECKOUT_MESSAGE,
} from '../lib/businessSettings';
import { promoRepository, validateAndCalculatePromo } from '../promotions/promotionEngine';

/**
 * Unpaid orders expire after 7 hours.
 */
export const ORDER_EXPIRY_HOURS = 7;
export const ORDER_EXPIRY_MS = ORDER_EXPIRY_HOURS * 60 * 60 * 1000;

const REF_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomChars(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  }
  return out;
}

/**
 * Generates collision-resistant, non-sequential order tracking codes.
 * Format: RUC-YYYYMMDD-XXXX (e.g. RUC-20261019-9B2F)
 */
export function generateOrderCode(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `RUC-${year}${month}${day}-${randomChars(4)}`;
}

/**
 * Generates a unique, non-sequential 6-character transfer narration reference (e.g. RUC-9K4M2P)
 * using CSPRNG crypto.randomBytes.
 */
export function generatePaymentReference(): string {
  for (let attempt = 0; attempt < 15; attempt++) {
    const candidate = `RUC-${randomChars(6)}`;
    if (!orderRepository.hasPaymentReference(candidate)) {
      return candidate;
    }
  }
  return `RUC-${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
}

export function generateOrderTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function validateAndCalculateOrder(input: CreateOrderInput): Order {
  // 0. Ensure official bank transfer details are configured & verified before accepting orders
  if (!hasVerifiedBankSettings()) {
    throw new Error(MISSING_BANK_DETAILS_CHECKOUT_MESSAGE);
  }

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

  const orderId = `ord-${crypto.randomUUID()}`;
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

    // Authoritative calculation via getOrderablePrice
    const priced = getOrderablePrice(
      itemInput.menuItemId,
      itemInput.selectedOptionIds || [],
      itemInput.selectedTierId
    );

    const unitPriceKobo = priced.totalUnitKobo;
    const itemTotalKobo = unitPriceKobo * BigInt(qty);
    subtotalKobo += itemTotalKobo;

    snapshotItems.push({
      id: `snap-${orderId}-${idx + 1}`,
      orderId,
      menuItemId: menuItem.id,
      nameSnapshot: menuItem.name,
      portionSnapshot: menuItem.portionLabel,
      selectedTierName: priced.tierName,
      selectedOptionsSnapshot: priced.optionSnapshots,
      unitPriceKoboSnapshot: unitPriceKobo,
      quantity: qty,
      totalKoboSnapshot: itemTotalKobo,
    });
  }

  if (subtotalKobo <= 0n) {
    throw new Error('Order subtotal must be greater than zero.');
  }

  // 5. Server-side Promo Recalculation (NEVER accept client-supplied discountKobo or totalKobo)
  let discountKobo = 0n;
  let resolvedPromoId: string | undefined = undefined;
  const promoLookupCode =
    input.promoCode?.trim() ||
    (input.promoCodeId ? promoRepository.getById(input.promoCodeId)?.code : undefined);

  if (promoLookupCode) {
    const promoRes = validateAndCalculatePromo(promoLookupCode, subtotalKobo);
    if (!promoRes.isValid) {
      throw new Error(promoRes.reason || 'Invalid or expired promo code.');
    }
    discountKobo = promoRes.discountKobo > subtotalKobo ? subtotalKobo : promoRes.discountKobo;
    resolvedPromoId = promoRes.promoCode?.id;
  }

  const totalKobo = (subtotalKobo - discountKobo) + deliveryFeeKobo;
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAtIso = new Date(now.getTime() + ORDER_EXPIRY_MS).toISOString();

  const newOrder: Order = {
    id: orderId,
    orderCode: generateOrderCode(),
    paymentReference: generatePaymentReference(),
    trackingToken: generateOrderTrackingToken(),
    customerName: input.customerName.trim(),
    customerPhone: normalizedPhone,
    customerEmail: input.customerEmail ? input.customerEmail.trim() : undefined,
    deliveryType: input.deliveryType,
    deliveryZoneId: input.deliveryType === 'delivery' ? input.deliveryZoneId : undefined,
    deliveryAddress: input.deliveryType === 'delivery' ? input.deliveryAddress?.trim() : undefined,
    deliveryFeeKobo,
    subtotalKobo,
    discountKobo: discountKobo > 0n ? discountKobo : undefined,
    promoCodeId: resolvedPromoId,
    totalKobo,
    paidAmountKobo: 0n,
    status: 'pending_payment',
    specialInstructions: input.specialInstructions ? input.specialInstructions.trim() : undefined,
    policyVersion: input.policyVersion,
    policyAcceptedAt: nowIso,
    expiresAt: expiresAtIso,
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
