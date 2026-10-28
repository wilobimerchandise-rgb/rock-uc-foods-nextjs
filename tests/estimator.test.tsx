/**
 * ROCK UC FOODS - Catering Estimator Unit & Integration Tests (36 Tests)
 * Playbook v4 Section 20
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  INITIAL_ESTIMATOR_CONFIG,
  INITIAL_ESTIMATOR_TIERS,
  INITIAL_ESTIMATOR_ADD_ONS,
  INITIAL_SERVICE_RATES,
  getEstimatorConfig,
  resetEstimatorConfig,
  serializeEstimatorConfig,
  deserializeEstimatorConfig,
} from '../src/estimator/config';
import { computeEstimate } from '../src/estimator/compute';
import {
  updateEstimatorConfig,
  validateEstimatorConfig,
  ConcurrencyError,
  ValidationError,
} from '../src/estimator/editor';
import { formatNaira } from '../src/lib/money';

describe('Playbook Section 20: Catering Estimator Tests', () => {
  beforeEach(() => {
    resetEstimatorConfig();
  });

  describe('1. Golden Calculations (Exact BigInt Hand-Calculated Scenarios)', () => {
    it('Scenario 1: Bronze Feast (30 guests, no add-ons)', () => {
      const config = getEstimatorConfig();
      const res = computeEstimate({ tierId: 'tier-bronze', guestCount: 30 }, config);

      // Food: 30 * ₦12,500.00 = ₦375,000.00 (37,500,000 kobo)
      expect(res.foodSubtotalKobo).toBe(37500000n);
      expect(res.addOnsSubtotalKobo).toBe(0n);
      // Logistics: ₦50,000.00 (5,000,000 kobo)
      expect(res.logisticsKobo).toBe(5000000n);
      // Service Charge: 10% of 37,500,000 = ₦37,500.00 (3,750,000 kobo)
      expect(res.serviceChargeKobo).toBe(3750000n);
      // Grand Total: 37,500,000 + 3,750,000 + 5,000,000 = ₦462,500.00 (46,250,000 kobo)
      expect(res.grandTotalKobo).toBe(46250000n);
      // 70% Deposit = 32,375,000 kobo (₦323,750.00)
      expect(res.depositKobo).toBe(32375000n);
      // 30% Balance = 13,875,000 kobo (₦138,750.00)
      expect(res.balanceKobo).toBe(13875000n);
      // Exact reconciliation check
      expect(res.depositKobo + res.balanceKobo).toBe(res.grandTotalKobo);
    });

    it('Scenario 2: Silver Banquet (100 guests, small chops + butlers)', () => {
      const config = getEstimatorConfig();
      const res = computeEstimate(
        {
          tierId: 'tier-silver',
          guestCount: 100,
          selectedAddOns: [
            { addOnId: 'addon-smallchops', quantity: 1 }, // per_guest (100 * 350,000)
            { addOnId: 'addon-butlers', quantity: 1 },    // flat (15,000,000)
          ],
        },
        config
      );

      // Food: 100 * 1,850,000 = 185,000,000 kobo (₦1,850,000.00)
      expect(res.foodSubtotalKobo).toBe(185000000n);
      // Add-ons: 35,000,000 + 15,000,000 = 50,000,000 kobo (₦500,000.00)
      expect(res.addOnsSubtotalKobo).toBe(50000000n);
      // Service Charge (10% of 235,000,000) = 23,500,000 kobo (₦235,000.00)
      expect(res.serviceChargeKobo).toBe(23500000n);
      // Logistics: 5,000,000 kobo (₦50,000.00)
      expect(res.logisticsKobo).toBe(5000000n);
      // Grand Total: 235,000,000 + 23,500,000 + 5,000,000 = 263,500,000 kobo (₦2,635,000.00)
      expect(res.grandTotalKobo).toBe(263500000n);
      // 70% Deposit: 184,450,000 kobo (₦1,844,500.00)
      expect(res.depositKobo).toBe(184450000n);
      // 30% Balance: 79,050,000 kobo (₦790,500.00)
      expect(res.balanceKobo).toBe(79050000n);
      // Exact reconciliation check
      expect(res.depositKobo + res.balanceKobo).toBe(res.grandTotalKobo);
    });

    it('Scenario 3: Platinum Sovereign (500 guests, all 4 add-ons)', () => {
      const config = getEstimatorConfig();
      const res = computeEstimate(
        {
          tierId: 'tier-platinum',
          guestCount: 500,
          selectedAddOns: [
            { addOnId: 'addon-smallchops', quantity: 1 },
            { addOnId: 'addon-dessert', quantity: 1 },
            { addOnId: 'addon-butlers', quantity: 1 },
            { addOnId: 'addon-tableware', quantity: 1 },
          ],
        },
        config
      );

      // Food: 500 * 3,500,000 = 1,750,000,000 kobo (₦17,500,000.00)
      expect(res.foodSubtotalKobo).toBe(1750000000n);
      // Small Chops: 500 * 350,000 = 175,000,000 kobo
      // Dessert: 500 * 450,000 = 225,000,000 kobo
      // Butlers: 15,000,000 kobo
      // Tableware: 10,000,000 kobo
      // Addons Subtotal = 425,000,000 kobo (₦4,250,000.00)
      expect(res.addOnsSubtotalKobo).toBe(425000000n);
      // Chargeable: 2,175,000,000 kobo
      // Service Charge (10%): 217,500,000 kobo (₦2,175,000.00)
      expect(res.serviceChargeKobo).toBe(217500000n);
      // Logistics: 5,000,000 kobo (₦50,000.00)
      expect(res.logisticsKobo).toBe(5000000n);
      // Grand Total: 2,175,000,000 + 217,500,000 + 5,000,000 = 2,397,500,000 kobo (₦23,975,000.00)
      expect(res.grandTotalKobo).toBe(2397500000n);
      // 70% Deposit: 1,678,250,000 kobo (₦16,782,500.00)
      expect(res.depositKobo).toBe(1678250000n);
      // 30% Balance: 719,250,000 kobo (₦7,192,500.00)
      expect(res.balanceKobo).toBe(719250000n);
      // Exact reconciliation check
      expect(res.depositKobo + res.balanceKobo).toBe(res.grandTotalKobo);
    });

    it('Scenario 4: Gold Royal (200 guests, dessert only)', () => {
      const config = getEstimatorConfig();
      const res = computeEstimate(
        {
          tierId: 'tier-gold',
          guestCount: 200,
          selectedAddOns: [{ addOnId: 'addon-dessert', quantity: 1 }],
        },
        config
      );

      // Food: 200 * 2,600,000 = 520,000,000 kobo (₦5,200,000.00)
      expect(res.foodSubtotalKobo).toBe(520000000n);
      // Dessert: 200 * 450,000 = 90,000,000 kobo (₦900,000.00)
      expect(res.addOnsSubtotalKobo).toBe(90000000n);
      // Service charge (10% of 610,000,000) = 61,000,000 kobo (₦610,000.00)
      expect(res.serviceChargeKobo).toBe(61000000n);
      // Logistics: 5,000,000 kobo
      expect(res.logisticsKobo).toBe(5000000n);
      // Grand Total: 676,000,000 kobo (₦6,760,000.00)
      expect(res.grandTotalKobo).toBe(676000000n);
      expect(res.depositKobo + res.balanceKobo).toBe(res.grandTotalKobo);
    });
  });

  describe('2. Boundary & Capacity Edge Cases', () => {
    const config = getEstimatorConfig();

    it('accepts minimum boundary for Bronze (20 guests)', () => {
      const res = computeEstimate({ tierId: 'tier-bronze', guestCount: 20 }, config);
      expect(res.guestCount).toBe(20);
      expect(res.foodSubtotalKobo).toBe(25000000n);
    });

    it('accepts maximum boundary for Bronze (50 guests)', () => {
      const res = computeEstimate({ tierId: 'tier-bronze', guestCount: 50 }, config);
      expect(res.guestCount).toBe(50);
      expect(res.foodSubtotalKobo).toBe(62500000n);
    });

    it('rejects guest count 1 below minimum (19 guests on Bronze)', () => {
      expect(() =>
        computeEstimate({ tierId: 'tier-bronze', guestCount: 19 }, config)
      ).toThrow(/outside allowed range/);
    });

    it('rejects guest count 1 above maximum (51 guests on Bronze)', () => {
      expect(() =>
        computeEstimate({ tierId: 'tier-bronze', guestCount: 51 }, config)
      ).toThrow(/outside allowed range/);
    });

    it('accepts maximum capacity for Platinum (1,000 guests)', () => {
      const res = computeEstimate({ tierId: 'tier-platinum', guestCount: 1000 }, config);
      expect(res.guestCount).toBe(1000);
      expect(res.foodSubtotalKobo).toBe(3500000000n);
    });

    it('rejects non-integer guest count (e.g. 50.5)', () => {
      expect(() =>
        computeEstimate({ tierId: 'tier-bronze', guestCount: 50.5 }, config)
      ).toThrow(/must be a positive integer/);
    });

    it('rejects zero or negative guest count', () => {
      expect(() =>
        computeEstimate({ tierId: 'tier-bronze', guestCount: 0 }, config)
      ).toThrow(/must be a positive integer/);
      expect(() =>
        computeEstimate({ tierId: 'tier-bronze', guestCount: -10 }, config)
      ).toThrow(/must be a positive integer/);
    });

    it('rejects unknown tierId', () => {
      expect(() =>
        computeEstimate({ tierId: 'tier-diamond-nonexistent', guestCount: 50 }, config)
      ).toThrow(/Invalid tier selected/);
    });

    it('rejects unknown addOnId', () => {
      expect(() =>
        computeEstimate(
          {
            tierId: 'tier-bronze',
            guestCount: 30,
            selectedAddOns: [{ addOnId: 'addon-caviar-nonexistent', quantity: 1 }],
          },
          config
        )
      ).toThrow(/Invalid add-on selected/);
    });

    it('ignores add-ons with quantity <= 0 without error', () => {
      const res = computeEstimate(
        {
          tierId: 'tier-bronze',
          guestCount: 30,
          selectedAddOns: [{ addOnId: 'addon-smallchops', quantity: 0 }],
        },
        config
      );
      expect(res.addOns.length).toBe(0);
      expect(res.addOnsSubtotalKobo).toBe(0n);
    });

    it('multiplies flat rate add-ons by quantity', () => {
      const res = computeEstimate(
        {
          tierId: 'tier-bronze',
          guestCount: 30,
          selectedAddOns: [{ addOnId: 'addon-butlers', quantity: 2 }], // 2 teams = 30,000,000 kobo
        },
        config
      );
      expect(res.addOnsSubtotalKobo).toBe(30000000n);
    });

    it('enforces price ceiling (MAX_KOBO ₦100,000,000.00)', () => {
      const hugeConfig = {
        ...config,
        tiers: [
          {
            ...config.tiers[3],
            pricePerGuestKobo: 150000000n, // ₦1,500,000 per guest
          },
        ],
      };

      expect(() =>
        computeEstimate({ tierId: 'tier-platinum', guestCount: 800 }, hugeConfig)
      ).toThrow(/exceeds maximum allowed limit of ₦100,000,000.00/);
    });
  });

  describe('3. Deposit & Balance Reconciliation Identity', () => {
    it('always satisfies depositKobo + balanceKobo === grandTotalKobo across random guest counts', () => {
      const config = getEstimatorConfig();
      const guestCounts = [20, 21, 33, 49, 50, 75, 123, 149, 150, 201, 299, 300, 456, 888, 1000];

      for (const gc of guestCounts) {
        const matchingTier = config.tiers.find((t) => gc >= t.minGuests && gc <= t.maxGuests)!;
        const res = computeEstimate({ tierId: matchingTier.id, guestCount: gc }, config);
        expect(res.depositKobo + res.balanceKobo).toBe(res.grandTotalKobo);
      }
    });

    it('applies standard 70% deposit calculation', () => {
      const config = getEstimatorConfig();
      const res = computeEstimate({ tierId: 'tier-silver', guestCount: 60 }, config);
      const expectedDeposit = (res.grandTotalKobo * 7000n + 5000n) / 10000n;
      expect(res.depositKobo).toBe(expectedDeposit);
    });
  });

  describe('4. Optimistic Concurrency & Owner Editor', () => {
    it('successfully increments version from 1 to 2 on valid update', () => {
      const updated = updateEstimatorConfig(
        1,
        'owner@rockucfoods.com',
        INITIAL_ESTIMATOR_TIERS,
        INITIAL_ESTIMATOR_ADD_ONS,
        INITIAL_SERVICE_RATES
      );
      expect(updated.version).toBe(2);
      expect(getEstimatorConfig().version).toBe(2);
    });

    it('throws ConcurrencyError on stale version update (expected 1, got 2)', () => {
      // First update increments to 2
      updateEstimatorConfig(
        1,
        'owner@rockucfoods.com',
        INITIAL_ESTIMATOR_TIERS,
        INITIAL_ESTIMATOR_ADD_ONS,
        INITIAL_SERVICE_RATES
      );

      // Attempting to update with stale version 1
      expect(() =>
        updateEstimatorConfig(
          1,
          'second-owner@rockucfoods.com',
          INITIAL_ESTIMATOR_TIERS,
          INITIAL_ESTIMATOR_ADD_ONS,
          INITIAL_SERVICE_RATES
        )
      ).toThrow(ConcurrencyError);
    });

    it('rejects empty tiers array with ValidationError', () => {
      expect(() =>
        validateEstimatorConfig([], INITIAL_ESTIMATOR_ADD_ONS, INITIAL_SERVICE_RATES)
      ).toThrow(/At least one catering tier must be configured/);
    });

    it('rejects zero or negative tier price with ValidationError', () => {
      const invalidTiers = [
        {
          ...INITIAL_ESTIMATOR_TIERS[0],
          pricePerGuestKobo: 0n,
        },
      ];
      expect(() =>
        validateEstimatorConfig(invalidTiers, INITIAL_ESTIMATOR_ADD_ONS, INITIAL_SERVICE_RATES)
      ).toThrow(/must be positive/);
    });

    it('rejects inverted guest range (minGuests > maxGuests) with ValidationError', () => {
      const invalidTiers = [
        {
          ...INITIAL_ESTIMATOR_TIERS[0],
          minGuests: 100,
          maxGuests: 50,
        },
      ];
      expect(() =>
        validateEstimatorConfig(invalidTiers, INITIAL_ESTIMATOR_ADD_ONS, INITIAL_SERVICE_RATES)
      ).toThrow(/Invalid guest range/);
    });

    it('rejects negative add-on price with ValidationError', () => {
      const invalidAddOns = [
        {
          ...INITIAL_ESTIMATOR_ADD_ONS[0],
          unitPriceKobo: -500n,
        },
      ];
      expect(() =>
        validateEstimatorConfig(INITIAL_ESTIMATOR_TIERS, invalidAddOns, INITIAL_SERVICE_RATES)
      ).toThrow(/cannot be negative/);
    });

    it('rejects service charge greater than 30% (3,000 bps) with ValidationError', () => {
      const invalidRates = {
        ...INITIAL_SERVICE_RATES,
        serviceChargeBps: 3500, // 35%
      };
      expect(() =>
        validateEstimatorConfig(INITIAL_ESTIMATOR_TIERS, INITIAL_ESTIMATOR_ADD_ONS, invalidRates)
      ).toThrow(/Service charge must be between 0% and 30%/);
    });

    it('rejects minimum deposit below 50% (5,000 bps) with ValidationError', () => {
      const invalidRates = {
        ...INITIAL_SERVICE_RATES,
        minDepositBps: 4000, // 40%
      };
      expect(() =>
        validateEstimatorConfig(INITIAL_ESTIMATOR_TIERS, INITIAL_ESTIMATOR_ADD_ONS, invalidRates)
      ).toThrow(/Minimum deposit must be between 50% and 100%/);
    });

    it('rejects negative logistics fee with ValidationError', () => {
      const invalidRates = {
        ...INITIAL_SERVICE_RATES,
        baseLogisticsKobo: -100n,
      };
      expect(() =>
        validateEstimatorConfig(INITIAL_ESTIMATOR_TIERS, INITIAL_ESTIMATOR_ADD_ONS, invalidRates)
      ).toThrow(/Base logistics fee cannot be negative/);
    });
  });

  describe('5. Serialization & Roundtrip Integrity', () => {
    it('serializes BigInt kobo to strings without precision loss', () => {
      const config = getEstimatorConfig();
      const json = serializeEstimatorConfig(config);

      expect(typeof json.tiers[0].pricePerGuestKobo).toBe('string');
      expect(json.tiers[0].pricePerGuestKobo).toBe('1250000');
      expect(typeof json.serviceRates.baseLogisticsKobo).toBe('string');
      expect(json.serviceRates.baseLogisticsKobo).toBe('5000000');
    });

    it('deserializes JSON back to original BigInt values perfectly', () => {
      const config = getEstimatorConfig();
      const json = serializeEstimatorConfig(config);
      const restored = deserializeEstimatorConfig(json);

      expect(restored.tiers[0].pricePerGuestKobo).toBe(1250000n);
      expect(restored.serviceRates.baseLogisticsKobo).toBe(5000000n);
      expect(restored.tiers.length).toBe(config.tiers.length);
      expect(restored.addOns.length).toBe(config.addOns.length);
    });

    it('formats Naira currency with ₦ symbol and zero NGN occurrences', () => {
      const formatted = formatNaira(263500000n);
      expect(formatted).toBe('₦2,635,000.00');
      expect(formatted).not.toContain('NGN');
    });
  });
});
