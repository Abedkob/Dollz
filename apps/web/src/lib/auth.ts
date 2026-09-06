export interface SessionAdmin {
  id: string;
  email: string;
  fullName: string | null;
  role: 'SUPER_ADMIN';
}

export interface SessionResponse {
  authenticated: true;
  admin: SessionAdmin;
  csrfToken: string;
}

export function safeAdminRedirect(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith('/admin') ||
    value.startsWith('//') ||
    value === '/admin/login'
  )
    return '/admin';
  return value;
}

export function apiInternalUrl(): string {
  return process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
}
