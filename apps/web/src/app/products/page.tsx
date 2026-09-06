import type { Metadata } from 'next';
import { StorefrontCatalog } from '../../components/storefront-catalog';
import { StorefrontFrame } from '../../components/storefront-shell';

export const metadata: Metadata = {
  title: 'Handmade dolls',
  description:
    'Choose a Dollz design and personalize its size, palette, and details.',
};

export default function ProductsPage() {
  return (
    <StorefrontFrame>
      <main>
        <section className="store-page-hero">
          <p className="store-kicker">The Dollz collection</p>
          <h1>Every story needs a starting point.</h1>
          <p>
            Choose the design that feels closest. You will select its size and
            personal details on the next page.
          </p>
        </section>
        <section
          className="store-section store-all-products"
          aria-label="Available dolls"
        >
          <StorefrontCatalog />
        </section>
      </main>
    </StorefrontFrame>
  );
}
