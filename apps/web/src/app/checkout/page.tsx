import type { Metadata } from 'next';
import { StorefrontCheckout } from '../../components/storefront-checkout';
import { StorefrontFrame } from '../../components/storefront-shell';

export const metadata: Metadata = {
  title: 'Review your request',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <StorefrontFrame>
      <StorefrontCheckout />
    </StorefrontFrame>
  );
}
