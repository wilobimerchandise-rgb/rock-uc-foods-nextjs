/**
 * ROCK UC FOODS - SEO Configuration
 * Playbook v4 Section 19.3
 * 
 * Rules:
 * - resolveSiteUrl(raw, isProd): default https://rockucfoods.com
 * - keep only the origin (strip paths and trailing slashes)
 * - throw on invalid URLs, non-web schemes, and http:// in production
 * - absoluteUrl(path) builds clean canonicals
 */

export function resolveSiteUrl(
  rawUrl: string | undefined | null,
  isProd: boolean = process.env.NODE_ENV === 'production'
): string {
  if (!rawUrl || rawUrl.trim() === '') {
    return 'https://rockucfoods.com';
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid SITE_URL: '${rawUrl}' is not a valid URL.`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid SITE_URL scheme: only http: and https: are allowed. Got '${parsed.protocol}'.`);
  }

  if (isProd && parsed.protocol === 'http:') {
    throw new Error(`Production SITE_URL must use https://. Received insecure '${rawUrl}'.`);
  }

  // Keep only the origin (no path, no query, no trailing slash)
  return parsed.origin;
}

export const SITE_ORIGIN = resolveSiteUrl(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL);

export function absoluteUrl(relativePath: string): string {
  const cleanPath = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  return `${SITE_ORIGIN}${cleanPath}`;
}
