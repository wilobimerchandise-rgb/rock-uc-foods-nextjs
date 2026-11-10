/**
 * ROCK UC FOODS - Menu Type Definitions
 * (Playbook v2 Section 7 & 13)
 * Monetary values are strictly BigInt integer kobo.
 */

export type MenuItemStatus = 'draft' | 'published' | 'archived';

export interface MenuOption {
  id: string;
  groupId: string;
  name: string;
  priceDeltaKobo: bigint;
  isAvailable: boolean;
  sortOrder: number;
}

export interface MenuOptionGroup {
  id: string;
  itemId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: MenuOption[];
}

export interface SizeTier {
  id: string;
  itemId: string;
  label: string; // e.g. S, M, L, Single pack, Family pack, bottle
  priceKobo: bigint;
  active: boolean;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  sku: string;
  categoryId: string;
  name: string;
  description?: string;
  priceKobo: bigint;
  portionLabel?: string;
  allergens: string[];
  imagePath?: string;
  imageAlt?: string;
  status: MenuItemStatus;
  isAvailable: boolean;
  soldOutUntil?: string; // ISO 8601 UTC timestamp or Lagos midnight
  isFeatured: boolean;
  isFreeItem: boolean;
  sortOrder: number;
  version: number;
  updatedBy?: string;
  updatedAt: string;
  showHeat?: boolean;
  availabilityNote?: string;
  photoUrl?: string;
  optionGroups?: MenuOptionGroup[];
  sizeTiers?: SizeTier[];
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  isVisible: boolean;
  version: number;
}

export interface MenuItemVersionRecord {
  id: number;
  itemId: string;
  version: number;
  snapshot: Omit<MenuItem, 'optionGroups'>;
  changedBy: string;
  changedAt: string;
}

export interface OrderablePriceResult {
  itemId: string;
  itemName: string;
  basePriceKobo: bigint;
  tierId?: string;
  tierName?: string;
  optionsTotalKobo: bigint;
  totalUnitKobo: bigint;
  optionSnapshots: Array<{
    id: string;
    name: string;
    priceDeltaKobo: bigint;
  }>;
}
