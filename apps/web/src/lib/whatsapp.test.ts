import { describe, expect, test } from 'vitest';
import type { CartItem } from './storefront';
import {
  buildOrderWhatsappMessage,
  whatsappUrl,
  type WhatsappOrderInput,
} from './whatsapp';

const item: CartItem = {
  key: 'item-1',
  productId: 'product-1',
  productSlug: 'classic-doll',
  productName: 'Classic Doll',
  variantId: 'variant-1',
  variantName: '25 cm',
  quantity: 2,
  estimatedUnitPriceMinor: 4500,
  currency: 'USD',
  imageUrl: null,
  customerRequest: 'Please stitch a small heart',
  selections: [
    {
      optionId: 'opt-1',
      optionName: 'Eye color',
      optionValueId: 'val-1',
      valueLabel: 'Warm brown',
      customValue: null,
      customColor: null,
    },
    {
      optionId: 'opt-2',
      optionName: 'Dress',
      optionValueId: null,
      valueLabel: 'Custom',
      customValue: null,
      customColor: '#ff99aa',
    },
  ],
};

const input: WhatsappOrderInput = {
  orderNumber: 'DZ-000123',
  trackingUrl: 'https://dollz.example/orders/DZ-000123#token=abc',
  contact: {
    fullName: 'Lina Haddad',
    email: 'lina@example.com',
    phone: '+961 70 123 456',
    preferredContactMethod: 'WHATSAPP',
  },
  delivery: {
    shippingMethod: 'DELIVERY',
    addressLine1: 'Hamra Street',
    addressLine2: '',
    city: 'Beirut',
    region: '',
    country: 'Lebanon',
  },
  notes: 'Gift wrap please',
  items: [item],
  total: 9000,
  currency: 'USD',
};

describe('whatsappUrl', () => {
  test('targets the atelier number in digits-only form', () => {
    expect(whatsappUrl()).toBe('https://wa.me/9613011679');
  });

  test('url-encodes the prefilled text', () => {
    expect(whatsappUrl('Hi there & hello')).toBe(
      'https://wa.me/9613011679?text=Hi%20there%20%26%20hello',
    );
  });
});

describe('buildOrderWhatsappMessage', () => {
  test('includes order, contact, delivery, items, choices, total and tracking link', () => {
    const message = buildOrderWhatsappMessage(input);
    expect(message).toContain('Order: DZ-000123');
    expect(message).toContain('Name: Lina Haddad');
    expect(message).toContain('Phone: +961 70 123 456');
    expect(message).toContain('Preferred contact: WhatsApp');
    expect(message).toContain('Delivery: Hamra Street, Beirut, Lebanon');
    expect(message).toContain('1. Classic Doll (25 cm) x2');
    expect(message).toContain('- Eye color: Warm brown');
    expect(message).toContain('- Dress: Custom · #ff99aa');
    expect(message).toContain('- Request: Please stitch a small heart');
    expect(message).toContain('Notes: Gift wrap please');
    expect(message).toContain('Estimated total: $90');
    expect(message).toContain(
      'Track my order: https://dollz.example/orders/DZ-000123#token=abc',
    );
  });

  test('describes pickup instead of an address', () => {
    const message = buildOrderWhatsappMessage({
      ...input,
      delivery: { ...input.delivery, shippingMethod: 'PICKUP' },
      pickupLabel: 'Atelier pickup',
      pickupCity: 'Beirut',
    });
    expect(message).toContain('Pickup: Atelier pickup, Beirut');
    expect(message).not.toContain('Hamra Street');
  });

  test('falls back to a short message that keeps the order number and link when the cart is large', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...item,
      key: `item-${index}`,
      customerRequest: 'x'.repeat(300),
    }));
    const message = buildOrderWhatsappMessage({ ...input, items: many });
    expect(whatsappUrl(message).length).toBeLessThanOrEqual(1800);
    expect(message).toContain('Order: DZ-000123');
    expect(message).toContain('Track my order:');
    expect(message).not.toContain('Eye color');
  });
});
