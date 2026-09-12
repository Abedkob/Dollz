import type { NextRequest } from 'next/server';
import { apiInternalUrl } from '../../../lib/auth';
import { getSetCookies } from '../../../lib/proxy';

export async function POST(request: NextRequest) {
  const upstream = await fetch(`${apiInternalUrl()}/orders`, {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') ?? 'application/json',
      origin: request.headers.get('origin') ?? request.nextUrl.origin,
    },
    body: await request.arrayBuffer(),
    cache: 'no-store',
  }).catch(() => null);
  if (!upstream)
    return Response.json(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'The atelier is temporarily unavailable.',
        },
      },
      { status: 503 },
    );
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  for (const cookie of getSetCookies(upstream.headers))
    headers.append('set-cookie', cookie);
  return new Response(upstream.body, { status: upstream.status, headers });
}
