'use client';

import { ArrowUpRight, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { cartChangedEvent, cartCount } from '../lib/storefront';
import {
  DEFAULT_INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  instagramUrl,
} from '../lib/instagram';
import type { PublicStoreSettings } from '../lib/settings';
import { InstagramIcon } from './instagram-icon';

export const INSTAGRAM_URL = DEFAULT_INSTAGRAM_URL;

export function InstagramButton({ href = INSTAGRAM_URL }: { href?: string }) {
  return (
    <a
      className="instagram-fab"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Message Dollz on Instagram at ${INSTAGRAM_HANDLE}`}
    >
      <span className="instagram-fab-glyph">
        <InstagramIcon size={23} />
      </span>
      <span className="instagram-fab-label">Message the atelier</span>
    </a>
  );
}

export function StorefrontHeader() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(cartCount());
    update();
    window.addEventListener(cartChangedEvent, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(cartChangedEvent, update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const navLink =
    'whitespace-nowrap transition-colors hover:text-rose! focus-visible:text-rose!';
  return (
    <header className="sticky top-0 z-40 border-b border-hairline/70 bg-hero-cream/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-4 sm:px-8 lg:px-16 xl:px-24">
        <Link
          href="/"
          aria-label="Dollz home"
          className="font-serif text-[1.6rem] font-medium tracking-tight text-cocoa!"
        >
          Dollz<span className="text-rose!">.</span>
        </Link>
        <span className="hidden rounded-full bg-rose/10 px-3 py-1 font-display text-[0.7rem] font-semibold tracking-[0.16em] text-rose uppercase sm:inline-block">
          Made with love
        </span>

        <nav
          aria-label="Main navigation"
          className="order-last flex w-full items-center gap-4 overflow-x-auto font-display text-[0.9rem] font-medium text-cocoa-soft [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-6 md:order-none md:ml-auto md:w-auto md:overflow-visible"
        >
          {process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG ? (
            <Link
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-blush px-3 font-semibold text-white! shadow-[0_10px_22px_-14px_rgba(176,90,110,0.8)] transition hover:-translate-y-0.5 hover:bg-blush-deep sm:px-4"
              href="/customize"
            >
              Build your own
            </Link>
          ) : null}
          <Link className={navLink} href="/products">
            The dolls
          </Link>
          <Link className={navLink} href="/#process">
            How it works
          </Link>
          <Link className={navLink} href="/track">
            Track
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4 md:ml-0">
          <Link
            href="/products"
            className="hidden items-center gap-2 rounded-full bg-blush px-5 py-2.5 font-display text-[0.85rem] font-semibold text-white! shadow-[0_10px_22px_-12px_rgba(176,90,110,0.75)] transition duration-150 hover:-translate-y-0.5 hover:bg-blush-deep sm:inline-flex"
          >
            Meet the dolls
          </Link>
          <Link
            href="/cart"
            aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}
            className="relative inline-flex items-center p-1 text-cocoa-soft! transition-colors hover:text-rose!"
          >
            <ShoppingCart size={22} strokeWidth={1.6} aria-hidden="true" />
            {count > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-1 grid min-w-[1.05rem] place-items-center rounded-full bg-blush px-1 py-px text-[0.62rem] font-semibold text-white"
              >
                {count}
              </span>
            ) : null}
          </Link>
        </div>
      </div>
    </header>
  );
}

export function StorefrontFooter({
  instagramHref = INSTAGRAM_URL,
}: {
  instagramHref?: string;
}) {
  const footerLink = 'transition-colors hover:text-rose!';
  return (
    <footer className="border-t border-cocoa/10 bg-[#efdcd7] px-6 py-14 sm:px-8 lg:px-16 xl:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-hairline/70 pb-8">
          <Link
            href="/"
            aria-label="Dollz home"
            className="font-serif text-[1.6rem] font-medium tracking-tight text-cocoa!"
          >
            Dollz<span className="text-rose!">.</span>
          </Link>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap gap-x-6 gap-y-2 font-display text-[0.9rem] font-medium text-cocoa-soft"
          >
            <Link className={footerLink} href="/">
              Home
            </Link>
            <Link className={footerLink} href="/products">
              The dolls
            </Link>
            <Link className={footerLink} href="/customize">
              Design your doll
            </Link>
            <Link className={footerLink} href="/#process">
              How it works
            </Link>
            <Link className={footerLink} href="/track">
              Track an order
            </Link>
          </nav>
        </div>

        <div className="grid gap-6 pt-8 lg:grid-cols-[minmax(12rem,0.45fr)_minmax(0,1fr)_auto] lg:items-center">
          <div className="max-w-xs">
            <p className="m-0 font-serif text-[1.45rem] leading-tight text-cocoa">
              Keep in touch with the atelier.
            </p>
            <p className="m-0 mt-2 text-[0.88rem] leading-relaxed text-muted">
              Handmade to order in Beirut, with a real person on the other end.
            </p>
          </div>

          <section
            id="contact"
            className="overflow-hidden border border-cocoa/15 bg-white/25"
            aria-label="Contact Dollz"
          >
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Message Dollz on Instagram at ${INSTAGRAM_HANDLE}`}
              className="group relative flex min-h-[8.25rem] items-center gap-4 px-5 py-5 text-cocoa! transition-colors hover:bg-white/35 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-rose sm:px-6"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#ead9df] text-[#8f4f66] transition-transform group-hover:rotate-3 group-hover:scale-105">
                <InstagramIcon size={21} />
              </span>
              <span className="min-w-0">
                <small className="block font-display text-[0.72rem] font-medium text-muted">
                  Questions, orders and updates
                </small>
                <strong className="mt-1 block font-serif text-[1.12rem] font-medium leading-tight">
                  Message {INSTAGRAM_HANDLE}
                </strong>
                <span className="mt-1 block font-display text-[0.78rem] text-cocoa-soft">
                  We’ll reply in Instagram DMs
                </span>
              </span>
              <ArrowUpRight
                className="absolute top-4 right-4 text-cocoa/45 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-rose"
                size={17}
                aria-hidden="true"
              />
            </a>
          </section>

          <a
            href="#top"
            aria-label="Back to top"
            className="grid h-11 w-11 place-items-center rounded-full border border-hairline text-cocoa-soft transition-colors hover:border-rose hover:text-rose! max-lg:justify-self-end"
          >
            ↑
          </a>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-6 gap-y-1 border-t border-hairline/70 pt-6 font-display text-[0.78rem] text-muted">
          <span>© 2026 Dollz · All rights reserved</span>
          <span>Private order tracking · no customer accounts</span>
          <span>Made slowly, so every detail feels personal</span>
        </div>
      </div>
    </footer>
  );
}

export function StorefrontFrame({ children }: { children: React.ReactNode }) {
  const [instagramHref, setInstagramHref] = useState(INSTAGRAM_URL);

  useEffect(() => {
    void fetch('/store/api/settings')
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { settings: PublicStoreSettings };
      })
      .then((response) => {
        if (response)
          setInstagramHref(instagramUrl(response.settings.instagramUrl));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="storefront" id="top">
      <StorefrontHeader />
      {children}
      <StorefrontFooter instagramHref={instagramHref} />
      <InstagramButton href={instagramHref} />
    </div>
  );
}
