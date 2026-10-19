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
    <section className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] px-4 py-8 max-w-5xl mx-auto pb-28">
      {/* Brand Header */}
      <header className="text-center mb-8">
        <p className="text-xs tracking-widest uppercase text-[#D4AF37] mb-2 font-semibold">
          {BUSINESS_CONTACT.subtitle}
        </p>
        <h1 className="text-3xl md:text-5xl font-serif gold-headline tracking-wide font-bold mb-3">
          {BUSINESS_CONTACT.name}
        </h1>
        <p className="text-[#F7EFD9]/80 italic font-serif text-sm md:text-base">
          &ldquo;{BUSINESS_CONTACT.tagline}&rdquo; &bull; Handcrafted in Lagos, Nigeria
        </p>
      </header>

      {/* Mandatory Verbatim Allergen Notice */}
      <div className="bg-[#17120F] border border-[#D4AF37]/30 rounded-lg p-4 mb-8 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
        <div className="text-xs md:text-sm text-[#F7EFD9]/90 leading-relaxed">
          <span className="font-semibold text-[#D4AF37] block mb-1">Dietary & Allergen Notice:</span>
          {ALLERGEN_NOTICE}
        </div>
      </div>

      {/* Category Tabs */}
      <nav className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none" aria-label="Menu categories">
        <button
          onClick={() => setSelectedCategoryId('all')}
          className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-all shrink-0 ${
            selectedCategoryId === 'all'
              ? 'bg-[#6B1230] text-[#F7EFD9] shadow-md shadow-[#D4AF37]/20 border border-[#D4AF37]/40'
              : 'bg-[#17120F] text-[#F7EFD9]/70 hover:text-[#F7EFD9] border border-white/10'
          }`}
        >
          All Offerings ({allPublishedItems.length})
        </button>
        {visibleCategories.map((cat) => {
          const count = allPublishedItems.filter((i) => i.categoryId === cat.id).length;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-4 py-2 rounded-full text-xs md:text-sm font-semibold transition-all shrink-0 ${
                selectedCategoryId === cat.id
                  ? 'bg-[#6B1230] text-[#F7EFD9] shadow-md shadow-[#D4AF37]/20 border border-[#D4AF37]/40'
                  : 'bg-[#17120F] text-[#F7EFD9]/70 hover:text-[#F7EFD9] border border-white/10'
              }`}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </nav>

      {/* Empty State */}
      {displayedItems.length === 0 ? (
        <div className="bg-[#17120F] rounded-lg p-12 text-center border border-white/10 my-8">
          <Clock className="w-12 h-12 text-[#D4AF37] mx-auto mb-3 opacity-60" />
          <h3 className="text-lg font-serif text-[#D4AF37] mb-2">Our menu is currently being refreshed</h3>
          <p className="text-sm text-[#F7EFD9]/70 max-w-md mx-auto mb-4">
            New seasonal specialties are being prepared by Chef Esther. Please call or reach us directly.
          </p>
          <a
            href={BUSINESS_CONTACT.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#6B1230] text-[#F7EFD9] px-6 py-2.5 rounded text-sm font-semibold hover:bg-[#82173B]"
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
                    ? 'bg-[#17120F]/60 border-white/5 opacity-60'
                    : 'bg-[#17120F] border-[#D4AF37]/25 hover:border-[#D4AF37]/60 shadow-lg'
                }`}
              >
                <div>
                  {/* Photo tile (Neutral placeholder if no photo - never stock photos) */}
                  <div className="w-full h-44 bg-[#0B0A09] rounded-lg mb-3 flex items-center justify-center border border-white/5 relative overflow-hidden">
                    {item.imagePath ? (
                      <img
                        src={item.imagePath}
                        alt={item.imageAlt || item.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Sparkles className="w-6 h-6 text-[#D4AF37]/40 mx-auto mb-1" />
                        <span className="text-xs text-[#F7EFD9]/40 tracking-wide font-medium">
                          Photo coming soon
                        </span>
                      </div>
                    )}

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {item.isFeatured && (
                        <span className="bg-[#F2C230] text-[#0B0A09] text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow">
                          Featured
                        </span>
                      )}
                      {item.portionLabel && (
                        <span className="bg-[#0B0A09]/80 text-[#F7EFD9] text-[10px] px-2 py-0.5 rounded border border-white/10">
                          {item.portionLabel}
                        </span>
                      )}
                    </div>

                    {isSoldOut && (
                      <div className="absolute inset-0 bg-[#0B0A09]/80 flex items-center justify-center">
                        <span className="bg-[#B3261E] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded shadow">
                          Sold out today
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h2 className="text-lg font-serif font-semibold text-[#F7EFD9] tracking-wide">
                      {item.name}
                    </h2>
                    <span className="text-base font-bold text-[#D4AF37] price-tabular shrink-0">
                      {formatNaira(item.priceKobo)}
                    </span>
                  </div>

                  {item.description && (
                    <p className="text-xs text-[#F7EFD9]/70 leading-relaxed mb-3">
                      {item.description}
                    </p>
                  )}

                  {/* Options indicator */}
                  {item.optionGroups && item.optionGroups.length > 0 && (
                    <div className="mb-3 space-y-1">
                      {item.optionGroups.map((g) => (
                        <p key={g.id} className="text-[11px] text-[#D4AF37]/80">
                          <span className="font-semibold">{g.name}:</span>{' '}
                          {g.options.map((o) => `${o.name} (+${formatNaira(o.priceDeltaKobo)})`).join(', ')}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer action */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                  <span className="text-[#F7EFD9]/50">
                    {isSoldOut ? 'Unavailable for ordering' : 'Prepared fresh to order'}
                  </span>
                  <button
                    disabled={isSoldOut}
                    onClick={() => handleAddToCart(item.id)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                      isSoldOut
                        ? 'bg-white/10 text-white/30 cursor-not-allowed'
                        : isJustAdded
                        ? 'bg-emerald-700 text-white shadow-lg'
                        : 'bg-[#6B1230] text-[#F7EFD9] hover:bg-[#82173B] shadow shadow-[#6B1230]/40 border border-[#D4AF37]/40'
                    }`}
                  >
                    {isSoldOut ? (
                      'Sold out'
                    ) : isJustAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5 text-[#D4AF37]" /> Add to Order
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
          <div className="bg-[#17120F] border-2 border-[#D4AF37] p-3.5 rounded-2xl shadow-2xl flex items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#6B1230] flex items-center justify-center text-[#D4AF37] border border-[#D4AF37]/50 relative">
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 bg-[#D4AF37] text-[#0B0A09] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
                  {totalItemsCount}
                </span>
              </div>
              <div>
                <span className="text-xs text-white/60 block">Selection Subtotal:</span>
                <span className="font-mono font-bold text-sm sm:text-base text-[#D4AF37]">
                  {formatNaira(subtotalKobo)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowCheckout(true)}
              className="bg-[#6B1230] hover:bg-[#85163C] text-[#F7EFD9] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-[#D4AF37]/60 shadow-lg"
            >
              <span>Review &amp; Checkout</span>
              <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
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
