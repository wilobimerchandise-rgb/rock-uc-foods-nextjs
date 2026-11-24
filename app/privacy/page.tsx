import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | ROCK UC FOODS',
  description: 'Nigeria Data Protection Act (NDPA) 2023 compliant privacy notice for ROCK UC FOODS.',
};

export default function PrivacyPolicyPage() {
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
              Privacy Notice &amp; Data Protection
            </h1>
            <p className="text-sm text-[var(--text-body-muted)] mt-2">
              Compliant with the Nigeria Data Protection Act (NDPA) 2023 | Status:{' '}
              <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] font-semibold">
                needs lawyer review
              </span>
            </p>
          </div>
        </div>

        {/* Notice Content */}
        <div className="space-y-8 text-base leading-relaxed text-[var(--text-primary)]">
          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              1. Data Controller Details
            </h2>
            <p>
              ROCK UC FOODS (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;), founded by Chef Esther Kwentua, operates food preparation, catering, and culinary delivery services in Lagos State, Nigeria. We are the Data Controller responsible for your personal data.
            </p>
            <p className="text-sm text-[var(--text-body-muted)]">
              Address: 5 Aro Street, Lagos, Nigeria | Official Line: +234 803 372 9125 | Email: privacy@rockucfoods.ng
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              2. Principles of Data Processing (NDPA 2023)
            </h2>
            <p className="text-[var(--text-body-muted)]">
              In strict adherence to the Nigeria Data Protection Act 2023, we collect and process personal information strictly under the principles of lawfulness, fairness, transparency, data minimization, accuracy, storage limitation, integrity, and confidentiality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              3. Categories of Information Collected
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-[var(--text-body-muted)]">
              <li>
                <strong className="text-[var(--text-primary)]">Contact &amp; Order Identification:</strong> Full name, telephone number (E.164 normalized), delivery address in Lagos, optional email address.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Order History &amp; Receipts:</strong> Ordered menu items, portions, delivery instructions, event requirements, verified payment reference codes.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Guest Access:</strong> We do not require customer account creation. Checkout is available for guests via cryptographically secure 128-bit random tokens.
              </li>
              <li>
                <strong className="text-[var(--text-primary)]">Payment Data:</strong> We never collect, process, or store credit/debit card numbers or bank login credentials. All payments are made exclusively via direct Nigerian bank transfer and verified manually by authorised staff against transfer references and bank credits.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              4. Legal Basis for Processing &amp; Purpose
            </h2>
            <p>We process your personal information exclusively for:</p>
            <ul className="list-disc pl-5 space-y-2 text-[var(--text-body-muted)]">
              <li>Fulfilling your meal delivery and event catering agreements.</li>
              <li>Rider dispatch coordination to ensure timely delivery to your doorstep.</li>
              <li>Issuing authentic invoices, receipts, and required financial tax records.</li>
              <li>Preventing financial fraud, chargeback disputes, and double payments.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              5. Data Retention &amp; Storage Limitation
            </h2>
            <p className="text-[var(--text-body-muted)]">
              Transactional audit records and financial logs are maintained in an immutable, append-only ledger for the statutory financial retention period required under Nigerian tax and accounting laws. Order details older than the retention threshold are safely anonymized or archived.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[var(--text-accent)]">
              6. Your Data Subject Rights
            </h2>
            <p className="text-[var(--text-body-muted)]">
              Under NDPA 2023 Section 34, you have the right to request access to your personal data, request rectification of inaccurate records, object to marketing communications, and request erasure of non-statutory data. To exercise these rights, contact us at{' '}
              <span className="font-semibold text-[var(--text-accent)]">privacy@rockucfoods.ng</span> or via WhatsApp at{' '}
              <span className="font-semibold text-[var(--text-accent)]">+234 803 372 9125</span>.
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
            <Link href="/terms" className="min-h-[44px] inline-flex items-center font-medium text-[var(--text-accent)] hover:underline">
              Terms of Service
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
