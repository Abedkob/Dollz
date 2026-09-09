import type { NextRequest } from 'next/server';
import { apiInternalUrl } from '../../../../lib/auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const segments = (await context.params).path;
  if (
    !segments.length ||
    segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))
  )
    return Response.json(
      { error: { code: 'INVALID_REQUEST', message: 'Invalid catalog path.' } },
      { status: 400 },
    );
  const upstream = await fetch(
    `${apiInternalUrl()}/catalog/${segments.map(encodeURIComponent).join('/')}`,
    { cache: 'no-store' },
  ).catch(() => null);
  if (!upstream)
    return Response.json(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Failed to reach the catalog.',
        },
      },
      { status: 503 },
    );
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  return new Response(upstream.body, { status: upstream.status, headers });
}
