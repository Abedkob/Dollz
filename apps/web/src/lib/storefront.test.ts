// @vitest-environment jsdom

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  CART_MAX_QUANTITY,
  addCartItem,
  cartChangedEvent,
  cartCount,
  cartSubtotalMinor,
  readCart,
  removeCartItem,
  updateCartItemQuantity,
  writeCart,
  type CartItem,
} from './storefront';

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    key: 'item-1',
    productId: 'product-1',
    productSlug: 'classic-doll',
    productName: 'Classic Doll',
    variantId: 'variant-1',
    variantName: '25 cm',
    quantity: 1,
    estimatedUnitPriceMinor: 1000,
    currency: 'USD',
    imageUrl: null,
    customerRequest: null,
    selections: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

test('updateCartItemQuantity clamps to [1, CART_MAX_QUANTITY] and truncates', () => {
  writeCart([item()]);
  updateCartItemQuantity('item-1', 999);
  expect(readCart()[0]!.quantity).toBe(CART_MAX_QUANTITY);

  updateCartItemQuantity('item-1', 0);
  expect(readCart()[0]!.quantity).toBe(1);

  updateCartItemQuantity('item-1', -5);
  expect(readCart()[0]!.quantity).toBe(1);

  updateCartItemQuantity('item-1', 3.9);
  expect(readCart()[0]!.quantity).toBe(3);
});

test('updateCartItemQuantity dispatches cartChangedEvent', () => {
  writeCart([item()]);
  const handler = vi.fn();
  window.addEventListener(cartChangedEvent, handler);
  updateCartItemQuantity('item-1', 2);
  window.removeEventListener(cartChangedEvent, handler);
  expect(handler).toHaveBeenCalledTimes(1);
});

test('removeCartItem removes only the matching item and dispatches cartChangedEvent', () => {
  writeCart([item({ key: 'a' }), item({ key: 'b' })]);
  const handler = vi.fn();
  window.addEventListener(cartChangedEvent, handler);
  removeCartItem('a');
  window.removeEventListener(cartChangedEvent, handler);
  expect(readCart().map((entry) => entry.key)).toEqual(['b']);
  expect(handler).toHaveBeenCalledTimes(1);
});

test('cartSubtotalMinor sums unit price times quantity across items', () => {
  const items = [
    item({ key: 'a', estimatedUnitPriceMinor: 1000, quantity: 2 }),
    item({ key: 'b', estimatedUnitPriceMinor: 500, quantity: 3 }),
  ];
  expect(cartSubtotalMinor(items)).toBe(1000 * 2 + 500 * 3);
});

test('addCartItem appends and cartCount sums quantities', () => {
  addCartItem(item({ key: 'a', quantity: 2 }));
  addCartItem(item({ key: 'b', quantity: 3 }));
  expect(cartCount()).toBe(5);
});
