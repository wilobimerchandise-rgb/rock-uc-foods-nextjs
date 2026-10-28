/**
 * ROCK UC FOODS - Catering Estimator Calculation Engine
 * Playbook v4 Section 20
 * 
 * Strict BigInt kobo integer arithmetic.
 * Never uses float, double, or fractional division for money.
 */

import { EstimateInput, EstimateResult, EstimatorConfig, CalculatedAddOn } from './types';
import { MAX_KOBO, applyPercentRoundHalfUp } from '../lib/money';

export function computeEstimate(
  input: EstimateInput,
  config: EstimatorConfig
): EstimateResult {
  const { guestCount, tierId, selectedAddOns = [] } = input;

  // 1. Validate Guest Count
  if (!Number.isInteger(guestCount) || guestCount < 1) {
    throw new Error('Guest count must be a positive integer.');
  }

  // 2. Locate Selected Tier
  const tier = config.tiers.find((t) => t.id === tierId);
  if (!tier) {
    throw new Error(`Invalid tier selected: '${tierId}'.`);
  }

  if (guestCount < tier.minGuests || guestCount > tier.maxGuests) {
    throw new Error(
      `Guest count ${guestCount} is outside allowed range (${tier.minGuests} - ${tier.maxGuests}) for ${tier.name}.`
    );
  }

  // 3. Food Subtotal
  const foodSubtotalKobo = BigInt(guestCount) * tier.pricePerGuestKobo;

  // 4. Calculate Add-ons
  const calculatedAddOns: CalculatedAddOn[] = [];
  let addOnsSubtotalKobo = 0n;

  for (const item of selectedAddOns) {
    if (item.quantity <= 0) continue;

    const addOn = config.addOns.find((a) => a.id === item.addOnId);
    if (!addOn) {
      throw new Error(`Invalid add-on selected: '${item.addOnId}'.`);
    }

    const qtyBig = BigInt(item.quantity);
    let itemTotalKobo = 0n;

    if (addOn.pricingModel === 'per_guest') {
      // Per guest: guestCount * unitPrice * quantity
      itemTotalKobo = BigInt(guestCount) * addOn.unitPriceKobo * qtyBig;
    } else {
      // Flat rate: unitPrice * quantity
      itemTotalKobo = addOn.unitPriceKobo * qtyBig;
    }

    calculatedAddOns.push({
      addOn,
      quantity: item.quantity,
      totalKobo: itemTotalKobo,
    });

    addOnsSubtotalKobo += itemTotalKobo;
  }

  // 5. Service Charge (e.g. 1000 bps = 10%)
  const chargeableSubtotal = foodSubtotalKobo + addOnsSubtotalKobo;
  const serviceChargeKobo = applyPercentRoundHalfUp(
    chargeableSubtotal,
    config.serviceRates.serviceChargeBps
  );

  // 6. Logistics
  const logisticsKobo = config.serviceRates.baseLogisticsKobo;

  // 7. Grand Total
  const grandTotalKobo = chargeableSubtotal + serviceChargeKobo + logisticsKobo;

  // 8. Ceiling Enforcement: MAX_KOBO = ₦100,000,000.00
  if (grandTotalKobo > MAX_KOBO) {
    throw new Error(
      `Estimate total exceeds maximum allowed limit of ₦100,000,000.00.`
    );
  }

  // 9. 70/30 Deposit & Balance Split
  const depositKobo = applyPercentRoundHalfUp(
    grandTotalKobo,
    config.serviceRates.minDepositBps
  );
  const balanceKobo = grandTotalKobo - depositKobo;

  return {
    tier,
    guestCount,
    foodSubtotalKobo,
    addOns: calculatedAddOns,
    addOnsSubtotalKobo,
    serviceChargeKobo,
    logisticsKobo,
    grandTotalKobo,
    depositKobo,
    balanceKobo,
  };
}
