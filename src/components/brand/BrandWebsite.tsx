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
    <div className="bg-[#0B0A09] text-[#F7EFD9] min-h-screen font-sans selection:bg-[#6B1230] selection:text-[#F7EFD9]">
      {/* 1. HERO SECTION */}
      <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 border-b border-[#D4AF37]/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-10 md:gap-14">
          {/* Left Column: Brand Lockup & Call to Actions */}
          <div className="flex-1 text-center md:text-left z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#17120F] border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold uppercase tracking-widest mb-6">
              <Sparkles className="w-3.5 h-3.5 text-[#F2C230]" />
              {BUSINESS_CONTACT.subtitle}
            </div>

            {/* Live HTML Gold Gradient Headline (NEVER an image) */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-black tracking-tight mb-4 leading-tight">
              <span className="gold-headline">Taste the Luxury</span>
            </h1>

            <p className="text-base sm:text-lg text-[#F7EFD9]/90 max-w-xl mx-auto md:mx-0 font-serif italic mb-8 leading-relaxed">
              Premium Nigerian dishes, crafted with tradition, served with class.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
              <button
                onClick={onNavigateToMenu}
                className="w-full sm:w-auto btn-luxury text-sm font-bold uppercase tracking-wider px-8 py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-[#6B1230]/40"
              >
                <Utensils className="w-4 h-4 text-[#F7EFD9]" />
                <span>ORDER NOW</span>
              </button>

              <a
                href={`tel:${BUSINESS_CONTACT.phoneInternational}`}
                className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded border border-[#D4AF37]/50 bg-[#17120F] text-[#F7EFD9] text-sm font-semibold hover:border-[#D4AF37] transition-all flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4 text-[#D4AF37]" />
                <span>Call {BUSINESS_CONTACT.phone}</span>
              </a>

              <a
                href={BUSINESS_CONTACT.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto min-h-[44px] px-5 py-3 rounded border border-white/10 text-[#F7EFD9]/80 text-sm font-medium hover:text-[#F7EFD9] flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <span>WhatsApp</span>
              </a>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center md:justify-start gap-2 text-xs text-[#D4AF37]">
              <Truck className="w-4 h-4 shrink-0" />
              <span className="font-serif italic text-sm text-[#F7EFD9]/90">
                We deliver to your doorstep across Lagos
              </span>
            </div>
          </div>

          {/* Right Column: Exact Sacred Founder Photo (No AI face) */}
          <div className="w-full max-w-sm md:max-w-md shrink-0 flex justify-center">
            <div className="w-full relative p-2.5 bg-[#17120F] border-2 border-[#D4AF37] rounded-xl shadow-2xl shadow-black/80">
              <FounderPhoto allowUpload={true} />
              <div className="p-3 mt-2 bg-[#0B0A09]/85 backdrop-blur rounded border border-[#D4AF37]/30 text-center">
                <span className="font-serif font-bold text-sm text-[#F7EFD9] block">
                  Chef Esther Kwentua
                </span>
                <span className="text-[11px] text-[#D4AF37] uppercase tracking-wider block">
                  Executive Chef & Founder
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THREE PILLARS */}
      <section className="bg-[#17120F] py-12 px-4 border-b border-white/10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full border border-[#D4AF37] bg-[#0B0A09] flex items-center justify-center mx-auto mb-4 text-[#D4AF37]">
              <Utensils className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#F7EFD9] mb-2">Exquisite Menu</h3>
            <p className="text-xs text-[#F7EFD9]/70 leading-relaxed">
              Authentic heritage recipes refined with culinary mastery, authentic spices, and luxury presentation.
            </p>
          </div>

          <div className="text-center p-4 border-y md:border-y-0 md:border-x border-white/10">
            <div className="w-12 h-12 rounded-full border border-[#D4AF37] bg-[#0B0A09] flex items-center justify-center mx-auto mb-4 text-[#D4AF37]">
              <ChefHat className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#F7EFD9] mb-2">Fresh & Quality Ingredients</h3>
            <p className="text-xs text-[#F7EFD9]/70 leading-relaxed">
              Every dish is prepared from scratch using the freshest local ingredients sourced daily in Lagos.
            </p>
          </div>

          <div className="text-center p-4">
            <div className="w-12 h-12 rounded-full border border-[#D4AF37] bg-[#0B0A09] flex items-center justify-center mx-auto mb-4 text-[#D4AF37]">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="font-serif font-bold text-lg text-[#F7EFD9] mb-2">Unforgettable Experience</h3>
            <p className="text-xs text-[#F7EFD9]/70 leading-relaxed">
              From our smoky party jollof to bespoke bulk event catering, every bite is crafted to delight.
            </p>
          </div>
        </div>
      </section>

      {/* 3. FEATURED DISHES */}
      <section className="py-14 px-4 max-w-6xl mx-auto border-b border-white/10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#F7EFD9]">Signature Delicacies</h2>
            <p className="text-xs sm:text-sm text-[#F7EFD9]/70 mt-1">
              Curated favourites prepared fresh by Chef Esther and her kitchen team.
            </p>
          </div>
          <button
            onClick={onNavigateToMenu}
            className="text-xs font-semibold text-[#D4AF37] hover:text-[#F3D98B] flex items-center gap-1 group"
          >
            <span>View Complete Menu</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredDishes.map((dish) => (
            <article
              key={dish.id}
              className="bg-[#17120F] border border-[#D4AF37]/20 rounded-lg p-5 flex flex-col justify-between hover:border-[#D4AF37]/50 transition-all"
            >
              <div>
                <div className="w-full h-44 bg-[#0B0A09] rounded mb-3 flex items-center justify-center border border-white/5 relative overflow-hidden">
                  <span className="text-xs text-[#F7EFD9]/40 tracking-wide font-medium">Photo coming soon</span>
                  <span className="absolute top-2 left-2 bg-[#F2C230] text-[#0B0A09] text-[10px] uppercase font-bold px-2 py-0.5 rounded shadow">
                    Featured
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-serif font-bold text-base text-[#F7EFD9]">{dish.name}</h3>
                  <span className="text-sm font-bold text-[#D4AF37] price-tabular shrink-0">
                    {formatNaira(dish.priceKobo)}
                  </span>
                </div>
                <p className="text-xs text-[#F7EFD9]/70 line-clamp-2 mb-3">{dish.description}</p>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-[#F7EFD9]/60">{dish.portionLabel || 'Serves 1'}</span>
                <button
                  onClick={() => onOpenOrder(dish.id)}
                  className="bg-[#6B1230] text-[#F7EFD9] px-4 py-2 rounded font-semibold hover:bg-[#82173B]"
                >
                  Order
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 4. HOW ORDERING WORKS */}
      <section className="bg-[#F7EFD9] text-[#0B0A09] py-14 px-4 border-b border-[#D4AF37]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs uppercase tracking-widest text-[#6B1230] font-bold block mb-1">
              Seamless Process
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#0B0A09]">
              How Ordering Works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/80 p-6 rounded-lg border border-[#0B0A09]/10">
              <span className="text-4xl font-serif font-black text-[#6B1230] opacity-80 block mb-2">1</span>
              <h3 className="font-serif font-bold text-base mb-2">Choose Your Dishes</h3>
              <p className="text-xs text-[#0B0A09]/75 leading-relaxed">
                Browse our seasonal menu, select portions and accompaniments, and submit your request.
              </p>
            </div>

            <div className="bg-white/80 p-6 rounded-lg border border-[#0B0A09]/10">
              <span className="text-4xl font-serif font-black text-[#6B1230] opacity-80 block mb-2">2</span>
              <h3 className="font-serif font-bold text-base mb-2">Staff Confirmation</h3>
              <p className="text-xs text-[#0B0A09]/75 leading-relaxed">
                Our kitchen reviews availability, confirms feasibility, and verifies payment before cooking begins.
              </p>
            </div>

            <div className="bg-white/80 p-6 rounded-lg border border-[#0B0A09]/10">
              <span className="text-4xl font-serif font-black text-[#6B1230] opacity-80 block mb-2">3</span>
              <h3 className="font-serif font-bold text-base mb-2">Doorstep Delivery or Pickup</h3>
              <p className="text-xs text-[#0B0A09]/75 leading-relaxed">
                Dispatched hot and fresh directly to your doorstep or ready for pickup at our Lagos kitchen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. EVENTS AND BULK CATERING */}
      <section className="bg-[#5B2A6E] text-[#F7EFD9] py-14 px-4 border-b border-[#D4AF37]/30">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 text-[#D4AF37] text-xs font-semibold uppercase tracking-wider mb-4 border border-[#D4AF37]/30">
            <CalendarDays className="w-3.5 h-3.5" />
            Bespoke Event Catering
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold mb-4">Celebrate with Luxury Catering</h2>
          <p className="text-sm sm:text-base text-[#F7EFD9]/90 max-w-2xl mx-auto mb-6 leading-relaxed">
            Weddings, birthdays, corporate banquets, and celebrations. Sized for 21 to 5,000 guests with custom buffet
            setups, food trays, or on-site live cooking.
          </p>
          <div className="text-xs text-[#F7EFD9]/80 mb-6 font-mono bg-black/25 py-2 px-4 rounded-full inline-block border border-white/10">
            Terms: 70% upfront deposit upon invoice &bull; 30% balance on delivery
          </div>
          <div>
            <button
              onClick={() => setShowInquiryModal(true)}
              className="bg-[#17120F] text-[#F7EFD9] border-2 border-[#D4AF37] px-8 py-3.5 rounded text-sm font-bold hover:bg-[#0B0A09] transition-all shadow-lg"
            >
              Request Event Quote
            </button>
          </div>
        </div>
      </section>

      {/* 6. MEET CHEF ESTHER (ABOUT US SECTION) */}
      <section className="py-16 px-4 max-w-5xl mx-auto border-b border-white/10">
        <div className="bg-[#17120F] border border-[#D4AF37]/30 rounded-xl p-6 sm:p-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-full md:w-56 shrink-0">
            <FounderPhoto allowUpload={true} />
          </div>
          <div>
            <span className="text-xs uppercase tracking-widest text-[#D4AF37] font-semibold block mb-1">
              Culinary Artistry
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#F7EFD9] mb-3">
              Meet Chef Esther Kwentua
            </h2>
            <p className="text-sm text-[#F7EFD9]/80 leading-relaxed mb-4">
              &ldquo;Cooking is an expression of heritage and care. At ROCK UC FOODS, we combine traditional Nigerian recipes
              with rigorous culinary standards. Every soup, sauce, and grilled protein is crafted with pristine
              ingredients, authentic wood smoke, and heartfelt passion.&rdquo;
            </p>
            <div className="flex items-center gap-3 text-xs text-[#D4AF37]">
              <span>Follow on Instagram:</span>
              <a
                href="https://instagram.com/rock-uc-foods"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold hover:text-[#F3D98B]"
              >
                {BUSINESS_CONTACT.instagram}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 7. DELIVERY AND CONTACT */}
      <section className="py-14 px-4 max-w-5xl mx-auto border-b border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#F7EFD9] mb-3">Doorstep Delivery & Collection</h2>
            <p className="text-sm text-[#F7EFD9]/80 leading-relaxed mb-6 font-serif italic">
              &ldquo;We deliver to your doorstep across Lagos.&rdquo;
            </p>

            <div className="space-y-3 text-xs text-[#F7EFD9]/90">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[#D4AF37]">Collection Address:</strong>
                  <span>{BUSINESS_CONTACT.collectionAddress}</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[#D4AF37]">Direct Orders & Enquiries:</strong>
                  <a href={`tel:${BUSINESS_CONTACT.phoneInternational}`} className="underline">
                    {BUSINESS_CONTACT.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-[#D4AF37]">WhatsApp Support:</strong>
                  <a href={BUSINESS_CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    Chat with Kitchen Team
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#17120F] border border-white/10 p-6 rounded-lg text-xs leading-relaxed">
            <h3 className="font-serif font-bold text-sm text-[#D4AF37] mb-2">Hours & Order Policies</h3>
            <p className="text-[#F7EFD9]/75 mb-3">
              Requests can be placed 24/7 online. Kitchen dispatch operates daily; staff confirm orders during operational
              hours before food preparation begins.
            </p>
            <div className="p-3 bg-[#0B0A09] rounded border border-white/5 space-y-1 text-[#F7EFD9]/70">
              <p>&bull; Unconfirmed requests auto-expire after 7 hours.</p>
              <p>&bull; Advance bookings accepted up to 24 hours ahead.</p>
              <p>&bull; 70% verified bank transfer deposit begins catering prep.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. FOOTER WITH FOUNDER SECTION */}
      <footer className="bg-[#0B0A09] py-12 px-4 pb-24 md:pb-12 text-xs text-[#F7EFD9]/60 border-t border-white/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <RucLogo size={52} showWordmark={true} />
            <p className="text-[11px] text-[#F7EFD9]/40 mt-1">
              &copy; 2026 {BUSINESS_CONTACT.name}. {BUSINESS_CONTACT.location}.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#17120F] px-4 py-2 rounded-full border border-white/10">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-[#D4AF37]/50 shrink-0">
              <FounderPhoto allowUpload={false} />
            </div>
            <div className="text-[11px]">
              <span className="text-[#F7EFD9] font-serif font-semibold block">Chef Esther Kwentua</span>
              <span className="text-[#D4AF37] block">Taste the Luxury</span>
            </div>
          </div>

          <nav className="flex flex-wrap justify-center gap-5 text-xs text-[#F7EFD9]/80 font-medium">
            <button onClick={onNavigateToMenu} className="hover:text-[#D4AF37]">Menu</button>
            <button onClick={() => setActiveModal('events')} className="hover:text-[#D4AF37]">Bulk Catering</button>
            <button onClick={() => setActiveModal('about')} className="hover:text-[#D4AF37]">About Chef Esther</button>
            <button onClick={() => setActiveModal('contact')} className="hover:text-[#D4AF37]">Contact</button>
            <button onClick={() => setActiveModal('refund-policy')} className="hover:text-[#D4AF37]">Refund Policy</button>
            <button onClick={() => setActiveModal('privacy')} className="hover:text-[#D4AF37]">Privacy Notice</button>
            <button onClick={() => setActiveModal('terms')} className="hover:text-[#D4AF37]">Terms of Service</button>
          </nav>
        </div>
      </footer>

      {/* 9. MOBILE STICKY BOTTOM BAR */}
      <aside
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#17120F]/95 backdrop-blur border-t border-[#D4AF37]/30 px-3 py-2 flex items-center justify-between gap-2 shadow-2xl"
        aria-label="Mobile quick actions"
      >
        <button
          onClick={onNavigateToMenu}
          className="flex-1 btn-luxury text-xs font-bold py-3 uppercase tracking-wider flex items-center justify-center gap-1.5"
        >
          <Utensils className="w-4 h-4" />
          <span>Order Now</span>
        </button>

        <a
          href={`tel:${BUSINESS_CONTACT.phoneInternational}`}
          className="min-h-[44px] px-3.5 py-2.5 rounded border border-white/10 bg-[#0B0A09] text-[#F7EFD9] text-xs font-semibold flex items-center justify-center gap-1 shrink-0"
          aria-label="Call Rock UC Foods"
        >
          <Phone className="w-4 h-4 text-[#D4AF37]" />
          <span>Call</span>
        </a>

        <a
          href={BUSINESS_CONTACT.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[44px] px-3.5 py-2.5 rounded border border-white/10 bg-[#0B0A09] text-[#F7EFD9] text-xs font-semibold flex items-center justify-center gap-1 shrink-0"
          aria-label="WhatsApp Rock UC Foods"
        >
          <MessageCircle className="w-4 h-4 text-[#25D366]" />
          <span>WhatsApp</span>
        </a>
      </aside>

      {/* MODALS FOR SUBPAGES */}
      {activeModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="bg-[#17120F] border border-[#D4AF37]/50 rounded-xl max-w-xl w-full p-6 max-h-[85vh] overflow-y-auto text-xs leading-relaxed text-[#F7EFD9]/90">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
              <h2 className="text-base font-serif font-bold text-[#F7EFD9] uppercase tracking-wider">
                {activeModal.replace('-', ' ')}
              </h2>
              <button onClick={() => setActiveModal(null)} className="text-white/60 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* About Modal */}
            {activeModal === 'about' && (
              <div className="space-y-4">
                <div className="max-w-[180px] mx-auto">
                  <FounderPhoto allowUpload={true} />
                </div>
                <p className="font-bold text-[#D4AF37] text-center">Chef Esther Kwentua &bull; Founder</p>
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
                <p className="font-bold text-[#D4AF37]">{REFUND_POLICY_DETAILS.title}</p>
                <p>{REFUND_POLICY_DETAILS.generalRules}</p>
                <div className="bg-[#0B0A09] p-3 rounded border border-white/10 space-y-2">
                  <span className="font-semibold text-[#D4AF37] block">Fresh Meal Orders (1-20 packs):</span>
                  {REFUND_POLICY_DETAILS.freshOrders.map((rule, idx) => (
                    <div key={idx} className="flex justify-between border-b border-white/5 py-1">
                      <span>{rule.condition}:</span>
                      <strong className="text-right pl-2">{rule.consequence}</strong>
                    </div>
                  ))}
                </div>
                <div className="bg-[#0B0A09] p-3 rounded border border-white/10 space-y-2">
                  <span className="font-semibold text-[#D4AF37] block">Bulk & Event Orders (21+ packs):</span>
                  {REFUND_POLICY_DETAILS.bulkOrders.map((rule, idx) => (
                    <div key={idx} className="flex justify-between border-b border-white/5 py-1">
                      <span>{rule.notice}:</span>
                      <strong className="text-right pl-2">{rule.refundPercentage}</strong>
                    </div>
                  ))}
                </div>
                <p>{REFUND_POLICY_DETAILS.qualityIssues}</p>
                <p className="font-mono text-[11px] text-[#F7EFD9]/70">{FCCPA_RIGHTS_STATEMENT}</p>
              </div>
            )}

            {/* Events Modal */}
            {activeModal === 'events' && (
              <div className="space-y-3">
                <p className="font-bold text-[#D4AF37]">Bulk Catering & Event Inquiries</p>
                <p>
                  We cater weddings, corporate executive lunches, birthdays, and celebrations in Lagos. We supply food
                  in luxury warming trays or offer on-site live cooking stations.
                </p>
                <div className="p-3 bg-[#0B0A09] rounded border border-white/10 space-y-1">
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
                  className="btn-luxury w-full text-center block mt-4"
                >
                  Send Event Details on WhatsApp
                </a>
              </div>
            )}

            {/* Contact Modal */}
            {activeModal === 'contact' && (
              <div className="space-y-3">
                <p className="font-bold text-[#D4AF37]">Get In Touch</p>
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
                <p className="font-bold text-[#D4AF37]">
                  {activeModal === 'privacy' ? 'Privacy Notice (NDPA 2023)' : 'Terms of Service'}
                </p>
                <p>
                  ROCK UC FOODS complies with the Nigeria Data Protection Act (NDPA) 2023. We collect only information
                  strictly required for order fulfilment, communication, and verified accounting records. We never sell
                  or share personal customer data.
                </p>
                <p className="font-mono text-[10px] text-[#F7EFD9]/60">{INVOICE_FOOTER}</p>
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
