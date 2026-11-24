'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FormattedMenuItem } from '../../menu/read-model';
import { useCart } from '../../order/cartContext';
import { formatMoneyKobo } from '../../lib/money';
import { X, Plus, Minus, ShoppingBag, Check } from 'lucide-react';

export interface DishCustomizerModalProps {
  isOpen: boolean;
  dish: FormattedMenuItem | null;
  onClose: () => void;
  triggerElement?: HTMLElement | null;
}

function getInitialTierId(dish: FormattedMenuItem | null): string {
  if (dish?.sizeTiers && dish.sizeTiers.length > 0) {
    const firstActive = dish.sizeTiers.find((t) => t.active) || dish.sizeTiers[0];
    return firstActive ? firstActive.id : '';
  }
  return '';
}

function getInitialOptionIds(dish: FormattedMenuItem | null): string[] {
  const defaultOpts: string[] = [];
  if (dish?.optionGroups && dish.optionGroups.length > 0) {
    for (const group of dish.optionGroups) {
      const availableOpts = group.options.filter((o) => o.active);
      if (group.minChoices > 0 && availableOpts.length > 0) {
        defaultOpts.push(availableOpts[0].id);
      }
    }
  }
  return defaultOpts;
}

export function DishCustomizerModal({
  isOpen,
  dish,
  onClose,
  triggerElement,
}: DishCustomizerModalProps) {
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (triggerElement) {
      lastTriggerRef.current = triggerElement;
    }
  }, [triggerElement]);

  useEffect(() => {
    if (isOpen && dish) {
      wasOpenRef.current = true;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      if (lastTriggerRef.current && typeof lastTriggerRef.current.focus === 'function') {
        lastTriggerRef.current.focus();
      }
    }
  }, [isOpen, dish]);

  if (!isOpen || !dish) return null;

  return <DishCustomizerDialog key={dish.id} dish={dish} onClose={onClose} />;
}

interface DishCustomizerDialogProps {
  dish: FormattedMenuItem;
  onClose: () => void;
}

