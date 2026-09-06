// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { OrderList } from './order-list';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));
vi.mock('../lib/orders', () => ({
  adminOrderRequest: mocks.request,
  displayStatus: (value: string) => value.replaceAll('_', ' '),
  money: (value: number, currency: string) => `${currency} ${value}`,
}));

const order = {
  id: '00000000-0000-4000-8000-000000000001',
  orderNumber: 'DLZ-2026-000001',
  customerName: 'Maya Hassan',
  customerEmail: 'maya@example.com',
  customerPhone: '+9611',
  dollCount: 2,
  status: 'SUBMITTED',
  pricingStatus: 'ESTIMATE',
  paymentStatus: 'NONE',
  totalMinor: 2500,
  currency: 'USD',
  submittedAt: '2026-09-06T00:00:00.000Z',
  estimatedCompletionDate: null,
  version: 1,
  requiresAction: true,
};

describe('order list', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.replace.mockReset();
    mocks.params = new URLSearchParams();
  });
  afterEach(cleanup);

  test('shows loading, action-required orders, and responsive table content', async () => {
    let resolve!: (value: unknown) => void;
    mocks.request.mockReturnValue(new Promise((done) => (resolve = done)));
    render(<OrderList />);
    expect(screen.getByText('Loading orders…')).toBeTruthy();
    resolve({ items: [order], total: 1, page: 1, pageSize: 20 });
    expect(await screen.findByText('Decisions waiting for you')).toBeTruthy();
    expect(screen.getAllByText('DLZ-2026-000001')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Review request DLZ-2026-000001' })).toBeTruthy();
  });

  test('updates searchable filters without losing the admin route', async () => {
    mocks.request.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    render(<OrderList />);
    await screen.findByText('No orders yet');
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'PAID' },
    });
    expect(mocks.replace).toHaveBeenCalledWith('/admin/orders?status=PAID', {
      scroll: false,
    });
  });
});
