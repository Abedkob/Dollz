'use client';

import React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminOrderRequest, money, type OrderSummary } from '../lib/orders';
import {
  DueDate,
  OrderPriorityCard,
  OrderStatusBadge,
  PaymentStatusBadge,
  orderActionLabel,
} from './order-ui';

interface OrderPage {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
}

const quickFilters = [
  { label: 'All orders', name: '', value: '' },
  { label: 'Needs action', name: 'requiresAction', value: 'true' },
  { label: 'New', name: 'status', value: 'SUBMITTED' },
  { label: 'Payment', name: 'status', value: 'AWAITING_PAYMENT' },
  { label: 'Production', name: 'status', value: 'IN_PRODUCTION' },
  { label: 'Ready', name: 'status', value: 'READY' },
] as const;

const statuses = [
  'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'AWAITING_PAYMENT',
  'PAID', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DELIVERED', 'REJECTED',
  'CANCELLED',
];

function humanize(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

export function OrderList() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<OrderPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const query = params.toString();
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminOrderRequest<OrderPage>(`?${query}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Orders could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => void load(), [load]);

  function replaceParams(next: URLSearchParams) {
    router.replace(`/admin/orders${next.size ? `?${next}` : ''}`, { scroll: false });
  }

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    replaceParams(next);
  }

  function applyQuickFilter(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.delete('status');
    next.delete('requiresAction');
    next.delete('page');
    if (name && value) next.set(name, value);
    replaceParams(next);
  }

  const activeQuickFilter = quickFilters.find((filter) =>
    filter.name
      ? params.get(filter.name) === filter.value
      : !params.get('status') && !params.get('requiresAction'),
  )?.label ?? 'All orders';
  const requiringAction = data?.items.filter((order) => order.requiresAction).slice(0, 4) ?? [];
  const advancedFilterCount = ['paymentStatus', 'from', 'dueBefore', 'sort'].filter(
    (name) => params.has(name) && !(name === 'sort' && params.get(name) === 'newest'),
  ).length;
  const filtered = params.size > 0;

  return (
    <>
      <header className="admin-header orders-header">
        <div>
          <p className="eyebrow">Order management</p>
          <h1>Orders</h1>
          <p className="page-intro">See what needs attention, then move each custom doll forward.</p>
        </div>
        {data ? (
          <div className="orders-result-count" aria-live="polite">
            <strong>{data.total}</strong>
            <span>{data.total === 1 ? 'order' : 'orders'} in this view</span>
          </div>
        ) : null}
      </header>

      <nav className="order-quick-filters" aria-label="Order views">
        {quickFilters.map((filter) => (
          <button
            key={filter.label}
            className={activeQuickFilter === filter.label ? 'active' : ''}
            aria-pressed={activeQuickFilter === filter.label}
            onClick={() => applyQuickFilter(filter.name, filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </nav>

      {requiringAction.length > 0 && !params.has('requiresAction') ? (
        <section className="order-priority" aria-labelledby="priority-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h2 id="priority-heading">Decisions waiting for you</h2>
            </div>
            <button className="text-button" onClick={() => applyQuickFilter('requiresAction', 'true')}>
              View all requiring action
            </button>
          </div>
          <div className="order-priority-grid">
            {requiringAction.map((order) => <OrderPriorityCard order={order} key={order.id} />)}
          </div>
        </section>
      ) : null}

      <section className="orders-toolbar" aria-label="Find orders">
        <label className="orders-search">
          <span className="visually-hidden">Search orders</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            defaultValue={params.get('search') ?? ''}
            onChange={(event) => update('search', event.target.value)}
            placeholder="Search order, customer, email, or phone"
          />
        </label>
        <details className="order-filter-details">
          <summary>All filters{advancedFilterCount ? <span>{advancedFilterCount}</span> : null}</summary>
          <div className="order-advanced-filters">
            <label>Status
              <select value={params.get('status') ?? ''} onChange={(event) => update('status', event.target.value)}>
                <option value="">All statuses</option>
                {statuses.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
              </select>
            </label>
            <label>Payment
              <select value={params.get('paymentStatus') ?? ''} onChange={(event) => update('paymentStatus', event.target.value)}>
                <option value="">All payments</option>
                {['NONE', 'REQUESTED', 'PENDING', 'VERIFIED', 'CANCELLED'].map((status) => (
                  <option key={status} value={status}>{status === 'NONE' ? 'Not requested' : humanize(status)}</option>
                ))}
              </select>
            </label>
            <label>Submitted after
              <input type="date" value={params.get('from')?.slice(0, 10) ?? ''} onChange={(event) => update('from', event.target.value)} />
            </label>
            <label>Due before
              <input type="date" value={params.get('dueBefore')?.slice(0, 10) ?? ''} onChange={(event) => update('dueBefore', event.target.value)} />
            </label>
            <label>Sort
              <select value={params.get('sort') ?? 'newest'} onChange={(event) => update('sort', event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="completion">Completion date</option>
              </select>
            </label>
          </div>
        </details>
        {filtered ? <button className="text-button order-clear-filters" onClick={() => replaceParams(new URLSearchParams())}>Clear filters</button> : null}
      </section>

      {error ? (
        <div className="state-panel error-state" role="alert">
          <h2>Orders could not be loaded</h2>
          <p>{error} Your filters have been kept.</p>
          <button className="secondary-button" onClick={() => void load()}>Try again</button>
        </div>
      ) : loading ? (
        <div className="order-list-skeleton" aria-live="polite">
          <span>Loading orders…</span>
          {[1, 2, 3].map((row) => <i key={row} />)}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="state-panel order-empty-state">
          <span aria-hidden="true">◇</span>
          <h2>{filtered ? 'No orders match this view' : 'No orders yet'}</h2>
          <p>{filtered ? 'Try another view or clear the filters to see every order.' : 'New customer requests will appear here as soon as they are submitted.'}</p>
          {filtered ? <button className="secondary-button" onClick={() => replaceParams(new URLSearchParams())}>Clear filters</button> : null}
        </div>
      ) : data ? (
        <>
          <div className="order-table" role="table" aria-label="Orders">
            <div className="order-row order-table-head" role="row">
              <span>Order & customer</span><span>Next step</span><span>Status</span><span>Payment</span><span>Due</span><span>Total</span><span><span className="visually-hidden">Open</span></span>
            </div>
            {data.items.map((order) => (
              <article className={`order-row${order.requiresAction ? ' requires-action' : ''}`} role="row" key={order.id}>
                <span className="order-identity-cell">
                  <strong>{order.orderNumber}</strong>
                  <small>{order.customerName} · {order.dollCount} {order.dollCount === 1 ? 'doll' : 'dolls'}</small>
                </span>
                <span className="order-next-step"><small>Next step</small><strong>{orderActionLabel(order.status)}</strong></span>
                <span><OrderStatusBadge status={order.status} /></span>
                <span><PaymentStatusBadge status={order.paymentStatus} /></span>
                <span><DueDate value={order.estimatedCompletionDate} /></span>
                <span className="order-total-cell"><strong>{money(order.totalMinor, order.currency)}</strong><small>{order.pricingStatus === 'ESTIMATE' ? 'Estimate' : 'Final'}</small></span>
                <a className="order-open-link" href={`/admin/orders/${order.id}`} aria-label={`${orderActionLabel(order.status)} ${order.orderNumber}`}><span aria-hidden="true">→</span></a>
              </article>
            ))}
          </div>
          <nav className="pagination" aria-label="Order pages">
            <button disabled={data.page <= 1} onClick={() => update('page', String(data.page - 1))}>Previous</button>
            <span>Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
            <button disabled={data.page * data.pageSize >= data.total} onClick={() => update('page', String(data.page + 1))}>Next</button>
          </nav>
        </>
      ) : null}
    </>
  );
}
