import { NextRequest } from 'next/server';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { middleware } from './middleware';

afterEach(() => vi.unstubAllGlobals());

describe('admin route protection', () => {
  test('redirects an anonymous admin request to login with a safe return path', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(new Response(null, { status: 401 })),
    );
    const response = await middleware(
      new NextRequest('http://localhost:3000/admin?view=all'),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/admin/login?next=%2Fadmin%3Fview%3Dall',
    );
  });

  test('redirects an authenticated administrator away from login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 })),
    );
    const response = await middleware(
      new NextRequest('http://localhost:3000/admin/login'),
    );
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/admin',
    );
  });

  test('redirects once after a successful refresh so replacement cookies take effect', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(
          new Response('{}', {
            status: 200,
            headers: {
              'set-cookie':
                'dollz_admin_access=new; Path=/; HttpOnly; SameSite=Lax',
            },
          }),
        ),
    );
    const response = await middleware(
      new NextRequest('http://localhost:3000/admin'),
    );
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/admin',
    );
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });
});
