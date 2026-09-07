// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { ProductConfigurator } from './product-configurator';
import type * as StorefrontModule from '../lib/storefront';
import type { StorefrontProductDetails } from '../lib/storefront';

const storefrontRequest = vi.hoisted(() => vi.fn());
const addCartItem = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock('../lib/storefront', async () => {
  const actual =
    await vi.importActual<typeof StorefrontModule>('../lib/storefront');
  return {
    ...actual,
    storefrontRequest,
    addCartItem,
  };
});
vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'build-your-own' }),
  useRouter: () => ({ push }),
}));

const details: StorefrontProductDetails = {
  product: {
    id: 'product-1',
    name: 'Build Your Own Doll',
    slug: 'build-your-own',
    shortDescription: 'A doll made entirely your way.',
    description: null,
    startingPriceMinor: 6900,
    currency: 'USD',
    productionMinDays: 7,
    productionMaxDays: 14,
    isFeatured: true,
    primaryThumbnailUrl: null,
    seoTitle: null,
    seoDescription: null,
  },
  media: [],
  variants: [
    {
      id: 'variant-25',
      name: 'Classic 25 cm',
      sizeLabel: '25 cm',
      sizeCm: 25,
      priceMinor: 6900,
      currency: 'USD',
      isDefault: true,
    },
  ],
  options: [
    {
      id: 'option-eyes',
      code: 'eye-color',
      name: 'Eye color',
      description: null,
      inputType: 'COLOR',
      isRequired: true,
      allowCustomValue: true,
      values: [
        {
          id: 'value-brown',
          code: 'warm-brown',
          label: 'Warm brown',
          description: null,
          colorHex: '#6F4A3A',
          referenceUrl: null,
          priceAdjustmentMinor: 0,
          isDefault: true,
        },
      ],
    },
    {
      id: 'option-note',
      code: 'missing-option',
      name: 'Missing option suggestion',
      description: null,
      inputType: 'IMAGE_CARD',
      isRequired: false,
      allowCustomValue: true,
      values: [
        {
          id: 'value-star',
          code: 'star',
          label: 'Star clip',
          description: null,
          colorHex: null,
          referenceUrl: 'https://example.com/star.png',
          priceAdjustmentMinor: 0,
          isDefault: false,
        },
      ],
    },
  ],
  conflicts: [],
};

afterEach(() => {
  cleanup();
  storefrontRequest.mockReset();
  addCartItem.mockReset();
  push.mockReset();
});

test('picking a custom color satisfies a required COLOR option and is included in the cart selection', async () => {
  storefrontRequest.mockResolvedValue(details);
  render(<ProductConfigurator />);

  const colorInput = (await screen.findByLabelText(
    'Choose any eye color',
  )) as HTMLInputElement;
  fireEvent.change(colorInput, { target: { value: '#1a2b3c' } });

  fireEvent.click(screen.getByRole('button', { name: 'Review my request' }));

  expect(addCartItem).toHaveBeenCalledTimes(1);
  const submitted = addCartItem.mock.calls[0]![0];
  const eyeSelection = submitted.selections.find(
    (selection: { optionId: string }) => selection.optionId === 'option-eyes',
  );
  expect(eyeSelection).toMatchObject({
    optionValueId: null,
    customColor: '#1a2b3c',
    valueLabel: '#1a2b3c',
  });
  expect(push).toHaveBeenCalledWith('/cart');
});

test('non-color options still show the plain text custom-value fallback', async () => {
  storefrontRequest.mockResolvedValue(details);
  render(<ProductConfigurator />);

  await screen.findByText('Missing option suggestion');
  expect(screen.getByText('Or describe another choice')).toBeTruthy();
  expect(
    screen.queryByLabelText('Choose any missing option suggestion'),
  ).toBeNull();
});
