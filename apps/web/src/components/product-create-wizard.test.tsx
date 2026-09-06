// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ProductCreateWizard } from './product-create-wizard';

const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/catalog', () => ({
  catalogRequest: request,
  money: (amount: number, currency: string) => `${currency} ${amount}`,
}));

afterEach(() => {
  cleanup();
  request.mockReset();
  vi.restoreAllMocks();
});

describe('product creation wizard', () => {
  test('creates automatic slug and SEO through a two-step essentials flow', async () => {
    request.mockResolvedValue({
      product: { id: '00000000-0000-4000-8000-000000000001' },
    });
    const created = vi.fn();
    render(
      <ProductCreateWizard
        csrfToken="csrf-value"
        onClose={vi.fn()}
        onCreated={created}
      />,
    );

    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Classic Linen Doll' },
    });
    fireEvent.change(screen.getByLabelText('Short description'), {
      target: { value: 'A quiet, handmade companion.' },
    });
    fireEvent.change(screen.getByLabelText('Starting price'), {
      target: { value: '129.50' },
    });
    expect(screen.queryByLabelText('Catalog URL')).toBeNull();
    expect(screen.queryByLabelText('Search title')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review product' }));

    expect(
      screen.getByRole('heading', { name: 'Ready to create' }),
    ).toBeTruthy();
    expect(screen.getByText('USD 12950')).toBeTruthy();
    expect(screen.getByText('SEO generated automatically')).toBeTruthy();
    expect(screen.getByText('A quiet, handmade companion.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create product' }));

    await vi.waitFor(() => expect(created).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith(
      'products',
      expect.objectContaining({ method: 'POST' }),
      'csrf-value',
    );
    const payload = JSON.parse(request.mock.calls[0]![1].body as string);
    expect(payload).toMatchObject({
      name: 'Classic Linen Doll',
      slug: 'classic-linen-doll',
      startingPriceMinor: 12950,
      currency: 'USD',
      productionMinDays: 14,
      productionMaxDays: 30,
      seoTitle: 'Classic Linen Doll',
      seoDescription: 'A quiet, handmade companion.',
    });
  });

  test('asks before closing a wizard with unsaved entries', () => {
    const close = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <ProductCreateWizard
        csrfToken="csrf"
        onClose={close}
        onCreated={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Unsaved doll' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Close product wizard' }),
    );
    expect(confirm).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Close product wizard' }),
    );
    expect(close).toHaveBeenCalledOnce();
  });
});
