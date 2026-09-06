'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  money,
  storefrontRequest,
  type StorefrontProductSummary,
} from '../lib/storefront';

function ProductCard({ product }: { product: StorefrontProductSummary }) {
  return (
    <article className="store-product-card">
      <Link className="store-product-image" href={`/products/${product.slug}`}>
        {product.primaryThumbnailUrl ? (
          <img src={product.primaryThumbnailUrl} alt="" />
        ) : (
          <div className="store-product-placeholder" aria-hidden="true">
            <span>Made for you</span>
          </div>
        )}
        {product.isFeatured ? (
          <span className="store-tag">Atelier pick</span>
        ) : null}
      </Link>
      <div className="store-product-meta">
        <div>
          <h3>
            <Link href={`/products/${product.slug}`}>{product.name}</Link>
          </h3>
          <p>{product.shortDescription ?? 'A handmade Dollz original.'}</p>
        </div>
        <p className="store-product-price">
          from {money(product.startingPriceMinor, product.currency)}
        </p>
      </div>
      <Link className="store-text-link" href={`/products/${product.slug}`}>
        Personalize this doll <span aria-hidden="true">→</span>
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
            : 'The catalog could not be loaded.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const visible = featuredOnly
    ? (products.some((product) => product.isFeatured)
        ? products.filter((product) => product.isFeatured)
        : products
      ).slice(0, 3)
    : products;

  if (loading)
    return (
      <div className="store-catalog-state" role="status">
        Opening the atelier catalog…
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
      {visible.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
