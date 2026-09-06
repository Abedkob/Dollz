'use client';

import { useCallback, useEffect, useState } from 'react';
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { catalogRequest, money, type ProductSummary } from '../lib/catalog';
import { ProductCreateWizard } from './product-create-wizard';
import { ProductEditWizard } from './product-edit-wizard';

interface ProductPage {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
}

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
  const filtered = Boolean(
    params.get('search') || params.get('status') || params.get('featured'),
  );
  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Catalog</p>
          <h1>Products</h1>
          <p className="page-intro">
            Doll designs, physical sizes, and their path to publication.
          </p>
        </div>
        <button className="primary-link" type="button" onClick={openWizard}>
          Add product
        </button>
      </header>
      <section className="filter-bar" aria-label="Product filters">
        <label className="filter-search">
          Search products
          <input
            type="search"
            defaultValue={params.get('search') ?? ''}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Name or slug"
          />
        </label>
        <label>
          Status
          <select
            value={params.get('status') ?? ''}
            onChange={(event) => update('status', event.target.value)}
          >
            <option value="">All statuses</option>
            <option>DRAFT</option>
            <option>ACTIVE</option>
            <option>UNAVAILABLE</option>
            <option>ARCHIVED</option>
          </select>
        </label>
        <label>
          Featured
          <select
            value={params.get('featured') ?? ''}
            onChange={(event) => update('featured', event.target.value)}
          >
            <option value="">All products</option>
            <option value="true">Featured</option>
            <option value="false">Not featured</option>
          </select>
        </label>
      </section>
      {error && (
        <div className="state-panel error-state" role="alert">
          <h2>Products could not be updated</h2>
          <p>{error}</p>
          <button className="secondary-button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <div className="catalog-loading" aria-live="polite">
          Preparing products…
        </div>
      ) : data?.items.length === 0 ? (
        <div className="state-panel">
          <h2>
            {filtered
              ? 'No products match these filters'
              : 'Start your first doll design'}
          </h2>
          <p>
            {filtered
              ? 'Adjust or clear the filters to see more products.'
              : 'Create the base product first, then add images, sizes, and customization.'}
          </p>
          {filtered ? (
            <button
              className="secondary-button"
              onClick={() => router.replace('/admin/products')}
            >
              Clear filters
            </button>
          ) : (
            <button className="primary-link" type="button" onClick={openWizard}>
              Add product
            </button>
          )}
        </div>
      ) : (
        data && (
          <>
            <div className="product-table" role="table" aria-label="Products">
              <div className="product-row product-table-head" role="row">
                <span>Product</span>
                <span>Status</span>
                <span>Starting price</span>
                <span>Variants</span>
                <span>Updated</span>
                <span className="visually-hidden">Actions</span>
              </div>
              {data.items.map((product) => (
                <article className="product-row" role="row" key={product.id}>
                  <div className="product-cell">
                    <div className="product-thumb">
                      {product.primaryThumbnailUrl ? (
                        <img src={product.primaryThumbnailUrl} alt="" />
                      ) : (
                        <span aria-hidden="true">D</span>
                      )}
                    </div>
                    <div>
                      <strong>{product.name}</strong>
                      <small>/{product.slug}</small>
                    </div>
                  </div>
                  <span>
                    <span
                      className={`status-badge status-${product.status.toLowerCase()}`}
                    >
                      {product.status}
                    </span>
                  </span>
                  <span>
                    {money(product.startingPriceMinor, product.currency)}
                  </span>
                  <span>{product.activeVariantCount} active</span>
                  <time dateTime={product.updatedAt}>
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                    }).format(new Date(product.updatedAt))}
                  </time>
                  <div className="row-actions">
                    <button
                      className="text-link"
                      type="button"
                      onClick={() => openEditWizard(product.id)}
                    >
                      Edit
                    </button>
                    {product.status === 'ACTIVE' ? (
                      <button
                        onClick={() => void action(product, 'unpublish')}
                        disabled={busy === product.id}
                      >
                        Unpublish
                      </button>
                    ) : (
                      product.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => void action(product, 'publish')}
                          disabled={busy === product.id}
                        >
                          Publish
                        </button>
                      )
                    )}
                    {product.status !== 'ARCHIVED' && (
                      <button
                        className="danger-link"
                        onClick={() => void action(product, 'archive')}
                        disabled={busy === product.id}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <nav className="pagination" aria-label="Product pages">
              <button
                disabled={data.page <= 1}
                onClick={() => update('page', String(data.page - 1))}
              >
                Previous
              </button>
              <span>
                Page {data.page} of{' '}
                {Math.max(1, Math.ceil(data.total / data.pageSize))}
              </span>
              <button
                disabled={data.page * data.pageSize >= data.total}
                onClick={() => update('page', String(data.page + 1))}
              >
                Next
              </button>
            </nav>
          </>
        )
      )}
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
    </>
  );
}
