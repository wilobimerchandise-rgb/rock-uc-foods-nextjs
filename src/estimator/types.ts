/**
 * ROCK UC FOODS - Catering Estimator Types
 * Playbook v4 Section 20
 */

export interface EstimatorTier {
  id: string;
  name: string;
  description: string;
  pricePerGuestKobo: bigint;
  minGuests: number;
  maxGuests: number;
  isDefault?: boolean;
}

export interface EstimatorAddOn {
  id: string;
  name: string;
  description: string;
  unitPriceKobo: bigint;
  pricingModel: 'per_guest' | 'flat';
  maxQuantity?: number;
}

export interface EstimatorServiceRates {
  serviceChargeBps: number; // basis points, e.g. 1000 = 10%
  baseLogisticsKobo: bigint;
  minDepositBps: number;    // e.g. 7000 = 70%
}

export interface EstimatorConfig {
  id: string;
  version: number;
  tiers: EstimatorTier[];
  addOns: EstimatorAddOn[];
  serviceRates: EstimatorServiceRates;
  updatedAt: string;
  updatedBy: string;
}

export interface SelectedAddOnInput {
  addOnId: string;
  quantity: number;
}

export interface EstimateInput {
  tierId: string;
  guestCount: number;
  selectedAddOns?: SelectedAddOnInput[];
}

export interface CalculatedAddOn {
  addOn: EstimatorAddOn;
  quantity: number;
  totalKobo: bigint;
}

export interface EstimateResult {
  tier: EstimatorTier;
  guestCount: number;
  foodSubtotalKobo: bigint;
  addOns: CalculatedAddOn[];
  addOnsSubtotalKobo: bigint;
  serviceChargeKobo: bigint;
  logisticsKobo: bigint;
  grandTotalKobo: bigint;
  depositKobo: bigint;
  balanceKobo: bigint;
}

export interface EstimatorConfigJson {
  id: string;
  version: number;
  tiers: Array<{
    id: string;
    name: string;
    description: string;
    pricePerGuestKobo: string;
    minGuests: number;
    maxGuests: number;
    isDefault?: boolean;
  }>;
  addOns: Array<{
    id: string;
    name: string;
    description: string;
    unitPriceKobo: string;
    pricingModel: 'per_guest' | 'flat';
    maxQuantity?: number;
  }>;
  serviceRates: {
    serviceChargeBps: number;
    baseLogisticsKobo: string;
    minDepositBps: number;
  };
  updatedAt: string;
  updatedBy: string;
}
