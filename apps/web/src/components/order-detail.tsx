'use client';

import React from 'react';
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  adminOrderRequest,
  displayStatus,
  money,
  type OrderDetail as OrderDetailContract,
} from '../lib/orders';
import {
  DueDate,
  OrderLifecycle,
  OrderStatusBadge,
  PaymentStatusBadge,
} from './order-ui';
import { AdminModal } from './admin-modal';

function OrderModal({
  title,
  intro,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  intro: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AdminModal
      eyebrow="Order action"
      title={title}
      intro={intro}
      onClose={onClose}
      wide={wide}
    >
      {children}
    </AdminModal>
  );
}

interface PendingMutation {
  path: string;
  payload: object;
  consequence: string;
  onSuccess?: () => void;
}

export function OrderDetail({
  initial,
  csrfToken,
}: {
  initial: OrderDetailContract;
  csrfToken: string;
}) {
  const [detail, setDetail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingMutation | null>(null);
  const [reviewMode, setReviewMode] = useState<'approve' | 'changes' | null>(
    null,
  );
  const [communication, setCommunication] = useState<'customer' | 'internal'>(
    'customer',
  );
  const [regenerate, setRegenerate] = useState<
    { step: 'confirm' } | { step: 'result'; link: string } | null
  >(null);
  const [copied, setCopied] = useState(false);
  const order = detail.order;
  const version = order.version!;

  async function reload() {
    setDetail(await adminOrderRequest<OrderDetailContract>(order.id!));
  }
  function mutate(
    path: string,
    payload: object,
    consequence: string,
    onSuccess?: () => void,
  ) {
    setPending({ path, payload, consequence, onSuccess });
  }
  async function confirmMutation() {
    if (!pending) return;
    const action = pending;
    setBusy(true);
    setError('');
    try {
      await adminOrderRequest(
        `${order.id}/${action.path}`,
        {
          method: 'POST',
          body: JSON.stringify(action.payload),
        },
        csrfToken,
      );
      await reload();
      action.onSuccess?.();
      setPending(null);
    } catch (reason) {
      const failure = reason as Error & { code?: string };
      setError(
        failure.code === 'ORDER_VERSION_CONFLICT'
          ? 'This order changed elsewhere. Reloading the latest version…'
          : failure.message,
      );
      if (failure.code === 'ORDER_VERSION_CONFLICT') await reload();
      setPending(null);
    } finally {
      setBusy(false);
    }
  }
  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutate(
      'approve',
      {
        expectedVersion: version,
        items: detail.items.map((item) => ({
          orderItemId: item.id,
          finalUnitPriceMinor: Number(form.get(`price-${item.id}`)),
        })),
        deliveryFeeMinor: Number(form.get('deliveryFeeMinor')),
        estimatedCompletionDate: String(form.get('estimatedCompletionDate')),
        paymentMethod: 'MANUAL',
        paymentInstructions: String(form.get('paymentInstructions')),
        messageToCustomer: String(form.get('messageToCustomer')),
      },
      'Approve this configuration and lock the final quotation? A payment request will be created.',
      () => setReviewMode(null),
    );
  }
  async function message(event: FormEvent<HTMLFormElement>, internal: boolean) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    mutate(
      internal ? 'internal-notes' : 'messages',
      { expectedVersion: version, message: String(body.get('message')) },
      internal
        ? 'Save this private note for administrators only?'
        : 'Send this message to the customer?',
      () => form.reset(),
    );
  }
  async function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const container = event.currentTarget;
    const form = new FormData(container);
    const reason = String(form.get('reason') ?? '').trim();
    if (!reason) {
      setError('Add a customer-visible reason before rejecting this order.');
      container.querySelector<HTMLTextAreaElement>('[name="reason"]')?.focus();
      return;
    }
    mutate(
      'reject',
      {
        expectedVersion: version,
        reason,
        internalReason: String(form.get('internalReason') ?? ''),
      },
      'Reject this order permanently? Payment requests will be cancelled and the customer will be notified.',
    );
  }
  async function cancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const container = event.currentTarget;
    const form = new FormData(container);
    const reason = String(form.get('reason') ?? '').trim();
    if (!reason) {
      setError('Add a reason before cancelling this order.');
      container.querySelector<HTMLTextAreaElement>('[name="reason"]')?.focus();
      return;
    }
    const exceptional = form.get('exceptional') === 'on';
    const auditReason = String(form.get('auditReason') ?? '').trim();
    const requiresExceptional = ['PAID', 'IN_PRODUCTION', 'READY', 'SHIPPED'].includes(
      order.status,
    );
    if (requiresExceptional && (!exceptional || !auditReason)) {
      setError(
        'Confirm the exceptional cancellation and explain why before continuing.',
      );
      return;
    }
    mutate(
      'cancel',
      {
        expectedVersion: version,
        reason,
        customerVisible: form.get('customerVisible') === 'on',
        exceptional,
        auditReason,
      },
      'Cancel this order? Payment history will be preserved and no refund will be created automatically.',
    );
  }
  async function regenerateAccess() {
    setBusy(true);
    setError('');
    try {
      const result = await adminOrderRequest<{
        trackingLink: string;
        version: number;
      }>(
        `${order.id}/access/regenerate`,
        { method: 'POST', body: JSON.stringify({ expectedVersion: version }) },
        csrfToken,
      );
      setRegenerate({ step: 'result', link: result.trackingLink });
      // The link is already generated and shown; a refresh failure here just
      // leaves the page on a stale version until the next successful reload,
      // it must not hide the one-time link the admin still needs to copy.
      await reload().catch(() => {});
    } catch (reason) {
      const failure = reason as Error & { code?: string };
      setError(
        failure.code === 'ORDER_VERSION_CONFLICT'
          ? 'This order changed elsewhere. Reloading the latest version…'
          : failure.message,
      );
      if (failure.code === 'ORDER_VERSION_CONFLICT') await reload();
      setRegenerate(null);
    } finally {
      setBusy(false);
    }
  }
  async function copyTrackingLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  async function saveShipping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    mutate(
      'shipping',
      {
        expectedVersion: version,
        shippingMethod: String(form.get('shippingMethod')),
        trackingReference: String(form.get('trackingReference') ?? '') || null,
        trackingUrl: String(form.get('trackingUrl') ?? '') || null,
      },
      'Save these delivery details? They become visible on customer tracking.',
    );
  }
  const payment = detail.payments[0];
  const action = (() => {
    if (order.status === 'SUBMITTED')
      return (
        <button
          className="primary-button"
          disabled={busy}
          onClick={() =>
            void mutate(
              'start-review',
              { expectedVersion: version },
              'Start reviewing this order? The customer will see that review has begun.',
            )
          }
        >
          Start review
        </button>
      );
    if (order.status === 'UNDER_REVIEW')
      return (
        <div className="order-action-row">
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => setReviewMode('approve')}
          >
            Prepare quotation
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() => setReviewMode('changes')}
          >
            Request changes
          </button>
        </div>
      );
    if (order.status === 'PAID')
      return (
        <button
          className="primary-button"
          disabled={busy}
          onClick={() =>
            void mutate(
              'status',
              { expectedVersion: version, action: 'START_PRODUCTION' },
              'Start production now? This will notify the customer.',
            )
          }
        >
          Start production
        </button>
      );
    if (order.status === 'IN_PRODUCTION')
      return (
        <button
          className="primary-button"
          disabled={busy}
          onClick={() =>
            void mutate(
              'status',
              { expectedVersion: version, action: 'MARK_READY' },
              'Mark this order ready and notify the customer?',
            )
          }
        >
          Mark ready
        </button>
      );
    if (order.status === 'READY')
      return (
        <div className="order-action-row">
          <button
            className="primary-button"
            disabled={busy}
            onClick={() =>
              void mutate(
                'status',
                {
                  expectedVersion: version,
                  action: 'MARK_SHIPPED',
                  shippingMethod: 'DELIVERY',
                },
                'Mark this order shipped? Add tracking in Shipping first when available.',
              )
            }
          >
            Mark shipped
          </button>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              void mutate(
                'status',
                { expectedVersion: version, action: 'MARK_DELIVERED' },
                'Confirm that this pickup order was delivered?',
              )
            }
          >
            Delivered at pickup
          </button>
        </div>
      );
    if (order.status === 'SHIPPED')
      return (
        <button
          className="primary-button"
          disabled={busy}
          onClick={() =>
            void mutate(
              'status',
              { expectedVersion: version, action: 'MARK_DELIVERED' },
              'Confirm delivery? This closes the order lifecycle.',
            )
          }
        >
          Mark delivered
        </button>
      );
    return null;
  })();

  const dollCount = detail.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="atelier-order-page">
      <header className="atelier-order-masthead">
        <a className="atelier-back" href="/admin/orders">
          <span aria-hidden="true">←</span> Orders
        </a>
        <div className="atelier-title-row">
          <div>
            <p className="eyebrow">
              Custom order · {dollCount} {dollCount === 1 ? 'doll' : 'dolls'}
            </p>
            <h1>{order.orderNumber}</h1>
            <p>
              <strong>{order.customerName}</strong>
              <span>
                Submitted{' '}
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                }).format(new Date(order.submittedAt))}
              </span>
            </p>
          </div>
          <div className="atelier-masthead-status">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={payment?.status ?? 'NONE'} />
          </div>
        </div>
      </header>
      <OrderLifecycle status={order.status} />
      {error && (
        <div className="form-summary atelier-order-error" role="alert">
          <h2>Order not updated</h2>
          <p>{error}</p>
        </div>
      )}
      <div className="atelier-workbench">
        <main className="atelier-main-column">
          <section className="atelier-specification">
            <div className="atelier-section-heading">
              <div>
                <p className="eyebrow">Commission specification</p>
                <h2>The requested dolls</h2>
                <p>
                  Every selected detail, gathered into one atelier-ready brief.
                </p>
              </div>
              <span>{String(dollCount).padStart(2, '0')}</span>
            </div>
            <div className="atelier-doll-list">
              {detail.items.map((item, index) => (
                <article className="atelier-doll-sheet" key={item.id}>
                  <div className="atelier-doll-visual" aria-hidden="true">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div className="atelier-doll-silhouette">
                      <i />
                      <b />
                    </div>
                    <small>{item.variantSize ?? item.variantName}</small>
                  </div>
                  <div className="atelier-doll-brief">
                    <header>
                      <div>
                        <p>
                          Doll {index + 1} · Quantity {item.quantity}
                        </p>
                        <h3>{item.productName}</h3>
                        <span>
                          {item.variantName}
                          {item.variantSize ? ` · ${item.variantSize}` : ''}
                        </span>
                      </div>
                      <strong>
                        {money(
                          item.finalTotalMinor ?? item.estimatedTotalMinor,
                          item.currency,
                        )}
                      </strong>
                    </header>
                    <dl>
                      {item.selections.map((selection) => (
                        <div key={selection.optionCode}>
                          <dt>{selection.optionName}</dt>
                          <dd>
                            {selection.colorHex ? (
                              <span
                                className="atelier-swatch"
                                style={{ background: selection.colorHex }}
                                aria-label={`Color ${selection.colorHex}`}
                              />
                            ) : null}
                            <strong>{selection.valueLabel}</strong>
                            {selection.affects3d ? (
                              <small>3D preview</small>
                            ) : null}
                          </dd>
                        </div>
                      ))}
                      {item.selections.length === 0 ? (
                        <div>
                          <dt>Customization</dt>
                          <dd>
                            <strong>Standard configuration</strong>
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {item.customerRequest ? (
                      <blockquote>
                        <span>Customer note</span>
                        <p>“{item.customerRequest}”</p>
                      </blockquote>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="editor-panel order-communication-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Communication</p>
                <h2>
                  {communication === 'customer'
                    ? 'Customer conversation'
                    : 'Internal notes'}
                </h2>
              </div>
              <div
                className="order-segmented-control"
                role="tablist"
                aria-label="Communication type"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={communication === 'customer'}
                  className={communication === 'customer' ? 'active' : ''}
                  onClick={() => setCommunication('customer')}
                >
                  Customer
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={communication === 'internal'}
                  className={communication === 'internal' ? 'active' : ''}
                  onClick={() => setCommunication('internal')}
                >
                  Private notes
                </button>
              </div>
            </div>
            {communication === 'customer' ? (
              <div role="tabpanel">
                <div className="message-list">
                  {detail.messages
                    .filter((entry) => !entry.isInternal)
                    .map((entry) => (
                      <article key={entry.id}>
                        <strong>
                          {entry.senderType === 'ADMIN' ? 'Dollz' : 'Customer'}
                        </strong>
                        <p>{entry.message}</p>
                        <time>
                          {new Date(entry.createdAt).toLocaleString()}
                        </time>
                      </article>
                    ))}
                </div>
                <form
                  className="message-form"
                  onSubmit={(event) => void message(event, false)}
                >
                  <label>
                    Message
                    <textarea
                      name="message"
                      rows={3}
                      required
                      maxLength={4000}
                    />
                  </label>
                  <button className="secondary-button" disabled={busy}>
                    Send to customer
                  </button>
                </form>
              </div>
            ) : (
              <div role="tabpanel">
                <div className="message-list">
                  {detail.messages
                    .filter((entry) => entry.isInternal)
                    .map((entry) => (
                      <article key={entry.id}>
                        <strong>Admin note</strong>
                        <p>{entry.message}</p>
                        <time>
                          {new Date(entry.createdAt).toLocaleString()}
                        </time>
                      </article>
                    ))}
                </div>
                <form
                  className="message-form"
                  onSubmit={(event) => void message(event, true)}
                >
                  <label>
                    Private note
                    <textarea
                      name="message"
                      rows={3}
                      required
                      maxLength={4000}
                    />
                  </label>
                  <button className="secondary-button" disabled={busy}>
                    Save internal note
                  </button>
                </form>
              </div>
            )}
          </section>

          <details className="order-section order-history-panel">
            <summary>
              <span>
                <span className="eyebrow">Timeline</span>
                <strong>Order history</strong>
              </span>
              <span>
                {detail.history.length}{' '}
                {detail.history.length === 1 ? 'event' : 'events'}
              </span>
            </summary>
            <ol className="order-timeline">
              {detail.history.map((entry) => (
                <li key={entry.id}>
                  <span />
                  <div>
                    <strong>{displayStatus(entry.newStatus)}</strong>
                    <p>{entry.message}</p>
                    <time>{new Date(entry.createdAt).toLocaleString()}</time>
                    {entry.internalNotes ? (
                      <small>Internal: {entry.internalNotes}</small>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </details>
        </main>

        <aside className="atelier-order-rail">
          {action ? (
            <section className="atelier-action-center">
              <div>
                <p className="eyebrow">Atelier action</p>
                <h2>
                  {order.status === 'SUBMITTED'
                    ? 'Review the customer request'
                    : displayStatus(order.status)}
                </h2>
                <p>Complete this step to move the commission forward.</p>
              </div>
              {action}
            </section>
          ) : null}
          <section className="atelier-rail-panel atelier-quotation">
            <div className="atelier-rail-heading">
              <p className="eyebrow">
                {order.pricingStatus === 'FINAL'
                  ? 'Final quotation'
                  : 'Current estimate'}
              </p>
              <strong>
                {money(
                  order.finalTotalMinor ?? order.estimatedSubtotalMinor,
                  order.currency,
                )}
              </strong>
            </div>
            <dl className="price-summary">
              <div>
                <dt>Subtotal</dt>
                <dd>
                  {money(
                    order.finalSubtotalMinor ?? order.estimatedSubtotalMinor,
                    order.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{money(order.deliveryFeeMinor, order.currency)}</dd>
              </div>
            </dl>
            <div className="atelier-due-row">
              <span>Target completion</span>
              <DueDate value={order.estimatedCompletionDate} />
            </div>
          </section>

          <section className="atelier-rail-panel">
            <div className="atelier-rail-heading">
              <p className="eyebrow">Customer & delivery</p>
              <strong>{order.customerName}</strong>
            </div>
            <dl className="atelier-contact-list">
              <div>
                <dt>Email</dt>
                <dd>{order.customerEmail}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{order.customerPhone || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>
                  {order.delivery.addressLine1}, {order.delivery.city},{' '}
                  {order.delivery.countryCode}
                </dd>
              </div>
            </dl>
            {order.customerNotes ? (
              <blockquote className="atelier-customer-note">
                {order.customerNotes}
              </blockquote>
            ) : null}
            <div className="atelier-contact-list-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => setRegenerate({ step: 'confirm' })}
              >
                Regenerate tracking link
              </button>
            </div>
          </section>
        </aside>
      </div>

      {order.status === 'UNDER_REVIEW' && reviewMode === 'approve' && (
        <OrderModal
          title="Prepare final quotation"
          intro="Confirm the price, completion date, and message before requesting payment."
          onClose={() => setReviewMode(null)}
          wide
        >
          <form
            className="compact-form order-quotation-form"
            onSubmit={approve}
          >
            <div className="order-form-section-heading">
              <span>1</span>
              <div>
                <strong>Pricing and timing</strong>
                <small>
                  Amounts are entered in the smallest currency unit.
                </small>
              </div>
            </div>
            {detail.items.map((item) => (
              <label key={item.id}>
                {item.productName} · final unit price
                <input
                  name={`price-${item.id}`}
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={item.estimatedUnitPriceMinor}
                />
              </label>
            ))}
            <label>
              Delivery fee
              <input
                name="deliveryFeeMinor"
                type="number"
                min="0"
                step="1"
                required
                defaultValue="0"
              />
            </label>
            <label>
              Completion date
              <input name="estimatedCompletionDate" type="date" required />
            </label>
            <div className="order-form-section-heading order-form-span">
              <span>2</span>
              <div>
                <strong>Customer message</strong>
                <small>This will be included with the payment request.</small>
              </div>
            </div>
            <label>
              Payment instructions
              <textarea name="paymentInstructions" rows={3} required />
            </label>
            <label>
              Message to customer
              <textarea
                name="messageToCustomer"
                rows={3}
                required
                defaultValue="Your design is ready for approval."
              />
            </label>
            <div className="order-modal-actions order-form-span">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReviewMode(null)}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={busy}>
                Review & request payment
              </button>
            </div>
          </form>
        </OrderModal>
      )}

      {order.status === 'UNDER_REVIEW' && reviewMode === 'changes' && (
        <OrderModal
          title="Request a change"
          intro="Tell the customer exactly what needs to be updated before review can continue."
          onClose={() => setReviewMode(null)}
        >
          <form
            className="compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void mutate(
                'request-changes',
                {
                  expectedVersion: version,
                  messageToCustomer: String(form.get('message')),
                  requestedChanges: [],
                },
                'Request these changes? The customer will be notified and the order returns only after their response.',
                () => setReviewMode(null),
              );
            }}
          >
            <label>
              What needs to change?
              <textarea
                name="message"
                rows={7}
                required
                autoFocus
                placeholder="Describe the exact colors, materials, sizing, or other details that need attention."
              />
            </label>
            <p className="order-form-help">
              The customer will see this message and the order will wait for
              their response.
            </p>
            <div className="order-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setReviewMode(null)}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={busy}>
                Review change request
              </button>
            </div>
          </form>
        </OrderModal>
      )}

      {order.status === 'AWAITING_PAYMENT' && payment && (
        <section className="atelier-action-center atelier-payment-action">
          <div>
            <p className="eyebrow">Manual payment</p>
            <h2>{money(payment.amountMinor, payment.currency)} requested</h2>
            <p>{payment.instructions}</p>
          </div>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() =>
              void mutate(
                'payments/verify',
                {
                  expectedVersion: version,
                  paymentId: payment.id,
                  externalReference: `manual-${Date.now()}`,
                  receivedAt: new Date().toISOString(),
                  adminNotes: '',
                },
                'Verify that this payment was received? The order will become paid.',
              )
            }
          >
            Verify payment
          </button>
        </section>
      )}

      {['READY', 'SHIPPED'].includes(order.status) && (
        <form
          className="editor-panel compact-form order-shipping-form"
          onSubmit={(event) => void saveShipping(event)}
        >
          <div>
            <p className="eyebrow">Delivery</p>
            <h2>Shipping information</h2>
          </div>
          <label>
            Method
            <select
              name="shippingMethod"
              defaultValue={order.delivery.shippingMethod}
            >
              <option value="DELIVERY">Delivery</option>
              <option value="PICKUP">Pickup</option>
            </select>
          </label>
          <label>
            Tracking reference
            <input
              name="trackingReference"
              defaultValue={order.trackingReference ?? ''}
            />
          </label>
          <label>
            Tracking URL
            <input
              name="trackingUrl"
              type="url"
              defaultValue={order.trackingUrl ?? ''}
            />
          </label>
          <button className="secondary-button" disabled={busy}>
            Save shipping
          </button>
        </form>
      )}

      {!['DELIVERED', 'REJECTED', 'CANCELLED'].includes(order.status) && (
        <details className="order-danger-zone">
          <summary>Reject or cancel order</summary>
          <div>
            {[
              'SUBMITTED',
              'UNDER_REVIEW',
              'CHANGES_REQUESTED',
              'AWAITING_PAYMENT',
            ].includes(order.status) && (
              <form
                className="compact-form"
                onSubmit={(event) => void reject(event)}
              >
                <h3>Reject before payment</h3>
                <label>
                  Customer-visible reason
                  <textarea name="reason" rows={3} />
                </label>
                <label>
                  Internal reason{' '}
                  <span className="optional-label">Optional</span>
                  <textarea name="internalReason" rows={2} />
                </label>
                <button className="danger-link" disabled={busy}>
                  Reject order
                </button>
              </form>
            )}
            <form
              className="compact-form"
              onSubmit={(event) => void cancel(event)}
            >
              <h3>Cancel order</h3>
              <label>
                Reason
                <textarea name="reason" rows={3} />
              </label>
              <label className="check-label">
                <input name="customerVisible" type="checkbox" defaultChecked />{' '}
                Show this reason to the customer
              </label>
              {['PAID', 'IN_PRODUCTION', 'READY', 'SHIPPED'].includes(
                order.status,
              ) && (
                <>
                  <label className="check-label">
                    <input name="exceptional" type="checkbox" />{' '}
                    Confirm exceptional post-payment cancellation
                  </label>
                  <label>
                    Required audit explanation
                    <textarea name="auditReason" rows={3} />
                  </label>
                </>
              )}
              <button className="danger-link" disabled={busy}>
                Cancel order
              </button>
            </form>
          </div>
        </details>
      )}

      {regenerate ? (
        <OrderModal
          title={
            regenerate.step === 'confirm'
              ? 'Regenerate the tracking link'
              : 'New tracking link ready'
          }
          intro={
            regenerate.step === 'confirm'
              ? "This revokes the customer's current private link and creates a new one."
              : 'Copy this link and send it to the customer. It will not be shown again.'
          }
          onClose={() => {
            if (busy) return;
            setRegenerate(null);
            setCopied(false);
          }}
        >
          {regenerate.step === 'confirm' ? (
            <>
              <div className="order-confirmation">
                <span aria-hidden="true">!</span>
                <p>
                  The customer&apos;s existing tracking link will stop working
                  immediately. Send the new link to {order.customerName}{' '}
                  through your usual channel.
                </p>
              </div>
              <div className="order-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => setRegenerate(null)}
                >
                  Go back
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void regenerateAccess()}
                >
                  {busy ? 'Regenerating…' : 'Regenerate link'}
                </button>
              </div>
            </>
          ) : (
            <div className="order-tracking-link-row">
              <input
                readOnly
                value={regenerate.link}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className="primary-button"
                onClick={() => void copyTrackingLink(regenerate.link)}
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          )}
        </OrderModal>
      ) : null}

      {pending ? (
        <OrderModal
          title="Confirm this order action"
          intro="Check the consequence before continuing."
          onClose={() => !busy && setPending(null)}
        >
          <div className="order-confirmation">
            <span aria-hidden="true">!</span>
            <p>{pending.consequence}</p>
          </div>
          <div className="order-modal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Go back
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void confirmMutation()}
            >
              {busy ? 'Updating…' : 'Confirm action'}
            </button>
          </div>
        </OrderModal>
      ) : null}
    </div>
  );
}
