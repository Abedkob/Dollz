'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export type RevealVariant =
  | 'fade'
  | 'fade-up'
  | 'rise'
  | 'left'
  | 'right'
  | 'zoom'
  | 'blur-in'
  | 'settle';

interface RevealProps {
  children: ReactNode;
  /** Entrance motion. Defaults to a small upward fade. */
  variant?: RevealVariant;
  /** Delay before the element animates in, in ms. Use to stagger lists. */
  delay?: number;
  /** Override the transition duration, in ms. */
  duration?: number;
  /** Re-hide and replay every time the element leaves and re-enters view. */
  repeat?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * Reveals its children once they scroll into view. The hidden/animated state
 * lives entirely in CSS (see globals.css, `[data-reveal]`), gated on `.js` so
 * no-JS visitors and `prefers-reduced-motion` users always see the content.
 */
export function Reveal({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 0,
  repeat = false,
  className,
  style,
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      typeof IntersectionObserver === 'undefined'
    ) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          setInView(true);
          if (!repeat) observer.disconnect();
        } else if (repeat) {
          setInView(false);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.16 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [repeat]);

  const cssVars: Record<`--${string}`, string> = {};
  if (delay) cssVars['--reveal-delay'] = `${delay}ms`;
  if (duration) cssVars['--reveal-dur'] = `${duration}ms`;

  return (
    <div
      ref={ref}
      className={className}
      data-reveal={variant}
      data-inview={inView ? '' : undefined}
      style={{ ...style, ...cssVars } as CSSProperties}
    >
      {children}
    </div>
  );
}
