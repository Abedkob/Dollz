'use client';

import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  CopyPlus,
  Ellipsis,
  ImageIcon,
  Package,
  PackageOpen,
  PencilLine,
  Plus,
  RotateCcw,
  Search,
  Star,
  X,
  type LucideIcon,
} from 'lucide-react';
import { catalogRequest, money, type ProductSummary } from '../lib/catalog';
import { ProductCreateWizard } from './product-create-wizard';
import { ProductEditWizard } from './product-edit-wizard';

interface ProductPage {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const productViews: ReadonlyArray<{
  label: string;
  value: ProductSummary['status'] | '';
  icon: LucideIcon;
}> = [
  { label: 'All products', value: '', icon: Package },
  { label: 'Live', value: 'ACTIVE', icon: CheckCircle2 },
  { label: 'Drafts', value: 'DRAFT', icon: PencilLine },
  { label: 'Unavailable', value: 'UNAVAILABLE', icon: CircleOff },
  { label: 'Archived', value: 'ARCHIVED', icon: Archive },
];

const statusCopy: Record<
  ProductSummary['status'],
  { label: string; description: string }
> = {
  ACTIVE: { label: 'Live', description: 'Visible in the shop' },
  DRAFT: { label: 'Draft', description: 'Not published yet' },
  UNAVAILABLE: { label: 'Unavailable', description: 'Hidden from purchase' },
  ARCHIVED: { label: 'Archived', description: 'Stored for reference' },
};

export function ProductList({
  csrfToken,
  catalogDefaults,
}: {
  csrfToken: string;
  catalogDefaults?: {
    currency: string;
    productionMinDays: number;
    productionMaxDays: number;
  };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<ProductPage | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [wizardOpen, setWizardOpen] = useState(params.get('create') === '1');
  const [editingId, setEditingId] = useState(params.get('edit'));
  const query = params.toString();
  useEffect(() => {
    setWizardOpen(params.get('create') === '1');
    setEditingId(params.get('edit'));
  }, [params]);
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await catalogRequest<ProductPage>(`products?${query}`));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Products could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => {
    void load();
  }, [load]);
  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    router.replace(`/admin/products${next.size ? `?${next}` : ''}`, {
      scroll: false,
    });
  }
  function setView(status: ProductSummary['status'] | '') {
    const next = new URLSearchParams(params.toString());
    if (status) next.set('status', status);
    else next.delete('status');
    next.delete('page');
    router.replace(`/admin/products${next.size ? `?${next}` : ''}`, {
      scroll: false,
    });
  }
  function clearFilters() {
    const next = new URLSearchParams(params.toString());
    next.delete('search');
    next.delete('status');
    next.delete('featured');
    next.delete('page');
    router.replace(`/admin/products${next.size ? `?${next}` : ''}`, {
      scroll: false,
    });
  }
  function openWizard() {
    const next = new URLSearchParams(params.toString());
    next.set('create', '1');
    setWizardOpen(true);
    router.replace(`/admin/products?${next}`, { scroll: false });
  }
  function closeWizard() {
    const next = new URLSearchParams(params.toString());
    next.delete('create');
    setWizardOpen(false);
    router.replace(`/admin/products${next.size ? `?${next}` : ''}`, {
      scroll: false,
    });
  }
  function openEditWizard(productId: string) {
    const next = new URLSearchParams(params.toString());
    next.delete('create');
    next.set('edit', productId);
    setEditingId(productId);
    router.replace(`/admin/products?${next}`, { scroll: false });
  }
  function closeEditWizard() {
    const next = new URLSearchParams(params.toString());
    next.delete('edit');
    setEditingId(null);
    router.replace(`/admin/products${next.size ? `?${next}` : ''}`, {
      scroll: false,
    });
    void load();
  }
  async function action(
    product: ProductSummary,
    kind: 'publish' | 'unpublish' | 'archive',
  ) {
    if (
      kind === 'archive' &&
      !window.confirm(
        `Archive “${product.name}”? It will remain stored but cannot be published.`,
      )
    )
      return;
    setBusy(product.id);
    setError('');
    try {
      await catalogRequest(
        `products/${product.id}/${kind}`,
        { method: 'POST' },
        csrfToken,
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The product could not be updated.',
      );
    } finally {
      setBusy('');
    }
  }
  async function duplicate(product: ProductSummary) {
    setBusy(product.id);
    setError('');
    setNotice('');
    try {
      const result = await catalogRequest<{
        product: ProductSummary;
        copied: { variants: number };
      }>(`products/${product.id}/duplicate`, { method: 'POST' }, csrfToken);
      const variantLabel =
        result.copied.variants === 1
          ? '1 variant'
          : `${result.copied.variants} variants`;
      setNotice(
        `Draft copy created with ${variantLabel}. Review its name and SKUs before publishing.`,
      );
      openEditWizard(result.product.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The product could not be duplicated.',
      );
    } finally {
      setBusy('');
    }
  }
  const filtered = Boolean(
    params.get('search') || params.get('status') || params.get('featured'),
  );
  const activeView = params.get('status') ?? '';
  const activeFilterTags = [
    params.get('search')
      ? { name: 'search', label: `Search: ${params.get('search')}` }
      : null,
    params.get('featured')
      ? {
          name: 'featured',
          label:
            params.get('featured') === 'true' ? 'Featured' : 'Not featured',
        }
      : null,
  ].filter((tag): tag is { name: string; label: string } => Boolean(tag));
  return (
    <div className="catalog-page">
      <header className="catalog-masthead">
        <div>
          <p className="admin-kicker">Atelier catalog</p>
          <h1>Products</h1>
          <p>
            Prepare each doll design, keep its sizes current, and control what
            customers can order.
          </p>
        </div>
        <div className="catalog-masthead-actions">
          {data ? (
            <div className="catalog-result-count" aria-live="polite">
              <strong>{data.total}</strong>
              <span>{data.total === 1 ? 'product' : 'products'} in view</span>
            </div>
          ) : null}
          <button
            className="catalog-add-product"
            type="button"
            onClick={openWizard}
          >
            <Plus size={17} aria-hidden="true" /> Add product
          </button>
        </div>
      </header>

      <nav className="product-view-tabs" aria-label="Product views">
        {productViews.map((view) => {
          const Icon = view.icon;
          const active = activeView === view.value;
          return (
            <button
              key={view.label}
              className={active ? 'active' : ''}
              aria-pressed={active}
              onClick={() => setView(view.value)}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              {view.label}
            </button>
          );
        })}
      </nav>

      <section className="catalog-commandbar" aria-label="Find products">
        <div className="catalog-toolbar">
          <label className="catalog-search">
            <span className="visually-hidden">Search products</span>
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              defaultValue={params.get('search') ?? ''}
              onChange={(event) => update('search', event.target.value)}
              placeholder="Search by product name or slug"
            />
          </label>
          <label className="catalog-feature-filter">
            <Star size={16} strokeWidth={1.8} aria-hidden="true" />
            <span className="visually-hidden">Featured status</span>
            <select
              value={params.get('featured') ?? ''}
              onChange={(event) => update('featured', event.target.value)}
            >
              <option value="">All visibility</option>
              <option value="true">Featured only</option>
              <option value="false">Not featured</option>
            </select>
          </label>
          {filtered ? (
            <button className="catalog-clear-filters" onClick={clearFilters}>
              <RotateCcw size={15} aria-hidden="true" /> Clear
            </button>
          ) : null}
        </div>
        {activeFilterTags.length > 0 ? (
          <div className="catalog-active-filters" aria-label="Active filters">
            {activeFilterTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => update(tag.name, '')}
                aria-label={`Remove ${tag.label}`}
              >
                {tag.label} <X size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {notice ? (
        <div className="success-message catalog-action-notice" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="state-panel error-state" role="alert">
          <CircleOff size={24} aria-hidden="true" />
          <h2>Products could not be loaded</h2>
          <p>{error} Your current view has been kept.</p>
          <button className="secondary-button" onClick={() => void load()}>
            <RotateCcw size={15} aria-hidden="true" /> Try again
          </button>
        </div>
      ) : loading ? (
        <div className="product-list-skeleton" aria-live="polite">
          <span>
            <Package size={15} aria-hidden="true" /> Preparing products…
          </span>
          {[1, 2, 3].map((row) => (
            <i key={row} />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="state-panel catalog-empty-state">
          <span aria-hidden="true">
            {filtered ? <Search size={22} /> : <PackageOpen size={22} />}
          </span>
          <h2>
            {filtered
              ? 'No products match this view'
              : 'Start your first doll design'}
          </h2>
          <p>
            {filtered
              ? 'Try another view or clear the filters to see every product.'
              : 'Create the base product, then add its photography, sizes, and customization choices.'}
          </p>
          {filtered ? (
            <button className="secondary-button" onClick={clearFilters}>
              Clear filters
            </button>
          ) : (
            <button
              className="catalog-add-product"
              type="button"
              onClick={openWizard}
            >
              <Plus size={17} aria-hidden="true" /> Add product
            </button>
          )}
        </div>
      ) : data ? (
        <>
          <div className="product-inventory" role="list" aria-label="Products">
            <div className="product-inventory-head" aria-hidden="true">
              <span>Product</span>
              <span>Availability</span>
              <span>Price</span>
              <span>Sizes</span>
              <span>Updated</span>
              <span>Actions</span>
            </div>
            {data.items.map((product) => {
              const productStatus = statusCopy[product.status];
              return (
                <article
                  className={`product-inventory-row${busy === product.id ? ' is-busy' : ''}`}
                  role="listitem"
                  key={product.id}
                >
                  <button
                    className="product-identity"
                    type="button"
                    onClick={() => openEditWizard(product.id)}
                    aria-label={`Edit ${product.name}`}
                  >
                    <span className="product-inventory-thumb">
                      {product.primaryThumbnailUrl ? (
                        <img src={product.primaryThumbnailUrl} alt="" />
                      ) : (
                        <ImageIcon
                          size={22}
                          strokeWidth={1.6}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="product-identity-copy">
                      <span>
                        <strong>{product.name}</strong>
                        {product.isFeatured ? (
                          <small className="product-featured-tag">
                            <Star
                              size={11}
                              fill="currentColor"
                              aria-hidden="true"
                            />
                            Featured
                          </small>
                        ) : null}
                      </span>
                      <small>/{product.slug}</small>
                    </span>
                  </button>
                  <span className="product-availability">
                    <span
                      className={`status-badge status-${product.status.toLowerCase()}`}
                    >
                      {productStatus.label}
                    </span>
                    <small>{productStatus.description}</small>
                  </span>
                  <span className="product-price-cell">
                    <strong>
                      {money(product.startingPriceMinor, product.currency)}
                    </strong>
                    <small>Starting price</small>
                  </span>
                  <span className="product-size-cell">
                    <strong>{product.activeVariantCount}</strong>
                    <small>
                      active{' '}
                      {product.activeVariantCount === 1 ? 'size' : 'sizes'}
                    </small>
                  </span>
                  <time
                    className="product-updated-cell"
                    dateTime={product.updatedAt}
                  >
                    <strong>
                      {new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium',
                      }).format(new Date(product.updatedAt))}
                    </strong>
                    <small>Last updated</small>
                  </time>
                  <div className="product-row-actions">
                    <button
                      className="product-edit-action"
                      type="button"
                      onClick={() => openEditWizard(product.id)}
                    >
                      Edit <ArrowRight size={15} aria-hidden="true" />
                    </button>
                    <details className="product-more-actions">
                      <summary aria-label={`More actions for ${product.name}`}>
                        <Ellipsis size={18} aria-hidden="true" />
                      </summary>
                      <div>
                        <button
                          onClick={() => void duplicate(product)}
                          disabled={busy === product.id}
                        >
                          <CopyPlus size={15} aria-hidden="true" />
                          Duplicate
                        </button>
                        {product.status !== 'ARCHIVED' ? (
                          <>
                            {product.status === 'ACTIVE' ? (
                              <button
                                onClick={() =>
                                  void action(product, 'unpublish')
                                }
                                disabled={busy === product.id}
                              >
                                <CircleOff size={15} aria-hidden="true" />
                                Unpublish
                              </button>
                            ) : (
                              <button
                                onClick={() => void action(product, 'publish')}
                                disabled={busy === product.id}
                              >
                                <CheckCircle2 size={15} aria-hidden="true" />
                                Publish
                              </button>
                            )}
                            <button
                              className="danger-link"
                              onClick={() => void action(product, 'archive')}
                              disabled={busy === product.id}
                            >
                              <Archive size={15} aria-hidden="true" /> Archive
                            </button>
                          </>
                        ) : null}
                      </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
          <nav className="pagination" aria-label="Product pages">
            <button
              disabled={data.page <= 1}
              onClick={() => update('page', String(data.page - 1))}
            >
              <ChevronLeft size={15} aria-hidden="true" /> Previous
            </button>
            <span>
              Page {data.page} of{' '}
              {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            <button
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => update('page', String(data.page + 1))}
            >
              Next <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        </>
      ) : null}

      {wizardOpen && (
        <ProductCreateWizard
          csrfToken={csrfToken}
          onClose={closeWizard}
          defaults={catalogDefaults}
        />
      )}
      {editingId && (
        <ProductEditWizard
          productId={editingId}
          csrfToken={csrfToken}
          onClose={closeEditWizard}
        />
      )}
    </div>
  );
}
