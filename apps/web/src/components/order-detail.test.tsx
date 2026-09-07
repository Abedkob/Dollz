// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import type { OrderDetail as Contract } from '../lib/orders';
import { OrderDetail } from './order-detail';

const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/orders', () => ({
  adminOrderRequest: request,
  displayStatus: (value: string) => value.replaceAll('_', ' '),
  money: (value: number, currency: string) => `${currency} ${value}`,
}));

const detail: Contract = {
  order: {
    id: '00000000-0000-4000-8000-000000000001',
    orderNumber: 'DLZ-2026-000001',
    customerName: 'Maya Hassan',
    customerEmail: 'maya@example.com',
    customerPhone: '+9611',
    preferredContactMethod: 'EMAIL',
    delivery: {
      addressLine1: 'Street',
      city: 'Beirut',
      region: null,
      countryCode: 'LB',
      shippingMethod: 'DELIVERY',
    },
    status: 'PAID',
    pricingStatus: 'FINAL',
    estimatedSubtotalMinor: 2500,
    finalSubtotalMinor: 3000,
    deliveryFeeMinor: 500,
    finalTotalMinor: 3500,
    currency: 'USD',
    submittedAt: '2026-09-06T00:00:00.000Z',
    estimatedCompletionDate: '2026-10-20',
    paymentDueAt: null,
    trackingReference: null,
    trackingUrl: null,
    version: 4,
  },
  items: [
    {
      id: '00000000-0000-4000-8000-000000000002',
      productName: 'Order Doll',
      variantName: 'Small',
      variantSku: 'SKU',
      variantSize: '25 cm',
      quantity: 2,
      estimatedUnitPriceMinor: 1250,
      estimatedTotalMinor: 2500,
      finalUnitPriceMinor: 1500,
      finalTotalMinor: 3000,
      currency: 'USD',
      customerRequest: null,
      selections: [],
    },
  ],
  messages: [],
  history: [],
  revisions: [],
  payments: [],
};

afterEach(() => {
  cleanup();
  request.mockReset();
  vi.restoreAllMocks();
});

test('shows only the valid lifecycle action, confirms it, and sends the current version', async () => {
  request.mockResolvedValue(detail);
  render(<OrderDetail initial={detail} csrfToken="csrf" />);
  expect(screen.getByRole('button', { name: 'Start production' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Start production' }));
  expect(screen.getByRole('dialog', { name: 'Confirm this order action' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm action' }));
  await vi.waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      `${detail.order.id}/status`,
      expect.objectContaining({ method: 'POST' }),
      'csrf',
    ),
  );
  expect(JSON.parse(request.mock.calls[0]![1].body)).toMatchObject({
    expectedVersion: 4,
    action: 'START_PRODUCTION',
  });
});

test('regenerates the tracking link and shows it for copying', async () => {
  const trackingLink =
    'http://localhost:3000/orders/DLZ-2026-000001#token=fresh-token';
  request.mockImplementation((path: string) =>
    Promise.resolve(
      path.endsWith('/access/regenerate')
        ? { trackingLink, version: 5 }
        : detail,
    ),
  );
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  render(<OrderDetail initial={detail} csrfToken="csrf" />);

  fireEvent.click(
    screen.getByRole('button', { name: 'Regenerate tracking link' }),
  );
  expect(
    screen.getByRole('dialog', { name: 'Regenerate the tracking link' }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate link' }));

  await vi.waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      `${detail.order.id}/access/regenerate`,
      expect.objectContaining({ method: 'POST' }),
      'csrf',
    ),
  );
  expect(
    JSON.parse(
      request.mock.calls.find(([path]) =>
        String(path).endsWith('/access/regenerate'),
      )![1].body,
    ),
  ).toMatchObject({ expectedVersion: 4 });

  const linkInput = (await screen.findByDisplayValue(
    trackingLink,
  )) as HTMLInputElement;
  expect(linkInput).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
  await vi.waitFor(() =>
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(trackingLink),
  );
});

test('regenerate result stays visible if the follow-up reload fails', async () => {
  const trackingLink =
    'http://localhost:3000/orders/DLZ-2026-000001#token=fresh-token';
  request.mockImplementation((path: string) =>
    path.endsWith('/access/regenerate')
      ? Promise.resolve({ trackingLink, version: 5 })
      : Promise.reject(new Error('network error')),
  );
  render(<OrderDetail initial={detail} csrfToken="csrf" />);

  fireEvent.click(
    screen.getByRole('button', { name: 'Regenerate tracking link' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Regenerate link' }));

  const linkInput = (await screen.findByDisplayValue(
    trackingLink,
  )) as HTMLInputElement;
  expect(linkInput).toBeTruthy();
  expect(
    screen.getByRole('dialog', { name: 'New tracking link ready' }),
  ).toBeTruthy();
});

test('cancelling with an empty reason shows a visible error instead of failing silently', async () => {
  request.mockResolvedValue(detail);
  render(<OrderDetail initial={detail} csrfToken="csrf" />);

  fireEvent.click(screen.getByText('Reject or cancel order'));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));

  expect(
    screen.getByText('Add a reason before cancelling this order.'),
  ).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

test('cancelling a paid order requires the exceptional confirmation and audit reason', async () => {
  request.mockResolvedValue(detail);
  render(<OrderDetail initial={detail} csrfToken="csrf" />);

  fireEvent.click(screen.getByText('Reject or cancel order'));
  fireEvent.change(screen.getByLabelText('Reason'), {
    target: { value: 'Customer requested cancellation.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));

  expect(
    screen.getByText(
      'Confirm the exceptional cancellation and explain why before continuing.',
    ),
  ).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(request).not.toHaveBeenCalled();
});

test('starting review on a submitted order opens the confirmation dialog', async () => {
  const submitted: Contract = {
    ...detail,
    order: { ...detail.order, status: 'SUBMITTED' },
  };
  request.mockResolvedValue(submitted);
  render(<OrderDetail initial={submitted} csrfToken="csrf" />);

  fireEvent.click(screen.getByRole('button', { name: 'Start review' }));

  expect(
    screen.getByRole('dialog', { name: 'Confirm this order action' }),
  ).toBeTruthy();
});
