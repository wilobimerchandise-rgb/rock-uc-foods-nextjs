/**
 * ROCK UC FOODS - Server-Authoritative Pricing Module
 * (Playbook v2 Section 7.E: Price Safety)
 * The ONLY source of prices for orders and invoices.
 * Never trust a client-supplied price or option delta.
 */

import { menuRepository } from './data';
import { OrderablePriceResult } from '../types/menu';

export class OrderablePriceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderablePriceError';
  }
}

/**
 * Returns the exact verified price in BigInt integer kobo for an item and its selected options.
 * Rejects items that are draft, archived, unavailable, or sold-out.
 */
export function getOrderablePrice(
  itemId: string,
  selectedOptionIds: string[] = [],
  selectedTierId?: string
): OrderablePriceResult {
  const item = menuRepository.getItemById(itemId);

  if (!item) {
    throw new OrderablePriceError(`Menu item '${itemId}' does not exist.`);
  }

  if (item.status !== 'published') {
    throw new OrderablePriceError(`Dish '${item.name}' is currently unavailable (Status: ${item.status}).`);
  }

  if (!item.isAvailable) {
    throw new OrderablePriceError(`Dish '${item.name}' is currently marked unavailable.`);
  }

  if (menuRepository.isItemSoldOutToday(item)) {
    throw new OrderablePriceError(`Dish '${item.name}' is sold out for today.`);
  }

  let basePriceKobo = item.priceKobo;
  let resolvedTierId: string | undefined;
  let resolvedTierName: string | undefined;

  // Handle size tiers
  if (item.sizeTiers && item.sizeTiers.length > 0) {
    const activeTiers = item.sizeTiers.filter((t) => t.active);
    if (activeTiers.length === 0) {
      throw new OrderablePriceError(`Dish '${item.name}' currently has no available size tiers.`);
    }

    let matchedTier = selectedTierId
      ? activeTiers.find((t) => t.id === selectedTierId || t.label.toUpperCase() === selectedTierId.trim().toUpperCase())
      : undefined;

    if (!matchedTier && !selectedTierId && activeTiers.length === 1) {
      matchedTier = activeTiers[0];
    }

    if (!matchedTier) {
      throw new OrderablePriceError(
        selectedTierId
          ? `Invalid size tier '${selectedTierId}' for dish '${item.name}'.`
          : `Please select a size tier for dish '${item.name}'.`
      );
    }

    basePriceKobo = matchedTier.priceKobo;
    resolvedTierId = matchedTier.id;
    resolvedTierName = matchedTier.label;
  } else {
    // Price safety check for standard base-price items
    if (item.priceKobo === 0n && !item.isFreeItem) {
      throw new OrderablePriceError(`Price safety violation: Dish '${item.name}' has price ₦0.00.`);
    }
  }

  let optionsTotalKobo = 0n;
  const optionSnapshots: Array<{ id: string; name: string; priceDeltaKobo: bigint }> = [];

  if (item.optionGroups && item.optionGroups.length > 0) {
    // Unique list of selected option IDs
    const uniqueSelectedIds = Array.from(new Set(selectedOptionIds));

    for (const group of item.optionGroups) {
      const selectedInGroup = group.options.filter((opt) => uniqueSelectedIds.includes(opt.id));

      if (selectedInGroup.length < group.minSelect) {
        throw new OrderablePriceError(
          `Minimum ${group.minSelect} option(s) required for '${group.name}' on dish '${item.name}'.`
        );
      }

      if (selectedInGroup.length > group.maxSelect) {
        throw new OrderablePriceError(
          `Maximum ${group.maxSelect} option(s) allowed for '${group.name}' on dish '${item.name}'.`
        );
      }

      for (const opt of selectedInGroup) {
        if (!opt.isAvailable) {
          throw new OrderablePriceError(`Option '${opt.name}' is currently unavailable.`);
        }
        optionsTotalKobo += opt.priceDeltaKobo;
        optionSnapshots.push({
          id: opt.id,
          name: opt.name,
          priceDeltaKobo: opt.priceDeltaKobo,
        });
      }
    }

    // Verify no stray option IDs that belong to no group on this item
    const allValidOptIds = new Set(item.optionGroups.flatMap((g) => g.options.map((o) => o.id)));
    for (const optId of uniqueSelectedIds) {
      if (!allValidOptIds.has(optId)) {
        throw new OrderablePriceError(`Option '${optId}' is not valid for dish '${item.name}'.`);
      }
    }
  }

  const totalUnitKobo = basePriceKobo + optionsTotalKobo;

  return {
    itemId: item.id,
    itemName: item.name,
    basePriceKobo,
    tierId: resolvedTierId,
    tierName: resolvedTierName,
    optionsTotalKobo,
    totalUnitKobo,
    optionSnapshots,
  };
}
