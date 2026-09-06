import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { apiInternalUrl } from '../../../../lib/auth';
import { getSetCookies } from '../../../../lib/proxy';

const allowedActions = new Set([
  'login',
  'refresh',
  'logout',
  'session',
  'change-password',
]);

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  if (!allowedActions.has(action)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Not found.' } },
      { status: 404 },
    );
  }
  const headers = new Headers();
  for (const name of [
    'content-type',
    'cookie',
    'origin',
    'referer',
    'user-agent',
    'x-csrf-token',
  ]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const upstream = await fetch(`${apiInternalUrl()}/admin/auth/${action}`, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method)
      ? undefined
      : await request.text(),
    cache: 'no-store',
  });
  const response = new NextResponse(
    upstream.status === 204 ? null : await upstream.text(),
    {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    },
  );
  for (const cookie of getSetCookies(upstream.headers))
    response.headers.append('set-cookie', cookie);
  return response;
}

export const GET = proxy;
export const POST = proxy;
