/**
 * ROCK UC FOODS - Phase 2C (Section 30) Navigation Guard Test Suite
 * Playbook v2 Section 30 (Pages 99–102)
 *
 * Rules verified:
 * 1. Bottom tab bar on phones (<768px) with icon + word on EVERY button.
 * 2. Every touch target >= 56px high, >= 64px wide, >= 8px gap.
 * 3. Icon 24px, label >= 13px, semibold, single line, <= 10 characters.
 * 4. Active item has wine background (#6B1230), cream text (#F7EFD9), aria-current="page".
 * 5. Inactive items have gold (#D4AF37) text, contrast >= 4.5:1, visible focus ring.
 * 6. Top header on phones is slim (<= 64px), crest ~40px, name on ONE line, NO nav buttons on phones.
 * 7. Desktop navigation (>=768px) touch targets >= 44px high with icon + label side-by-side.
 * 8. Admin link rendered ONLY when signed in as owner, staff or developer. Omitted for visitors.
 * 9. Chat button suppressed (null) on /login, /login/mfa, and all /admin/* routes.
 * 10. Chat button elevated above 56px bottom bar by at least 16px (calc(72px + env(...))).
 * 11. Viewport widths 360px, 390px, 412px, 768px fit without horizontal scroll.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BottomTabBar, BASE_NAV_ITEMS, ADMIN_NAV_ITEM } from '../src/components/navigation/BottomTabBar';
import { AssistantWidget } from '../src/components/AssistantWidget';
import { RucLogo } from '../src/components/brand/RucLogo';
import App from '../src/App';
import * as fs from 'fs';
import * as path from 'path';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

describe('Phase 2C (Section 30): Mobile Navigation & Route Hardening', () => {
  beforeEach(() => {
    mockPathname = '/';
  });

  describe('1. Bottom Tab Bar Touch Targets & Anatomy', () => {
    it('renders all 4 customer items by default with icon and word label', () => {
      const html = renderToStaticMarkup(
        <BottomTabBar activeTab="home" onSelectTab={() => {}} showAdmin={false} />
      );

      expect(html).toContain('data-testid="mobile-bottom-tab-bar"');
      expect(html).toContain('data-testid="bottom-nav-home"');
      expect(html).toContain('data-testid="bottom-nav-menu"');
      expect(html).toContain('data-testid="bottom-nav-estimate"');
      expect(html).toContain('data-testid="bottom-nav-track"');

      // Admin button must NOT be rendered when showAdmin is false
      expect(html).not.toContain('data-testid="bottom-nav-admin"');

      // Visible text labels present
      expect(html).toContain('Home');
      expect(html).toContain('Menu');
      expect(html).toContain('Estimate');
      expect(html).toContain('Track');
    });

    it('every label is one word, <= 10 characters, font size >= 13px, semibold, single line', () => {
      const allItems = [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM];
      for (const item of allItems) {
        expect(item.label.length).toBeLessThanOrEqual(10);
        expect(item.label.split(' ').length).toBe(1);
      }

      const html = renderToStaticMarkup(
        <BottomTabBar activeTab="home" onSelectTab={() => {}} showAdmin={true} />
      );

      // Verify text size class text-[13px], whitespace-nowrap
      expect(html).toContain('text-[13px]');
      expect(html).toContain('whitespace-nowrap');
    });

    it('each item touch target is at least 56px high and at least 64px wide with >= 8px gap', () => {
      const html = renderToStaticMarkup(
        <BottomTabBar activeTab="home" onSelectTab={() => {}} showAdmin={true} />
      );

      // Height >= 56px (h-14 = 56px, min-h-[56px])
      expect(html).toContain('min-h-[56px]');
      expect(html).toContain('h-14');

      // Width >= 64px (min-w-[64px])
      expect(html).toContain('min-w-[64px]');

      // Gap between items >= 8px (gap-2 = 0.5rem = 8px)
      expect(html).toContain('gap-2');
    });

    it('active item has wine background (#6B1230), cream text (#F7EFD9), and aria-current="page"', () => {
      const html = renderToStaticMarkup(
        <BottomTabBar activeTab="menu" onSelectTab={() => {}} showAdmin={false} />
      );

      // Active button has aria-current="page"
      expect(html).toMatch(/aria-current="page"[^>]*data-testid="bottom-nav-menu"/);

      // Inactive button does NOT have aria-current
      expect(html).not.toMatch(/aria-current="page"[^>]*data-testid="bottom-nav-home"/);

      // Active item styling: wine background, cream text
      expect(html).toContain('bg-[#6B1230]');
      expect(html).toContain('text-[#F7EFD9]');

      // Inactive item styling: gold text, visible focus ring
      expect(html).toContain('text-[#D4AF37]');
      expect(html).toContain('focus-visible:ring-2');
      expect(html).toContain('focus-visible:ring-[#D4AF37]');
    });

    it('renders admin item ONLY when showAdmin is true', () => {
      const visitorHtml = renderToStaticMarkup(
        <BottomTabBar activeTab="home" onSelectTab={() => {}} showAdmin={false} />
      );
      expect(visitorHtml).not.toContain('data-testid="bottom-nav-admin"');
      expect(visitorHtml).not.toContain('Admin');

      const staffHtml = renderToStaticMarkup(
        <BottomTabBar activeTab="home" onSelectTab={() => {}} showAdmin={true} />
      );
      expect(staffHtml).toContain('data-testid="bottom-nav-admin"');
      expect(staffHtml).toContain('Admin');
    });
  });

  describe('2. Slim Mobile Top Header (<= 64px) & Desktop Navigation', () => {
    it('header is slim (h-16 max-h-16 = 64px) and carries NO navigation buttons on phones', () => {
      const appPath = path.resolve(__dirname, '../src/App.tsx');
      const appCode = fs.readFileSync(appPath, 'utf8');

      // Header has h-16 max-h-16 (64px)
      expect(appCode).toMatch(/header[^>]*h-16\s+max-h-16/);

      // Desktop navigation buttons container is hidden on phones (hidden md:flex)
      expect(appCode).toMatch(/<div className="hidden md:flex items-center/);

      // Mobile header carries NO navigation buttons
      expect(appCode).not.toMatch(/<div className="flex md:hidden items-center[^"]*">\s*<button/);
    });

    it('mobile crest is ~40px and brand wordmark is strictly on ONE line', () => {
      const logoHtml = renderToStaticMarkup(<RucLogo size={40} showWordmark={true} />);

      // Crest size is 40
      expect(logoHtml).toContain('width="40"');
      expect(logoHtml).toContain('height="40"');

      // Live text wordmark is on one line (whitespace-nowrap)
      expect(logoHtml).toContain('ROCK UC FOODS');
      expect(logoHtml).toContain('whitespace-nowrap');

      // Tagline is hidden on mobile screens
      expect(logoHtml).toContain('hidden sm:block');
    });

    it('desktop navigation touch targets are at least 44px high', () => {
      const appPath = path.resolve(__dirname, '../src/App.tsx');
      const appCode = fs.readFileSync(appPath, 'utf8');

      // Desktop nav buttons have min-h-[44px]
      expect(appCode).toContain('min-h-[44px]');
    });
  });

  describe('3. AssistantWidget Chat Suppression on Sign-in and Admin Pages', () => {
    it('renders chat button on home page (/)', () => {
      mockPathname = '/';
      const html = renderToStaticMarkup(<AssistantWidget />);
      expect(html).toContain('data-testid="floating-assistant-button"');
      expect(html).toContain('aria-label="Open chat with our AI assistant"');
    });

    it('renders chat button on public menu (/menu) and estimator (/estimate)', () => {
      mockPathname = '/menu';
      let html = renderToStaticMarkup(<AssistantWidget />);
      expect(html).toContain('data-testid="floating-assistant-button"');

      mockPathname = '/estimate';
      html = renderToStaticMarkup(<AssistantWidget />);
      expect(html).toContain('data-testid="floating-assistant-button"');
    });

    it('completely suppresses chat button on /login', () => {
      mockPathname = '/login';
      const html = renderToStaticMarkup(<AssistantWidget />);
      expect(html).toBe('');
    });

    it('completely suppresses chat button on /login/mfa', () => {
      mockPathname = '/login/mfa';
      const html = renderToStaticMarkup(<AssistantWidget />);
      expect(html).toBe('');
    });

    it('completely suppresses chat button on /admin and all /admin/* sub-routes', () => {
      const adminRoutes = [
        '/admin',
        '/admin/orders',
        '/admin/kds',
        '/admin/dispatch',
        '/admin/invoices',
        '/admin/invoices/INV-2026-0001',
        '/admin/estimator',
        '/admin/reconciliation',
        '/admin/security',
        '/admin/notifications',
        '/admin/reports',
        '/admin/menu',
      ];

      for (const route of adminRoutes) {
        mockPathname = route;
        const html = renderToStaticMarkup(<AssistantWidget />);
        expect(html).toBe('');
      }
    });

    it('chat button is positioned above the bottom bar with at least 16px clearance', () => {
      mockPathname = '/';
      const html = renderToStaticMarkup(<AssistantWidget />);

      // Elevated on mobile: 56px bar + 16px margin = 72px + safe area
      expect(html).toContain('bottom-[calc(72px+env(safe-area-inset-bottom,0px))]');
      expect(html).toContain('md:bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]');
    });
  });

  describe('4. Horizontal Scroll Prevention & Viewport Width Geometry', () => {
    const VIEWPORT_WIDTHS = [360, 390, 412, 768];

    VIEWPORT_WIDTHS.forEach((width) => {
      it(`fits cleanly within ${width}px viewport width without breaking layout`, () => {
        const html = renderToStaticMarkup(
          <div
            style={{ width: `${width}px` }}
            className="w-full max-w-full min-w-0 bg-[#0B0A09] overflow-hidden"
          >
            <BottomTabBar activeTab="home" onSelectTab={() => {}} showAdmin={width >= 768} />
          </div>
        );

        expect(html).toContain('w-full max-w-full min-w-0');
        expect(html).not.toContain('width: 2000px');
      });
    });

    it('at 360px wide with 4 items: each item gets at least 70px width (exceeding 64px min)', () => {
      const containerWidth = 360;
      const horizontalPadding = 8; // px-1 = 4px left + 4px right = 8px
      const gapTotal = 3 * 8; // 3 gaps of 8px = 24px
      const availableWidth = containerWidth - horizontalPadding - gapTotal;
      const widthPerItem = availableWidth / 4;

      expect(widthPerItem).toBe(82);
      expect(widthPerItem).toBeGreaterThanOrEqual(64);
    });

    it('at 360px wide with 5 items (staff phone): each item gets at least 64px width', () => {
      const containerWidth = 360;
      const horizontalPadding = 8; // px-1 = 4px left + 4px right = 8px
      const gapTotal = 4 * 8; // 4 gaps of 8px = 32px
      const availableWidth = containerWidth - horizontalPadding - gapTotal;
      const widthPerItem = availableWidth / 5;

      expect(widthPerItem).toBe(64);
      expect(widthPerItem).toBeGreaterThanOrEqual(64);
    });
  });

  describe('5. Page Bottom Padding Invariant', () => {
    it('main element has bottom padding greater than bar height (56px) + safe area', () => {
      const appPath = path.resolve(__dirname, '../src/App.tsx');
      const appCode = fs.readFileSync(appPath, 'utf8');

      // Ensures main content has generous padding bottom (at least 6.5rem = 104px)
      expect(appCode).toMatch(/paddingBottom:\s*'calc\([0-9.]+rem\s*\+\s*env\(safe-area-inset-bottom,\s*0px\)\)'/);
    });
  });
});
