import type { Metadata } from 'next';
import { StorefrontCart } from '../../components/storefront-cart';
import { StorefrontFrame } from '../../components/storefront-shell';

export const metadata: Metadata = {
  title: 'Your request',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <StorefrontFrame>
      <StorefrontCart />
    </StorefrontFrame>
  );
}
