import type { Metadata } from 'next';
import { JsonLd } from '../../../components/json-ld';
import { ProductConfigurator } from '../../../components/product-configurator';
import { StorefrontFrame } from '../../../components/storefront-shell';
import {
  OG_IMAGE,
  SITE_DESCRIPTION,
  absoluteUrl,
  breadcrumbLd,
  clampText,
  fetchProduct,
  productLd,
} from '../../../lib/seo';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const details = await fetchProduct(slug);
  const canonical = `/products/${slug}`;

  if (!details) {
    return {
      title: 'Personalize your doll',
      description: SITE_DESCRIPTION,
      alternates: { canonical },
    };
  }

  const { product, media } = details;
  const title = product.seoTitle ?? product.name;
  const description = clampText(
    product.seoDescription ??
      product.shortDescription ??
      product.description ??
      SITE_DESCRIPTION,
  );
  const primary = media.find((item) => item.isPrimary) ?? media[0];
  const image = primary?.urls?.optimized
    ? { url: absoluteUrl(primary.urls.optimized), alt: primary.altText ?? product.name }
    : OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      siteName: 'Dollz',
      title: `${title} · Dollz`,
      description,
      url: canonical,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · Dollz`,
      description,
      images: [image.url],
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const details = await fetchProduct(slug);

  return (
    <StorefrontFrame>
      {details ? (
        <JsonLd
          data={[
            productLd(details),
            breadcrumbLd([
              { name: 'Home', path: '/' },
              { name: 'The dolls', path: '/products' },
              {
                name: details.product.name,
                path: `/products/${details.product.slug}`,
              },
            ]),
          ]}
        />
      ) : null}
      <ProductConfigurator />
    </StorefrontFrame>
  );
}
