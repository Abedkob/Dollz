import { apiInternalUrl } from './auth';
import type { PublicStoreSettings } from './settings';
import type {
  StorefrontProductDetails,
  StorefrontProductSummary,
} from './storefront';

export const SITE_NAME = 'Dollz';
export const SITE_TITLE = 'Dollz — handmade personalized dolls';
export const SITE_DESCRIPTION =
  'Dollz makes handmade, made-to-order cloth dolls you personalize — size, skin tone, hair, eyes, outfit, and a name stitched by hand. Every doll is cut, sewn, and embroidered by hand in Beirut.';

const FALLBACK_SITE_URL = 'http://localhost:3000';

/**
 * Default Open Graph / Twitter card image. Resolved against `metadataBase`, so a
 * site-relative path is fine. Re-export it on every page that declares its own
 * `openGraph` block — Next replaces the parent `openGraph` wholesale rather than
 * merging, so images are not inherited.
 */
export const OG_IMAGE = {
  url: '/images/hero-yara.webp',
  width: 1671,
  height: 941,
  alt: 'A handmade Dollz doll with long auburn hair and a rose dress',
} as const;

/** Canonical public origin of the storefront, no trailing slash. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const value = raw && raw.length > 0 ? raw : FALLBACK_SITE_URL;
  return value.replace(/\/+$/, '');
}

/** Absolute URL for a site-relative path (`/products`, `/media/x/optimized`, …). */
export function absoluteUrl(path = '/'): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Collapse whitespace and cap a string for use as a meta description. */
export function clampText(value: string, max = 160): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

const CATALOG_REVALIDATE_SECONDS = 3600;

interface CatalogListResponse {
  items: StorefrontProductSummary[];
}

/**
 * Server-side catalog fetch for metadata / sitemap / JSON-LD. Never throws — a
 * catalog or network failure yields an empty list so the page or route still
 * renders (the sitemap keeps its static entries, pages fall back to defaults).
 */
export async function fetchCatalogProducts(): Promise<
  StorefrontProductSummary[]
> {
  try {
    const response = await fetch(`${apiInternalUrl()}/catalog/products`, {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as CatalogListResponse;
    return Array.isArray(payload.items) ? payload.items : [];
  } catch {
    return [];
  }
}

/** Server-side single-product fetch for generateMetadata / JSON-LD. `null` on any failure. */
export async function fetchProduct(
  slug: string,
): Promise<StorefrontProductDetails | null> {
  try {
    const response = await fetch(
      `${apiInternalUrl()}/catalog/products/${encodeURIComponent(slug)}`,
      { next: { revalidate: CATALOG_REVALIDATE_SECONDS } },
    );
    if (!response.ok) return null;
    return (await response.json()) as StorefrontProductDetails;
  } catch {
    return null;
  }
}

/** Server-side public store settings for Organization JSON-LD. `null` on any failure. */
export async function fetchStoreSettings(): Promise<PublicStoreSettings | null> {
  try {
    const response = await fetch(`${apiInternalUrl()}/store/settings`, {
      next: { revalidate: CATALOG_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;
    return (await response.json()) as PublicStoreSettings;
  } catch {
    return null;
  }
}

type JsonLdObject = Record<string, unknown>;

/** schema.org Organization for the atelier. */
export function organizationLd(settings?: PublicStoreSettings | null): JsonLdObject {
  const url = siteUrl();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: settings?.atelierName ?? SITE_NAME,
    url,
    logo: absoluteUrl('/icon.svg'),
    description: settings?.storefrontDescription
      ? clampText(settings.storefrontDescription, 300)
      : SITE_DESCRIPTION,
    ...(settings?.publicEmail ? { email: settings.publicEmail } : {}),
    ...(settings?.publicPhone ? { telephone: settings.publicPhone } : {}),
    address: {
      '@type': 'PostalAddress',
      addressLocality: settings?.pickupCity || 'Beirut',
      addressCountry: settings?.pickupCountry || 'LB',
    },
  };
}

/** schema.org WebSite for the storefront. No site-search action exists yet. */
export function websiteLd(): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: siteUrl(),
  };
}

/** schema.org Product for a single doll design. */
export function productLd(details: StorefrontProductDetails): JsonLdObject {
  const { product, media, variants } = details;
  const images = media
    .filter((item) => item.urls?.optimized)
    .map((item) => absoluteUrl(item.urls.optimized));
  const prices = variants
    .map((variant) => variant.priceMinor)
    .filter((price) => Number.isFinite(price) && price > 0);
  const low = prices.length ? Math.min(...prices) : product.startingPriceMinor;
  const high = prices.length ? Math.max(...prices) : product.startingPriceMinor;
  const description =
    product.seoDescription ??
    product.shortDescription ??
    product.description ??
    SITE_DESCRIPTION;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: clampText(description, 320),
    ...(images.length ? { image: images } : {}),
    url: absoluteUrl(`/products/${product.slug}`),
    brand: { '@type': 'Brand', name: SITE_NAME },
    category: 'Handmade dolls',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: product.currency,
      lowPrice: (low / 100).toFixed(2),
      highPrice: (high / 100).toFixed(2),
      offerCount: Math.max(prices.length, 1),
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(`/products/${product.slug}`),
    },
  };
}

/** schema.org BreadcrumbList from `{ name, path }` crumbs. */
export function breadcrumbLd(
  crumbs: Array<{ name: string; path: string }>,
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** schema.org ItemList for the collection page. */
export function productListLd(
  products: StorefrontProductSummary[],
): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'The Dollz collection',
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: product.name,
      url: absoluteUrl(`/products/${product.slug}`),
    })),
  };
}
