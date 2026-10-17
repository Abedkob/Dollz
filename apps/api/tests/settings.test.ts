import { describe, expect, test } from 'vitest';
import {
  atelierSettingsSchema,
  catalogDefaultsSchema,
  orderSettingsSchema,
} from '../src/modules/settings/schemas.js';

describe('workspace settings validation', () => {
  test('accepts only an Instagram profile as the public messaging channel', () => {
    const settings = {
      version: 1,
      atelierName: 'Dollz',
      publicEmail: null,
      instagramUrl: 'https://www.instagram.com/dollz.lb/',
      locationLabel: 'Beirut, Lebanon',
      storefrontDescription: 'Handmade dolls.',
    };

    expect(atelierSettingsSchema.safeParse(settings).success).toBe(true);
    expect(
      atelierSettingsSchema.safeParse({
        ...settings,
        instagramUrl: 'https://example.com/contact',
      }).success,
    ).toBe(false);
  });

  test('requires at least one customer fulfilment method', () => {
    const result = orderSettingsSchema.safeParse({
      version: 1,
      deliveryEnabled: false,
      pickupEnabled: false,
      pickupLabel: 'Atelier pickup',
      pickupAddress: null,
      pickupCity: 'Beirut',
      pickupCountry: 'LB',
      supportedCountryCodes: ['LB'],
      defaultCountry: 'LB',
      checkoutNotice: 'We will confirm your request.',
    });
    expect(result.success).toBe(false);
  });

  test('keeps the default country inside the supported list', () => {
    const result = orderSettingsSchema.safeParse({
      version: 1,
      deliveryEnabled: true,
      pickupEnabled: false,
      pickupLabel: 'Atelier pickup',
      pickupAddress: null,
      pickupCity: 'Beirut',
      pickupCountry: 'LB',
      supportedCountryCodes: ['LB'],
      defaultCountry: 'FR',
      checkoutNotice: 'We will confirm your request.',
    });
    expect(result.success).toBe(false);
  });

  test('rejects an inverted production range', () => {
    expect(
      catalogDefaultsSchema.safeParse({
        version: 1,
        defaultCurrency: 'USD',
        defaultProductionMinDays: 30,
        defaultProductionMaxDays: 14,
      }).success,
    ).toBe(false);
  });
});
