'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import React from 'react';
import {
  catalogRequest,
  money,
  type MediaItem,
  type OptionValue,
  type ProductDetails,
  type ProductOption,
  type Variant,
} from '../lib/catalog';

const tabs = [
  'General',
  'Media',
  'Variants',
  'Customization',
  'SEO',
  'Publishing',
] as const;
const tabHints: Record<(typeof tabs)[number], string> = {
  General: 'Details',
  Media: 'Images',
  Variants: 'Sizes',
  Customization: 'Choices',
  SEO: 'Search',
  Publishing: 'Finish',
};
const number = (form: FormData, name: string) => Number(form.get(name));
const text = (form: FormData, name: string) =>
  String(form.get(name) ?? '').trim();
const nullable = (value: string) => value || null;

function useMediaLibrary(category: MediaItem['category']) {
  const [items, setItems] = useState<MediaItem[]>([]);
  useEffect(() => {
    void catalogRequest<{ items: MediaItem[] }>(
      `media?category=${category}&pageSize=100`,
    )
      .then((result) => setItems(result.items))
      .catch(() => setItems([]));
  }, [category]);
  return items;
}

function ErrorSummary({
  message,
  details,
}: {
  message: string;
  details: Array<{ field: string; message: string }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  if (!message) return null;
  return (
    <div className="form-summary" role="alert" tabIndex={-1} ref={ref}>
      <h2>Review this change</h2>
      <p>{message}</p>
      {details.length > 0 && (
        <ul>
          {details.map((item, index) => (
            <li key={`${item.field}-${index}`}>{item.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProductEditor({
  csrfToken,
  initial,
  wizard = false,
  onClose,
  onDirtyChange,
}: {
  csrfToken: string;
  initial: ProductDetails | null;
  wizard?: boolean;
  onClose?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [details, setDetails] = useState(initial);
  const [tab, setTab] = useState<(typeof tabs)[number]>('General');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<
    Array<{ field: string; message: string }>
  >([]);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingTab = useRef<(typeof tabs)[number] | null>(null);
  const product = details?.product;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  async function reload() {
    if (product)
      setDetails(
        await catalogRequest<ProductDetails>(`products/${product.id}`),
      );
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      name: text(form, 'name'),
      slug: text(form, 'slug'),
      shortDescription: nullable(text(form, 'shortDescription')),
      description: nullable(text(form, 'description')),
      startingPriceMinor: number(form, 'startingPriceMinor'),
      currency: text(form, 'currency').toUpperCase(),
      productionMinDays: number(form, 'productionMinDays'),
      productionMaxDays: number(form, 'productionMaxDays'),
      isFeatured: form.get('isFeatured') === 'on',
      seoTitle: nullable(text(form, 'seoTitle')),
      seoDescription: nullable(text(form, 'seoDescription')),
      ...(product ? { version: product.version } : {}),
    };
    setBusy(true);
    setMessage('');
    setErrors([]);
    try {
      if (product) {
        const result = await catalogRequest<{
          product: ProductDetails['product'];
        }>(
          `products/${product.id}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
          csrfToken,
        );
        setDetails((current) =>
          current ? { ...current, product: result.product } : current,
        );
        setDirty(false);
        setMessage('Product details saved.');
        if (pendingTab.current) {
          setTab(pendingTab.current);
          pendingTab.current = null;
        }
      } else {
        const result = await catalogRequest<{
          product: ProductDetails['product'];
        }>(
          'products',
          { method: 'POST', body: JSON.stringify(payload) },
          csrfToken,
        );
        window.location.assign(`/admin/products/${result.product.id}`);
      }
    } catch (reason) {
      const error = reason as Error & {
        details?: Array<{ field: string; message: string }>;
      };
      setMessage(error.message);
      setErrors(error.details ?? []);
      pendingTab.current = null;
    } finally {
      setBusy(false);
    }
  }
  const defaults = {
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    startingPriceMinor: product?.startingPriceMinor ?? 0,
    currency: product?.currency ?? 'USD',
    productionMinDays: product?.productionMinDays ?? 14,
    productionMaxDays: product?.productionMaxDays ?? 30,
    seoTitle: product?.seoTitle ?? '',
    seoDescription: product?.seoDescription ?? '',
  };
  const step = tabs.indexOf(tab);
  const previousTab = tabs[step - 1];
  const nextTab = tabs[step + 1];
  function moveTo(name: (typeof tabs)[number]) {
    if (dirty && ['General', 'SEO'].includes(tab)) {
      pendingTab.current = name;
      formRef.current?.requestSubmit();
      return;
    }
    setTab(name);
  }
  function requestClose() {
    if (dirty && !window.confirm('Discard the unsaved product detail changes?'))
      return;
    onClose?.();
  }
  return (
    <div className={wizard ? 'edit-wizard-shell' : undefined}>
      <header className={`editor-header${wizard ? ' edit-wizard-header' : ''}`}>
        <div>
          <p className="eyebrow">
            {product ? 'Product editor' : 'New product'}
          </p>
          <h1>{product?.name || 'Start a doll design'}</h1>
          <p className="page-intro">
            {product
              ? `/${product.slug}`
              : 'Save the essentials first, then add imagery, sizes, and customization.'}
          </p>
        </div>
        <div className="editor-header-actions">
          {wizard ? (
            <button
              type="button"
              className="wizard-close"
              aria-label="Close product editor"
              onClick={requestClose}
            >
              ×
            </button>
          ) : (
            <a className="secondary-link" href="/admin/products">
              Back to products
            </a>
          )}
          {product && (
            <span
              className={`status-badge status-${product.status.toLowerCase()}`}
            >
              {product.status}
            </span>
          )}
        </div>
      </header>
      <ErrorSummary
        message={message && errors.length ? message : ''}
        details={errors}
      />
      {message && !errors.length && (
        <p className="success-message" role="status">
          {message}
        </p>
      )}
      <nav
        className={wizard ? 'edit-wizard-progress' : 'editor-tabs'}
        aria-label={wizard ? 'Product editing progress' : 'Product sections'}
      >
        {tabs.map((name, index) => (
          <button
            key={name}
            type="button"
            className={tab === name ? 'active' : ''}
            aria-current={tab === name ? 'page' : undefined}
            disabled={!product && !['General', 'SEO'].includes(name)}
            onClick={() => moveTo(name)}
          >
            {wizard && <span>{index + 1}</span>}
            {wizard ? (
              <span>
                <strong>{name}</strong>
                <small>{tabHints[name]}</small>
              </span>
            ) : (
              name
            )}
          </button>
        ))}
      </nav>
      <form
        id="product-details-form"
        ref={formRef}
        className="editor-form"
        onSubmit={save}
        onChange={() => setDirty(true)}
      >
        <section
          className={tab === 'General' ? 'editor-panel' : 'editor-panel hidden'}
          aria-labelledby="general-heading"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">General</p>
              <h2 id="general-heading">The doll design</h2>
            </div>
            <p>Public-facing essentials and production timing.</p>
          </div>
          <div className="form-grid">
            <label className="span-2">
              Product name
              <input
                name="name"
                required
                maxLength={200}
                defaultValue={defaults.name}
              />
            </label>
            <label>
              Slug
              <input
                name="slug"
                required
                maxLength={200}
                defaultValue={defaults.slug}
                aria-describedby="slug-help"
              />
              <small id="slug-help">
                Lowercase URL name; normalized when saved.
              </small>
            </label>
            <label>
              Currency
              <input
                name="currency"
                required
                pattern="[A-Za-z]{3}"
                maxLength={3}
                defaultValue={defaults.currency}
              />
            </label>
            <label className="span-2">
              Short description
              <textarea
                name="shortDescription"
                rows={2}
                maxLength={500}
                defaultValue={defaults.shortDescription}
              />
            </label>
            <label className="span-2">
              Full description
              <textarea
                name="description"
                rows={8}
                maxLength={20000}
                defaultValue={defaults.description}
              />
            </label>
            <label>
              Starting price (minor units)
              <input
                name="startingPriceMinor"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={defaults.startingPriceMinor}
              />
              <small>For USD, 12500 means $125.00.</small>
            </label>
            <label>
              Minimum production days
              <input
                name="productionMinDays"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={defaults.productionMinDays}
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
                defaultValue={defaults.productionMaxDays}
              />
            </label>
            <label className="check-label">
              <input
                name="isFeatured"
                type="checkbox"
                defaultChecked={product?.isFeatured}
              />{' '}
              Feature this product later
            </label>
          </div>
        </section>
        <section
          className={tab === 'SEO' ? 'editor-panel' : 'editor-panel hidden'}
          aria-labelledby="seo-heading"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">SEO</p>
              <h2 id="seo-heading">Search presentation</h2>
            </div>
            <p>
              Prepare concise copy for the public catalog in the next phase.
            </p>
          </div>
          <div className="form-grid">
            <label className="span-2">
              SEO title
              <input
                name="seoTitle"
                maxLength={200}
                defaultValue={defaults.seoTitle}
              />
            </label>
            <label className="span-2">
              SEO description
              <textarea
                name="seoDescription"
                rows={4}
                maxLength={500}
                defaultValue={defaults.seoDescription}
              />
            </label>
          </div>
          <div className="search-preview">
            <small>
              {defaults.slug
                ? `dollz.local/products/${defaults.slug}`
                : 'dollz.local/products/your-product'}
            </small>
            <h3>
              {defaults.seoTitle || defaults.name || 'Your product title'}
            </h3>
            <p>
              {defaults.seoDescription ||
                defaults.shortDescription ||
                'A short description will appear here.'}
            </p>
          </div>
        </section>
        {!wizard && ['General', 'SEO'].includes(tab) && (
          <div className="sticky-actions">
            <span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Saving…' : product ? 'Save changes' : 'Create product'}
            </button>
          </div>
        )}
      </form>
      {product && tab === 'Media' && (
        <MediaPanel
          productId={product.id}
          csrfToken={csrfToken}
          details={details!}
          reload={reload}
        />
      )}
      {product && tab === 'Variants' && (
        <VariantsPanel
          productId={product.id}
          csrfToken={csrfToken}
          product={product}
          variants={details!.variants}
          reload={reload}
        />
      )}
      {product && tab === 'Customization' && (
        <CustomizationPanel
          productId={product.id}
          csrfToken={csrfToken}
          details={details!}
          reload={reload}
        />
      )}
      {product && tab === 'Publishing' && (
        <PublishingPanel
          productId={product.id}
          status={product.status}
          csrfToken={csrfToken}
          onChange={reload}
        />
      )}
      {wizard && product && (
        <footer className="edit-wizard-actions">
          <span>
            Step {step + 1} of {tabs.length}
            {dirty ? ' · Unsaved changes' : ''}
          </span>
          <div>
            <button
              type="button"
              className="secondary-button"
              disabled={!previousTab || busy}
              onClick={() => previousTab && moveTo(previousTab)}
            >
              Back
            </button>
            {nextTab ? (
              <button
                type="button"
                className="primary-button"
                disabled={busy}
                onClick={() => moveTo(nextTab)}
              >
                {busy
                  ? 'Saving…'
                  : dirty && ['General', 'SEO'].includes(tab)
                    ? 'Save & continue'
                    : 'Continue'}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                onClick={requestClose}
              >
                Done
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

function MediaPanel({
  productId,
  csrfToken,
  details,
  reload,
}: {
  productId: string;
  csrfToken: string;
  details: ProductDetails;
  reload: () => Promise<void>;
}) {
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void catalogRequest<{ items: MediaItem[] }>(
      `media?category=PRODUCT&pageSize=100`,
    )
      .then((result) => setLibrary(result.items))
      .catch(() => setLibrary([]));
  }, []);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('image');
    if (!(file instanceof File) || !file.size) {
      setError('Choose an image first.');
      return;
    }
    const body = new FormData();
    body.append('category', 'PRODUCT');
    body.append('visibility', 'PUBLIC');
    body.append('image', file);
    setBusy(true);
    setError('');
    try {
      const created = await catalogRequest<{ media: MediaItem }>(
        'media/images',
        { method: 'POST', body },
        csrfToken,
      );
      await catalogRequest(
        `products/${productId}/media`,
        {
          method: 'POST',
          body: JSON.stringify({
            fileId: created.media.id,
            altText: text(form, 'altText') || null,
            caption: null,
            sortOrder: details.media.length,
          }),
        },
        csrfToken,
      );
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Image upload failed.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function attach(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fileId = text(form, 'fileId');
    if (!fileId) return;
    setBusy(true);
    try {
      await catalogRequest(
        `products/${productId}/media`,
        {
          method: 'POST',
          body: JSON.stringify({
            fileId,
            altText: text(form, 'altText') || null,
            caption: null,
            sortOrder: details.media.length,
          }),
        },
        csrfToken,
      );
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Image could not be attached.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function act(path: string, method = 'POST', payload?: unknown) {
    setBusy(true);
    setError('');
    try {
      await catalogRequest(
        path,
        { method, body: payload ? JSON.stringify(payload) : undefined },
        csrfToken,
      );
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Image could not be updated.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Media</p>
          <h2>Product gallery</h2>
        </div>
        <p>
          Use one public primary image. Removing it here keeps the file in the
          library.
        </p>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="split-panels">
        <form className="compact-form" onSubmit={upload}>
          <h3>Upload and attach</h3>
          <label>
            Image
            <input
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <label>
            Alt text
            <input name="altText" maxLength={500} />
          </label>
          <button className="primary-button" disabled={busy}>
            Upload image
          </button>
        </form>
        <form className="compact-form" onSubmit={attach}>
          <h3>Attach from library</h3>
          <label>
            Existing product image
            <select name="fileId" required>
              <option value="">Choose an image</option>
              {library
                .filter(
                  (item) =>
                    !details.media.some((media) => media.fileId === item.id),
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.originalName}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Alt text
            <input name="altText" maxLength={500} />
          </label>
          <button className="secondary-button" disabled={busy}>
            Attach image
          </button>
        </form>
      </div>
      <div className="media-gallery">
        {details.media.length === 0 ? (
          <div className="state-panel compact">
            <h3>No gallery images yet</h3>
            <p>Upload or attach the first public product image.</p>
          </div>
        ) : (
          details.media.map((item, index) => (
            <article className="media-card" key={item.id}>
              <img src={item.urls.thumbnail} alt={item.altText || ''} />
              <div>
                <strong>{item.originalName}</strong>
                <small>
                  {item.width} × {item.height}
                </small>
              </div>
              <div className="card-actions">
                {item.isPrimary ? (
                  <span className="status-badge status-active">Primary</span>
                ) : (
                  <button
                    onClick={() =>
                      void act(
                        `products/${productId}/media/${item.id}/set-primary`,
                      )
                    }
                    disabled={busy}
                  >
                    Set primary
                  </button>
                )}
                <button
                  disabled={busy || index === 0}
                  onClick={() => {
                    const ids = details.media.map((media) => media.id);
                    [ids[index - 1], ids[index]] = [
                      ids[index]!,
                      ids[index - 1]!,
                    ];
                    void act(`products/${productId}/media/reorder`, 'POST', {
                      ids,
                    });
                  }}
                >
                  ↑ <span className="visually-hidden">Move image up</span>
                </button>
                <button
                  className="danger-link"
                  onClick={() =>
                    void act(`products/${productId}/media/${item.id}`, 'DELETE')
                  }
                  disabled={busy}
                >
                  Remove
                </button>
              </div>
              <details>
                <summary>Edit description</summary>
                <form
                  className="compact-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    void act(
                      `products/${productId}/media/${item.id}`,
                      'PATCH',
                      {
                        altText: nullable(text(form, 'altText')),
                        caption: nullable(text(form, 'caption')),
                        sortOrder: item.sortOrder,
                        version: item.version,
                      },
                    );
                  }}
                >
                  <label>
                    Alt text
                    <input name="altText" defaultValue={item.altText ?? ''} />
                  </label>
                  <label>
                    Caption
                    <input name="caption" defaultValue={item.caption ?? ''} />
                  </label>
                  <button disabled={busy}>Save image details</button>
                </form>
              </details>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function VariantsPanel({
  productId,
  csrfToken,
  product,
  variants,
  reload,
}: {
  productId: string;
  csrfToken: string;
  product: Pick<
    ProductDetails['product'],
    'slug' | 'currency' | 'startingPriceMinor'
  >;
  variants: Variant[];
  reload: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [newSize, setNewSize] = useState(() =>
    String(
      [25, 30, 40].find(
        (size) =>
          !variants.some((variant) => variantMatchesSize(variant, size)),
      ) ?? '',
    ),
  );
  const library = useMediaLibrary('VARIANT');
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sizeCm = Number(newSize);
    const sizeLabel = `${formatSize(sizeCm)} cm`;
    const skuOverride = text(form, 'sku');
    const payload = {
      sku: skuOverride || makeVariantSku(product.slug, sizeLabel),
      name: text(form, 'name') || sizeLabel,
      sizeLabel,
      sizeCm,
      priceMinor: Math.round(number(form, 'price') * 100),
      currency: product.currency,
      modelKey: nullable(text(form, 'modelKey')),
      previewFileId: nullable(text(form, 'previewFileId')),
      isActive: true,
      sortOrder: variants.length,
    };
    setBusy(true);
    setError('');
    try {
      await catalogRequest(
        `products/${productId}/variants`,
        { method: 'POST', body: JSON.stringify(payload) },
        csrfToken,
      );
      event.currentTarget.reset();
      setNewSize(
        String(
          [25, 30, 40].find(
            (size) =>
              size !== sizeCm &&
              !variants.some((variant) => variantMatchesSize(variant, size)),
          ) ?? '',
        ),
      );
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Variant could not be added.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function update(event: FormEvent<HTMLFormElement>, variant: Variant) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await act(`products/${productId}/variants/${variant.id}`, 'PATCH', {
      sku: text(form, 'sku'),
      name: text(form, 'name'),
      sizeLabel: nullable(text(form, 'sizeLabel')),
      sizeCm: number(form, 'sizeCm') || null,
      priceMinor: Math.round(number(form, 'price') * 100),
      currency: text(form, 'currency').toUpperCase(),
      modelKey: nullable(text(form, 'modelKey')),
      previewFileId: nullable(text(form, 'previewFileId')),
      isActive: variant.isActive,
      sortOrder: variant.sortOrder,
      version: variant.version,
    });
  }
  async function act(path: string, method = 'POST', body?: unknown) {
    setBusy(true);
    try {
      await catalogRequest(
        path,
        { method, body: body ? JSON.stringify(body) : undefined },
        csrfToken,
      );
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Variant could not be updated.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function move(index: number) {
    if (index < 1) return;
    const ids = variants.map((value) => value.id);
    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
    await act(`products/${productId}/variants/reorder`, 'POST', { ids });
  }
  return (
    <section className="editor-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Variants</p>
          <h2>Choose the available sizes</h2>
        </div>
        <p>
          Add each physical doll size once. Hair, eyes, outfits, and colors stay
          under Customization.
        </p>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <form className="variant-quick-create" onSubmit={create}>
        <div className="variant-quick-heading">
          <div>
            <p className="eyebrow">Add a size</p>
            <h3>What size can customers order?</h3>
          </div>
          <span>Label and SKU are created automatically</span>
        </div>
        <div
          className="variant-size-presets"
          role="group"
          aria-label="Common doll sizes"
        >
          {[25, 30, 40].map((size) => {
            const added = variants.some(
              (variant) =>
                variant.isActive && variantMatchesSize(variant, size),
            );
            return (
              <button
                key={size}
                type="button"
                className={newSize === String(size) ? 'active' : ''}
                aria-pressed={newSize === String(size)}
                disabled={added}
                onClick={() => setNewSize(String(size))}
              >
                <strong>{size} cm</strong>
                <small>{added ? 'Already added' : 'Choose size'}</small>
              </button>
            );
          })}
        </div>
        <div className="variant-essential-fields">
          <label>
            Size in centimeters
            <input
              name="sizeCm"
              type="number"
              min="0.01"
              step="0.01"
              value={newSize}
              onChange={(event) => setNewSize(event.target.value)}
              required
            />
            <small>Use this field for a custom size.</small>
          </label>
          <label>
            Price ({product.currency})
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={(product.startingPriceMinor / 100).toFixed(2)}
              required
            />
            <small>Starts with the product's base price.</small>
          </label>
          <label>
            Preview image <span className="optional-label">Optional</span>
            <select name="previewFileId">
              <option value="">Use the product image</option>
              {library.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.originalName}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-button" disabled={busy || !newSize}>
            {busy ? 'Adding…' : 'Add size'}
          </button>
        </div>
        <details className="variant-advanced-create">
          <summary>Advanced details</summary>
          <div>
            <label>
              Custom storefront name
              <input name="name" placeholder={`${newSize || '25'} cm`} />
            </label>
            <label>
              SKU override
              <input
                name="sku"
                maxLength={100}
                placeholder={makeVariantSku(
                  product.slug,
                  `${newSize || '25'} cm`,
                )}
              />
            </label>
            <label>
              3D model key
              <input name="modelKey" placeholder="Optional model identifier" />
            </label>
          </div>
        </details>
      </form>
      <div className="record-list">
        {variants.length === 0 ? (
          <div className="variant-empty-state">
            <span aria-hidden="true">↕</span>
            <div>
              <h3>No sizes added yet</h3>
              <p>Choose a common size above or enter a custom measurement.</p>
            </div>
          </div>
        ) : (
          variants.map((variant, index) => (
            <article
              className={`record-row variant-record ${!variant.isActive ? 'inactive' : ''}`}
              key={variant.id}
            >
              <div className="variant-record-summary">
                {variant.previewUrl ? (
                  <img src={variant.previewUrl} alt="" />
                ) : (
                  <span aria-hidden="true">
                    {formatSize(variant.sizeCm, variant.sizeLabel)}
                    <small>cm</small>
                  </span>
                )}
                <div>
                  <strong>{variant.name}</strong>
                  <small>{money(variant.priceMinor, variant.currency)}</small>
                </div>
              </div>
              <div className="variant-record-meta">
                <small>
                  {variant.sku}
                  <br />
                  {variant.sizeLabel || 'No size label'}
                </small>
              </div>
              <div className="record-flags">
                {variant.isDefault && (
                  <span className="status-badge status-active">Default</span>
                )}
                {!variant.isActive && (
                  <span className="status-badge">Inactive</span>
                )}
              </div>
              <div className="row-actions">
                {variant.isActive && !variant.isDefault && (
                  <button
                    onClick={() =>
                      void act(
                        `products/${productId}/variants/${variant.id}/set-default`,
                      )
                    }
                  >
                    Set default
                  </button>
                )}
                <button disabled={index === 0} onClick={() => void move(index)}>
                  ↑
                  <span className="visually-hidden">
                    Move {variant.name} up
                  </span>
                </button>
                {variant.isActive && (
                  <button
                    className="danger-link"
                    onClick={() =>
                      void act(
                        `products/${productId}/variants/${variant.id}`,
                        'DELETE',
                      )
                    }
                  >
                    Deactivate
                  </button>
                )}
              </div>
              <details className="record-editor">
                <summary>Edit size</summary>
                <form
                  className="variant-edit-form"
                  onSubmit={(event) => void update(event, variant)}
                >
                  <div className="variant-edit-essentials">
                    <label>
                      Size in centimeters
                      <input
                        name="sizeCm"
                        type="number"
                        min="0.01"
                        step="0.01"
                        defaultValue={variant.sizeCm ?? ''}
                        required
                      />
                    </label>
                    <label>
                      Price ({variant.currency})
                      <input
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={(variant.priceMinor / 100).toFixed(2)}
                        required
                      />
                    </label>
                    <button className="primary-button" disabled={busy}>
                      Save size
                    </button>
                  </div>
                  <details className="variant-edit-advanced">
                    <summary>Advanced details</summary>
                    <div>
                      <label>
                        Storefront name
                        <input
                          name="name"
                          defaultValue={variant.name}
                          required
                        />
                      </label>
                      <label>
                        Size label
                        <input
                          name="sizeLabel"
                          defaultValue={variant.sizeLabel ?? ''}
                        />
                      </label>
                      <label>
                        SKU
                        <input name="sku" defaultValue={variant.sku} required />
                      </label>
                      <label>
                        Currency
                        <input
                          name="currency"
                          defaultValue={variant.currency}
                          pattern="[A-Za-z]{3}"
                          required
                        />
                      </label>
                      <label>
                        Model key
                        <input
                          name="modelKey"
                          defaultValue={variant.modelKey ?? ''}
                        />
                      </label>
                      <label>
                        Preview image
                        <select
                          name="previewFileId"
                          defaultValue={variant.previewFileId ?? ''}
                        >
                          <option value="">None</option>
                          {library.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.originalName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </details>
                </form>
              </details>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function formatSize(value: number | null, label?: string | null) {
  if (value === null) return label?.match(/[\d.]+/)?.[0] ?? '—';
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}

function variantMatchesSize(variant: Variant, size: number) {
  return Number(formatSize(variant.sizeCm, variant.sizeLabel)) === size;
}

function makeVariantSku(slug: string, sizeLabel: string) {
  return `${slug}-${sizeLabel}`
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
}

const customizationPresets = [
  {
    code: 'eye-color',
    name: 'Eye color',
    description: 'Brown, blue, green, and hazel',
    colors: ['#6F4A3A', '#6F91B2', '#78866B', '#96775A'],
  },
  {
    code: 'hair-color',
    name: 'Hair color',
    description: 'Espresso, chestnut, blonde, copper, and black',
    colors: ['#3B2923', '#70452F', '#C9A66B', '#A95C3D', '#252326'],
  },
  {
    code: 'skin-tone',
    name: 'Skin tone',
    description: 'Four inclusive fabric tones',
    colors: ['#F1D2C2', '#DDB08D', '#B97850', '#70452F'],
  },
  {
    code: 'outfit-color',
    name: 'Outfit color',
    description: 'Plum, rose, sage, cream, and navy',
    colors: ['#6F315F', '#C9828D', '#87977A', '#EDE1CC', '#34445C'],
  },
] as const;

function CustomizationPanel({
  productId,
  csrfToken,
  details,
  reload,
}: {
  productId: string;
  csrfToken: string;
  details: ProductDetails;
  reload: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState('');
  const imageCards = useMediaLibrary('OPTION');
  async function createOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const affects = form.get('affects3d') === 'on';
    const payload = {
      code: text(form, 'code'),
      name: text(form, 'name'),
      description: null,
      inputType: text(form, 'inputType'),
      isRequired: form.get('isRequired') === 'on',
      isActive: true,
      affects3d: affects,
      threeDProperty: affects ? nullable(text(form, 'threeDProperty')) : null,
      allowCustomValue: form.get('allowCustomValue') === 'on',
      sortOrder: details.options.length,
    };
    await mutate(`products/${productId}/options`, 'POST', payload);
    event.currentTarget.reset();
  }
  async function applyPreset(
    code: (typeof customizationPresets)[number]['code'],
  ) {
    setBusy(true);
    setApplyingPreset(code);
    setError('');
    setNotice('');
    try {
      const result = await catalogRequest<{ option: ProductOption }>(
        `products/${productId}/options/presets/${code}`,
        { method: 'POST' },
        csrfToken,
      );
      await reload();
      setNotice(`${result.option.name} and its colors were added.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The preset could not be added.',
      );
    } finally {
      setApplyingPreset('');
      setBusy(false);
    }
  }
  async function createValue(
    event: FormEvent<HTMLFormElement>,
    option: ProductOption,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      code: text(form, 'code'),
      label: text(form, 'label'),
      description: null,
      colorHex: nullable(text(form, 'colorHex')),
      referenceFileId: nullable(text(form, 'referenceFileId')),
      priceAdjustmentMinor: number(form, 'priceAdjustmentMinor') || 0,
      metadata: {},
      isActive: true,
      sortOrder: option.values.length,
    };
    await mutate(
      `products/${productId}/options/${option.id}/values`,
      'POST',
      payload,
    );
    event.currentTarget.reset();
  }
  async function updateOption(
    event: FormEvent<HTMLFormElement>,
    option: ProductOption,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const affects3d = form.get('affects3d') === 'on';
    await mutate(`products/${productId}/options/${option.id}`, 'PATCH', {
      code: text(form, 'code'),
      name: text(form, 'name'),
      description: nullable(text(form, 'description')),
      inputType: text(form, 'inputType'),
      isRequired: form.get('isRequired') === 'on',
      isActive: option.isActive,
      affects3d,
      threeDProperty: affects3d ? nullable(text(form, 'threeDProperty')) : null,
      allowCustomValue: form.get('allowCustomValue') === 'on',
      sortOrder: option.sortOrder,
      version: option.version,
    });
  }
  async function updateValue(
    event: FormEvent<HTMLFormElement>,
    option: ProductOption,
    value: OptionValue,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      `products/${productId}/options/${option.id}/values/${value.id}`,
      'PATCH',
      {
        code: text(form, 'code'),
        label: text(form, 'label'),
        description: null,
        colorHex: nullable(text(form, 'colorHex')),
        referenceFileId: nullable(text(form, 'referenceFileId')),
        priceAdjustmentMinor: number(form, 'priceAdjustmentMinor') || 0,
        metadata: value.metadata,
        isActive: value.isActive,
        sortOrder: value.sortOrder,
        version: value.version,
      },
    );
  }
  async function moveOption(index: number) {
    if (index < 1) return;
    const ids = details.options.map((option) => option.id);
    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
    await mutate(`products/${productId}/options/reorder`, 'POST', { ids });
  }
  async function moveValue(option: ProductOption, index: number) {
    if (index < 1) return;
    const ids = option.values.map((value) => value.id);
    [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
    await mutate(
      `products/${productId}/options/${option.id}/values/reorder`,
      'POST',
      { ids },
    );
  }
  async function mutate(path: string, method: string, body?: unknown) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await catalogRequest(
        path,
        { method, body: body ? JSON.stringify(body) : undefined },
        csrfToken,
      );
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Customization could not be updated.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Customization</p>
          <h2>Choices for the maker</h2>
        </div>
        <p>
          Hair type and dress style remain visual references and never claim
          automatic mesh switching.
        </p>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}
      <section className="preset-library" aria-labelledby="preset-heading">
        <div className="preset-library-heading">
          <div>
            <p className="eyebrow">Reusable choices</p>
            <h3 id="preset-heading">Add a ready-made color set</h3>
          </div>
          <p>One click adds the option, color values, and a default.</p>
        </div>
        <div className="preset-grid">
          {customizationPresets.map((preset) => {
            const added = details.options.some(
              (option) => option.code === preset.code,
            );
            return (
              <article className="preset-card" key={preset.code}>
                <div>
                  <strong>{preset.name}</strong>
                  <p>{preset.description}</p>
                </div>
                <div className="preset-swatches" aria-hidden="true">
                  {preset.colors.map((color) => (
                    <span key={color} style={{ backgroundColor: color }} />
                  ))}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Add ${preset.name} preset`}
                  disabled={busy || added}
                  onClick={() => void applyPreset(preset.code)}
                >
                  {added
                    ? 'Added'
                    : applyingPreset === preset.code
                      ? 'Adding…'
                      : 'Add preset'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <details className="manual-option-panel">
        <summary>Create a custom option</summary>
        <form className="compact-form inline-create" onSubmit={createOption}>
          <label>
            Code
            <input name="code" required placeholder="eye-color" />
          </label>
          <label>
            Name
            <input name="name" required placeholder="Eye color" />
          </label>
          <label>
            Input type
            <select name="inputType">
              <option>COLOR</option>
              <option>IMAGE_CARD</option>
              <option>SELECT</option>
              <option>TEXT</option>
              <option>TEXTAREA</option>
            </select>
          </label>
          <label className="check-label">
            <input name="isRequired" type="checkbox" /> Required
          </label>
          <label className="check-label">
            <input name="allowCustomValue" type="checkbox" /> Allow custom value
          </label>
          <label className="check-label">
            <input name="affects3d" type="checkbox" /> Affects 3D
          </label>
          <label>
            3D property
            <select name="threeDProperty">
              <option value="">None</option>
              <option>eyes</option>
              <option>hair</option>
              <option>dress</option>
              <option>dressName</option>
            </select>
          </label>
          <button className="primary-button" disabled={busy}>
            Add option
          </button>
        </form>
      </details>
      <div className="option-stack">
        {details.options.length === 0 ? (
          <div className="state-panel compact">
            <h3>No customization options</h3>
            <p>
              Choose a preset above, or create a custom option for something
              unique.
            </p>
          </div>
        ) : (
          details.options.map((option, optionIndex) => (
            <article
              className={`option-block ${!option.isActive ? 'inactive' : ''}`}
              key={option.id}
            >
              <header>
                <div>
                  <strong>{option.name}</strong>
                  <small>
                    {option.code} · {option.inputType}
                    {option.affects3d
                      ? ` · 3D: ${option.threeDProperty}`
                      : ' · Reference only'}
                  </small>
                </div>
                <div className="row-actions">
                  {option.isRequired && (
                    <span className="status-badge">Required</span>
                  )}
                  <button
                    disabled={busy || optionIndex === 0}
                    onClick={() => void moveOption(optionIndex)}
                  >
                    ↑ <span className="visually-hidden">Move option up</span>
                  </button>
                  {option.isActive && (
                    <button
                      className="danger-link"
                      onClick={() =>
                        void mutate(
                          `products/${productId}/options/${option.id}`,
                          'DELETE',
                        )
                      }
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </header>
              <details className="record-editor">
                <summary>Edit option</summary>
                <form
                  className="compact-form inline-create"
                  onSubmit={(event) => void updateOption(event, option)}
                >
                  <label>
                    Code
                    <input name="code" defaultValue={option.code} required />
                  </label>
                  <label>
                    Name
                    <input name="name" defaultValue={option.name} required />
                  </label>
                  <label>
                    Description
                    <input
                      name="description"
                      defaultValue={option.description ?? ''}
                    />
                  </label>
                  <label>
                    Input type
                    <select name="inputType" defaultValue={option.inputType}>
                      <option>COLOR</option>
                      <option>IMAGE_CARD</option>
                      <option>SELECT</option>
                      <option>TEXT</option>
                      <option>TEXTAREA</option>
                    </select>
                  </label>
                  <label className="check-label">
                    <input
                      name="isRequired"
                      type="checkbox"
                      defaultChecked={option.isRequired}
                    />{' '}
                    Required
                  </label>
                  <label className="check-label">
                    <input
                      name="allowCustomValue"
                      type="checkbox"
                      defaultChecked={option.allowCustomValue}
                    />{' '}
                    Allow custom value
                  </label>
                  <label className="check-label">
                    <input
                      name="affects3d"
                      type="checkbox"
                      defaultChecked={option.affects3d}
                    />{' '}
                    Affects 3D
                  </label>
                  <label>
                    3D property
                    <select
                      name="threeDProperty"
                      defaultValue={option.threeDProperty ?? ''}
                    >
                      <option value="">None</option>
                      <option>eyes</option>
                      <option>hair</option>
                      <option>dress</option>
                      <option>dressName</option>
                    </select>
                  </label>
                  <button disabled={busy}>Save option</button>
                </form>
              </details>
              {option.isActive &&
                !['TEXT', 'TEXTAREA'].includes(option.inputType) && (
                  <>
                    <form
                      className="value-create"
                      onSubmit={(event) => void createValue(event, option)}
                    >
                      <label>
                        Value code
                        <input name="code" required />
                      </label>
                      <label>
                        Label
                        <input name="label" required />
                      </label>
                      {option.inputType === 'COLOR' && (
                        <label>
                          Color
                          <input
                            name="colorHex"
                            type="color"
                            defaultValue="#6f315f"
                            required
                          />
                        </label>
                      )}
                      {option.inputType === 'IMAGE_CARD' && (
                        <label>
                          Reference image
                          <select name="referenceFileId" required>
                            <option value="">Choose an image</option>
                            {imageCards.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.originalName}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        Price adjustment
                        <input
                          name="priceAdjustmentMinor"
                          type="number"
                          step="1"
                          defaultValue="0"
                        />
                      </label>
                      <button className="secondary-button" disabled={busy}>
                        Add value
                      </button>
                    </form>
                    <div className="value-list">
                      {option.values.map((value, valueIndex) => (
                        <div className="value-row" key={value.id}>
                          {value.colorHex && (
                            <span
                              className="color-chip"
                              style={{ backgroundColor: value.colorHex }}
                              aria-label={`Color ${value.colorHex}`}
                            />
                          )}
                          <span>
                            <strong>{value.label}</strong>
                            <small>
                              {value.code}
                              {value.priceAdjustmentMinor
                                ? ` · ${value.priceAdjustmentMinor > 0 ? '+' : ''}${value.priceAdjustmentMinor} minor units`
                                : ''}
                            </small>
                          </span>
                          {value.isDefault ? (
                            <span className="status-badge status-active">
                              Default
                            </span>
                          ) : (
                            value.isActive && (
                              <button
                                onClick={() =>
                                  void mutate(
                                    `products/${productId}/options/${option.id}/values/${value.id}/set-default`,
                                    'POST',
                                  )
                                }
                              >
                                Set default
                              </button>
                            )
                          )}
                          <button
                            disabled={busy || valueIndex === 0}
                            onClick={() => void moveValue(option, valueIndex)}
                          >
                            ↑{' '}
                            <span className="visually-hidden">
                              Move value up
                            </span>
                          </button>
                          {value.isActive && (
                            <button
                              className="danger-link"
                              onClick={() =>
                                void mutate(
                                  `products/${productId}/options/${option.id}/values/${value.id}`,
                                  'DELETE',
                                )
                              }
                            >
                              Deactivate
                            </button>
                          )}
                          <details className="record-editor">
                            <summary>Edit</summary>
                            <form
                              className="compact-form"
                              onSubmit={(event) =>
                                void updateValue(event, option, value)
                              }
                            >
                              <label>
                                Code
                                <input
                                  name="code"
                                  defaultValue={value.code}
                                  required
                                />
                              </label>
                              <label>
                                Label
                                <input
                                  name="label"
                                  defaultValue={value.label}
                                  required
                                />
                              </label>
                              {option.inputType === 'COLOR' && (
                                <label>
                                  Color
                                  <input
                                    name="colorHex"
                                    type="color"
                                    defaultValue={value.colorHex ?? '#6f315f'}
                                    required
                                  />
                                </label>
                              )}
                              {option.inputType === 'IMAGE_CARD' && (
                                <label>
                                  Reference image
                                  <select
                                    name="referenceFileId"
                                    defaultValue={value.referenceFileId ?? ''}
                                    required
                                  >
                                    <option value="">Choose an image</option>
                                    {imageCards.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.originalName}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
                              <label>
                                Price adjustment
                                <input
                                  name="priceAdjustmentMinor"
                                  type="number"
                                  step="1"
                                  defaultValue={value.priceAdjustmentMinor}
                                />
                              </label>
                              <button disabled={busy}>Save value</button>
                            </form>
                          </details>
                        </div>
                      ))}
                    </div>
                  </>
                )}
            </article>
          ))
        )}
      </div>
      <ConflictEditor
        productId={productId}
        details={details}
        busy={busy}
        mutate={mutate}
      />
    </section>
  );
}

function ConflictEditor({
  productId,
  details,
  busy,
  mutate,
}: {
  productId: string;
  details: ProductDetails;
  busy: boolean;
  mutate: (path: string, method: string, body?: unknown) => Promise<void>;
}) {
  const values = details.options.flatMap((option) =>
    option.values
      .filter((value) => value.isActive)
      .map((value) => ({
        id: value.id,
        label: `${option.name}: ${value.label}`,
      })),
  );
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(`products/${productId}/option-conflicts`, 'POST', {
      firstValueId: text(form, 'firstValueId'),
      secondValueId: text(form, 'secondValueId'),
      reason: nullable(text(form, 'reason')),
    });
  }
  return (
    <div className="conflict-panel">
      <div>
        <h3>Compatibility conflicts</h3>
        <p>Block pairs that cannot be made together.</p>
      </div>
      <form className="value-create" onSubmit={create}>
        <label>
          First value
          <select name="firstValueId" required>
            <option value="">Choose</option>
            {values.map((value) => (
              <option value={value.id} key={value.id}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Second value
          <select name="secondValueId" required>
            <option value="">Choose</option>
            {values.map((value) => (
              <option value={value.id} key={value.id}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reason
          <input name="reason" maxLength={1000} />
        </label>
        <button
          className="secondary-button"
          disabled={busy || values.length < 2}
        >
          Add conflict
        </button>
      </form>
      {details.conflicts.map((conflict) => (
        <div className="conflict-row" key={conflict.id}>
          <span>
            {conflict.firstOption}: {conflict.firstLabel} ↔{' '}
            {conflict.secondOption}: {conflict.secondLabel}
          </span>
          <button
            className="danger-link"
            onClick={() =>
              void mutate(
                `products/${productId}/option-conflicts/${conflict.id}`,
                'DELETE',
              )
            }
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function PublishingPanel({
  productId,
  status,
  csrfToken,
  onChange,
}: {
  productId: string;
  status: string;
  csrfToken: string;
  onChange: () => Promise<void>;
}) {
  const [checklist, setChecklist] = useState<{
    publishable: boolean;
    details: Array<{ field: string; message: string }>;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setChecklist(
        await catalogRequest(`products/${productId}/publishing-checklist`),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Checklist could not be loaded.',
      );
    }
  };
  useEffect(() => {
    void load();
  }, []);
  async function change(action: 'publish' | 'unpublish') {
    setBusy(true);
    setError('');
    try {
      await catalogRequest(
        `products/${productId}/${action}`,
        { method: 'POST' },
        csrfToken,
      );
      await onChange();
      await load();
    } catch (reason) {
      const value = reason as Error & {
        details?: Array<{ field: string; message: string }>;
      };
      setError(value.message);
      if (value.details)
        setChecklist({ publishable: false, details: value.details });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Publishing</p>
          <h2>Ready for the public catalog?</h2>
        </div>
        <p>
          The public storefront arrives next phase; publishing now verifies that
          the catalog record is complete.
        </p>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {!checklist ? (
        <div className="catalog-loading">Checking product requirements…</div>
      ) : (
        <div
          className={`publish-checklist ${checklist.publishable ? 'ready' : ''}`}
        >
          <h3>
            {checklist.publishable
              ? 'Ready to publish'
              : 'Complete these items'}
          </h3>
          {checklist.publishable ? (
            <p>
              Variants, primary image, production timing, and required choices
              are valid.
            </p>
          ) : (
            <ul>
              {checklist.details.map((item, index) => (
                <li key={`${item.field}-${index}`}>{item.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="publishing-actions">
        {status === 'ACTIVE' ? (
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => void change('unpublish')}
          >
            Unpublish product
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={busy || !checklist?.publishable}
            onClick={() => void change('publish')}
          >
            Publish product
          </button>
        )}
      </div>
    </section>
  );
}
