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

  const formattedItems = getActiveMenuWithDetails(allItems);

  const validItems = allItems.filter((i) => {
    return (
      i.status === 'published' &&
      i.isAvailable &&
      ((i.priceKobo > 0n && i.priceKobo <= MAX_KOBO) || (i.sizeTiers && i.sizeTiers.length > 0))
    );
  });

  const whatsappPhone = (contact.whatsapp || '+2348033729125').replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans min-w-0 max-w-full">
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(menuJsonLd(validItems)),
        }}
      />

      {/* Top Banner Navigation */}
      <header className="border-b border-[var(--border-gold)] bg-[var(--bg-header)] backdrop-blur sticky top-0 z-40 px-4 py-2 min-w-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center min-h-[44px] gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-lg px-1"
          >
            <span className="font-serif font-bold text-lg text-[var(--text-primary)] tracking-wider whitespace-nowrap">
              ROCK UC FOODS
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm shrink-0">
            <Link
              href="/catering"
              className="hidden sm:inline-flex items-center min-h-[44px] px-2 font-medium text-[var(--text-primary)] hover:text-[var(--text-accent)] transition-colors whitespace-nowrap"
            >
              Catering &amp; Events
            </Link>
            <Link
              href="/estimate"
              className="min-h-[44px] bg-[var(--cta-wine-bg)] text-[var(--cta-wine-text)] border border-[var(--border-gold)] px-4 py-2 rounded-lg font-semibold hover:opacity-95 transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Calculator className="w-4 h-4 text-[var(--icon-on-wine)] shrink-0" />
              <span>Get Estimate</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-12 min-w-0">
        {/* Page Hero & Header */}
        <div className="space-y-4 border-b border-[var(--border-card)] pb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight">
            ROCK UC FOODS Menu &amp; Pricing
          </h1>
          <p className="text-base text-[var(--text-body-muted)] max-w-2xl leading-relaxed">
            Authentic Nigerian party jollof, heritage soups, grilled meats, and bespoke feast
            packages. Cooked fresh to order in Lagos with premium ingredients.
          </p>

          {/* Ordering Hours & 24/7 Notice */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-body-muted)] pt-2">
            {hours.orderingOpen247 && (
              <span className="inline-flex items-center gap-2 text-[var(--text-accent)] font-semibold bg-[var(--bg-card)] px-3.5 py-1.5 rounded-lg border border-[var(--border-card)]">
                <Clock className="w-4 h-4 shrink-0" />
                Order requests are accepted any time
              </span>
            )}
            <span>
              {hours.kitchenNote} ({hours.leadTimeHours}-hour minimum lead time applies to all
              orders).
            </span>
          </div>

          {/* Top Allergen Notice Banner */}
          <div className="p-4 sm:p-5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] flex items-start gap-3 mt-4">
            <ShieldAlert className="w-5 h-5 text-[var(--icon-on-surface)] shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-sm">
              <span className="font-bold text-[var(--text-accent)] uppercase tracking-wider block">
                Allergen Notice
              </span>
              <p className="text-[var(--text-body-muted)] leading-relaxed">{ALLERGEN_NOTICE}</p>
              <p className="text-sm text-[var(--text-body-muted)] pt-1">
                View our complete cancellation terms at{' '}
                <Link
                  href="/refund-policy"
                  className="inline-flex items-center min-h-[44px] text-[var(--text-link)] font-semibold underline hover:opacity-85"
                >
                  Refund &amp; Cancellation Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Empty Menu State */}
        {formattedItems.length === 0 ? (
          <div className="text-center py-16 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-card)] p-6 space-y-4 max-w-xl mx-auto">
            <h2 className="text-xl font-serif font-bold text-[var(--text-primary)]">
              Our Menu is Currently Being Updated
            </h2>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              Chef Esther is crafting the next seasonal feast. To order directly or inquire about
              today&apos;s available fresh dishes, message us on WhatsApp.
            </p>
            <div className="pt-2">
              <a
                href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent('Hello Chef Esther, I would like to inquire about ordering food today.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center min-h-[44px] gap-2 bg-[var(--cta-wine-bg)] text-[var(--cta-wine-text)] border border-[var(--border-gold)] px-5 py-2.5 rounded-lg text-sm font-bold hover:opacity-95 transition-all shadow-lg"
              >
                <MessageCircle className="w-4 h-4 text-[var(--icon-on-wine)] shrink-0" />
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

              const matchedSection = sections.find(
                (s) =>
                  s.categorySlug.toLowerCase() === cat.name.toLowerCase() ||
                  s.displayName.toLowerCase() === cat.name.toLowerCase()
              );
              const displayName = matchedSection ? matchedSection.displayName : cat.name;
              const plainLabel = matchedSection
                ? matchedSection.plainLabel
                : `${cat.name} dishes and specials`;

              return (
                <section key={cat.id} className="space-y-6">
                  <div className="border-b border-[var(--border-card)] pb-2">
                    <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
                      {displayName}
                    </h2>
                    <span className="text-sm uppercase font-bold tracking-widest text-[var(--text-accent)]">
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
        <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-[var(--text-accent)]">
            <Truck className="w-5 h-5 shrink-0" />
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Lagos Delivery Areas &amp; Rates
            </h2>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
            All orders are freshly prepared and dispatched directly from our Lagos kitchen in
            temperature-controlled packaging.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {LAGOS_DELIVERY_ZONES.filter((z) => z.isActive).map((zone) => (
              <div
                key={zone.id}
                className="bg-[var(--bg-surface-muted)] border border-[var(--border-card)] p-4 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-[var(--text-primary)]">{zone.name}</span>
                  <span className="font-mono price-tabular text-[var(--text-accent)] font-semibold whitespace-nowrap">
                    {formatKobo(zone.feeKobo)}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-body-muted)]">{zone.areas.join(', ')}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 9: Real Reviews (Rendered ONLY if permissionConfirmed reviews exist) */}
        {reviews.length > 0 && (
          <section className="space-y-4">
            <div className="border-b border-[var(--border-card)] pb-2">
              <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
                Customer Testimonials
              </h2>
              <span className="text-sm uppercase font-bold tracking-widest text-[var(--text-accent)]">
                Verified Client Feedback
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reviews.map((rev, idx) => (
                <div
                  key={idx}
                  className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-5 space-y-3"
                >
                  <Quote className="w-5 h-5 text-[var(--icon-on-surface)]" />
                  <p className="text-sm text-[var(--text-primary)] italic leading-relaxed">
                    &ldquo;{rev.quote}&rdquo;
                  </p>
                  <div className="text-sm text-[var(--text-accent)] font-semibold flex items-center justify-between">
                    <span>{rev.name}</span>
                    <span className="text-[var(--text-body-muted)]">{rev.dateText}</span>
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
