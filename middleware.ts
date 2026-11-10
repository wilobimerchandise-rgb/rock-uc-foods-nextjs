import { NextResponse, type NextRequest } from 'next/server';
import { decideMiddleware } from '@/src/auth/middleware-decision';
import { SESSION_COOKIE_NAME } from '@/src/auth/cookies';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;

  // Check session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
  const hasUser = Boolean(sessionCookie && sessionCookie.value);

  const decision = decideMiddleware({
    pathname,
    hasUser,
    search,
  });

  if (decision.type === 'unauthorized_api') {
    return NextResponse.json(decision.body, {
      status: decision.status,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  }

  if (decision.type === 'redirect_login') {
    const url = new URL(decision.destination, request.url);
    const response = NextResponse.redirect(url);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  // Pass through: set x-pathname header and Cache-Control: no-store on admin requests
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }
  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
