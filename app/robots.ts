import { MetadataRoute } from 'next';
import { SITE_ORIGIN } from '../src/seo/config';
import { PRIVATE_PREFIXES } from '../src/seo/routes';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: Array.from(PRIVATE_PREFIXES),
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
