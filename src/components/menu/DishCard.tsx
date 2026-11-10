import React from 'react';
import Link from 'next/link';
import { FormattedMenuItem } from '../../menu/read-model';
import { ALLERGEN_NOTICE } from '../../policy/content';
import { MessageCircle, Calculator, AlertTriangle, ShoppingBag } from 'lucide-react';

/**
 * ROCK UC FOODS - Phase 2B Dish Card Component
 * Playbook v9 Section 26.1 Item 3, 6, 7
 *
 * Rules:
 * - Semantic markup: article > photo button > h3 name + price > uppercase ingredient line
 *   > availability note > choice groups chips > size tiers > action buttons > allergen notice.
 * - Single setting in code for allergen notice position:
 *   'per-card' (as approved in live preview) or 'per-section'.
 * - Real wa.me link with dish name only in message (URL-encoded), never a price.
 * - 'Get a catering estimate' links to /estimate.
 * - Never '#' or 'javascript:'.
 * - Monogram tile fallback when no photo exists (never broken image).
 * - Visual steam and warm glow for showHeat = true. No audio ever.
 */

export const ALLERGEN_NOTICE_DISPLAY: 'per-card' | 'per-section' = 'per-card';

export interface DishCardProps {
  item: FormattedMenuItem;
  whatsappPhone?: string;
  isFirstScreen?: boolean;
  onEnlargePhoto?: (item: FormattedMenuItem) => void;
  onOrder?: (item: FormattedMenuItem, triggerEl: HTMLElement) => void;
  showAllergenNoticeOverride?: boolean;
}

