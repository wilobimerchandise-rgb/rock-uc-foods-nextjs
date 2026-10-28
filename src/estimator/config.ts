/**
 * ROCK UC FOODS - Catering Estimator Configuration
 * Playbook v4 Section 20
 * 
 * Single source of truth for catering tiers, add-ons, and service rates.
 */

import {
  EstimatorConfig,
  EstimatorConfigJson,
  EstimatorTier,
  EstimatorAddOn,
  EstimatorServiceRates,
} from './types';

export const INITIAL_ESTIMATOR_TIERS: EstimatorTier[] = [
  {
    id: 'tier-bronze',
    name: 'Bronze Feast',
    description: 'Classic party jollof, proteins, sides, and chilled zobo',
    pricePerGuestKobo: 1250000n, // ₦12,500.00
    minGuests: 20,
    maxGuests: 50,
    isDefault: true,
  },
  {
    id: 'tier-silver',
    name: 'Silver Banquet',
    description: 'Smoky jollof, fried rice, premium goat meat, chicken, and moin-moin',
    pricePerGuestKobo: 1850000n, // ₦18,500.00
    minGuests: 51,
    maxGuests: 150,
  },
  {
    id: 'tier-gold',
    name: 'Gold Royal',
    description: 'Full traditional spread: ofada, egusi, seafood okra, fresh fish, and small chops',
    pricePerGuestKobo: 2600000n, // ₦26,000.00
    minGuests: 151,
    maxGuests: 300,
  },
  {
    id: 'tier-platinum',
    name: 'Platinum Sovereign',
    description: 'Executive live cooking, carving stations, grilled jumbo prawns, and gourmet dining',
    pricePerGuestKobo: 3500000n, // ₦35,000.00
    minGuests: 301,
    maxGuests: 1000,
  },
];

export const INITIAL_ESTIMATOR_ADD_ONS: EstimatorAddOn[] = [
  {
    id: 'addon-smallchops',
    name: 'Live Small Chops Bar',
    description: 'Hot samosas, spring rolls, puff-puff, and gizdodo prepared on-site',
    unitPriceKobo: 350000n, // ₦3,500.00
    pricingModel: 'per_guest',
  },
  {
    id: 'addon-dessert',
    name: 'Luxury Dessert Buffet',
    description: 'Artisan cakes, fruit parfaits, and bespoke sweet treats',
    unitPriceKobo: 450000n, // ₦4,500.00
    pricingModel: 'per_guest',
  },
  {
    id: 'addon-butlers',
    name: 'Uniformed Butler & Server Team',
    description: 'Professional banquet service staff for up to 6 hours',
    unitPriceKobo: 15000000n, // ₦150,000.00
    pricingModel: 'flat',
  },
  {
    id: 'addon-tableware',
    name: 'Chafing & Premium Tableware Setup',
    description: 'Luxury chafing dishes, golden cutlery, and fine dining tableware',
    unitPriceKobo: 10000000n, // ₦100,000.00
    pricingModel: 'flat',
  },
];

export const INITIAL_SERVICE_RATES: EstimatorServiceRates = {
  serviceChargeBps: 1000, // 10.00%
  baseLogisticsKobo: 5000000n, // ₦50,000.00
  minDepositBps: 7000, // 70.00%
};

export const INITIAL_ESTIMATOR_CONFIG: EstimatorConfig = {
  id: 'default',
  version: 1,
  tiers: INITIAL_ESTIMATOR_TIERS,
  addOns: INITIAL_ESTIMATOR_ADD_ONS,
  serviceRates: INITIAL_SERVICE_RATES,
  updatedAt: new Date().toISOString(),
  updatedBy: 'owner@rockucfoods.com',
};

// In-memory runtime cache / fallback
let currentConfig: EstimatorConfig = { ...INITIAL_ESTIMATOR_CONFIG };

export function getEstimatorConfig(): EstimatorConfig {
  return currentConfig;
}

export function setEstimatorConfig(newConfig: EstimatorConfig): void {
  currentConfig = newConfig;
}

export function resetEstimatorConfig(): void {
  currentConfig = {
    ...INITIAL_ESTIMATOR_CONFIG,
    version: 1,
    tiers: [...INITIAL_ESTIMATOR_TIERS],
    addOns: [...INITIAL_ESTIMATOR_ADD_ONS],
    serviceRates: { ...INITIAL_SERVICE_RATES },
    updatedAt: new Date().toISOString(),
  };
}

export function serializeEstimatorConfig(config: EstimatorConfig): EstimatorConfigJson {
  return {
    id: config.id,
    version: config.version,
    tiers: config.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      pricePerGuestKobo: t.pricePerGuestKobo.toString(),
      minGuests: t.minGuests,
      maxGuests: t.maxGuests,
      isDefault: t.isDefault,
    })),
    addOns: config.addOns.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      unitPriceKobo: a.unitPriceKobo.toString(),
      pricingModel: a.pricingModel,
      maxQuantity: a.maxQuantity,
    })),
    serviceRates: {
      serviceChargeBps: config.serviceRates.serviceChargeBps,
      baseLogisticsKobo: config.serviceRates.baseLogisticsKobo.toString(),
      minDepositBps: config.serviceRates.minDepositBps,
    },
    updatedAt: config.updatedAt,
    updatedBy: config.updatedBy,
  };
}

export function deserializeEstimatorConfig(json: EstimatorConfigJson): EstimatorConfig {
  return {
    id: json.id,
    version: json.version,
    tiers: json.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      pricePerGuestKobo: BigInt(t.pricePerGuestKobo),
      minGuests: t.minGuests,
      maxGuests: t.maxGuests,
      isDefault: t.isDefault,
    })),
    addOns: json.addOns.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      unitPriceKobo: BigInt(a.unitPriceKobo),
      pricingModel: a.pricingModel,
      maxQuantity: a.maxQuantity,
    })),
    serviceRates: {
      serviceChargeBps: json.serviceRates.serviceChargeBps,
      baseLogisticsKobo: BigInt(json.serviceRates.baseLogisticsKobo),
      minDepositBps: json.serviceRates.minDepositBps,
    },
    updatedAt: json.updatedAt,
    updatedBy: json.updatedBy,
  };
}
