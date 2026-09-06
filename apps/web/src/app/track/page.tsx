import type { Metadata } from 'next';
import { StorefrontFrame } from '../../components/storefront-shell';
import { TrackingLinkForm } from '../../components/tracking-link-form';

export const metadata: Metadata = {
  title: 'Track your order',
  robots: { index: false, follow: false },
};

export default function TrackPage() {
  return (
    <StorefrontFrame>
      <main className="store-track-page">
        <p className="store-kicker">Private order studio</p>
        <h1>Pick up where you left off.</h1>
        <p>
          Open the secure link created when you sent your request to see its
          status, atelier messages, revisions, and payment updates.
        </p>
        <TrackingLinkForm />
      </main>
    </StorefrontFrame>
  );
}
