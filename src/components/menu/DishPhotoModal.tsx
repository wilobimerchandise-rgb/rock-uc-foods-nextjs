'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { FormattedMenuItem } from '../../menu/read-model';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * ROCK UC FOODS - Phase 2B Native Accessible Photo Viewer
 * Playbook v9 Section 26.1 Item 5 & Section 35
 */

export interface DishPhotoModalProps {
  isOpen: boolean;
  activeDish: FormattedMenuItem | null;
  allDishes: FormattedMenuItem[];
  onClose: () => void;
  onNavigate: (dish: FormattedMenuItem) => void;
  triggerElement?: HTMLElement | null;
}

function getMonogram(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function DishPhotoModal({
  isOpen,
  activeDish,
  allDishes,
  onClose,
  onNavigate,
  triggerElement,
}: DishPhotoModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (triggerElement) {
      lastTriggerRef.current = triggerElement;
    }
  }, [triggerElement]);

  const currentIndex = activeDish ? allDishes.findIndex((d) => d.id === activeDish.id) : -1;
  const total = allDishes.length;

  const handlePrev = useCallback(() => {
    if (total <= 1 || currentIndex === -1) return;
    const nextIdx = (currentIndex - 1 + total) % total;
    onNavigate(allDishes[nextIdx]);
  }, [currentIndex, total, allDishes, onNavigate]);

  const handleNext = useCallback(() => {
    if (total <= 1 || currentIndex === -1) return;
    const nextIdx = (currentIndex + 1) % total;
    onNavigate(allDishes[nextIdx]);
  }, [currentIndex, total, allDishes, onNavigate]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && activeDish) {
      if (typeof dialog.showModal === 'function' && !dialog.open) {
        dialog.showModal();
      }
      document.body.style.overflow = 'hidden';
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
      if (lastTriggerRef.current && typeof lastTriggerRef.current.focus === 'function') {
        lastTriggerRef.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, activeDish]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleNext();
    }
  };

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartXRef.current;
    touchStartXRef.current = null;

    if (deltaX > 50) {
      handlePrev();
    } else if (deltaX < -50) {
      handleNext();
    }
  };

  if (!isOpen || !activeDish) {
    return null;
  }

  const monogram = getMonogram(activeDish.name);
  const displayPrice =
    activeDish.formattedBasePrice ||
    (activeDish.sizeTiers.length > 0
      ? `From ${activeDish.sizeTiers[0].formattedPrice}`
      : '');

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dish-viewer-title"
      aria-modal="true"
      onKeyDown={handleKeyDown}
      onClick={handleDialogClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      data-testid="dish-photo-modal"
      className="backdrop:bg-black/85 bg-transparent p-4 sm:p-6 max-w-lg w-full fixed inset-0 m-auto focus:outline-none z-50 overflow-visible"
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-2xl p-5 sm:p-6 text-[var(--text-primary)] shadow-2xl relative space-y-4">
        {/* Top Header Controls: Counter & Close */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-card)] pb-3">
          <span className="text-sm font-semibold text-[var(--text-accent)] tracking-wider uppercase">
            Dish {currentIndex + 1} of {total}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close photo viewer"
            className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-gold)] hover:opacity-90 text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Enlarged Photo or Tinted Monogram Tile */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#17120F] border border-[var(--border-card)] flex items-center justify-center">
          {activeDish.photoUrl ? (
            <img
              src={activeDish.photoUrl}
              alt={`Enlarged view of ${activeDish.name}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1E1612] via-[#2A1D16] to-[#0B0A09] text-[#D4AF37] select-none p-6 text-center">
              <span className="font-serif font-bold text-6xl tracking-widest text-[#D4AF37]">
                {monogram}
              </span>
              <span className="text-sm uppercase tracking-widest text-[#F7EFD9] mt-2 font-medium">
                Photo Coming Soon
              </span>
            </div>
          )}

          {/* Navigation Arrows */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous dish"
                className="min-w-[44px] min-h-[44px] absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-[#17120F]/90 border border-[#D4AF37] text-[#F7EFD9] hover:bg-[#6B1230] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-md"
              >
                <ChevronLeft className="w-5 h-5 text-[#D4AF37]" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next dish"
                className="min-w-[44px] min-h-[44px] absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[#17120F]/90 border border-[#D4AF37] text-[#F7EFD9] hover:bg-[#6B1230] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] flex items-center justify-center transition-all cursor-pointer shadow-md"
              >
                <ChevronRight className="w-5 h-5 text-[#D4AF37]" />
              </button>
            </>
          )}
        </div>

        {/* Details: Name, Price, Ingredients */}
        <div className="space-y-2 pt-1">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2
              id="dish-viewer-title"
              className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight"
            >
              {activeDish.name}
            </h2>
            {displayPrice && (
              <span className="font-sans price-tabular font-bold text-lg text-[var(--text-accent)] shrink-0 whitespace-nowrap">
                {displayPrice}
              </span>
            )}
          </div>

          {activeDish.description && (
            <p className="uppercase text-sm tracking-wide text-[var(--text-accent)] leading-relaxed font-medium">
              {activeDish.description}
            </p>
          )}

          {activeDish.availabilityNote && (
            <p className="text-sm text-[var(--text-body-muted)] italic">
              {activeDish.availabilityNote}
            </p>
          )}
        </div>

        {/* Bottom Nav Buttons for Mobile Accessibility */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border-card)] sm:hidden">
          <button
            type="button"
            onClick={handlePrev}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-gold)] text-sm font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 text-[var(--icon-on-surface)]" />
            <span>Previous</span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 min-h-[44px] py-2.5 px-3 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-gold)] text-sm font-semibold text-[var(--text-primary)] flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4 text-[var(--icon-on-surface)]" />
          </button>
        </div>
      </div>
    </dialog>
  );
}
