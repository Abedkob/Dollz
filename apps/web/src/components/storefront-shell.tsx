'use client';

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
  return (
    <header className="store-header">
      <Link className="store-logo" href="/" aria-label="Dollz home">
        Dollz<span aria-hidden="true">.</span>
      </Link>
      <nav aria-label="Main navigation">
        {process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG ? (
          <Link href="/customize">Build your own</Link>
        ) : null}
        <Link href="/products">The dolls</Link>
        <Link href="/#process">How it works</Link>
        <Link href="/track">Track an order</Link>
      </nav>
      <Link className="store-cart-link" href="/cart">
        Your request <span aria-label={`${count} items`}>{count}</span>
      </Link>
    </header>
  );
}

export function StorefrontFooter() {
  return (
    <footer className="store-footer">
      <div>
        <Link className="store-logo store-logo-light" href="/">
          Dollz<span>.</span>
        </Link>
        <p>Made slowly, so every detail feels personal.</p>
      </div>
      <nav aria-label="Footer navigation">
        <Link href="/products">Choose a doll</Link>
        <Link href="/track">Private order tracking</Link>
        <Link href="/admin/login">Atelier sign in</Link>
      </nav>
      <p className="store-footer-note">Handmade to order · Beirut, Lebanon</p>
    </footer>
  );
}

export function StorefrontFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="storefront">
      <StorefrontHeader />
      {children}
      <StorefrontFooter />
    </div>
  );
}
