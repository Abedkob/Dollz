'use client';

import React, {
  useCallback,
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
} from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  FileImage,
  FolderOpen,
  HardDrive,
  Images,
  Maximize2,
  Package,
  Palette,
  RefreshCw,
  Ruler,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import { catalogRequest, type MediaItem } from '../lib/catalog';
import { AdminModal } from './admin-modal';

const categories = [
  { value: '', label: 'All assets', shortLabel: 'All', icon: Images },
  {
    value: 'PRODUCT',
    label: 'Product photography',
    shortLabel: 'Products',
    icon: Package,
  },
  {
    value: 'VARIANT',
    label: 'Variant previews',
    shortLabel: 'Variants',
    icon: Ruler,
  },
  {
    value: 'OPTION',
    label: 'Customization options',
    shortLabel: 'Options',
    icon: Palette,
  },
] as const;

const categoryLabel: Record<MediaItem['category'], string> = {
  PRODUCT: 'Product photography',
  VARIANT: 'Variant preview',
  OPTION: 'Customization option',
};

const categoryIcon: Record<MediaItem['category'], LucideIcon> = {
  PRODUCT: Package,
  VARIANT: Ruler,
  OPTION: Palette,
};

export function MediaLibrary({ csrfToken }: { csrfToken: string }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
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
      if (debouncedSearch) query.set('search', debouncedSearch);
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
  }, [category, debouncedSearch]);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(search.trim()),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function chooseFile(file: File | null) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadError('');
  }

  function closeUpload() {
    if (busy) return;
    setUploadOpen(false);
    setUploadFile(null);
    setUploadError('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uploadFile) {
      setUploadError('Choose an image before uploading.');
      return;
    }
    const body = new FormData();
    body.append('category', uploadCategory);
    body.append('visibility', 'PUBLIC');
    body.append('image', uploadFile);
    setBusy(true);
    setUploadError('');
    try {
      await catalogRequest('media/images', { method: 'POST', body }, csrfToken);
      setUploadOpen(false);
      setUploadFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setNotice('Image processed and added to the atelier.');
      await load();
    } catch (reason) {
      setUploadError(
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
  const activeCategory = categories.find((item) => item.value === category);

  return (
    <div className="atelier-media-page">
      <header className="media-atelier-masthead">
        <div>
          <p className="eyebrow">Catalog assets</p>
          <h1>
            <Images aria-hidden="true" size={34} />
            Media library
          </h1>
          <p>
            Keep every product photo, size preview, and customization reference
            organized in one place.
          </p>
        </div>
        <div className="media-masthead-actions">
          <span className="media-library-count">
            <FolderOpen aria-hidden="true" size={17} />
            <span>
              <strong>{items.length}</strong>
              {items.length === 1 ? ' asset shown' : ' assets shown'}
            </span>
          </span>
          <button
            className="primary-button"
            onClick={() => setUploadOpen(true)}
          >
            <Upload aria-hidden="true" size={17} /> Add media
          </button>
        </div>
      </header>

      <section className="media-discovery" aria-label="Find media">
        <div className="media-search">
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            aria-label="Search images"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search the library by filename"
          />
          {search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
            >
              <X aria-hidden="true" size={16} />
            </button>
          ) : null}
        </div>
        <nav className="media-category-tabs" aria-label="Media categories">
          {categories.map((item) => (
            <button
              key={item.label}
              type="button"
              className={category === item.value ? 'active' : ''}
              aria-label={item.label}
              aria-pressed={category === item.value}
              onClick={() => setCategory(item.value)}
            >
              <item.icon aria-hidden="true" size={16} />
              <span className="media-category-label">{item.label}</span>
              <span className="media-category-short-label">
                {item.shortLabel}
              </span>
            </button>
          ))}
        </nav>
      </section>

      {notice ? (
        <div className="media-notice success-message" role="status">
          <CheckCircle2 aria-hidden="true" size={18} />
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ) : null}
      {error ? (
        <div className="media-notice inline-error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" size={15} />
            Try again
          </button>
        </div>
      ) : null}

      <div className="media-library-heading">
        <div>
          <p className="eyebrow">Asset shelf</p>
          <h2>{activeCategory?.label ?? 'All assets'}</h2>
          <p>Select an image to inspect its size, format, and public link.</p>
        </div>
        <span className="media-result-count" aria-live="polite">
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
          <span aria-hidden="true">
            <FileImage size={28} />
          </span>
          <p className="eyebrow">Nothing on this shelf</p>
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
              <RefreshCw aria-hidden="true" size={16} />
              Clear filters
            </button>
          ) : (
            <button
              className="primary-button"
              onClick={() => setUploadOpen(true)}
            >
              <Upload aria-hidden="true" size={16} />
              Add your first image
            </button>
          )}
        </div>
      ) : (
        <section className="media-contact-sheet" aria-label="Media assets">
          {items.map((item) => {
            const CategoryIcon = categoryIcon[item.category];
            return (
              <button
                className="media-contact-card"
                key={item.id}
                onClick={() => setSelected(item)}
                aria-label={`View ${item.originalName}`}
              >
                <span className="media-contact-image">
                  <img src={item.urls.thumbnail} alt="" loading="lazy" />
                  <span className="media-card-category">
                    <CategoryIcon aria-hidden="true" size={14} />
                    {categoryLabel[item.category]}
                  </span>
                  <span className="media-card-open">
                    <Maximize2 aria-hidden="true" size={15} /> Open asset
                  </span>
                </span>
                <span className="media-contact-caption">
                  <strong title={item.originalName}>{item.originalName}</strong>
                  <span className="media-card-metadata">
                    <small>
                      <Maximize2 aria-hidden="true" size={13} /> {item.width} ×{' '}
                      {item.height}
                    </small>
                    <small>
                      <HardDrive aria-hidden="true" size={13} />{' '}
                      {formatBytes(item.sizeBytes)}
                    </small>
                  </span>
                </span>
              </button>
            );
          })}
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
            {uploadError ? (
              <div className="media-modal-error" role="alert">
                <AlertTriangle aria-hidden="true" size={17} />
                <span>{uploadError}</span>
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
                  <Upload size={22} />
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
                    <span className="media-picker-title">
                      <item.icon aria-hidden="true" size={17} />
                      <strong>{item.label}</strong>
                    </span>
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
                {busy ? (
                  <RefreshCw
                    className="media-spin"
                    aria-hidden="true"
                    size={16}
                  />
                ) : (
                  <Sparkles aria-hidden="true" size={16} />
                )}
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
              <div className="media-detail-heading">
                <span>
                  {React.createElement(categoryIcon[selected.category], {
                    'aria-hidden': true,
                    size: 17,
                  })}
                </span>
                <div>
                  <strong>{categoryLabel[selected.category]}</strong>
                  <small>Public catalog asset</small>
                </div>
              </div>
              <dl>
                <div>
                  <dt>
                    <Maximize2 aria-hidden="true" size={14} /> Dimensions
                  </dt>
                  <dd>
                    {selected.width} × {selected.height}
                  </dd>
                </div>
                <div>
                  <dt>
                    <HardDrive aria-hidden="true" size={14} /> File size
                  </dt>
                  <dd>{formatBytes(selected.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>
                    <FileImage aria-hidden="true" size={14} /> Format
                  </dt>
                  <dd>
                    {selected.mimeType.replace('image/', '').toUpperCase()}
                  </dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays aria-hidden="true" size={14} /> Added
                  </dt>
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
                  <Clipboard aria-hidden="true" size={16} />
                  Copy optimized link
                </button>
                <button
                  className="danger-link"
                  disabled={busy}
                  onClick={() => beginRemoval(selected)}
                >
                  <Trash2 aria-hidden="true" size={16} />
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
            <span className="media-remove-preview">
              <img src={pendingRemoval.urls.thumbnail} alt="" />
            </span>
            <div>
              <span className="media-remove-warning" aria-hidden="true">
                <AlertTriangle size={17} />
              </span>
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
              <Trash2 aria-hidden="true" size={16} />
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
