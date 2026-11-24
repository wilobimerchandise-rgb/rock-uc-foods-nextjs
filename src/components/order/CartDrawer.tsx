'use client';

import React, { useEffect } from 'react';
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

  useEffect(() => {
    if (!isCartOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCartOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCartOpen, setIsCartOpen]);

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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer panel */}
      <div className="relative w-full max-w-md bg-[var(--bg-card)] text-[var(--text-primary)] border-l border-[var(--border-gold)] shadow-2xl flex flex-col h-full z-10">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-card)] flex items-center justify-between gap-2 bg-[var(--bg-surface-muted)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[var(--cta-wine-bg)] border border-[var(--border-gold)] flex items-center justify-center text-[var(--icon-on-wine)] shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-lg font-bold text-[var(--text-primary)]">Your Order</h2>
              <p className="text-sm text-[var(--text-accent)] font-medium">
                {totalItemsCount} {totalItemsCount === 1 ? 'dish' : 'dishes'} selected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="min-h-[44px] min-w-[44px] text-sm font-medium text-[var(--text-body-muted)] hover:text-[var(--text-accent)] transition-colors px-3 py-2 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCartOpen(false)}
              aria-label="Close cart drawer"
              className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-primary)] border border-[var(--border-gold)] text-[var(--text-accent)] hover:opacity-90 flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-[var(--bg-primary)] border border-[var(--border-card)] flex items-center justify-center text-[var(--text-accent)]">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="font-serif text-lg font-semibold text-[var(--text-primary)]">
                Your cart is empty
              </h3>
              <p className="text-sm text-[var(--text-body-muted)] max-w-xs">
                Explore our signature party jollof, slow-simmered soups, and sides to start your
                order.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.key}
                className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-card)] flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="font-serif font-bold text-base text-[var(--text-primary)] truncate">
                      {item.name}
                    </h4>
                    <span className="font-mono price-tabular font-bold text-sm text-[var(--text-accent)] shrink-0 whitespace-nowrap">
                      {formatMoneyKobo(item.itemTotalKobo)}
                    </span>
                  </div>

                  {item.selectedTierName && (
                    <p className="text-sm font-semibold text-[var(--text-accent)]">
                      Size: {item.selectedTierName}
                    </p>
                  )}

                  {item.selectedOptionNames && item.selectedOptionNames.length > 0 && (
                    <p className="text-sm text-[var(--text-body-muted)] italic truncate">
                      + {item.selectedOptionNames.join(', ')}
                    </p>
                  )}

                  {/* Stepper & remove */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-surface-muted)] text-[var(--text-accent)] hover:opacity-90 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-mono price-tabular text-sm font-bold text-[var(--text-primary)] min-w-[2rem] text-center">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-surface-muted)] text-[var(--text-accent)] hover:opacity-90 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label={`Remove ${item.name} from cart`}
                      className="min-w-[44px] min-h-[44px] text-[var(--text-body-muted)] hover:text-[var(--text-error)] transition-colors rounded-lg flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
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
            <div className="p-3.5 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-card)] flex items-start gap-2.5 text-sm text-[var(--text-body-muted)] leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0 mt-1" />
              <span>{ALLERGEN_NOTICE}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 bg-[var(--bg-surface-muted)] border-t border-[var(--border-card)] space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-sm uppercase tracking-wider text-[var(--text-primary)] block font-semibold">
                  Subtotal
                </span>
                <span className="text-sm text-[var(--text-body-muted)]">
                  Delivery calculated at checkout
                </span>
              </div>
              <span className="font-sans price-tabular font-bold text-xl text-[var(--text-accent)] whitespace-nowrap">
                {formatMoneyKobo(subtotalKobo)}
              </span>
            </div>

            <Link
              href="/checkout"
              onClick={() => setIsCartOpen(false)}
              className="w-full min-h-[48px] bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-text)] font-bold text-base py-3 px-5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
