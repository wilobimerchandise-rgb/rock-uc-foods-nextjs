/**
 * ROCK UC FOODS - Menu Repository & State Store
 * (Playbook v2 Section 7: The Editable Menu)
 * Manages in-memory state with versioning, optimistic locking, and audit recording.
 */

import { MenuCategory, MenuItem, MenuItemVersionRecord } from '../types/menu';
import { recordAuditEvent } from '../lib/auth';

// Initial Golden Fixture Categories (Playbook Section 14)
export const initialCategories: MenuCategory[] = [
  { id: 'cat-rice', name: 'Test Rice', sortOrder: 10, isVisible: true, version: 1 },
  { id: 'cat-soups', name: 'Test Soups', sortOrder: 20, isVisible: true, version: 1 },
  { id: 'cat-sides', name: 'Test Sides', sortOrder: 30, isVisible: true, version: 1 },
  { id: 'cat-empty', name: 'Special Dishes (Unreleased)', sortOrder: 40, isVisible: true, version: 1 },
];

// Initial Golden Fixture Items (T-001, T-002, T-003, T-001-X)
export const initialMenuItems: MenuItem[] = [
  {
    id: 'item-t001',
    sku: 'T-001',
    categoryId: 'cat-rice',
    name: 'Test Jollof Rice',
    description: 'Signature party-style smoky jollof rice cooked to perfection.',
    priceKobo: 350000n, // ₦3,500.00
    portionLabel: 'Serves 1',
    allergens: [],
    status: 'published',
    isAvailable: true,
    isFeatured: true,
    isFreeItem: false,
    sortOrder: 10,
    version: 1,
    updatedAt: new Date().toISOString(),
    optionGroups: [
      {
        id: 'grp-t001-opt',
        itemId: 'item-t001',
        name: 'Protein',
        minSelect: 0,
        maxSelect: 1,
        options: [
          {
            id: 'opt-t001-x',
            groupId: 'grp-t001-opt',
            name: 'Extra protein on T-001',
            priceDeltaKobo: 100000n, // +₦1,000.00
            isAvailable: true,
            sortOrder: 1,
          },
        ],
      },
    ],
  },
  {
    id: 'item-t002',
    sku: 'T-002',
    categoryId: 'cat-soups',
    name: 'Test Peppersoup',
    description: 'Fresh catfish and aromatic herbs infused in spicy traditional broth.',
    priceKobo: 420000n, // ₦4,200.00
    portionLabel: 'Serves 1',
    allergens: ['fish'],
    status: 'published',
    isAvailable: true,
    isFeatured: false,
    isFreeItem: false,
    sortOrder: 20,
    version: 1,
    updatedAt: new Date().toISOString(),
    optionGroups: [],
  },
  {
    id: 'item-t003',
    sku: 'T-003',
    categoryId: 'cat-sides',
    name: 'Test Plantain Side',
    description: 'Sweet golden fried dodo slices.',
    priceKobo: 120000n, // ₦1,200.00
    portionLabel: 'Serves 1',
    allergens: [],
    status: 'published',
    isAvailable: true,
    isFeatured: false,
    isFreeItem: false,
    sortOrder: 30,
    version: 1,
    updatedAt: new Date().toISOString(),
    optionGroups: [],
  },
];

function cloneMenuItems(items: MenuItem[]): MenuItem[] {
  return items.map((item) => ({
    ...item,
    allergens: [...item.allergens],
    optionGroups: item.optionGroups?.map((g) => ({
      ...g,
      options: g.options.map((o) => ({ ...o })),
    })),
  }));
}

class MenuRepository {
  private categories: MenuCategory[] = [...initialCategories];
  private items: MenuItem[] = cloneMenuItems(initialMenuItems);
  private versions: MenuItemVersionRecord[] = [];
  private versionIdCounter = 1;

