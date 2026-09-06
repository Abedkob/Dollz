// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SettingsPanel } from './settings-panel';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../lib/catalog', () => ({ catalogRequest: mocks.request }));

const settings = {
  atelierName: 'Dollz',
  publicEmail: null,
  publicPhone: null,
  whatsappNumber: null,
  locationLabel: 'Beirut, Lebanon',
  storefrontDescription: 'Handmade dolls.',
  deliveryEnabled: true,
  pickupEnabled: true,
  pickupLabel: 'Atelier pickup',
  pickupAddress: null,
  pickupCity: 'Beirut',
  pickupCountry: 'LB',
  supportedCountryCodes: ['LB'],
  defaultCountry: 'LB',
  checkoutNotice: 'We confirm every request.',
  defaultCurrency: 'USD',
  defaultProductionMinDays: 14,
  defaultProductionMaxDays: 30,
  version: 1,
  updatedAt: '2026-09-06T12:00:00.000Z',
};

describe('settings panel', () => {
  beforeEach(() => mocks.request.mockReset());
  afterEach(cleanup);

  test('saves one settings section with CSRF and the current version', async () => {
    mocks.request.mockResolvedValue({
      settings: { ...settings, pickupLabel: 'Studio pickup', version: 2 },
    });
    render(
      <SettingsPanel
        session={{
          authenticated: true,
          admin: {
            id: 'admin',
            email: 'admin@example.com',
            fullName: 'Admin',
            role: 'SUPER_ADMIN',
          },
          csrfToken: 'csrf-value',
        }}
        initialSettings={settings}
        systemStatus={{ environment: 'test', checks: [] }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Orders & delivery/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Pickup label' }), {
      target: { value: 'Studio pickup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Changes are now live.');
    expect(mocks.request).toHaveBeenCalledWith(
      'settings/orders',
      expect.objectContaining({ method: 'PATCH' }),
      'csrf-value',
    );
    const body = JSON.parse(mocks.request.mock.calls[0]![1].body as string) as {
      version: number;
      pickupLabel: string;
    };
    expect(body).toMatchObject({ version: 1, pickupLabel: 'Studio pickup' });
  });

  test('keeps section drafts while navigating and can discard them', () => {
    render(
      <SettingsPanel
        session={{
          authenticated: true,
          admin: {
            id: 'admin',
            email: 'admin@example.com',
            fullName: 'Admin',
            role: 'SUPER_ADMIN',
          },
          csrfToken: 'csrf-value',
        }}
        initialSettings={settings}
        systemStatus={{ environment: 'test', checks: [] }}
      />,
    );

    const name = screen.getByRole('textbox', { name: 'Atelier name' });
    expect(
      (
        screen.getByRole('button', {
          name: 'Save changes',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.change(name, { target: { value: 'Dollz Studio' } });
    expect(
      (
        screen.getByRole('button', {
          name: 'Save changes',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /Orders & delivery/ }));
    fireEvent.click(
      screen.getByRole('button', { name: /^Atelier Public identity/ }),
    );
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Atelier name',
        }) as HTMLInputElement
      ).value,
    ).toBe('Dollz Studio');

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Atelier name',
        }) as HTMLInputElement
      ).value,
    ).toBe('Dollz');
    expect(
      (
        screen.getByRole('button', {
          name: 'Save changes',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
