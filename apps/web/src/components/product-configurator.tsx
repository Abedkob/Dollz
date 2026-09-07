'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import {
  addCartItem,
  money,
  storefrontRequest,
  type StorefrontOption,
  type StorefrontProductDetails,
} from '../lib/storefront';

type Choice = {
  valueId: string | null;
  customValue: string;
  customColor: string;
};

function OptionControl({
  option,
  choice,
  selectedValueIds,
  conflicting,
  onChange,
}: {
  option: StorefrontOption;
  choice: Choice;
  selectedValueIds: Set<string>;
  conflicting: (candidateId: string, selectedIds: Set<string>) => string | null;
  onChange: (choice: Choice) => void;
}) {
  if (option.inputType === 'TEXT' || option.inputType === 'TEXTAREA') {
    const Field = option.inputType === 'TEXTAREA' ? 'textarea' : 'input';
    return (
      <Field
        className="store-config-text"
        value={choice.customValue}
        required={option.isRequired}
        maxLength={option.inputType === 'TEXTAREA' ? 1000 : 200}
        rows={option.inputType === 'TEXTAREA' ? 4 : undefined}
        placeholder={
          option.inputType === 'TEXTAREA'
            ? 'Tell the atelier what matters…'
            : 'Type your detail'
        }
        onChange={(event) =>
          onChange({ ...choice, customValue: event.target.value })
        }
      />
    );
  }

  if (option.inputType === 'SELECT')
    return (
      <select
        className="store-config-text"
        value={choice.valueId ?? ''}
        required={option.isRequired}
        onChange={(event) =>
          onChange({ ...choice, valueId: event.target.value || null })
        }
      >
        <option value="">Choose one</option>
        {option.values.map((value) => {
          const reason = conflicting(value.id, selectedValueIds);
          return (
            <option key={value.id} value={value.id} disabled={Boolean(reason)}>
              {value.label}
            </option>
          );
        })}
      </select>
    );

  return (
    <div
      className={`store-choice-grid store-choice-${option.inputType.toLowerCase()}`}
    >
      {option.values.map((value) => {
        const reason = conflicting(value.id, selectedValueIds);
        const active = choice.valueId === value.id;
        return (
          <button
            key={value.id}
            className={active ? 'is-selected' : ''}
            type="button"
            disabled={Boolean(reason) && !active}
            title={reason ?? undefined}
            aria-pressed={active}
            onClick={() => onChange({ ...choice, valueId: value.id })}
          >
            {value.referenceUrl ? (
              <img src={value.referenceUrl} alt="" />
            ) : null}
            {value.colorHex ? (
              <span
                className="store-swatch"
                style={{ backgroundColor: value.colorHex }}
                aria-hidden="true"
              />
            ) : null}
            <span>{value.label}</span>
            {value.priceAdjustmentMinor ? (
              <small>+{money(value.priceAdjustmentMinor, 'USD')}</small>
            ) : null}
          </button>
        );
      })}
      {option.allowCustomValue && option.inputType === 'COLOR' ? (
        <label
          className={`store-custom-choice store-custom-color${
            !choice.valueId && choice.customColor ? ' is-selected' : ''
          }`}
        >
          <input
            type="color"
            aria-label={`Choose any ${option.name.toLowerCase()}`}
            value={choice.customColor || '#000000'}
            onChange={(event) =>
              onChange({
                ...choice,
                valueId: null,
                customColor: event.target.value,
              })
            }
          />
          <span>Or choose any color</span>
        </label>
      ) : option.allowCustomValue ? (
        <label className="store-custom-choice">
          <span>Or describe another choice</span>
          <input
            value={choice.customValue}
            onChange={(event) =>
              onChange({
                ...choice,
                valueId: null,
                customValue: event.target.value,
              })
            }
          />
        </label>
      ) : null}
    </div>
  );
}

