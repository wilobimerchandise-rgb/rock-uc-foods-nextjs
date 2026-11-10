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

export function DishCustomizerModal({
  isOpen,
  dish,
  onClose,
  triggerElement,
}: DishCustomizerModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const { addItem, setIsCartOpen } = useCart();

  // Selected state initialized from current dish
  const [selectedTierId, setSelectedTierId] = useState<string>(() => {
    if (dish?.sizeTiers && dish.sizeTiers.length > 0) {
      const firstActive = dish.sizeTiers.find((t) => t.active) || dish.sizeTiers[0];
      return firstActive ? firstActive.id : '';
    }
    return '';
  });

  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>(() => {
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
  });

  const [quantity, setQuantity] = useState<number>(1);

  // Focus restore ref update inside effect
  useEffect(() => {
    if (triggerElement) {
      lastTriggerRef.current = triggerElement;
    }
  }, [triggerElement]);

  // Native dialog showModal & body lock
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && dish) {
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
  }, [isOpen, dish]);

  // Calculate live total kobo directly during render
  let basePrice = dish?.basePriceKobo ?? 0n;
  let isSelectionValid = true;
  let validationError = '';

  if (dish?.sizeTiers && dish.sizeTiers.length > 0) {
    const tier = dish.sizeTiers.find((t) => t.id === selectedTierId);
    if (!tier) {
      isSelectionValid = false;
      validationError = 'Please select a size tier.';
    } else {
      basePrice = tier.priceKobo;
    }
  }

  let optionsExtra = 0n;
  if (dish?.optionGroups && dish.optionGroups.length > 0) {
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

  if (!isOpen || !dish) return null;

  const toggleOption = (groupId: string, optId: string, maxChoices: number) => {
    const group = dish.optionGroups?.find((g) => g.id === groupId);
    if (!group) return;

    const currentSelectedInGroup = group.options.filter((o) => selectedOptionIds.includes(o.id)).map((o) => o.id);

    if (maxChoices === 1) {
      // Single select: replace choice in group
      const otherSelected = selectedOptionIds.filter((id) => !currentSelectedInGroup.includes(id));
      setSelectedOptionIds([...otherSelected, optId]);
    } else {
      // Multi select: toggle
      if (selectedOptionIds.includes(optId)) {
        setSelectedOptionIds(selectedOptionIds.filter((id) => id !== optId));
      } else {
        if (currentSelectedInGroup.length < maxChoices) {
          setSelectedOptionIds([...selectedOptionIds, optId]);
        }
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
      className="m-auto rounded-3xl bg-[#17120F] text-[#F7EFD9] border border-[#D4AF37]/40 shadow-2xl backdrop:bg-[#0B0A09]/80 backdrop:backdrop-blur-sm p-0 max-w-lg w-[95vw] overflow-hidden focus:outline-none"
    >
      {/* Header */}
      <div className="relative p-5 sm:p-6 border-b border-[#D4AF37]/20 flex items-start justify-between bg-gradient-to-r from-[#241A14] to-[#17120F]">
        <div className="space-y-1 pr-6">
          <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold">
            Customise Dish
          </span>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#F7EFD9] tracking-tight leading-tight">
            {dish.name}
          </h2>
          {dish.portionLabel && (
            <p className="text-xs text-[#F7EFD9]/60">{dish.portionLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close customiser"
          className="w-9 h-9 rounded-full bg-[#0B0A09] border border-[#D4AF37]/30 text-[#D4AF37] hover:border-[#D4AF37] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 sm:p-6 space-y-6 max-h-[60vh] overflow-y-auto">
        {/* Size Tiers */}
        {dish.sizeTiers && dish.sizeTiers.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider font-bold text-[#D4AF37]">
                Select Size
              </label>
              <span className="text-[10px] text-[#F7EFD9]/60">Required</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {dish.sizeTiers.map((tier) => {
                const isSelected = selectedTierId === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setSelectedTierId(tier.id)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 ring-2 ring-[#D4AF37]/30'
                        : 'border-[#D4AF37]/25 bg-[#0B0A09]/60 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    <span className="font-bold text-sm text-[#F7EFD9]">{tier.label}</span>
                    <span className="text-xs text-[#D4AF37] font-mono">
                      {tier.formattedPrice}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Option Groups */}
        {dish.optionGroups && dish.optionGroups.map((group) => {
          return (
            <div key={group.id} className="space-y-3 border-t border-[#D4AF37]/15 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-[#D4AF37]">
                    {group.title}
                  </h3>
                  <p className="text-[11px] text-[#F7EFD9]/60">
                    {group.maxChoices === 1
                      ? 'Choose 1 option'
                      : `Choose up to ${group.maxChoices} (Min: ${group.minChoices})`}
                  </p>
                </div>
                {group.minChoices > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#6B1230]/60 border border-[#D4AF37]/30 text-[#D4AF37] font-medium">
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
                      onClick={() => toggleOption(group.id, opt.id, group.maxChoices)}
                      className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                        !opt.active
                          ? 'opacity-40 cursor-not-allowed border-gray-800 bg-black/40'
                          : isSelected
                          ? 'border-[#D4AF37] bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/30'
                          : 'border-[#D4AF37]/25 bg-[#0B0A09]/60 hover:border-[#D4AF37]/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-${
                            group.maxChoices === 1 ? 'full' : 'md'
                          } border flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-[#D4AF37] bg-[#D4AF37] text-[#0B0A09]'
                              : 'border-[#D4AF37]/40 bg-[#0B0A09]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-[#F7EFD9]">
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-[#D4AF37] shrink-0">
                        {opt.formattedExtra}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Quantity Stepper */}
        <div className="border-t border-[#D4AF37]/15 pt-4 flex items-center justify-between">
          <label className="text-xs uppercase tracking-wider font-bold text-[#D4AF37]">
            Quantity
          </label>
          <div className="flex items-center gap-3 bg-[#0B0A09] border border-[#D4AF37]/30 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg bg-[#17120F] text-[#D4AF37] hover:bg-[#241A14] flex items-center justify-center disabled:opacity-30 cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono font-bold text-sm text-[#F7EFD9] w-6 text-center">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(100, q + 1))}
              disabled={quantity >= 100}
              className="w-8 h-8 rounded-lg bg-[#17120F] text-[#D4AF37] hover:bg-[#241A14] flex items-center justify-center disabled:opacity-30 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {validationError && (
          <p className="text-xs text-[#FF8585] bg-[#6B1230]/40 p-2.5 rounded-lg border border-[#FF8585]/30">
            {validationError}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 bg-[#0B0A09] border-t border-[#D4AF37]/20 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-[#F7EFD9]/60 block">
            Item Total
          </span>
          <span className="font-sans font-bold text-lg sm:text-xl text-[#D4AF37] whitespace-nowrap">
            {formatMoneyKobo(currentUnitPriceKobo * BigInt(quantity))}
          </span>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!isSelectionValid}
          className="flex-1 bg-gradient-to-r from-[#D4AF37] to-[#B08D26] hover:from-[#E5C158] hover:to-[#D4AF37] text-[#0B0A09] font-bold text-xs sm:text-sm py-3 px-5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Add to Order</span>
        </button>
      </div>
    </dialog>
  );
}
