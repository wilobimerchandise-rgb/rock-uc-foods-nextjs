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
      className="bg-[var(--bg-card)] text-[var(--text-primary)] border-t border-[var(--border-gold)] pt-12 pb-24 px-4 sm:px-6 w-full min-w-0"
      data-testid="contact-footer"
    >
      <div className="max-w-6xl mx-auto space-y-8 min-w-0">
        {/* Top: Brand info and Allergen Notice */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-[var(--border-card)]">
          <div className="space-y-3">
            <h3 className="font-serif font-bold text-lg text-[var(--text-primary)] tracking-wide">
              ROCK UC FOODS
            </h3>
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              Authentic Nigerian luxury cuisine. Handcrafted party jollof, heritage soups, and
              bespoke event catering in Lagos.
            </p>
            {hours.orderingOpen247 && (
              <p className="text-sm text-[var(--text-accent)] font-semibold">
                Order requests are accepted any time.
              </p>
            )}
            <p className="text-sm text-[var(--text-body-muted)] leading-relaxed">
              {hours.kitchenNote} ({hours.leadTimeHours}-hour minimum lead time applies to all
              orders).
            </p>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-accent)]">
              Direct Contact
            </h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0" />
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="contact-whatsapp-link"
                  className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
                >
                  WhatsApp: {contact.whatsapp}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0" />
                <a
                  href={phoneTel}
                  data-testid="contact-phone-link"
                  className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
                >
                  Call: {contact.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-[var(--text-body-muted)] min-h-[36px]">
                <MapPin className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0" />
                <span>Lagos, Nigeria</span>
              </div>
              {contact.showAddress && contact.address && (
                <div className="text-sm text-[var(--text-body-muted)] pl-6">{contact.address}</div>
              )}
              {contact.showEmail && contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[var(--icon-on-surface)] shrink-0" />
                  <a
                    href={`mailto:${contact.email}`}
                    data-testid="contact-email-link"
                    className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
                  >
                    {contact.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Quick Links & Allergen */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--text-accent)]">
              Navigation &amp; Legal
            </h4>
            <div className="flex flex-col text-sm text-[var(--text-primary)]">
              <Link
                href="/menu"
                className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
              >
                Public Menu &amp; Pricing
              </Link>
              <Link
                href="/catering"
                className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
              >
                Catering &amp; Event Packages
              </Link>
              <Link
                href="/estimate"
                className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
              >
                Instant Catering Estimator
              </Link>
              <Link
                href="/terms"
                className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/refund-policy"
                className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
              >
                Refund &amp; Cancellation Policy
              </Link>
              <Link
                href="/privacy"
                className="inline-flex items-center min-h-[44px] hover:text-[var(--text-accent)] transition-colors"
              >
                Privacy Notice
              </Link>
            </div>
          </div>
        </div>

        {/* Verbatim Allergen Notice */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface-muted)] border border-[var(--border-card)] flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[var(--icon-on-surface)] shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm">
            <span className="font-bold text-[var(--text-accent)] uppercase tracking-wider block">
              Allergen Notice
            </span>
            <p className="text-[var(--text-body-muted)] leading-relaxed">{ALLERGEN_NOTICE}</p>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[var(--text-body-muted)] pt-4">
          <p>© {new Date().getFullYear()} ROCK UC FOODS. All rights reserved.</p>
          <p>Lagos, Nigeria</p>
        </div>
      </div>
    </footer>
  );
}
