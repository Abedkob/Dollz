import type { ReactNode } from 'react';

/**
 * The ♡-bracketed display eyebrow used above every storefront section heading.
 * `align="center"` centers it (marketing sections); the default is left-aligned
 * for page heroes and panels.
 */
export function StoreEyebrow({
  children,
  align = 'left',
  className,
}: {
  children: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  const centered = align === 'center';
  return (
    <p
      className={`m-0 flex items-center gap-2 font-display text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-cocoa-soft ${
        centered ? 'justify-center' : ''
      } ${className ?? ''}`}
    >
      <span aria-hidden="true" className="text-[0.95rem] text-rose">
        ♡
      </span>
      {children}
      {centered ? (
        <span aria-hidden="true" className="text-[0.95rem] text-rose">
          ♡
        </span>
      ) : null}
    </p>
  );
}
