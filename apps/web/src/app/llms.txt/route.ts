import {
  SITE_DESCRIPTION,
  SITE_NAME,
  absoluteUrl,
  clampText,
  fetchCatalogProducts,
} from '../../lib/seo';

export const revalidate = 3600;

// https://llmstxt.org/ — a plain-text, Markdown-formatted map of the site for
// language models: an H1 name, a blockquote summary, then link lists.
export async function GET() {
  const products = await fetchCatalogProducts();

  const dollLines = products.length
    ? products
        .map((product) => {
          const summary = product.shortDescription
            ? `: ${clampText(product.shortDescription, 140)}`
            : '';
          return `- [${product.name}](${absoluteUrl(
            `/products/${product.slug}`,
          )})${summary}`;
        })
        .join('\n')
    : '- The catalog is being updated — see [the collection](' +
      absoluteUrl('/products') +
      ').';

  const body = `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

Dollz is a small atelier that makes made-to-order cloth dolls. A customer picks a
base design, then personalizes its size, skin tone, hair, eyes, outfit, and an
embroidered name. Every doll is cut, sewn, and hand-embroidered to order in
Beirut, Lebanon. There are no customer accounts: each order is followed through a
private tracking link.

## Dolls

${dollLines}

## Pages

- [Home](${absoluteUrl('/')}): The atelier, how a doll is made, and the current collection.
- [The dolls](${absoluteUrl('/products')}): Every doll design available to personalize.
- [How it works](${absoluteUrl('/#process')}): The three steps from choosing a design to delivery.
- [Track an order](${absoluteUrl('/track')}): Look up an existing order with its private link.

## Notes

- Prices shown as "from" are starting prices in the store's listed currency. The
  final price is confirmed by the atelier after it reviews each order.
- Production is made to order and takes a few weeks per doll.
- Ordering and contact happen entirely through the storefront; there is no public API.
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control':
        'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
