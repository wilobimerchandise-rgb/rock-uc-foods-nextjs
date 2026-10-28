/**
 * ROCK UC FOODS - SEO & Structured Data Tests (17 Tests)
 * Playbook v4 Section 19.3
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { resolveSiteUrl, absoluteUrl, SITE_ORIGIN } from '../src/seo/config';
import { PUBLIC_ROUTES, PRIVATE_PREFIXES, isPublicPath, isPrivatePath } from '../src/seo/routes';
import { publicMetadata, privateMetadata, rootMetadata } from '../src/seo/metadata';
import { safeJsonLd, businessJsonLd, menuJsonLd, schemaPrice } from '../src/seo/jsonld';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { initialMenuItems } from '../src/menu/data';

describe('Playbook Section 19.3: SEO, Robots, Sitemap & Structured Data', () => {
  describe('1. resolveSiteUrl & Canonical URL Generation', () => {
    it('returns default https://rockucfoods.com when input is empty', () => {
      expect(resolveSiteUrl('')).toBe('https://rockucfoods.com');
      expect(resolveSiteUrl(undefined)).toBe('https://rockucfoods.com');
    });

    it('strips trailing slashes and paths to keep only the origin', () => {
      expect(resolveSiteUrl('https://rockucfoods.com/some/path/')).toBe('https://rockucfoods.com');
    });

    it('rejects insecure http:// in production', () => {
      expect(() => resolveSiteUrl('http://rockucfoods.com', true)).toThrow(/must use https:\/\//);
    });

    it('allows http:// in development/preview', () => {
      expect(resolveSiteUrl('http://localhost:3000', false)).toBe('http://localhost:3000');
    });

    it('rejects garbage and javascript: schemes', () => {
      expect(() => resolveSiteUrl('javascript:alert(1)')).toThrow();
      expect(() => resolveSiteUrl('not-a-url')).toThrow();
    });

    it('builds clean absolute canonical URLs', () => {
      expect(absoluteUrl('/privacy')).toBe(`${SITE_ORIGIN}/privacy`);
      expect(absoluteUrl('privacy')).toBe(`${SITE_ORIGIN}/privacy`);
    });
  });

  describe('2. Robots & Sitemap Route Coverage', () => {
    it('robots disallows every private prefix', () => {
      const robotsConfig = robots();
      const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules[0] : robotsConfig.rules;
      expect(rules?.allow).toBe('/');

      const disallows = rules?.disallow as string[];
      for (const prefix of PRIVATE_PREFIXES) {
        expect(disallows).toContain(prefix);
      }
    });

    it('sitemap lists public routes only with absolute URLs and no private paths', () => {
      const sitemapEntries = sitemap();
      expect(sitemapEntries.length).toBeGreaterThan(0);

      for (const entry of sitemapEntries) {
        expect(entry.url).toMatch(/^https?:\/\//);
        for (const priv of PRIVATE_PREFIXES) {
          expect(entry.url).not.toContain(priv);
        }
      }
    });

    it('every page.tsx in app is classified as public or private', () => {
      const appDir = path.resolve(process.cwd(), 'app');
      function getPageFiles(dir: string, baseRoute: string = ''): string[] {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        let pages: string[] = [];
        for (const entry of entries) {
          if (entry.isDirectory()) {
            pages = pages.concat(getPageFiles(path.join(dir, entry.name), `${baseRoute}/${entry.name}`));
          } else if (entry.name === 'page.tsx') {
            const route = baseRoute === '' ? '/' : baseRoute;
            pages.push(route);
          }
        }
        return pages;
      }

      const allAppPages = getPageFiles(appDir);
      for (const pageRoute of allAppPages) {
        const isCovered = isPublicPath(pageRoute) || isPrivatePath(pageRoute);
        expect(isCovered, `Route ${pageRoute} is neither in public routes nor private prefixes`).toBe(true);
      }
    });
  });

  describe('3. Metadata & Length Constraints', () => {
    it('title is at most 60 characters and description is between 70 and 160', () => {
      const meta = publicMetadata({
        title: 'ROCK UC FOODS | Luxury Nigerian Catering in Lagos',
        description: 'Taste luxury Nigerian party jollof, premium peppersoup, and bespoke event catering in Lagos.',
        path: '/',
      });

      expect(typeof meta.title === 'string' ? meta.title.length : 0).toBeLessThanOrEqual(60);
      const descLen = meta.description?.length ?? 0;
      expect(descLen).toBeGreaterThanOrEqual(70);
      expect(descLen).toBeLessThanOrEqual(160);
    });

    it('private metadata enforces noindex, nofollow, and nocache', () => {
      expect(privateMetadata.robots).toEqual({
        index: false,
        follow: false,
        nocache: true,
      });
    });
  });

  describe('4. Structured Data (JSON-LD) Safety & Escaping', () => {
    it('schemaPrice converts kobo to standard decimal string with integer math', () => {
      expect(schemaPrice(350000n)).toBe('3500.00');
      expect(schemaPrice(420050n)).toBe('4200.50');
      expect(schemaPrice(5n)).toBe('0.05');
    });

    it('safeJsonLd escapes <, >, &, and line separators to prevent script tag closing', () => {
      const hostileData = {
        dishName: '</script><script>alert("hack")</script>',
        note: 'Rock & Roll \u2028 Next Line',
      };
      const jsonLd = safeJsonLd(hostileData);
      expect(jsonLd).not.toContain('</script>');
      expect(jsonLd).toContain('\\u003c/script\\u003e');
      expect(jsonLd).toContain('\\u0026');
      expect(jsonLd).not.toContain('\u2028');
    });

    it('businessJsonLd contains only known facts and NEVER contains aggregateRating or reviews', () => {
      const biz = businessJsonLd();
      expect(biz['@type']).toBe('FoodEstablishment');
      expect(biz.telephone).toBe('+2348033729125');
      expect(biz.servesCuisine).toBe('Nigerian');
      expect((biz as any).aggregateRating).toBeUndefined();
      expect((biz as any).review).toBeUndefined();
    });

    it('menuJsonLd builds MenuItem offers strictly from live menu rows', () => {
      const menuLd = menuJsonLd(initialMenuItems);
      expect(menuLd['@type']).toBe('Menu');
      expect(menuLd.hasMenuItem.length).toBeGreaterThan(0);
      for (const item of menuLd.hasMenuItem) {
        expect(item.offers.price).toBeDefined();
        expect(item.offers.priceCurrency).toBe('NGN');
      }
    });
  });
});
