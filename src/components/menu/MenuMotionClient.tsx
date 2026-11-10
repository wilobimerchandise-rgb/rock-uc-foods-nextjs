'use client';

import React, { useEffect, useState } from 'react';
import { FormattedMenuItem } from '../../menu/read-model';
import { DishCard } from './DishCard';
import { DishPhotoModal } from './DishPhotoModal';
import { MenuMotionStyles } from './MenuMotionStyles';
import { DishCustomizerModal } from '../order/DishCustomizerModal';
import { CartDrawer } from '../order/CartDrawer';
import { CartFloatBar } from '../order/CartFloatBar';
import { useCart } from '../../order/cartContext';

/**
 * ROCK UC FOODS - Phase 2B/3 Progressive Motion & Ordering Client
 * Playbook v9 Section 26.1 & Section 8
 */

export interface MenuMotionClientProps {
  items: FormattedMenuItem[];
  whatsappPhone?: string;
}

export function MenuMotionClient({ items, whatsappPhone }: MenuMotionClientProps) {
  const [activeDish, setActiveDish] = useState<FormattedMenuItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [triggerEl, setTriggerEl] = useState<HTMLElement | null>(null);

  // Ordering customizer modal state
  const [customizingDish, setCustomizingDish] = useState<FormattedMenuItem | null>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [customizerTriggerEl, setCustomizerTriggerEl] = useState<HTMLElement | null>(null);

  const { addItem, setIsCartOpen } = useCart();

  useEffect(() => {
    // Check if browser supports IntersectionObserver and user does NOT prefer reduced motion
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return;
    }

    const cards = document.querySelectorAll<HTMLElement>('.dish-card');
    const viewportThreshold = window.innerHeight * 0.9;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.classList.remove('dish-card-motion-init');
            el.classList.add('dish-card-motion-play');
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15 }
    );

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      if (rect.top > viewportThreshold) {
        // Below the fold: set initial hidden state and observe
        card.classList.add('dish-card-motion-init');
        observer.observe(card);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [items]);

  const handleEnlargePhoto = (dish: FormattedMenuItem) => {
    const activeEl = document.activeElement as HTMLElement | null;
    setTriggerEl(activeEl);
    setActiveDish(dish);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setActiveDish(null);
  };

  const handleOrderDish = (dish: FormattedMenuItem, el: HTMLElement) => {
    const hasOptionsOrTiers =
      (dish.optionGroups && dish.optionGroups.length > 0) ||
      (dish.sizeTiers && dish.sizeTiers.length > 0);

    if (hasOptionsOrTiers) {
      setCustomizerTriggerEl(el);
      setCustomizingDish(dish);
      setIsCustomizerOpen(true);
    } else {
      addItem({ menuItemId: dish.id, quantity: 1 });
      setIsCartOpen(true);
    }
  };

  return (
    <>
      <MenuMotionStyles />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {items.map((item, index) => (
          <DishCard
            key={item.id}
            item={item}
            isFirstScreen={index < 4}
            whatsappPhone={whatsappPhone}
            onEnlargePhoto={handleEnlargePhoto}
            onOrder={handleOrderDish}
          />
        ))}
      </div>

      {/* Accessible Photo Modal */}
      <DishPhotoModal
        isOpen={isModalOpen}
        activeDish={activeDish}
        allDishes={items}
        onClose={handleCloseModal}
        onNavigate={setActiveDish}
        triggerElement={triggerEl}
      />

      {/* Interactive Dish Customizer Modal */}
      <DishCustomizerModal
        isOpen={isCustomizerOpen}
        dish={customizingDish}
        onClose={() => setIsCustomizerOpen(false)}
        triggerElement={customizerTriggerEl}
      />

      {/* Cart Drawer */}
      <CartDrawer />

      {/* Floating Bottom Cart Bar */}
      <CartFloatBar />
    </>
  );
}
