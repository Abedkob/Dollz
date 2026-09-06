export type OrderStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'IN_PRODUCTION'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED';

export interface OrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  dollCount: number;
  status: OrderStatus;
  pricingStatus: 'ESTIMATE' | 'FINAL';
  paymentStatus: string;
  totalMinor: number;
  currency: string;
  submittedAt: string;
  estimatedCompletionDate: string | null;
  version: number;
  requiresAction: boolean;
}

export interface OrderDetail {
  order: {
    id?: string;
    orderNumber: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string | null;
    preferredContactMethod: string;
    delivery: {
      addressLine1?: string;
      addressLine2?: string | null;
      city: string;
      region: string | null;
      postalCode?: string | null;
      countryCode: string;
      shippingMethod: string;
    };
    customerNotes?: string | null;
    status: OrderStatus;
    pricingStatus: 'ESTIMATE' | 'FINAL';
    estimatedSubtotalMinor: number;
    finalSubtotalMinor: number | null;
    deliveryFeeMinor: number;
    finalTotalMinor: number | null;
    currency: string;
    submittedAt: string;
    estimatedCompletionDate: string | null;
    paymentDueAt: string | null;
    trackingReference: string | null;
    trackingUrl: string | null;
    version?: number;
  };
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    variantSku: string;
    variantSize: string | null;
    quantity: number;
    estimatedUnitPriceMinor: number;
    estimatedTotalMinor: number;
    finalUnitPriceMinor: number | null;
    finalTotalMinor: number | null;
    currency: string;
    customerRequest: string | null;
    notes?: string | null;
    selections: Array<{
      optionCode: string;
      optionName: string;
      valueLabel: string;
      colorHex: string | null;
      priceAdjustmentMinor: number;
      affects3d: boolean;
      threeDProperty: string | null;
      customValue: string | null;
    }>;
  }>;
  messages: Array<{
    id: string;
    senderType: string;
    message: string;
    isInternal?: boolean;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    message: string | null;
    internalNotes?: string | null;
    createdAt: string;
  }>;
  revisions: Array<Record<string, unknown>>;
  payments: Array<{
    id: string;
    method: string;
    status: string;
    amountMinor: number;
    currency: string;
    instructions?: string;
    dueAt: string | null;
  }>;
}

async function request<T>(url: string, options: RequestInit = {}) {
  const response = await fetch(url, { ...options, credentials: 'include' });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    const error = new Error(
      body?.error?.message ?? 'The request could not be completed.',
    ) as Error & { code?: string };
    error.code = body?.error?.code;
    throw error;
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export function adminOrderRequest<T>(
  path: string,
  options: RequestInit = {},
  csrfToken?: string,
) {
  const headers = new Headers(options.headers);
  if (csrfToken) headers.set('x-csrf-token', csrfToken);
  if (options.body) headers.set('content-type', 'application/json');
  return request<T>(`/admin/api/orders/${path.replace(/^\//, '')}`, {
    ...options,
    headers,
  });
}

export function guestOrderRequest<T>(
  path: string,
  options: RequestInit = {},
  csrfToken?: string,
) {
  const headers = new Headers(options.headers);
  if (csrfToken) headers.set('x-csrf-token', csrfToken);
  if (options.body) headers.set('content-type', 'application/json');
  return request<T>(`/orders/api/${path.replace(/^\//, '')}`, {
    ...options,
    headers,
  });
}

export function displayStatus(status: string) {
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (c) => c.toUpperCase());
}

export function money(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(minor / 100);
}