  public getCategories(includeHidden: boolean = false): MenuCategory[] {
    const list = includeHidden ? this.categories : this.categories.filter((c) => c.isVisible);
    return list.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getItems(includeDrafts: boolean = false): MenuItem[] {
    const list = includeDrafts
      ? this.items.filter((i) => i.status !== 'archived')
      : this.items.filter((i) => i.status === 'published');
    return list.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getAllItemsForAdmin(): MenuItem[] {
    return this.items.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  }

  public getItemById(id: string): MenuItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  public getItemBySku(sku: string): MenuItem | undefined {
    return this.items.find((i) => i.sku.toLowerCase() === sku.toLowerCase());
  }

  public getVersionsForItem(itemId: string): MenuItemVersionRecord[] {
    return this.versions.filter((v) => v.itemId === itemId).sort((a, b) => b.version - a.version);
  }

  /**
   * Calculates next midnight in Africa/Lagos timezone for "Sold Out Today" toggle.
   */
  public getNextLagosMidnightISO(): string {
    const now = new Date();
    // Africa/Lagos is UTC+1 (no daylight saving)
    const lagosOffsetMs = 60 * 60 * 1000;
    const lagosNow = new Date(now.getTime() + lagosOffsetMs);

    const nextMidnightLagos = new Date(
      Date.UTC(
        lagosNow.getUTCFullYear(),
        lagosNow.getUTCMonth(),
        lagosNow.getUTCDate() + 1,
        0, 0, 0, 0
      )
    );
    // Convert back to UTC
    const nextMidnightUtc = new Date(nextMidnightLagos.getTime() - lagosOffsetMs);
    return nextMidnightUtc.toISOString();
  }

  /**
   * Checks if an item is sold out for today.
   */
  public isItemSoldOutToday(item: MenuItem): boolean {
    if (!item.soldOutUntil) return false;
    return new Date(item.soldOutUntil).getTime() > Date.now();
  }

  /**
   * Toggle Availability (Staff & Owner permitted).
   */
  public toggleAvailability(itemId: string, actorId: string, actorRole: string): MenuItem {
    const item = this.getItemById(itemId);
    if (!item) throw new Error('Menu item not found.');

    const before = { isAvailable: item.isAvailable };
    item.isAvailable = !item.isAvailable;
    item.updatedAt = new Date().toISOString();

    recordAuditEvent({
      actorId,
      actorRole,
      action: item.isAvailable ? 'MARK_AVAILABLE' : 'MARK_UNAVAILABLE',
      entity: 'menu_items',
      entityId: item.id,
      before,
      after: { isAvailable: item.isAvailable },
    });

    return item;
  }

  /**
   * Toggle "Sold Out Today" (Staff & Owner permitted).
   * Sets auto-expiry to next 00:00 Africa/Lagos.
   */
  public toggleSoldOutToday(itemId: string, actorId: string, actorRole: string): MenuItem {
    const item = this.getItemById(itemId);
    if (!item) throw new Error('Menu item not found.');

    const wasSoldOut = this.isItemSoldOutToday(item);
    const before = { soldOutUntil: item.soldOutUntil };

    if (wasSoldOut) {
      item.soldOutUntil = undefined;
    } else {
      item.soldOutUntil = this.getNextLagosMidnightISO();
    }
    item.updatedAt = new Date().toISOString();

    recordAuditEvent({
      actorId,
      actorRole,
      action: wasSoldOut ? 'CLEAR_SOLD_OUT_TODAY' : 'SET_SOLD_OUT_TODAY',
      entity: 'menu_items',
      entityId: item.id,
      before,
      after: { soldOutUntil: item.soldOutUntil },
    });

    return item;
  }

  /**
   * Saves or Updates a menu item (Owner only).
   * Enforces optimistic concurrency locking and price safety checks.
   */
  public saveItem(itemInput: Partial<MenuItem> & { id?: string; name: string; categoryId: string; priceKobo: bigint }, actorId: string): MenuItem {
    const isNew = !itemInput.id;
    const category = this.categories.find((c) => c.id === itemInput.categoryId);
    if (!category) {
      throw new Error('Invalid category: Category does not exist.');
    }

    // Name check: 1 to 80 chars
    const trimmedName = itemInput.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 80) {
      throw new Error('Item name must be between 1 and 80 characters.');
    }

    // Duplicate check in category: unique index menu_items (category_id, lower(name))
    const existingName = this.items.find(
      (i) => i.categoryId === itemInput.categoryId && i.name.toLowerCase() === trimmedName.toLowerCase() && i.id !== itemInput.id
    );
    if (existingName) {
      throw new Error(`Duplicate dish name: "${trimmedName}" already exists in category "${category.name}".`);
    }

    // Price safety check: published item cannot have price 0 unless isFreeItem === true
    const status = itemInput.status || 'draft';
    const isFree = itemInput.isFreeItem ?? false;
    if (status === 'published' && itemInput.priceKobo === 0n && !isFree) {
      throw new Error('Price safety violation: Published items cannot have price ₦0.00 unless explicitly flagged as a free item.');
    }

    if (itemInput.priceKobo < 0n) {
      throw new Error('Price cannot be negative.');
    }

    let savedItem: MenuItem;

    if (isNew) {
      savedItem = {
        id: `item-${Date.now()}`,
        sku: itemInput.sku || `SKU-${Date.now().toString().slice(-4)}`,
        categoryId: itemInput.categoryId,
        name: trimmedName,
        description: itemInput.description || '',
        priceKobo: itemInput.priceKobo,
        portionLabel: itemInput.portionLabel || 'Serves 1',
        allergens: itemInput.allergens || [],
        imagePath: itemInput.imagePath,
        imageAlt: itemInput.imageAlt,
        status,
        isAvailable: itemInput.isAvailable ?? true,
        isFeatured: itemInput.isFeatured ?? false,
        isFreeItem: isFree,
        sortOrder: itemInput.sortOrder ?? (this.items.length + 1) * 10,
        version: 1,
        updatedBy: actorId,
        updatedAt: new Date().toISOString(),
        optionGroups: itemInput.optionGroups || [],
      };
      this.items.push(savedItem);
    } else {
      const existing = this.getItemById(itemInput.id!);
      if (!existing) {
        throw new Error('Menu item not found.');
      }

      // Optimistic concurrency locking check
      if (itemInput.version !== undefined && itemInput.version !== existing.version) {
        throw new Error('Someone else changed this item, reload.');
      }

      // Save previous version snapshot before mutating
      this.versions.push({
        id: this.versionIdCounter++,
        itemId: existing.id,
        version: existing.version,
        snapshot: {
          id: existing.id,
          sku: existing.sku,
          categoryId: existing.categoryId,
          name: existing.name,
          description: existing.description,
          priceKobo: existing.priceKobo,
          portionLabel: existing.portionLabel,
          allergens: [...existing.allergens],
          imagePath: existing.imagePath,
          imageAlt: existing.imageAlt,
          status: existing.status,
          isAvailable: existing.isAvailable,
          soldOutUntil: existing.soldOutUntil,
          isFeatured: existing.isFeatured,
          isFreeItem: existing.isFreeItem,
          sortOrder: existing.sortOrder,
          version: existing.version,
          updatedBy: existing.updatedBy,
          updatedAt: existing.updatedAt,
        },
        changedBy: actorId,
        changedAt: new Date().toISOString(),
      });

      const before = { priceKobo: existing.priceKobo.toString(), name: existing.name, status: existing.status };

      existing.name = trimmedName;
      existing.categoryId = itemInput.categoryId;
      existing.description = itemInput.description ?? existing.description;
      existing.priceKobo = itemInput.priceKobo;
      existing.portionLabel = itemInput.portionLabel ?? existing.portionLabel;
      existing.allergens = itemInput.allergens ?? existing.allergens;
      existing.status = status;
      existing.isFeatured = itemInput.isFeatured ?? existing.isFeatured;
      existing.isFreeItem = isFree;
      if (itemInput.optionGroups) existing.optionGroups = itemInput.optionGroups;
      existing.version += 1;
      existing.updatedBy = actorId;
      existing.updatedAt = new Date().toISOString();

      recordAuditEvent({
        actorId,
        actorRole: 'owner',
        action: 'UPDATE_MENU_ITEM',
        entity: 'menu_items',
        entityId: existing.id,
        before,
        after: { priceKobo: existing.priceKobo.toString(), name: existing.name, version: existing.version },
      });

      savedItem = existing;
    }

    return savedItem;
  }

  /**
   * One-Tap Version Restore.
   */
  public restoreVersion(itemId: string, versionNumber: number, actorId: string): MenuItem {
    const item = this.getItemById(itemId);
    if (!item) throw new Error('Menu item not found.');

    const targetVersion = this.versions.find((v) => v.itemId === itemId && v.version === versionNumber);
    if (!targetVersion) {
      throw new Error(`Version ${versionNumber} not found for this item.`);
    }

    const snap = targetVersion.snapshot;
    item.name = snap.name;
    item.categoryId = snap.categoryId;
    item.description = snap.description;
    item.priceKobo = snap.priceKobo;
    item.portionLabel = snap.portionLabel;
    item.allergens = [...snap.allergens];
    item.status = snap.status;
    item.isFeatured = snap.isFeatured;
    item.version += 1;
    item.updatedBy = actorId;
    item.updatedAt = new Date().toISOString();

    recordAuditEvent({
      actorId,
      actorRole: 'owner',
      action: `RESTORE_MENU_VERSION_${versionNumber}`,
      entity: 'menu_items',
      entityId: item.id,
      after: { restoredVersion: versionNumber, newVersion: item.version },
    });

    return item;
  }

  /**
   * Archive Menu Item (Soft Delete).
   * Items are never hard-deleted once created.
   */
  public archiveItem(itemId: string, actorId: string): MenuItem {
    const item = this.getItemById(itemId);
    if (!item) throw new Error('Menu item not found.');

    item.status = 'archived';
    item.isAvailable = false;
    item.updatedBy = actorId;
    item.updatedAt = new Date().toISOString();

    recordAuditEvent({
      actorId,
      actorRole: 'owner',
      action: 'ARCHIVE_MENU_ITEM',
      entity: 'menu_items',
      entityId: item.id,
    });

    return item;
  }

  /**
   * Up/Down Reorder with single-tap buttons for phones.
   */
  public reorderItem(itemId: string, direction: 'up' | 'down'): MenuItem[] {
    const item = this.getItemById(itemId);
    if (!item) return this.items;

    const categoryItems = this.items
      .filter((i) => i.categoryId === item.categoryId && i.status !== 'archived')
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = categoryItems.findIndex((i) => i.id === itemId);
    if (idx === -1) return this.items;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categoryItems.length) return this.items;

    const currentOrder = item.sortOrder;
    item.sortOrder = categoryItems[swapIdx].sortOrder;
    categoryItems[swapIdx].sortOrder = currentOrder;

    return this.items;
  }
}

export const menuRepository = new MenuRepository();
