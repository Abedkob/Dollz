'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TurnstileWidget } from './turnstile-widget';
import { money, readCart, writeCart, type CartItem } from '../lib/storefront';
import { guestOrderRequest } from '../lib/orders';
import type { PublicStoreSettings } from '../lib/settings';

type Contact = {
  fullName: string;
  email: string;
  phone: string;
  preferredContactMethod: 'EMAIL' | 'PHONE' | 'WHATSAPP';
};
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
  const [step, setStep] = useState(1);
  const [contact, setContact] = useState<Contact>({
    fullName: '',
    email: '',
    phone: '',
    preferredContactMethod: 'EMAIL',
  });
  const [delivery, setDelivery] = useState<Delivery>({
    shippingMethod: 'DELIVERY',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    country: 'Lebanon',
    postalCode: '',
  });
  const [notes, setNotes] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.estimatedUnitPriceMinor * item.quantity,
        0,
      ),
    [items],
  );
  const currency = items[0]?.currency ?? 'USD';

  function removeItem(key: string) {
    const next = items.filter((item) => item.key !== key);
    setItems(next);
    writeCart(next);
  }

  function validateCurrentStep() {
    if (step === 1) {
      if (
        contact.fullName.trim().length < 2 ||
        !/^\S+@\S+\.\S+$/.test(contact.email)
      ) {
        setError('Enter your name and a valid email address.');
        return false;
      }
      if (contact.preferredContactMethod !== 'EMAIL' && !contact.phone.trim()) {
        setError('Add a phone number for your preferred contact method.');
        return false;
      }
    }
    if (
      step === 2 &&
      delivery.shippingMethod === 'DELIVERY' &&
      (!delivery.addressLine1.trim() ||
        !delivery.city.trim() ||
        !delivery.country.trim())
    ) {
      setError('Add the delivery address, city, and country.');
      return false;
    }
    setError('');
    return true;
  }

  async function submitOrder() {
    if (!turnstileToken) {
      setError('Complete the security check before sending your request.');
      return;
    }
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
            phone: contact.phone.trim() || null,
            preferredContactMethod: contact.preferredContactMethod,
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
      writeCart([]);
      window.location.assign(result.trackingPath);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Your request could not be sent.',
      );
      setSubmitting(false);
    }
  }

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
        <p className="store-kicker">Request checkout</p>
        <h1>Let’s send this to the atelier.</h1>
        <p>
          {storeSettings?.checkoutNotice ??
            'No payment is taken now. Dollz reviews your request and confirms the final price before production.'}
        </p>
      </header>
      <div className="store-checkout-layout">
        <section className="store-checkout-flow">
          <ol className="store-stepper" aria-label="Checkout progress">
            {['Your details', 'Delivery', 'Review'].map((label, index) => (
              <li
                key={label}
                className={
                  step === index + 1
                    ? 'is-current'
                    : step > index + 1
                      ? 'is-done'
                      : ''
                }
              >
                <span>{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          {step === 1 ? (
            <div className="store-form-step">
              <h2>How should we reach you?</h2>
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
                Phone or WhatsApp number{' '}
                <small>Required for phone or WhatsApp contact</small>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={contact.phone}
                  onChange={(event) =>
                    setContact({ ...contact, phone: event.target.value })
                  }
                />
              </label>
              <fieldset>
                <legend>Preferred contact</legend>
                <div className="store-radio-row">
                  {(['EMAIL', 'WHATSAPP', 'PHONE'] as const).map((method) => (
                    <label key={method}>
                      <input
                        type="radio"
                        checked={contact.preferredContactMethod === method}
                        onChange={() =>
                          setContact({
                            ...contact,
                            preferredContactMethod: method,
                          })
                        }
                      />
                      {method === 'WHATSAPP'
                        ? 'WhatsApp'
                        : method[0] + method.slice(1).toLowerCase()}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="store-form-step">
              <h2>How will it reach you?</h2>
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
                      <strong>Delivery</strong>
                      <span>We’ll confirm timing and fee.</span>
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
                      <strong>
                        {storeSettings?.pickupLabel ?? 'Atelier pickup'}
                      </strong>
                      <span>
                        Arrange collection in{' '}
                        {storeSettings?.pickupCity ?? 'Beirut'}.
                      </span>
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
                    <input
                      autoComplete="country-name"
                      value={delivery.country}
                      onChange={(event) =>
                        setDelivery({
                          ...delivery,
                          country: event.target.value,
                        })
                      }
                    />
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
          ) : null}

          {step === 3 ? (
            <div className="store-form-step store-review-step">
              <h2>Review before sending</h2>
              <div className="store-review-detail">
                <span>Contact</span>
                <p>
                  <strong>{contact.fullName}</strong>
                  <br />
                  {contact.email}
                  {contact.phone ? (
                    <>
                      <br />
                      {contact.phone}
                    </>
                  ) : null}
                </p>
                <button type="button" onClick={() => setStep(1)}>
                  Edit
                </button>
              </div>
              <div className="store-review-detail">
                <span>
                  {delivery.shippingMethod === 'PICKUP' ? 'Pickup' : 'Delivery'}
                </span>
                <p>
                  {delivery.shippingMethod === 'PICKUP' ? (
                    `${storeSettings?.pickupLabel ?? 'Dollz atelier'}, ${storeSettings?.pickupCity ?? 'Beirut'}`
                  ) : (
                    <>
                      {delivery.addressLine1}
                      <br />
                      {delivery.city}, {delivery.country}
                    </>
                  )}
                </p>
                <button type="button" onClick={() => setStep(2)}>
                  Edit
                </button>
              </div>
              <label>
                Anything else the atelier should know? <small>Optional</small>
                <textarea
                  rows={4}
                  maxLength={4000}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
              <TurnstileWidget onToken={setTurnstileToken} />
            </div>
          ) : null}

          {error ? (
            <p className="store-inline-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="store-flow-actions">
            {step > 1 ? (
              <button
                className="store-button store-button-quiet"
                type="button"
                onClick={() => {
                  setError('');
                  setStep(step - 1);
                }}
              >
                Back
              </button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <button
                className="store-button store-button-primary"
                type="button"
                onClick={() => {
                  if (validateCurrentStep()) setStep(step + 1);
                }}
              >
                Continue
              </button>
            ) : (
              <button
                className="store-button store-button-primary"
                type="button"
                disabled={submitting}
                onClick={() => void submitOrder()}
              >
                {submitting ? 'Sending request…' : 'Send to the atelier'}
              </button>
            )}
          </div>
        </section>

        <aside className="store-order-summary">
          <p className="store-kicker">
            Your design{items.length > 1 ? 's' : ''}
          </p>
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
          <div className="store-summary-total">
            <span>Estimated subtotal</span>
            <strong>{money(total, currency)}</strong>
          </div>
          <p>
            Delivery and any atelier adjustments are confirmed after review.
          </p>
        </aside>
      </div>
    </main>
  );
}
