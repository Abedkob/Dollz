'use client';

import { useSearchParams } from 'next/navigation';
import React, { useState, type FormEvent } from 'react';
import { safeAdminRedirect } from '../lib/auth';
import { TurnstileWidget } from './turnstile-widget';

export function LoginForm() {
  const searchParams = useSearchParams();
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!email || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (!turnstileToken) {
      setError('Complete the security check.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/admin/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(result?.error?.message ?? 'Sign in failed. Try again.');
        return;
      }
      window.location.assign(safeAdminRedirect(searchParams.get('next')));
    } catch {
      setError('The admin service is unavailable. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit} noValidate>
      <div className="field-group">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
        />
      </div>
      <div className="field-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <TurnstileWidget onToken={setTurnstileToken} />
      <p className="form-error" role="alert" aria-live="polite">
        {error}
      </p>
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
