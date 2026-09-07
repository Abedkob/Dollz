import type { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontFrame } from '../../components/storefront-shell';

export const metadata: Metadata = {
  title: 'Build your own doll',
};

const slug = process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG;

export default function CustomizePage() {
  return (
    <StorefrontFrame>
      <main>
        <section className="store-hero">
          <div className="store-hero-copy">
            <p className="store-kicker">Build your own</p>
            <h1>Design a doll that&rsquo;s entirely yours.</h1>
            <p className="store-lede">
              Choose the skin tone, hair, eyes, and dress. Add a name
              stitched by hand. Every choice here becomes a real,
              one-of-a-kind commission &mdash; not just a preview.
            </p>
            <div className="store-actions">
              {slug ? (
                <Link
                  className="store-button store-button-primary"
                  href={`/products/${slug}`}
                >
                  Start customizing
                </Link>
              ) : (
                <p className="store-inline-error" role="status">
                  Build your own is being set up. Check back soon, or{' '}
                  <Link href="/products">meet the ready-made dolls</Link>{' '}
                  instead.
                </p>
              )}
            </div>
          </div>
          <div
            className="store-hero-art"
            aria-label="A handmade Dollz doll personalized with an embroidered name"
          >
            <img
              src="/images/build-your-own.webp"
              alt="A handmade Dollz doll personalized with an embroidered name"
            />
          </div>
        </section>
      </main>
    </StorefrontFrame>
  );
}
