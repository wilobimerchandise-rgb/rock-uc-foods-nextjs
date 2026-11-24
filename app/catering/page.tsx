import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { publicMetadata } from '../../src/seo/metadata';
import { getEstimatorConfig } from '../../src/estimator/config';
import { formatKobo } from '../../src/lib/money';
import { getLatestSiteContent } from '../../src/content/service';
import { ALLERGEN_NOTICE } from '../../src/policy/content';
import { LAGOS_DELIVERY_ZONES } from '../../src/order/deliveryZones';
import { ContactFooter } from '../../src/components/brand/ContactFooter';
import {
  Calculator,
  MessageCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Building,
  CheckCircle2,
  Truck,
} from 'lucide-react';

export const metadata: Metadata = publicMetadata({
  title: 'Catering & Event Packages | ROCK UC FOODS',
  description:
    'Premium Nigerian catering for weddings, corporate banquets, and milestone celebrations in Lagos. View packages and get an instant quote.',
  path: '/catering',
});

export const dynamic = 'force-dynamic';

export default function PublicCateringPage() {
  const content = getLatestSiteContent();
  const contact = content.contact;
  const hours = content.hours;

  const estimatorConfig = getEstimatorConfig();
  const isSampleConfig = estimatorConfig.version === 1;

  const whatsappPhone = (contact.whatsapp || '+2348033729125').replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col font-sans min-w-0 max-w-full">
      {/* Top Banner Navigation */}
      <header className="border-b border-[var(--border-card)] bg-[var(--bg-header)] backdrop-blur sticky top-0 z-40 px-4 py-2 min-w-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <Link
            href="/"
            className="min-h-[44px] inline-flex items-center font-serif font-bold text-lg text-[var(--text-primary)] tracking-wider"
          >
            ROCK UC FOODS
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 text-sm">
            <Link
              href="/menu"
              className="hidden sm:inline-flex items-center min-h-[44px] px-2 text-[var(--text-body-muted)] hover:text-[var(--text-accent)] transition-colors"
            >
              Public Menu
            </Link>
            <Link
              href="/estimate"
              className="min-h-[44px] bg-[#6B1230] text-[#F7EFD9] hover:bg-[#82173B] border border-[#D4AF37]/60 px-3.5 py-2 rounded-lg font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Calculator className="w-4 h-4 text-[#F3D98B] shrink-0" />
              <span>Instant Estimator</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-12 min-w-0">
        {/* Header Hero */}
        <div className="space-y-4 border-b border-[var(--border-subtle-card)] pb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[var(--text-primary)] tracking-tight">
            Luxury Catering &amp; Event Banquets in Lagos
          </h1>
          <p className="text-base text-[var(--text-body-muted)] max-w-2xl leading-relaxed">
            From intimate private dinners to grand executive weddings and corporate banquets. Taste authentic Nigerian tradition delivered with 5-star elegance.
          </p>

          <div className="flex flex-wrap items-center gap-3 text-sm pt-2">
            <span className="inline-flex items-center gap-1.5 text-[var(--text-accent)] font-semibold bg-[var(--bg-card)] px-3 py-1.5 rounded-lg border border-[var(--border-card)]">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{hours.leadTimeHours}-hour minimum lead time</span>
            </span>
            <span className="text-[var(--text-body-muted)]">
              21 or more packs constitutes a bulk event order confirmed directly by Chef Esther.
            </span>
          </div>
        </div>

        {/* Section 6: Bulk & Event Policy Terms */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-xl p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-lg bg-[#6B1230] border border-[#D4AF37]/60 flex items-center justify-center text-[#F3D98B]">
              <Building className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-base text-[var(--text-primary)]">Bulk &amp; Event Orders</h2>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              21 or more packs is classified as an event booking. Our executive catering team reserves production capacity exclusively for your celebration date.
            </p>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-xl p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-lg bg-[var(--status-success-bg)] border border-[var(--status-success-border)] flex items-center justify-center text-[var(--status-success-text)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-base text-[var(--text-primary)]">Verified Bank Deposit</h2>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              Direct bank transfer only. Date reservation and kitchen procurement begin strictly upon manual credit confirmation in our corporate bank statement.
            </p>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] rounded-xl p-5 space-y-2.5">
            <div className="w-10 h-10 rounded-lg bg-[var(--status-info-bg)] border border-[var(--status-info-border)] flex items-center justify-center text-[var(--status-info-text)]">
              <Clock className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-base text-[var(--text-primary)]">Production Lead Time</h2>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              Minimum {hours.leadTimeHours} hours advance notice required. Large banquets over 100 guests recommend booking 7–14 days ahead.
            </p>
          </div>
        </div>

        {/* Sample Pricing Notice (if version 1 placeholder) */}
        {isSampleConfig && (
          <div className="p-4 rounded-xl bg-[var(--status-warning-bg)] border border-[var(--status-warning-border)] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--status-warning-text)] shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-[var(--status-warning-text)]">
              <span className="font-bold uppercase tracking-wider block">
                Sample Pricing Configuration
              </span>
              <p className="leading-relaxed">
                The prices below reflect baseline sample estimation tiers. Final catering packages and menu selections are confirmed directly with Chef Esther.
              </p>
            </div>
          </div>
        )}

        {/* Catering Packages from Estimator Configuration */}
        <section className="space-y-6">
          <div className="border-b border-[var(--border-card)] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[var(--text-primary)]">
                Catering Feast Tiers
              </h2>
              <span className="text-sm uppercase font-bold tracking-wider text-[var(--text-accent)]">
                Packages from our live estimator
              </span>
            </div>
            <Link
              href="/estimate"
              className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-bold text-[var(--text-accent)] hover:underline"
            >
              <span>Launch interactive estimator</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {estimatorConfig.tiers.map((tier) => (
              <div
                key={tier.id}
                className="bg-[var(--bg-card)] border border-[var(--border-subtle-card)] hover:border-[var(--border-gold)] rounded-2xl p-6 flex flex-col justify-between space-y-4 transition-all shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-serif font-bold text-lg text-[var(--text-primary)]">
                      {tier.name}
                    </h3>
                    <span className="text-sm font-semibold px-2.5 py-0.5 rounded bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/40 whitespace-nowrap">
                      {tier.minGuests}–{tier.maxGuests} guests
                    </span>
                  </div>

                  <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
                    {tier.description}
                  </p>

                  <div className="pt-2 border-t border-[var(--border-subtle-card)]">
                    <span className="text-sm text-[var(--text-body-muted)] block">Investment:</span>
                    <span className="font-mono text-xl font-bold text-[var(--text-accent)] price-tabular">
                      {formatKobo(tier.pricePerGuestKobo)}
                    </span>
                    <span className="text-sm text-[var(--text-body-muted)]"> / guest</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle-card)] space-y-2.5">
                  <Link
                    href={`/estimate?tier=${encodeURIComponent(tier.id)}`}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-[#6B1230] text-[#F7EFD9] hover:bg-[#82173B] border border-[#D4AF37]/60 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-md"
                  >
                    <Calculator className="w-4 h-4 text-[#F3D98B] shrink-0" />
                    <span>Calculate Total for {tier.name}</span>
                  </Link>
                  <a
                    href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
                      `Hello Chef Esther, I would like to inquire about booking the ${tier.name} catering package for an event.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-card)] px-4 py-2.5 rounded-lg text-sm font-semibold hover:border-[var(--border-gold)] transition-all"
                  >
                    <MessageCircle className="w-4 h-4 text-[var(--text-money-positive)] shrink-0" />
                    <span>Inquire via WhatsApp</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 7: Delivery Areas & Fees */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-[var(--text-accent)]">
            <Truck className="w-5 h-5 shrink-0" />
            <h2 className="font-serif text-xl font-bold text-[var(--text-primary)]">
              Event Logistics &amp; Lagos Delivery Areas
            </h2>
          </div>
          <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
            We provide on-site catering setups, banquet delivery, and chafing stations across all key Lagos districts.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {LAGOS_DELIVERY_ZONES.filter((z) => z.isActive).map((zone) => (
              <div
                key={zone.id}
                className="bg-[var(--bg-primary)] border border-[var(--border-subtle-card)] p-4 rounded-xl space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-[var(--text-primary)]">{zone.name}</span>
                  <span className="font-mono text-[var(--text-accent)] font-semibold price-tabular shrink-0">
                    {formatKobo(zone.feeKobo)}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-body-muted)]">
                  {zone.areas.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Allergen Notice Banner */}
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-card)] flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[var(--text-accent)] shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <span className="font-bold text-[var(--text-accent)] uppercase tracking-wider block">
              Food Safety &amp; Dietary Advice
            </span>
            <p className="text-[var(--text-body-muted)] leading-relaxed">
              {ALLERGEN_NOTICE}
            </p>
          </div>
        </div>
      </main>

      {/* Section 5: Contact Block Footer */}
      <ContactFooter />
    </div>
  );
}
