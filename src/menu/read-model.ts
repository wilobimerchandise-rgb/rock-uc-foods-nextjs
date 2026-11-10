/**
 * ROCK UC FOODS - Server-Authoritative Menu Read Model
 * Playbook v9 Section 26.1 Item 2 (Phase 2B)
 *
 * Rules:
 * - Single server function returns, for each active item, its options and tiers
 *   already formatted with formatKobo and sorted.
 * - Prices are never calculated in the browser.
 * - Inactive options and tiers are not returned.
 * - An item with a group that has no active options hides the group.
 * - An item left with no price at all is not shown and is logged.
 * - Option of 250000 kobo shows '+₦2,500.00'; 0 shows 'included'.
 * - Tier of 350000 kobo shows '₦3,500.00'.
 * - Strictly never emits the letters 'NGN'.
 */

import { MenuItem, MenuOptionGroup, MenuOption, SizeTier } from '../types/menu';
import { formatKobo } from '../lib/money';
import { menuRepository } from './data';

export interface FormattedMenuOption {
  id: string;
  groupId: string;
  label: string;
  extraKobo: bigint;
  formattedExtra: string; // "+₦2,500.00" or "included"
  active: boolean;
  sortOrder: number;
}

export interface FormattedOptionGroup {
  id: string;
  itemId: string;
  title: string;
  minChoices: number;
  maxChoices: number;
  sortOrder: number;
  options: FormattedMenuOption[];
}

export interface FormattedSizeTier {
  id: string;
  itemId: string;
  label: string;
  priceKobo: bigint;
  formattedPrice: string; // "₦3,500.00"
  active: boolean;
  sortOrder: number;
}

export interface FormattedMenuItem {
  id: string;
  sku: string;
  categoryId: string;
  name: string;
  description?: string;
  basePriceKobo: bigint;
  formattedBasePrice?: string;
  hasBasePrice: boolean;
  portionLabel?: string;
  allergens: string[];
  imagePath?: string;
  photoUrl?: string;
  status: 'draft' | 'published' | 'archived';
  isAvailable: boolean;
  showHeat: boolean;
  availabilityNote?: string;
  sortOrder: number;
  optionGroups: FormattedOptionGroup[];
  sizeTiers: FormattedSizeTier[];
}

export function formatOptionExtra(extraKobo: bigint): string {
  if (extraKobo <= 0n) {
    return 'included';
  }
  return `+${formatKobo(extraKobo)}`;
}

export function formatTierPrice(priceKobo: bigint): string {
  return formatKobo(priceKobo);
}

/**
 * Transforms raw menu items into server-rendered formatted items.
 * Guaranteed: No prices computed on client; inactive options/tiers stripped.
 */
export function formatMenuItemForDisplay(item: MenuItem): FormattedMenuItem | null {
  // Must be published and available
  if (item.status !== 'published' || !item.isAvailable) {
    return null;
  }

  // Active size tiers sorted by sortOrder
  const rawTiers: SizeTier[] = item.sizeTiers || [];
  const activeTiers = rawTiers
    .filter((t) => t.active && t.priceKobo > 0n)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      id: t.id,
      itemId: t.itemId,
      label: t.label,
      priceKobo: t.priceKobo,
      formattedPrice: formatTierPrice(t.priceKobo),
      active: true,
      sortOrder: t.sortOrder,
    }));

  const hasTiers = activeTiers.length > 0;
  const hasBasePrice = !hasTiers && item.priceKobo > 0n;

  // Rule: An item left with no price at all (no base price and no tiers) is not shown and logged
  if (!hasBasePrice && !hasTiers) {
    console.warn(`[Menu Read Model] Item ${item.id} (${item.name}) has no valid base price or size tiers. Suppressing.`);
    return null;
  }

  // Active option groups & options
  const rawGroups: MenuOptionGroup[] = item.optionGroups || [];
  const formattedGroups: FormattedOptionGroup[] = [];

  for (const group of rawGroups) {
    const activeOptions = (group.options || [])
      .filter((opt) => opt.isAvailable !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((opt) => {
        const extra = opt.priceDeltaKobo ?? 0n;
        return {
          id: opt.id,
          groupId: group.id,
          label: opt.name,
          extraKobo: extra,
          formattedExtra: formatOptionExtra(extra),
          active: true,
          sortOrder: opt.sortOrder,
        };
      });

    // An item with a group that has no active options hides the group
    if (activeOptions.length > 0) {
      formattedGroups.push({
        id: group.id,
        itemId: item.id,
        title: group.name,
        minChoices: group.minSelect,
        maxChoices: group.maxSelect,
        sortOrder: 0,
        options: activeOptions,
      });
    }
  }

  return {
    id: item.id,
    sku: item.sku,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    basePriceKobo: hasBasePrice ? item.priceKobo : 0n,
    formattedBasePrice: hasBasePrice ? formatKobo(item.priceKobo) : undefined,
    hasBasePrice,
    portionLabel: item.portionLabel,
    allergens: item.allergens || [],
    imagePath: item.imagePath,
    photoUrl: item.photoUrl,
    status: item.status,
    isAvailable: item.isAvailable,
    showHeat: Boolean(item.showHeat),
    availabilityNote: item.availabilityNote || undefined,
    sortOrder: item.sortOrder,
    optionGroups: formattedGroups,
    sizeTiers: activeTiers,
  };
}

/**
 * Returns all active formatted menu items ready for rendering.
 */
export function getActiveMenuWithDetails(items?: MenuItem[]): FormattedMenuItem[] {
  const sourceItems = items || menuRepository.getItems();
  const result: FormattedMenuItem[] = [];

  for (const item of sourceItems) {
    const formatted = formatMenuItemForDisplay(item);
    if (formatted) {
      result.push(formatted);
    }
  }

  return result.sort((a, b) => a.sortOrder - b.sortOrder);
}
