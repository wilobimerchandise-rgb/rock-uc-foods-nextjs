/**
 * ROCK UC FOODS - Client Cart State & Dispatcher
 * (Playbook v2 Section 7.D, 8 & Section 26 Phase 2B/3)
 * Recalculates subtotal in BigInt kobo dynamically from authoritative menu repository.
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { menuRepository } from '../menu/data';
import { getOrderablePrice } from '../menu/pricing';

export interface CartItem {
  key: string;
  menuItemId: string;
  name: string;
  portionLabel?: string;
  quantity: number;
  selectedTierId?: string;
  selectedTierName?: string;
  selectedOptionIds?: string[];
  selectedOptionNames?: string[];
  unitPriceKobo: bigint;
  itemTotalKobo: bigint;
}

export interface AddItemInput {
  menuItemId: string;
  quantity?: number;
  selectedTierId?: string;
  selectedOptionIds?: string[];
}

interface StoredCartEntry {
  key: string;
  menuItemId: string;
  quantity: number;
  selectedTierId?: string;
  selectedOptionIds?: string[];
}

interface CartContextType {
  cart: Record<string, number>; // Legacy map: menuItemId -> total quantity
  items: CartItem[]; // Rich item list with options and tiers
  addItem: (input: string | AddItemInput) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  clearCart: () => void;
  totalItemsCount: number;
  subtotalKobo: bigint;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | null>(null);

const CART_STORAGE_KEY_V2 = 'rock_uc_cart_items_v2';

function makeCartKey(menuItemId: string, selectedTierId?: string, selectedOptionIds?: string[]): string {
  const sortedOptions = (selectedOptionIds || []).slice().sort().join(',');
  return `${menuItemId}:${selectedTierId || 'def'}:${sortedOptions}`;
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<StoredCartEntry[]>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY_V2);
        if (raw) return JSON.parse(raw);
      } catch {
        // fallback to empty
      }
    }
    return [];
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(CART_STORAGE_KEY_V2, JSON.stringify(entries));
      } catch {
        // ignore storage errors
      }
    }
  }, [entries]);

  const addItem = (input: string | AddItemInput) => {
    const payload: AddItemInput = typeof input === 'string' ? { menuItemId: input, quantity: 1 } : input;
    const qtyToAdd = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;
    const key = makeCartKey(payload.menuItemId, payload.selectedTierId, payload.selectedOptionIds);

    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(next[idx].quantity + qtyToAdd, 100) };
        return next;
      }
      return [
        ...prev,
        {
          key,
          menuItemId: payload.menuItemId,
          quantity: Math.min(qtyToAdd, 100),
          selectedTierId: payload.selectedTierId,
          selectedOptionIds: payload.selectedOptionIds,
        },
      ];
    });
  };

  const removeItem = (cartKey: string) => {
    setEntries((prev) => prev.filter((e) => e.key !== cartKey && e.menuItemId !== cartKey));
  };

  const updateQuantity = (cartKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartKey);
      return;
    }
    setEntries((prev) =>
      prev.map((e) => {
        if (e.key === cartKey || e.menuItemId === cartKey) {
          return { ...e, quantity: Math.min(quantity, 100) };
        }
        return e;
      })
    );
  };

  const clearCart = () => setEntries([]);

  // Derive enriched items with authoritative prices
  const { richItems, subtotalKobo, legacyCartMap } = useMemo(() => {
    const list: CartItem[] = [];
    let subtotal = 0n;
    const legacyMap: Record<string, number> = {};

    for (const entry of entries) {
      const menuItem = menuRepository.getItemById(entry.menuItemId);
      if (!menuItem || menuItem.status !== 'published' || !menuItem.isAvailable) {
        continue;
      }

      try {
        const priced = getOrderablePrice(
          entry.menuItemId,
          entry.selectedOptionIds || [],
          entry.selectedTierId
        );

        const unitPrice = priced.totalUnitKobo;
        const itemTotal = unitPrice * BigInt(entry.quantity);
        subtotal += itemTotal;

        const optNames = (priced.optionSnapshots || []).map((o) => o.name);

        list.push({
          key: entry.key,
          menuItemId: entry.menuItemId,
          name: menuItem.name,
          portionLabel: menuItem.portionLabel,
          quantity: entry.quantity,
          selectedTierId: entry.selectedTierId,
          selectedTierName: priced.tierName,
          selectedOptionIds: entry.selectedOptionIds,
          selectedOptionNames: optNames,
          unitPriceKobo: unitPrice,
          itemTotalKobo: itemTotal,
        });

        legacyMap[entry.menuItemId] = (legacyMap[entry.menuItemId] || 0) + entry.quantity;
      } catch {
        // Suppress unpriceable or invalid options
      }
    }

    return { richItems: list, subtotalKobo: subtotal, legacyCartMap: legacyMap };
  }, [entries]);

  const totalItemsCount = richItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart: legacyCartMap,
        items: richItems,
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
    return {
      cart: {},
      items: [],
      addItem: () => {},
      removeItem: () => {},
      updateQuantity: () => {},
      clearCart: () => {},
      totalItemsCount: 0,
      subtotalKobo: 0n,
      isCartOpen: false,
      setIsCartOpen: () => {},
    };
  }
  return context;
}
