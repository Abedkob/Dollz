import React, { type ReactNode } from 'react';
import {
  ExternalLink,
  Heart,
  Images,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Store,
} from 'lucide-react';
import type { SessionResponse } from '../lib/auth';
import { LogoutButton } from './logout-button';

const links = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
  },
  { key: 'orders', label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  {
    key: 'products',
    label: 'Products',
    href: '/admin/products',
    icon: Package,
  },
  { key: 'media', label: 'Media', href: '/admin/media', icon: Images },
  {
    key: 'settings',
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
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
  const initial = displayName.trim().charAt(0).toUpperCase() || 'D';
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="sidebar-main">
          <a className="admin-brand" href="/admin">
            <span className="admin-brand-mark" aria-hidden="true">
              <Heart size={18} strokeWidth={2.2} />
            </span>
            <span className="admin-brand-copy">
              <strong>Dollz</strong>
              <small>Atelier admin</small>
            </span>
          </a>
          <nav aria-label="Admin navigation">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  className={`nav-link ${active === link.key ? 'active' : ''}`}
                  href={link.href}
                  aria-current={active === link.key ? 'page' : undefined}
                  aria-label={link.label}
                  title={link.label}
                  key={link.key}
                >
                  <Icon
                    className="nav-link-icon"
                    aria-hidden="true"
                    size={19}
                  />
                  <span className="nav-link-label">{link.label}</span>
                </a>
              );
            })}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-identity">
            <span className="sidebar-identity-avatar" aria-hidden="true">
              {initial}
            </span>
            <span className="sidebar-identity-meta">
              <strong>{displayName}</strong>
              <small>Super Admin</small>
            </span>
          </div>
          <LogoutButton csrfToken={session.csrfToken} />
          <a
            className="sidebar-store-link"
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            <Store aria-hidden="true" size={17} />
            <span>View storefront</span>
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        </div>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
