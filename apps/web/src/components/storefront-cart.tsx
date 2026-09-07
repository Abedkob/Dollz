'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import {
  CART_MAX_QUANTITY,
  cartChangedEvent,
  cartSubtotalMinor,
  money,
  readCart,
  removeCartItem,
  updateCartItemQuantity,
  type CartItem,
} from '../lib/storefront';

function QuantityStepper({ item }: { item: CartItem }) {
  const [draft, setDraft] = useState(String(item.quantity));

  useEffect(() => {
    setDraft(String(item.quantity));
  }, [item.quantity]);

  function commit(value: number) {
    updateCartItemQuantity(item.key, value);
  }

  return (
    <div className="store-qty-stepper">
      <button
        type="button"
        aria-label={`Decrease quantity for ${item.productName}`}
        disabled={item.quantity <= 1}
        onClick={() => commit(item.quantity - 1)}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={CART_MAX_QUANTITY}
        aria-label={`Quantity for ${item.productName}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(Number(draft) || 1)}
      />
      <button
        type="button"
        aria-label={`Increase quantity for ${item.productName}`}
        disabled={item.quantity >= CART_MAX_QUANTITY}
        onClick={() => commit(item.quantity + 1)}
      >
        +
      </button>
    </div>
  );
}

export function StorefrontCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    setReady(true);
    window.addEventListener(cartChangedEvent, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(cartChangedEvent, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!ready)
    return (
      <main className="store-load-page" role="status">
        Opening your request…
      </main>
    );

  if (!items.length)
    return (
      <main className="store-empty-cart">
        <p className="store-kicker">Your request</p>
        <h1>There is room for a story here.</h1>
        <p>Choose a doll and personalize its details before checking out.</p>
        <Link className="store-button store-button-primary" href="/products">
          Meet the dolls
        </Link>
      </main>
    );

  const total = cartSubtotalMinor(items);
  const currency = items[0]!.currency;

  return (
    <main className="store-cart-page">
      <header className="store-checkout-heading">
        <p className="store-kicker">Your request</p>
        <h1>
          {items.length} {items.length === 1 ? 'doll' : 'dolls'} in progress
        </h1>
        <p>Review quantities before sending this to the atelier.</p>
      </header>
      <div className="store-order-summary store-cart-list">
        {items.map((item) => (
          <article key={item.key}>
            <div className="store-summary-image">
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>D</span>}
            </div>
            <div>
              <h2>{item.productName}</h2>
              <p>{item.variantName}</p>
              <ul>
                {item.selections.map((selection) => (
                  <li key={selection.optionId}>
                    <span>{selection.optionName}</span>
                    {selection.valueLabel}
                  </li>
                ))}
              </ul>
              <div className="store-summary-actions">
                <Link href={`/products/${item.productSlug}`}>
                  Configure another
                </Link>
                <button
                  type="button"
                  onClick={() => removeCartItem(item.key)}
                >
                  Remove
                </button>
              </div>
              <QuantityStepper item={item} />
            </div>
            <strong>
              {money(item.estimatedUnitPriceMinor * item.quantity, item.currency)}
            </strong>
          </article>
        ))}
        <div className="store-summary-total">
          <span>Estimated subtotal</span>
          <strong>{money(total, currency)}</strong>
        </div>
      </div>
      <div className="store-flow-actions">
        <Link className="store-button store-button-quiet" href="/products">
          Continue browsing
        </Link>
        <Link className="store-button store-button-primary" href="/checkout">
          Proceed to checkout
        </Link>
      </div>
    </main>
  );
}
