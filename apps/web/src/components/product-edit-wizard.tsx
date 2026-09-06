'use client';

import { useEffect, useRef, useState } from 'react';
import React from 'react';
import { catalogRequest, type ProductDetails } from '../lib/catalog';
import { ProductEditor } from './product-editor';

export function ProductEditWizard({
  productId,
  csrfToken,
  onClose,
}: {
  productId: string;
  csrfToken: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<ProductDetails | null>(null);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    };
  }, []);

  useEffect(() => {
    let active = true;
    setDetails(null);
    setError('');
    void catalogRequest<ProductDetails>(`products/${productId}`)
      .then((result) => {
        if (active) setDetails(result);
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'The product could not be opened.',
        );
      });
    return () => {
      active = false;
    };
  }, [productId]);

  function requestClose() {
    if (dirty && !window.confirm('Discard the unsaved product detail changes?'))
      return;
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="product-wizard edit-product-wizard"
      aria-label="Edit product"
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      {error ? (
        <div className="edit-wizard-state state-panel error-state" role="alert">
          <h2>Product could not be opened</h2>
          <p>{error}</p>
          <button className="secondary-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      ) : details ? (
        <ProductEditor
          csrfToken={csrfToken}
          initial={details}
          wizard
          onClose={onClose}
          onDirtyChange={setDirty}
        />
      ) : (
        <div className="edit-wizard-state catalog-loading" aria-live="polite">
          Opening product…
        </div>
      )}
    </dialog>
  );
}
