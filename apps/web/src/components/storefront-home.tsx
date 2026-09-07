import Link from 'next/link';
import { HeroDoll } from './hero-doll';
import { StorefrontCatalog } from './storefront-catalog';
import { StorefrontFrame } from './storefront-shell';

export function StorefrontHome() {
  return (
    <StorefrontFrame>
      <main>
        <section className="store-hero">
          <div className="store-hero-copy">
            <p className="store-kicker">A small doll atelier</p>
            <h1>A little person, made from your imagination.</h1>
            <p className="store-lede">
              Choose a Dollz design, make the details your own, and let our
              atelier finish every stitch by hand.
            </p>
            <div className="store-actions">
              {process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG ? (
                <>
                  <Link
                    className="store-button store-button-primary"
                    href="/customize"
                  >
                    Build your own
                  </Link>
                  <Link
                    className="store-button store-button-quiet"
                    href="/products"
                  >
                    Meet the dolls
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    className="store-button store-button-primary"
                    href="/products"
                  >
                    Meet the dolls
                  </Link>
                  <Link
                    className="store-button store-button-quiet"
                    href="/#process"
                  >
                    See how it works
                  </Link>
                </>
              )}
            </div>
            <dl className="store-proof">
              <div>
                <dt>Made to order</dt>
                <dd>No factory shelf</dd>
              </div>
              <div>
                <dt>Personal details</dt>
                <dd>Colors, looks & notes</dd>
              </div>
            </dl>
          </div>
          <div
            className="store-hero-art"
            aria-label="Handmade doll atelier illustration"
          >
            <div className="store-doll-portrait" aria-hidden="true">
              <span className="store-doll-head" />
              <span className="store-doll-hair" />
              <span className="store-doll-dress" />
              <span className="store-doll-detail">D</span>
            </div>
            <HeroDoll />
            <p>Cut, sewn & finished by hand</p>
            <div className="store-measure" aria-hidden="true" />
          </div>
        </section>

        <section className="store-intro" aria-labelledby="intro-heading">
          <p className="store-kicker">Made for one person</p>
          <h2 id="intro-heading">
            Not pulled from a shelf. Built from a story.
          </h2>
          <p>
            Dollz starts with a carefully developed design, then gives you the
            meaningful choices: size, palette, character details, and the small
            notes only you know.
          </p>
        </section>

        <section className="store-section" aria-labelledby="collection-heading">
          <div className="store-section-heading">
            <div>
              <p className="store-kicker">The current collection</p>
              <h2 id="collection-heading">Choose your starting point</h2>
            </div>
            <Link className="store-text-link" href="/products">
              View every doll <span aria-hidden="true">→</span>
            </Link>
          </div>
          <StorefrontCatalog featuredOnly />
        </section>

        <section
          className="store-process"
          id="process"
          aria-labelledby="process-heading"
        >
          <div className="store-process-intro">
            <p className="store-kicker">From idea to keepsake</p>
            <h2 id="process-heading">A clear path through the atelier.</h2>
            <p>
              You make the creative choices. We review feasibility, confirm the
              final price, and keep the order conversation in one private place.
            </p>
          </div>
          <ol>
            <li>
              <span>01</span>
              <h3>Choose</h3>
              <p>Start with a published doll design and size.</p>
            </li>
            <li>
              <span>02</span>
              <h3>Personalize</h3>
              <p>Select repeatable details and add your personal request.</p>
            </li>
            <li>
              <span>03</span>
              <h3>Confirm</h3>
              <p>
                Send the request, then review updates through your private link.
              </p>
            </li>
          </ol>
        </section>

        <section className="store-craft">
          <div className="store-craft-mark" aria-hidden="true">
            ✦
          </div>
          <div>
            <p className="store-kicker">The Dollz promise</p>
            <h2>Human hands stay in the loop.</h2>
          </div>
          <p>
            The online builder captures your direction; it never pretends every
            handmade detail is automatic. The atelier reviews your combination
            before production and contacts you when a choice needs refining.
          </p>
        </section>

        <section className="store-final-cta">
          <p className="store-kicker">Ready when you are</p>
          <h2>Begin with a doll. End with someone unmistakably yours.</h2>
          <Link className="store-button store-button-light" href="/products">
            Start personalizing
          </Link>
        </section>
      </main>
    </StorefrontFrame>
  );
}
