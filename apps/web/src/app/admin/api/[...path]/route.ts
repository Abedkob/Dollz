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
    segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))
  )
    return Response.json(
      {
        error: { code: 'INVALID_REQUEST', message: 'The request is invalid.' },
      },
      { status: 400 },
    );
  const upstreamUrl = new URL(
    `${apiInternalUrl()}/admin/${segments.map(encodeURIComponent).join('/')}`,
  );
  upstreamUrl.search = request.nextUrl.search;
  const headers = new Headers();
  for (const name of ['cookie', 'content-type', 'x-csrf-token']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('origin', request.nextUrl.origin);
  const body = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
  }).catch(() => null);
  if (!upstream)
    return Response.json(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'The catalog service is unavailable. Try again.',
        },
      },
      { status: 503 },
    );
  const responseHeaders = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);
  for (const cookie of getSetCookies(upstream.headers))
    responseHeaders.append('set-cookie', cookie);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
