// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { AdminShell } from './admin-shell';

afterEach(cleanup);

describe('admin navigation shell', () => {
  test('marks the active workspace and keeps core destinations available', () => {
    render(
      <AdminShell
        active="orders"
        session={{
          authenticated: true,
          csrfToken: 'csrf-value',
          admin: {
            id: 'admin-id',
            email: 'admin@dollz.local',
            fullName: 'Dollz Administrator',
            role: 'SUPER_ADMIN',
          },
        }}
      >
        <h1>Orders</h1>
      </AdminShell>,
    );

    const navigation = screen.getByRole('navigation', {
      name: 'Admin navigation',
    });
    expect(navigation.querySelectorAll('a')).toHaveLength(5);
    expect(
      screen.getByRole('link', { name: 'Orders' }).getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getByRole('link', { name: 'View storefront' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
  });
});
