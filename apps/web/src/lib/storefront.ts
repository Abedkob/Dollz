export interface StorefrontProductSummary {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  startingPriceMinor: number;
  currency: string;
  productionMinDays: number;
  productionMaxDays: number;
  isFeatured: boolean;
  primaryThumbnailUrl: string | null;
}

export interface StorefrontVariant {
  id: string;
  name: string;
  sizeLabel: string | null;
  sizeCm: number | null;
  priceMinor: number;
  currency: string;
  isDefault: boolean;
}

export interface StorefrontOptionValue {
  id: string;
  code: string;
  label: string;
  description: string | null;
  colorHex: string | null;
  referenceUrl: string | null;
  priceAdjustmentMinor: number;
  isDefault: boolean;
}

export interface StorefrontOption {
  id: string;
  code: string;
  name: string;
  description: string | null;
  inputType: 'COLOR' | 'IMAGE_CARD' | 'TEXT' | 'TEXTAREA' | 'SELECT';
  isRequired: boolean;
  allowCustomValue: boolean;
  values: StorefrontOptionValue[];
}

export interface StorefrontProductDetails {
  product: StorefrontProductSummary & {
    description: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  };
  media: Array<{
    id: string;
    altText: string | null;
    caption: string | null;
    isPrimary: boolean;
    urls: { optimized: string; thumbnail: string };
  }>;
  variants: StorefrontVariant[];
  options: StorefrontOption[];
  conflicts: Array<{
    firstValueId: string;
    secondValueId: string;
    reason: string | null;
  }>;
}

export interface CartSelection {
  optionId: string;
  optionName: string;
  optionValueId: string | null;
  valueLabel: string;
  customValue: string | null;
  customColor: string | null;
}

export interface CartItem {
  key: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string;
  variantName: string;
  quantity: number;
  estimatedUnitPriceMinor: number;
  currency: string;
  imageUrl: string | null;
  customerRequest: string | null;
  selections: CartSelection[];
}

const cartKey = 'dollz:cart:v1';
export const cartChangedEvent = 'dollz:cart-changed';

export function money(minor: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

export async function storefrontRequest<T>(path: string): Promise<T> {
  const response = await fetch(`/catalog/api/${path.replace(/^\//, '')}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      payload?.error?.message ?? 'The atelier catalog could not be loaded.',
    );
  }
  return (await response.json()) as T;
}

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(localStorage.getItem(cartKey) ?? '[]') as unknown;
    return Array.isArray(value) ? (value as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  localStorage.setItem(cartKey, JSON.stringify(items));
  window.dispatchEvent(new Event(cartChangedEvent));
}

export function addCartItem(item: CartItem) {
  writeCart([...readCart(), item]);
}

export function cartCount() {
  return readCart().reduce((count, item) => count + item.quantity, 0);
}
