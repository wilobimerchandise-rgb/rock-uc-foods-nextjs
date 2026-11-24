/**
 * ROCK UC FOODS - Luxury Brand Website
 * (Playbook v2 Section 7B & Section 17 v3 Addendum)
 * MASTER RULE ENFORCED: FOUNDER PHOTO IS SACRED - USE EXACT UPLOAD, NO AI FACE.
 */

import React, { useState } from 'react';
import { RucLogo } from './RucLogo';
import { FounderPhoto } from './FounderPhoto';
import { menuRepository } from '../../menu/data';
import { formatNaira } from '../../lib/money';
import {
  BUSINESS_CONTACT,
  ALLERGEN_NOTICE,
  REFUND_POLICY_DETAILS,
  INVOICE_FOOTER,
  FCCPA_RIGHTS_STATEMENT,
} from '../../policy/content';
import { EventInquiryModal } from '../catering/EventInquiryModal';
import {
  Phone,
  MessageCircle,
  Utensils,
  Sparkles,
  Truck,
  ArrowRight,
  MapPin,
  CalendarDays,
  X,
  ChefHat,
  HeartHandshake,
} from 'lucide-react';

interface BrandWebsiteProps {
  onNavigateToMenu: () => void;
  onOpenOrder: (itemId?: string) => void;
}

