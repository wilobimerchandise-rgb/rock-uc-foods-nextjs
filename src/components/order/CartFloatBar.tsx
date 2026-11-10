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
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-[#17120F]/95 backdrop-blur-md border border-[#D4AF37]/50 rounded-2xl p-3.5 sm:p-4 shadow-2xl flex items-center justify-between gap-4 text-[#F7EFD9]">
        <button
          type="button"
          onClick={() => setIsCartOpen(true)}
          className="flex items-center gap-3 text-left cursor-pointer group focus:outline-none"
        >
          <div className="relative w-10 h-10 rounded-xl bg-[#6B1230] border border-[#D4AF37]/50 flex items-center justify-center text-[#D4AF37] group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5" />
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#D4AF37] text-[#0B0A09] font-bold text-[11px] flex items-center justify-center">
              {totalItemsCount}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-[#F7EFD9]/60 block font-semibold">
              Current Order
            </span>
            <span className="font-sans font-bold text-base text-[#D4AF37]">
              {formatMoneyKobo(subtotalKobo)}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="hidden sm:inline-flex px-3 py-2 rounded-xl border border-[#D4AF37]/30 hover:border-[#D4AF37] text-xs font-semibold text-[#F7EFD9] hover:bg-[#241A14] transition-colors cursor-pointer"
          >
            View Cart
          </button>
          <Link
            href="/checkout"
            className="bg-gradient-to-r from-[#D4AF37] to-[#B08D26] hover:from-[#E5C158] hover:to-[#D4AF37] text-[#0B0A09] font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Checkout</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
