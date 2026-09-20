'use client';

import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cartChangedEvent, cartCount } from '../lib/storefront';
import { ATELIER_WHATSAPP_DISPLAY, whatsappUrl } from '../lib/whatsapp';

export function WhatsappButton() {
  return (
    <a
      href={whatsappUrl('Hello Dollz! ')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with the atelier on WhatsApp"
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 grid h-12 w-12 place-items-center rounded-full bg-[#25d366] text-white! shadow-[0_12px_26px_-10px_rgba(37,211,102,0.9)] transition hover:-translate-y-0.5 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cocoa sm:right-6 sm:bottom-6 sm:h-14 sm:w-14"
    >
      <svg
        viewBox="0 0 24 24"
        width="28"
        height="28"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 2C6.5 2 2 6.5 2 12.04c0 1.77.46 3.5 1.34 5.02L2 22l5.06-1.33a10 10 0 0 0 4.98 1.32h.01C17.58 22 22 17.5 22 11.96 22 6.5 17.58 2 12.04 2zm0 18.29h-.01a8.3 8.3 0 0 1-4.23-1.16l-.3-.18-3 .79.8-2.93-.2-.31a8.27 8.27 0 0 1-1.27-4.4c0-4.57 3.73-8.29 8.31-8.29 2.22 0 4.3.87 5.87 2.43a8.24 8.24 0 0 1 2.43 5.87c0 4.58-3.73 8.28-8.4 8.28z" />
      </svg>
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

        <div className="flex flex-wrap items-end justify-between gap-6 pt-8">
          <div>
            <p className="m-0 flex items-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cocoa-soft">
              <span aria-hidden="true" className="text-[0.95rem] text-rose">
                ♡
              </span>
              Talk to the atelier on WhatsApp
            </p>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with the atelier on WhatsApp"
              className="mt-2 inline-block font-serif text-[1.5rem] text-cocoa! transition-colors hover:text-rose!"
            >
              {ATELIER_WHATSAPP_DISPLAY}
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
      <WhatsappButton />
    </div>
  );
}
