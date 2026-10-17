import {
  ArrowRight,
  ImageIcon,
  Package,
  Plus,
  ShoppingBag,
  Store,
} from 'lucide-react';
import { AdminShell } from '../../components/admin-shell';
import type { ProductSummary } from '../../lib/catalog';
import { displayStatus, type OrderSummary } from '../../lib/orders';
import { adminApiServer, requireAdminSession } from '../../lib/server-auth';

interface PageResult<T> {
  items: T[];
  total: number;
}

const terminalOrderStatuses = new Set(['DELIVERED', 'REJECTED', 'CANCELLED']);

function shortDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export default async function AdminPage() {
  const session = await requireAdminSession();
  const [products, orders, attentionOrders, media] = await Promise.all([
    adminApiServer<PageResult<ProductSummary>>('products?pageSize=100'),
    adminApiServer<PageResult<OrderSummary>>('orders?pageSize=100'),
    adminApiServer<PageResult<OrderSummary>>(
      'orders?requiresAction=true&pageSize=4',
    ),
    adminApiServer<PageResult<unknown>>('media?pageSize=1'),
  ]);

  const firstName = (session.admin.fullName || 'Administrator').split(' ')[0];
  const activeProducts =
    products?.items.filter((product) => product.status === 'ACTIVE').length ??
    0;
  const draftProducts =
    products?.items.filter((product) => product.status === 'DRAFT').length ?? 0;
  const openOrders =
    orders?.items.filter((order) => !terminalOrderStatuses.has(order.status))
      .length ?? 0;
  const queue = attentionOrders?.items ?? [];
  const recentProducts = products?.items.slice(0, 4) ?? [];

  return (
    <AdminShell session={session} active="dashboard">
      <header className="dashboard-masthead">
        <div>
          <p className="admin-kicker">Atelier overview</p>
          <h1>Welcome back, {firstName}.</h1>
          <p>
            Start with orders that need a decision, then keep the catalog ready
            for the shop.
          </p>
        </div>
        <div className="dashboard-actions">
          <a
            className="dashboard-action secondary"
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            <Store aria-hidden="true" size={18} />
            View shop
          </a>
          <a
            className="dashboard-action primary"
            href="/admin/products?create=1"
          >
            <Plus aria-hidden="true" size={18} />
            Add product
          </a>
        </div>
      </header>

      <section className="dashboard-ledger" aria-label="Atelier summary">
        <a
          href="/admin/orders?requiresAction=true"
          className="ledger-item priority"
        >
          <span>Needs attention</span>
          <strong>{attentionOrders?.total ?? 0}</strong>
          <small>Orders waiting for a decision</small>
        </a>
        <a href="/admin/orders" className="ledger-item">
          <span>Open orders</span>
          <strong>{openOrders}</strong>
          <small>
            {orders?.total ?? 0}{' '}
            {(orders?.total ?? 0) === 1 ? 'order' : 'orders'} in total
          </small>
        </a>
        <a href="/admin/products?status=ACTIVE" className="ledger-item">
          <span>Live products</span>
          <strong>{activeProducts}</strong>
          <small>{draftProducts} still in draft</small>
        </a>
        <a href="/admin/media" className="ledger-item">
          <span>Media assets</span>
          <strong>{media?.total ?? 0}</strong>
          <small>Ready to use in the catalog</small>
        </a>
      </section>

      <div className="dashboard-workbench">
        <section
          className="dashboard-panel dashboard-priority"
          aria-labelledby="attention-title"
        >
          <div className="dashboard-section-heading">
            <div>
              <p className="admin-kicker">Action queue</p>
              <h2 id="attention-title">Needs your attention</h2>
            </div>
            <a href="/admin/orders?requiresAction=true">
              View all
              <ArrowRight aria-hidden="true" size={16} />
            </a>
          </div>

          {queue.length ? (
            <div className="dashboard-order-list">
              {queue.map((order) => (
                <a
                  className="dashboard-order-row"
                  href={`/admin/orders/${order.id}`}
                  key={order.id}
                >
                  <span className="dashboard-order-customer">
                    <strong>{order.customerName}</strong>
                    <small>
                      {order.orderNumber} · {order.dollCount}{' '}
                      {order.dollCount === 1 ? 'doll' : 'dolls'}
                    </small>
                  </span>
                  <span
                    className={`dashboard-status status-${order.status.toLowerCase()}`}
                  >
                    {displayStatus(order.status)}
                  </span>
                  <time dateTime={order.submittedAt}>
                    {shortDate(order.submittedAt)}
                  </time>
                  <ArrowRight
                    className="dashboard-row-arrow"
                    aria-hidden="true"
                    size={17}
                  />
                </a>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>The queue is clear.</strong>
                <p>New requests and customer decisions will appear here.</p>
              </div>
            </div>
          )}
        </section>

        <aside
          className="dashboard-panel dashboard-catalog"
          aria-labelledby="catalog-title"
        >
          <div className="dashboard-section-heading">
            <div>
              <p className="admin-kicker">Catalog pulse</p>
              <h2 id="catalog-title">Shop readiness</h2>
            </div>
            <a href="/admin/products" aria-label="Open all products">
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </div>
          <div className="catalog-ratio">
            <div>
              <strong>{activeProducts}</strong>
              <span>live</span>
            </div>
            <div>
              <strong>{draftProducts}</strong>
              <span>draft</span>
            </div>
          </div>
          <div
            className="catalog-progress"
            role="progressbar"
            aria-label="Published catalog share"
            aria-valuemin={0}
            aria-valuemax={Math.max(products?.total ?? 0, 1)}
            aria-valuenow={activeProducts}
          >
            <span
              style={{
                width: `${products?.total ? (activeProducts / products.total) * 100 : 0}%`,
              }}
            />
          </div>
          <p>
            {draftProducts
              ? `${draftProducts} ${draftProducts === 1 ? 'design is' : 'designs are'} still being prepared.`
              : 'Every catalog design is ready for the shop.'}
          </p>
          <a className="catalog-link" href="/admin/products?status=DRAFT">
            Review draft products
            <ArrowRight aria-hidden="true" size={16} />
          </a>
        </aside>
      </div>

      <section
        className="dashboard-recent"
        aria-labelledby="recent-products-title"
      >
        <div className="dashboard-section-heading">
          <div>
            <p className="admin-kicker">Recently updated</p>
            <h2 id="recent-products-title">Product workbench</h2>
          </div>
          <a href="/admin/products">
            Manage products
            <ArrowRight aria-hidden="true" size={16} />
          </a>
        </div>

        {recentProducts.length ? (
          <div className="dashboard-product-list">
            {recentProducts.map((product) => (
              <a
                className="dashboard-product-row"
                href={`/admin/products?edit=${product.id}`}
                key={product.id}
              >
                <span className="dashboard-product-thumb">
                  {product.primaryThumbnailUrl ? (
                    <img src={product.primaryThumbnailUrl} alt="" />
                  ) : (
                    <Package aria-hidden="true" size={20} />
                  )}
                </span>
                <span className="dashboard-product-name">
                  <strong>{product.name}</strong>
                  <small>{product.activeVariantCount} active sizes</small>
                </span>
                <span
                  className={`dashboard-product-status product-${product.status.toLowerCase()}`}
                >
                  {displayStatus(product.status)}
                </span>
                <time dateTime={product.updatedAt}>
                  {shortDate(product.updatedAt)}
                </time>
                <ArrowRight aria-hidden="true" size={16} />
              </a>
            ))}
          </div>
        ) : (
          <div className="dashboard-first-product">
            <Package aria-hidden="true" size={24} />
            <div>
              <strong>Build your first product.</strong>
              <p>Add a doll design, its available sizes, and shop imagery.</p>
            </div>
            <a href="/admin/products?create=1">Add product</a>
          </div>
        )}
      </section>

      <nav className="dashboard-shortcuts" aria-label="Workspace shortcuts">
        <a href="/admin/orders">
          <ShoppingBag aria-hidden="true" size={19} />
          <span>
            <strong>Orders</strong>
            <small>Move requests through production</small>
          </span>
          <ArrowRight aria-hidden="true" size={16} />
        </a>
        <a href="/admin/products">
          <Package aria-hidden="true" size={19} />
          <span>
            <strong>Products</strong>
            <small>Build and publish doll designs</small>
          </span>
          <ArrowRight aria-hidden="true" size={16} />
        </a>
        <a href="/admin/media">
          <ImageIcon aria-hidden="true" size={19} />
          <span>
            <strong>Media</strong>
            <small>Organize product photography</small>
          </span>
          <ArrowRight aria-hidden="true" size={16} />
        </a>
      </nav>
    </AdminShell>
  );
}
