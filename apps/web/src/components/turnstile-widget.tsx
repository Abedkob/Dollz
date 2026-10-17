'use client';

import { RotateCcw } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render(element: HTMLElement, options: Record<string, unknown>): string;
      remove(widgetId: string): void;
      reset(widgetId: string): void;
    };
  }
}

type WidgetStatus = 'loading' | 'checking' | 'interactive' | 'ready' | 'error';

const SCRIPT_ID = 'dollz-turnstile-script';
const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_TIMEOUT_MS = 10_000;
const CHECK_TIMEOUT_MS = 15_000;

function loadTurnstileScript(forceReload: boolean): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  const current = document.getElementById(
    SCRIPT_ID,
  ) as HTMLScriptElement | null;
  if (forceReload) current?.remove();

  const existing = forceReload ? null : current;
  if (existing?.dataset.loaded === 'true') {
    return window.turnstile
      ? Promise.resolve()
      : Promise.reject(new Error('Turnstile did not initialize.'));
  }

  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement('script');

    function loaded() {
      script.dataset.loaded = 'true';
      if (window.turnstile) resolve();
      else reject(new Error('Turnstile did not initialize.'));
    }

    function failed() {
      reject(new Error('Turnstile could not be loaded.'));
    }

    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

export function TurnstileWidget({
  onToken,
}: {
  onToken: (token: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  useEffect(() => {
    let active = true;

    function clearWatchdog() {
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = undefined;
    }

    function fail(message: string) {
      if (!active) return;
      clearWatchdog();
      onToken('');
      setErrorMessage(message);
      setStatus('error');
    }

    function startWatchdog(milliseconds: number, message: string) {
      clearWatchdog();
      watchdog.current = setTimeout(() => fail(message), milliseconds);
    }

    async function initialize() {
      onToken('');
      setErrorMessage('');
      setStatus('loading');
      startWatchdog(
        SCRIPT_TIMEOUT_MS,
        'The security check is taking too long. Try it again.',
      );

      try {
        await loadTurnstileScript(attempt > 0);
      } catch {
        fail('The security check could not load. Try it again.');
        return;
      }

      if (!active || !container.current || !window.turnstile) return;

      clearWatchdog();
      setStatus('checking');
      startWatchdog(
        CHECK_TIMEOUT_MS,
        'The security check did not finish. Try it again.',
      );

      try {
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            if (!active) return;
            clearWatchdog();
            onToken(token);
            setStatus('ready');
          },
          'before-interactive-callback': () => {
            if (!active) return;
            clearWatchdog();
            setStatus('interactive');
          },
          'after-interactive-callback': () => {
            if (!active) return;
            setStatus('checking');
            startWatchdog(
              CHECK_TIMEOUT_MS,
              'The security check did not finish. Try it again.',
            );
          },
          'expired-callback': () => {
            if (!active || !widgetId.current || !window.turnstile) return;
            onToken('');
            setStatus('checking');
            window.turnstile.reset(widgetId.current);
            startWatchdog(
              CHECK_TIMEOUT_MS,
              'The refreshed security check did not finish. Try it again.',
            );
          },
          'timeout-callback': () => {
            fail('The security check timed out. Try it again.');
          },
          'unsupported-callback': () => {
            fail(
              'This browser could not run the security check. Update it or try another browser.',
            );
          },
          'error-callback': () => {
            fail('The security check ran into a problem. Try it again.');
            return true;
          },
          theme: 'light',
          size: 'flexible',
          appearance: 'always',
          retry: 'auto',
          'retry-interval': 3_000,
          'refresh-expired': 'auto',
          'refresh-timeout': 'auto',
        });
      } catch {
        fail('The security check could not start. Try it again.');
      }
    }

    void initialize();

    return () => {
      active = false;
      clearWatchdog();
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [attempt, onToken, siteKey]);

  function retry() {
    setAttempt((value) => value + 1);
  }

  return (
    <div className="turnstile-frame">
      {status === 'loading' || status === 'checking' ? (
        <p className="turnstile-status" role="status">
          {status === 'loading'
            ? 'Loading security check…'
            : 'Checking your browser…'}
        </p>
      ) : null}

      {status === 'interactive' ? (
        <p className="turnstile-status" role="status">
          Complete the check below to continue.
        </p>
      ) : null}

      <div
        className="turnstile-widget-host"
        ref={container}
        aria-label="Security verification"
      />

      {status === 'error' ? (
        <div className="turnstile-recovery" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={retry}>
            <RotateCcw aria-hidden="true" size={15} />
            Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
