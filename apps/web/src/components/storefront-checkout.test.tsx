// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { StorefrontCheckout } from './storefront-checkout';
import { readCart, type CartItem } from '../lib/storefront';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../lib/orders', () => ({ guestOrderRequest: mocks.request }));
vi.mock('./turnstile-widget', () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('verified')}>
      Verify
    </button>
  ),
}));

const cartKey = 'dollz:cart:v1';
const item: CartItem = {
  key: 'item-1',
  productId: 'product-1',
  productSlug: 'classic-doll',
  productName: 'Classic Doll',
  variantId: 'variant-1',
  variantName: '25 cm',
  quantity: 1,
  estimatedUnitPriceMinor: 4500,
  currency: 'USD',
  imageUrl: null,
  customerRequest: null,
  selections: [
    {
      optionId: 'opt-1',
      optionName: 'Eye color',
      optionValueId: 'val-1',
      valueLabel: 'Warm brown',
      customValue: null,
      customColor: null,
    },
  ],
};

beforeEach(() => {
  localStorage.setItem(cartKey, JSON.stringify([item]));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 404 })),
  );
  mocks.request.mockReset();
  mocks.request.mockResolvedValue({
    orderNumber: 'DZ-000123',
    trackingPath: '/orders/DZ-000123#token=abc',
  });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('after sending, directs the customer to Instagram with the order number visible and clears the cart', async () => {
  render(<StorefrontCheckout />);
  fireEvent.change(await screen.findByLabelText('Full name'), {
    target: { value: 'Lina Haddad' },
  });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'lina@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(await screen.findByLabelText('Address'), {
    target: { value: 'Hamra Street' },
  });
  fireEvent.change(screen.getByLabelText('City'), {
    target: { value: 'Beirut' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Verify' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send to the atelier' }));

  const link = await screen.findByRole('link', {
    name: 'Message @dollz.lb on Instagram',
  });
  const href = link.getAttribute('href') ?? '';
  expect(href).toBe('https://www.instagram.com/dollz.lb/');
  expect(screen.getByText('DZ-000123')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'View my order' })).toBeTruthy();
  expect(readCart()).toEqual([]);
  const submission = JSON.parse(
    mocks.request.mock.calls[0]![1].body as string,
  ) as {
    customer: { phone: string | null; preferredContactMethod: string };
  };
  expect(submission.customer).toMatchObject({
    phone: null,
    preferredContactMethod: 'INSTAGRAM',
  });
});
