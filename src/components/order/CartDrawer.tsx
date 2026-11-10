'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '../../order/cartContext';
import { formatMoneyKobo } from '../../lib/money';
import { ALLERGEN_NOTICE } from '../../policy/content';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, AlertTriangle } from 'lucide-react';

export function CartDrawer() {
  const {
    items,
    totalItemsCount,
    subtotalKobo,
    removeItem,
    updateQuantity,
    clearCart,
    isCartOpen,
    setIsCartOpen,
  } = useCart();

  if (!isCartOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Your Order Cart"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="fixed inset-0 bg-[#0B0A09]/80 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer panel */}
      <div className="relative w-full max-w-md bg-[#17120F] text-[#F7EFD9] border-l border-[#D4AF37]/30 shadow-2xl flex flex-col h-full z-10">
        {/* Header */}
        <div className="p-5 border-b border-[#D4AF37]/20 flex items-center justify-between bg-gradient-to-r from-[#241A14] to-[#17120F]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#F7EFD9]">Your Order</h2>
              <p className="text-xs text-[#D4AF37]">
                {totalItemsCount} {totalItemsCount === 1 ? 'dish' : 'dishes'} selected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-[#F7EFD9]/60 hover:text-[#FF8585] transition-colors px-2 py-1 cursor-pointer"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCartOpen(false)}
              aria-label="Close cart drawer"
              className="w-8 h-8 rounded-full bg-[#0B0A09] border border-[#D4AF37]/30 text-[#D4AF37] hover:border-[#D4AF37] flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#0B0A09] border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]/40">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-[#F7EFD9]">Your cart is empty</h3>
              <p className="text-xs text-[#F7EFD9]/60 max-w-xs">
                Explore our signature party jollof, slow-simmered soups, and sides to start your order.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.key}
                className="p-3.5 rounded-xl bg-[#0B0A09]/70 border border-[#D4AF37]/20 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-serif font-bold text-sm text-[#F7EFD9] truncate">
                      {item.name}
                    </h4>
                    <span className="font-mono font-bold text-xs text-[#D4AF37] shrink-0">
                      {formatMoneyKobo(item.itemTotalKobo)}
                    </span>
                  </div>

                  {/* Size tier pill */}
                  {item.selectedTierName && (
                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 mr-1.5">
                      Size: {item.selectedTierName}
                    </span>
                  )}

                  {/* Options */}
                  {item.selectedOptionNames && item.selectedOptionNames.length > 0 && (
                    <p className="text-[11px] text-[#F7EFD9]/70 italic truncate">
                      + {item.selectedOptionNames.join(', ')}
                    </p>
                  )}

                  {/* Stepper & remove */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 bg-[#17120F] border border-[#D4AF37]/30 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-[#0B0A09] text-[#D4AF37] hover:bg-[#241A14] flex items-center justify-center cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="font-mono text-xs font-bold text-[#F7EFD9] w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="w-6 h-6 rounded bg-[#0B0A09] text-[#D4AF37] hover:bg-[#241A14] flex items-center justify-center cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label="Remove item"
                      className="text-[#F7EFD9]/40 hover:text-[#FF8585] transition-colors p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Allergen reminder */}
          {items.length > 0 && (
            <div className="p-3 rounded-lg bg-[#0B0A09]/60 border border-[#D4AF37]/20 flex items-start gap-2 text-[11px] text-[#F7EFD9]/70 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
              <span>{ALLERGEN_NOTICE}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 bg-[#0B0A09] border-t border-[#D4AF37]/20 space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#F7EFD9]/60 block font-medium">
                  Subtotal
                </span>
                <span className="text-[11px] text-[#F7EFD9]/45">Delivery calculated at checkout</span>
              </div>
              <span className="font-sans font-bold text-xl text-[#D4AF37]">
                {formatMoneyKobo(subtotalKobo)}
              </span>
            </div>

            <Link
              href="/checkout"
              onClick={() => setIsCartOpen(false)}
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B08D26] hover:from-[#E5C158] hover:to-[#D4AF37] text-[#0B0A09] font-bold text-sm py-3 px-5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-center"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
