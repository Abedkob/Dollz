import React from 'react';
import {
  displayStatus,
  type OrderStatus,
  type OrderSummary,
} from '../lib/orders';

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  SUBMITTED: 'Review request',
  UNDER_REVIEW: 'Finish review',
  CHANGES_REQUESTED: 'Waiting for changes',
  AWAITING_PAYMENT: 'Verify payment',
  PAID: 'Start production',
  IN_PRODUCTION: 'Mark ready',
  READY: 'Arrange delivery',
  SHIPPED: 'Confirm delivery',
};

const STATUS_GROUPS: Record<OrderStatus, string> = {
  SUBMITTED: 'review',
  UNDER_REVIEW: 'review',
  CHANGES_REQUESTED: 'waiting',
  AWAITING_PAYMENT: 'payment',
  PAID: 'production',
  IN_PRODUCTION: 'production',
  READY: 'delivery',
  SHIPPED: 'delivery',
  DELIVERED: 'complete',
  REJECTED: 'closed',
  CANCELLED: 'closed',
};

export function orderActionLabel(status: OrderStatus) {
  return ACTION_LABELS[status] ?? 'View order';
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`order-status order-status-${STATUS_GROUPS[status]}`}>
      <span aria-hidden="true" />
      {displayStatus(status)}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const tone =
    status === 'VERIFIED'
      ? 'complete'
      : ['REQUESTED', 'PENDING'].includes(status)
        ? 'waiting'
        : status === 'CANCELLED'
          ? 'closed'
          : 'neutral';
  return (
    <span className={`payment-status payment-status-${tone}`}>
      {status === 'NONE' ? 'Not requested' : displayStatus(status)}
    </span>
  );
}

export function DueDate({ value }: { value: string | null }) {
  if (!value) return <span className="order-muted">Not scheduled</span>;
  const due = new Date(`${value.slice(0, 10)}T23:59:59`);
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  const risk = days < 0 ? 'late' : days <= 7 ? 'soon' : 'normal';
  return (
    <span className={`order-due order-due-${risk}`}>
      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(due)}
      {days < 0 ? <small>{Math.abs(days)}d overdue</small> : null}
    </span>
  );
}

export function OrderPriorityCard({ order }: { order: OrderSummary }) {
  return (
    <a className="order-priority-card" href={`/admin/orders/${order.id}`}>
      <span className="order-priority-action">
        <span aria-hidden="true">●</span>
        {orderActionLabel(order.status)}
      </span>
      <strong>{order.orderNumber}</strong>
      <span className="order-priority-customer">{order.customerName}</span>
      <span className="order-priority-footer">
        <OrderStatusBadge status={order.status} />
        <span aria-hidden="true">→</span>
      </span>
    </a>
  );
}

const lifecycle = [
  { key: 'request', label: 'Request', statuses: ['SUBMITTED'] },
  { key: 'review', label: 'Review', statuses: ['UNDER_REVIEW', 'CHANGES_REQUESTED'] },
  { key: 'payment', label: 'Payment', statuses: ['AWAITING_PAYMENT', 'PAID'] },
  { key: 'making', label: 'Making', statuses: ['IN_PRODUCTION', 'READY'] },
  { key: 'delivery', label: 'Delivery', statuses: ['SHIPPED', 'DELIVERED'] },
] as const;

export function OrderLifecycle({ status }: { status: OrderStatus }) {
  const closed = ['REJECTED', 'CANCELLED'].includes(status);
  const currentIndex = closed
    ? -1
    : lifecycle.findIndex((stage) => (stage.statuses as readonly string[]).includes(status));
  return (
    <ol className={`atelier-lifecycle${closed ? ' is-closed' : ''}`} aria-label="Order progress">
      {lifecycle.map((stage, index) => {
        const state = closed ? 'upcoming' : index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';
        return (
          <li className={state} key={stage.key} aria-current={state === 'current' ? 'step' : undefined}>
            <span aria-hidden="true">{state === 'complete' ? '✓' : index + 1}</span>
            <strong>{stage.label}</strong>
          </li>
        );
      })}
      {closed ? <li className="exception" aria-current="step"><span aria-hidden="true">!</span><strong>{displayStatus(status)}</strong></li> : null}
    </ol>
  );
}
