import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { publicMetadata } from '../../src/seo/metadata';
import { safeJsonLd, menuJsonLd } from '../../src/seo/jsonld';
import { menuRepository } from '../../src/menu/data';
import { getActiveMenuWithDetails } from '../../src/menu/read-model';
import { MenuMotionClient } from '../../src/components/menu/MenuMotionClient';
import { formatKobo, MAX_KOBO } from '../../src/lib/money';
import { getLatestSiteContent } from '../../src/content/service';
import { ALLERGEN_NOTICE } from '../../src/policy/content';
import { LAGOS_DELIVERY_ZONES } from '../../src/order/deliveryZones';
import { ContactFooter } from '../../src/components/brand/ContactFooter';
import {
  MessageCircle,
  Calculator,
  Phone,
  ShieldAlert,
  Clock,
  Truck,
  Quote,
} from 'lucide-react';

export const metadata: Metadata = publicMetadata({
  title: 'Menu & Pricing | ROCK UC FOODS Lagos',
  description:
    'Explore our luxury Nigerian menu: authentic party jollof, heritage soups, smokey grills, and freshly prepared dishes delivered across Lagos.',
  path: '/menu',
});

export const dynamic = 'force-dynamic';

export default function PublicMenuPage() {
  const content = getLatestSiteContent();
  const contact = content.contact;
  const hours = content.hours;
  const sections = content.sections;
  const reviews = content.reviews.filter((r) => r.permissionConfirmed);

  const categories = menuRepository.getCategories();
  const allItems = menuRepository.getItems();

  // Phase 2B: Server-authoritative read model formatting options, tiers, and heat
  const formattedItems = getActiveMenuWithDetails(allItems);

  // Filter valid published items for JSON-LD (base price or size tiers)
  const validItems = allItems.filter((i) => {
    return (
      i.status === 'published' &&
      i.isAvailable &&
      ((i.priceKobo > 0n && i.priceKobo <= MAX_KOBO) || (i.sizeTiers && i.sizeTiers.length > 0))
    );
  });

  const whatsappPhone = (contact.whatsapp || '+2348033729125').replace(/\D/g, '');
  const phoneTel = `tel:${(contact.phone || '08033729125').replace(/\s+/g, '')}`;

  return (
    <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex flex-col font-sans min-w-0 max-w-full">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(menuJsonLd(validItems)),
        }}
      />

      {/* Top Banner Navigation */}
      <header className="border-b border-[#D4AF37]/30 bg-[#17120F]/90 backdrop-blur sticky top-0 z-40 px-4 py-3 min-w-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-serif font-bold text-lg text-[#F7EFD9] tracking-wider">
              ROCK UC FOODS
            </span>
          </Link>
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/catering"
              className="hidden sm:inline-block hover:text-[#D4AF37] transition-colors"
            >
              Catering &amp; Events
            </Link>
            <Link
              href="/estimate"
              className="bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50 px-3 py-1.5 rounded font-semibold hover:border-[#D4AF37] transition-all flex items-center gap-1.5"
            >
              <Calculator className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Get Estimate</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-12 min-w-0">
        {/* Page Hero & Header */}
        <div className="space-y-4 border-b border-white/10 pb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#F7EFD9] tracking-tight">
            ROCK UC FOODS Menu &amp; Pricing
          </h1>
          <p className="text-sm text-[#F7EFD9]/80 max-w-2xl leading-relaxed">
            Authentic Nigerian party jollof, heritage soups, grilled meats, and bespoke feast packages. Cooked fresh to order in Lagos with premium ingredients.
          </p>

          {/* Ordering Hours & 24/7 Notice */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-white/70 pt-2">
            {hours.orderingOpen247 && (
              <span className="inline-flex items-center gap-1.5 text-[#D4AF37] font-semibold bg-[#17120F] px-3 py-1 rounded-full border border-[#D4AF37]/30">
                <Clock className="w-3.5 h-3.5" />
                Order requests are accepted any time
              </span>
            )}
            <span>
              {hours.kitchenNote} ({hours.leadTimeHours}-hour minimum lead time applies to all orders).
            </span>
          </div>

          {/* Top Allergen Notice Banner */}
          <div className="p-4 rounded-xl bg-[#17120F] border border-[#D4AF37]/30 flex items-start gap-3 mt-4">
            <ShieldAlert className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-[#D4AF37] uppercase tracking-wider text-[11px]">
                Allergen Notice
              </span>
              <p className="text-white/80 leading-relaxed">
                {ALLERGEN_NOTICE}
              </p>
              <p className="text-[11px] text-white/50 pt-1">
                View our complete cancellation terms at{' '}
                <Link href="/terms" className="text-[#D4AF37] underline hover:text-[#F3D98B]">
                  Terms &amp; Refund Policy
                </Link>.
              </p>
            </div>
          </div>
        </div>

        {/* Empty Menu State */}
        {formattedItems.length === 0 ? (
          <div className="text-center py-16 bg-[#17120F] rounded-2xl border border-white/10 p-6 space-y-4 max-w-xl mx-auto">
            <h2 className="text-xl font-serif font-bold text-[#F7EFD9]">
              Our Menu is Currently Being Updated
            </h2>
            <p className="text-xs text-white/70 leading-relaxed">
              Chef Esther is crafting the next seasonal feast. To order directly or inquire about today&apos;s available fresh dishes, message us on WhatsApp.
            </p>
            <div className="pt-2">
              <a
                href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent('Hello Chef Esther, I would like to inquire about ordering food today.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37] px-4 py-2.5 rounded-lg text-xs font-bold hover:scale-105 transition-all shadow-lg"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <span>Inquire on WhatsApp ({contact.whatsapp})</span>
              </a>
            </div>
          </div>
        ) : (
          /* Live Menu Sections */
          <div className="space-y-12">
            {categories.map((cat) => {
              const catItems = formattedItems.filter((i) => i.categoryId === cat.id);
              if (catItems.length === 0) return null;

              // Find custom section name or fallback to category name
              const matchedSection = sections.find(
                (s) => s.categorySlug.toLowerCase() === cat.name.toLowerCase() ||
                       s.displayName.toLowerCase() === cat.name.toLowerCase()
              );
              const displayName = matchedSection ? matchedSection.displayName : cat.name;
              const plainLabel = matchedSection ? matchedSection.plainLabel : `${cat.name} dishes and specials`;

              return (
                <section key={cat.id} className="space-y-6">
                  <div className="border-b border-[#D4AF37]/20 pb-2">
                    <h2 className="font-serif text-2xl font-bold text-[#F7EFD9]">
                      {displayName}
                    </h2>
                    <span className="text-xs uppercase font-bold tracking-widest text-[#D4AF37]">
                      {plainLabel}
                    </span>
                  </div>

                  <MenuMotionClient items={catItems} whatsappPhone={whatsappPhone} />
                </section>
              );
            })}
          </div>
        )}

        {/* Section 7: Delivery Areas & Fees */}
        <section className="bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <Truck className="w-5 h-5" />
            <h2 className="font-serif text-xl font-bold text-[#F7EFD9]">
              Lagos Delivery Areas &amp; Rates
            </h2>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">
            All orders are freshly prepared and dispatched directly from our Lagos kitchen in temperature-controlled packaging.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {LAGOS_DELIVERY_ZONES.filter((z) => z.isActive).map((zone) => (
              <div
                key={zone.id}
                className="bg-[#0B0A09] border border-white/10 p-3.5 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#F7EFD9]">{zone.name}</span>
                  <span className="font-mono text-[#D4AF37] font-semibold">
                    {formatKobo(zone.feeKobo)}
                  </span>
                </div>
                <p className="text-[11px] text-white/50">
                  {zone.areas.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 9: Real Reviews (Rendered ONLY if permissionConfirmed reviews exist) */}
        {reviews.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-[#D4AF37]/20 pb-2">
              <h2 className="font-serif text-2xl font-bold text-[#F7EFD9]">
                Customer Testimonials
              </h2>
              <span className="text-xs uppercase font-bold tracking-widest text-[#D4AF37]">
                Verified Client Feedback
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reviews.map((rev, idx) => (
                <div
                  key={idx}
                  className="bg-[#17120F] border border-white/10 rounded-xl p-5 space-y-3"
                >
                  <Quote className="w-5 h-5 text-[#D4AF37]/50" />
                  <p className="text-xs text-[#F7EFD9]/80 italic leading-relaxed">
                    &ldquo;{rev.quote}&rdquo;
                  </p>
                  <div className="text-[11px] text-[#D4AF37] font-semibold flex items-center justify-between">
                    <span>{rev.name}</span>
                    <span className="text-white/40">{rev.dateText}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Section 5: Contact Block Footer */}
      <ContactFooter />
    </div>
  );
}
