/**
 * ROCK UC FOODS - Public Luxury Menu with Live Ordering & Cart Integration
 * (Playbook v2 Section 7.D, 8 & Section 17 v3 Addendum)
 * Displays only published items in visible categories; hides empty categories;
 * greys sold-out items with 'Sold out today'; renders prices in ₦ (U+20A6).
 * Seamlessly integrates Cart Drawer and Guest Checkout Modal.
 */

import React, { useState } from 'react';
import { menuRepository } from '../../menu/data';
import { formatNaira } from '../../lib/money';
import { ALLERGEN_NOTICE, BUSINESS_CONTACT } from '../../policy/content';
import { useCart } from '../../order/cartContext';
import { CheckoutModal } from '../order/CheckoutModal';
import { Order } from '../../types/order';
import { AlertCircle, Clock, Sparkles, ShoppingBag, Plus, ArrowRight, Check } from 'lucide-react';

interface PublicMenuProps {
  onOrderPlaced?: (order: Order) => void;
}

export const PublicMenu: React.FC<PublicMenuProps> = ({ onOrderPlaced }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [showCheckout, setShowCheckout] = useState(false);
  const [addedAnimationId, setAddedAnimationId] = useState<string | null>(null);

  const { addItem, totalItemsCount, subtotalKobo } = useCart();

  const categories = menuRepository.getCategories(false);
  const allPublishedItems = menuRepository.getItems(false);

  // Hide empty categories (Playbook Section 7.D)
  const visibleCategories = categories.filter((cat) =>
    allPublishedItems.some((item) => item.categoryId === cat.id)
  );

  const displayedItems =
    selectedCategoryId === 'all'
      ? allPublishedItems
      : allPublishedItems.filter((item) => item.categoryId === selectedCategoryId);

  const handleAddToCart = (itemId: string) => {
    addItem(itemId);
    setAddedAnimationId(itemId);
    setTimeout(() => setAddedAnimationId(null), 1200);
  };

  const handleOrderSuccess = (order: Order) => {
    if (onOrderPlaced) {
      onOrderPlaced(order);
    }
  };

  return (
    <section className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-4 py-8 max-w-5xl mx-auto pb-28">
      {/* Brand Header */}
      <header className="text-center mb-8">
        <p className="text-sm tracking-widest uppercase text-[var(--text-accent)] mb-2 font-semibold">
          {BUSINESS_CONTACT.subtitle}
        </p>
        <h1 className="text-3xl md:text-5xl font-serif gold-headline tracking-wide font-bold mb-3">
          {BUSINESS_CONTACT.name}
        </h1>
        <p className="text-[var(--text-body-muted)] italic font-serif text-sm md:text-base">
          &ldquo;{BUSINESS_CONTACT.tagline}&rdquo; &bull; Handcrafted in Lagos, Nigeria
        </p>
      </header>

      {/* Mandatory Verbatim Allergen Notice */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-4 mb-8 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[var(--text-accent)] shrink-0 mt-0.5" />
        <div className="text-sm text-[var(--text-primary)] leading-relaxed">
          <span className="font-semibold text-[var(--text-accent)] block mb-1">Dietary &amp; Allergen Notice:</span>
          {ALLERGEN_NOTICE}
        </div>
      </div>

      {/* Category Tabs */}
      <nav className="flex gap-2 overflow-x-auto pb-4 mb-6 no-scrollbar" aria-label="Menu categories">
        <button
          type="button"
          onClick={() => setSelectedCategoryId('all')}
          className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
            selectedCategoryId === 'all'
              ? 'bg-[var(--cta-wine-bg)] text-[var(--cta-wine-text)] shadow-md border border-[var(--border-gold)]'
              : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]'
          }`}
        >
          All Offerings ({allPublishedItems.length})
        </button>
        {visibleCategories.map((cat) => {
          const count = allPublishedItems.filter((i) => i.categoryId === cat.id).length;
          return (
            <button
              type="button"
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 ${
                selectedCategoryId === cat.id
                  ? 'bg-[var(--cta-wine-bg)] text-[var(--cta-wine-text)] shadow-md border border-[var(--border-gold)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] border border-[var(--border-subtle-card)]'
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </nav>

      {/* Empty State */}
      {displayedItems.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-lg p-8 sm:p-12 text-center border border-[var(--border-card)] my-8">
          <Clock className="w-12 h-12 text-[var(--text-accent)] mx-auto mb-3 opacity-80" />
          <h3 className="text-lg font-serif text-[var(--text-accent)] mb-2">Our menu is currently being refreshed</h3>
          <p className="text-sm text-[var(--text-body-muted)] max-w-md mx-auto mb-4">
            New seasonal specialties are being prepared by Chef Esther. Please call or reach us directly.
          </p>
          <a
            href={BUSINESS_CONTACT.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center justify-center bg-[var(--cta-wine-bg)] text-[var(--cta-wine-text)] border border-[var(--border-gold)] px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#82173B]"
          >
            Inquire on WhatsApp ({BUSINESS_CONTACT.phone})
          </a>
        </div>
      ) : (
        /* Dishes Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedItems.map((item) => {
            const isSoldOut = menuRepository.isItemSoldOutToday(item) || !item.isAvailable;
            const isJustAdded = addedAnimationId === item.id;

            return (
              <article
                key={item.id}
                className={`rounded-xl p-5 border transition-all flex flex-col justify-between ${
                  isSoldOut
                    ? 'bg-[var(--bg-surface-muted)] border-[var(--border-subtle-card)] opacity-75'
                    : 'bg-[var(--bg-card)] border-[var(--border-card)] hover:border-[var(--border-gold)] shadow-lg'
                }`}
              >
                <div>
                  {/* Photo tile (Neutral placeholder if no photo - never stock photos) */}
                  <div className="w-full h-44 bg-[var(--bg-surface-muted)] rounded-lg mb-3 flex items-center justify-center border border-[var(--border-subtle-card)] relative overflow-hidden">
                    {(item.photoUrl || item.imagePath) ? (
                      <img
                        src={item.photoUrl || item.imagePath}
                        alt={item.imageAlt || item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Sparkles className="w-6 h-6 text-[var(--text-accent)] mx-auto mb-1" />
                        <span className="text-sm text-[var(--text-body-muted)] tracking-wide font-medium">
                          Photo coming soon
                        </span>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                      {item.isFeatured && (
                        <span className="bg-[#F2C230] text-[#0B0A09] text-sm uppercase font-bold px-2.5 py-0.5 rounded-md shadow">
                          Featured
                        </span>
                      )}
                      {item.portionLabel && (
                        <span className="bg-[var(--ink)]/90 text-[var(--cream)] text-sm px-2.5 py-0.5 rounded-md border border-[var(--gold)]/40">
                          {item.portionLabel}
                        </span>
                      )}
                    </div>

                    {isSoldOut && (
                      <div className="absolute inset-0 bg-[var(--ink)]/80 flex items-center justify-center">
                        <span className="bg-[#B3261E] text-white text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-md shadow">
                          Sold out today
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h2 className="text-lg font-serif font-semibold text-[var(--text-primary)] tracking-wide">
                      {item.name}
                    </h2>
                    <span className="text-base font-bold text-[var(--text-accent)] price-tabular shrink-0">
                      {formatNaira(item.priceKobo)}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-sm text-[var(--text-body-muted)] leading-relaxed mb-3">
                      {item.description}
                    </p>
                  )}

                  {/* Options indicator */}
                  {item.optionGroups && item.optionGroups.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {item.optionGroups.map((g) => (
                        <p key={g.id} className="text-sm text-[var(--text-accent)]">
                          <span className="font-semibold">{g.name}:</span>{' '}
                          {g.options.map((o) => `${o.name} (+${formatNaira(o.priceDeltaKobo)})`).join(', ')}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer action */}
                <div className="pt-3 border-t border-[var(--border-subtle-card)] flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--text-body-muted)]">
                    {isSoldOut ? 'Unavailable for ordering' : 'Prepared fresh to order'}
                  </span>
                  <button
                    type="button"
                    disabled={isSoldOut}
                    onClick={() => handleAddToCart(item.id)}
                    className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                      isSoldOut
                        ? 'bg-[var(--bg-surface-muted)] text-[var(--text-body-muted)] border border-[var(--border-subtle-card)] opacity-60 cursor-not-allowed'
                        : isJustAdded
                        ? 'bg-[#166534] text-white shadow-lg'
                        : 'bg-[var(--cta-wine-bg)] text-[var(--cta-wine-text)] hover:bg-[#82173B] shadow border border-[var(--border-gold)]'
                    }`}
                  >
                    {isSoldOut ? (
                      'Sold out'
                    ) : isJustAdded ? (
                      <>
                        <Check className="w-4 h-4" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 text-[var(--gold-light)]" /> Add to Order
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {totalItemsCount > 0 && (
        <aside
          aria-label="Current order selection"
          className="fixed bottom-4 left-4 right-4 max-w-xl mx-auto z-40"
        >
          <div className="bg-[var(--bg-card)] border-2 border-[var(--border-gold)] p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[var(--cta-wine-bg)] flex items-center justify-center text-[var(--gold-light)] border border-[var(--border-gold)] relative shrink-0">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-[var(--gold)] text-[var(--ink)] text-sm font-bold min-w-[24px] h-6 px-1 rounded-md flex items-center justify-center shadow price-tabular">
                  {totalItemsCount}
                </span>
              </div>
              <div>
                <span className="text-sm text-[var(--text-body-muted)] block">Selection Subtotal:</span>
                <span className="font-mono font-bold text-base text-[var(--text-accent)] price-tabular">
                  {formatNaira(subtotalKobo)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowCheckout(true)}
              className="min-h-[44px] bg-[var(--cta-wine-bg)] hover:bg-[#85163C] text-[var(--cta-wine-text)] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border border-[var(--border-gold)] shadow-lg shrink-0"
            >
              <span>Review &amp; Checkout</span>
              <ArrowRight className="w-4 h-4 text-[var(--gold-light)]" />
            </button>
          </div>
        </aside>
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        onOrderPlaced={handleOrderSuccess}
      />
    </section>
  );
};
