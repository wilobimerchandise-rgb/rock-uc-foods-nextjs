'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '../../order/cartContext';
import { formatMoneyKobo } from '../../lib/money';
import { ShoppingBag, ArrowRight } from 'lucide-react';

export function CartFloatBar() {
  const { totalItemsCount, subtotalKobo, setIsCartOpen } = useCart();

  if (totalItemsCount <= 0) return null;

  return (
    <aside
      aria-label="Active order summary"
      className="fixed bottom-4 left-4 right-20 sm:left-6 sm:right-auto sm:bottom-5 sm:max-w-md z-40"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-3 sm:p-4 shadow-2xl flex items-center justify-between gap-3 text-[var(--text-primary)]">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="min-h-[44px] min-w-[44px] flex items-center gap-3 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-xl pr-2"
        >
          <div className="relative w-11 h-11 rounded-xl bg-[var(--cta-wine-bg)] border border-[var(--border-gold)] flex items-center justify-center text-[var(--icon-on-wine)] group-hover:scale-105 transition-transform shrink-0">
            <ShoppingBag className="w-5 h-5" />
            <span className="px-1.5 py-0.5 rounded-md bg-[var(--cta-gold-bg)] text-[var(--cta-gold-text)] font-bold text-sm leading-none ml-1 sr-only">
              {totalItemsCount} items
            </span>
          </div>

          <div className="min-w-0">
            <span className="text-sm text-[var(--text-body-muted)] block font-medium whitespace-nowrap">
              {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
            </span>
            <span className="font-sans price-tabular font-bold text-base text-[var(--text-accent)] whitespace-nowrap">
              {formatMoneyKobo(subtotalKobo)}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="hidden sm:inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl border border-[var(--border-gold)] bg-[var(--bg-surface-muted)] text-sm font-semibold text-[var(--text-primary)] hover:opacity-90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            View Cart
          </button>
          <Link
            href="/checkout"
            className="min-h-[44px] min-w-[44px] bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-text)] font-bold text-sm py-2.5 px-4 rounded-xl shadow-md transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <span>Checkout</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