export const BrandWebsite: React.FC<BrandWebsiteProps> = ({
  onNavigateToMenu,
  onOpenOrder,
}) => {
  const [activeModal, setActiveModal] = useState<
    'events' | 'about' | 'contact' | 'refund-policy' | 'privacy' | 'terms' | null
  >(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);

  const featuredDishes = menuRepository
    .getItems(false)
    .filter((item) => item.isFeatured)
    .slice(0, 4);

  return (
    <div className="bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen font-sans selection:bg-[#6B1230] selection:text-[#F7EFD9]">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-[var(--border-card)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-10 md:gap-14">
          {/* Left Column: Brand Lockup & Call to Actions */}
          <div className="flex-1 text-center md:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-gold)] text-[var(--text-accent)] text-sm font-semibold uppercase tracking-wider mb-6">
              <Sparkles className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0" />
              {BUSINESS_CONTACT.subtitle}
            </div>

            {/* Live HTML Gold Gradient Headline (NEVER an image) */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-black tracking-tight mb-4 leading-tight">
              <span className="gold-headline">Taste the Luxury</span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--text-primary)] max-w-xl mx-auto md:mx-0 font-serif italic mb-8 leading-relaxed">
              Premium Nigerian dishes, crafted with tradition, served with class.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
              <button
                type="button"
                onClick={onNavigateToMenu}
                className="w-full sm:w-auto min-h-[44px] min-w-[44px] btn-luxury text-sm font-bold uppercase tracking-wider px-8 py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-[#6B1230]/40"
              >
                <Utensils className="w-4 h-4 text-[#F7EFD9]" />
                <span>ORDER NOW</span>
              </button>

              <a
                href={`tel:${BUSINESS_CONTACT.phoneInternational}`}
                className="w-full sm:w-auto min-h-[44px] min-w-[44px] px-6 py-3 rounded border border-[var(--border-gold)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0" />
                <span>Call {BUSINESS_CONTACT.phone}</span>
              </a>

              <a
                href={BUSINESS_CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto min-h-[44px] min-w-[44px] px-5 py-3 rounded border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-primary)] text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0" />
                <span>WhatsApp</span>
              </a>
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--border-card)] flex items-center justify-center md:justify-start gap-2 text-sm text-[var(--text-accent)]">
              <Truck className="w-4 h-4 shrink-0" />
              <span className="font-serif italic text-sm text-[var(--text-primary)]">
                We deliver to your doorstep across Lagos
              </span>
            </div>
          </div>

          {/* Right Column: Exact Sacred Founder Photo (No AI face) */}
          <div className="w-full max-w-sm md:max-w-md shrink-0 flex justify-center">
            <div className="w-full relative p-2.5 bg-[var(--bg-card)] border-2 border-[var(--border-gold)] rounded-xl shadow-2xl">
              <FounderPhoto allowUpload={true} />
              <div className="p-3 mt-2 bg-[var(--bg-surface-muted)] rounded border border-[var(--border-card)] text-center">
                <span className="font-serif font-bold text-base text-[var(--text-primary)] block">
                  Chef Esther Kwentua
                </span>
                <span className="text-sm text-[var(--text-accent)] uppercase tracking-wider font-semibold block">
                  Executive Chef &amp; Founder
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THREE PILLARS */}
      <section className="bg-[var(--bg-card)] py-12 px-4 border-b border-[var(--border-card)]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full border border-[var(--border-gold)] bg-[var(--bg-primary)] flex items-center justify-center mx-auto mb-4 text-[var(--icon-on-surface)]">
              <Utensils className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[var(--text-primary)] mb-2">Exquisite Menu</h3>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              Authentic heritage recipes refined with culinary mastery, authentic spices, and luxury presentation.
            </p>
          </div>

          <div className="text-center p-4 border-y md:border-y-0 md:border-x border-[var(--border-card)]">
            <div className="w-12 h-12 rounded-full border border-[var(--border-gold)] bg-[var(--bg-primary)] flex items-center justify-center mx-auto mb-4 text-[var(--icon-on-surface)]">
              <ChefHat className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[var(--text-primary)] mb-2">Fresh &amp; Quality Ingredients</h3>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              Every dish is prepared from scratch using the freshest local ingredients sourced daily in Lagos.
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full border border-[var(--border-gold)] bg-[var(--bg-primary)] flex items-center justify-center mx-auto mb-4 text-[var(--icon-on-surface)]">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[var(--text-primary)] mb-2">Unforgettable Experience</h3>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              From our smoky party jollof to bespoke bulk event catering, every bite is crafted to delight.
            </p>
          </div>
        </div>
      </section>

      {/* 3. FEATURED DISHES */}
      <section className="py-14 px-4 max-w-6xl mx-auto border-b border-[var(--border-card)]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--text-primary)]">Signature Delicacies</h2>
            <p className="text-sm text-[var(--text-body-muted)] mt-1">
              Curated favourites prepared fresh by Chef Esther and her kitchen team.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToMenu}
            className="min-h-[44px] min-w-[44px] px-3 py-2 text-sm font-semibold text-[var(--text-accent)] hover:underline inline-flex items-center gap-1.5 group"
          >
            <span>View Complete Menu</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredDishes.map((dish) => (
            <article
              key={dish.id}
              className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-5 flex flex-col justify-between hover:border-[var(--border-gold)] transition-all"
            >
              <div>
                <div className="w-full h-44 bg-[var(--bg-surface-muted)] rounded mb-3 flex items-center justify-center border border-[var(--border-card)] relative overflow-hidden">
                  <span className="text-sm text-[var(--text-body-muted)] tracking-wide font-medium">
                    Photo coming soon
                  </span>
                  <span className="absolute top-2 left-2 bg-[#F2C230] text-[#0B0A09] text-sm uppercase font-bold px-2.5 py-0.5 rounded shadow">
                    Featured
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-serif font-bold text-base text-[var(--text-primary)]">{dish.name}</h3>
                  <span className="text-sm font-bold text-[var(--text-accent)] price-tabular shrink-0">
                    {formatNaira(dish.priceKobo)}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-body-muted)] line-clamp-2 mb-3">{dish.description}</p>
              </div>

              <div className="pt-3 border-t border-[var(--border-card)] flex items-center justify-between text-sm">
                <span className="text-[var(--text-body-muted)]">{dish.portionLabel || 'Serves 1'}</span>
                <button
                  type="button"
                  onClick={() => onOpenOrder(dish.id)}
                  className="min-h-[44px] min-w-[44px] bg-[#6B1230] text-[#F7EFD9] px-5 py-2.5 rounded font-semibold hover:bg-[#82173B]"
                >
                  Order
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 4. HOW ORDERING WORKS */}
      <section className="bg-[var(--bg-how-section)] text-[#0B0A09] py-14 px-4 border-b border-[var(--border-gold)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-sm uppercase tracking-widest text-[#6B1230] font-bold block mb-1">
              Seamless Process
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B0A09]">
              How Ordering Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[var(--bg-how-card)] p-6 rounded-lg border border-[#0B0A09]/15">
              <span className="text-4xl font-serif font-black text-[#6B1230] block mb-2">1</span>
              <h3 className="font-serif font-bold text-base text-[#0B0A09] mb-2">Choose Your Dishes</h3>
              <p className="text-sm text-[#17120F] leading-relaxed">
                Browse our seasonal menu, select portions and accompaniments, and submit your request.
              </p>
            </div>

            <div className="bg-[var(--bg-how-card)] p-6 rounded-lg border border-[#0B0A09]/15">
              <span className="text-4xl font-serif font-black text-[#6B1230] block mb-2">2</span>
              <h3 className="font-serif font-bold text-base text-[#0B0A09] mb-2">Staff Confirmation</h3>
              <p className="text-sm text-[#17120F] leading-relaxed">
                Our kitchen reviews availability, confirms feasibility, and verifies payment before cooking begins.
              </p>
            </div>

            <div className="bg-[var(--bg-how-card)] p-6 rounded-lg border border-[#0B0A09]/15">
              <span className="text-4xl font-serif font-black text-[#6B1230] block mb-2">3</span>
              <h3 className="font-serif font-bold text-base text-[#0B0A09] mb-2">Doorstep Delivery or Pickup</h3>
              <p className="text-sm text-[#17120F] leading-relaxed">
                Dispatched hot and fresh directly to your doorstep or ready for pickup at our Lagos kitchen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. EVENTS AND BULK CATERING */}
      <section className="bg-[#5B2A6E] text-[#F7EFD9] py-14 px-4 border-b border-[var(--border-gold)]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#17120F]/70 text-[#F3D98B] text-sm font-semibold uppercase tracking-wider mb-4 border border-[#D4AF37]/40">
            <CalendarDays className="w-4 h-4 shrink-0" />
            Bespoke Event Catering
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#F7EFD9] mb-4">Celebrate with Luxury Catering</h2>
          <p className="text-base text-[#F7EFD9] max-w-2xl mx-auto mb-6 leading-relaxed">
            Weddings, birthdays, corporate banquets, and celebrations. Sized for 21 to 5,000 guests with custom buffet
            setups, food trays, or on-site live cooking.
          </p>
          <div className="text-sm text-[#F7EFD9] mb-6 font-mono bg-[#17120F]/75 py-2.5 px-4 rounded-full inline-block border border-[#D4AF37]/30">
            Terms: 70% upfront deposit upon invoice &bull; 30% balance on delivery
          </div>
          <div>
            <button
              type="button"
              onClick={() => setShowInquiryModal(true)}
              className="min-h-[44px] min-w-[44px] bg-[#17120F] text-[#F7EFD9] border-2 border-[#D4AF37] px-8 py-3.5 rounded text-sm font-bold hover:bg-[#0B0A09] transition-all shadow-lg"
            >
              Request Event Quote
            </button>
          </div>
        </div>
      </section>

      {/* 6. MEET CHEF ESTHER (ABOUT US SECTION) */}
      <section className="py-16 px-4 max-w-5xl mx-auto border-b border-[var(--border-card)]">
        <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl p-6 sm:p-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-full md:w-56 shrink-0">
            <FounderPhoto allowUpload={true} />
          </div>
          <div>
            <span className="text-sm uppercase tracking-widest text-[var(--text-accent)] font-semibold block mb-1">
              Culinary Artistry
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--text-primary)] mb-3">
              Meet Chef Esther Kwentua
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-body-muted)] leading-relaxed mb-4">
              &ldquo;Cooking is an expression of heritage and care. At ROCK UC FOODS, we combine traditional Nigerian recipes
              with rigorous culinary standards. Every soup, sauce, and grilled protein is crafted with pristine
              ingredients, authentic wood smoke, and heartfelt passion.&rdquo;
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-accent)]">
              <span>Follow on Instagram:</span>
              <a
                href="https://instagram.com/rock-uc-foods"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] min-w-[44px] px-2 inline-flex items-center underline font-semibold text-[var(--text-link)] hover:opacity-80"
              >
                {BUSINESS_CONTACT.instagram}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 7. DELIVERY AND CONTACT */}
      <section className="py-14 px-4 max-w-5xl mx-auto border-b border-[var(--border-card)]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-serif font-bold text-[var(--text-primary)] mb-3">Doorstep Delivery &amp; Collection</h2>
            <p className="text-base text-[var(--text-body-muted)] leading-relaxed mb-6 font-serif italic">
              &ldquo;We deliver to your doorstep across Lagos.&rdquo;
            </p>

            <div className="space-y-3 text-sm text-[var(--text-primary)]">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0 mt-1" />
                <div>
                  <strong className="block text-[var(--text-accent)]">Collection Address:</strong>
                  <span>{BUSINESS_CONTACT.collectionAddress}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0 mt-1" />
                <div>
                  <strong className="block text-[var(--text-accent)]">Direct Orders &amp; Enquiries:</strong>
                  <a
                    href={`tel:${BUSINESS_CONTACT.phoneInternational}`}
                    className="min-h-[44px] min-w-[44px] py-2 inline-flex items-center underline font-semibold text-[var(--text-link)]"
                  >
                    {BUSINESS_CONTACT.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0 mt-1" />
                <div>
                  <strong className="block text-[var(--text-accent)]">WhatsApp Support:</strong>
                  <a
                    href={BUSINESS_CONTACT.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] min-w-[44px] py-2 inline-flex items-center underline font-semibold text-[var(--text-link)]"
                  >
                    Chat with Kitchen Team
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] p-6 rounded-lg text-sm leading-relaxed">
            <h3 className="font-serif font-bold text-base text-[var(--text-accent)] mb-2">Hours &amp; Order Policies</h3>
            <p className="text-[var(--text-body-muted)] mb-3">
              Requests can be placed 24/7 online. Kitchen dispatch operates daily; staff confirm orders during operational
              hours before food preparation begins.
            </p>
            <div className="p-3 bg-[var(--bg-surface-muted)] rounded border border-[var(--border-card)] space-y-1.5 text-[var(--text-body-muted)]">
              <p>&bull; Unconfirmed requests auto-expire after 7 hours.</p>
              <p>&bull; Advance bookings accepted up to 24 hours ahead.</p>
              <p>&bull; 70% verified bank transfer deposit begins catering prep.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. MOBILE QUICK ACTIONS (Positioned inline above footer so it does not overlap BottomTabBar) */}
      <aside
        className="md:hidden bg-[var(--bg-card)] border-b border-[var(--border-card)] px-4 py-4 flex items-center justify-between gap-2"
        aria-label="Mobile quick actions"
      >
        <button
          type="button"
          onClick={onNavigateToMenu}
          className="flex-1 min-h-[44px] btn-luxury text-sm font-bold py-2.5 uppercase tracking-wider flex items-center justify-center gap-1.5"
        >
          <Utensils className="w-4 h-4" />
          <span>Order Now</span>
        </button>

        <a
          href={`tel:${BUSINESS_CONTACT.phoneInternational}`}
          className="min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded border border-[var(--border-gold)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-semibold flex items-center justify-center gap-1.5 shrink-0"
          aria-label="Call Rock UC Foods"
        >
          <Phone className="w-4 h-4 text-[var(--icon-on-surface)]" />
          <span>Call</span>
        </a>

        <a
          href={BUSINESS_CONTACT.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded border border-[var(--border-gold)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-semibold flex items-center justify-center gap-1.5 shrink-0"
          aria-label="WhatsApp Rock UC Foods"
        >
          <MessageCircle className="w-4 h-4 text-[var(--icon-on-surface)]" />
          <span>WhatsApp</span>
        </a>
      </aside>

      {/* 9. FOOTER WITH FOUNDER SECTION */}
      <footer className="bg-[var(--bg-primary)] py-12 px-4 pb-24 md:pb-12 text-sm text-[var(--text-body-muted)] border-t border-[var(--border-card)]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <RucLogo size={52} showWordmark={true} />
            <p className="text-sm text-[var(--text-body-muted)] mt-1">
              &copy; 2026 {BUSINESS_CONTACT.name}. {BUSINESS_CONTACT.location}.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[var(--bg-card)] px-4 py-2 rounded-full border border-[var(--border-card)]">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--border-gold)] shrink-0">
              <FounderPhoto allowUpload={false} />
            </div>
            <div className="text-sm">
              <span className="text-[var(--text-primary)] font-serif font-semibold block">Chef Esther Kwentua</span>
              <span className="text-[var(--text-accent)] font-medium block">Taste the Luxury</span>
            </div>
          </div>

          <nav className="flex flex-wrap justify-center gap-2 text-sm text-[var(--text-primary)] font-medium">
            <button type="button" onClick={onNavigateToMenu} className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center justify-center hover:text-[var(--text-accent)] rounded">
              Menu
            </button>
            <button type="button" onClick={() => setActiveModal('events')} className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center justify-center hover:text-[var(--text-accent)] rounded">
              Bulk Catering
            </button>
            <button type="button" onClick={() => setActiveModal('about')} className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center justify-center hover:text-[var(--text-accent)] rounded">
              About Chef Esther
            </button>
            <button type="button" onClick={() => setActiveModal('contact')} className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center justify-center hover:text-[var(--text-accent)] rounded">
              Contact
            </button>
            <button type="button" onClick={() => setActiveModal('refund-policy')} className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center justify-center hover:text-[var(--text-accent)] rounded">
              Refund Policy
            </button>
            <button type="button" onClick={() => setActiveModal('privacy')} className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center justify-center hover:text-[var(--text-accent)] rounded">
              Privacy Notice
            </button>
            <button type="button" onClick={() => setActiveModal('terms')} className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center justify-center hover:text-[var(--text-accent)] rounded">
              Terms of Service
            </button>
          </nav>
        </div>
      </footer>

      {/* MODALS FOR SUBPAGES */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl max-w-xl w-full p-6 max-h-[85vh] overflow-y-auto text-sm leading-relaxed text-[var(--text-primary)]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--border-card)]">
              <h2 className="text-base font-serif font-bold text-[var(--text-primary)] uppercase tracking-wider">
                {activeModal.replace('-', ' ')}
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                aria-label="Close modal"
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-surface-muted)] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* About Modal */}
            {activeModal === 'about' && (
              <div className="space-y-4">
                <div className="max-w-[180px] mx-auto">
                  <FounderPhoto allowUpload={true} />
                </div>
                <p className="font-bold text-[var(--text-accent)] text-center">Chef Esther Kwentua &bull; Founder</p>
                <p>
                  ROCK UC FOODS is a premium culinary company based in Lagos, Nigeria. Founded by Chef Esther Kwentua,
                  our mission is to deliver authentic Nigerian comfort cuisine crafted with uncompromising ingredient
                  quality, traditional cooking methods, and modern luxury service.
                </p>
                <p>
                  Every pot of soup and tray of jollof is prepared to order. No artificial preservatives or frozen mass
                  batches.
                </p>
              </div>
            )}

            {/* Refund Policy Modal */}
            {activeModal === 'refund-policy' && (
              <div className="space-y-4">
                <p className="font-bold text-[var(--text-accent)]">{REFUND_POLICY_DETAILS.title}</p>
                <p>{REFUND_POLICY_DETAILS.generalRules}</p>
                <div className="bg-[var(--bg-surface-muted)] p-3 rounded border border-[var(--border-card)] space-y-2">
                  <span className="font-semibold text-[var(--text-accent)] block">Fresh Meal Orders (1-20 packs):</span>
                  {REFUND_POLICY_DETAILS.freshOrders.map((rule, idx) => (
                    <div key={idx} className="flex justify-between border-b border-[var(--border-card)] py-1">
                      <span>{rule.condition}:</span>
                      <strong className="text-right pl-2">{rule.consequence}</strong>
                    </div>
                  ))}
                </div>
                <div className="bg-[var(--bg-surface-muted)] p-3 rounded border border-[var(--border-card)] space-y-2">
                  <span className="font-semibold text-[var(--text-accent)] block">Bulk &amp; Event Orders (21+ packs):</span>
                  {REFUND_POLICY_DETAILS.bulkOrders.map((rule, idx) => (
                    <div key={idx} className="flex justify-between border-b border-[var(--border-card)] py-1">
                      <span>{rule.notice}:</span>
                      <strong className="text-right pl-2">{rule.refundPercentage}</strong>
                    </div>
                  ))}
                </div>
                <p>{REFUND_POLICY_DETAILS.qualityIssues}</p>
                <p className="font-mono text-sm text-[var(--text-body-muted)]">{FCCPA_RIGHTS_STATEMENT}</p>
              </div>
            )}

            {/* Events Modal */}
            {activeModal === 'events' && (
              <div className="space-y-3">
                <p className="font-bold text-[var(--text-accent)]">Bulk Catering &amp; Event Inquiries</p>
                <p>
                  We cater weddings, corporate executive lunches, birthdays, and celebrations in Lagos. We supply food
                  in luxury warming trays or offer on-site live cooking stations.
                </p>
                <div className="p-3 bg-[var(--bg-surface-muted)] rounded border border-[var(--border-card)] space-y-1">
                  <p>&bull; 70% upfront payment initiates procurement and preparation.</p>
                  <p>&bull; 30% balance is settled on confirmed delivery.</p>
                  <p>&bull; Custom menus tailored to your guest headcount and allergen requirements.</p>
                </div>
                <a
                  href={`https://wa.me/2348033729125?text=${encodeURIComponent(
                    'Hello ROCK UC FOODS, I would like to enquire about bulk event catering for an upcoming celebration.'
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-luxury w-full min-h-[44px] inline-flex items-center justify-center text-center mt-4"
                >
                  Send Event Details on WhatsApp
                </a>
              </div>
            )}

            {/* Contact Modal */}
            {activeModal === 'contact' && (
              <div className="space-y-3">
                <p className="font-bold text-[var(--text-accent)]">Get In Touch</p>
                <p>Collection Address: {BUSINESS_CONTACT.collectionAddress}</p>
                <p>Direct Telephone: {BUSINESS_CONTACT.phone}</p>
                <p>WhatsApp: {BUSINESS_CONTACT.phone}</p>
                <p>Instagram: {BUSINESS_CONTACT.instagram}</p>
                <p>Allergen enquiries: Please notify our team before ordering.</p>
              </div>
            )}

            {/* Privacy & Terms */}
            {(activeModal === 'privacy' || activeModal === 'terms') && (
              <div className="space-y-3">
                <p className="font-bold text-[var(--text-accent)]">
                  {activeModal === 'privacy' ? 'Privacy Notice (NDPA 2023)' : 'Terms of Service'}
                </p>
                <p>
                  ROCK UC FOODS complies with the Nigeria Data Protection Act (NDPA) 2023. We collect only information
                  strictly required for order fulfilment, communication, and verified accounting records. We never sell
                  or share personal customer data.
                </p>
                <p className="font-mono text-sm text-[var(--text-body-muted)]">{INVOICE_FOOTER}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer Event Inquiry Modal */}
      <EventInquiryModal
        isOpen={showInquiryModal}
        onClose={() => setShowInquiryModal(false)}
      />
    </div>
  );
};
