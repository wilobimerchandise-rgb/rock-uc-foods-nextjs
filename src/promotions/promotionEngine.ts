/**
 * ROCK UC FOODS - Promotions, Sales Reporting & Export Engine
 * Playbook v2 Section 12 (Phase 7: Reports, Promotions and Exports)
 * 
 * Rules:
 * - BigInt integer kobo throughout.
 * - Promo codes must be uppercase, active, within date window, and within usage limits.
 * - Percentage discounts properly capped at maxDiscountKobo.
 * - CSV export sanitization blocks spreadsheet formula injection (=, +, -, @).
 */

import {
  PromoCode,
  PromoValidationResult,
  SalesReport,
  ZoneSalesSummary,
  ItemPopularitySummary,
} from '../types/promotion';
import { Order } from '../types/order';
import { orderRepository } from '../order/orderRepository';
import { applyPercentRoundHalfUp, formatNaira } from '../lib/money';

class PromoRepository {
  private promos: Map<string, PromoCode> = new Map();

  clear() {
    this.promos.clear();
  }

  save(promo: PromoCode): PromoCode {
    const upperCode = promo.code.trim().toUpperCase();
    if (upperCode.length < 3 || upperCode.length > 30) {
      throw new Error('Promo code must be between 3 and 30 characters.');
    }

    if (promo.discountType === 'percentage' && (promo.discountValue <= 0n || promo.discountValue > 100n)) {
      throw new Error('Percentage discount must be between 1 and 100.');
    }

    if (new Date(promo.endDate).getTime() <= new Date(promo.startDate).getTime()) {
      throw new Error('Promotion end date must be after start date.');
    }

    for (const existing of this.promos.values()) {
      if (existing.id !== promo.id && existing.code === upperCode) {
        throw new Error(`Promo code '${upperCode}' already exists.`);
      }
    }

    const saved: PromoCode = {
      ...promo,
      code: upperCode,
    };
    this.promos.set(saved.id, saved);
    return saved;
  }

  getByCode(code: string): PromoCode | undefined {
    const upperCode = code.trim().toUpperCase();
    for (const promo of this.promos.values()) {
      if (promo.code === upperCode) {
        return promo;
      }
    }
    return undefined;
  }

  getById(id: string): PromoCode | undefined {
    return this.promos.get(id);
  }

  getAll(): PromoCode[] {
    return Array.from(this.promos.values());
  }

  incrementUsage(id: string): void {
    const promo = this.promos.get(id);
    if (!promo) {
      throw new Error(`Promo code '${id}' not found.`);
    }
    if (promo.usageLimit !== undefined && promo.usedCount >= promo.usageLimit) {
      throw new Error(`Promo code '${promo.code}' has reached its usage limit.`);
    }
    promo.usedCount += 1;
    this.promos.set(promo.id, { ...promo });
  }
}

export const promoRepository = new PromoRepository();

/**
 * Validates promo code against order subtotal and computes kobo discount.
 */
export function validateAndCalculatePromo(
  code: string,
  subtotalKobo: bigint,
  currentTimestampMs = Date.now()
): PromoValidationResult {
  const promo = promoRepository.getByCode(code);
  if (!promo) {
    return {
      isValid: false,
      discountKobo: 0n,
      reason: `Promo code '${code}' does not exist.`,
    };
  }

  if (!promo.isActive) {
    return {
      isValid: false,
      promoCode: promo,
      discountKobo: 0n,
      reason: `Promo code '${promo.code}' is inactive.`,
    };
  }

  const startMs = new Date(promo.startDate).getTime();
  const endMs = new Date(promo.endDate).getTime();

  if (currentTimestampMs < startMs) {
    return {
      isValid: false,
      promoCode: promo,
      discountKobo: 0n,
      reason: `Promotion has not started yet.`,
    };
  }

  if (currentTimestampMs > endMs) {
    return {
      isValid: false,
      promoCode: promo,
      discountKobo: 0n,
      reason: `Promo code '${promo.code}' has expired.`,
    };
  }

  if (promo.usageLimit !== undefined && promo.usedCount >= promo.usageLimit) {
    return {
      isValid: false,
      promoCode: promo,
      discountKobo: 0n,
      reason: `Promo code '${promo.code}' has reached its usage limit of ${promo.usageLimit} uses.`,
    };
  }

  if (subtotalKobo < promo.minOrderKobo) {
    return {
      isValid: false,
      promoCode: promo,
      discountKobo: 0n,
      reason: `Order subtotal (${formatNaira(subtotalKobo)}) is below the minimum threshold (${formatNaira(promo.minOrderKobo)}) for this promo code.`,
    };
  }

  let calculatedDiscount = 0n;

  if (promo.discountType === 'percentage') {
    calculatedDiscount = applyPercentRoundHalfUp(subtotalKobo, Number(promo.discountValue) * 100);
    if (promo.maxDiscountKobo !== undefined && calculatedDiscount > promo.maxDiscountKobo) {
      calculatedDiscount = promo.maxDiscountKobo;
    }
  } else {
    // Fixed amount
    calculatedDiscount = promo.discountValue;
  }

  // Discount can never exceed subtotal
  if (calculatedDiscount > subtotalKobo) {
    calculatedDiscount = subtotalKobo;
  }

  return {
    isValid: true,
    promoCode: promo,
    discountKobo: calculatedDiscount,
  };
}

