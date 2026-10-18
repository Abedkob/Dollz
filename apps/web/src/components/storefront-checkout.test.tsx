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
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            settings: {
              deliveryEnabled: true,
              pickupEnabled: true,
              pickupLabel: 'Atelier pickup',
              pickupCity: 'Beirut',
              defaultCountry: 'LB',
              supportedCountryCodes: ['LB', 'AE'],
              instagramUrl: 'https://www.instagram.com/dollz.lb/',
            },
          }),
          { status: 200 },
        ),
    ),
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

function fillForm(overrides: { phone?: string } = {}) {
  fireEvent.change(screen.getByLabelText('Full name'), {
    target: { value: 'Lina Haddad' },
  });
  fireEvent.change(screen.getByLabelText('Email address'), {
    target: { value: 'lina@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Phone number'), {
    target: { value: overrides.phone ?? '+961 70 123 456' },
  });
  fireEvent.change(screen.getByLabelText('Address'), {
    target: { value: 'Hamra Street' },
  });
  fireEvent.change(screen.getByLabelText('City'), {
    target: { value: 'Beirut' },
  });
}

test('sends the whole request from one page, with the phone number, and directs the customer to Instagram', async () => {
  render(<StorefrontCheckout />);
  await screen.findByLabelText('Full name');
  expect(screen.getAllByText(/Cash on delivery/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/OMT/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  fillForm();
  const country = screen.getByLabelText('Country') as HTMLSelectElement;
  expect(country.tagName).toBe('SELECT');
  expect(
    Array.from(country.options).map((option) => option.textContent),
  ).toEqual(['Lebanon', 'United Arab Emirates']);
  fireEvent.change(country, { target: { value: 'AE' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
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
    delivery: { country: string };
  };
  expect(submission.customer).toMatchObject({
    phone: '+961 70 123 456',
    preferredContactMethod: 'INSTAGRAM',
  });
  expect(submission.delivery.country).toBe('AE');
});

test('requires a valid phone number before sending', async () => {
  render(<StorefrontCheckout />);
  await screen.findByLabelText('Full name');
  fillForm({ phone: 'abc' });
  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send to the atelier' }));
  expect((await screen.findByRole('alert')).textContent).toMatch(/phone/i);
  expect(mocks.request).not.toHaveBeenCalled();
});

test('pickup orders do not need a delivery address', async () => {
  render(<StorefrontCheckout />);
  await screen.findByLabelText('Full name');
  fillForm();
  fireEvent.click(screen.getByLabelText(/Atelier pickup/));
  expect(screen.queryByLabelText('Address')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send to the atelier' }));
  await screen.findByText('DZ-000123');
  const submission = JSON.parse(
    mocks.request.mock.calls[0]![1].body as string,
  ) as { delivery: { shippingMethod: string } };
  expect(submission.delivery.shippingMethod).toBe('PICKUP');
});
