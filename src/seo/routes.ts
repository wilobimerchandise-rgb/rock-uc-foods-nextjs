/**
 * ROCK UC FOODS - Route Classification
 * Playbook v4 Section 19.3
 * 
 * Order links carry secret 128-bit tokens and must NEVER be indexed.
 */

export interface PublicRoute {
  path: string;
  priority: number;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  lastModified?: string;
}

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: '/', priority: 1.0, changeFrequency: 'daily' },
  { path: '/estimate', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
  { path: '/terms', priority: 0.3, changeFrequency: 'monthly' },
];

export const PRIVATE_PREFIXES = [
  '/api/',
  '/admin',
  '/dashboard',
  '/login',
  '/order/',
  '/invoice/',
  '/receipt/',
  '/account',
  '/checkout',
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => r.path === pathname);
}

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
