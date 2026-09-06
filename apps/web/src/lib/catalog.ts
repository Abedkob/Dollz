export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  status: 'DRAFT' | 'ACTIVE' | 'UNAVAILABLE' | 'ARCHIVED';
  startingPriceMinor: number;
  currency: string;
  isFeatured: boolean;
  activeVariantCount: number;
  primaryThumbnailUrl: string | null;
  updatedAt: string;
  version: number;
}
export interface Product extends ProductSummary {
  shortDescription: string | null;
  description: string | null;
  productionMinDays: number;
  productionMaxDays: number;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  archivedAt: string | null;
}
export interface MediaItem {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  category: 'PRODUCT' | 'VARIANT' | 'OPTION';
  visibility: 'PUBLIC' | 'PRIVATE';
  width: number;
  height: number;
  deletedAt: string | null;
  createdAt: string;
  urls: { optimized: string; thumbnail: string };
}
export interface ProductMedia {
  id: string;
  fileId: string;
  altText: string | null;
  caption: string | null;
  isPrimary: boolean;
  sortOrder: number;
  version: number;
  originalName: string;
  width: number;
  height: number;
  urls: { optimized: string; thumbnail: string };
}
export interface Variant {
  id: string;
  sku: string;
  name: string;
  sizeLabel: string | null;
  sizeCm: number | null;
  priceMinor: number;
  currency: string;
  modelKey: string | null;
  previewFileId: string | null;
  previewUrl: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  version: number;
}
export interface OptionValue {
  id: string;
  code: string;
  label: string;
  colorHex: string | null;
  referenceFileId: string | null;
  referenceUrl: string | null;
  priceAdjustmentMinor: number;
  metadata: Record<string, string>;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  version: number;
}
export interface ProductOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  inputType: 'COLOR' | 'IMAGE_CARD' | 'TEXT' | 'TEXTAREA' | 'SELECT';
  isRequired: boolean;
  isActive: boolean;
  affects3d: boolean;
  threeDProperty: string | null;
  allowCustomValue: boolean;
  sortOrder: number;
  version: number;
  values: OptionValue[];
}
export interface Conflict {
  id: string;
  reason: string | null;
  firstValueId: string;
  secondValueId: string;
  firstLabel: string;
  firstOption: string;
  secondLabel: string;
  secondOption: string;
}
export interface ProductDetails {
  product: Product;
  media: ProductMedia[];
  variants: Variant[];
  options: ProductOption[];
  conflicts: Conflict[];
}

export async function catalogRequest<T>(
  path: string,
  options: RequestInit = {},
  csrfToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (csrfToken) headers.set('x-csrf-token', csrfToken);
  if (options.body && !(options.body instanceof FormData))
    headers.set('content-type', 'application/json');
  const response = await fetch(`/admin/api/${path.replace(/^\//, '')}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (response.status === 401) {
    window.location.assign(
      `/admin/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
    );
    throw new Error('Authentication expired.');
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: {
        message?: string;
        details?: Array<{ field: string; message: string }>;
      };
    } | null;
    const error = new Error(
      payload?.error?.message ?? 'The request could not be completed.',
    ) as Error & { details?: Array<{ field: string; message: string }> };
    error.details = payload?.error?.details;
    throw error;
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function money(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 100);
}
