import Link from 'next/link';
import { MakingOfYara } from './making-of-yara';
import { Reveal } from './reveal';
import { StorefrontCatalog } from './storefront-catalog';
import { StorefrontFrame } from './storefront-shell';

export function StorefrontHome() {
  return (
    <StorefrontFrame>
      <main>
        <section className="relative isolate overflow-hidden bg-hero-cream">
          {/* Copy column — sits on the cream field, over the photo on desktop. */}
          <div className="relative z-20 mx-auto block max-w-7xl px-6 pt-12 pb-0 sm:px-8 sm:pt-16 lg:flex lg:min-h-[clamp(36rem,84svh,52rem)] lg:items-center lg:px-16 lg:pt-32 lg:pb-24 xl:px-24">
            <div className="w-full lg:w-[35rem] lg:shrink-0">
              <p className="m-0 flex items-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cocoa-soft">
                <span
                  aria-hidden="true"
                  className="text-[0.95rem] tracking-normal text-rose"
                >
                  ♡
                </span>
                Handmade + with love
              </p>
              <h1 className="m-0 mt-[1.15rem] grid gap-[0.08em] font-serif! font-normal! leading-[1.06] tracking-[-0.005em]!">
                <span className="text-[2.3rem] text-cocoa sm:text-[3rem] lg:text-[3.85rem]">
                  More than a doll&hellip;
                </span>
                <span className="text-[2.35rem] text-[#b45f74] italic sm:text-[3rem] lg:text-[3.85rem]">
                  it&rsquo;s a little piece
                  <br className="hidden lg:block" /> of love.
                  <span
                    aria-hidden="true"
                    className="ml-[0.3em] align-[0.28em] font-display text-[0.4em] text-rose not-italic"
                  >
                    ♡
                  </span>
                </span>
              </h1>
              <p className="m-0 mt-6 max-w-[27rem] text-[1rem] leading-[1.75] text-muted">
                Thoughtfully handmade dolls, designed to bring joy, comfort and
                a smile to every little heart.
              </p>
              <Link
                href="/products"
                className="group mt-8 inline-flex items-center gap-2.5 rounded-full bg-blush px-8 py-4 font-display text-[0.95rem] font-semibold tracking-[0.01em] text-white! shadow-[0_18px_34px_-16px_rgba(176,90,110,0.65)] transition duration-150 hover:-translate-y-0.5 hover:bg-blush-deep hover:shadow-[0_22px_40px_-16px_rgba(176,90,110,0.7)]"
              >
                Meet Yara
                <span
                  aria-hidden="true"
                  className="transition-transform duration-150 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          </div>

          {/* Doll photo — flows below the copy on small screens, bleeds off the
              right on desktop where a left-edge mask dissolves it into the cream. */}
          <div className="relative z-10 mt-8 aspect-[4/3] w-full max-sm:aspect-[4/5] lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:aspect-auto lg:h-full lg:w-[62%] lg:min-w-[30rem] lg:max-w-[78rem] lg:[-webkit-mask-image:linear-gradient(to_right,transparent,#000_34%)] lg:[mask-image:linear-gradient(to_right,transparent,#000_34%)]">
            <img
              src="/images/hero-yara.webp"
              alt="Yara, a handmade doll with long auburn hair and a rose linen dress, sitting on floral bedding beside a vase of baby's breath."
              width={1671}
              height={941}
              fetchPriority="high"
              className="h-full w-full object-cover object-[64%_18%] lg:object-[62%_28%]"
            />
          </div>

          <p
            aria-hidden="true"
            className="pointer-events-none absolute right-6 bottom-6 z-20 m-0 flex w-52 -rotate-3 flex-col items-end gap-0.5 text-right font-script leading-none text-[#b05e73] [text-shadow:0_1px_12px_rgba(247,236,223,0.95)] max-sm:hidden lg:right-16 lg:bottom-16"
          >
            <span className="text-[2.1rem] font-bold">Yara</span>
            <span className="text-[1.1rem] font-medium">
              — always by your side
            </span>
          </p>
        </section>

        <MakingOfYara />

        <section
          className="overflow-hidden bg-hero-cream px-6 py-20 sm:px-8 lg:px-16 lg:py-28 xl:px-24"
          aria-labelledby="collection-heading"
        >
          <div className="mx-auto max-w-7xl">
            <header className="mx-auto mb-16 max-w-3xl text-center lg:mb-24">
              <Reveal variant="blur-in">
                <p className="m-0 flex items-center justify-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cocoa-soft">
                  <span aria-hidden="true" className="text-[0.95rem] text-rose">
                    ♡
                  </span>
                  The current collection
                  <span aria-hidden="true" className="text-[0.95rem] text-rose">
                    ♡
                  </span>
                </p>
                <h2
                  id="collection-heading"
                  className="m-0 mt-6 font-serif! text-[2rem] font-normal! leading-[1.1] tracking-[-0.01em]! text-cocoa sm:text-[2.8rem] lg:text-[3.5rem]"
                >
                  We don&rsquo;t just make Yara &mdash;{' '}
                  <br className="hidden sm:block" />
                  <span className="text-[#b45f74] italic">
                    we make whoever you like.
                  </span>
                </h2>
                <p className="mx-auto m-0 mt-6 max-w-[34rem] text-[1.05rem] leading-[1.8] text-muted">
                  Every doll here is a starting point. Bring a photo, a name, or
                  just an idea, and we&rsquo;ll make one that&rsquo;s entirely
                  yours.
                </p>
              </Reveal>
            </header>

            <StorefrontCatalog featuredOnly />

            <Reveal variant="fade-up" className="mt-14 text-center lg:mt-20">
              <Link
                href="/products"
                className="group inline-flex items-center gap-2 font-display text-[0.8rem] font-semibold tracking-[0.18em] text-[#b45f74] uppercase transition-colors hover:text-cocoa"
              >
                View every doll
                <span
                  aria-hidden="true"
                  className="transition-transform duration-150 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </Reveal>
          </div>
        </section>

        <section
          className="overflow-hidden bg-paper px-6 py-20 sm:px-8 lg:px-16 lg:py-28 xl:px-24"
          id="process"
          aria-labelledby="process-heading"
        >
          <div className="mx-auto max-w-7xl">
            <header className="mx-auto mb-16 max-w-3xl text-center lg:mb-20">
              <Reveal variant="settle">
                <p className="m-0 flex items-center justify-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cocoa-soft">
                  <span aria-hidden="true" className="text-[0.95rem] text-rose">
                    ♡
                  </span>
                  From idea to keepsake
                  <span aria-hidden="true" className="text-[0.95rem] text-rose">
                    ♡
                  </span>
                </p>
                <h2
                  id="process-heading"
                  className="m-0 mt-6 font-serif! text-[2rem] font-normal! leading-[1.1] tracking-[-0.01em]! text-cocoa sm:text-[2.8rem] lg:text-[3.5rem]"
                >
                  A clear path{' '}
                  <span className="text-[#b45f74] italic">
                    through the atelier.
                  </span>
                </h2>
                <p className="mx-auto m-0 mt-6 max-w-[36rem] text-[1.05rem] leading-[1.8] text-muted">
                  You make the creative choices. We review feasibility, confirm
                  the final price, and keep the whole conversation in one private
                  place.
                </p>
              </Reveal>
            </header>

            <ol className="m-0 grid list-none gap-6 p-0 lg:grid-cols-3 lg:gap-8">
              {[
                {
                  n: '01',
                  title: 'Choose',
                  body: 'Start with a published doll design and the size you want.',
                },
                {
                  n: '02',
                  title: 'Personalize',
                  body: 'Select the repeatable details, then add your own personal request.',
                },
                {
                  n: '03',
                  title: 'Confirm',
                  body: 'Send the request and follow every update through your private link.',
                },
              ].map((step, i) => (
                <li key={step.n} className="grid">
                  <Reveal
                    variant="rise"
                    delay={i * 110}
                    className="rounded-[1.5rem] bg-white p-8 shadow-[0_18px_44px_-26px_rgba(120,70,85,0.5)] ring-1 ring-cocoa/10 lg:p-10"
                  >
                    <span className="font-script text-[2.75rem] leading-none text-[#b45f74] lg:text-[3.25rem]">
                      {step.n}
                    </span>
                    <h3 className="m-0 mt-3 font-serif! text-[1.5rem] font-normal! tracking-[-0.01em]! text-cocoa">
                      {step.title}
                    </h3>
                    <p className="m-0 mt-3 text-[0.98rem] leading-[1.7] text-muted">
                      {step.body}
                    </p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#a85f74] px-6 py-20 text-center sm:px-8 lg:px-16 lg:py-28 xl:px-24">
          {/* Soft decorative shapes — embroidery-hoop rings, blobs, sparkles. */}
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full text-white"
            viewBox="0 0 1200 600"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
          >
            <circle cx="80" cy="70" r="240" fill="currentColor" opacity="0.05" />
            <circle
              cx="1140"
              cy="560"
              r="300"
              fill="currentColor"
              opacity="0.05"
            />
            <circle
              cx="600"
              cy="300"
              r="212"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 9"
              opacity="0.3"
            />
            <circle
              cx="600"
              cy="300"
              r="150"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 9"
              opacity="0.16"
            />
            <g fill="currentColor" opacity="0.3">
              <path d="M200 417C201.8 425.5 204.5 428.2 213 430C204.5 431.8 201.8 434.5 200 443C198.2 434.5 195.5 431.8 187 430C195.5 428.2 198.2 425.5 200 417Z" />
              <path d="M1015 139C1016.5 146.2 1018.9 148.5 1026 150C1018.9 151.5 1016.5 153.8 1015 161C1013.5 153.8 1011.1 151.5 1004 150C1011.1 148.5 1013.5 146.2 1015 139Z" />
              <path d="M335 107C336.1 112.2 337.8 113.9 343 115C337.8 116.1 336.1 117.8 335 123C333.9 117.8 332.2 116.1 327 115C332.2 113.9 333.9 112.2 335 107Z" />
            </g>
          </svg>
          <Reveal variant="zoom" className="relative mx-auto max-w-3xl">
            <div
              aria-hidden="true"
              className="mx-auto mb-5 text-[2rem] text-white/50"
            >
              ✦
            </div>
            <p className="m-0 flex items-center justify-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-white/90">
              <span aria-hidden="true" className="text-[0.95rem] text-white">
                ♡
              </span>
              The Dollz promise
              <span aria-hidden="true" className="text-[0.95rem] text-white">
                ♡
              </span>
            </p>
            <h2 className="m-0 mt-6 font-serif! text-[1.9rem] font-normal! leading-[1.15] tracking-[-0.01em]! text-white! sm:text-[2.4rem] lg:text-[2.9rem]">
              Human hands stay{' '}
              <span className="text-white! italic">in the loop.</span>
            </h2>
            <p className="mx-auto m-0 mt-6 max-w-[40rem] text-[1.05rem] leading-[1.8] text-white">
              The online builder captures your direction; it never pretends every
              handmade detail is automatic. The atelier reviews your combination
              before production and reaches out whenever a choice needs refining.
            </p>
          </Reveal>
        </section>

        <section className="overflow-hidden bg-gradient-to-b from-hero-cream to-[#efdcd7] px-6 py-24 text-center sm:px-8 lg:px-16 lg:py-32">
          <div className="mx-auto max-w-3xl">
            <Reveal variant="fade">
              <p className="m-0 flex items-center justify-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cocoa-soft">
                <span aria-hidden="true" className="text-[0.95rem] text-rose">
                  ♡
                </span>
                Ready when you are
                <span aria-hidden="true" className="text-[0.95rem] text-rose">
                  ♡
                </span>
              </p>
            </Reveal>
            <Reveal variant="rise" delay={60}>
              <h2 className="m-0 mt-6 font-serif! text-[2.1rem] font-normal! leading-[1.1] tracking-[-0.01em]! text-cocoa sm:text-[3rem] lg:text-[3.75rem]">
                Begin with a doll. End with someone{' '}
                <span className="text-[#b45f74] italic">
                  unmistakably yours.
                </span>
              </h2>
            </Reveal>
            <Reveal variant="fade-up" delay={160}>
              <Link
                href="/products"
                className="group mt-10 inline-flex items-center gap-2.5 rounded-full bg-blush px-8 py-4 font-display text-[0.95rem] font-semibold tracking-[0.01em] text-white! shadow-[0_18px_34px_-16px_rgba(176,90,110,0.65)] transition duration-150 hover:-translate-y-0.5 hover:bg-blush-deep hover:shadow-[0_22px_40px_-16px_rgba(176,90,110,0.7)]"
              >
                Start personalizing
                <span
                  aria-hidden="true"
                  className="transition-transform duration-150 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </Reveal>
          </div>
        </section>
      </main>
    </StorefrontFrame>
  );
}
