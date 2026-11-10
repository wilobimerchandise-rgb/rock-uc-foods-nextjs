'use client';

/**
 * ROCK UC FOODS - Mobile Bottom Tab Bar (Phase 2C Section 30)
 * 
 * Rules:
 * 1. Fixed to bottom of screen on phones (width < 768px), md:hidden.
 * 2. Every item shows an icon (24px) AND a visible text label (13px+ semibold, single line, no truncation at 360px).
 * 3. Items share width equally (flex-1), each >=56px high and >=64px wide.
 * 4. Active item: wine background (#6B1230), cream text (#F7EFD9), aria-current="page".
 * 5. Inactive items: gold (#D4AF37) or cream text with contrast >= 4.5:1. Visible focus ring.
 * 6. Admin button rendered ONLY when signed in as owner, staff, or developer.
 */

import React from 'react';
import { Home, UtensilsCrossed, Calculator, Package, Settings2 } from 'lucide-react';

export interface BottomTabBarProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  showAdmin?: boolean;
}

export const BASE_NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'estimate', label: 'Estimate', icon: Calculator },
  { id: 'track', label: 'Track', icon: Package },
] as const;

export const ADMIN_NAV_ITEM = { id: 'admin', label: 'Admin', icon: Settings2 } as const;

export function BottomTabBar({ activeTab, onSelectTab, showAdmin = false }: BottomTabBarProps) {
  const items = showAdmin ? [...BASE_NAV_ITEMS, ADMIN_NAV_ITEM] : [...BASE_NAV_ITEMS];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      data-testid="mobile-bottom-tab-bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#17120F] border-t border-[#D4AF37]/30 px-1 sm:px-2 py-1 flex items-center justify-between gap-2 min-w-0 w-full max-w-full"
      style={{
        paddingBottom: 'calc(0.25rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {items.map((item) => {
        const isActive = activeTab === item.id;
        const IconComponent = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            aria-current={isActive ? 'page' : undefined}
            data-testid={`bottom-nav-${item.id}`}
            className={`flex-1 min-w-[64px] min-h-[56px] h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
              isActive
                ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50 shadow-md font-bold'
                : 'bg-transparent text-[#D4AF37] hover:text-[#F7EFD9] hover:bg-white/5 font-semibold'
            }`}
          >
            <IconComponent className="w-6 h-6 shrink-0" aria-hidden="true" />
            <span className="text-[13px] leading-tight tracking-tight whitespace-nowrap overflow-hidden select-none">
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
