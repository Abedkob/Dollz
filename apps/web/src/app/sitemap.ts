import type { MetadataRoute } from 'next';
import { absoluteUrl, fetchCatalogProducts } from '../lib/seo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/products'),
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: absoluteUrl('/track'),
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ];

  if (process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG) {
    staticEntries.push({
      url: absoluteUrl('/customize'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // Never throws: an empty list just means the sitemap ships its static entries.
  const products = await fetchCatalogProducts();
  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(`/products/${product.slug}`),
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
