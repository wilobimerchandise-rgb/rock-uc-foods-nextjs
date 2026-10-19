/**
 * ROCK UC FOODS - Client Cart State & Dispatcher
 * (Playbook v2 Section 7.D & 8)
 * Recalculates subtotal in BigInt kobo dynamically from published menu repository.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { menuRepository } from '../menu/data';

interface CartContextType {
  cart: Record<string, number>; // menuItemId -> quantity
  addItem: (menuItemId: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItemsCount: number;
  subtotalKobo: bigint;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY = 'rock_uc_cart_items_v1';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch {
        // fallback to empty cart
      }
    }
    return {};
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch {
        // ignore
      }
    }
  }, [cart]);

  const addItem = (menuItemId: string) => {
    setCart((prev) => {
      const current = prev[menuItemId] || 0;
      return { ...prev, [menuItemId]: current + 1 };
    });
  };

  const removeItem = (menuItemId: string) => {
    setCart((prev) => {
      const next = { ...prev };
      delete next[menuItemId];
      return next;
    });
  };

  const updateQuantity = (menuItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }
    setCart((prev) => ({
      ...prev,
      [menuItemId]: Math.min(quantity, 100),
    }));
  };

  const clearCart = () => setCart({});

  const totalItemsCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  // Compute live subtotal using authoritative menu prices
  let subtotalKobo = 0n;
  for (const [id, qty] of Object.entries(cart)) {
    const item = menuRepository.getItemById(id);
    if (item && item.status === 'published' && item.isAvailable) {
      subtotalKobo += item.priceKobo * BigInt(qty);
    }
  }

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItemsCount,
        subtotalKobo,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
