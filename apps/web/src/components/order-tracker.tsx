'use client';

import React from 'react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  displayStatus,
  guestOrderRequest,
  money,
  type OrderDetail,
} from '../lib/orders';

export function OrderTracker({ orderNumber }: { orderNumber: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [csrf, setCsrf] = useState('');
  const [state, setState] = useState<
    'loading' | 'ready' | 'invalid' | 'expired' | 'revoked'
  >('loading');
  const [error, setError] = useState('');

  async function load() {
    const result = await guestOrderRequest<OrderDetail>(orderNumber);
    setOrder(result);
    setState('ready');
  }
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const trackingToken = fragment.get('token');
    window.history.replaceState(null, '', window.location.pathname);
    void (
      trackingToken
        ? guestOrderRequest<{ csrfToken: string; order: OrderDetail }>(
            'access/exchange',
            {
              method: 'POST',
              body: JSON.stringify({ orderNumber, token: trackingToken }),
            },
          ).then((result) => {
            setCsrf(result.csrfToken);
            setOrder(result.order);
            setState('ready');
          })
        : load()
    ).catch((reason: Error & { code?: string }) => {
      setError(reason.message);
      setState(
        reason.code === 'ORDER_ACCESS_EXPIRED'
          ? 'expired'
          : reason.code === 'ORDER_ACCESS_REVOKED'
            ? 'revoked'
            : 'invalid',
      );
    });
  }, [orderNumber]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = String(new FormData(form).get('message'));
    setError('');
    try {
      await guestOrderRequest(
        `${orderNumber}/messages`,
        { method: 'POST', body: JSON.stringify({ message }) },
        csrf,
      );
      form.reset();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The message could not be sent.',
      );
    }
  }
  async function respond(revisionId: string, response: string) {
    setError('');
    try {
      await guestOrderRequest(
        `${orderNumber}/revisions/${revisionId}/respond`,
        {
          method: 'POST',
          body: JSON.stringify({
            response,
            message:
              response === 'REQUEST_CLARIFICATION'
                ? 'Please clarify the quotation.'
                : null,
          }),
        },
        csrf,
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The response could not be saved.',
      );
    }
  }

  if (state === 'loading')
    return (
      <main className="tracking-shell">
        <div className="tracking-state" aria-live="polite">
          Opening your private order…
        </div>
      </main>
    );
  if (state !== 'ready' || !order)
    return (
      <main className="tracking-shell">
        <section className="tracking-state">
          <p className="eyebrow">Private order</p>
          <h1>
            {state === 'expired'
              ? 'This link has expired'
              : state === 'revoked'
                ? 'This link was replaced'
                : 'This order link is not valid'}
          </h1>
          <p>{error || 'Ask Dollz for a new private tracking link.'}</p>
          <a href="/" className="tracking-back">
            <span aria-hidden="true">&larr;</span> Back to website
          </a>
        </section>
      </main>
    );
  const currentRevision = order.revisions[0] as
    | {
        id?: string;
        revisionType?: string;
        customerResponse?: string;
        customerMessage?: string;
        totalMinor?: number;
      }
    | undefined;
  return (
    <main className="tracking-shell">
      <header className="tracking-header">
        <div className="tracking-brand-row">
          <a href="/" className="admin-brand">
            Dollz
          </a>
          <span>Private order tracking</span>
        </div>
        <a href="/" className="tracking-back">
          <span aria-hidden="true">&larr;</span> Back to website
        </a>
      </header>
      <section className="tracking-hero">
        <div>
          <p className="eyebrow">Order {order.order.orderNumber}</p>
          <h1>{displayStatus(order.order.status)}</h1>
          <p>
            Submitted for {order.order.customerName} on{' '}
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(
              new Date(order.order.submittedAt),
            )}
          </p>
        </div>
        <div className="tracking-total">
          <small>
            {order.order.pricingStatus === 'FINAL'
              ? 'Final total'
              : 'Current estimate'}
          </small>
          <strong>
            {money(
              order.order.finalTotalMinor ?? order.order.estimatedSubtotalMinor,
              order.order.currency,
            )}
          </strong>
        </div>
      </section>
      {error && (
        <div className="form-summary" role="alert">
          <h2>We could not save that</h2>
          <p>{error}</p>
        </div>
      )}
      {currentRevision?.id &&
        !currentRevision.customerResponse &&
        currentRevision.revisionType === 'APPROVAL' && (
          <section className="tracking-callout">
            <div>
              <p className="eyebrow">Your approval</p>
              <h2>Review the final quotation</h2>
              <p>{currentRevision.customerMessage}</p>
            </div>
            {csrf ? (
              <div className="order-action-row">
                <button
                  className="primary-button"
                  onClick={() => void respond(currentRevision.id!, 'ACCEPT')}
                >
                  Accept quotation
                </button>
                <button
                  className="secondary-button"
                  onClick={() =>
                    void respond(currentRevision.id!, 'REQUEST_CLARIFICATION')
                  }
                >
                  Ask a question
                </button>
                <button
                  className="danger-link"
                  onClick={() => void respond(currentRevision.id!, 'DECLINE')}
                >
                  Decline
                </button>
              </div>
            ) : (
              <p>Open the original tracking link to respond.</p>
            )}
          </section>
        )}
      <div className="tracking-grid">
        <section className="tracking-card">
          <p className="eyebrow">Your dolls</p>
          <h2>Configuration</h2>
          {order.items.map((item) => (
            <article className="tracking-item" key={item.id}>
              <header>
                <strong>{item.productName}</strong>
                <span>
                  {item.variantName} · Qty {item.quantity}
                </span>
              </header>
              <dl>
                {item.selections.map((selection) => (
                  <div key={selection.optionCode}>
                    <dt>{selection.optionName}</dt>
                    <dd>
                      {selection.colorHex && (
                        <span
                          className="color-chip"
                          style={{ background: selection.colorHex }}
                        />
                      )}
                      {selection.valueLabel}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </section>
        <section className="tracking-card">
          <p className="eyebrow">Progress</p>
          <h2>Timeline</h2>
          <ol className="order-timeline">
            {order.history.map((entry) => (
              <li key={entry.id}>
                <span />
                <div>
                  <strong>{displayStatus(entry.newStatus)}</strong>
                  <p>{entry.message}</p>
                  <time>{new Date(entry.createdAt).toLocaleString()}</time>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {order.payments.some((payment) => payment.status === 'REQUESTED') && (
        <section className="tracking-callout">
          <div>
            <p className="eyebrow">Payment</p>
            <h2>Manual payment requested</h2>
            <p>
              {
                order.payments.find((payment) => payment.status === 'REQUESTED')
                  ?.instructions
              }
            </p>
          </div>
          <strong>
            {money(
              order.payments.find((payment) => payment.status === 'REQUESTED')!
                .amountMinor,
              order.order.currency,
            )}
          </strong>
        </section>
      )}
      <section className="tracking-card tracking-messages">
        <p className="eyebrow">Messages</p>
        <h2>Conversation with Dollz</h2>
        <div className="message-list">
          {order.messages.map((entry) => (
            <article key={entry.id}>
              <strong>
                {entry.senderType === 'CUSTOMER' ? 'You' : 'Dollz'}
              </strong>
              <p>{entry.message}</p>
              <time>{new Date(entry.createdAt).toLocaleString()}</time>
            </article>
          ))}
        </div>
        {csrf ? (
          <form
            className="message-form"
            onSubmit={(event) => void sendMessage(event)}
          >
            <label>
              Message
              <textarea name="message" rows={3} required maxLength={4000} />
            </label>
            <button className="primary-button">Send message</button>
          </form>
        ) : (
          <p className="order-note">
            Open your original private tracking link to send a message.
          </p>
        )}
      </section>
    </main>
  );
}
