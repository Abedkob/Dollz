import { describe, expect, test } from 'vitest';
import { LoginRateLimiter } from '../src/modules/auth/rate-limiter.js';
import {
  csrfTokenForSession,
  verifyAllowedOrigin,
  verifyCsrfToken,
} from '../src/modules/auth/security.js';

describe('CSRF and login throttling', () => {
  test('uses constant-value CSRF tokens and rejects missing or changed values', () => {
    const token = csrfTokenForSession('session', 'secret');
    expect(() => verifyCsrfToken(token, token)).not.toThrow();
    expect(() => verifyCsrfToken(undefined, token)).toThrow();
    expect(() => verifyCsrfToken(`${token}x`, token)).toThrow();
  });

  test('accepts configured origin and referer fallback only', () => {
    expect(() =>
      verifyAllowedOrigin('https://admin.example.com', undefined, [
        'https://admin.example.com',
      ]),
    ).not.toThrow();
    expect(() =>
      verifyAllowedOrigin(undefined, 'https://admin.example.com/page', [
        'https://admin.example.com',
      ]),
    ).not.toThrow();
    expect(() =>
      verifyAllowedOrigin('https://evil.example', undefined, [
        'https://admin.example.com',
      ]),
    ).toThrow();
  });

  test('locks and resets an IP/email rate-limit key', () => {
    const limiter = new LoginRateLimiter(2, 1_000);
    expect(limiter.recordFailure('key', 1)).toBe(false);
    expect(limiter.recordFailure('key', 2)).toBe(true);
    expect(limiter.isBlocked('key', 500)).toBe(true);
    limiter.reset('key');
    expect(limiter.isBlocked('key', 500)).toBe(false);
  });
});
