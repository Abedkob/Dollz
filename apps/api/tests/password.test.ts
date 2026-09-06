import { describe, expect, test } from 'vitest';
import {
  assertPasswordPolicy,
  hashPassword,
  verifyPassword,
} from '../src/modules/auth/password.js';

describe('password security', () => {
  test('hashes with Argon2id and verifies only the correct password', async () => {
    const hash = await hashPassword('a long password with spaces');
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(
      verifyPassword(hash, 'a long password with spaces'),
    ).resolves.toBe(true);
    await expect(verifyPassword(hash, 'not the password')).resolves.toBe(false);
  });

  test('enforces length boundaries and rejects the normalized email', () => {
    expect(() =>
      assertPasswordPolicy('12345678901', 'admin@example.com'),
    ).toThrow();
    expect(() =>
      assertPasswordPolicy('x'.repeat(129), 'admin@example.com'),
    ).toThrow();
    expect(() =>
      assertPasswordPolicy('admin@example.com', 'ADMIN@example.com'),
    ).toThrow();
    expect(() =>
      assertPasswordPolicy('valid long password', 'admin@example.com'),
    ).not.toThrow();
  });
});
