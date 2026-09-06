import { notFound } from 'next/navigation';
import { AdminShell } from '../../../../components/admin-shell';
import { ProductEditor } from '../../../../components/product-editor';
import type { ProductDetails } from '../../../../lib/catalog';
import {
  adminApiServer,
  requireAdminSession,
} from '../../../../lib/server-auth';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const session = await requireAdminSession();
  const { productId } = await params;
  const details = await adminApiServer<ProductDetails>(
    `products/${encodeURIComponent(productId)}`,
  );
  if (!details) notFound();
  return (
    <AdminShell session={session} active="products">
      <ProductEditor csrfToken={session.csrfToken} initial={details} />
    </AdminShell>
  );
}
