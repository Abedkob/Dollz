import { notFound } from 'next/navigation';
import { AdminShell } from '../../../../components/admin-shell';
import { OrderDetail } from '../../../../components/order-detail';
import type { OrderDetail as OrderDetailContract } from '../../../../lib/orders';
import {
  adminApiServer,
  requireAdminSession,
} from '../../../../lib/server-auth';

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireAdminSession();
  const { orderId } = await params;
  const detail = await adminApiServer<OrderDetailContract>(
    `orders/${encodeURIComponent(orderId)}`,
  );
  if (!detail) notFound();
  return (
    <AdminShell session={session} active="orders">
      <OrderDetail initial={detail} csrfToken={session.csrfToken} />
    </AdminShell>
  );
}
