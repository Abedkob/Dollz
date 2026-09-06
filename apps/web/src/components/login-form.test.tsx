// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { LoginForm } from './login-form';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./turnstile-widget', () => ({
  TurnstileWidget: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('verified')}>
      Verify
    </button>
  ),
}));

describe('admin login form', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  test('shows accessible validation without registration or recovery links', () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert').textContent).toContain(
      'Enter your email and password',
    );
    expect(screen.queryByText(/register|forgot/i)).toBeNull();
  });

  test('prevents duplicate submission and displays generic failure', async () => {
    let resolveRequest!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveRequest = resolve;
          }),
      ),
    );
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a strong password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      (screen.getByRole('button', { name: 'Signing in…' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    resolveRequest(
      new Response(
        JSON.stringify({
          error: { message: 'The email or password is incorrect.' },
        }),
        { status: 401 },
      ),
    );
    expect(
      await screen.findByText('The email or password is incorrect.'),
    ).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
