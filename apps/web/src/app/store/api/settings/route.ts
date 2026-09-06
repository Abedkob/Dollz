import { apiInternalUrl } from '../../../../lib/auth';

export async function GET() {
  const upstream = await fetch(`${apiInternalUrl()}/store/settings`, {
    cache: 'no-store',
  }).catch(() => null);
  if (!upstream)
    return Response.json(
      {
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Store settings are temporarily unavailable.',
        },
      },
      { status: 503 },
    );
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    },
  });
}
