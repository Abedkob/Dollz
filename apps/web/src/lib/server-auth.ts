import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiInternalUrl, type SessionResponse } from './auth';

export async function requireAdminSession(): Promise<SessionResponse> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${apiInternalUrl()}/admin/auth/session`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) redirect('/admin/login');
  return response.json() as Promise<SessionResponse>;
}

export async function adminApiServer<T>(path: string): Promise<T | null> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(
    `${apiInternalUrl()}/admin/${path.replace(/^\//, '')}`,
    {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    },
  ).catch(() => null);
  return response?.ok ? (response.json() as Promise<T>) : null;
}
