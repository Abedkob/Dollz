import type { NextRequest } from 'next/server';
import { apiInternalUrl } from '../../../../lib/auth';
import { getSetCookies } from '../../../../lib/proxy';

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const segments = (await context.params).path;
  if (
    !segments.length ||
    segments.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))
  )
    return Response.json(
      {
        error: { code: 'VALIDATION_ERROR', message: 'The request is invalid.' },
      },
      { status: 400 },
    );
  const upstream = await fetch(
    `${apiInternalUrl()}/orders/${segments.map(encodeURIComponent).join('/')}`,
    {
      method: request.method,
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        'content-type':
          request.headers.get('content-type') ?? 'application/json',
        'x-csrf-token': request.headers.get('x-csrf-token') ?? '',
        origin: request.nextUrl.origin,
      },
      body: ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      cache: 'no-store',
    },
  ).catch(() => null);
  if (!upstream)
    return Response.json(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Order tracking is temporarily unavailable.',
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

export const GET = forward;
export const POST = forward;
