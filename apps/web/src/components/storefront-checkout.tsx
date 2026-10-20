'use client';

import Link from 'next/link';
import { Banknote, Store, Truck } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LEBANON_DELIVERY_FEE_MINOR } from '@dollz/validation';
import { TurnstileWidget } from './turnstile-widget';
import {
  cartSubtotalMinor,
  money,
  readCart,
  removeCartItem,
  writeCart,
  type CartItem,
} from '../lib/storefront';
import { guestOrderRequest } from '../lib/orders';
import type { PublicStoreSettings } from '../lib/settings';
import { countryName } from '../lib/countries';
import {
  DEFAULT_INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  instagramUrl,
} from '../lib/instagram';
import { InstagramIcon } from './instagram-icon';
import { saveOrder } from '../lib/saved-orders';

type Contact = {
  fullName: string;
  email: string;
  phone: string;
};

const PHONE_PATTERN = /^\+?[\d][\d\s\-()]{5,18}\d$/;
type Delivery = {
  shippingMethod: 'DELIVERY' | 'PICKUP';
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
};

export function StorefrontCheckout() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [storeSettings, setStoreSettings] =
    useState<PublicStoreSettings | null>(null);
  const [contact, setContact] = useState<Contact>({
    fullName: '',
    email: '',
    phone: '',
  });
  const [delivery, setDelivery] = useState<Delivery>({
    shippingMethod: 'DELIVERY',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    country: 'LB',
    postalCode: '',
  });
  const [notes, setNotes] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{
    orderNumber: string;
    trackingPath: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const submissionKey = useRef(
    `request-${crypto.randomUUID()}-${crypto.randomUUID()}`,
  );

  useEffect(() => {
    setItems(readCart());
    setReady(true);
    void fetch('/store/api/settings')
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { settings: PublicStoreSettings };
      })
      .then((response) => {
        if (!response) return;
        setStoreSettings(response.settings);
        setDelivery((current) => ({
          ...current,
          shippingMethod: response.settings.deliveryEnabled
            ? 'DELIVERY'
            : 'PICKUP',
          country: response.settings.defaultCountry,
        }));
      })
      .catch(() => undefined);
  }, []);

  const total = useMemo(() => cartSubtotalMinor(items), [items]);
  const currency = items[0]?.currency ?? 'USD';
  const isLebanonDelivery =
    delivery.shippingMethod === 'DELIVERY' && delivery.country === 'LB';
  const deliveryFeeMinor = isLebanonDelivery ? LEBANON_DELIVERY_FEE_MINOR : 0;
  const estimatedTotalMinor = total + deliveryFeeMinor;
  const supportedCountries = storeSettings?.supportedCountryCodes?.length
    ? storeSettings.supportedCountryCodes
    : ['LB'];

  function removeItem(key: string) {
    removeCartItem(key);
    setItems(readCart());
  }

  function validateForm() {
    if (
      contact.fullName.trim().length < 2 ||
      !/^\S+@\S+\.\S+$/.test(contact.email.trim())
    ) {
      setError('Enter your name and a valid email address.');
      return false;
    }
    if (!PHONE_PATTERN.test(contact.phone.trim())) {
      setError('Enter a phone number we can reach you on.');
      return false;
    }
    if (
      delivery.shippingMethod === 'DELIVERY' &&
      (!delivery.addressLine1.trim() ||
        !delivery.city.trim() ||
        !delivery.country.trim())
    ) {
      setError('Add the delivery address, city, and country.');
      return false;
    }
    if (!turnstileToken) {
      setError('Complete the security check before sending your request.');
      return false;
    }
    setError('');
    return true;
  }

  async function submitOrder() {
    if (!validateForm()) return;
    setSubmitting(true);
    setError('');
    try {
      const pickup = delivery.shippingMethod === 'PICKUP';
      const result = await guestOrderRequest<{
        orderNumber: string;
        trackingPath?: string;
        trackingTokenAlreadyIssued?: boolean;
      }>('', {
        method: 'POST',
        body: JSON.stringify({
          submissionKey: submissionKey.current,
          customer: {
            fullName: contact.fullName.trim(),
            email: contact.email.trim(),
            phone: contact.phone.trim(),
            preferredContactMethod: 'INSTAGRAM',
          },
          delivery: {
            addressLine1: pickup
              ? 'Dollz atelier pickup'
              : delivery.addressLine1.trim(),
            addressLine2: pickup ? null : delivery.addressLine2.trim() || null,
            city: pickup ? 'Beirut' : delivery.city.trim(),
            region: pickup ? null : delivery.region.trim() || null,
            country: pickup ? 'Lebanon' : delivery.country.trim(),
            postalCode: pickup ? null : delivery.postalCode.trim() || null,
            shippingMethod: delivery.shippingMethod,
          },
          notes: notes.trim() || null,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            customerRequest: item.customerRequest,
            notes: null,
            selections: item.selections.map((selection) => ({
              optionId: selection.optionId,
              optionValueId: selection.optionValueId,
              customValue: selection.customValue,
              customColor: selection.customColor,
            })),
          })),
          turnstileToken,
        }),
      });
      if (!result.trackingPath) {
        throw new Error(
          result.trackingTokenAlreadyIssued
            ? `Request ${result.orderNumber} already exists. Use its original private tracking link.`
            : 'The private tracking link was not returned.',
        );
      }
      saveOrder({
        orderNumber: result.orderNumber,
        trackingPath: result.trackingPath,
      });
      writeCart([]);
      setSent({
        orderNumber: result.orderNumber,
        trackingPath: result.trackingPath,
      });
      setSubmitting(false);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Your request could not be sent.',
      );
      setSubmitting(false);
    }
  }

  if (sent)
    return (
      <main className="request-sent" role="status">
        <section className="request-sent-card">
          <span className="request-sent-badge" aria-hidden="true">
            ♡
          </span>
          <h1>Your request is with the atelier.</h1>
          <div className="request-sent-order">
            <span>Order number</span>
            <strong>{sent.orderNumber}</strong>
          </div>
          <p>
            Send {INSTAGRAM_HANDLE} a DM with your order number so the atelier
            can match your message to this request.
          </p>
          <div className="request-sent-link">
            <span>Your private tracking link</span>
            <code>{`${window.location.origin}${sent.trackingPath}`}</code>
            <button
              className="store-button store-button-quiet"
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(`${window.location.origin}${sent.trackingPath}`)
                  .then(() => setCopied(true))
                  .catch(() => undefined);
              }}
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          <div className="request-sent-actions">
            <a
              className="store-button request-sent-cta"
              href={instagramUrl(
                storeSettings?.instagramUrl ?? DEFAULT_INSTAGRAM_URL,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <InstagramIcon size={20} />
              Message {INSTAGRAM_HANDLE} on Instagram
            </a>
            <button
              className="store-button store-button-quiet"
              type="button"
              onClick={() => window.location.assign(sent.trackingPath)}
            >
              View my order
            </button>
          </div>
          <p className="request-sent-note">
            We also saved this link on this device so you can find it under
            Track an order. Keep it private. Dollz will never ask you to post it
            publicly or send it in a social media comment.
          </p>
        </section>
      </main>
    );
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

  return (
    <main className="store-checkout-page">
      <header className="store-checkout-heading">
        <h1>Send your request to the atelier</h1>
        <p>
          {storeSettings?.checkoutNotice ??
            'We review your request and confirm the final price before production.'}
        </p>
      </header>
      <div className="store-checkout-layout">
        <section className="store-checkout-flow">
          <form
            className="store-checkout-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!submitting) void submitOrder();
            }}
          >
            <div className="store-form-step">
              <h2>Your details</h2>
              <label>
                Full name
                <input
                  autoComplete="name"
                  value={contact.fullName}
                  onChange={(event) =>
                    setContact({ ...contact, fullName: event.target.value })
                  }
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={contact.email}
                  onChange={(event) =>
                    setContact({ ...contact, email: event.target.value })
                  }
                />
              </label>
              <label>
                Phone number
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={contact.phone}
                  onChange={(event) =>
                    setContact({ ...contact, phone: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="store-form-step">
              <h2>Delivery</h2>
              <fieldset>
                <legend>Method</legend>
                <div className="store-method-grid">
                  {storeSettings?.deliveryEnabled !== false ? (
                    <label
                      className={
                        delivery.shippingMethod === 'DELIVERY'
                          ? 'is-selected'
                          : ''
                      }
                    >
                      <input
                        type="radio"
                        checked={delivery.shippingMethod === 'DELIVERY'}
                        onChange={() =>
                          setDelivery({
                            ...delivery,
                            shippingMethod: 'DELIVERY',
                          })
                        }
                      />
                      <Truck size={18} aria-hidden="true" />
                      <div className="store-method-copy">
                        <span className="store-method-title">
                          <strong>Delivery</strong>
                          <b>
                            {delivery.country === 'LB'
                              ? money(LEBANON_DELIVERY_FEE_MINOR, currency)
                              : 'Fee after review'}
                          </b>
                        </span>
                        <span className="store-method-payment">
                          <Banknote size={14} aria-hidden="true" />
                          Cash on delivery
                        </span>
                        <small>
                          {delivery.country === 'LB'
                            ? 'Flat rate anywhere in Lebanon.'
                            : 'Timing and fee are confirmed after review.'}
                        </small>
                      </div>
                    </label>
                  ) : null}
                  {storeSettings?.pickupEnabled !== false ? (
                    <label
                      className={
                        delivery.shippingMethod === 'PICKUP'
                          ? 'is-selected'
                          : ''
                      }
                    >
                      <input
                        type="radio"
                        checked={delivery.shippingMethod === 'PICKUP'}
                        onChange={() =>
                          setDelivery({ ...delivery, shippingMethod: 'PICKUP' })
                        }
                      />
                      <Store size={18} aria-hidden="true" />
                      <div className="store-method-copy">
                        <span className="store-method-title">
                          <strong>
                            {storeSettings?.pickupLabel ?? 'Atelier pickup'}
                          </strong>
                          <b>Free</b>
                        </span>
                        <span>Arrange collection with the atelier.</span>
                        <small>
                          Pickup in {storeSettings?.pickupCity ?? 'Beirut'}.
                        </small>
                      </div>
                    </label>
                  ) : null}
                </div>
              </fieldset>
              {delivery.shippingMethod === 'DELIVERY' ? (
                <div className="store-address-grid">
                  <label className="store-field-wide">
                    Address
                    <input
                      autoComplete="street-address"
                      value={delivery.addressLine1}
                      onChange={(event) =>
                        setDelivery({
                          ...delivery,
                          addressLine1: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="store-field-wide">
                    Apartment, floor, or landmark <small>Optional</small>
                    <input
                      value={delivery.addressLine2}
                      onChange={(event) =>
                        setDelivery({
                          ...delivery,
                          addressLine2: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    City
                    <input
                      autoComplete="address-level2"
                      value={delivery.city}
                      onChange={(event) =>
                        setDelivery({ ...delivery, city: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Region <small>Optional</small>
                    <input
                      autoComplete="address-level1"
                      value={delivery.region}
                      onChange={(event) =>
                        setDelivery({ ...delivery, region: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Country
                    <select
                      autoComplete="country"
                      value={delivery.country}
                      onChange={(event) =>
                        setDelivery({
                          ...delivery,
                          country: event.target.value,
                        })
                      }
                    >
                      {supportedCountries.map((code) => (
                        <option key={code} value={code}>
                          {countryName(code)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Postal code <small>Optional</small>
                    <input
                      autoComplete="postal-code"
                      value={delivery.postalCode}
                      onChange={(event) =>
                        setDelivery({
                          ...delivery,
                          postalCode: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              ) : (
                <p className="store-pickup-note">
                  {storeSettings?.pickupAddress
                    ? `${storeSettings.pickupAddress}, ${storeSettings.pickupCity}`
                    : 'The atelier will share the exact pickup details after reviewing your request.'}
                </p>
              )}
            </div>

            <div className="store-form-step store-review-step">
              <h2>Notes</h2>
              <label>
                Anything else the atelier should know? <small>Optional</small>
                <textarea
                  rows={2}
                  maxLength={4000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <TurnstileWidget onToken={setTurnstileToken} />
            </div>

            {error ? (
              <p className="store-inline-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="store-flow-actions">
              <p className="store-contact-note">
                <InstagramIcon size={19} />
                <span>
                  <strong>Need help?</strong>
                  DM{' '}
                  <a
                    href={instagramUrl(
                      storeSettings?.instagramUrl ?? DEFAULT_INSTAGRAM_URL,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {INSTAGRAM_HANDLE}
                  </a>{' '}
                  on Instagram for support.
                </span>
              </p>
              <button
                className="store-button store-button-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Sending request…' : 'Send to the atelier'}
              </button>
            </div>
          </form>
        </section>

        <aside className="store-order-summary">
          <div className="store-summary-heading">
            <h2>Your design{items.length > 1 ? 's' : ''}</h2>
            <Link href="/cart">Edit cart</Link>
          </div>
          {items.map((item) => (
            <article key={item.key}>
              <div className="store-summary-image">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" />
                ) : (
                  <span>D</span>
                )}
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
                  <button type="button" onClick={() => removeItem(item.key)}>
                    Remove
                  </button>
                </div>
              </div>
              <strong>
                {money(
                  item.estimatedUnitPriceMinor * item.quantity,
                  item.currency,
                )}
              </strong>
            </article>
          ))}
          <div className="store-summary-costs">
            <div>
              <span>Subtotal</span>
              <strong>{money(total, currency)}</strong>
            </div>
            <div>
              <span>
                {delivery.shippingMethod === 'PICKUP'
                  ? 'Atelier pickup'
                  : 'Delivery'}
              </span>
              <strong>
                {delivery.shippingMethod === 'PICKUP'
                  ? 'Free'
                  : isLebanonDelivery
                    ? money(deliveryFeeMinor, currency)
                    : 'After review'}
              </strong>
            </div>
            <div className="store-summary-total">
              <span>Estimated total</span>
              <strong>{money(estimatedTotalMinor, currency)}</strong>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
