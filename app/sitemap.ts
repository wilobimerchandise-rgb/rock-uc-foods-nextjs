import { MetadataRoute } from 'next';
import { PUBLIC_ROUTES } from '../src/seo/routes';
import { absoluteUrl } from '../src/seo/config';

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
