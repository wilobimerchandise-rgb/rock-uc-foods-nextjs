/**
 * ROCK UC FOODS - Edge Middleware Decision (NO Node.js imports)
 * Playbook v2 Section 28 (Phase 1E)
 * 
 * Rules:
 * - Edge runtime compliant: strictly ZERO external or node:* module imports.
 * - /api/admin/* without user = 401 JSON.
 * - /admin and /admin/* without user = redirect to /login with next remembered.
 * - Everything else passes.
 */

export interface MiddlewareRequestInfo {
  pathname: string;
  hasUser: boolean;
  search?: string;
}

export type MiddlewareDecision =
  | { type: 'pass' }
  | { type: 'unauthorized_api'; status: 401; body: { error: string } }
  | { type: 'redirect_login'; destination: string };

export function decideMiddleware(info: MiddlewareRequestInfo): MiddlewareDecision {
  const { pathname, hasUser, search } = info;

  // Protect Admin API Routes
  if (pathname.startsWith('/api/admin/') || pathname === '/api/admin') {
    if (!hasUser) {
      return {
        type: 'unauthorized_api',
        status: 401,
        body: { error: 'Authentication required for administrative API endpoints.' },
      };
    }
    return { type: 'pass' };
  }

  // Protect Admin UI Pages
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!hasUser) {
      const fullPath = pathname + (search || '');
      const encodedNext = encodeURIComponent(fullPath);
      return {
        type: 'redirect_login',
        destination: `/login?next=${encodedNext}`,
      };
    }
    return { type: 'pass' };
  }

  return { type: 'pass' };
}
