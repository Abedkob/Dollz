import type { Metadata } from 'next';
import { ProductConfigurator } from '../../../components/product-configurator';
import { StorefrontFrame } from '../../../components/storefront-shell';

export const metadata: Metadata = {
  title: 'Personalize your doll',
  description:
    'Choose a size and personalize the details of your handmade Dollz keepsake.',
};

export default function ProductPage() {
  return (
    <StorefrontFrame>
      <ProductConfigurator />
    </StorefrontFrame>
  );
}
