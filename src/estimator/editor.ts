/**
 * ROCK UC FOODS - Catering Estimator Owner Editor & Validation
 * Playbook v4 Section 20
 * 
 * Enforces optimistic concurrency control and administrative validation.
 */

import { EstimatorConfig, EstimatorTier, EstimatorAddOn, EstimatorServiceRates } from './types';
import { MAX_KOBO } from '../lib/money';
import { getEstimatorConfig, setEstimatorConfig } from './config';

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateEstimatorConfig(
  tiers: EstimatorTier[],
  addOns: EstimatorAddOn[],
  serviceRates: EstimatorServiceRates
): void {
  // 1. Validate Tiers
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new ValidationError('At least one catering tier must be configured.');
  }

  for (const tier of tiers) {
    if (!tier.name || tier.name.trim() === '') {
      throw new ValidationError('Tier name cannot be empty.');
    }
    if (tier.pricePerGuestKobo <= 0n) {
      throw new ValidationError(`Price per guest for '${tier.name}' must be positive.`);
    }
    if (tier.pricePerGuestKobo > MAX_KOBO) {
      throw new ValidationError(`Price per guest for '${tier.name}' exceeds maximum limit.`);
    }
    if (tier.minGuests < 1 || tier.maxGuests < tier.minGuests) {
      throw new ValidationError(
        `Invalid guest range for '${tier.name}': min (${tier.minGuests}) must be >= 1 and <= max (${tier.maxGuests}).`
      );
    }
  }

  // 2. Validate Add-ons
  if (!Array.isArray(addOns)) {
    throw new ValidationError('Add-ons must be an array.');
  }

  for (const addOn of addOns) {
    if (!addOn.name || addOn.name.trim() === '') {
      throw new ValidationError('Add-on name cannot be empty.');
    }
    if (addOn.unitPriceKobo < 0n) {
      throw new ValidationError(`Unit price for '${addOn.name}' cannot be negative.`);
    }
    if (addOn.pricingModel !== 'per_guest' && addOn.pricingModel !== 'flat') {
      throw new ValidationError(`Invalid pricing model for '${addOn.name}': must be 'per_guest' or 'flat'.`);
    }
  }

  // 3. Validate Service Rates
  if (
    serviceRates.serviceChargeBps < 0 ||
    serviceRates.serviceChargeBps > 3000
  ) {
    throw new ValidationError('Service charge must be between 0% and 30% (0 - 3000 bps).');
  }

  if (serviceRates.baseLogisticsKobo < 0n) {
    throw new ValidationError('Base logistics fee cannot be negative.');
  }

  if (
    serviceRates.minDepositBps < 5000 ||
    serviceRates.minDepositBps > 10000
  ) {
    throw new ValidationError('Minimum deposit must be between 50% and 100% (5000 - 10000 bps).');
  }
}

export function updateEstimatorConfig(
  expectedVersion: number,
  updatedBy: string,
  newTiers: EstimatorTier[],
  newAddOns: EstimatorAddOn[],
  newServiceRates: EstimatorServiceRates
): EstimatorConfig {
  const current = getEstimatorConfig();

  // Optimistic Concurrency Check
  if (current.version !== expectedVersion) {
    throw new ConcurrencyError(
      `Conflict: Config version mismatch. Expected version ${expectedVersion}, but current database version is ${current.version}. Please refresh.`
    );
  }

  // Validate fields
  validateEstimatorConfig(newTiers, newAddOns, newServiceRates);

  const updatedConfig: EstimatorConfig = {
    id: current.id,
    version: current.version + 1,
    tiers: newTiers,
    addOns: newAddOns,
    serviceRates: newServiceRates,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedBy || 'owner@rockucfoods.com',
  };

  setEstimatorConfig(updatedConfig);
  return updatedConfig;
}
