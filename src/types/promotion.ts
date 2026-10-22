/**
 * ROCK UC FOODS - Promotions, Reports & Export Types
 * Playbook v2 Section 12 (Phase 7: Reports, Promotions and Exports)
 * All monetary amounts are strictly BigInt integer kobo.
 */

export type DiscountType = 'percentage' | 'fixed_amount';

export interface PromoCode {
  id: string;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: bigint; // Percentage (1-100) or fixed kobo amount
  minOrderKobo: bigint;
  maxDiscountKobo?: bigint;
  usageLimit?: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface PromoValidationResult {
  isValid: boolean;
  promoCode?: PromoCode;
  discountKobo: bigint;
  reason?: string;
}

export interface ZoneSalesSummary {
  zoneId: string;
  orderCount: number;
  revenueKobo: bigint;
}

export interface ItemPopularitySummary {
  menuItemId: string;
  name: string;
  quantity: number;
  revenueKobo: bigint;
}

export interface SalesReport {
  generatedAt: string;
  startDate: string;
  endDate: string;
  totalOrders: number;
  grossRevenueKobo: bigint;
  totalDiscountsKobo: bigint;
  totalDeliveryFeesKobo: bigint;
  netRevenueKobo: bigint;
  averageOrderValueKobo: bigint;
  zoneBreakdown: Record<string, ZoneSalesSummary>;
  itemPopularity: ItemPopularitySummary[];
}
