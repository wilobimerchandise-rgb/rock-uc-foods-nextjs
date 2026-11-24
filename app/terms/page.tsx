import React from 'react';
import Link from 'next/link';
import { REFUND_POLICY_DETAILS } from '../../src/policy/content';

export const metadata = {
  title: 'Terms of Service & Order Policy | ROCK UC FOODS',
  description: 'Terms of service, delivery policies, and cancellation rules for ROCK UC FOODS.',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] px-4 py-12 sm:px-6 lg:px-8 min-w-0 max-w-full">
      <div className="max-w-4xl mx-auto space-y-10 min-w-0">
        {/* Navigation & Header */}
        <div className="border-b border-[var(--border-card)] pb-6 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="inline-flex items-center min-h-[44px] px-1 text-[var(--text-accent)] hover:underline text-sm uppercase tracking-wider font-semibold"
            >
              &larr; Back to Home
            </Link>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[var(--text-accent)] mt-2">
              Terms of Service &amp; Order Policy
            </h1>
            <p className="text-sm text-[var(--text-body-muted)] mt-2">
              Official Culinary Terms | Status:{' '}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] font-semibold">
                needs lawyer review
              </span>
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8 text-base leading-relaxed text-[var(--text-primary)]">
          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              1. Introduction &amp; Brand Philosophy
            </h2>
            <p>
              Welcome to ROCK UC FOODS (&quot;Taste the Luxury&quot;). By placing an individual dish order or submitting a bulk event catering enquiry through our platform, you agree to be bound by these Terms of Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              2. Order Placements &amp; Snapshots
            </h2>
            <p>
              All dish pricing is established strictly in Nigerian Kobo (integer BigInt) and displayed in Nigerian Naira (₦). When an order is placed:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[var(--text-body-muted)]">
              <li>Item prices, portion labels, and selected extras are immediately snapshot at order creation. Subsequent menu updates or price adjustments never alter active or past orders.</li>
              <li>Requests submitted online are placed in an <em>awaiting confirmation</em> status until kitchen capacity and delivery logistics are verified by our operations team.</li>
              <li>Orders with unverified payments or unconfirmed details are subject to automatic expiration after the configured window to preserve daily kitchen capacity.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              3. Payment Policy &amp; Bank Transfers
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[var(--text-body-muted)]">
              <li>
                <strong className="text-[var(--text-primary)]">Manual Bank Transfers:</strong> Transfers must be made to our verified corporate Nigerian bank account using your unique payment reference as the transfer narration. Orders are marked paid and sent to the kitchen only after authorised admin verification of bank credit.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Proof &amp; Expiry:</strong> Orders remain valid for 7 hours awaiting payment confirmation. Partial payments are recorded as partial until the full balance is confirmed.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              4. Doorstep Delivery &amp; Collection (Lagos)
            </h2>
            <p>
              We deliver to designated Lagos delivery zones (Island, Lekki, Ikoyi, Mainland, Outer Mainland) with fixed, transparent fee schedules.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[var(--text-body-muted)]">
              <li>Deliveries are carried out by designated dispatch riders whose contact information and tracking link are provided to the customer.</li>
              <li>Collection is available at our kitchen facility (5 Aro Street, Lagos) upon notification that the order is ready for handoff.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              5. Cancellation &amp; Refund Policy
            </h2>
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] p-5 rounded-xl space-y-2">
              <p className="font-medium text-[var(--text-primary)]">
                {REFUND_POLICY_DETAILS.generalRules} Fresh orders: 100% refund within 30 mins before cooking starts; non-refundable once cooking begins. Bulk events: 72h+ 80%, 48&ndash;72h 50%, 24&ndash;48h 25%, &lt;24h non-refundable (food subtotal only).
              </p>
              <p className="text-sm">
                <Link
                  href="/refund-policy"
                  className="inline-flex items-center min-h-[44px] font-semibold text-[var(--text-accent)] underline"
                >
                  Read full Refund &amp; Cancellation Policy
                </Link>
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              6. Food Safety &amp; Allergen Disclaimer
            </h2>
            <p className="text-[var(--text-body-muted)]">
              Dishes may contain or come into contact with common allergens including fish, shellfish, nuts, and seasonings. Customers with specific severe allergies are required to detail these in the special instructions field during checkout.
            </p>
          </section>
        </div>

        {/* Footer info */}
        <div className="pt-8 border-t border-[var(--border-card)] text-sm text-[var(--text-body-muted)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} ROCK UC FOODS. Taste the Luxury. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/refund-policy" className="min-h-[44px] inline-flex items-center font-medium text-[var(--text-accent)] hover:underline">
              Refund Policy
            </Link>
            <Link href="/privacy" className="min-h-[44px] inline-flex items-center font-medium text-[var(--text-accent)] hover:underline">
              Privacy Policy
            </Link>
            <Link href="/" className="min-h-[44px] min-w-[44px] px-2 inline-flex items-center justify-center font-medium text-[var(--text-accent)] hover:underline">
              Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
