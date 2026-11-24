import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  MessageCircle,
  Phone,
  Scale,
  ArrowLeft,
  Utensils,
  Truck,
} from 'lucide-react';
import {
  POLICY_VERSION,
  BUSINESS_CONTACT,
  ALLERGEN_NOTICE,
  PAYMENT_VERIFICATION_FRAUD_RULE,
  FCCPA_RIGHTS_STATEMENT,
  REFUND_REQUEST_INSTRUCTIONS,
  REFUND_POLICY_DETAILS,
  INVOICE_FOOTER,
} from '../../src/policy/content';

export const metadata = {
  title: 'Refund & Cancellation Policy | ROCK UC FOODS',
  description:
    'Official refund, cancellation, quality-issue reporting, and FCCPA consumer rights policy for ROCK UC FOODS.',
};

export default function RefundPolicyPage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-4 py-10 sm:py-14 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 min-w-0">
        {/* Header & Navigation */}
        <header className="border-b border-[var(--border-gold)] pb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/"
              className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg border border-[var(--border-card)] bg-[var(--bg-card)] text-[var(--text-accent)] hover:opacity-90 text-sm uppercase tracking-wider font-semibold inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Back to Home</span>
            </Link>

            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-card)] border border-[var(--border-card)] text-sm font-mono text-[var(--text-body-muted)]">
              Version: {POLICY_VERSION}
            </span>
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--text-accent)] leading-tight">
              {REFUND_POLICY_DETAILS.title}
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-body-muted)] mt-2">
              Effective across online orders, phone orders, WhatsApp catering invoices, and doorstep deliveries in{' '}
              {BUSINESS_CONTACT.location}. Status: <span className="font-semibold text-[var(--text-primary)]">needs lawyer review</span>.
            </p>
          </div>
        </header>

        {/* General Principles & Fraud Protection */}
        <section className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-[var(--text-accent)]">
            <ShieldCheck className="w-5 h-5 shrink-0" />
            <h2 className="text-xl font-serif font-bold">1. General Principles &amp; Verified Payment Rule</h2>
          </div>

          <p className="text-sm sm:text-base text-[var(--text-primary)] leading-relaxed">
            {REFUND_POLICY_DETAILS.generalRules}
          </p>

          <div className="p-4 rounded-lg bg-[var(--bg-surface-muted)] border border-[var(--border-card)] space-y-1.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-accent)]">
              Verified Payment &amp; Fraud Prevention
            </h3>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              {PAYMENT_VERIFICATION_FRAUD_RULE}
            </p>
          </div>
        </section>

        {/* Fresh Meal Orders (1-20 packs) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 text-[var(--text-accent)]">
            <Utensils className="w-5 h-5 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-serif font-bold">2. Fresh Meal Orders (1&ndash;20 Packs)</h2>
          </div>

          <p className="text-sm sm:text-base text-[var(--text-body-muted)]">
            Because every meal is cooked fresh to order with daily-sourced ingredients, eligibility depends on cooking state and elapsed time:
          </p>

          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl divide-y divide-[var(--border-card)] overflow-hidden">
            {REFUND_POLICY_DETAILS.freshOrders.map((rule) => (
              <div
                key={rule.condition}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <span className="font-semibold text-sm sm:text-base text-[var(--text-primary)]">
                  {rule.condition}
                </span>
                <span className="text-sm sm:text-base font-bold text-[var(--text-accent)] sm:text-right">
                  {rule.consequence}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Bulk & Event Orders (21+ packs) */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 text-[var(--text-accent)]">
            <Clock className="w-5 h-5 shrink-0" />
            <h2 className="text-xl sm:text-2xl font-serif font-bold">
              3. Bulk &amp; Event Orders (21+ Packs, Trays, or Live Cooking)
            </h2>
          </div>

          <p className="text-sm sm:text-base text-[var(--text-body-muted)]">
            Notice windows are measured cleanly from cancellation request time until scheduled event start time. Applicable refunds apply to the <strong>food subtotal only</strong>; delivery and transport fees are non-refundable once scheduled, and refunds never exceed verified payments actually received.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {REFUND_POLICY_DETAILS.bulkOrders.map((tier) => (
              <div
                key={tier.notice}
                className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-5 flex flex-col justify-between gap-2"
              >
                <span className="text-sm uppercase tracking-wider font-semibold text-[var(--text-body-muted)]">
                  Notice Before Event: {tier.notice}
                </span>
                <span className="text-lg font-serif font-bold text-[var(--text-accent)]">
                  {tier.refundPercentage}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Quality Issues & Delivery Delay Guarantees */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-[var(--text-accent)]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-serif font-bold">4. Quality Issues (2-Hour Window)</h2>
            </div>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              {REFUND_POLICY_DETAILS.qualityIssues}
            </p>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-[var(--text-accent)]">
              <Truck className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-serif font-bold">5. Late Dispatch Guarantee</h2>
            </div>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              {REFUND_POLICY_DETAILS.deliveryFailureByUs}
            </p>
          </div>
        </section>

        {/* How to Request a Refund */}
        <section className="bg-[#5B2A6E] text-[#F7EFD9] border border-[var(--border-gold)] rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-serif font-bold">6. How to Submit a Refund Request</h2>
          <p className="text-sm sm:text-base text-[#F7EFD9] leading-relaxed">
            {REFUND_REQUEST_INSTRUCTIONS}
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={`${BUSINESS_CONTACT.whatsappUrl}?text=${encodeURIComponent('REFUND - Order RUC-XXXX: ')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-lg bg-[#17120F] text-[#F7EFD9] border border-[#D4AF37] text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90"
            >
              <MessageCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>WhatsApp Refunds Desk ({BUSINESS_CONTACT.phone})</span>
            </a>

            <a
              href={`tel:${BUSINESS_CONTACT.phoneInternational}`}
              className="min-h-[44px] min-w-[44px] px-5 py-2.5 rounded-lg bg-[#6B1230] text-[#F7EFD9] border border-[#D4AF37]/60 text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#82173B]"
            >
              <Phone className="w-4 h-4 text-[#F3D98B] shrink-0" />
              <span>Call {BUSINESS_CONTACT.phone}</span>
            </a>
          </div>
        </section>

        {/* Consumer Rights & Allergen Advisory */}
        <section className="space-y-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-6 space-y-2">
            <div className="flex items-center gap-2 text-[var(--text-accent)]">
              <Scale className="w-5 h-5 shrink-0" />
              <h2 className="text-lg font-serif font-bold">7. Statutory Consumer Rights (FCCPA)</h2>
            </div>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              {FCCPA_RIGHTS_STATEMENT}
            </p>
          </div>

          <div className="bg-[var(--bg-surface-muted)] border border-[var(--border-card)] rounded-xl p-5 space-y-1.5">
            <span className="text-sm font-bold uppercase tracking-wider text-[var(--text-accent)] block">
              Allergen Advisory
            </span>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              {ALLERGEN_NOTICE}
            </p>
          </div>

          <p className="text-sm font-mono text-[var(--text-body-muted)] p-4 rounded-lg bg-[var(--bg-card)] border border-[var(--border-card)]">
            {INVOICE_FOOTER}
          </p>
        </section>

        {/* Footer Navigation */}
        <footer className="pt-6 border-t border-[var(--border-card)] flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-body-muted)]">
          <p>&copy; 2026 {BUSINESS_CONTACT.name}. {BUSINESS_CONTACT.location}.</p>
          <nav className="flex flex-wrap items-center gap-2">
            <Link
              href="/menu"
              className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center rounded text-[var(--text-link)] hover:underline font-medium"
            >
              Menu
            </Link>
            <Link
              href="/terms"
              className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center rounded text-[var(--text-link)] hover:underline font-medium"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="min-h-[44px] min-w-[44px] px-3 py-2 inline-flex items-center rounded text-[var(--text-link)] hover:underline font-medium"
            >
              Privacy Notice
            </Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
