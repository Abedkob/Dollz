'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { createDollHero } from '../lib/doll-hero/DollHero';

type Controller = ReturnType<typeof createDollHero>;

// The house palette she arrives in on the landing page.
const HOUSE_COLORS = {
  dress: '#c2808f',
  bow: '#c2808f',
  shoes: '#c8808d',
  socks: '#f6efe6',
  lace: '#f6efe6',
  name_embroidery: '#fbf6f0',
};

/**
 * Live 3D doll for the home hero only -- not a per-product configurator.
 * Renders nothing (letting the caller's static illustration show through)
 * when WebGL is unavailable or the reference has been disposed.
 */
export function HeroDoll() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let controller: Controller | null = null;
    let onScroll: (() => void) | null = null;
    const stage = stageRef.current;
    if (!stage) return;

    const heroSection = stage.closest<HTMLElement>('.store-hero');
    const heroCopy =
      heroSection?.querySelector<HTMLElement>('.store-hero-copy') ?? null;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    void import('../lib/doll-hero/DollHero').then(({ createDollHero }) => {
      if (cancelled || !stage) return;
      controller = createDollHero(stage, { name: 'Fatima', autorotate: false });
      controller.setColors(HOUSE_COLORS);
      controller.ready.then(
        () => {
          if (cancelled || !controller) return;
          if (reduced) return;

          // A slow performed turn on entrance, settling into a
          // three-quarter resting view.
          const from = -Math.PI * 0.55;
          const duration = 2600;
          const started = performance.now() + 400;
          let entranceDone = false;
          const step = (now: number) => {
            if (cancelled || !controller) return;
            const t = Math.min(1, Math.max(0, (now - started) / duration));
            const eased = t < 1 ? 1 - Math.pow(1 - t, 4) : 1;
            controller.setSpin(from * (1 - eased));
            if (t < 1) requestAnimationFrame(step);
            else entranceDone = true;
          };
          requestAnimationFrame(step);

          // Scroll-linked turntable: as the hero scrolls past, she keeps
          // turning, the stage eases back slightly, and the copy column
          // drifts upward -- matching the reference build's hero exit.
          onScroll = () => {
            if (!entranceDone || !heroSection || !controller) return;
            const rect = heroSection.getBoundingClientRect();
            const progress = Math.min(
              1,
              Math.max(0, -rect.top / Math.max(1, rect.height * 0.9)),
            );
            controller.setSpin(progress * Math.PI * 0.62);
            stage.style.scale = String(1 - progress * 0.06);
            if (heroCopy) {
              const exit = Math.min(
                1,
                Math.max(0, -heroCopy.getBoundingClientRect().top / window.innerHeight),
              );
              heroCopy.style.translate = `0 ${(exit * -48).toFixed(1)}px`;
            }
          };
          window.addEventListener('scroll', onScroll, { passive: true });
        },
        () => setSupported(false),
      );
    });

    return () => {
      cancelled = true;
      if (onScroll) window.removeEventListener('scroll', onScroll);
      controller?.dispose();
    };
  }, []);

  if (!supported) return null;
  return <div className="store-hero-doll-stage" ref={stageRef} />;
}