/**
 * Generates comprehensive sales analytics report across orders.
 */
export function generateSalesReport(startDate?: string, endDate?: string): SalesReport {
  const allOrders = orderRepository.getAll();
  const startMs = startDate ? new Date(startDate).getTime() : 0;
  const endMs = endDate ? new Date(endDate).getTime() : Number.MAX_SAFE_INTEGER;

  const qualifyingStatuses = ['payment_confirmed', 'in_kitchen', 'ready_for_dispatch', 'out_for_delivery', 'delivered'];

  const filteredOrders = allOrders.filter((ord) => {
    const orderMs = new Date(ord.createdAt).getTime();
    return orderMs >= startMs && orderMs <= endMs && qualifyingStatuses.includes(ord.status);
  });

  let totalOrders = 0;
  let grossRevenueKobo = 0n;
  let totalDiscountsKobo = 0n;
  let totalDeliveryFeesKobo = 0n;
  let netRevenueKobo = 0n;

  const zoneMap: Map<string, ZoneSalesSummary> = new Map();
  const itemMap: Map<string, ItemPopularitySummary> = new Map();

  for (const order of filteredOrders) {
    totalOrders++;
    grossRevenueKobo += order.subtotalKobo;
    totalDeliveryFeesKobo += order.deliveryFeeKobo;
    netRevenueKobo += order.totalKobo;

    // Delivery zone aggregation
    const zoneId = order.deliveryZoneId || 'COLLECTION';
    const existingZone = zoneMap.get(zoneId) || { zoneId, orderCount: 0, revenueKobo: 0n };
    existingZone.orderCount += 1;
    existingZone.revenueKobo += order.totalKobo;
    zoneMap.set(zoneId, existingZone);

    // Items aggregation
    for (const item of order.items) {
      const existingItem = itemMap.get(item.menuItemId) || {
        menuItemId: item.menuItemId,
        name: item.nameSnapshot,
        quantity: 0,
        revenueKobo: 0n,
      };
      existingItem.quantity += item.quantity;
      existingItem.revenueKobo += item.totalKoboSnapshot;
      itemMap.set(item.menuItemId, existingItem);
    }
  }

  const averageOrderValueKobo = totalOrders > 0 ? netRevenueKobo / BigInt(totalOrders) : 0n;

  const zoneBreakdown: Record<string, ZoneSalesSummary> = {};
  for (const [k, v] of zoneMap.entries()) {
    zoneBreakdown[k] = v;
  }

  const itemPopularity = Array.from(itemMap.values()).sort((a, b) => b.quantity - a.quantity);

  return {
    generatedAt: new Date().toISOString(),
    startDate: startDate || 'ALL_TIME',
    endDate: endDate || 'NOW',
    totalOrders,
    grossRevenueKobo,
    totalDiscountsKobo,
    totalDeliveryFeesKobo,
    netRevenueKobo,
    averageOrderValueKobo,
    zoneBreakdown,
    itemPopularity,
  };
}

/**
 * Sanitizes CSV cell to prevent CSV / Spreadsheet formula injection:
 * Prepends an apostrophe if text starts with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let str = String(value);

  // If text starts with dangerous formula trigger characters, prefix with single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape quotes and wrap in quotes if containing comma, newline, or quotes
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports orders ledger to CSV format with formula injection sanitization.
 */
export function exportOrdersToCsv(orders: Order[]): string {
  const headers = [
    'Order Code',
    'Date',
    'Customer Name',
    'Phone',
    'Zone',
    'Subtotal Kobo',
    'Subtotal Formatted',
    'Delivery Fee Kobo',
    'Delivery Fee Formatted',
    'Total Kobo',
    'Total Formatted',
    'Status',
  ];

  const rows = orders.map((ord) => [
    sanitizeCsvCell(ord.orderCode),
    sanitizeCsvCell(ord.createdAt.split('T')[0]),
    sanitizeCsvCell(ord.customerName),
    sanitizeCsvCell(ord.customerPhone),
    sanitizeCsvCell(ord.deliveryZoneId || 'COLLECTION'),
    sanitizeCsvCell(ord.subtotalKobo.toString()),
    sanitizeCsvCell(formatNaira(ord.subtotalKobo)),
    sanitizeCsvCell(ord.deliveryFeeKobo.toString()),
    sanitizeCsvCell(formatNaira(ord.deliveryFeeKobo)),
    sanitizeCsvCell(ord.totalKobo.toString()),
    sanitizeCsvCell(formatNaira(ord.totalKobo)),
    sanitizeCsvCell(ord.status),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
