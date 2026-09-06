import type { Metadata } from 'next';
import { OrderTracker } from '../../../components/order-tracker';

export const metadata: Metadata = {
  title: 'Private order tracking | Dollz',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function TrackingPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return <OrderTracker orderNumber={orderNumber} />;
}
