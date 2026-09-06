// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { LogoutButton } from './logout-button';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('logout action', () => {
  test('sends the CSRF token without exposing an authentication token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const onComplete = vi.fn();
    render(<LogoutButton csrfToken="csrf-value" onComplete={onComplete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/admin/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: { 'x-csrf-token': 'csrf-value' },
      }),
    );
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
