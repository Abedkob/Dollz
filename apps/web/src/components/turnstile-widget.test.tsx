// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { TurnstileWidget } from './turnstile-widget';

describe('Turnstile widget recovery', () => {
  beforeEach(() => {
    delete window.turnstile;
    document.getElementById('dollz-turnstile-script')?.remove();
  });

  afterEach(() => {
    cleanup();
    delete window.turnstile;
    document.getElementById('dollz-turnstile-script')?.remove();
    vi.restoreAllMocks();
  });

  test('passes a completed token back to the form', async () => {
    const onToken = vi.fn();
    let options: Record<string, unknown> = {};
    const renderWidget = vi.fn(
      (_element: HTMLElement, nextOptions: Record<string, unknown>) => {
        options = nextOptions;
        return 'widget-1';
      },
    );

    render(<TurnstileWidget onToken={onToken} />);
    const script = document.getElementById(
      'dollz-turnstile-script',
    ) as HTMLScriptElement;
    window.turnstile = {
      render: renderWidget,
      remove: vi.fn(),
      reset: vi.fn(),
    };

    fireEvent.load(script);
    await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(1));

    act(() => {
      (options.callback as (token: string) => void)('verified-token');
    });
    expect(onToken).toHaveBeenLastCalledWith('verified-token');
  });

  test('offers an in-place retry when the script fails', async () => {
    render(<TurnstileWidget onToken={vi.fn()} />);
    const firstScript = document.getElementById(
      'dollz-turnstile-script',
    ) as HTMLScriptElement;

    fireEvent.error(firstScript);
    expect(
      await screen.findByText(
        'The security check could not load. Try it again.',
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      const retryScript = document.getElementById('dollz-turnstile-script');
      expect(retryScript).toBeTruthy();
      expect(retryScript).not.toBe(firstScript);
    });
    expect(screen.getByText('Loading security check…')).toBeTruthy();
  });
});
