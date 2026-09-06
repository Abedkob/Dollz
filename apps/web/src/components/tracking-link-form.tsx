'use client';

import { useState } from 'react';

export function TrackingLinkForm() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function openLink() {
    try {
      const url = new URL(value.trim(), window.location.origin);
      if (
        url.origin !== window.location.origin ||
        !/^\/orders\/[A-Za-z0-9_-]+$/.test(url.pathname) ||
        !url.hash.startsWith('#token=')
      )
        throw new Error();
      window.location.assign(`${url.pathname}${url.hash}`);
    } catch {
      setError(
        'Paste the complete private Dollz tracking link from your confirmation.',
      );
    }
  }

  return (
    <div className="store-track-form">
      <label htmlFor="tracking-link">Private tracking link</label>
      <div>
        <input
          id="tracking-link"
          inputMode="url"
          placeholder="http://localhost:3000/orders/DZ-…#token=…"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError('');
          }}
        />
        <button
          className="store-button store-button-primary"
          type="button"
          onClick={openLink}
        >
          Open order
        </button>
      </div>
      {error ? (
        <p className="store-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <p>
        The token after <code>#token=</code> is what keeps your order private.
        Do not share it publicly.
      </p>
    </div>
  );
}
