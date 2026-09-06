import type { ReactNode } from 'react';
import type { SessionResponse } from '../lib/auth';
import { LogoutButton } from './logout-button';

const links = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin' },
  { key: 'products', label: 'Products', href: '/admin/products' },
  { key: 'media', label: 'Media', href: '/admin/media' },
  { key: 'orders', label: 'Orders', href: '/admin/orders' },
  { key: 'settings', label: 'Settings', href: '/admin/settings' },
] as const;

export function AdminShell({
  session,
  active,
  children,
}: {
  session: SessionResponse;
  active: string;
  children: ReactNode;
}) {
  const displayName = session.admin.fullName || session.admin.email;
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-main">
          <a className="admin-brand" href="/admin">
            Dollz <span>Admin</span>
          </a>
          <nav aria-label="Admin navigation">
            {links.map((link) => (
              <a
                className={`nav-link ${active === link.key ? 'active' : ''}`}
                href={link.href}
                aria-current={active === link.key ? 'page' : undefined}
                key={link.key}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-identity">
            <strong>{displayName}</strong>
            <small>Super Admin</small>
          </div>
          <LogoutButton csrfToken={session.csrfToken} />
        </div>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
