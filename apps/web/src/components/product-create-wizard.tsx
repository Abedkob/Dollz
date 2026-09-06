'use client';

import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { catalogRequest, money, type ProductDetails } from '../lib/catalog';

const steps = [
  { label: 'Essentials', hint: 'Describe and price the doll' },
  { label: 'Review', hint: 'Check and create the draft' },
] as const;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readText(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}

function nullable(value: string) {
  return value || null;
}

interface ProductSummary {
  name: string;
  slug: string;
  shortDescription: string;
  priceMinor: number;
  currency: string;
  productionMinDays: number;
  productionMaxDays: number;
  isFeatured: boolean;
}

const emptySummary: ProductSummary = {
  name: '',
  slug: '',
  shortDescription: '',
  priceMinor: 0,
  currency: 'USD',
  productionMinDays: 14,
  productionMaxDays: 30,
  isFeatured: false,
};

export function ProductCreateWizard({
  csrfToken,
  onClose,
  onCreated,
  defaults,
}: {
  csrfToken: string;
  onClose: () => void;
  onCreated?: (productId: string) => void;
  defaults?: {
    currency: string;
    productionMinDays: number;
    productionMaxDays: number;
  };
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [summary, setSummary] = useState<ProductSummary>(emptySummary);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<
    Array<{ field: string; message: string }>
  >([]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    };
  }, []);

  useEffect(() => {
    const content =
      formRef.current?.querySelector<HTMLElement>('.wizard-content');
    if (content) content.scrollTop = 0;
    formRef.current
      ?.querySelector<HTMLElement>(`[data-wizard-step="${step}"] h2`)
      ?.focus({ preventScroll: true });
  }, [step]);

  function requestClose() {
    if (
      dirty &&
      !window.confirm('Discard this product draft? Your entries will be lost.')
    )
      return;
    onClose();
  }

  function validateEssentials() {
    const panel = formRef.current?.querySelector<HTMLElement>(
      '[data-wizard-step="0"]',
    );
    if (!panel) return false;
    const controls = Array.from(
      panel.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input, textarea, select'),
    );
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    const minimum = formRef.current?.elements.namedItem(
      'productionMinDays',
    ) as HTMLInputElement | null;
    const maximum = formRef.current?.elements.namedItem(
      'productionMaxDays',
    ) as HTMLInputElement | null;
    if (minimum && maximum && Number(maximum.value) < Number(minimum.value)) {
      maximum.setCustomValidity(
        'Maximum production time must be at least the minimum.',
      );
      maximum.reportValidity();
      maximum.focus();
      return false;
    }
    maximum?.setCustomValidity('');
    return true;
  }

  function readSummary() {
    if (!formRef.current) return emptySummary;
    const form = new FormData(formRef.current);
    const name = readText(form, 'name');
    return {
      name,
      slug: slugify(name),
      shortDescription: readText(form, 'shortDescription'),
      priceMinor: Math.round(Number(form.get('startingPrice')) * 100),
      currency: readText(form, 'currency').toUpperCase(),
      productionMinDays: Number(form.get('productionMinDays')),
      productionMaxDays: Number(form.get('productionMaxDays')),
      isFeatured: form.get('isFeatured') === 'on',
    };
  }

  function continueWizard() {
    if (!validateEssentials()) return;
    setSummary(readSummary());
    setMessage('');
    setErrors([]);
    setStep(1);
  }

  function goBack() {
    setMessage('');
    setErrors([]);
    setStep(0);
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!formRef.current) return;
    const form = new FormData(formRef.current);
    const current = readSummary();
    const payload = {
      name: current.name,
      slug: current.slug,
      shortDescription: current.shortDescription,
      description: nullable(readText(form, 'description')),
      startingPriceMinor: current.priceMinor,
      currency: current.currency,
      productionMinDays: current.productionMinDays,
      productionMaxDays: current.productionMaxDays,
      isFeatured: current.isFeatured,
      seoTitle: current.name,
      seoDescription: current.shortDescription,
    };
    setBusy(true);
    setMessage('');
    setErrors([]);
    try {
      const result = await catalogRequest<{
        product: ProductDetails['product'];
      }>(
        'products',
        { method: 'POST', body: JSON.stringify(payload) },
        csrfToken,
      );
      setDirty(false);
      if (onCreated) onCreated(result.product.id);
      else window.location.assign(`/admin/products/${result.product.id}`);
    } catch (reason) {
      const error = reason as Error & {
        details?: Array<{ field: string; message: string }>;
      };
      setMessage(error.message || 'The product could not be created.');
      setErrors(error.details ?? []);
      setStep(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      className="product-wizard"
      ref={dialogRef}
      aria-labelledby="product-wizard-title"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <form
        ref={formRef}
        className="wizard-form"
        onSubmit={createProduct}
        onChange={() => setDirty(true)}
      >
        <header className="wizard-header">
          <div>
            <p className="eyebrow">New product</p>
            <h1 id="product-wizard-title">Add a doll</h1>
            <p>Enter the essentials. The catalog URL and SEO are automatic.</p>
          </div>
          <button
            type="button"
            className="wizard-close"
            aria-label="Close product wizard"
            onClick={requestClose}
          >
            ×
          </button>
        </header>

        <ol className="wizard-progress" aria-label="Product creation progress">
          {steps.map((item, index) => (
            <li
              key={item.label}
              className={index === step ? 'active' : index < step ? 'done' : ''}
              aria-current={index === step ? 'step' : undefined}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </div>
            </li>
          ))}
        </ol>

        <div className="wizard-content">
          {message && (
            <div className="form-summary wizard-error" role="alert">
              <h2>Review the product</h2>
              <p>{message}</p>
              {errors.length > 0 && (
                <ul>
                  {errors.map((error, index) => (
                    <li key={`${error.field}-${index}`}>{error.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <section
            data-wizard-step="0"
            className="wizard-step"
            hidden={step !== 0}
            aria-labelledby="wizard-essentials-heading"
          >
            <div className="wizard-step-heading">
              <p>Step 1 of 2</p>
              <h2 id="wizard-essentials-heading" tabIndex={-1}>
                Product essentials
              </h2>
              <span>Only the details needed to start the product draft.</span>
            </div>
            <div className="form-grid wizard-fields">
              <label className="span-2">
                Product name
                <input
                  name="name"
                  required
                  maxLength={200}
                  autoFocus
                  placeholder="e.g. Classic Linen Doll"
                />
              </label>
              <label className="span-2">
                Short description
                <textarea
                  name="shortDescription"
                  aria-label="Short description"
                  rows={2}
                  required
                  maxLength={500}
                  placeholder="What makes this doll special?"
                />
                <small>This also becomes the SEO description.</small>
              </label>
              <label>
                Starting price
                <input
                  name="startingPrice"
                  aria-label="Starting price"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  placeholder="0.00"
                  inputMode="decimal"
                />
                <small>Amount customers will see in USD.</small>
              </label>
              <label className="span-2">
                Full description{' '}
                <span className="optional-label">Optional</span>
                <textarea
                  name="description"
                  aria-label="Full description"
                  rows={4}
                  maxLength={20000}
                  placeholder="Materials, character, and handmade details."
                />
              </label>
            </div>

            <details className="wizard-search-details wizard-optional-settings">
              <summary>Optional settings</summary>
              <div className="form-grid wizard-fields">
                <label>
                  Currency
                  <input
                    name="currency"
                    required
                    pattern="[A-Za-z]{3}"
                    maxLength={3}
                    defaultValue={defaults?.currency ?? 'USD'}
                    autoCapitalize="characters"
                  />
                </label>
                <label>
                  Minimum production days
                  <input
                    name="productionMinDays"
                    type="number"
                    min={0}
                    step={1}
                    required
                    defaultValue={defaults?.productionMinDays ?? 14}
                  />
                </label>
                <label>
                  Maximum production days
                  <input
                    name="productionMaxDays"
                    type="number"
                    min={0}
                    step={1}
                    required
                    defaultValue={defaults?.productionMaxDays ?? 30}
                    onChange={(event) =>
                      event.currentTarget.setCustomValidity('')
                    }
                  />
                </label>
                <label className="check-label">
                  <input name="isFeatured" type="checkbox" />
                  Feature when ready
                </label>
              </div>
            </details>
          </section>

          <section
            data-wizard-step="1"
            className="wizard-step"
            hidden={step !== 1}
            aria-labelledby="wizard-review-heading"
          >
            <div className="wizard-step-heading">
              <p>Step 2 of 2</p>
              <h2 id="wizard-review-heading" tabIndex={-1}>
                Ready to create
              </h2>
              <span>Photos, sizes, and customization come next.</span>
            </div>
            <div className="wizard-review">
              <dl>
                <div>
                  <dt>Product</dt>
                  <dd>{summary.name}</dd>
                </div>
                <div>
                  <dt>Starting price</dt>
                  <dd>{money(summary.priceMinor, summary.currency)}</dd>
                </div>
                <div>
                  <dt>Production window</dt>
                  <dd>
                    {summary.productionMinDays}–{summary.productionMaxDays} days
                  </dd>
                </div>
                <div>
                  <dt>Catalog URL</dt>
                  <dd>/{summary.slug}</dd>
                </div>
              </dl>
              {summary.isFeatured && (
                <p className="wizard-featured-note">Featured product</p>
              )}
            </div>
            <div className="wizard-seo-note">
              <strong>SEO generated automatically</strong>
              <p className="wizard-seo-title">{summary.name}</p>
              <p>{summary.shortDescription}</p>
            </div>
          </section>
        </div>

        <footer className="wizard-actions">
          <span aria-live="polite">{steps[step]?.hint}</span>
          <div>
            {step > 0 && (
              <button
                type="button"
                className="secondary-button"
                onClick={goBack}
              >
                Back
              </button>
            )}
            {step === 0 ? (
              <button
                type="button"
                className="primary-button"
                onClick={continueWizard}
              >
                Review product
              </button>
            ) : (
              <button type="submit" className="primary-button" disabled={busy}>
                {busy ? 'Creating product…' : 'Create product'}
              </button>
            )}
          </div>
        </footer>
      </form>
    </dialog>
  );
}
