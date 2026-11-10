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
import { RucLogo } from './components/brand/RucLogo';
import { BottomTabBar } from './components/navigation/BottomTabBar';
import { CartProvider } from './order/cartContext';
import { Order } from './types/order';
import { Home, UtensilsCrossed, Package, Settings2, ClipboardList, CalendarDays, Calculator, DollarSign, ShieldCheck, Bell, ChefHat, Truck, TrendingUp } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'estimate' | 'track' | 'admin'>('home');
  const [adminSubTab, setAdminSubTab] = useState<'orders' | 'kds' | 'dispatch' | 'catering' | 'estimator' | 'reconciliation' | 'security' | 'notifications' | 'reports' | 'menu'>('orders');
  const [currentRole, setCurrentRole] = useState<'owner' | 'staff' | 'developer' | 'visitor'>('owner');
  const [trackedOrder, setTrackedOrder] = useState<Order | undefined>(undefined);

  const showAdmin = currentRole === 'owner' || currentRole === 'staff' || currentRole === 'developer';

  const handleOrderPlaced = (order: Order) => {
    setTrackedOrder(order);
    setActiveTab('track');
  };

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex flex-col font-sans min-w-0 w-full max-w-full">
        {/* Top Application Header */}
        <header className="border-b border-[#D4AF37]/30 bg-[#17120F]/90 backdrop-blur sticky top-0 z-40 px-3 sm:px-4 h-16 max-h-16 flex items-center w-full max-w-full min-w-0 overflow-hidden">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 min-w-0 w-full">
            {/* Brand Logo & Lockup */}
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center text-left hover:opacity-90 transition-opacity shrink-0"
              aria-label="Return to Rock UC Foods Homepage"
            >
              <RucLogo size={40} showWordmark={true} />
            </button>

            {/* Desktop Navigation Controls (768px and up) - No navigation buttons on phones */}
            <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setActiveTab('home')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 min-h-[44px] transition-all ${
                  activeTab === 'home'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Home</span>
              </button>

              <button
                onClick={() => setActiveTab('menu')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 min-h-[44px] transition-all ${
                  activeTab === 'menu'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>Menu</span>
              </button>

              <button
                onClick={() => setActiveTab('estimate')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 min-h-[44px] transition-all ${
                  activeTab === 'estimate'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <Calculator className="w-4 h-4 text-[#D4AF37]" />
                <span>Catering Estimator</span>
              </button>

              <button
                onClick={() => setActiveTab('track')}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 min-h-[44px] transition-all ${
                  activeTab === 'track'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Track Order</span>
              </button>

              {/* Admin Link: Rendered ONLY when signed in as owner, staff or developer */}
              {showAdmin && (
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 min-h-[44px] transition-all ${
                    activeTab === 'admin'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                      : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                  }`}
                >
                  <Settings2 className="w-4 h-4" />
                  <span>Staff / Admin</span>
                </button>
              )}

              {/* Role Simulation Switcher for Testing */}
              <div className="flex items-center gap-1 pl-2 border-l border-white/10 text-xs">
                <span className="text-[10px] text-[#F7EFD9]/50">Simulate:</span>
                <select
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value as any)}
                  className="bg-[#0B0A09] border border-[#D4AF37]/40 text-[#D4AF37] rounded px-2 py-0.5 text-xs focus:outline-none"
                >
                  <option value="owner">Role: Owner</option>
                  <option value="staff">Role: Staff</option>
                  <option value="developer">Role: Developer</option>
                  <option value="visitor">Role: Visitor (Signed Out)</option>
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
            <div className="bg-[#FDFBF7] text-[#0B0A09]">
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
                <div className="flex items-center gap-2 bg-[#17120F] p-1.5 rounded-xl border border-white/10 w-[max-content] min-w-max flex-nowrap shrink-0">
                <button
                  onClick={() => setAdminSubTab('orders')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'orders'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" /> Live Orders
                </button>
                <button
                  onClick={() => setAdminSubTab('kds')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'kds'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <ChefHat className="w-3.5 h-3.5 text-[#D4AF37]" /> Kitchen (KDS)
                </button>
                <button
                  onClick={() => setAdminSubTab('dispatch')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'dispatch'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Truck className="w-3.5 h-3.5 text-[#D4AF37]" /> Rider Dispatch
                </button>
                <button
                  onClick={() => setAdminSubTab('catering')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'catering'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5 text-[#D4AF37]" /> Events &amp; Invoices
                </button>
                <button
                  onClick={() => setAdminSubTab('estimator')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'estimator'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5 text-[#D4AF37]" /> Estimator Pricing
                </button>
                <button
                  onClick={() => setAdminSubTab('reconciliation')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'reconciliation'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Bank Reconciliation
                </button>
                <button
                  onClick={() => setAdminSubTab('security')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'security'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" /> Security &amp; MFA
                </button>
                <button
                  onClick={() => setAdminSubTab('notifications')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'notifications'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5 text-[#D4AF37]" /> Alerts Outbox
                </button>
                <button
                  onClick={() => setAdminSubTab('reports')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'reports'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" /> Reports &amp; Promos
                </button>
                <button
                  onClick={() => setAdminSubTab('menu')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
                    adminSubTab === 'menu'
                      ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <UtensilsCrossed className="w-3.5 h-3.5" /> Menu Catalog &amp; CSV
                </button>
              </div>
            </div>

              {adminSubTab === 'orders' && (
                <StaffOrderManager
                  currentUserRole={currentRole === 'visitor' ? 'staff' : currentRole}
                  currentUserId={`usr-${currentRole}-01`}
                />
              )}

              {adminSubTab === 'kds' && (
                <KitchenDisplayDashboard />
              )}

              {adminSubTab === 'dispatch' && (
                <DispatchManagerDashboard />
              )}

              {adminSubTab === 'catering' && (
                <StaffCateringManager
                  currentUserRole={currentRole === 'visitor' ? 'staff' : currentRole}
                  currentUserId={`usr-${currentRole}-01`}
                />
              )}

              {adminSubTab === 'estimator' && (
                <div className="bg-white rounded-2xl p-4 text-[#0B0A09] border border-white/20">
                  <EstimatorAdminClient />
                </div>
              )}

              {adminSubTab === 'reconciliation' && (
                <div className="bg-[#17120F]/90 rounded-2xl p-4 border border-white/10">
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
