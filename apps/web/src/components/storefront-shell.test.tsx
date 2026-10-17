// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { INSTAGRAM_URL, StorefrontFooter } from './storefront-shell';

describe('storefront contact links', () => {
  afterEach(cleanup);

  test('links customers to the official Dollz Instagram profile safely', () => {
    render(<StorefrontFooter />);

    expect(screen.getByRole('region', { name: 'Contact Dollz' })).toBeTruthy();
    const instagram = screen.getByRole('link', {
      name: 'Message Dollz on Instagram at @dollz.lb',
    });
    expect(instagram.getAttribute('href')).toBe(INSTAGRAM_URL);
    expect(instagram.getAttribute('target')).toBe('_blank');
    expect(instagram.getAttribute('rel')).toBe('noopener noreferrer');
    expect(instagram.textContent).toContain('@dollz.lb');
    expect(screen.queryByText(/WhatsApp/i)).toBeNull();
  });
});
