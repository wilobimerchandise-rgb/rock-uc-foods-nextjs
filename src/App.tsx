/**
 * ROCK UC FOODS - Main Application Container
 * (Playbook v2 Section 7B, 8, 9, 10 & Section 17 v3 Addendum)
 * Seamlessly integrates Brand Website, Live Menu with Cart,
 * Real-time Order Tracking, and Staff / Admin Operations (Orders, Catering, Menu).
 */

'use client';

import React, { useState } from 'react';
import { BrandWebsite } from './components/brand/BrandWebsite';
import { PublicMenu } from './components/menu/PublicMenu';
import { OwnerMenuEditor } from './components/menu/OwnerMenuEditor';
import { OrderTrackingView } from './components/order/OrderTrackingView';
import { StaffOrderManager } from './components/order/StaffOrderManager';
import { StaffCateringManager } from './components/catering/StaffCateringManager';
import { EstimatorClient } from './components/EstimatorClient';
import { EstimatorAdminClient } from './components/EstimatorAdminClient';
import { ReconciliationManager } from './components/payment/ReconciliationManager';
import { MfaSetupCard } from './components/security/MfaSetupCard';
import { NotificationOutboxDashboard } from './components/notifications/NotificationOutboxDashboard';
import { KitchenDisplayDashboard } from './components/kds/KitchenDisplayDashboard';
import { DispatchManagerDashboard } from './components/dispatch/DispatchManagerDashboard';
import { PromotionsAndReportsManager } from './components/promotions/PromotionsAndReportsManager';
import { SiteContentManager } from './components/admin/SiteContentManager';
import { DeliveryZoneManager } from './components/admin/DeliveryZoneManager';
import { RucLogo } from './components/brand/RucLogo';
import { BottomTabBar } from './components/navigation/BottomTabBar';
import { CartProvider } from './order/cartContext';
import { Order } from './types/order';
import { Home, UtensilsCrossed, Package, Settings2, ClipboardList, CalendarDays, Calculator, DollarSign, ShieldCheck, Bell, ChefHat, Truck, TrendingUp, MapPin, FileEdit } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'estimate' | 'track' | 'admin'>('home');
  const [adminSubTab, setAdminSubTab] = useState<'orders' | 'kds' | 'dispatch' | 'catering' | 'estimator' | 'reconciliation' | 'security' | 'notifications' | 'reports' | 'menu' | 'zones' | 'content'>('orders');
  const [currentRole, setCurrentRole] = useState<'owner' | 'staff' | 'developer' | 'visitor'>('owner');
  const [trackedOrder, setTrackedOrder] = useState<Order | undefined>(undefined);

  const showAdmin = currentRole === 'owner' || currentRole === 'staff' || currentRole === 'developer';

  const handleOrderPlaced = (order: Order) => {
    setTrackedOrder(order);
    setActiveTab('track');
  };

  return (
    <CartProvider>
      <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans min-w-0 w-full max-w-full">
        {/* Top Application Header */}
        <header className="border-b border-[var(--border-gold)] bg-[var(--bg-header)] backdrop-blur sticky top-0 z-40 px-3 sm:px-4 h-16 max-h-16 flex items-center w-full max-w-full min-w-0 overflow-hidden">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 lg:gap-3 min-w-0 w-full">
            {/* Brand Logo & Lockup */}
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="flex items-center text-left hover:opacity-90 transition-opacity shrink-0 min-h-[44px] min-w-[44px]"
              aria-label="Return to Rock UC Foods Homepage"
            >
              <RucLogo size={40} showWordmark={true} />
            </button>

            {/* Desktop Navigation Controls (768px and up) - No navigation buttons on phones */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2 min-w-0 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className={`px-2.5 lg:px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 min-h-[44px] whitespace-nowrap shrink-0 transition-all ${
                  activeTab === 'home'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[var(--border-gold)] shadow'
                    : 'bg-[var(--nav-inactive-bg)] text-[var(--nav-inactive-text)] hover:opacity-90'
                }`}
              >
                <Home className="w-4 h-4 shrink-0" />
                <span>Home</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('menu')}
                className={`px-2.5 lg:px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 min-h-[44px] whitespace-nowrap shrink-0 transition-all ${
                  activeTab === 'menu'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[var(--border-gold)] shadow'
                    : 'bg-[var(--nav-inactive-bg)] text-[var(--nav-inactive-text)] hover:opacity-90'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4 shrink-0" />
                <span>Menu</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('estimate')}
                className={`px-2.5 lg:px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 min-h-[44px] whitespace-nowrap shrink-0 transition-all ${
                  activeTab === 'estimate'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[var(--border-gold)] shadow'
                    : 'bg-[var(--nav-inactive-bg)] text-[var(--nav-inactive-text)] hover:opacity-90'
                }`}
              >
                <Calculator className={`w-4 h-4 shrink-0 ${activeTab === 'estimate' ? 'text-[#D4AF37]' : 'text-[var(--icon-on-surface)]'}`} />
                <span>
                  <span className="hidden xl:inline">Catering </span>Estimator
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('track')}
                className={`px-2.5 lg:px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 min-h-[44px] whitespace-nowrap shrink-0 transition-all ${
                  activeTab === 'track'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[var(--border-gold)] shadow'
                    : 'bg-[var(--nav-inactive-bg)] text-[var(--nav-inactive-text)] hover:opacity-90'
                }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span>
                  Track<span className="hidden xl:inline"> Order</span>
                </span>
              </button>

              {/* Admin Link: Rendered ONLY when signed in as owner, staff or developer */}
              {showAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`px-2.5 lg:px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 min-h-[44px] whitespace-nowrap shrink-0 transition-all ${
                    activeTab === 'admin'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[var(--border-gold)] shadow'
                      : 'bg-[var(--nav-inactive-bg)] text-[var(--nav-inactive-text)] hover:opacity-90'
                  }`}
                >
                  <Settings2 className="w-4 h-4 shrink-0" />
                  <span>
                    <span className="hidden xl:inline">Staff / </span>Admin
                  </span>
                </button>
              )}

              {/* Role Simulation Switcher for Testing */}
              <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-card)] text-sm shrink-0">
                <span className="text-sm text-[var(--text-body-muted)] hidden xl:inline">Simulate:</span>
                <select
                  aria-label="Simulate user role"
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value as any)}
                  className="min-h-[44px] bg-[var(--bg-card)] border border-[var(--border-gold)] text-[var(--text-accent)] rounded px-2.5 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  <option value="owner">Owner</option>
                  <option value="staff">Staff</option>
                  <option value="developer">Developer</option>
                  <option value="visitor">Visitor</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full max-w-full" style={{ paddingBottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))' }}>
          {activeTab === 'home' && (
            <BrandWebsite
              onNavigateToMenu={() => setActiveTab('menu')}
              onOpenOrder={() => setActiveTab('menu')}
            />
          )}

          {activeTab === 'menu' && (
            <PublicMenu onOrderPlaced={handleOrderPlaced} />
          )}

          {activeTab === 'estimate' && (
            <div className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
              <EstimatorClient />
            </div>
          )}

          {activeTab === 'track' && (
            <OrderTrackingView
              initialOrder={trackedOrder}
              onBackToMenu={() => setActiveTab('menu')}
            />
          )}

          {activeTab === 'admin' && (
            <div className="max-w-5xl mx-auto px-4 pt-4 min-w-0 w-full">
              {/* Admin Sub Navigation */}
              <div className="w-full max-w-full overflow-x-auto [overscroll-behavior-x:contain] no-scrollbar min-w-0 mb-4">
                <div className="flex items-center gap-2 bg-[var(--bg-card)] p-1.5 rounded-xl border border-[var(--border-card)] w-[max-content] min-w-max flex-nowrap shrink-0">
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('orders')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'orders'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4 shrink-0" /> Live Orders
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('kds')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'kds'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <ChefHat
                      className={`w-4 h-4 shrink-0 ${
                        adminSubTab === 'kds' ? 'text-[#D4AF37]' : 'text-[var(--text-accent)]'
                      }`}
                    />{' '}
                    Kitchen (KDS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('dispatch')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'dispatch'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <Truck
                      className={`w-4 h-4 shrink-0 ${
                        adminSubTab === 'dispatch' ? 'text-[#D4AF37]' : 'text-[var(--text-accent)]'
                      }`}
                    />{' '}
                    Rider Dispatch
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('catering')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'catering'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <CalendarDays
                      className={`w-4 h-4 shrink-0 ${
                        adminSubTab === 'catering' ? 'text-[#D4AF37]' : 'text-[var(--text-accent)]'
                      }`}
                    />{' '}
                    Events &amp; Invoices
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('estimator')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'estimator'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <Calculator
                      className={`w-4 h-4 shrink-0 ${
                        adminSubTab === 'estimator'
                          ? 'text-[#D4AF37]'
                          : 'text-[var(--text-accent)]'
                      }`}
                    />{' '}
                    Estimator Pricing
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('reconciliation')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'reconciliation'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <DollarSign
                      className={`w-4 h-4 shrink-0 ${
                        adminSubTab === 'reconciliation'
                          ? 'text-[#D4AF37]'
                          : 'text-[var(--text-money-positive)]'
                      }`}
                    />{' '}
                    Bank Reconciliation
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('security')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'security'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <ShieldCheck
                      className={`w-4 h-4 shrink-0 ${
                        adminSubTab === 'security' ? 'text-[#D4AF37]' : 'text-[var(--text-accent)]'
                      }`}
                    />{' '}
                    Security &amp; MFA
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('notifications')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'notifications'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <Bell
                      className={`w-4 h-4 shrink-0 ${
                        adminSubTab === 'notifications'
                          ? 'text-[#D4AF37]'
                          : 'text-[var(--text-accent)]'
                      }`}
                    />{' '}
                    Alerts Outbox
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('reports')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'reports'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <TrendingUp
                      className={`w-4 h-4 shrink-0 ${
                        adminSubTab === 'reports' ? 'text-[#D4AF37]' : 'text-[var(--text-accent)]'
                      }`}
                    />{' '}
                    Reports &amp; Promos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('menu')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'menu'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <UtensilsCrossed className="w-4 h-4 shrink-0" /> Menu Catalog &amp; CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('zones')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'zones'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <MapPin className="w-4 h-4 shrink-0" /> Delivery Zones
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminSubTab('content')}
                    className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                      adminSubTab === 'content'
                        ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                        : 'text-[var(--text-primary)] bg-[var(--bg-surface-muted)] hover:opacity-90'
                    }`}
                  >
                    <FileEdit className="w-4 h-4 shrink-0" /> Site Content CMS
                  </button>
                </div>
              </div>

              {adminSubTab === 'orders' && (
                <StaffOrderManager
                  currentUserRole={currentRole === 'visitor' ? 'staff' : currentRole}
                  currentUserId={`usr-${currentRole}-01`}
                />
              )}

              {adminSubTab === 'kds' && <KitchenDisplayDashboard />}

              {adminSubTab === 'dispatch' && <DispatchManagerDashboard />}

              {adminSubTab === 'catering' && (
                <StaffCateringManager
                  currentUserRole={currentRole === 'visitor' ? 'staff' : currentRole}
                  currentUserId={`usr-${currentRole}-01`}
                />
              )}

              {adminSubTab === 'estimator' && (
                <div className="bg-[var(--bg-card)] rounded-2xl p-4 text-[var(--text-primary)] border border-[var(--border-card)]">
                  <EstimatorAdminClient />
                </div>
              )}

              {adminSubTab === 'reconciliation' && (
                <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-card)]">
                  <ReconciliationManager />
                </div>
              )}

              {adminSubTab === 'security' && (
                <MfaSetupCard />
              )}

              {adminSubTab === 'notifications' && (
                <NotificationOutboxDashboard />
              )}

              {adminSubTab === 'reports' && (
                <PromotionsAndReportsManager />
              )}

              {adminSubTab === 'menu' && (
                <OwnerMenuEditor
                  currentUserRole={currentRole === 'visitor' ? 'owner' : currentRole}
                  currentUserId={`usr-${currentRole}-01`}
                />
              )}

              {adminSubTab === 'zones' && (
                <DeliveryZoneManager
                  currentUserRole={currentRole === 'visitor' ? 'owner' : currentRole}
                  hasMfaVerified={currentRole === 'owner'}
                />
              )}

              {adminSubTab === 'content' && (
                <SiteContentManager
                  currentUserRole={currentRole === 'visitor' ? 'owner' : currentRole}
                  hasMfaVerified={currentRole === 'owner'}
                />
              )}
            </div>
          )}
        </main>

        {/* Mobile Bottom Tab Bar (Phase 2C Section 30) */}
        <BottomTabBar
          activeTab={activeTab}
          onSelectTab={(tab) => setActiveTab(tab as any)}
          showAdmin={showAdmin}
        />
      </div>
    </CartProvider>
  );
}