function DishCustomizerDialog({ dish, onClose }: DishCustomizerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { addItem, setIsCartOpen } = useCart();

  const [selectedTierId, setSelectedTierId] = useState<string>(() => getInitialTierId(dish));
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(() =>
    getInitialOptionIds(dish)
  );
  const [quantity, setQuantity] = useState<number>(1);

  // Native dialog showModal & body scroll lock on mount/unmount
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (typeof dialog.showModal === 'function' && !dialog.open) {
      dialog.showModal();
    }
    document.body.style.overflow = 'hidden';

    return () => {
      if (dialog.open) {
        dialog.close();
      }
      document.body.style.overflow = '';
    };
  }, []);

  // Calculate live total kobo directly during render
  let basePrice = dish.basePriceKobo ?? 0n;
  let isSelectionValid = true;
  let validationError = '';

  if (dish.sizeTiers && dish.sizeTiers.length > 0) {
    const tier = dish.sizeTiers.find((t) => t.id === selectedTierId);
    if (!tier) {
      isSelectionValid = false;
      validationError = 'Please select a size tier.';
    } else {
      basePrice = tier.priceKobo;
    }
  }

  let optionsExtra = 0n;
  if (dish.optionGroups && dish.optionGroups.length > 0) {
    for (const group of dish.optionGroups) {
      const selectedInGroup = group.options.filter((o) => selectedOptionIds.includes(o.id));
      if (selectedInGroup.length < group.minChoices) {
        isSelectionValid = false;
        validationError = `Please select at least ${group.minChoices} option for '${group.title}'.`;
        break;
      }
      if (selectedInGroup.length > group.maxChoices) {
        isSelectionValid = false;
        validationError = `Maximum ${group.maxChoices} option(s) allowed for '${group.title}'.`;
        break;
      }
      for (const opt of selectedInGroup) {
        optionsExtra += opt.extraKobo;
      }
    }
  }

  const currentUnitPriceKobo = isSelectionValid ? basePrice + optionsExtra : 0n;

  const toggleOption = (groupId: string, optId: string, maxChoices: number) => {
    const group = dish.optionGroups?.find((g) => g.id === groupId);
    if (!group) return;

    const currentSelectedInGroup = group.options
      .filter((o) => selectedOptionIds.includes(o.id))
      .map((o) => o.id);

    if (maxChoices === 1) {
      const otherSelected = selectedOptionIds.filter((id) => !currentSelectedInGroup.includes(id));
      setSelectedOptionIds([...otherSelected, optId]);
    } else {
      if (selectedOptionIds.includes(optId)) {
        setSelectedOptionIds(selectedOptionIds.filter((id) => id !== optId));
      } else if (currentSelectedInGroup.length < maxChoices) {
        setSelectedOptionIds([...selectedOptionIds, optId]);
      }
    }
  };

  const handleAddToCart = () => {
    if (!isSelectionValid) return;
    addItem({
      menuItemId: dish.id,
      quantity,
      selectedTierId: selectedTierId || undefined,
      selectedOptionIds,
    });
    onClose();
    setIsCartOpen(true);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dish-customizer-title"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
      className="m-auto rounded-3xl bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-gold)] shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm p-0 max-w-lg w-[95vw] overflow-hidden focus:outline-none"
    >
      {/* Header */}
      <div className="relative p-5 sm:p-6 border-b border-[var(--border-card)] bg-[var(--bg-surface-muted)] flex items-start justify-between gap-3">
        <div className="space-y-1 pr-2">
          <span className="text-sm uppercase tracking-wider text-[var(--text-accent)] font-semibold block">
            Customise Dish
          </span>
          <h2
            id="dish-customizer-title"
            className="font-serif text-xl sm:text-2xl font-bold text-[var(--text-primary)] tracking-tight leading-tight"
          >
            {dish.name}
          </h2>
          {dish.portionLabel && (
            <p className="text-sm text-[var(--text-body-muted)]">{dish.portionLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close customiser"
          className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-primary)] border border-[var(--border-gold)] text-[var(--text-accent)] hover:opacity-90 flex items-center justify-center shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Size Tiers */}
        {dish.sizeTiers && dish.sizeTiers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm uppercase tracking-wider font-bold text-[var(--text-accent)]">
                Select Size
              </span>
              <span className="text-sm text-[var(--text-body-muted)]">Required</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {dish.sizeTiers.map((tier) => {
                const isSelected = selectedTierId === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    aria-pressed={isSelected}
                    className={`min-h-[56px] p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      isSelected
                        ? 'border-[var(--border-gold)] bg-[var(--bg-surface-muted)] ring-2 ring-[var(--border-gold)]'
                        : 'border-[var(--border-card)] bg-[var(--bg-primary)] hover:border-[var(--border-gold)]'
                    }`}
                  >
                    <span className="font-bold text-base text-[var(--text-primary)]">{tier.label}</span>
                    <span className="text-sm text-[var(--text-accent)] font-mono price-tabular font-semibold whitespace-nowrap">
                      {tier.formattedPrice}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Option Groups */}
        {dish.optionGroups &&
          dish.optionGroups.map((group) => (
            <div key={group.id} className="space-y-3 border-t border-[var(--border-card)] pt-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm uppercase tracking-wider font-bold text-[var(--text-accent)]">
                    {group.title}
                  </h3>
                  <p className="text-sm text-[var(--text-body-muted)]">
                    {group.maxChoices === 1
                      ? 'Choose 1 option'
                      : `Choose up to ${group.maxChoices} (Min: ${group.minChoices})`}
                  </p>
                </div>
                {group.minChoices > 0 && (
                  <span className="text-sm font-semibold text-[var(--text-accent)] shrink-0">
                    Required
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {group.options.map((opt) => {
                  const isSelected = selectedOptionIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={!opt.active}
                      aria-pressed={isSelected}
                      onClick={() => toggleOption(group.id, opt.id, group.maxChoices)}
                      className={`w-full min-h-[48px] p-3 rounded-xl border flex items-center justify-between gap-3 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                        !opt.active
                          ? 'opacity-50 cursor-not-allowed border-[var(--border-subtle-card)] bg-[var(--bg-surface-muted)]'
                          : isSelected
                          ? 'cursor-pointer border-[var(--border-gold)] bg-[var(--bg-surface-muted)] ring-1 ring-[var(--border-gold)]'
                          : 'cursor-pointer border-[var(--border-card)] bg-[var(--bg-primary)] hover:border-[var(--border-gold)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 ${
                            group.maxChoices === 1 ? 'rounded-full' : 'rounded-md'
                          } border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'border-[var(--cta-gold-bg)] bg-[var(--cta-gold-bg)] text-[var(--cta-gold-text)]'
                              : 'border-[var(--border-gold)] bg-[var(--bg-card)]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-sm font-mono price-tabular font-semibold text-[var(--text-accent)] shrink-0 whitespace-nowrap">
                        {opt.formattedExtra}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

        {/* Quantity Stepper */}
        <div className="border-t border-[var(--border-card)] pt-4 flex items-center justify-between gap-4">
          <span className="text-sm uppercase tracking-wider font-bold text-[var(--text-accent)]">
            Quantity
          </span>
          <div className="flex items-center gap-2 bg-[var(--bg-primary)] border border-[var(--border-gold)] rounded-xl p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label="Decrease quantity"
              className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-card)] text-[var(--text-accent)] hover:bg-[var(--bg-surface-muted)] flex items-center justify-center disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-mono price-tabular font-bold text-base text-[var(--text-primary)] min-w-[2.5rem] text-center">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(100, q + 1))}
              disabled={quantity >= 100}
              aria-label="Increase quantity"
              className="min-w-[44px] min-h-[44px] rounded-lg bg-[var(--bg-card)] text-[var(--text-accent)] hover:bg-[var(--bg-surface-muted)] flex items-center justify-center disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {validationError && (
          <p
            role="alert"
            className="text-sm text-[var(--status-danger-text)] bg-[var(--status-danger-bg)] p-3 rounded-lg border border-[var(--status-danger-border)]"
          >
            {validationError}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 bg-[var(--bg-surface-muted)] border-t border-[var(--border-card)] flex items-center justify-between gap-4">
        <div>
          <span className="text-sm uppercase tracking-wider text-[var(--text-body-muted)] block">
            Item Total
          </span>
          <span className="font-sans price-tabular font-bold text-lg sm:text-xl text-[var(--text-accent)] whitespace-nowrap">
            {formatMoneyKobo(currentUnitPriceKobo * BigInt(quantity))}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!isSelectionValid}
          className="flex-1 min-h-[48px] bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-text)] font-bold text-sm sm:text-base py-3 px-5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <ShoppingBag className="w-4 h-4 shrink-0" />
          <span>Add to Order</span>
        </button>
      </div>
    </dialog>
  );
}
