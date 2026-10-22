import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service & Order Policy | ROCK UC FOODS',
  description: 'Terms of service, delivery policies, and cancellation rules for ROCK UC FOODS.',
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#0B0A09] text-[#F7EFD9] px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Navigation & Header */}
        <div className="border-b border-[#D4AF37]/30 pb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="text-[#D4AF37] hover:text-[#F3D98B] text-sm uppercase tracking-wider font-medium">
              &larr; Back to Home
            </Link>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#D4AF37] mt-3">
              Terms of Service &amp; Order Policy
            </h1>
            <p className="text-sm text-[#F7EFD9]/70 mt-1">
              Official Culinary Terms | Status: <span className="text-[#F2C230] font-semibold">needs lawyer review</span>
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-8 text-base leading-relaxed text-[#F7EFD9]/90">
          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">1. Introduction &amp; Brand Philosophy</h2>
            <p>
              Welcome to ROCK UC FOODS (&quot;Taste the Luxury&quot;). By placing an individual dish order or submitting a bulk event catering enquiry through our platform, you agree to be bound by these Terms of Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">2. Order Placements &amp; Snapshots</h2>
            <p>
              All dish pricing is established strictly in Nigerian Kobo (integer BigInt) and displayed in Nigerian Naira (₦). When an order is placed:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Item prices, portion labels, and selected extras are immediately snapshot at order creation. Subsequent menu updates or price adjustments never alter active or past orders.</li>
              <li>Requests submitted online are placed in an <em>awaiting confirmation</em> status until kitchen capacity and delivery logistics are verified by our operations team.</li>
              <li>Orders with unverified payments or unconfirmed details are subject to automatic expiration after the configured window to preserve daily kitchen capacity.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">3. Payment Policy &amp; Bank Transfers</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Manual Bank Transfers:</strong> Transfers must be made to our verified corporate bank account. Orders are advanced to the kitchen only after the credit is verified on official bank statements by authorized staff. Screenshots alone do not constitute proof of payment.</li>
              <li><strong>Paystack Gateway:</strong> Online card and USSD payments are verified server-side through cryptographically signed HMAC-SHA512 webhooks. Browser redirects never mark an order as paid without gateway verification.</li>
              <li><strong>Overpayments &amp; Underpayments:</strong> Transfers must match the exact order total in kobo. Partial payments require balance settlement prior to food dispatch.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">4. Doorstep Delivery &amp; Collection (Lagos)</h2>
            <p>
              We deliver to designated Lagos delivery zones (Island, Lekki, Ikoyi, Mainland, Outer Mainland) with fixed, transparent fee schedules.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Deliveries are carried out by designated dispatch riders whose contact information and tracking link are provided to the customer.</li>
              <li>Collection is available at our kitchen facility (5 Aro Street, Lagos) upon notification that the order is ready for handoff.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">5. Cancellation &amp; Refund Policy (Owner Wording)</h2>
            <div className="bg-[#17120F] border border-[#D4AF37]/30 p-5 rounded-lg space-y-2">
              <p className="font-medium text-[#F7EFD9]">
                &quot;Because our dishes are prepared fresh to order using premium ingredients, individual orders cannot be cancelled once cooking has commenced in the kitchen. For bulk event catering, cancellations requested more than 7 days prior to the event date qualify for a deposit refund minus an administrative logistics charge; cancellations within 7 days forfeit the deposit to cover perishable ingredient procurement.&quot;
              </p>
              <p className="text-xs text-[#F2C230]">
                All refund requests are subject to owner review and recorded via financial reversal ledgers.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">6. Food Safety &amp; Allergen Disclaimer</h2>
            <p>
              Dishes may contain or come into contact with common allergens including fish, shellfish, nuts, and seasonings. Customers with specific severe allergies are required to detail these in the special instructions field during checkout.
            </p>
          </section>
        </div>

        {/* Footer info */}
        <div className="pt-8 border-t border-[#D4AF37]/20 text-xs text-[#F7EFD9]/60 flex flex-col sm:flex-row justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} ROCK UC FOODS. Taste the Luxury. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[#D4AF37]">Privacy Policy</Link>
            <Link href="/" className="hover:text-[#D4AF37]">Home</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
