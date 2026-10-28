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
import { RucLogo } from './components/brand/RucLogo';
import { CartProvider } from './order/cartContext';
import { Order } from './types/order';
import { Home, UtensilsCrossed, Package, Settings2, ClipboardList, CalendarDays, Calculator, DollarSign, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'menu' | 'estimate' | 'track' | 'admin'>('home');
  const [adminSubTab, setAdminSubTab] = useState<'orders' | 'catering' | 'estimator' | 'reconciliation' | 'security' | 'menu'>('orders');
  const [currentRole, setCurrentRole] = useState<'owner' | 'staff' | 'developer'>('owner');
  const [trackedOrder, setTrackedOrder] = useState<Order | undefined>(undefined);

  const handleOrderPlaced = (order: Order) => {
    setTrackedOrder(order);
    setActiveTab('track');
  };

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex flex-col font-sans">
        {/* Top Application Header */}
        <header className="border-b border-[#D4AF37]/30 bg-[#17120F]/90 backdrop-blur sticky top-0 z-40 px-3 sm:px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
            {/* Brand Logo & Lockup */}
            <button
              onClick={() => setActiveTab('home')}
              className="flex items-center text-left hover:opacity-90 transition-opacity"
              aria-label="Return to Rock UC Foods Homepage"
            >
              <RucLogo size={42} showWordmark={true} />
            </button>

            {/* Navigation Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setActiveTab('home')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'home'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Home</span>
              </button>

              <button
                onClick={() => setActiveTab('menu')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'menu'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <UtensilsCrossed className="w-3.5 h-3.5" />
                <span>Menu</span>
              </button>

              <button
                onClick={() => setActiveTab('estimate')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'estimate'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <Calculator className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">Catering Estimator</span>
              </button>

              <button
                onClick={() => setActiveTab('track')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'track'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Track Order</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'admin'
                    ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 shadow'
                    : 'bg-black/30 text-[#F7EFD9]/60 hover:text-white'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Staff / Admin</span>
              </button>

              {/* Role Simulation Switcher for Testing */}
              <div className="hidden lg:flex items-center gap-1 pl-2 border-l border-white/10 text-xs">
                <span className="text-[10px] text-[#F7EFD9]/50">Simulate:</span>
                <select
                  value={currentRole}
                  onChange={(e) => setCurrentRole(e.target.value as 'owner' | 'staff' | 'developer')}
                  className="bg-[#0B0A09] border border-[#D4AF37]/40 text-[#D4AF37] rounded px-2 py-0.5 text-xs focus:outline-none"
                >
                  <option value="owner">Role: Owner</option>
                  <option value="staff">Role: Staff</option>
                  <option value="developer">Role: Developer</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1">
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
            <div className="max-w-5xl mx-auto px-4 pt-4">
              {/* Admin Sub Navigation */}
              <div className="flex items-center gap-2 mb-4 bg-[#17120F] p-1.5 rounded-xl border border-white/10 w-fit overflow-x-auto">
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

              {adminSubTab === 'orders' && (
                <StaffOrderManager
                  currentUserRole={currentRole}
                  currentUserId={`usr-${currentRole}-01`}
                />
              )}

              {adminSubTab === 'catering' && (
                <StaffCateringManager
                  currentUserRole={currentRole}
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

              {adminSubTab === 'menu' && (
                <OwnerMenuEditor
                  currentUserRole={currentRole}
                  currentUserId={`usr-${currentRole}-01`}
                />
              )}
            </div>
          )}
        </main>
      </div>
    </CartProvider>
  );
}
