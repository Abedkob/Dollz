import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/seo';

// Public storefront pages (/, /products, /products/*, /customize, /track) stay
// crawlable. /cart and /checkout carry their own `noindex` metadata and are left
// crawlable on purpose so that signal is actually seen. Everything below is the
// admin surface, private order tracking, and the JSON proxy routes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/orders/',
          '/catalog/api/',
          '/store/api/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
