'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  money,
  storefrontRequest,
  type StorefrontProductSummary,
} from '../lib/storefront';
import { Reveal } from './reveal';

function ProductCard({ product }: { product: StorefrontProductSummary }) {
  const isBuildYourOwn =
    product.slug === process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG;
  const href = isBuildYourOwn ? '/customize' : `/products/${product.slug}`;

  return (
    <article>
      <Link href={href} className="group block">
        <div
          className={`relative aspect-[0.82] overflow-hidden rounded-[1.5rem] bg-cream shadow-[0_18px_44px_-26px_rgba(120,70,85,0.5)] ${
            isBuildYourOwn ? 'ring-2 ring-rose/60' : 'ring-1 ring-cocoa/10'
          }`}
        >
          {product.primaryThumbnailUrl ? (
            <img
              src={product.primaryThumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#f3e3e0] to-cream"
            >
              <span className="font-serif text-[1.05rem] text-[#b45f74] italic">
                Made for you
              </span>
            </div>
          )}
          {product.isFeatured || isBuildYourOwn ? (
            <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-blush px-3 py-1 font-display text-[0.62rem] font-semibold tracking-[0.14em] text-white uppercase shadow-[0_8px_20px_-8px_rgba(176,90,110,0.7)]">
              <span aria-hidden="true">♡</span>{' '}
              {isBuildYourOwn ? 'Custom studio' : 'Atelier pick'}
            </span>
          ) : null}
        </div>
        <h3 className="m-0 mt-5 font-serif! text-[1.35rem] font-normal! tracking-[-0.01em]! text-cocoa">
          {product.name}
        </h3>
        <p className="m-0 mt-1.5 line-clamp-2 text-[0.9rem] leading-[1.6] text-muted">
          {product.shortDescription ?? 'A handmade Dollz original.'}
        </p>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-display text-[0.9rem] font-semibold text-cocoa">
            {isBuildYourOwn
              ? 'Start building'
              : `from ${money(product.startingPriceMinor, product.currency)}`}
          </span>
          <span
            aria-hidden="true"
            className="text-[1.05rem] text-[#b45f74] transition-transform duration-150 group-hover:translate-x-1"
          >
            →
          </span>
        </div>
      </Link>
    </article>
  );
}

export function StorefrontCatalog({
  featuredOnly = false,
}: {
  featuredOnly?: boolean;
}) {
  const [products, setProducts] = useState<StorefrontProductSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void storefrontRequest<{ items: StorefrontProductSummary[] }>('products')
      .then((result) => setProducts(result.items))
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'Failed to load the catalog.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const collectionProducts = featuredOnly
    ? products.filter(
        (product) =>
          product.slug !== process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG,
      )
    : products;
  const visible = featuredOnly
    ? (collectionProducts.some((product) => product.isFeatured)
        ? collectionProducts.filter((product) => product.isFeatured)
        : collectionProducts
      ).slice(0, 3)
    : collectionProducts;

  if (loading)
    return (
      <div className="store-catalog-state" role="status">
        Loading…
      </div>
    );
  if (error)
    return (
      <div className="store-catalog-state store-catalog-error" role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!visible.length)
    return (
      <div className="store-catalog-state">
        <p>The next collection is being prepared.</p>
        <p>Published dolls will appear here automatically.</p>
      </div>
    );
  return (
    <div className="store-product-grid">
      {visible.map((product, index) => (
        <Reveal
          className={
            product.slug === process.env.NEXT_PUBLIC_BUILD_YOUR_OWN_SLUG
              ? 'sm:col-span-2 lg:col-span-1'
              : undefined
          }
          key={product.id}
          variant="rise"
          delay={Math.min(index, 5) * 90}
        >
          <ProductCard product={product} />
        </Reveal>
      ))}
    </div>
  );
}
