// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MediaLibrary } from './media-library';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('../lib/catalog', () => ({ catalogRequest: mocks.request }));

const image = {
  id: '00000000-0000-4000-8000-000000000001',
  originalName: 'studio-doll.webp',
  mimeType: 'image/webp',
  sizeBytes: 245760,
  category: 'PRODUCT' as const,
  visibility: 'PUBLIC' as const,
  width: 1600,
  height: 2000,
  deletedAt: null,
  createdAt: '2026-09-05T00:00:00.000Z',
  urls: {
    optimized: '/media/studio-doll.webp',
    thumbnail: '/media/studio-doll-thumb.webp',
  },
};

describe('media library workbench', () => {
  beforeEach(() => mocks.request.mockReset());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('moves from a loading contact sheet to image details', async () => {
    let resolve!: (value: unknown) => void;
    mocks.request.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<MediaLibrary csrfToken="csrf" />);

    expect(screen.getByText('Loading media…')).toBeTruthy();
    resolve({ items: [image] });

    fireEvent.click(
      await screen.findByRole('button', { name: 'View studio-doll.webp' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'studio-doll.webp' });
    expect(dialog.textContent).toContain('1600 × 2000');
    expect(dialog.textContent).toContain('WEBP');
  });

  test('opens a guided upload modal from the first-library empty state', async () => {
    mocks.request.mockResolvedValue({ items: [] });
    render(<MediaLibrary csrfToken="csrf" />);

    expect(await screen.findByText('Your media atelier is empty')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add your first image' }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Add media' });
    expect(dialog.textContent).toContain('Where will this image be used?');
    expect(dialog.textContent).toContain('Product photography');
    expect(dialog.textContent).toContain('Variant previews');
    expect(dialog.textContent).toContain('Customization options');
  });

  test('filters the contact sheet with human-friendly categories', async () => {
    mocks.request.mockResolvedValue({ items: [] });
    render(<MediaLibrary csrfToken="csrf" />);
    await screen.findByText('Your media atelier is empty');

    fireEvent.click(screen.getByRole('button', { name: 'Variant previews' }));
    await vi.waitFor(() => {
      expect(mocks.request).toHaveBeenLastCalledWith(
        'media?pageSize=100&category=VARIANT',
      );
    });
  });
});
