'use client';

/**
 * ROCK UC FOODS - Mobile-Hardened Admin Tab Strip
 * Playbook v9 Section 27 (Pages 82–86)
 * 
 * Rules:
 * 1. Inside its own wrapper: width 100%, max-width 100%, overflow-x auto,
 *    overscroll-behavior-x contain, hidden scrollbar.
 * 2. Flex row with width max-content and no wrapping.
 * 3. 16px of end padding (pr-4) and soft right-edge fade.
 * 4. Every parent of this wrapper MUST have min-width 0.
 * 5. 10 tabs in exact order:
 *    Live Orders, Kitchen (KDS), Rider Dispatch, Events & Invoices,
 *    Estimator Pricing, Bank Reconciliation, Security & MFA,
 *    Alerts Outbox, Reports & Promos, Menu Catalog & CSV.
 */

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ClipboardList,
  ChefHat,
  Truck,
  CalendarCheck,
  Calculator,
  DollarSign,
  ShieldCheck,
  Bell,
  BarChart3,
  BookOpen,
  Users,
} from 'lucide-react';

export interface AdminTabItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_TAB_ITEMS: AdminTabItem[] = [
  { id: 'live_orders', label: 'Live Orders', href: '/admin?tab=live_orders', icon: ClipboardList },
  { id: 'kds', label: 'Kitchen (KDS)', href: '/admin?tab=kds', icon: ChefHat },
  { id: 'dispatch', label: 'Rider Dispatch', href: '/admin?tab=dispatch', icon: Truck },
  { id: 'events', label: 'Events & Invoices', href: '/admin?tab=events', icon: CalendarCheck },
  { id: 'estimator', label: 'Estimator Pricing', href: '/admin/estimator', icon: Calculator },
  { id: 'reconciliation', label: 'Bank Reconciliation', href: '/admin/reconciliation', icon: DollarSign },
  { id: 'staff', label: 'Team & Staff', href: '/admin?tab=staff', icon: Users },
  { id: 'security', label: 'Security & MFA', href: '/admin?tab=security', icon: ShieldCheck },
  { id: 'alerts', label: 'Alerts Outbox', href: '/admin?tab=alerts', icon: Bell },
  { id: 'reports', label: 'Reports & Promos', href: '/admin?tab=reports', icon: BarChart3 },
  { id: 'menu', label: 'Menu Catalog & CSV', href: '/admin?tab=menu', icon: BookOpen },
];

function TabStripInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const getIsActive = (tab: AdminTabItem): boolean => {
    if (tab.id === 'estimator') {
      return pathname.startsWith('/admin/estimator');
    }
    if (tab.id === 'reconciliation') {
      return pathname.startsWith('/admin/reconciliation');
    }
    if (tab.id === 'events') {
      return pathname.startsWith('/admin/invoices') || (pathname === '/admin' && searchParams.get('tab') === 'events');
    }
    if (pathname === '/admin') {
      const currentTab = searchParams.get('tab') || 'live_orders';
      return currentTab === tab.id;
    }
    return false;
  };

  return (
    <div
      className="relative w-full max-w-full min-w-0 bg-[#17120F]/90 border-b border-[#D4AF37]/20"
      data-testid="admin-tab-strip-wrapper"
    >
      {/* Scrollable Container with overscroll containment */}
      <div
        className="w-full max-w-full overflow-x-auto [overscroll-behavior-x:contain] no-scrollbar min-w-0 px-4 py-2"
        data-testid="admin-tab-strip-scroll"
      >
        <nav
          aria-label="Admin Navigation Tabs"
          className="flex items-center gap-2 w-[max-content] min-w-max flex-nowrap pr-4"
          data-testid="admin-tab-strip-row"
        >
          {ADMIN_TAB_ITEMS.map((tab) => {
            const active = getIsActive(tab);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.id}
                href={tab.href}
                data-testid={`admin-tab-${tab.id}`}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all duration-150 whitespace-nowrap min-h-[40px] ${
                  active
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/60 shadow-md font-bold'
                    : 'bg-[#0B0A09]/70 text-[#F7EFD9]/70 hover:text-[#F7EFD9] hover:bg-[#0B0A09] border border-white/5'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-[#D4AF37]' : 'text-[#F7EFD9]/60'
                  }`}
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Soft edge fade indicating scrollability */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#17120F] to-transparent"
        aria-hidden="true"
        data-testid="admin-tab-strip-fade"
      />
    </div>
  );
}

export function AdminTabStrip() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-12 bg-[#17120F]/90 border-b border-[#D4AF37]/20 animate-pulse" />
      }
    >
      <TabStripInner />
    </Suspense>
  );
}
