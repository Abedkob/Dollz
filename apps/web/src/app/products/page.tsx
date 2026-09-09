import type { Metadata } from 'next';
import { JsonLd } from '../../components/json-ld';
import { StorefrontCatalog } from '../../components/storefront-catalog';
import { StorefrontFrame } from '../../components/storefront-shell';
import { StoreEyebrow } from '../../components/storefront-ui';
import { OG_IMAGE, fetchCatalogProducts, productListLd } from '../../lib/seo';

const PAGE_DESCRIPTION =
  'Choose a Dollz design and personalize its size, palette, and details.';

export const metadata: Metadata = {
  title: 'Handmade dolls',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/products' },
  openGraph: {
    type: 'website',
    siteName: 'Dollz',
    title: 'Handmade dolls · Dollz',
    description: PAGE_DESCRIPTION,
    url: '/products',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Handmade dolls · Dollz',
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export default async function ProductsPage() {
  const products = await fetchCatalogProducts();
  return (
    <StorefrontFrame>
      {products.length ? <JsonLd data={productListLd(products)} /> : null}
      <main className="bg-hero-cream">
        <section className="overflow-hidden px-6 pt-20 pb-12 text-center sm:px-8 lg:px-16 lg:pt-28 lg:pb-16 xl:px-24">
          <div className="mx-auto max-w-3xl">
            <StoreEyebrow align="center">The Dollz collection</StoreEyebrow>
            <h1 className="m-0 mt-6 font-serif! text-[2.1rem] font-normal! leading-[1.1] tracking-[-0.01em]! text-cocoa sm:text-[3rem] lg:text-[3.6rem]">
              Every story needs{' '}
              <span className="text-[#b45f74] italic">a starting point.</span>
            </h1>
            <p className="mx-auto m-0 mt-6 max-w-[34rem] text-[1.05rem] leading-[1.8] text-muted">
              Choose the design that feels closest. You&rsquo;ll pick its size
              and personal details on the next page.
            </p>
          </div>
        </section>
        <section
          className="px-6 pb-24 sm:px-8 lg:px-16 lg:pb-28 xl:px-24"
          aria-label="Available dolls"
        >
          <div className="mx-auto max-w-7xl">
            <StorefrontCatalog />
          </div>
        </section>
      </main>
    </StorefrontFrame>
  );
}
