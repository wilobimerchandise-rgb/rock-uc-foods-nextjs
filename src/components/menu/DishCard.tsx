import React from 'react';
import Link from 'next/link';
import { FormattedMenuItem } from '../../menu/read-model';
import { ALLERGEN_NOTICE } from '../../policy/content';
import { MessageCircle, Calculator, AlertTriangle, ShoppingBag } from 'lucide-react';

/**
 * ROCK UC FOODS - Phase 2B Dish Card Component
 * Playbook v9 Section 26.1 & Section 35 (Dark/Light tokens, >=14px text, >=44px targets)
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
      className="dish-card relative bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-lg hover:border-[var(--border-gold)] transition-all text-[var(--text-primary)] min-w-0"
    >
      {/* Top Section: Photo Tile on left, Title & Price on right */}
      <div className="flex items-start gap-4 min-w-0">
        {/* Photo Tile (96px fixed) with Heat Visuals */}
        <div className="relative shrink-0 w-24 h-24">
          {item.showHeat && (
            <>
              <div
                aria-hidden="true"
                className="dish-heat-glow absolute inset-0 -m-1.5 rounded-xl bg-radial from-[#D4AF37]/35 via-[#6B1230]/25 to-transparent blur-sm pointer-events-none"
              />
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
            className="relative z-1 w-24 h-24 min-w-[44px] min-h-[44px] rounded-xl overflow-hidden border border-[var(--border-gold)] bg-[#17120F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 flex items-center justify-center group cursor-pointer"
          >
            {item.photoUrl ? (
              <img
                src={item.photoUrl}
                alt={`Photo of ${item.name}`}
                width={96}
                height={96}
                referrerPolicy="no-referrer"
                loading={isFirstScreen ? 'eager' : 'lazy'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#17120F] via-[#241A14] to-[#0B0A09] text-[#D4AF37] group-hover:bg-[#1E1612] transition-colors p-2">
                <span className="font-serif font-bold text-2xl tracking-wider select-none">
                  {monogram}
                </span>
                <span className="text-sm uppercase tracking-wider text-[#F7EFD9] mt-0.5">
                  View
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Right Column: Name, Price, Ingredients, Availability */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight leading-snug">
              {item.name}
            </h3>
            {item.hasBasePrice && item.formattedBasePrice && (
              <span className="font-sans price-tabular font-bold text-base sm:text-lg text-[var(--text-accent)] shrink-0 whitespace-nowrap">
                {item.formattedBasePrice}
              </span>
            )}
          </div>

          {item.description && (
            <p className="uppercase text-sm tracking-wide text-[var(--text-accent)] leading-relaxed font-medium">
              {item.description}
            </p>
          )}

          {item.availabilityNote && (
            <p className="text-sm text-[var(--text-body-muted)] italic pt-0.5">
              {item.availabilityNote}
            </p>
          )}
        </div>
      </div>

      {/* Choice Groups */}
      {item.optionGroups && item.optionGroups.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-[var(--border-subtle-card)]">
          {item.optionGroups.map((group) => (
            <div key={group.id} className="space-y-1.5">
              <span className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] block">
                {group.title}
              </span>
              <div className="flex flex-wrap gap-2" role="list">
                {group.options.map((opt) => (
                  <span
                    key={opt.id}
                    role="listitem"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-[var(--text-primary)]"
                  >
                    <span>{opt.label}</span>
                    <span className="text-[var(--text-accent)] font-semibold price-tabular">
                      ({opt.formattedExtra})
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Size Tiers */}
      {item.sizeTiers && item.sizeTiers.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--border-subtle-card)]">
          <span className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] block">
            Select Size &amp; Pricing
          </span>
          <div className="grid grid-cols-3 gap-2" role="list">
            {item.sizeTiers.map((tier) => (
              <div
                key={tier.id}
                role="listitem"
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] text-center hover:border-[var(--border-gold)] transition-all"
              >
                <span className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
                  {tier.label}
                </span>
                <span className="font-sans price-tabular font-bold text-sm text-[var(--text-accent)] mt-0.5 whitespace-nowrap">
                  {tier.formattedPrice}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 flex flex-col gap-2.5">
        {onOrder && (
          <button
            type="button"
            onClick={(e) => onOrder(item, e.currentTarget)}
            className="w-full min-h-[44px] bg-[var(--cta-gold-bg)] hover:bg-[var(--cta-gold-hover)] text-[var(--cta-gold-text)] font-bold text-sm py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span>
              {(item.optionGroups && item.optionGroups.length > 0) ||
              (item.sizeTiers && item.sizeTiers.length > 0)
                ? 'Select Options & Order'
                : 'Add to Order'}
            </span>
          </button>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-h-[44px] bg-[var(--cta-wine-bg)] hover:opacity-95 text-[var(--cta-wine-text)] border border-[var(--border-gold)] px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <MessageCircle className="w-4 h-4 text-[var(--icon-on-wine)] shrink-0" />
            <span>Ask on WhatsApp</span>
          </a>

          <Link
            href="/estimate"
            className="min-h-[44px] bg-[var(--bg-surface-muted)] hover:opacity-90 text-[var(--text-primary)] border border-[var(--border-card)] hover:border-[var(--border-gold)] px-3.5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Calculator className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0" />
            <span>Get catering estimate</span>
          </Link>
        </div>
      </div>

      {/* Verbatim Allergen Notice (Single Source of Truth) */}
      {showNotice && (
        <div className="mt-1 p-3 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-card)] flex items-start gap-2.5 text-sm text-[var(--text-body-muted)] leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0 mt-1" />
          <span>{ALLERGEN_NOTICE}</span>
        </div>
      )}
    </article>
  );
}
