'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Filter,
  Hammer,
  Inbox,
  PackageCheck,
  RotateCcw,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { adminOrderRequest, money, type OrderSummary } from '../lib/orders';
import {
  DueDate,
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

const quickFilters: ReadonlyArray<{
  label: string;
  name: string;
  value: string;
  icon: LucideIcon;
}> = [
  { label: 'All orders', name: '', value: '', icon: ClipboardList },
  {
    label: 'Needs action',
    name: 'requiresAction',
    value: 'true',
    icon: AlertCircle,
  },
  { label: 'New', name: 'status', value: 'SUBMITTED', icon: Inbox },
  {
    label: 'Payment',
    name: 'status',
    value: 'AWAITING_PAYMENT',
    icon: Banknote,
  },
  { label: 'Production', name: 'status', value: 'IN_PRODUCTION', icon: Hammer },
  { label: 'Ready', name: 'status', value: 'READY', icon: PackageCheck },
];

const statuses = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'AWAITING_PAYMENT',
  'PAID',
  'IN_PRODUCTION',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
];

function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (c) => c.toUpperCase());
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
      setError(
        reason instanceof Error
          ? reason.message
          : 'Orders could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [query]);
  useEffect(() => void load(), [load]);

  function replaceParams(next: URLSearchParams) {
    router.replace(`/admin/orders${next.size ? `?${next}` : ''}`, {
      scroll: false,
    });
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

  const activeQuickFilter =
    quickFilters.find((filter) =>
      filter.name
        ? params.get(filter.name) === filter.value
        : !params.get('status') && !params.get('requiresAction'),
    )?.label ?? 'All orders';
  const requiringAction =
    data?.items.filter((order) => order.requiresAction).slice(0, 4) ?? [];
  const advancedFilterCount = [
    'paymentStatus',
    'from',
    'dueBefore',
    'sort',
  ].filter(
    (name) =>
      params.has(name) && !(name === 'sort' && params.get(name) === 'newest'),
  ).length;
  const filtered = Array.from(params.keys()).some((name) => name !== 'page');
  const activeFilterTags = [
    params.get('search')
      ? { name: 'search', label: `Search: ${params.get('search')}` }
      : null,
    params.get('paymentStatus')
      ? {
          name: 'paymentStatus',
          label: `Payment: ${humanize(params.get('paymentStatus')!)}`,
        }
      : null,
    params.get('from')
      ? { name: 'from', label: `Submitted after ${params.get('from')}` }
      : null,
    params.get('dueBefore')
      ? { name: 'dueBefore', label: `Due before ${params.get('dueBefore')}` }
      : null,
    params.get('sort') && params.get('sort') !== 'newest'
      ? { name: 'sort', label: `Sort: ${humanize(params.get('sort')!)}` }
      : null,
  ].filter((tag): tag is { name: string; label: string } => Boolean(tag));

  return (
    <>
      <header className="orders-masthead">
        <div>
          <p className="admin-kicker">Order dispatch</p>
          <h1>Orders</h1>
          <p>
            Keep every custom doll moving—from first review to final delivery.
          </p>
        </div>
        {data ? (
          <div className="orders-result-count" aria-live="polite">
            <strong>{data.total}</strong>
            <span>{data.total === 1 ? 'order' : 'orders'} in this queue</span>
          </div>
        ) : null}
      </header>

      <nav className="order-quick-filters" aria-label="Order views">
        {quickFilters.map((filter) => {
          const Icon = filter.icon;
          return (
            <button
              key={filter.label}
              className={activeQuickFilter === filter.label ? 'active' : ''}
              aria-pressed={activeQuickFilter === filter.label}
              onClick={() => applyQuickFilter(filter.name, filter.value)}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              {filter.label}
            </button>
          );
        })}
      </nav>

      {requiringAction.length > 0 && !params.has('requiresAction') ? (
        <section
          className="order-attention-board"
          aria-labelledby="priority-heading"
        >
          <div className="order-attention-heading">
            <div>
              <span className="order-attention-icon" aria-hidden="true">
                <AlertCircle size={18} />
              </span>
              <span>
                <span className="order-attention-label">Needs attention</span>
                <strong id="priority-heading">Decisions waiting for you</strong>
              </span>
            </div>
            <button onClick={() => applyQuickFilter('requiresAction', 'true')}>
              View queue <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="order-attention-list">
            {requiringAction.map((order) => (
              <a href={`/admin/orders/${order.id}`} key={order.id}>
                <CircleDot size={15} aria-hidden="true" />
                <span>
                  <strong>{orderActionLabel(order.status)}</strong>
                  <small>
                    {order.orderNumber} · {order.customerName}
                  </small>
                </span>
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="orders-commandbar" aria-label="Find orders">
        <div className="orders-toolbar">
          <label className="orders-search">
            <span className="visually-hidden">Search orders</span>
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input
              type="search"
              defaultValue={params.get('search') ?? ''}
              onChange={(event) => update('search', event.target.value)}
              placeholder="Search order, customer, email, or phone"
            />
          </label>
          <details className="order-filter-details">
            <summary>
              <Filter size={16} strokeWidth={1.8} aria-hidden="true" />
              Filters
              {advancedFilterCount ? <span>{advancedFilterCount}</span> : null}
            </summary>
            <div className="order-advanced-filters">
              <div className="order-filter-heading">
                <div>
                  <span>Refine queue</span>
                  <strong>Filter orders</strong>
                </div>
                <div className="order-filter-heading-actions">
                  {filtered ? (
                    <button
                      onClick={() => replaceParams(new URLSearchParams())}
                    >
                      Reset all
                    </button>
                  ) : null}
                  <button
                    className="order-filter-close"
                    type="button"
                    aria-label="Close filters"
                    onClick={(event) =>
                      event.currentTarget
                        .closest('details')
                        ?.removeAttribute('open')
                    }
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <label>
                Status
                <select
                  value={params.get('status') ?? ''}
                  onChange={(event) => update('status', event.target.value)}
                >
                  <option value="">All statuses</option>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {humanize(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Payment
                <select
                  value={params.get('paymentStatus') ?? ''}
                  onChange={(event) =>
                    update('paymentStatus', event.target.value)
                  }
                >
                  <option value="">All payments</option>
                  {[
                    'NONE',
                    'REQUESTED',
                    'PENDING',
                    'VERIFIED',
                    'CANCELLED',
                  ].map((status) => (
                    <option key={status} value={status}>
                      {status === 'NONE' ? 'Not requested' : humanize(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Submitted after
                <input
                  type="date"
                  value={params.get('from')?.slice(0, 10) ?? ''}
                  onChange={(event) => update('from', event.target.value)}
                />
              </label>
              <label>
                Due before
                <input
                  type="date"
                  value={params.get('dueBefore')?.slice(0, 10) ?? ''}
                  onChange={(event) => update('dueBefore', event.target.value)}
                />
              </label>
              <label className="order-sort-filter">
                Sort
                <select
                  value={params.get('sort') ?? 'newest'}
                  onChange={(event) => update('sort', event.target.value)}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="completion">Completion date</option>
                </select>
              </label>
            </div>
          </details>
          {filtered ? (
            <button
              className="order-clear-filters"
              onClick={() => replaceParams(new URLSearchParams())}
            >
              <RotateCcw size={15} aria-hidden="true" /> Clear
            </button>
          ) : null}
        </div>
        {activeFilterTags.length > 0 ? (
          <div className="order-active-filters" aria-label="Active filters">
            {activeFilterTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => update(tag.name, '')}
                aria-label={`Remove ${tag.label}`}
              >
                {tag.label} <X size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="state-panel error-state" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <h2>Orders could not be loaded</h2>
          <p>{error} Your filters have been kept.</p>
          <button className="secondary-button" onClick={() => void load()}>
            <RotateCcw size={15} aria-hidden="true" /> Try again
          </button>
        </div>
      ) : loading ? (
        <div className="order-list-skeleton" aria-live="polite">
          <span>
            <CircleDot size={14} aria-hidden="true" /> Loading order queue…
          </span>
          {[1, 2, 3].map((row) => (
            <i key={row} />
          ))}
        </div>
      ) : data?.items.length === 0 ? (
        <div className="state-panel order-empty-state">
          <span aria-hidden="true">
            {filtered ? <Search size={22} /> : <CheckCircle2 size={22} />}
          </span>
          <h2>{filtered ? 'No orders match this view' : 'No orders yet'}</h2>
          <p>
            {filtered
              ? 'Try another view or clear the filters to see every order.'
              : 'New customer requests will appear here as soon as they are submitted.'}
          </p>
          {filtered ? (
            <button
              className="secondary-button"
              onClick={() => replaceParams(new URLSearchParams())}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : data ? (
        <>
          <div className="order-table" role="list" aria-label="Orders">
            <div className="order-row order-table-head" aria-hidden="true">
              <span>Order & customer</span>
              <span>Next step</span>
              <span>Status</span>
              <span>Payment</span>
              <span>Due</span>
              <span>Total</span>
              <span>
                <span className="visually-hidden">Open</span>
              </span>
            </div>
            {data.items.map((order) => (
              <article
                className="order-row-item"
                role="listitem"
                key={order.id}
              >
                <a
                  className={`order-row${order.requiresAction ? ' requires-action' : ''}`}
                  href={`/admin/orders/${order.id}`}
                  aria-label={`${orderActionLabel(order.status)} ${order.orderNumber}`}
                >
                  <span className="order-identity-cell">
                    <strong>{order.orderNumber}</strong>
                    <small>
                      {order.customerName} · {order.dollCount}{' '}
                      {order.dollCount === 1 ? 'doll' : 'dolls'}
                    </small>
                  </span>
                  <span className="order-next-step">
                    <small>Next step</small>
                    <strong>{orderActionLabel(order.status)}</strong>
                  </span>
                  <span>
                    <OrderStatusBadge status={order.status} />
                  </span>
                  <span>
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </span>
                  <span>
                    <DueDate value={order.estimatedCompletionDate} />
                  </span>
                  <span className="order-total-cell">
                    <strong>{money(order.totalMinor, order.currency)}</strong>
                    <small>
                      {order.pricingStatus === 'ESTIMATE'
                        ? 'Estimate'
                        : 'Final'}
                    </small>
                  </span>
                  <span className="order-open-link" aria-hidden="true">
                    <ArrowRight size={17} />
                  </span>
                </a>
              </article>
            ))}
          </div>
          <nav className="pagination" aria-label="Order pages">
            <button
              disabled={data.page <= 1}
              onClick={() => update('page', String(data.page - 1))}
            >
              <ChevronLeft size={15} aria-hidden="true" /> Previous
            </button>
            <span>
              Page {data.page} of{' '}
              {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            <button
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => update('page', String(data.page + 1))}
            >
              Next <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        </>
      ) : null}
    </>
  );
}
