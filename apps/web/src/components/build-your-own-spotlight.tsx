import Link from 'next/link';
import { Reveal } from './reveal';
import { StoreEyebrow } from './storefront-ui';

const choices = [
  'A meaningful name',
  'Hair and eye colors',
  'A favorite dress',
];

export function BuildYourOwnSpotlight() {
  return (
    <section
      className="overflow-hidden bg-paper px-6 py-20 sm:px-8 lg:px-16 lg:py-28 xl:px-24"
      aria-labelledby="build-spotlight-heading"
    >
      <Reveal
        variant="settle"
        className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-rose-soft shadow-[0_30px_80px_-38px_rgba(120,70,85,0.45)] ring-1 ring-cocoa/10 lg:grid-cols-[1.08fr_0.92fr]"
      >
        <div className="relative min-h-[24rem] lg:min-h-[38rem]">
          <img
            src="/images/build-your-own.webp"
            alt="A collection of handmade personalized Dollz dolls"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-rose-soft-deep/35 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-rose-soft-deep/30"
          />
        </div>

        <div className="flex flex-col justify-center px-7 py-12 text-cocoa sm:px-12 lg:px-14 lg:py-16">
          <StoreEyebrow className="text-cocoa-soft">
            The custom studio
          </StoreEyebrow>
          <h2
            id="build-spotlight-heading"
            className="m-0 mt-5 font-serif! text-[2.35rem] font-normal! leading-[1.08] tracking-[-0.01em]! text-cocoa! sm:text-[3rem]"
          >
            A doll that begins with your imagination.
          </h2>
          <p className="m-0 mt-6 max-w-[32rem] text-[1rem] leading-[1.8] text-cocoa-soft">
            Start with a size, shape the details, and add the name that makes
            her personal. Our atelier reviews every choice before making your
            doll by hand.
          </p>
          <ul className="m-0 mt-8 grid list-none gap-3 p-0 text-[0.92rem] text-cocoa sm:grid-cols-3 lg:grid-cols-1">
            {choices.map((choice) => (
              <li className="flex items-center gap-3" key={choice}>
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-paper/70 text-rose"
                >
                  ♡
                </span>
                {choice}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link className="store-button store-button-light" href="/customize">
              Design your doll
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              className="store-button border border-cocoa/25 text-cocoa! hover:border-cocoa/50"
              href="/products"
            >
              Meet the dolls
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
