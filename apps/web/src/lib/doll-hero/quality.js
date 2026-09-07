// Ported from a standalone landing-page bundle; original module path: dollz/hero/src/quality.js
import { detectWebGL } from './webgl-support.js';


// Three quality tiers. Everything expensive (shadow map size, pixel ratio,
// geometry segment counts, texture sizes) is derived from one of these.
const TIERS = {
  high:   { dpr: 2.0, shadow: 1024, radial: 44, tube: 20, faceTex: 1024, fabricTex: 512, shadows: true },
  medium: { dpr: 1.5, shadow: 512,  radial: 34, tube: 16, faceTex: 768,  fabricTex: 512, shadows: true },
  low:    { dpr: 1.25, shadow: 0,   radial: 24, tube: 12, faceTex: 512,  fabricTex: 256, shadows: false }
};

function pickTier(overrideName) {
  if (overrideName && TIERS[overrideName]) return { name: overrideName, ...TIERS[overrideName] };
  const info = detectWebGL();
  const mobile = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
  const mem = (typeof navigator !== 'undefined' && navigator.deviceMemory) || 4;

  let name = 'high';
  if (mobile) name = 'medium';
  if (!info.webgl2 || cores <= 4 || mem <= 2 || (info.maxTexture && info.maxTexture < 4096)) name = 'low';
  if (mobile && cores >= 8 && info.webgl2) name = 'medium';

  const tier = { name, ...TIERS[name] };
  // Never exceed the device's own pixel ratio; capped at 1.5 on touch, 2 on desktop.
  const devicePR = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  tier.dpr = Math.min(tier.dpr, devicePR, mobile ? 1.5 : 2);
  return tier;
}


export { TIERS, pickTier };
