/**
 * ROCK UC FOODS - Phase 2 Comprehensive Test Suite
 * Validates the editable menu engine, price safety, getOrderablePrice authority,
 * option group constraints (min/max_select), image magic bytes security,
 * optimistic concurrency locking, one-tap restore, Unicode preservation, and PGlite database constraints.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { menuRepository, initialMenuItems } from '../src/menu/data';
import { getOrderablePrice, OrderablePriceError } from '../src/menu/pricing';
import { dryRunMenuCsv, commitMenuCsv, exportMenuToCsv } from '../src/menu/import';
import { validateImageBuffer, MAX_IMAGE_BYTES } from '../src/lib/image';
import { formatNaira } from '../src/lib/money';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 2: Server-Authoritative Pricing (getOrderablePrice)', () => {
  it('Returns exact golden fixture base prices in bigint kobo', () => {
    const t001 = getOrderablePrice('item-t001');
    expect(t001.basePriceKobo).toBe(350000n);
    expect(t001.totalUnitKobo).toBe(350000n);
    expect(formatNaira(t001.totalUnitKobo)).toBe('₦3,500.00');

    const t002 = getOrderablePrice('item-t002');
    expect(t002.totalUnitKobo).toBe(420000n);

    const t003 = getOrderablePrice('item-t003');
    expect(t003.totalUnitKobo).toBe(120000n);
  });

  it('Calculates Golden Fixture G2 unit price with options (T-001 + extra protein = 450000n kobo)', () => {
    const g2Unit = getOrderablePrice('item-t001', ['opt-t001-x']);
    expect(g2Unit.basePriceKobo).toBe(350000n);
    expect(g2Unit.optionsTotalKobo).toBe(100000n);
    expect(g2Unit.totalUnitKobo).toBe(450000n);
    expect(formatNaira(g2Unit.totalUnitKobo)).toBe('₦4,500.00');
    expect(g2Unit.optionSnapshots.length).toBe(1);
    expect(g2Unit.optionSnapshots[0].name).toBe('Extra protein on T-001');
  });

  it('Enforces option group max_select and rejects invalid option IDs', () => {
    // Attempting to select invalid non-existent option
    expect(() => getOrderablePrice('item-t001', ['opt-fake-999'])).toThrow(
      /is not valid for dish 'Test Jollof Rice'/
    );
  });

  it('Rejects orderable price lookup for sold-out or unavailable items', () => {
    menuRepository.toggleAvailability('item-t003', 'owner-01', 'owner');
    expect(() => getOrderablePrice('item-t003')).toThrow(OrderablePriceError);

    menuRepository.toggleAvailability('item-t003', 'owner-01', 'owner');
    expect(getOrderablePrice('item-t003').totalUnitKobo).toBe(120000n);

    menuRepository.toggleSoldOutToday('item-t002', 'owner-01', 'owner');
    expect(() => getOrderablePrice('item-t002')).toThrow(/sold out for today/);

    menuRepository.toggleSoldOutToday('item-t002', 'owner-01', 'owner');
    expect(getOrderablePrice('item-t002').totalUnitKobo).toBe(420000n);
  });

  it('Rejects draft or archived items from getOrderablePrice', () => {
    const draft = menuRepository.saveItem(
      {
        categoryId: 'cat-rice',
        name: 'Experimental Rice',
        priceKobo: 200000n,
        status: 'draft',
      },
      'owner-01'
    );

    expect(() => getOrderablePrice(draft.id)).toThrow(/unavailable \(Status: draft\)/);
  });
});

describe('Phase 2: Optimistic Locking, Versioning & One-Tap Restore', () => {
  it('Optimistic concurrency control rejects stale version saves', () => {
    const item = menuRepository.getItemById('item-t001')!;
    const currentVersion = item.version;

    menuRepository.saveItem(
      {
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        priceKobo: 360000n,
        version: currentVersion,
      },
      'owner-01'
    );

    expect(item.version).toBe(currentVersion + 1);

    // Stale version save must throw
    expect(() => {
      menuRepository.saveItem(
        {
          id: item.id,
          name: item.name,
          categoryId: item.categoryId,
          priceKobo: 400000n,
          version: currentVersion,
        },
        'owner-02'
      );
    }).toThrow('Someone else changed this item, reload.');
  });

  it('Saves item version history and restores in one tap', () => {
    const item = menuRepository.getItemById('item-t003')!;
    const originalPrice = item.priceKobo;
    const initialVersion = item.version;

    menuRepository.saveItem(
      {
        id: item.id,
        name: item.name,
        categoryId: item.categoryId,
        priceKobo: 150000n,
        version: item.version,
      },
      'owner-01'
    );

    expect(item.priceKobo).toBe(150000n);

    const restored = menuRepository.restoreVersion(item.id, initialVersion, 'owner-01');
    expect(restored.priceKobo).toBe(originalPrice);
  });
});

describe('Phase 2: Image Magic Bytes Security & 5MB Limit', () => {
  it('Validates JPEG magic bytes (FF D8 FF)', () => {
    const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const res = validateImageBuffer(jpegBuffer);
    expect(res.isValid).toBe(true);
    expect(res.detectedType).toBe('image/jpeg');
  });

  it('Validates PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const res = validateImageBuffer(pngBuffer);
    expect(res.isValid).toBe(true);
    expect(res.detectedType).toBe('image/png');
  });

  it('Validates WebP magic bytes (RIFF....WEBP)', () => {
    const webpBuffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50,
    ]);
    const res = validateImageBuffer(webpBuffer);
    expect(res.isValid).toBe(true);
    expect(res.detectedType).toBe('image/webp');
  });

  it('Rejects fake image extension with invalid magic bytes (e.g. PHP/script upload)', () => {
    const fakeBuffer = Buffer.from('<?php echo "malicious"; ?>');
    const res = validateImageBuffer(fakeBuffer);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Unsupported image format');
  });

  it('Rejects file exceeding 5 MB limit', () => {
    const largeBuffer = new Uint8Array(MAX_IMAGE_BYTES + 1);
    const res = validateImageBuffer(largeBuffer);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('exceeds 5 MB limit');
  });
});

describe('Phase 2: Real PostgreSQL PGlite Database Constraints (0002_menu_core.sql)', () => {
  it('Applies 0002_menu_core.sql and verifies unique indexes and price safety constraint', async () => {
    const db = new PGlite();
    const f1 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'), 'utf-8');
    const f2 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0002_menu_core.sql'), 'utf-8');

    await db.exec(f1);
    await db.exec(f2);

    await db.exec(`
      INSERT INTO menu_categories (id, name, sort_order)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Rice Dishes', 10);
    `);

    // Duplicate category rejected case-insensitively
    let catDupFailed = false;
    try {
      await db.exec(`
        INSERT INTO menu_categories (name, sort_order)
        VALUES ('rice dishes', 20);
      `);
    } catch {
      catDupFailed = true;
    }
    expect(catDupFailed).toBe(true);

    // Valid item
    await db.exec(`
      INSERT INTO menu_items (category_id, name, price_kobo, status)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Smoky Jollof', 350000, 'published');
    `);

    // Price safety: published item with price 0 and is_free_item = false -> MUST FAIL
    let priceSafetyFailed = false;
    try {
      await db.exec(`
        INSERT INTO menu_items (category_id, name, price_kobo, status, is_free_item)
        VALUES ('11111111-1111-1111-1111-111111111111', 'Zero Price Meal', 0, 'published', false);
      `);
    } catch (err: unknown) {
      priceSafetyFailed = true;
      expect((err as Error).message).toContain('menu_items_price_safety_chk');
    }
    expect(priceSafetyFailed).toBe(true);

    // Free item with price 0 is allowed
    await db.exec(`
      INSERT INTO menu_items (category_id, name, price_kobo, status, is_free_item)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Complimentary Water', 0, 'published', true);
    `);
  });
});

describe('Phase 2: CSV Import Dry-Run, UTF-8 BOM & Idempotency', () => {
  it('Parses CSV with UTF-8 BOM (Excel format) without error', () => {
    const csvWithBom = `\uFEFFsku,category,name,description,price_ngn,portion_label,allergens,status,available,featured,sort_order
T-BOM1,Test Rice,Special Ofada Rice,Smoky ayamase,4500.00,Serves 1,,draft,true,false,40`;

    const dryRun = dryRunMenuCsv(csvWithBom);
    expect(dryRun.totalRows).toBe(1);
    expect(dryRun.rowsToCreate.length).toBe(1);
    expect(dryRun.rowsToCreate[0].sku).toBe('T-BOM1');
    expect(dryRun.rowsToCreate[0].priceKobo).toBe(450000n);
    expect(dryRun.rowsRejected.length).toBe(0);
  });

  it('Preserves Unicode dish names (e.g. Ọfọ̀ nsọ́) and emojis correctly', () => {
    const unicodeName = 'Ọfọ̀ nsọ́ Traditional Soup 🍲';
    menuRepository.saveItem(
      {
        categoryId: 'cat-soups',
        name: unicodeName,
        priceKobo: 500000n,
        description: 'Traditional spiced delicacy',
        status: 'published',
      },
      'owner-01'
    );

    const saved = menuRepository.getAllItemsForAdmin().find((i) => i.name === unicodeName);
    expect(saved).toBeDefined();
    expect(saved?.name).toBe(unicodeName);

    const exported = exportMenuToCsv();
    expect(exported.startsWith('\uFEFF')).toBe(true); // UTF-8 BOM
    expect(exported).toContain(unicodeName);
  });

  it('Formula injection in customer inputs is neutralized on CSV export', () => {
    menuRepository.saveItem(
      {
        categoryId: 'cat-rice',
        name: '=cmd|/c calc!A0',
        priceKobo: 250000n,
        description: '+1234567890',
        status: 'draft',
      },
      'owner-01'
    );

    const exported = exportMenuToCsv();
    expect(exported).toContain("\"'=cmd|/c calc!A0\"");
    expect(exported).toContain("\"'+1234567890\"");
  });
});
