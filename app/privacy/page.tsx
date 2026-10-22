import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | ROCK UC FOODS',
  description: 'Nigeria Data Protection Act (NDPA) 2023 compliant privacy notice for ROCK UC FOODS.',
};

export default function PrivacyPolicyPage() {
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
              Privacy Notice & Data Protection
            </h1>
            <p className="text-sm text-[#F7EFD9]/70 mt-1">
              Compliant with the Nigeria Data Protection Act (NDPA) 2023 | Status: <span className="text-[#F2C230] font-semibold">needs lawyer review</span>
            </p>
          </div>
        </div>

        {/* Notice Content */}
        <div className="space-y-8 text-base leading-relaxed text-[#F7EFD9]/90">
          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">1. Data Controller Details</h2>
            <p>
              ROCK UC FOODS (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;), founded by Chef Esther Kwentua, operates food preparation, catering, and culinary delivery services in Lagos State, Nigeria. We are the Data Controller responsible for your personal data.
            </p>
            <p className="text-sm text-[#F7EFD9]/70">
              Address: 5 Aro Street, Lagos, Nigeria | Official Line: +234 803 372 9125 | Email: privacy@rockucfoods.ng
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">2. Principles of Data Processing (NDPA 2023)</h2>
            <p>
              In strict adherence to the Nigeria Data Protection Act 2023, we collect and process personal information strictly under the principles of lawfulness, fairness, transparency, data minimization, accuracy, storage limitation, integrity, and confidentiality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">3. Categories of Information Collected</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Contact & Order Identification:</strong> Full name, telephone number (E.164 normalized), delivery address in Lagos, optional email address.</li>
              <li><strong>Order History & Receipts:</strong> Ordered menu items, portions, delivery instructions, event requirements, verified payment reference codes.</li>
              <li><strong>Guest Access:</strong> We do not require customer account creation. Checkout is available for guests via cryptographically secure 128-bit random tokens.</li>
              <li><strong>Payment Data:</strong> We never collect, process, or store credit/debit card numbers or bank credentials. Online card processing is securely tokenized via Paystack. Manual bank transfers are verified strictly via external bank statement reference audits.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">4. Legal Basis for Processing & Purpose</h2>
            <p>
              We process your personal information exclusively for:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Fulfilling your meal delivery and event catering agreements.</li>
              <li>Rider dispatch coordination to ensure timely delivery to your doorstep.</li>
              <li>Issuing authentic invoices, receipts, and required financial tax records.</li>
              <li>Preventing financial fraud, chargeback disputes, and double payments.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">5. Data Retention & Storage Limitation</h2>
            <p>
              Transactional audit records and financial logs are maintained in an immutable, append-only ledger for the statutory financial retention period required under Nigerian tax and accounting laws. Order details older than the retention threshold are safely anonymized or archived.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-serif text-[#D4AF37]">6. Your Data Subject Rights</h2>
            <p>
              Under NDPA 2023 Section 34, you have the right to request access to your personal data, request rectification of inaccurate records, object to marketing communications, and request erasure of non-statutory data. To exercise these rights, contact us at <span className="text-[#D4AF37]">privacy@rockucfoods.ng</span> or via WhatsApp at <span className="text-[#D4AF37]">+234 803 372 9125</span>.
            </p>
          </section>
        </div>

        {/* Footer info */}
        <div className="pt-8 border-t border-[#D4AF37]/20 text-xs text-[#F7EFD9]/60 flex flex-col sm:flex-row justify-between gap-4">
          <p>&copy; {new Date().getFullYear()} ROCK UC FOODS. Taste the Luxury. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-[#D4AF37]">Terms of Service</Link>
            <Link href="/" className="hover:text-[#D4AF37]">Home</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
