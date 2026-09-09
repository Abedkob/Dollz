'use client';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cartChangedEvent, cartCount } from '../lib/storefront';

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
          className="order-last flex w-full items-center gap-6 overflow-x-auto font-display text-[0.9rem] font-medium text-cocoa-soft md:order-none md:ml-auto md:w-auto md:overflow-visible"
        >
          {process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG ? (
            <Link className={navLink} href="/customize">
              Build
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

export function StorefrontFooter() {
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
            <Link className={footerLink} href="/#process">
              How it works
            </Link>
            <Link className={footerLink} href="/track">
              Track an order
            </Link>
          </nav>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6 pt-8">
          <div>
            <p className="m-0 flex items-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cocoa-soft">
              <span aria-hidden="true" className="text-[0.95rem] text-rose">
                ♡
              </span>
              Talk to the atelier
            </p>
            <a
              href="mailto:hello@dollz.studio"
              className="mt-2 inline-block font-serif text-[1.5rem] text-cocoa! transition-colors hover:text-rose!"
            >
              hello@dollz.studio
            </a>
            <p className="m-0 mt-1 text-[0.9rem] text-muted">
              Handmade to order · Beirut, Lebanon
            </p>
          </div>
          <a
            href="#top"
            aria-label="Back to top"
            className="grid h-11 w-11 place-items-center rounded-full border border-hairline text-cocoa-soft transition-colors hover:border-rose hover:text-rose!"
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
  return (
    <div className="storefront" id="top">
      <StorefrontHeader />
      {children}
      <StorefrontFooter />
    </div>
  );
}
