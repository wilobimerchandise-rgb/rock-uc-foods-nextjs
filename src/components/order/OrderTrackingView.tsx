/**
 * ROCK UC FOODS - Order Tracking & Confirmation Screen
 * (Playbook v2 Section 8 & Section 17 v3 Addendum)
 * Visual status pipeline, itemized snapshot receipt, bank transfer details,
 * and direct WhatsApp payment confirmation integration.
 */

import React, { useState } from 'react';
import { Order, OrderStatus } from '../../types/order';
import { formatNaira } from '../../lib/money';
import { BUSINESS_CONTACT, ALLERGEN_NOTICE, PAYMENT_VERIFICATION_FRAUD_RULE } from '../../policy/content';
import { orderRepository } from '../../order/orderRepository';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Truck,
  PackageCheck,
  Copy,
  Check,
  Building2,
  MessageCircle,
  ArrowLeft,
  Search,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface OrderTrackingViewProps {
  initialOrder?: Order;
  onBackToMenu: () => void;
}

const STATUS_STEPS: { status: OrderStatus; label: string; icon: React.FC<{ className?: string }> }[] = [
  { status: 'pending_payment', label: 'Order Placed', icon: Clock },
  { status: 'payment_confirmed', label: 'Payment Verified', icon: CheckCircle2 },
  { status: 'in_kitchen', label: 'Chef Cooking', icon: ChefHat },
  { status: 'out_for_delivery', label: 'On The Way', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: PackageCheck },
];

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialOrder,
  onBackToMenu,
}) => {
  const [currentOrder, setCurrentOrder] = useState<Order | undefined>(initialOrder);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    if (!searchQuery.trim()) return;

    const found = orderRepository.getByCode(searchQuery);
    if (found) {
      setCurrentOrder(found);
    } else {
      setSearchError(`No order found matching '${searchQuery}'. Please check the order reference.`);
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'account') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedAccount(true);
        setTimeout(() => setCopiedAccount(false), 2000);
      }
    }
  };

  if (!currentOrder) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-[#F7EFD9]">
        <button
          onClick={onBackToMenu}
          className="flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Menu
        </button>

        <div className="bg-[#17120F] border border-[#D4AF37]/40 rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
          <Search className="w-10 h-10 text-[#D4AF37] mx-auto" />
          <h2 className="font-serif font-bold text-xl text-[#F7EFD9]">Track Your Order</h2>
          <p className="text-xs text-[#F7EFD9]/70 max-w-sm mx-auto">
            Enter your unique order reference code (e.g. <span className="font-mono text-[#D4AF37]">RUC-20261019-XXXX</span>) to check status.
          </p>

          <form onSubmit={handleSearch} className="flex gap-2 max-w-sm mx-auto">
            <input
              type="text"
              placeholder="RUC-YYYYMMDD-XXXX"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#0B0A09] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-[#F7EFD9] flex-1 focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              className="btn-luxury px-4 py-2 text-xs font-semibold rounded-lg shrink-0"
            >
              Track
            </button>
          </form>

          {searchError && (
            <p className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded border border-rose-800">
              {searchError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Calculate current step index
  const statusOrderIndex = ['pending_payment', 'payment_confirmed', 'in_kitchen', 'ready_for_dispatch', 'out_for_delivery', 'delivered'].indexOf(
    currentOrder.status
  );

  const whatsappMessage = encodeURIComponent(
    `Hello Chef Esther, I have placed Order ${currentOrder.orderCode} (${formatNaira(
      currentOrder.totalKobo
    )}) on Rock UC Foods. Kindly find my bank payment confirmation for verification.`
  );

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 text-[#F7EFD9] space-y-6">
      {/* Back button & top search switcher */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToMenu}
          className="flex items-center gap-1.5 text-xs text-[#D4AF37] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Menu
        </button>

        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search other code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-[#17120F] border border-white/10 rounded px-2.5 py-1 text-xs font-mono text-[#F7EFD9] focus:outline-none focus:border-[#D4AF37] w-36 sm:w-48"
          />
          <button type="submit" className="text-xs text-[#D4AF37] hover:text-white px-2 py-1">
            Find
          </button>
        </form>
      </div>

      {/* Main Order Card */}
      <div className="bg-[#17120F] border border-[#D4AF37]/50 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header & Status Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-[#D4AF37] font-semibold">
                Order Reference
              </span>
              <button
                onClick={() => copyToClipboard(currentOrder.orderCode, 'code')}
                className="text-white/40 hover:text-white p-1"
                aria-label="Copy order code"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <h1 className="text-xl sm:text-2xl font-mono font-bold text-[#F7EFD9] tracking-wider mt-0.5">
              {currentOrder.orderCode}
            </h1>
            <p className="text-[11px] text-white/50 mt-1">
              Placed on {new Date(currentOrder.createdAt).toLocaleDateString()} at{' '}
              {new Date(currentOrder.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="sm:text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                currentOrder.status === 'delivered'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                  : currentOrder.status === 'out_for_delivery'
                  ? 'bg-blue-950 text-blue-300 border border-blue-700'
                  : currentOrder.status === 'in_kitchen'
                  ? 'bg-purple-950 text-purple-300 border border-purple-700'
                  : currentOrder.status === 'payment_confirmed'
                  ? 'bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {currentOrder.status.replace(/_/g, ' ')}
            </span>
            <span className="block text-xs font-mono font-bold text-[#D4AF37] mt-1.5">
              Total: {formatNaira(currentOrder.totalKobo)}
            </span>
          </div>
        </div>

        {/* Visual Progress Stepper */}
        <div>
          <h3 className="text-xs uppercase font-serif font-bold text-[#D4AF37] mb-4">
            Live Fulfillment Pipeline
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {STATUS_STEPS.map((s, idx) => {
              const isPastOrCurrent = statusOrderIndex >= idx;
              const isCurrent = statusOrderIndex === idx;
              const IconComp = s.icon;
              return (
                <div
                  key={s.status}
                  className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                    isCurrent
                      ? 'bg-[#6B1230] border-[#D4AF37] text-white shadow-md'
                      : isPastOrCurrent
                      ? 'bg-[#0B0A09] border-emerald-700/60 text-emerald-400'
                      : 'bg-[#0B0A09]/40 border-white/5 text-white/30'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bank Transfer Instructions Box (Critical for manual payment flow) */}
        {currentOrder.status === 'pending_payment' && (
          <div className="p-4 sm:p-5 bg-[#0B0A09] border-2 border-[#D4AF37] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="font-serif font-bold text-sm text-[#F7EFD9]">
                  Step 2: Complete Manual Bank Transfer
                </h3>
              </div>
              <span className="text-[10px] text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-700 font-semibold">
                Action Required
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#17120F] p-3 rounded-lg border border-white/5">
              <div>
                <span className="text-white/50 block text-[11px]">Bank:</span>
                <span className="font-bold text-[#F7EFD9]">Wema Bank</span>
              </div>
              <div>
                <span className="text-white/50 block text-[11px]">Account Number:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#D4AF37] text-sm">0258778644</span>
                  <button
                    onClick={() => copyToClipboard('0258778644', 'account')}
                    className="text-white/40 hover:text-white p-0.5"
                    aria-label="Copy account number"
                  >
                    {copiedAccount ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-white/50 block text-[11px]">Account Name:</span>
                <span className="font-bold text-[#F7EFD9]">ROCK UC FOODS / ESTHER KWENTUA</span>
              </div>
              <div>
                <span className="text-white/50 block text-[11px]">Amount to Transfer:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatNaira(currentOrder.totalKobo)}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <a
                href={`https://wa.me/2348033729125?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Send Payment Proof on WhatsApp
              </a>
            </div>

            <p className="text-[10px] text-amber-200/80 italic flex items-start gap-1.5 pt-1">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{PAYMENT_VERIFICATION_FRAUD_RULE}</span>
            </p>
          </div>
        )}

        {/* Itemized Order Receipt (Snapshot Records) */}
        <div>
          <h3 className="text-xs uppercase font-serif font-bold text-[#D4AF37] mb-3">
            Itemized Snapshot Receipt
          </h3>
          <div className="bg-[#0B0A09] rounded-xl border border-white/5 p-4 space-y-2.5 text-xs">
            {currentOrder.items.map((item) => (
              <div key={item.id} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                <div>
                  <span className="font-medium text-[#F7EFD9]">{item.nameSnapshot}</span>
                  <p className="text-[11px] text-white/50">
                    {item.portionSnapshot ? `${item.portionSnapshot} • ` : ''}Qty: {item.quantity} &times; {formatNaira(item.unitPriceKoboSnapshot)}
                  </p>
                </div>
                <span className="font-mono font-bold text-[#F7EFD9]">
                  {formatNaira(item.totalKoboSnapshot)}
                </span>
              </div>
            ))}

            <div className="pt-3 border-t border-white/10 space-y-1 font-mono text-[11px]">
              <div className="flex justify-between text-white/70">
                <span>Food Subtotal:</span>
                <span>{formatNaira(currentOrder.subtotalKobo)}</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Delivery / Dispatch Fee:</span>
                <span>{formatNaira(currentOrder.deliveryFeeKobo)}</span>
              </div>
              <div className="pt-2 border-t border-white/10 flex justify-between font-bold text-sm text-[#D4AF37]">
                <span>Total Reconciled:</span>
                <span>{formatNaira(currentOrder.totalKobo)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Customer & Fulfillment Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#0B0A09] p-4 rounded-xl border border-white/5">
          <div>
            <span className="text-[#D4AF37] font-serif font-bold block mb-1">Customer Contact</span>
            <p className="text-[#F7EFD9]">{currentOrder.customerName}</p>
            <p className="font-mono text-white/70">{currentOrder.customerPhone}</p>
            {currentOrder.customerEmail && <p className="text-white/50">{currentOrder.customerEmail}</p>}
          </div>

          <div>
            <span className="text-[#D4AF37] font-serif font-bold block mb-1">Fulfillment Mode</span>
            <p className="text-[#F7EFD9] uppercase font-semibold text-[11px]">
              {currentOrder.deliveryType === 'collection' ? 'Self Collection' : 'Doorstep Delivery'}
            </p>
            <p className="text-white/70 text-[11px]">
              {currentOrder.deliveryType === 'collection'
                ? BUSINESS_CONTACT.collectionAddress
                : currentOrder.deliveryAddress}
            </p>
            {currentOrder.specialInstructions && (
              <p className="text-amber-200/80 italic text-[11px] mt-1">
                Note: {currentOrder.specialInstructions}
              </p>
            )}
          </div>
        </div>

        {/* Allergen Reminder Footer */}
        <div className="p-3 bg-[#0B0A09] border border-white/5 rounded-lg text-[10px] text-white/60 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
          <span>{ALLERGEN_NOTICE}</span>
        </div>
      </div>
    </div>
  );
};
