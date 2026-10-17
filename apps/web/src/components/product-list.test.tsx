// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ProductList } from './product-list';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));
vi.mock('../lib/catalog', () => ({
  catalogRequest: mocks.request,
  money: (amount: number, currency: string) => `${currency} ${amount}`,
}));

const product = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Classic Doll',
  slug: 'classic-doll',
  status: 'DRAFT',
  startingPriceMinor: 7900,
  currency: 'USD',
  isFeatured: false,
  activeVariantCount: 2,
  primaryThumbnailUrl: null,
  updatedAt: '2026-09-05T00:00:00.000Z',
  version: 1,
};

describe('product list states and actions', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.replace.mockReset();
    mocks.params = new URLSearchParams();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('moves from loading to the first-catalog empty state', async () => {
    let resolve!: (value: unknown) => void;
    mocks.request.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<ProductList csrfToken="csrf" />);
    expect(screen.getByText('Preparing products…')).toBeTruthy();
    resolve({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(
      await screen.findByText('Start your first doll design'),
    ).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add product' })[0]!);
    expect(screen.getByRole('dialog').textContent).toContain('Add a doll');
    expect(mocks.replace).toHaveBeenCalledWith('/admin/products?create=1', {
      scroll: false,
    });
  });

  test('renders service errors with a working retry', async () => {
    mocks.request
      .mockRejectedValueOnce(new Error('Catalog unavailable'))
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    render(<ProductList csrfToken="csrf" />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Catalog unavailable',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByText('Start your first doll design'),
    ).toBeTruthy();
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });

  test('renders records and requires confirmation before an authenticated archive mutation', async () => {
    mocks.request.mockResolvedValue({
      items: [product],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ProductList csrfToken="csrf-value" />);
    expect(await screen.findByText('Classic Doll')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(mocks.request).toHaveBeenCalledTimes(1);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(3));
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      `products/${product.id}/archive`,
      { method: 'POST' },
      'csrf-value',
    );
  });

  test('duplicates a product with its variants and opens the draft for review', async () => {
    const duplicate = {
      ...product,
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Classic Doll copy',
      slug: 'classic-doll-copy',
    };
    mocks.request.mockImplementation((path: string) => {
      if (path === `products/${product.id}/duplicate`)
        return Promise.resolve({
          product: duplicate,
          copied: { variants: 2 },
        });
      if (path === `products/${duplicate.id}`) return new Promise(() => {});
      return Promise.resolve({
        items: [product],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    render(<ProductList csrfToken="csrf-value" />);
    expect(await screen.findByText('Classic Doll')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    await vi.waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        `products/${product.id}/duplicate`,
        { method: 'POST' },
        'csrf-value',
      ),
    );
    expect(
      await screen.findByText(
        'Draft copy created with 2 variants. Review its name and SKUs before publishing.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Edit product' })).toBeTruthy();
    expect(mocks.replace).toHaveBeenCalledWith(
      `/admin/products?edit=${duplicate.id}`,
      { scroll: false },
    );
  });

  test('opens Edit as a guided modal and keeps its URL shareable', async () => {
    mocks.request.mockImplementation((path: string) => {
      if (path === `products/${product.id}`) return new Promise(() => {});
      return Promise.resolve({
        items: [product],
        total: 1,
        page: 1,
        pageSize: 20,
      });
    });

    render(<ProductList csrfToken="csrf-value" />);
    expect(await screen.findByText('Classic Doll')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByRole('dialog', { name: 'Edit product' })).toBeTruthy();
    expect(screen.getByText('Opening product…')).toBeTruthy();
    expect(mocks.replace).toHaveBeenCalledWith(
      `/admin/products?edit=${product.id}`,
      { scroll: false },
    );
  });

  test('keeps the requested page when using pagination', async () => {
    mocks.request.mockResolvedValue({
      items: [product],
      total: 40,
      page: 1,
      pageSize: 20,
    });

    render(<ProductList csrfToken="csrf-value" />);
    await screen.findByText('Classic Doll');
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));

    expect(mocks.replace).toHaveBeenCalledWith('/admin/products?page=2', {
      scroll: false,
    });
  });
});
