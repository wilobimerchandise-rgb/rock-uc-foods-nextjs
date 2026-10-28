/**
 * ROCK UC FOODS - Metadata Helpers
 * Playbook v4 Section 19.3
 */

import { Metadata } from 'next';
import { SITE_ORIGIN, absoluteUrl } from './config';
import { BUSINESS_CONTACT } from '../policy/content';

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: `${BUSINESS_CONTACT.name} | ${BUSINESS_CONTACT.tagline}`,
    template: `%s | ${BUSINESS_CONTACT.name}`,
  },
  description: 'Premium Nigerian dishes and event catering crafted with tradition and served with luxury class in Lagos.',
  alternates: {
    canonical: SITE_ORIGIN,
  },
  openGraph: {
    title: `${BUSINESS_CONTACT.name} | ${BUSINESS_CONTACT.tagline}`,
    description: 'Premium Nigerian dishes and bespoke catering crafted with tradition in Lagos.',
    url: SITE_ORIGIN,
    siteName: BUSINESS_CONTACT.name,
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BUSINESS_CONTACT.name} | ${BUSINESS_CONTACT.tagline}`,
    description: 'Premium Nigerian dishes and bespoke catering crafted with tradition in Lagos.',
  },
};

export function publicMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = absoluteUrl(path);

  // Validate limits per Playbook Section 19.3
  const safeTitle = title.length > 60 ? title.slice(0, 57) + '...' : title;
  const safeDescription =
    description.length < 70
      ? description.padEnd(70, ' - Taste the Luxury.')
      : description.length > 160
      ? description.slice(0, 157) + '...'
      : description;

  return {
    title: safeTitle,
    description: safeDescription,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: safeTitle,
      description: safeDescription,
      url,
      locale: 'en_NG',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: safeTitle,
      description: safeDescription,
    },
  };
}

export const privateMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};