export function ProductConfigurator() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [details, setDetails] = useState<StorefrontProductDetails | null>(null);
  const [variantId, setVariantId] = useState('');
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [request, setRequest] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    void storefrontRequest<StorefrontProductDetails>(`products/${params.slug}`)
      .then((result) => {
        setDetails(result);
        setVariantId(
          (result.variants.find((item) => item.isDefault) ?? result.variants[0])
            ?.id ?? '',
        );
        setChoices(
          Object.fromEntries(
            result.options.map((option) => {
              const defaultValue = option.values.find(
                (value) => value.isDefault,
              );
              return [
                option.id,
                {
                  valueId: defaultValue?.id ?? null,
                  customValue: '',
                  customColor: '',
                },
              ];
            }),
          ),
        );
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error
            ? reason.message
            : 'This doll could not be loaded.',
        ),
      );
  }, [params.slug]);

  const selectedValueIds = useMemo(
    () =>
      new Set(
        Object.values(choices).flatMap((choice) =>
          choice.valueId ? [choice.valueId] : [],
        ),
      ),
    [choices],
  );
  const conflictReason = (candidateId: string, selectedIds: Set<string>) => {
    for (const conflict of details?.conflicts ?? []) {
      const other =
        conflict.firstValueId === candidateId
          ? conflict.secondValueId
          : conflict.secondValueId === candidateId
            ? conflict.firstValueId
            : null;
      if (other && selectedIds.has(other))
        return conflict.reason ?? 'This combination is not available.';
    }
    return null;
  };
  const variant = details?.variants.find((item) => item.id === variantId);
  const total =
    (variant?.priceMinor ?? 0) +
    (details?.options.reduce((sum, option) => {
      const value = option.values.find(
        (item) => item.id === choices[option.id]?.valueId,
      );
      return sum + (value?.priceAdjustmentMinor ?? 0);
    }, 0) ?? 0);

  function addToRequest() {
    if (!details || !variant) return;
    const missing = details.options.find((option) => {
      if (!option.isRequired) return false;
      const choice = choices[option.id];
      return !choice?.valueId && !choice?.customValue.trim() && !choice?.customColor;
    });
    if (missing) {
      setError(`Choose ${missing.name.toLowerCase()} before continuing.`);
      document
        .getElementById(`option-${missing.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const selections = details.options.flatMap((option) => {
      const choice = choices[option.id];
      if (
        !choice ||
        (!choice.valueId && !choice.customValue.trim() && !choice.customColor)
      )
        return [];
      const value = option.values.find((item) => item.id === choice.valueId);
      return [
        {
          optionId: option.id,
          optionName: option.name,
          optionValueId: choice.valueId,
          valueLabel:
            value?.label || choice.customValue.trim() || choice.customColor || '',
          customValue: choice.valueId ? null : choice.customValue.trim() || null,
          customColor: choice.valueId ? null : choice.customColor || null,
        },
      ];
    });
    addCartItem({
      key: crypto.randomUUID(),
      productId: details.product.id,
      productSlug: details.product.slug,
      productName: details.product.name,
      variantId: variant.id,
      variantName: variant.name,
      quantity: 1,
      estimatedUnitPriceMinor: total,
      currency: variant.currency,
      imageUrl:
        details.media[0]?.urls.thumbnail ?? details.product.primaryThumbnailUrl,
      customerRequest: request.trim() || null,
      selections,
    });
    router.push('/cart');
  }

  if (error && !details)
    return (
      <main className="store-load-page">
        <p role="alert">{error}</p>
        <Link href="/products">Return to the collection</Link>
      </main>
    );
  if (!details)
    return (
      <main className="store-load-page" role="status">
        Preparing the personalization studio…
      </main>
    );

  const image = details.media[activeImage] ?? details.media[0];
  return (
    <main className="store-config-page">
      <div className="store-config-breadcrumb">
        <Link href="/products">The dolls</Link>
        <span>/</span>
        <span>{details.product.name}</span>
      </div>
      <section className="store-config-layout">
        <div className="store-gallery">
          <div className="store-gallery-main">
            {image ? (
              <img
                src={image.urls.optimized}
                alt={image.altText ?? details.product.name}
              />
            ) : (
              <div className="store-product-placeholder">
                <span>Made for you</span>
              </div>
            )}
          </div>
          {details.media.length > 1 ? (
            <div className="store-gallery-thumbs">
              {details.media.map((item, index) => (
                <button
                  type="button"
                  className={index === activeImage ? 'is-selected' : ''}
                  key={item.id}
                  onClick={() => setActiveImage(index)}
                >
                  <img
                    src={item.urls.thumbnail}
                    alt={item.altText ?? `View ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          ) : null}
          <p className="store-preview-note">
            Product photography is a reference. The atelier reviews your exact
            combination before production.
          </p>
        </div>
        <div className="store-config-panel">
          <p className="store-kicker">Personalization studio</p>
          <h1>{details.product.name}</h1>
          <p className="store-config-description">
            {details.product.description ?? details.product.shortDescription}
          </p>
          <div className="store-price-row">
            <strong>
              {money(total, variant?.currency ?? details.product.currency)}
            </strong>
            <span>Estimated · confirmed after review</span>
          </div>

          <fieldset className="store-option-group">
            <legend>
              <span>1</span> Choose a size
            </legend>
            <div className="store-variant-grid">
              {details.variants.map((item) => (
                <button
                  type="button"
                  aria-pressed={variantId === item.id}
                  className={variantId === item.id ? 'is-selected' : ''}
                  key={item.id}
                  onClick={() => setVariantId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>
                    {item.sizeLabel ??
                      (item.sizeCm ? `${item.sizeCm} cm` : 'Signature size')}
                  </span>
                  <small>{money(item.priceMinor, item.currency)}</small>
                </button>
              ))}
            </div>
          </fieldset>

          {details.options.map((option, index) => (
            <fieldset
              className="store-option-group"
              id={`option-${option.id}`}
              key={option.id}
            >
              <legend>
                <span>{index + 2}</span> {option.name}
                {option.isRequired ? (
                  <small>Required</small>
                ) : (
                  <small>Optional</small>
                )}
              </legend>
              {option.description ? <p>{option.description}</p> : null}
              <OptionControl
                option={option}
                choice={
                  choices[option.id] ?? {
                    valueId: null,
                    customValue: '',
                    customColor: '',
                  }
                }
                selectedValueIds={selectedValueIds}
                conflicting={conflictReason}
                onChange={(choice) => {
                  setError('');
                  setChoices((current) => ({
                    ...current,
                    [option.id]: choice,
                  }));
                }}
              />
            </fieldset>
          ))}

          <fieldset className="store-option-group">
            <legend>
              <span>{details.options.length + 2}</span> A note for the maker{' '}
              <small>Optional</small>
            </legend>
            <textarea
              className="store-config-text"
              rows={4}
              maxLength={4000}
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              placeholder="Share the story, occasion, or a detail we should understand."
            />
          </fieldset>
          {error ? (
            <p className="store-inline-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="store-config-submit">
            <div>
              <strong>
                {money(total, variant?.currency ?? details.product.currency)}
              </strong>
              <span>estimated total</span>
            </div>
            <button
              className="store-button store-button-primary"
              type="button"
              onClick={addToRequest}
            >
              Review my request
            </button>
          </div>
          <p className="store-production-note">
            Usually made in {details.product.productionMinDays}–
            {details.product.productionMaxDays} days after approval.
          </p>
        </div>
      </section>
    </main>
  );
}
