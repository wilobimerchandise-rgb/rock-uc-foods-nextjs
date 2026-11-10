import React from 'react';
import Link from 'next/link';
import { Phone, MessageCircle, MapPin, Mail, ShieldAlert } from 'lucide-react';
import { getLatestSiteContent } from '../../content/service';
import { ALLERGEN_NOTICE } from '../../policy/content';

export function ContactFooter() {
  const content = getLatestSiteContent();
  const contact = content.contact;
  const hours = content.hours;

  const whatsappClean = (contact.whatsapp || '+2348033729125').replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${whatsappClean}`;
  const phoneTel = `tel:${(contact.phone || '08033729125').replace(/\s+/g, '')}`;

  return (
    <footer
      className="bg-[#17120F] text-[#F7EFD9] border-t border-[#D4AF37]/30 pt-12 pb-24 px-4 sm:px-6 w-full min-w-0"
      data-testid="contact-footer"
    >
      <div className="max-w-6xl mx-auto space-y-8 min-w-0">
        {/* Top: Brand info and Allergen Notice */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-white/10">
          <div className="space-y-3">
            <h3 className="font-serif font-bold text-lg text-[#F7EFD9] tracking-wide">
              ROCK UC FOODS
            </h3>
            <p className="text-xs text-[#F7EFD9]/70 leading-relaxed">
              Authentic Nigerian luxury cuisine. Handcrafted party jollof, heritage soups, and bespoke event catering in Lagos.
            </p>
            {hours.orderingOpen247 && (
              <p className="text-xs text-[#D4AF37] font-semibold">
                Order requests are accepted any time.
              </p>
            )}
            <p className="text-[11px] text-white/50 leading-relaxed">
              {hours.kitchenNote} ({hours.leadTimeHours}-hour minimum lead time applies to all orders).
            </p>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              Direct Contact
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="contact-whatsapp-link"
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  WhatsApp: {contact.whatsapp}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <a
                  href={phoneTel}
                  data-testid="contact-phone-link"
                  className="hover:text-[#D4AF37] transition-colors"
                >
                  Call: {contact.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
                <span>Lagos, Nigeria</span>
              </div>
              {contact.showAddress && contact.address && (
                <div className="text-[11px] text-white/60 pl-6">
                  {contact.address}
                </div>
              )}
              {contact.showEmail && contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#D4AF37] shrink-0" />
                  <a
                    href={`mailto:${contact.email}`}
                    data-testid="contact-email-link"
                    className="hover:text-[#D4AF37] transition-colors"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Quick Links & Allergen */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
              Navigation &amp; Legal
            </h4>
            <div className="flex flex-col space-y-1.5 text-xs text-white/70">
              <Link href="/menu" className="hover:text-[#D4AF37] transition-colors">
                Public Menu &amp; Pricing
              </Link>
              <Link href="/catering" className="hover:text-[#D4AF37] transition-colors">
                Catering &amp; Event Packages
              </Link>
              <Link href="/estimate" className="hover:text-[#D4AF37] transition-colors">
                Instant Catering Estimator
              </Link>
              <Link href="/terms" className="hover:text-[#D4AF37] transition-colors">
                Terms &amp; Refund Policy
              </Link>
              <Link href="/privacy" className="hover:text-[#D4AF37] transition-colors">
                Privacy Notice
              </Link>
            </div>
          </div>
        </div>

        {/* Verbatim Allergen Notice */}
        <div className="p-4 rounded-xl bg-[#0B0A09] border border-[#D4AF37]/20 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <span className="font-bold text-[#D4AF37] uppercase tracking-wider text-[11px]">
              Allergen Notice
            </span>
            <p className="text-white/70 leading-relaxed">
              {ALLERGEN_NOTICE}
            </p>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-white/40 pt-4">
          <p>© {new Date().getFullYear()} ROCK UC FOODS. All rights reserved.</p>
          <p>Lagos, Nigeria</p>
        </div>
      </div>
    </footer>
  );
}
