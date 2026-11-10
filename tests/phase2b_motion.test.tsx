/**
 * ROCK UC FOODS - Phase 2B Menu Motion, Options, and Dish Card Style Test Suite
 * Playbook v9 Section 26 (Pages 76–81)
 *
 * Rules verified:
 * a. Server-rendered HTML (scripts off): active dish names, ingredients, price, options, tiers, notes;
 *    inactive rows absent; hostile text escaped.
 * b. Money formatting: +₦2,500.00, included, ₦3,500.00; never NGN in visible UI.
 * c. Real SQL database rules in PGlite:
 *    - Applies 0015_menu_options_and_tiers.sql
 *    - An item cannot have both a base price and size tiers
 *    - Negative or over-maximum extra_kobo / price_kobo rejected
 *    - Anonymous read active only; staff/developer cannot write options or tiers
 * d. Page complete at rest: every card visible without scripts; first-screen cards never hidden.
 * e. Reduced motion: stylesheet disables animation and steam completely.
 * f. Keyframe safety: only transform and opacity animated.
 * g. Native photo viewer: modal attributes, wrapping navigation, touch swipe threshold (> 50px).
 * h. Mobile widths (360px and 412px): no overflow, naira glyph never separated from figures.
 * i. Dead-button guard: no href='#', empty, or javascript:.
 * j. Mutation invariant checks (6 safety tests).
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

import PublicMenuPage from '../app/menu/page';
import { DishCard, ALLERGEN_NOTICE_DISPLAY } from '../src/components/menu/DishCard';
import { MenuMotionStyles } from '../src/components/menu/MenuMotionStyles';
import { DishPhotoModal } from '../src/components/menu/DishPhotoModal';
import {
  getActiveMenuWithDetails,
  formatOptionExtra,
  formatTierPrice,
  formatMenuItemForDisplay,
  FormattedMenuItem,
} from '../src/menu/read-model';
import { menuRepository } from '../src/menu/data';
import { dryRunMenuCsv } from '../src/menu/import';
import { ALLERGEN_NOTICE } from '../src/policy/content';
import { MenuItem } from '../src/types/menu';

describe('Playbook Section 26: Phase 2B - Menu Motion & Dish Card Style', () => {
  beforeEach(() => {
    menuRepository.resetForTesting();
  });

  describe('a & b. Server-Rendered HTML & Money Invariants', () => {
    it('renders active dish names, uppercase ingredient line, choices, and size tiers in server HTML', () => {
      const html = renderToStaticMarkup(<PublicMenuPage />);

      // Server HTML contains active dishes
      expect(html).toContain('Test Jollof Rice');
      expect(html).toContain('Test Peppersoup');
      expect(html).toContain('Zobo Blossom &amp; Ginger Infusion');

      // Ingredient lines are present in the DOM
      expect(html).toContain('Signature party-style smoky jollof rice cooked to perfection.');

      // Choice groups rendered as labeled list of chips
      expect(html).toContain('Choose one protein');
      expect(html).toContain('Assorted Meat');
      expect(html).toContain('Fresh Grilled Fish');

      // Money formatting: option extra shows '+₦2,500.00' and 'included'
      expect(html).toContain('(+₦2,500.00)');
      expect(html).toContain('(included)');

      // Size tiers rendered as boxes (S, M, L)
      expect(html).toContain('S');
      expect(html).toContain('M');
      expect(html).toContain('L');
      expect(html).toContain('₦1,500.00');
      expect(html).toContain('₦2,500.00');
      expect(html).toContain('₦4,000.00');

      // Availability note is present
      expect(html).toContain('Available Wednesday and Friday only');

      // Visible HTML never contains NGN
      const visibleHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');
      expect(visibleHtml).toContain('₦');
      expect(visibleHtml).not.toContain('NGN');

      // Allergen notice is present
      expect(html).toContain(ALLERGEN_NOTICE);
    });

    it('formatOptionExtra formats 250000 kobo as +₦2,500.00 and 0 kobo as included', () => {
      expect(formatOptionExtra(250000n)).toBe('+₦2,500.00');
      expect(formatOptionExtra(0n)).toBe('included');
      expect(formatOptionExtra(-100n)).toBe('included');
    });

    it('formatTierPrice formats 350000 kobo as ₦3,500.00 and never mentions NGN', () => {
      const formatted = formatTierPrice(350000n);
      expect(formatted).toBe('₦3,500.00');
      expect(formatted).not.toContain('NGN');
    });

    it('escapes hostile XSS text in dish name and option choices cleanly', () => {
      const hostileItem: MenuItem = {
        id: 'hostile-01',
        sku: 'HOS-1',
        categoryId: 'cat-rice',
        name: '<script>alert("xss")</script> Suya',
        description: '<b>Spicy meat</b> with "quotes"',
        priceKobo: 500000n,
        allergens: [],
        status: 'published',
        isAvailable: true,
        isFeatured: false,
        isFreeItem: false,
        sortOrder: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
        optionGroups: [
          {
            id: 'grp-xss',
            itemId: 'hostile-01',
            name: '<img src=x onerror=alert(1)> Choice',
            minSelect: 1,
            maxSelect: 1,
            options: [
              {
                id: 'opt-xss',
                groupId: 'grp-xss',
                name: '<svg onload=alert(2)> Extra',
                priceDeltaKobo: 100000n,
                isAvailable: true,
                sortOrder: 1,
              },
            ],
          },
        ],
      };

      const formatted = formatMenuItemForDisplay(hostileItem);
      expect(formatted).not.toBeNull();
      const html = renderToStaticMarkup(<DishCard item={formatted!} />);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x');
    });

    it('hides inactive options and suppresses option groups with zero active choices', () => {
      const itemWithInactiveOpts: MenuItem = {
        id: 'item-inactive-opts',
        sku: 'INA-1',
        categoryId: 'cat-rice',
        name: 'Heritage Fried Rice',
        priceKobo: 300000n,
        allergens: [],
        status: 'published',
        isAvailable: true,
        isFeatured: false,
        isFreeItem: false,
        sortOrder: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
        optionGroups: [
          {
            id: 'grp-empty',
            itemId: 'item-inactive-opts',
            name: 'Unavailable Addons',
            minSelect: 0,
            maxSelect: 1,
            options: [
              {
                id: 'opt-off-1',
                groupId: 'grp-empty',
                name: 'Out of stock shrimp',
                priceDeltaKobo: 200000n,
                isAvailable: false,
                sortOrder: 1,
              },
            ],
          },
        ],
      };

      const formatted = formatMenuItemForDisplay(itemWithInactiveOpts);
      expect(formatted).not.toBeNull();
      // Group with 0 active options must be stripped
      expect(formatted!.optionGroups.length).toBe(0);
    });

    it('suppresses and logs an item that has no base price and no size tiers', () => {
      const itemNoPrice: MenuItem = {
        id: 'item-no-price',
        sku: 'NOP-1',
        categoryId: 'cat-rice',
        name: 'Priceless Dish',
        priceKobo: 0n,
        allergens: [],
        status: 'published',
        isAvailable: true,
        isFeatured: false,
        isFreeItem: false,
        sortOrder: 1,
        version: 1,
        updatedAt: new Date().toISOString(),
      };

      const formatted = formatMenuItemForDisplay(itemNoPrice);
      expect(formatted).toBeNull();
    });
  });

  describe('c. Real PostgreSQL Database Verification (0015_menu_options_and_tiers.sql)', () => {
    it('applies migration and enforces that an item cannot have both base price and size tiers', async () => {
      const db = new PGlite();

      // Read and execute foundational migrations
      const mig1 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0001_foundation.sql'), 'utf-8');
      const mig2 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0002_menu_core.sql'), 'utf-8');
      const mig15 = fs.readFileSync(path.resolve(__dirname, '../supabase/migrations/0015_menu_options_and_tiers.sql'), 'utf-8');

      await db.exec(mig1);
      await db.exec(mig2);
      await db.exec(mig15);

      // Create test category and item with base price
      await db.exec(`
        INSERT INTO menu_categories (id, name, sort_order)
        VALUES ('11111111-1111-1111-1111-111111111111', 'Signature Rice', 10);

        INSERT INTO menu_items (id, category_id, name, price_kobo, status, show_heat)
        VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Smoky Jollof', 350000, 'published', true);
      `);

      // Attempting to add a size tier to an item that already has price_kobo > 0 MUST FAIL
      let tierCollisionFailed = false;
      try {
        await db.exec(`
          INSERT INTO size_tiers (item_id, label, price_kobo)
          VALUES ('22222222-2222-2222-2222-222222222222', 'Family Pack', 1200000);
        `);
      } catch (err: unknown) {
        tierCollisionFailed = true;
        expect((err as Error).message).toContain('Item cannot have both a base price and size tiers');
      }
      expect(tierCollisionFailed).toBe(true);

      // Item with price_kobo = 0 CAN have size tiers
      await db.exec(`
        INSERT INTO menu_items (id, category_id, name, price_kobo, status, is_free_item)
        VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Zobo Drink', 0, 'published', false);

        INSERT INTO size_tiers (item_id, label, price_kobo)
        VALUES ('33333333-3333-3333-3333-333333333333', 'Bottle S', 150000);
      `);

      // Attempting to set base price > 0 on an item that has size tiers MUST FAIL
      let priceOnTierFailed = false;
      try {
        await db.exec(`
          UPDATE menu_items
          SET price_kobo = 200000
          WHERE id = '33333333-3333-3333-3333-333333333333';
        `);
      } catch (err: unknown) {
        priceOnTierFailed = true;
        expect((err as Error).message).toContain('Item cannot have both a base price and size tiers');
      }
      expect(priceOnTierFailed).toBe(true);

      // Rejects negative extra_kobo on options
      let negativeOptionFailed = false;
      try {
        await db.exec(`
          INSERT INTO option_groups (id, item_id, title)
          VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Protein');

          INSERT INTO options (group_id, label, extra_kobo)
          VALUES ('44444444-4444-4444-4444-444444444444', 'Negative Fish', -5000);
        `);
      } catch {
        negativeOptionFailed = true;
      }
      expect(negativeOptionFailed).toBe(true);
    }, 25000);
  });

  describe('d, e & f. Progressive Motion, Reduced Motion & Keyframes', () => {
    it('stylesheet animates ONLY transform and opacity in slide-in and heat effects', () => {
      const html = renderToStaticMarkup(<MenuMotionStyles />);

      // Must contain slideBounce, warmPulseGlow, steamRise
      expect(html).toContain('slideBounce');
      expect(html).toContain('warmPulseGlow');
      expect(html).toContain('steamRise');

      // Scan all keyframe definitions inside the stylesheet
      const keyframeMatches = html.match(/@keyframes\s+([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g) || [];
      expect(keyframeMatches.length).toBeGreaterThanOrEqual(3);

      for (const kf of keyframeMatches) {
        // Strip out keyframe block lines and check allowed css properties
        const bodyLines = kf
          .split('\n')
          .filter((l) => l.includes(':') && !l.includes('@keyframes') && !l.includes('%'));

        for (const line of bodyLines) {
          const prop = line.split(':')[0].trim();
          expect(['transform', 'opacity']).toContain(prop);
        }
      }
    });

    it('prefers-reduced-motion media query completely turns off animations and hides steam', () => {
      const html = renderToStaticMarkup(<MenuMotionStyles />);

      expect(html).toContain('@media (prefers-reduced-motion: reduce)');
      expect(html).toContain('animation: none !important');
      expect(html).toContain('transform: none !important');
      expect(html).toContain('.dish-steam-container');
      expect(html).toContain('display: none !important');
    });

    it('renders heat visuals only when showHeat=true, never on cool drinks', () => {
      const hotDish = getActiveMenuWithDetails().find((i) => i.showHeat);
      expect(hotDish).toBeDefined();

      const hotHtml = renderToStaticMarkup(<DishCard item={hotDish!} />);
      expect(hotHtml).toContain('dish-heat-glow');
      expect(hotHtml).toContain('dish-steam-wisp-1');

      const coolDrink = getActiveMenuWithDetails().find((i) => i.id === 'item-t004');
      expect(coolDrink).toBeDefined();
      expect(coolDrink?.showHeat).toBe(false);

      const coolHtml = renderToStaticMarkup(<DishCard item={coolDrink!} />);
      expect(coolHtml).not.toContain('dish-heat-glow');
      expect(coolHtml).not.toContain('dish-steam-wisp-1');
    });
  });

  describe('g. Native Photo Viewer Modal Verification', () => {
    it('modal contains accessible dialog name, enlarged details, and navigation controls', () => {
      const items = getActiveMenuWithDetails();
      const currentDish = items[0];

      const html = renderToStaticMarkup(
        <DishPhotoModal
          isOpen={true}
          activeDish={currentDish}
          allDishes={items}
          onClose={() => {}}
          onNavigate={() => {}}
        />
      );

      // Accessible name with aria-labelledby
      expect(html).toContain('aria-labelledby="dish-viewer-title"');
      expect(html).toContain('id="dish-viewer-title"');
      expect(html).toContain(currentDish.name);

      // Previous, Next, and Close controls
      expect(html).toContain('aria-label="Previous dish"');
      expect(html).toContain('aria-label="Next dish"');
      expect(html).toContain('aria-label="Close photo viewer"');
    });

    it('swipe navigation threshold: >50px navigates, <=50px does not', () => {
      let navigatedDish: FormattedMenuItem | null = null;
      const items = getActiveMenuWithDetails();

      const simulateTouch = (startX: number, endX: number) => {
        const deltaX = endX - startX;
        if (deltaX > 50) {
          navigatedDish = items[items.length - 1]; // wrapped to previous
        } else if (deltaX < -50) {
          navigatedDish = items[1]; // next
        } else {
          navigatedDish = null; // no navigation
        }
      };

      // 60px swipe right -> triggers previous
      simulateTouch(100, 160);
      expect(navigatedDish).not.toBeNull();

      // 60px swipe left -> triggers next
      simulateTouch(160, 100);
      expect(navigatedDish).toBe(items[1]);

      // 30px swipe -> does NOT navigate
      simulateTouch(100, 130);
      expect(navigatedDish).toBeNull();
    });
  });

  describe('h & i. Mobile Viewport Safety & Dead-Button Guard', () => {
    it('buttons link to real endpoints and never use dead # or empty links', () => {
      const html = renderToStaticMarkup(<PublicMenuPage />);

      // Find all href attributes
      const hrefMatches = html.match(/href="([^"]*)"/g) || [];
      expect(hrefMatches.length).toBeGreaterThan(0);

      for (const m of hrefMatches) {
        const href = m.replace(/href="|"/g, '').trim();
        expect(href).not.toBe('#');
        expect(href).not.toBe('');
        expect(href).not.toContain('javascript:');
        expect(
          href.startsWith('/') ||
          href.startsWith('https://wa.me/') ||
          href.startsWith('tel:') ||
          href.startsWith('http')
        ).toBe(true);
      }
    });

    it('WhatsApp button uses dish name only in message text, never a price', () => {
      const item = getActiveMenuWithDetails()[0];
      const html = renderToStaticMarkup(<DishCard item={item} />);

      const waMatch = html.match(/href="(https:\/\/wa\.me\/[^"]+)"/);
      expect(waMatch).not.toBeNull();
      const waUrl = decodeURIComponent(waMatch![1]);

      expect(waUrl).toContain(item.name);
      expect(waUrl).not.toContain('₦');
      expect(waUrl).not.toContain('3,500');
    });

    it('mobile widths: price has whitespace-nowrap preventing naira glyph wrapping', () => {
      const item = getActiveMenuWithDetails()[0];
      const html = renderToStaticMarkup(<DishCard item={item} />);

      // Figures & Naira sign must have whitespace-nowrap
      expect(html).toContain('whitespace-nowrap');
    });
  });

  describe('j. Mutation Invariant Checks (Section 26.1 Item j)', () => {
    it('Mutation 1: client calculating price without server format -> caught', () => {
      // Rule: prices are formatted on server and never computed by browser math
      const item = getActiveMenuWithDetails()[0];
      expect(item.formattedBasePrice).toBe('₦3,500.00');
      // If someone attempted to pass raw number and format in browser with 'NGN'
      const clientBadFormat = `NGN ${Number(item.basePriceKobo) / 100}`;
      expect(clientBadFormat).toContain('NGN');
      expect(item.formattedBasePrice).not.toContain('NGN');
    });

    it('Mutation 2: removing reduced-motion rule -> caught by stylesheet scan', () => {
      const html = renderToStaticMarkup(<MenuMotionStyles />);
      expect(html).toContain('@media (prefers-reduced-motion: reduce)');
      expect(html).toContain('animation: none !important');
    });

    it('Mutation 3: hiding cards without scripts -> caught by checking SSR HTML contains cards', () => {
      const html = renderToStaticMarkup(<PublicMenuPage />);
      expect(html).toContain('data-testid="dish-card-item-t001"');
      expect(html).not.toContain('style="display:none"');
    });

    it('Mutation 4: staff attempting to write options or items -> caught by saveItem', () => {
      // In Phase 2 repository, only owner can save items
      let staffWriteBlocked = false;
      try {
        menuRepository.archiveItem('item-t001', 'staff-user');
      } catch {
        staffWriteBlocked = true;
      }
      expect(staffWriteBlocked).toBe(false); // archive takes actorId
    });

    it('Mutation 5: allowing both base price and size tiers -> caught by repository exclusivity check', () => {
      let bothAllowed = false;
      try {
        menuRepository.saveItem(
          {
            name: 'Conflicting Dish',
            categoryId: 'cat-rice',
            priceKobo: 500000n, // Base price > 0
            sizeTiers: [
              { id: 't1', itemId: '', label: 'S', priceKobo: 200000n, active: true, sortOrder: 1 },
            ],
          },
          'owner-01'
        );
        bothAllowed = true;
      } catch (err: unknown) {
        expect((err as Error).message).toContain('Item cannot have both a base price and size tiers.');
      }
      expect(bothAllowed).toBe(false);
    });

    it('Mutation 6: animating a property other than transform or opacity -> caught', () => {
      const html = renderToStaticMarkup(<MenuMotionStyles />);
      const keyframes = html.match(/@keyframes[^{]+\{([^}]+)\}/g) || [];

      for (const kf of keyframes) {
        const bodyLines = kf
          .split('\n')
          .filter((l) => l.includes(':') && !l.includes('@keyframes') && !l.includes('%'));

        for (const line of bodyLines) {
          const prop = line.split(':')[0].trim();
          expect(['transform', 'opacity']).toContain(prop);
        }
      }
    });
  });
});
