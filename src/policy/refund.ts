/**
 * ROCK UC FOODS - Deterministic Refund and Cancellation Engine
 * (Playbook v2 Section 17.7 Builder Specification)
 * Strictly BigInt integer kobo arithmetic.
 * Never refund more than verified payments actually received.
 */

import { applyPercentRoundHalfUp } from '../lib/money';

export type OrderClassification = 'fresh' | 'bulk';

/**
 * Classifies an order based on pack count or special catering flags:
 * 1-20 packs fresh; 21+ or tray or live cooking = bulk.
 */
export function classifyOrder(
  totalPackCount: number,
  isTrayOrLiveCooking: boolean = false
): OrderClassification {
  if (isTrayOrLiveCooking || totalPackCount > 20) {
    return 'bulk';
  }
  return 'fresh';
}

/**
 * Calculates the refund basis points for bulk orders based on notice hours.
 * Lower bounds are inclusive:
 * >= 72h: 8000 bps (80%)
 * >= 48h: 5000 bps (50%)
 * >= 24h: 2500 bps (25%)
 * < 24h: 0 bps (0%)
 */
export function bulkRefundBps(noticeHours: number): number {
  if (noticeHours >= 72) return 8000;
  if (noticeHours >= 48) return 5000;
  if (noticeHours >= 24) return 2500;
  return 0;
}

export interface RefundCalculationParams {
  classification: OrderClassification;
  foodSubtotalKobo: bigint;
  deliveryFeeKobo: bigint;
  verifiedPaidKobo: bigint;
  orderTimestampMs: number;
  cancellationTimestampMs: number;
  cookingStarted: boolean;
  cancelledByBusiness?: boolean;
  eventDateTimestampMs?: number; // for bulk orders
}

export interface RefundResult {
  eligibleRefundKobo: bigint;
  refundFoodKobo: bigint;
  refundDeliveryKobo: bigint;
  reason: string;
}

/**
 * Computes deterministic refund amount adhering to policy boundaries.
 */
export function calculateRefund(params: RefundCalculationParams): RefundResult {
  const {
    classification,
    foodSubtotalKobo,
    deliveryFeeKobo,
    verifiedPaidKobo,
    orderTimestampMs,
    cancellationTimestampMs,
    cookingStarted,
    cancelledByBusiness = false,
    eventDateTimestampMs,
  } = params;

  // Zero refund if no money was verified received
  if (verifiedPaidKobo <= 0n) {
    return {
      eligibleRefundKobo: 0n,
      refundFoodKobo: 0n,
      refundDeliveryKobo: 0n,
      reason: 'No verified payment exists to refund.',
    };
  }

  // 1. If Business Cancels / Out of Stock -> 100% refund of food + delivery
  if (cancelledByBusiness) {
    const totalPayable = foodSubtotalKobo + deliveryFeeKobo;
    const refundTotal = totalPayable < verifiedPaidKobo ? totalPayable : verifiedPaidKobo;
    return {
      eligibleRefundKobo: refundTotal,
      refundFoodKobo: foodSubtotalKobo < refundTotal ? foodSubtotalKobo : refundTotal,
      refundDeliveryKobo: deliveryFeeKobo,
      reason: '100% refund issued due to business cancellation or out-of-stock.',
    };
  }

  // 2. Fresh Meal Cancellation (1-20 packs)
  if (classification === 'fresh') {
    const elapsedMinutes = (cancellationTimestampMs - orderTimestampMs) / (60 * 1000);

    // Eligible ONLY if within 30 minutes AND cooking has not started
    if (elapsedMinutes <= 30 && !cookingStarted) {
      const eligibleTotal = foodSubtotalKobo + deliveryFeeKobo;
      const actualRefund = eligibleTotal < verifiedPaidKobo ? eligibleTotal : verifiedPaidKobo;
      return {
        eligibleRefundKobo: actualRefund,
        refundFoodKobo: foodSubtotalKobo,
        refundDeliveryKobo: deliveryFeeKobo,
        reason: '100% refund: cancelled within 30 minutes before cooking started.',
      };
    }

    return {
      eligibleRefundKobo: 0n,
      refundFoodKobo: 0n,
      refundDeliveryKobo: 0n,
      reason: cookingStarted
        ? 'Non-refundable: fresh meal cooking has already started.'
        : 'Non-refundable: cancellation exceeded 30-minute threshold.',
    };
  }

  // 3. Bulk & Event Orders (21+ packs / trays / live cooking)
  if (classification === 'bulk') {
    if (!eventDateTimestampMs) {
      throw new Error('Event date timestamp is required for bulk refund calculation.');
    }

    const diffHours = (eventDateTimestampMs - cancellationTimestampMs) / (3600 * 1000);
    const bps = bulkRefundBps(diffHours);

    if (bps === 0) {
      return {
        eligibleRefundKobo: 0n,
        refundFoodKobo: 0n,
        refundDeliveryKobo: 0n,
        reason: 'Non-refundable: bulk order cancelled less than 24 hours before event.',
      };
    }

    // Bulk refund applies to FOOD subtotal only. Delivery fee is non-refundable.
    const calculatedFoodRefund = applyPercentRoundHalfUp(foodSubtotalKobo, bps);
    // Refund can never exceed verified amount paid
    const actualRefund = calculatedFoodRefund < verifiedPaidKobo ? calculatedFoodRefund : verifiedPaidKobo;

    return {
      eligibleRefundKobo: actualRefund,
      refundFoodKobo: actualRefund,
      refundDeliveryKobo: 0n,
      reason: `Bulk refund of ${(bps / 100).toFixed(0)}% on food subtotal (${diffHours.toFixed(1)}h notice). Delivery fee non-refundable.`,
    };
  }

  return {
    eligibleRefundKobo: 0n,
    refundFoodKobo: 0n,
    refundDeliveryKobo: 0n,
    reason: 'Unrecognized order classification.',
  };
}
