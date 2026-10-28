/**
 * ROCK UC FOODS - Structured Data (JSON-LD)
 * Playbook v4 Section 19.3
 * 
 * Rules:
 * - safeJsonLd escapes <, >, &, and U+2028/2029
 * - NEVER add aggregateRating or reviews
 * - schemaPrice(kobo) uses integer maths
 */

import { SITE_ORIGIN, absoluteUrl } from './config';
import { BUSINESS_CONTACT } from '../policy/content';
import { MenuItem } from '../types/menu';

export function schemaPrice(kobo: bigint): string {
  const abs = kobo < 0n ? -kobo : kobo;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${whole}.${frac.toString().padStart(2, '0')}`;
}

export function safeJsonLd(data: any): string {
  const raw = JSON.stringify(data);
  return raw
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function businessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    name: BUSINESS_CONTACT.name,
    slogan: BUSINESS_CONTACT.tagline,
    url: SITE_ORIGIN,
    telephone: BUSINESS_CONTACT.phoneInternational,
    servesCuisine: 'Nigerian',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lagos',
      addressCountry: 'NG',
    },
    sameAs: [
      `https://instagram.com/${BUSINESS_CONTACT.instagram.replace('@', '')}`,
    ],
    paymentAccepted: 'Bank transfer',
  };
}

export function menuJsonLd(items: MenuItem[]) {
  const published = items.filter((i) => i.status === 'published' && i.isAvailable);

  return {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: `${BUSINESS_CONTACT.name} Live Menu`,
    hasMenuItem: published.map((item) => ({
      '@type': 'MenuItem',
      name: item.name,
      description: item.description || '',
      offers: {
        '@type': 'Offer',
        price: schemaPrice(item.priceKobo),
        priceCurrency: 'NGN', // Schema.org standard ISO currency code for Nigeria
      },
    })),
  };
}
