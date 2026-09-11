import type { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontFrame } from '../../components/storefront-shell';
import { StoreEyebrow } from '../../components/storefront-ui';
import { money } from '../../lib/storefront';
import { OG_IMAGE, fetchProduct } from '../../lib/seo';

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

const steps = [
  {
    title: 'Choose her size',
    body: 'Pick the scale that feels right for the person and occasion.',
  },
  {
    title: 'Shape the details',
    body: 'Choose the name, hair, eyes, dress, and colors that tell her story.',
  },
  {
    title: 'Send it to the atelier',
    body: 'We review your combination and confirm every detail before making it.',
  },
];

export default async function CustomizePage() {
  const details = slug ? await fetchProduct(slug) : null;
  const startingPrice = details
    ? money(details.product.startingPriceMinor, details.product.currency)
    : null;
  const productionWindow = details
    ? `${details.product.productionMinDays}–${details.product.productionMaxDays} days`
    : null;

  return (
    <StorefrontFrame>
      <main className="bg-hero-cream pb-24 sm:pb-0">
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-16 lg:py-20 xl:px-24">
          <div className="max-w-[36rem]">
            <StoreEyebrow>The custom studio</StoreEyebrow>
            <h1 className="m-0 mt-5 font-serif! text-[2.55rem] font-normal! leading-[1.06] tracking-[-0.01em]! text-cocoa sm:text-[3.25rem] lg:text-[4rem]">
              Design the doll only you could imagine.
            </h1>
            <p className="m-0 mt-6 max-w-[34rem] text-[1.05rem] leading-[1.8] text-muted">
              Choose her name, hair, eyes, and dress. Your ideas become a real
              handmade keepsake, reviewed by our atelier before a single stitch
              is made.
            </p>

            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row">
              {slug ? (
                <Link
                  href={`/products/${slug}`}
                  className="store-button store-button-primary"
                >
                  Start designing
                  <span aria-hidden="true">→</span>
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
              <Link
                className="store-button store-button-quiet"
                href="/products"
              >
                Meet the dolls
              </Link>
            </div>

            {(startingPrice || productionWindow) && (
              <dl className="m-0 mt-7 flex flex-wrap gap-x-8 gap-y-3 border-y border-hairline py-4">
                {startingPrice ? (
                  <div>
                    <dt className="font-display text-[0.75rem] text-muted">
                      Starts at
                    </dt>
                    <dd className="m-0 mt-1 font-serif text-[1.35rem] text-cocoa">
                      {startingPrice}
                    </dd>
                  </div>
                ) : null}
                {productionWindow ? (
                  <div>
                    <dt className="font-display text-[0.75rem] text-muted">
                      Made in
                    </dt>
                    <dd className="m-0 mt-1 font-serif text-[1.35rem] text-cocoa">
                      {productionWindow}
                    </dd>
                  </div>
                ) : null}
              </dl>
            )}
          </div>

          <figure className="relative m-0 overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_70px_-32px_rgba(120,70,85,0.45)] ring-1 ring-cocoa/10">
            <img
              src="/images/build-your-own.webp"
              alt="A collection of handmade personalized Dollz dolls"
              className="aspect-[4/5] h-full w-full object-cover"
            />
            <figcaption className="absolute right-4 bottom-4 left-4 rounded-[1.15rem] bg-rose-soft/92 px-5 py-4 text-[0.88rem] leading-[1.55] text-cocoa shadow-lg ring-1 ring-cocoa/10 backdrop-blur-sm sm:right-auto sm:max-w-[21rem]">
              Your choices guide the design. Human hands make every final
              detail.
            </figcaption>
          </figure>
        </section>

        <section
          className="bg-paper px-6 py-20 sm:px-8 lg:px-16 lg:py-28 xl:px-24"
          aria-labelledby="custom-steps-heading"
        >
          <div className="mx-auto max-w-7xl">
            <header className="mx-auto max-w-2xl text-center">
              <StoreEyebrow align="center">From idea to keepsake</StoreEyebrow>
              <h2
                id="custom-steps-heading"
                className="m-0 mt-5 font-serif! text-[2.15rem] font-normal! leading-[1.1] text-cocoa sm:text-[3rem]"
              >
                Three thoughtful steps, one doll made for you.
              </h2>
            </header>
            <ol className="m-0 mt-12 grid list-none gap-5 p-0 lg:grid-cols-3 lg:gap-8">
              {steps.map((step, index) => (
                <li
                  className="border-t-2 border-rose bg-white px-7 py-8 shadow-[0_18px_42px_-30px_rgba(120,70,85,0.45)]"
                  key={step.title}
                >
                  <span className="font-script text-[2rem] text-rose">
                    0{index + 1}
                  </span>
                  <h3 className="m-0 mt-3 font-serif! text-[1.4rem] font-normal! text-cocoa">
                    {step.title}
                  </h3>
                  <p className="m-0 mt-3 text-[0.95rem] leading-[1.7] text-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {slug ? (
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-paper/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-20px_rgba(67,39,35,0.45)] backdrop-blur-md sm:hidden">
            <Link
              className="store-button store-button-primary w-full"
              href={`/products/${slug}`}
            >
              Start designing
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        ) : null}
      </main>
    </StorefrontFrame>
  );
}
