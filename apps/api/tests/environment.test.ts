import { describe, expect, test } from 'vitest';
import { readEnvironment } from '../src/config/environment.js';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://localhost/dollz',
  JWT_ACCESS_SECRET: 'development-access-secret',
  JWT_REFRESH_SECRET: 'development-refresh-secret',
  TURNSTILE_SECRET_KEY: 'development-turnstile-secret',
  ALLOWED_ORIGINS: 'http://localhost:3000',
  TRUST_PROXY: 'false',
};

describe('authentication environment', () => {
  test('parses explicit proxy and origin configuration', () => {
    expect(readEnvironment(base)).toMatchObject({
      TRUST_PROXY: false,
      ALLOWED_ORIGINS: ['http://localhost:3000'],
    });
  });

  test('requires separate secrets', () => {
    expect(() =>
      readEnvironment({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET }),
    ).toThrow();
  });

  test('rejects weak or placeholder production secrets', () => {
    expect(() =>
      readEnvironment({ ...base, NODE_ENV: 'production' }),
    ).toThrow();
  });
});
