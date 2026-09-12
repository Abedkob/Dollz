import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSetCookies } from './lib/proxy';

const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

function withCookies(response: NextResponse, upstream: Response) {
  for (const cookie of getSetCookies(upstream.headers))
    response.headers.append('set-cookie', cookie);
  return response;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith('/admin/auth/')) return NextResponse.next();
  const cookie = request.headers.get('cookie') ?? '';
  const session = await fetch(`${apiUrl}/admin/auth/session`, {
    headers: { cookie },
    cache: 'no-store',
  }).catch(() => null);

  if (session?.ok) {
    if (path === '/admin/login')
      return NextResponse.redirect(new URL('/admin', request.url));
    return NextResponse.next();
  }

  const refresh = await fetch(`${apiUrl}/admin/auth/refresh`, {
    method: 'POST',
    headers: {
      cookie,
      origin: request.headers.get('origin') ?? request.nextUrl.origin,
    },
    cache: 'no-store',
  }).catch(() => null);
  if (refresh?.ok) {
    const destination =
      path === '/admin/login'
        ? new URL('/admin', request.url)
        : request.nextUrl;
    return withCookies(NextResponse.redirect(destination), refresh);
  }

  if (path === '/admin/login') return NextResponse.next();
  const login = new URL('/admin/login', request.url);
  login.searchParams.set('next', `${path}${request.nextUrl.search}`);
  const response = NextResponse.redirect(login);
  return refresh ? withCookies(response, refresh) : response;
}

export const config = { matcher: ['/admin/:path*'] };
