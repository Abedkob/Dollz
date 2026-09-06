import { describe, expect, test } from 'vitest';
import { safeAdminRedirect } from './auth';

describe('safe admin redirects', () => {
  test.each([
    [null, '/admin'],
    ['https://evil.example', '/admin'],
    ['//evil.example/admin', '/admin'],
    ['/store', '/admin'],
    ['/admin/login', '/admin'],
    ['/admin/products?draft=1', '/admin/products?draft=1'],
  ])('maps %s safely', (input, expected) => {
    expect(safeAdminRedirect(input)).toBe(expected);
  });
});
