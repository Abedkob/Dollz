// Ported from a standalone landing-page bundle; original module path: dollz/hero/src/webgl-support.js


// Cheap, side-effect-free WebGL capability probe. Safe to call on the client only.
let cached = null;

function detectWebGL() {
  if (cached) return cached;
  if (typeof document === 'undefined') return (cached = { ok: false, reason: 'no-dom' });
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return (cached = { ok: false, reason: 'no-context' });
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return (cached = { ok: true, webgl2: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext, renderer, maxTexture });
  } catch {
    return (cached = { ok: false, reason: 'threw' });
  }
}

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}


export { detectWebGL, prefersReducedMotion };
