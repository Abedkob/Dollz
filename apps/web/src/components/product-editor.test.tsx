// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ProductDetails } from '../lib/catalog';
import { ProductEditor } from './product-editor';

const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/catalog', () => ({
  catalogRequest: request,
  money: (amount: number, currency: string) => `${currency} ${amount}`,
}));

const details: ProductDetails = {
  product: {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Classic Doll',
    slug: 'classic-doll',
    status: 'DRAFT',
    shortDescription: 'Handmade',
    description: 'A handmade doll.',
    startingPriceMinor: 7900,
    currency: 'USD',
    productionMinDays: 5,
    productionMaxDays: 10,
    isFeatured: false,
    activeVariantCount: 0,
    primaryThumbnailUrl: null,
    seoTitle: null,
    seoDescription: null,
    publishedAt: null,
    archivedAt: null,
    updatedAt: '2026-09-05T00:00:00.000Z',
    version: 1,
  },
  media: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      fileId: '00000000-0000-4000-8000-000000000003',
      originalName: 'classic.webp',
      altText: 'Classic doll',
      caption: null,
      isPrimary: false,
      sortOrder: 0,
      version: 1,
      width: 800,
      height: 1200,
      urls: { optimized: '/image', thumbnail: '/thumb' },
    },
  ],
  variants: [],
  options: [],
  conflicts: [],
};

afterEach(() => {
  cleanup();
  request.mockReset();
});

describe('product editor validation', () => {
  test('keeps dependent sections disabled until the base product exists', () => {
    render(<ProductEditor csrfToken="csrf" initial={null} />);
    expect(
      (screen.getByRole('button', { name: 'Media' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Variants' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText('Product name') as HTMLInputElement).required,
    ).toBe(true);
  });

  test('shows structured server validation and sends CSRF without credentials in the payload', async () => {
    const failure = Object.assign(new Error('Check the product fields.'), {
      details: [
        {
          field: 'productionMaxDays',
          message: 'Maximum production days must not be less than the minimum.',
        },
      ],
    });
    request.mockRejectedValue(failure);
    render(<ProductEditor csrfToken="csrf-value" initial={null} />);
    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Classic Doll' },
    });
    fireEvent.change(screen.getByLabelText(/^Slug/), {
      target: { value: 'Classic Doll' },
    });
    fireEvent.change(screen.getByLabelText('Minimum production days'), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByLabelText('Maximum production days'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Maximum production days must not be less than the minimum.',
    );
    expect(request).toHaveBeenCalledWith(
      'products',
      expect.objectContaining({ method: 'POST' }),
      'csrf-value',
    );
    const body = JSON.parse(request.mock.calls[0]![1].body as string);
    expect(body).not.toHaveProperty('csrfToken');
    expect(body.slug).toBe('Classic Doll');
  });

  test('reports local upload failure and sends primary-image selection with CSRF', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.startsWith('media?')) return { items: [] };
      return details;
    });
    render(<ProductEditor csrfToken="csrf-value" initial={details} />);
    fireEvent.click(screen.getByRole('button', { name: 'Media' }));
    fireEvent.submit(
      screen.getByRole('button', { name: 'Upload image' }).closest('form')!,
    );
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Choose an image first.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Set primary' }));
    await vi.waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `products/${details.product.id}/media/${details.media[0]!.id}/set-primary`,
        { method: 'POST', body: undefined },
        'csrf-value',
      ),
    );
  });

  test('adds a physical size with an automatic label, SKU, and integer money', async () => {
    request.mockImplementation(async (path: string) =>
      path.startsWith('media?') ? { items: [] } : details,
    );
    render(<ProductEditor csrfToken="csrf-value" initial={details} />);
    fireEvent.click(screen.getByRole('button', { name: 'Variants' }));
    fireEvent.change(screen.getByLabelText(/^Size in centimeters/), {
      target: { value: '30' },
    });
    fireEvent.change(screen.getByLabelText(/^Price \(USD\)/), {
      target: { value: '89.50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add size' }));
    await vi.waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `products/${details.product.id}/variants`,
        expect.objectContaining({ method: 'POST' }),
        'csrf-value',
      ),
    );
    const mutation = request.mock.calls.find(([path]) =>
      String(path).endsWith('/variants'),
    )!;
    expect(JSON.parse(mutation[1].body as string)).toMatchObject({
      sku: 'CLASSIC-DOLL-30-CM',
      name: '30 cm',
      sizeLabel: '30 cm',
      sizeCm: 30,
      priceMinor: 8950,
      currency: 'USD',
    });
  });

  test('recognizes an existing size label and offers the next common size', async () => {
    const withSize: ProductDetails = {
      ...details,
      variants: [
        {
          id: '00000000-0000-4000-8000-000000000004',
          sku: 'CLASSIC-DOLL-25-CM',
          name: '25 cm',
          sizeLabel: '25 cm',
          sizeCm: null,
          priceMinor: 7900,
          currency: 'USD',
          modelKey: null,
          previewFileId: null,
          previewUrl: null,
          isDefault: true,
          isActive: true,
          sortOrder: 0,
          version: 1,
        },
      ],
    };
    request.mockImplementation(async (path: string) =>
      path.startsWith('media?') ? { items: [] } : withSize,
    );

    render(<ProductEditor csrfToken="csrf-value" initial={withSize} />);
    fireEvent.click(screen.getByRole('button', { name: 'Variants' }));

    expect(
      (
        screen.getByRole('button', {
          name: '25 cm Already added',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen
        .getByRole('button', { name: '30 cm Choose size' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  test('adds a reusable color preset with one authenticated mutation', async () => {
    request.mockImplementation(async (path: string) => {
      if (path.startsWith('media?')) return { items: [] };
      if (path.endsWith('/options/presets/eye-color')) {
        return { option: { name: 'Eye color' } };
      }
      return details;
    });

    render(<ProductEditor csrfToken="csrf-value" initial={details} />);
    fireEvent.click(screen.getByRole('button', { name: 'Customization' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Add Eye color preset' }),
    );

    await vi.waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `products/${details.product.id}/options/presets/eye-color`,
        { method: 'POST' },
        'csrf-value',
      ),
    );
    expect(
      await screen.findByText('Eye color and its colors were added.'),
    ).toBeTruthy();
  });

  test('saves changed details before continuing through the edit wizard', async () => {
    request.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith('media?')) return { items: [] };
      if (init?.method === 'PATCH') {
        return { product: { ...details.product, version: 2 } };
      }
      return details;
    });

    render(<ProductEditor csrfToken="csrf-value" initial={details} wizard />);
    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Updated Doll' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save & continue' }));

    await vi.waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `products/${details.product.id}`,
        expect.objectContaining({ method: 'PATCH' }),
        'csrf-value',
      ),
    );
    await vi.waitFor(() =>
      expect(
        screen
          .getByRole('button', { name: /Media Images/ })
          .getAttribute('aria-current'),
      ).toBe('page'),
    );
  });
});
