import { AdminShell } from '../../components/admin-shell';
import { requireAdminSession } from '../../lib/server-auth';

const areas = [
  [
    'Products',
    'Create doll designs, physical sizes, customization choices, and publishing rules.',
    '/admin/products',
    'Open products',
  ],
  [
    'Media',
    'Upload and reuse product, variant, and option images.',
    '/admin/media',
    'Open media',
  ],
  [
    'Orders',
    'Review requests, quotations, payments, production, and delivery.',
    '/admin/orders',
    'Open orders',
  ],
  [
    'Settings',
    'Manage storefront details, delivery methods, defaults, and security.',
    '/admin/settings',
    'Open settings',
  ],
] as const;

export default async function AdminPage() {
  const session = await requireAdminSession();
  return (
    <AdminShell session={session} active="dashboard">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Private workspace</p>
          <h1>Dashboard</h1>
        </div>
      </header>
      <div className="welcome-panel">
        <p className="eyebrow">Catalog workshop</p>
        <h2>Shape each doll before it reaches the shop.</h2>
        <p>
          Build product details, sizes, imagery, and customization choices in
          one protected workspace.
        </p>
      </div>
      <section aria-labelledby="workspace-areas">
        <h2 id="workspace-areas" className="section-title">
          Workspace areas
        </h2>
        <div className="area-list">
          {areas.map(([name, description, href, label]) => (
            <article className="area-row" key={name}>
              <h3>{name}</h3>
              <p>{description}</p>
              {href ? (
                <a className="text-link" href={href}>
                  {label}
                </a>
              ) : (
                <span className="coming-soon">{label}</span>
              )}
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
