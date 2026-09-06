import { describe, expect, test } from 'vitest';
import {
  catalogDefaultsSchema,
  orderSettingsSchema,
} from '../src/modules/settings/schemas.js';

describe('workspace settings validation', () => {
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
