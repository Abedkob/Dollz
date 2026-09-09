import type { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontFrame } from '../../components/storefront-shell';
import { StoreEyebrow } from '../../components/storefront-ui';
import { OG_IMAGE } from '../../lib/seo';

const slug = process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG;

const PAGE_DESCRIPTION =
  'Design a doll that is entirely yours — choose the skin tone, hair, eyes, and dress, and add a name stitched by hand.';

export const metadata: Metadata = {
  title: 'Build your own doll',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/customize' },
  // Until the build-your-own product exists this page is only a placeholder;
  // keep it out of the index but let crawlers follow its links.
  robots: slug ? undefined : { index: false, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Dollz',
    title: 'Build your own doll · Dollz',
    description: PAGE_DESCRIPTION,
    url: '/customize',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Build your own doll · Dollz',
    description: PAGE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export default function CustomizePage() {
  return (
    <StorefrontFrame>
      <main className="bg-hero-cream">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 sm:px-8 lg:grid-cols-2 lg:gap-20 lg:px-16 lg:py-28 xl:px-24">
          <div>
            <StoreEyebrow>Build your own</StoreEyebrow>
            <h1 className="m-0 mt-4 font-serif! text-[2.3rem] font-normal! leading-[1.08] tracking-[-0.01em]! text-cocoa sm:text-[3rem] lg:text-[3.6rem]">
              Design a doll that&rsquo;s{' '}
              <span className="text-[#b45f74] italic">entirely yours.</span>
            </h1>
            <p className="m-0 mt-6 max-w-[32rem] text-[1.05rem] leading-[1.8] text-muted">
              Choose the skin tone, hair, eyes, and dress. Add a name stitched by
              hand. Every choice here becomes a real, one-of-a-kind commission
              &mdash; not just a preview.
            </p>
            <div className="mt-8">
              {slug ? (
                <Link
                  href={`/products/${slug}`}
                  className="group inline-flex items-center gap-2.5 rounded-full bg-blush px-8 py-4 font-display text-[0.95rem] font-semibold text-white! shadow-[0_18px_34px_-16px_rgba(176,90,110,0.65)] transition duration-150 hover:-translate-y-0.5 hover:bg-blush-deep hover:shadow-[0_22px_40px_-16px_rgba(176,90,110,0.7)]"
                >
                  Start customizing
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-150 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
              ) : (
                <p
                  className="m-0 max-w-[32rem] rounded-[1.25rem] border border-hairline bg-white/60 px-5 py-4 text-[0.95rem] leading-[1.7] text-muted"
                  role="status"
                >
                  Build your own is being set up. Check back soon, or{' '}
                  <Link
                    href="/products"
                    className="text-[#b45f74]! underline underline-offset-2"
                  >
                    meet the ready-made dolls
                  </Link>{' '}
                  instead.
                </p>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_70px_-32px_rgba(120,70,85,0.45)] ring-1 ring-cocoa/10">
            <img
              src="/images/build-your-own.webp"
              alt="A handmade Dollz doll personalized with an embroidered name"
              className="aspect-[4/5] h-full w-full object-cover"
            />
          </div>
        </section>
      </main>
    </StorefrontFrame>
  );
}
