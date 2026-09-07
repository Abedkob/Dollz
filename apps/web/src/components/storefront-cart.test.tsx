// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, expect, test } from 'vitest';
import { StorefrontCart } from './storefront-cart';
import { readCart, type CartItem } from '../lib/storefront';

const cartKey = 'dollz:cart:v1';

function seedCart(items: CartItem[]) {
  localStorage.setItem(cartKey, JSON.stringify(items));
}

const item: CartItem = {
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
  selections: [
    { optionId: 'opt-1', optionName: 'Eye color', optionValueId: 'val-1', valueLabel: 'Warm brown', customValue: null, customColor: null },
  ],
};

afterEach(() => {
  cleanup();
  localStorage.clear();
});

test('shows the empty state with a link to the collection when the cart is empty', async () => {
  render(<StorefrontCart />);
  expect(await screen.findByText('There is room for a story here.')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Meet the dolls' })).toHaveProperty(
    'pathname',
    '/products',
  );
});

test('renders each cart line with its details and total', async () => {
  seedCart([item]);
  render(<StorefrontCart />);
  expect(await screen.findByText('Classic Doll')).toBeTruthy();
  expect(screen.getByText('25 cm')).toBeTruthy();
  expect(screen.getByText('Warm brown')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Proceed to checkout' })).toHaveProperty(
    'pathname',
    '/checkout',
  );
});

test('increases and decreases quantity, updating the subtotal and localStorage', async () => {
  seedCart([item]);
  render(<StorefrontCart />);
  await screen.findByText('Classic Doll');

  fireEvent.click(
    screen.getByRole('button', { name: 'Increase quantity for Classic Doll' }),
  );
  expect(readCart()[0]!.quantity).toBe(2);
  expect((await screen.findAllByText('$20')).length).toBe(2);

  fireEvent.click(
    screen.getByRole('button', { name: 'Decrease quantity for Classic Doll' }),
  );
  expect(readCart()[0]!.quantity).toBe(1);
});

test('decrease is disabled at quantity 1 and increase is disabled at the cap', async () => {
  seedCart([item]);
  render(<StorefrontCart />);
  await screen.findByText('Classic Doll');
  expect(
    (
      screen.getByRole('button', {
        name: 'Decrease quantity for Classic Doll',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);

  for (let i = 0; i < 9; i++)
    fireEvent.click(
      screen.getByRole('button', { name: 'Increase quantity for Classic Doll' }),
    );
  expect(readCart()[0]!.quantity).toBe(10);
  expect(
    (
      screen.getByRole('button', {
        name: 'Increase quantity for Classic Doll',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test('typing a value into the quantity field clamps it on blur', async () => {
  seedCart([item]);
  render(<StorefrontCart />);
  await screen.findByText('Classic Doll');
  const input = screen.getByRole('spinbutton', {
    name: 'Quantity for Classic Doll',
  });
  fireEvent.change(input, { target: { value: '999' } });
  fireEvent.blur(input);
  expect(readCart()[0]!.quantity).toBe(10);
});

test('removing the only item shows the empty state', async () => {
  seedCart([item]);
  render(<StorefrontCart />);
  await screen.findByText('Classic Doll');
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(
    await screen.findByText('There is room for a story here.'),
  ).toBeTruthy();
  expect(readCart()).toEqual([]);
});
