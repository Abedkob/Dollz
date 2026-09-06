import { Suspense } from 'react';
import { AdminShell } from '../../../components/admin-shell';
import { OrderList } from '../../../components/order-list';
import { requireAdminSession } from '../../../lib/server-auth';

export default async function OrdersPage() {
  const session = await requireAdminSession();
  return (
    <AdminShell session={session} active="orders">
      <Suspense
        fallback={<div className="catalog-loading">Preparing orders…</div>}
      >
        <OrderList />
      </Suspense>
    </AdminShell>
  );
}
