'use client';

import React, {
  useCallback,
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react';
import { catalogRequest, type MediaItem } from '../lib/catalog';
import { AdminModal } from './admin-modal';

const categories = [
  { value: '', label: 'All assets' },
  { value: 'PRODUCT', label: 'Product photography' },
  { value: 'VARIANT', label: 'Variant previews' },
  { value: 'OPTION', label: 'Customization options' },
] as const;

const categoryLabel: Record<MediaItem['category'], string> = {
  PRODUCT: 'Product photography',
  VARIANT: 'Variant preview',
  OPTION: 'Customization option',
};

export function MediaLibrary({ csrfToken }: { csrfToken: string }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCategory, setUploadCategory] =
    useState<MediaItem['category']>('PRODUCT');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<MediaItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ pageSize: '100' });
      if (category) query.set('category', category);
      if (search) query.set('search', search);
      const result = await catalogRequest<{ items: MediaItem[] }>(
        `media?${query}`,
      );
      setItems(result.items);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Media could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => void load(), [load]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function chooseFile(file: File | null) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError('');
  }

  function closeUpload() {
    if (busy) return;
    setUploadOpen(false);
    setUploadFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setError('Choose an image before uploading.');
      return;
    }
    const body = new FormData();
    body.append('category', uploadCategory);
    body.append('visibility', 'PUBLIC');
    body.append('image', uploadFile);
    setBusy(true);
    setError('');
    try {
      await catalogRequest('media/images', { method: 'POST', body }, csrfToken);
      setUploadOpen(false);
      setUploadFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setNotice('Image processed and added to the atelier.');
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Image upload failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: MediaItem) {
    setBusy(true);
    setError('');
    try {
      await catalogRequest(`media/${item.id}`, { method: 'DELETE' }, csrfToken);
      setPendingRemoval(null);
      setNotice('Image removed from the active library.');
      await load();
    } catch (reason) {
      const value = reason as Error & { details?: Array<{ message: string }> };
      setError(
        value.details?.map((detail) => detail.message).join(' ') ||
          value.message,
      );
      setPendingRemoval(null);
    } finally {
      setBusy(false);
    }
  }

  async function copy(item: MediaItem) {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${item.urls.optimized}`,
      );
      setNotice('Optimized image link copied.');
    } catch {
      setError(
        'The image link could not be copied. Try again or copy it from the details panel.',
      );
    }
  }

  function beginRemoval(item: MediaItem) {
    setSelected(null);
    setPendingRemoval(item);
  }

  const filtered = Boolean(search || category);

  return (
    <div className="atelier-media-page">
      <header className="media-atelier-masthead">
        <div>
          <p className="eyebrow">Asset atelier</p>
          <h1>Media library</h1>
          <p>
            Find the right image for every product, variation, and custom
            detail.
          </p>
        </div>
        <div className="media-masthead-actions">
          <span>
            <strong>{items.length}</strong>
            {items.length === 1 ? ' asset loaded' : ' assets loaded'}
          </span>
          <button
            className="primary-button"
            onClick={() => setUploadOpen(true)}
          >
            <span aria-hidden="true">＋</span> Add media
          </button>
        </div>
      </header>

      <section className="media-discovery" aria-label="Find media">
        <label className="media-search">
          <span aria-hidden="true">⌕</span>
          <span className="visually-hidden">Search images</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by filename"
          />
        </label>
        <nav className="media-category-tabs" aria-label="Media categories">
          {categories.map((item) => (
            <button
              key={item.label}
              className={category === item.value ? 'active' : ''}
              aria-pressed={category === item.value}
              onClick={() => setCategory(item.value)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      {notice ? (
        <div className="media-notice success-message" role="status">
          <span aria-hidden="true">✓</span>
          {notice}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            ×
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="media-notice inline-error" role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="media-library-heading">
        <div>
          <p className="eyebrow">Contact sheet</p>
          <h2>
            {category
              ? categories.find((item) => item.value === category)?.label
              : 'All imagery'}
          </h2>
        </div>
        <span>
          {loading
            ? 'Loading…'
            : `${items.length} ${items.length === 1 ? 'result' : 'results'}`}
        </span>
      </div>

      {loading ? (
        <div className="media-contact-sheet media-skeleton" aria-live="polite">
          <span className="visually-hidden">Loading media…</span>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <i key={item} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="media-empty-state">
          <span aria-hidden="true">◇</span>
          <p className="eyebrow">Nothing on the contact sheet</p>
          <h2>
            {filtered
              ? 'No images match this view'
              : 'Your media atelier is empty'}
          </h2>
          <p>
            {filtered
              ? 'Try a different filename or return to all assets.'
              : 'Add the first image to begin building the Dollz visual library.'}
          </p>
          {filtered ? (
            <button
              className="secondary-button"
              onClick={() => {
                setSearch('');
                setCategory('');
              }}
            >
              Clear filters
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={() => setUploadOpen(true)}
            >
              Add your first image
            </button>
          )}
        </div>
      ) : (
        <section className="media-contact-sheet" aria-label="Media assets">
          {items.map((item, index) => (
            <button
              className="media-contact-card"
              key={item.id}
              onClick={() => setSelected(item)}
              aria-label={`View ${item.originalName}`}
            >
              <span className="media-frame-number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="media-contact-image">
                <img src={item.urls.thumbnail} alt="" loading="lazy" />
                <span>View details</span>
              </span>
              <span className="media-contact-caption">
                <span>
                  <strong title={item.originalName}>{item.originalName}</strong>
                  <small>
                    {item.width} × {item.height} · {formatBytes(item.sizeBytes)}
                  </small>
                </span>
                <em>{categoryLabel[item.category]}</em>
              </span>
            </button>
          ))}
        </section>
      )}

      {uploadOpen ? (
        <AdminModal
          eyebrow="New atelier asset"
          title="Add media"
          intro="Upload one high-quality source image. Dollz will prepare optimized versions automatically."
          onClose={closeUpload}
          wide
        >
          <form className="media-upload-form" onSubmit={upload}>
            {error ? (
              <div className="media-modal-error" role="alert">
                {error}
              </div>
            ) : null}
            <label
              className={`media-dropzone${previewUrl ? ' has-preview' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event: DragEvent<HTMLLabelElement>) => {
                event.preventDefault();
                chooseFile(event.dataTransfer.files[0] ?? null);
              }}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Preview of the selected upload" />
              ) : (
                <span className="media-drop-icon" aria-hidden="true">
                  ＋
                </span>
              )}
              <strong>
                {uploadFile ? uploadFile.name : 'Drop an image here'}
              </strong>
              <span>
                {uploadFile
                  ? formatBytes(uploadFile.size)
                  : 'or choose a JPEG, PNG, or WebP file'}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  chooseFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <fieldset className="media-category-picker">
              <legend>Where will this image be used?</legend>
              {categories.slice(1).map((item) => (
                <label key={item.value}>
                  <input
                    type="radio"
                    name="category"
                    value={item.value}
                    checked={uploadCategory === item.value}
                    onChange={() =>
                      setUploadCategory(item.value as MediaItem['category'])
                    }
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{categoryHelp(item.value)}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="order-modal-actions media-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeUpload}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={busy || !uploadFile}>
                {busy ? 'Processing…' : 'Process & add image'}
              </button>
            </div>
          </form>
        </AdminModal>
      ) : null}

      {selected ? (
        <AdminModal
          eyebrow={categoryLabel[selected.category]}
          title={selected.originalName}
          intro="Optimized and ready to use across the Dollz catalog."
          onClose={() => setSelected(null)}
          wide
        >
          <div className="media-detail-layout">
            <div className="media-detail-preview">
              <img
                src={selected.urls.optimized}
                alt=""
                onError={(event) => {
                  if (!event.currentTarget.dataset.fallback) {
                    event.currentTarget.dataset.fallback = 'true';
                    event.currentTarget.src = selected.urls.thumbnail;
                  }
                }}
              />
            </div>
            <div className="media-detail-info">
              <dl>
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {selected.width} × {selected.height}
                  </dd>
                </div>
                <div>
                  <dt>File size</dt>
                  <dd>{formatBytes(selected.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>
                    {selected.mimeType.replace('image/', '').toUpperCase()}
                  </dd>
                </div>
                <div>
                  <dt>Added</dt>
                  <dd>
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                    }).format(new Date(selected.createdAt))}
                  </dd>
                </div>
              </dl>
              <div className="media-detail-actions">
                <button
                  className="primary-button"
                  onClick={() => void copy(selected)}
                >
                  Copy optimized link
                </button>
                <button
                  className="danger-link"
                  disabled={busy}
                  onClick={() => beginRemoval(selected)}
                >
                  Remove from library
                </button>
              </div>
            </div>
          </div>
        </AdminModal>
      ) : null}

      {pendingRemoval ? (
        <AdminModal
          eyebrow="Library safety"
          title="Remove this image?"
          intro="Images already used by a product or customization cannot be removed."
          onClose={() => !busy && setPendingRemoval(null)}
        >
          <div className="media-remove-confirmation">
            <img src={pendingRemoval.urls.thumbnail} alt="" />
            <div>
              <strong>{pendingRemoval.originalName}</strong>
              <p>
                This removes the image from the active library. Existing
                references remain protected by the server.
              </p>
            </div>
          </div>
          <div className="order-modal-actions media-modal-actions">
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setPendingRemoval(null)}
            >
              Keep image
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void remove(pendingRemoval)}
            >
              {busy ? 'Removing…' : 'Remove image'}
            </button>
          </div>
        </AdminModal>
      ) : null}
    </div>
  );
}

function categoryHelp(value: string) {
  if (value === 'PRODUCT') return 'Gallery and primary product imagery';
  if (value === 'VARIANT') return 'Size, style, or physical variation previews';
  return 'Colors, materials, outfits, and other choices';
}

function formatBytes(value: number) {
  return value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 / 1024).toFixed(1)} MB`;
}
