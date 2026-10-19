export type SavedOrder = {
  orderNumber: string;
  trackingPath: string;
  savedAt: string;
};

const savedOrdersKey = 'dollz:orders:v1';
const MAX_SAVED_ORDERS = 20;

export function readSavedOrders(): SavedOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(
      localStorage.getItem(savedOrdersKey) ?? '[]',
    ) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter(
      (entry): entry is SavedOrder =>
        typeof entry?.orderNumber === 'string' &&
        typeof entry?.trackingPath === 'string' &&
        entry.trackingPath.startsWith('/orders/'),
    );
  } catch {
    return [];
  }
}

export function saveOrder(order: Omit<SavedOrder, 'savedAt'>) {
  try {
    const others = readSavedOrders().filter(
      (entry) => entry.orderNumber !== order.orderNumber,
    );
    const next = [
      { ...order, savedAt: new Date().toISOString() },
      ...others,
    ].slice(0, MAX_SAVED_ORDERS);
    localStorage.setItem(savedOrdersKey, JSON.stringify(next));
  } catch {
    // Storage can be blocked (private mode); the link is still shown on screen.
  }
}

export function forgetSavedOrder(orderNumber: string) {
  try {
    localStorage.setItem(
      savedOrdersKey,
      JSON.stringify(
        readSavedOrders().filter((entry) => entry.orderNumber !== orderNumber),
      ),
    );
  } catch {
    // ignore
  }
}

export function savedTokenFor(orderNumber: string): string | null {
  const saved = readSavedOrders().find(
    (entry) => entry.orderNumber === orderNumber,
  );
  const hash = saved?.trackingPath.split('#')[1];
  return hash ? new URLSearchParams(hash).get('token') : null;
}
