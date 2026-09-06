import { describe, expect, test } from 'vitest';
import {
  emailAddress,
  hexColor,
  nonEmptyString,
  normalizeCatalogCode,
  optionValueSchema,
  productCreateSchema,
  productOptionSchema,
  variantSchema,
} from '../src/index.js';

describe('shared validation', () => {
  test('accepts valid shared inputs', () => {
    expect(emailAddress.parse('customer@example.com')).toBe(
      'customer@example.com',
    );
    expect(nonEmptyString.parse(' Dollz ')).toBe('Dollz');
  });

  test('rejects malformed shared inputs', () => {
    expect(() => emailAddress.parse('not-an-email')).toThrow();
    expect(() => nonEmptyString.parse('   ')).toThrow();
  });

  test('normalizes catalog codes and currency without weakening validation', () => {
    expect(normalizeCatalogCode('  Soft Pink / Dress  ')).toBe(
      'soft-pink-dress',
    );
    expect(hexColor.parse('#a0BbCc')).toBe('#A0BBCC');
    expect(
      variantSchema.parse({
        sku: ' DOLL-25 ',
        name: '25 cm',
        priceMinor: 7900,
        currency: 'usd',
      }).currency,
    ).toBe('USD');
    expect(() =>
      variantSchema.parse({
        sku: 'DOLL',
        name: 'Doll',
        priceMinor: 1.2,
        currency: 'US',
      }),
    ).toThrow();
  });

  test('rejects invalid production windows and unsupported 3D mappings', () => {
    expect(() =>
      productCreateSchema.parse({
        name: 'Classic',
        slug: 'classic',
        startingPriceMinor: 5000,
        currency: 'USD',
        productionMinDays: 8,
        productionMaxDays: 4,
      }),
    ).toThrow();
    expect(() =>
      productOptionSchema.parse({
        code: 'hair-type',
        name: 'Hair type',
        inputType: 'SELECT',
        affects3d: true,
        threeDProperty: 'meshSwap',
      }),
    ).toThrow();
    expect(() =>
      productOptionSchema.parse({
        code: 'note',
        name: 'Note',
        inputType: 'TEXT',
        affects3d: false,
        threeDProperty: 'hair',
      }),
    ).toThrow();
  });

  test('allows only controlled option metadata and validates image/color references', () => {
    expect(
      optionValueSchema.parse({
        code: 'brown',
        label: 'Brown',
        colorHex: '#663300',
        metadata: { swatchLabel: 'Warm brown', material: 'Yarn' },
      }).metadata,
    ).toEqual({ swatchLabel: 'Warm brown', material: 'Yarn' });
    expect(() =>
      optionValueSchema.parse({
        code: 'unsafe',
        label: 'Unsafe',
        metadata: { arbitraryScript: '<script>' },
      }),
    ).toThrow();
    expect(() =>
      optionValueSchema.parse({
        code: 'bad-file',
        label: 'Bad file',
        referenceFileId: '../outside',
      }),
    ).toThrow();
  });
});
