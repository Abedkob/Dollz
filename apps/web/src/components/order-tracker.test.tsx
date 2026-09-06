// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { OrderTracker } from './order-tracker';

const request = vi.hoisted(() => vi.fn());
vi.mock('../lib/orders', () => ({
  guestOrderRequest: request,
  displayStatus: (value: string) => value.replaceAll('_', ' '),
  money: (value: number, currency: string) => `${currency} ${value}`,
}));

afterEach(() => {
  cleanup();
  request.mockReset();
  window.history.replaceState(null, '', '/');
});

test('exchanges a fragment token and removes it from browser history', async () => {
  window.history.replaceState(
    null,
    '',
    '/orders/DLZ-2026-000001#token=private-token',
  );
  request.mockResolvedValue({
    csrfToken: 'guest-csrf',
    order: {
      order: {
        orderNumber: 'DLZ-2026-000001',
        customerName: 'Maya',
        status: 'SUBMITTED',
        pricingStatus: 'ESTIMATE',
        estimatedSubtotalMinor: 2500,
        finalSubtotalMinor: null,
        deliveryFeeMinor: 0,
        finalTotalMinor: null,
        currency: 'USD',
        submittedAt: '2026-09-06T00:00:00.000Z',
        estimatedCompletionDate: null,
        paymentDueAt: null,
        trackingReference: null,
        trackingUrl: null,
        preferredContactMethod: 'EMAIL',
        delivery: {
          city: 'Beirut',
          region: null,
          countryCode: 'LB',
          shippingMethod: 'DELIVERY',
        },
      },
      items: [],
      messages: [],
      history: [],
      revisions: [],
      payments: [],
    },
  });
  render(<OrderTracker orderNumber="DLZ-2026-000001" />);
  expect(await screen.findByText('Private order tracking')).toBeTruthy();
  expect(window.location.hash).toBe('');
  expect(request).toHaveBeenCalledWith(
    'access/exchange',
    expect.objectContaining({ method: 'POST' }),
  );
});