function getMonogram(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function DishCard({
  item,
  whatsappPhone = '2348033729125',
  isFirstScreen = false,
  onEnlargePhoto,
  onOrder,
  showAllergenNoticeOverride,
}: DishCardProps) {
  const cleanPhone = whatsappPhone.replace(/\D/g, '');
  const encodedDishName = encodeURIComponent(`Hello, I would like to ask about ${item.name}`);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedDishName}`;

  const monogram = getMonogram(item.name);
  const showNotice =
    showAllergenNoticeOverride !== undefined
      ? showAllergenNoticeOverride
      : ALLERGEN_NOTICE_DISPLAY === 'per-card';

  return (
    <article
      data-testid={`dish-card-${item.id}`}
      data-dish-id={item.id}
      data-show-heat={item.showHeat ? 'true' : 'false'}
      className="dish-card relative bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg hover:border-[#D4AF37]/60 transition-all text-[#F7EFD9] min-w-0"
    >
      {/* Top Section: Photo Tile on left, Title & Price on right */}
      <div className="flex items-start gap-4 min-w-0">
        {/* Photo Tile (96px fixed) with Heat Visuals */}
        <div className="relative shrink-0 w-24 h-24">
          {item.showHeat && (
            <>
              {/* Radial warm glow behind photo tile */}
              <div
                aria-hidden="true"
                className="dish-heat-glow absolute inset-0 -m-1.5 rounded-xl bg-radial from-[#D4AF37]/35 via-[#6B1230]/25 to-transparent blur-sm pointer-events-none"
              />
              {/* Three decorative rising steam wisps */}
              <div
                aria-hidden="true"
                className="dish-steam-container absolute -top-4 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none z-10"
              >
                <span className="dish-steam-wisp-1 inline-block w-1 h-3.5 rounded-full bg-gradient-to-t from-transparent via-[#F7EFD9]/40 to-transparent" />
                <span className="dish-steam-wisp-2 inline-block w-1.5 h-4.5 rounded-full bg-gradient-to-t from-transparent via-[#D4AF37]/45 to-transparent" />
                <span className="dish-steam-wisp-3 inline-block w-1 h-3 rounded-full bg-gradient-to-t from-transparent via-[#F7EFD9]/35 to-transparent" />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => onEnlargePhoto?.(item)}
            aria-label={`Enlarge photo of ${item.name}`}
            className="relative z-1 w-24 h-24 rounded-xl overflow-hidden border border-[#D4AF37]/40 bg-[#0B0A09] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2 focus:ring-offset-[#0B0A09] flex items-center justify-center group cursor-pointer"
          >
            {item.photoUrl ? (
              <img
                src={item.photoUrl}
                alt={`Photo of ${item.name}`}
                width={96}
                height={96}
                loading={isFirstScreen ? 'eager' : 'lazy'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#17120F] via-[#241A14] to-[#0B0A09] text-[#D4AF37] group-hover:bg-[#1E1612] transition-colors p-2">
                <span className="font-serif font-bold text-2xl tracking-wider select-none">
                  {monogram}
                </span>
                <span className="text-[9px] uppercase tracking-widest text-[#F7EFD9]/50 mt-0.5">
                  View
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Right Column: Name, Price, Ingredients, Availability */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-[#F7EFD9] tracking-tight leading-snug">
              {item.name}
            </h3>
            {/* Price on the same line (Inter font for figures & naira sign) */}
            {item.hasBasePrice && item.formattedBasePrice && (
              <span className="font-sans font-bold text-base sm:text-lg text-[#D4AF37] shrink-0 whitespace-nowrap">
                {item.formattedBasePrice}
              </span>
            )}
          </div>

          {/* Uppercase ingredient / description line (CSS uppercase only, raw text preserved) */}
          {item.description && (
            <p className="uppercase text-xs tracking-wider text-[#D4AF37]/90 leading-relaxed font-medium">
              {item.description}
            </p>
          )}

          {/* Availability Note */}
          {item.availabilityNote && (
            <p className="text-xs text-[#F7EFD9]/75 italic flex items-center gap-1.5 pt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              <span>{item.availabilityNote}</span>
            </p>
          )}
        </div>
      </div>

      {/* Choice Groups (Chips) */}
      {item.optionGroups && item.optionGroups.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-white/5">
          {item.optionGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#F7EFD9]/70">
                {group.title}
              </span>
              <div className="flex flex-wrap gap-1.5" role="list">
                {group.options.map((opt) => (
                  <span
                    key={opt.id}
                    role="listitem"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#0B0A09] border border-[#D4AF37]/30 text-[#F7EFD9]/90"
                  >
                    <span>{opt.label}</span>
                    <span className="text-[#D4AF37] font-semibold text-[11px]">
                      ({opt.formattedExtra})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Size Tiers (e.g. S, M, L boxes for drinks) */}
      {item.sizeTiers && item.sizeTiers.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-white/5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#F7EFD9]/70">
            Select Size &amp; Pricing
          </span>
          <div className="grid grid-cols-3 gap-2" role="list">
            {item.sizeTiers.map((tier) => (
              <div
                key={tier.id}
                role="listitem"
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#0B0A09] border border-[#D4AF37]/40 text-center hover:border-[#D4AF37] transition-all"
              >
                <span className="text-xs font-bold text-[#F7EFD9] uppercase tracking-wide">
                  {tier.label}
                </span>
                <span className="font-sans font-bold text-xs text-[#D4AF37] mt-0.5 whitespace-nowrap">
                  {tier.formattedPrice}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col gap-2">
        {onOrder && (
          <button
            type="button"
            onClick={(e) => onOrder(item, e.currentTarget)}
            className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B08D26] hover:from-[#E5C158] hover:to-[#D4AF37] text-[#0B0A09] font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-[#0B0A09]" />
            <span>
              {(item.optionGroups && item.optionGroups.length > 0) || (item.sizeTiers && item.sizeTiers.length > 0)
                ? 'Select Options & Order'
                : 'Add to Order'}
            </span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] border border-[#D4AF37]/40 hover:border-[#D4AF37] px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 text-center"
          >
            <MessageCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
            <span>Ask on WhatsApp</span>
          </a>

          <Link
            href="/estimate"
            className="bg-[#0B0A09] hover:bg-[#1C1612] text-[#F7EFD9] border border-[#D4AF37]/30 hover:border-[#D4AF37] px-3.5 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 text-center"
          >
            <Calculator className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
            <span>Get catering estimate</span>
          </Link>
        </div>
      </div>

      {/* Verbatim Allergen Notice (Single Source of Truth) */}
      {showNotice && (
        <div className="mt-1 p-2.5 rounded-lg bg-[#0B0A09]/70 border border-[#D4AF37]/20 flex items-start gap-2 text-[11px] text-[#F7EFD9]/70 leading-relaxed">
          <AlertTriangle className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
          <span>{ALLERGEN_NOTICE}</span>
        </div>
      )}
    </article>
  );
}
