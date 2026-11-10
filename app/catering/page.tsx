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
    <div className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] flex flex-col font-sans min-w-0 max-w-full">
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
              href="/menu"
              className="hidden sm:inline-block hover:text-[#D4AF37] transition-colors"
            >
              Public Menu
            </Link>
            <Link
              href="/estimate"
              className="bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50 px-3 py-1.5 rounded font-semibold hover:border-[#D4AF37] transition-all flex items-center gap-1.5"
            >
              <Calculator className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Instant Estimator</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 space-y-12 min-w-0">
        {/* Header Hero */}
        <div className="space-y-4 border-b border-white/10 pb-8">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#F7EFD9] tracking-tight">
            Luxury Catering &amp; Event Banquets in Lagos
          </h1>
          <p className="text-sm text-[#F7EFD9]/80 max-w-2xl leading-relaxed">
            From intimate private dinners to grand executive weddings and corporate banquets. Taste authentic Nigerian tradition delivered with 5-star elegance.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-white/70 pt-2">
            <span className="inline-flex items-center gap-1.5 text-[#D4AF37] font-semibold bg-[#17120F] px-3 py-1 rounded-full border border-[#D4AF37]/30">
              <Clock className="w-3.5 h-3.5" />
              {hours.leadTimeHours}-hour minimum lead time
            </span>
            <span className="text-white/60">
              21 or more packs constitutes a bulk event order confirmed directly by Chef Esther.
            </span>
          </div>
        </div>

        {/* Section 6: Bulk & Event Policy Terms */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#17120F] border border-white/10 rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-[#6B1230]/40 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <Building className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-[#F7EFD9]">Bulk &amp; Event Orders</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              21 or more packs is classified as an event booking. Our executive catering team reserves production capacity exclusively for your celebration date.
            </p>
          </div>

          <div className="bg-[#17120F] border border-white/10 rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-[#F7EFD9]">Verified Bank Deposit</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Direct bank transfer only. Date reservation and kitchen procurement begin strictly upon manual credit confirmation in our corporate bank statement.
            </p>
          </div>

          <div className="bg-[#17120F] border border-white/10 rounded-xl p-5 space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-950/40 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm text-[#F7EFD9]">Production Lead Time</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Minimum {hours.leadTimeHours} hours advance notice required. Large banquets over 100 guests recommend booking 7–14 days ahead.
            </p>
          </div>
        </div>

        {/* Sample Pricing Notice (if version 1 placeholder) */}
        {isSampleConfig && (
          <div className="p-4 rounded-xl bg-[#6B1230]/30 border border-[#B3261E] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#B3261E] shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-bold text-[#F7EFD9] uppercase tracking-wider text-[11px]">
                Sample Pricing Configuration
              </span>
              <p className="text-white/80 leading-relaxed">
                The prices below reflect baseline sample estimation tiers. Final catering packages and menu selections are confirmed directly with Chef Esther.
              </p>
            </div>
          </div>
        )}

        {/* Catering Packages from Estimator Configuration */}
        <section className="space-y-6">
          <div className="border-b border-[#D4AF37]/20 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-2xl font-bold text-[#F7EFD9]">
                Catering Feast Tiers
              </h2>
              <span className="text-xs uppercase font-bold tracking-widest text-[#D4AF37]">
                Packages from our live estimator
              </span>
            </div>
            <Link
              href="/estimate"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D4AF37] hover:underline"
            >
              <span>Launch interactive estimator</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {estimatorConfig.tiers.map((tier) => (
              <div
                key={tier.id}
                className="bg-[#17120F] border border-white/10 hover:border-[#D4AF37]/50 rounded-2xl p-6 flex flex-col justify-between space-y-4 transition-all shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif font-bold text-lg text-[#F7EFD9]">
                      {tier.name}
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/30">
                      {tier.minGuests}–{tier.maxGuests} guests
                    </span>
                  </div>

                  <p className="text-xs text-white/70 leading-relaxed">
                    {tier.description}
                  </p>

                  <div className="pt-2 border-t border-white/5">
                    <span className="text-xs text-white/50 block">Investment:</span>
                    <span className="font-mono text-xl font-bold text-[#D4AF37]">
                      {formatKobo(tier.pricePerGuestKobo)}
                    </span>
                    <span className="text-xs text-white/60"> / guest</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-2">
                  <Link
                    href={`/estimate?tier=${tier.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/50 px-4 py-2 rounded-lg text-xs font-bold hover:border-[#D4AF37] transition-all shadow-md"
                  >
                    <Calculator className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Calculate Total for {tier.name}</span>
                  </Link>
                  <a
                    href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
                      `Hello Chef Esther, I would like to inquire about booking the ${tier.name} catering package for an event.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 bg-[#0B0A09] text-white/70 border border-white/10 px-4 py-2 rounded-lg text-xs font-semibold hover:text-white transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                    <span>Inquire via WhatsApp</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 7: Delivery Areas & Fees */}
        <section className="bg-[#17120F] border border-[#D4AF37]/30 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2 text-[#D4AF37]">
            <Truck className="w-5 h-5" />
            <h2 className="font-serif text-xl font-bold text-[#F7EFD9]">
              Event Logistics &amp; Lagos Delivery Areas
            </h2>
          </div>
          <p className="text-xs text-white/70 leading-relaxed">
            We provide on-site catering setups, banquet delivery, and chafing stations across all key Lagos districts.
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

        {/* Allergen Notice Banner */}
        <div className="p-4 rounded-xl bg-[#17120F] border border-[#D4AF37]/20 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-[#D4AF37] uppercase tracking-wider text-[11px]">
              Food Safety &amp; Dietary Advice
            </span>
            <p className="text-white/70 leading-relaxed">
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
