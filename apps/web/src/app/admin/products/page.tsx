import { Suspense } from 'react';
import { AdminShell } from '../../../components/admin-shell';
import { ProductList } from '../../../components/product-list';
import { requireAdminSession } from '../../../lib/server-auth';
import { adminApiServer } from '../../../lib/server-auth';
import type { WorkspaceSettings } from '../../../lib/settings';

export default async function ProductsPage() {
  const session = await requireAdminSession();
  const settings = await adminApiServer<{ settings: WorkspaceSettings }>(
    'settings',
  );
  return (
    <AdminShell session={session} active="products">
      <Suspense
        fallback={<div className="catalog-loading">Preparing products…</div>}
      >
        <ProductList
          csrfToken={session.csrfToken}
          catalogDefaults={
            settings
              ? {
                  currency: settings.settings.defaultCurrency,
                  productionMinDays: settings.settings.defaultProductionMinDays,
                  productionMaxDays: settings.settings.defaultProductionMaxDays,
                }
              : undefined
          }
        />
      </Suspense>
    </AdminShell>
  );
}
