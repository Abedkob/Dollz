'use client';

import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import React, { useState, type FormEvent } from 'react';
import { safeAdminRedirect } from '../lib/auth';
import { TurnstileWidget } from './turnstile-widget';

export function LoginForm() {
  const searchParams = useSearchParams();
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      <div className="login-field">
        <label htmlFor="email">Email address</label>
        <div className="login-input-shell">
          <Mail aria-hidden="true" size={18} strokeWidth={1.8} />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            placeholder="name@example.com"
            required
          />
        </div>
      </div>
      <div className="login-field">
        <label htmlFor="password">Password</label>
        <div className="login-input-shell">
          <LockKeyhole aria-hidden="true" size={18} strokeWidth={1.8} />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
          />
          <button
            className="login-password-toggle"
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
          </button>
        </div>
      </div>

      <div className="login-security-check">
        <div className="login-security-label">
          <ShieldCheck aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>
            <strong>Security check</strong>
            <small>Protected administrator access</small>
          </span>
        </div>
        <TurnstileWidget onToken={setTurnstileToken} />
      </div>

      {error ? (
        <p
          id="login-error"
          className="form-error login-error"
          role="alert"
          aria-live="polite"
        >
          <CircleAlert aria-hidden="true" size={17} />
          <span>{error}</span>
        </p>
      ) : null}

      <button
        className="primary-button login-submit"
        type="submit"
        disabled={loading}
      >
        <span>{loading ? 'Signing in…' : 'Sign in'}</span>
        {loading ? (
          <span className="login-spinner" aria-hidden="true" />
        ) : (
          <ArrowRight aria-hidden="true" size={18} />
        )}
      </button>
    </form>
  );
}
