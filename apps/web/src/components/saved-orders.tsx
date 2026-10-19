'use client';

import { useEffect, useState } from 'react';
import {
  forgetSavedOrder,
  readSavedOrders,
  type SavedOrder,
} from '../lib/saved-orders';

export function SavedOrders() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);

  useEffect(() => {
    const saved = readSavedOrders();
    // A single saved order is almost always the one the customer wants.
    if (saved.length === 1 && saved[0]) {
      window.location.replace(saved[0].trackingPath);
      return;
    }
    setOrders(saved);
  }, []);

  if (!orders.length) return null;

  return (
    <section className="store-saved-orders" aria-label="Saved orders">
      <h2>Your orders on this device</h2>
      <ul>
        {orders.map((order) => (
          <li key={order.orderNumber}>
            <a href={order.trackingPath}>{order.orderNumber}</a>
            <button
              type="button"
              onClick={() => {
                forgetSavedOrder(order.orderNumber);
                setOrders(readSavedOrders());
              }}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
