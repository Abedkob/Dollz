import { apiInternalUrl } from '../../../../lib/auth';

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string; variant: string }> },
) {
  const { fileId, variant } = await context.params;
  if (
    !/^[0-9a-f-]{36}$/i.test(fileId) ||
    !['optimized', 'thumbnail'].includes(variant)
  )
    return new Response(null, { status: 404 });
  const upstream = await fetch(
    `${apiInternalUrl()}/media/${encodeURIComponent(fileId)}/${variant}`,
    { cache: 'force-cache' },
  ).catch(() => null);
  if (!upstream?.ok) return new Response(null, { status: 404 });
  const headers = new Headers();
  for (const name of [
    'content-type',
    'content-length',
    'cache-control',
    'x-content-type-options',
  ]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
