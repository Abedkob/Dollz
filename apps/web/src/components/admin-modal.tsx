'use client';

import React, { useEffect, useId, useRef, type ReactNode } from 'react';

export function AdminModal({
  eyebrow,
  title,
  intro,
  onClose,
  children,
  wide = false,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
    return () => {
      if (modal.open && typeof modal.close === 'function') modal.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`admin-modal order-modal${wide ? ' admin-modal-wide order-modal-wide' : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <header className="admin-modal-header order-modal-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
          {intro ? <p>{intro}</p> : null}
        </div>
        <button
          className="wizard-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="admin-modal-body order-modal-body">{children}</div>
    </dialog>
  );
}
