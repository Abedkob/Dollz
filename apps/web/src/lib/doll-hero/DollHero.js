// Ported from a standalone landing-page bundle; original module path: dollz/hero/src/DollHero.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SIZES, buildDoll } from './geometry.js';
import { DEFAULT_COLORS, validateColor, MAX_NAME_LENGTH, sanitizeName, createMaterials } from './materials.js';
import { createAnimator } from './animation.js';
import { pickTier } from './quality.js';
import { detectWebGL, prefersReducedMotion } from './webgl-support.js';


const DEFAULTS = {
  size: '40',
  name: 'Fatima',
  background: null,          // null = transparent canvas, so the hero CSS shows through
  autorotate: true,
  quality: null              // 'high' | 'medium' | 'low' — otherwise auto
};

/**
 * Creates the hero. Client-side only: call from an effect / after mount.
 * @returns {object} DollHeroController
 */
function createDollHero(container, options = {}) {
  if (typeof window === 'undefined') throw new Error('createDollHero must run in the browser');
  const opts = { ...DEFAULTS, ...options };
  const support = detectWebGL();

  let resolveReady, rejectReady;
  const ready = new Promise((res, rej) => { resolveReady = res; rejectReady = rej; });

  if (!support.ok) {
    container.setAttribute('data-doll-hero', 'fallback');
    // Development-only detail; customers just see the poster.
    if (typeof console !== 'undefined') console.info('[DollHero] WebGL unavailable, using poster fallback.');
    const err = new Error('webgl-unavailable');
    rejectReady(err);
    ready.catch(() => {});
    return {
      ready, supported: false,
      setName() {}, setColors() {}, setSize() {},
      resetAppearance() {}, resetCamera() {}, pause() {}, resume() {},
      dispose() { container.removeAttribute('data-doll-hero'); },
      capturePreview: () => Promise.reject(err),
      getState: () => ({ supported: false })
    };
  }

  const tier = pickTier(opts.quality);
  let reduced = prefersReducedMotion();

  /* ---------------- renderer ---------------- */
  const renderer = new THREE.WebGLRenderer({
    antialias: tier.name !== 'low',
    alpha: !opts.background,
    powerPreference: 'high-performance'
    // preserveDrawingBuffer intentionally off — capturePreview() uses a render target.
  });
  renderer.setPixelRatio(tier.dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = tier.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const canvas = renderer.domElement;
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label',
    'Interactive three-dimensional preview of a handmade personalized cloth doll in a rose dress. Drag to rotate, or use the arrow keys.');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;opacity:0;transition:opacity .6s ease';
  container.appendChild(canvas);
  container.setAttribute('data-doll-hero', 'loading');

  /* ---------------- scene ---------------- */
  const scene = new THREE.Scene();
  if (opts.background) scene.background = new THREE.Color(opts.background);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  const target = new THREE.Vector3();

  // A minimal luxury studio: one large soft key, a warm fill, a faint rim.
  const key = new THREE.DirectionalLight(0xfff6ec, 2.15);
  key.position.set(-0.55, 0.95, 0.85);
  if (tier.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(tier.shadow, tier.shadow);
    key.shadow.camera.near = 0.05;
    key.shadow.camera.far = 3;
    key.shadow.camera.left = key.shadow.camera.bottom = -0.4;
    key.shadow.camera.right = key.shadow.camera.top = 0.4;
    key.shadow.radius = 3;
    key.shadow.bias = -0.0012;
  }
  const fill = new THREE.DirectionalLight(0xffe9d5, 0.55);
  fill.position.set(0.9, 0.35, 0.7);
  const rim = new THREE.DirectionalLight(0xf3e6dd, 0.42);
  rim.position.set(0.25, 0.7, -1);
  const ambient = new THREE.HemisphereLight(0xfff4e8, 0xcfc0b2, 0.62);
  scene.add(key, fill, rim, ambient);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.ShadowMaterial({ opacity: 0.2, color: 0x4a3a30 })
  );
  ground.name = 'ground_shadow';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = tier.shadows;
  scene.add(ground);

  /* ---------------- controls ---------------- */
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.6;
  controls.minPolarAngle = Math.PI * 0.30;
  controls.maxPolarAngle = Math.PI * 0.58;
  controls.autoRotateSpeed = 0.55;

  let userTook = false;
  let scrollSpin = 0;
  const onInteract = () => {
    userTook = true;
    controls.autoRotate = false;
  };
  controls.addEventListener('start', onInteract);

  /* ---------------- model ---------------- */
  const mats = createMaterials({ tier, colors: DEFAULT_COLORS });
  let doll = null;
  let animator = null;
  const turntable = new THREE.Group();
  turntable.name = 'doll_root';
  scene.add(turntable);

  let currentSize = SIZES[opts.size] ? String(opts.size) : '40';

  function frameCamera({ animate = false } = {}) {
    const h = doll.stats.height;
    target.set(0, h * 0.54, 0);
    const dist = h * 2.35;
    controls.minDistance = dist * 0.72;
    controls.maxDistance = dist * 1.4;
    controls.target.copy(target);
    if (!animate) {
      // a flattering three-quarter view
      camera.position.set(-Math.sin(0.44) * dist, h * 0.78, Math.cos(0.44) * dist);
      camera.lookAt(target);
    }
    controls.update();
  }

  function mountDoll(size) {
    if (doll) {
      turntable.remove(doll.group);
      doll.dispose();
    }
    doll = buildDoll({ size, materials: mats, tier });
    turntable.add(doll.group);
    animator = createAnimator({ parts: doll.parts, materials: mats, reducedMotion: reduced });
    frameCamera();
  }
  mountDoll(currentSize);
  mats.setName(opts.name);

  /* ---------------- resize ---------------- */
  let w = 1, h = 1;
  const resize = () => {
    const rect = container.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the full doll in frame on narrow viewports
    camera.fov = w / h < 0.85 ? 34 : 30;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------------- loop ---------------- */
  let raf = 0;
  let running = false;
  let paused = false;
  let inView = true;
  let clock = null;
  let elapsed = 0;
  let firstFrame = false;

  function render() {
    renderer.render(scene, camera);
    if (!firstFrame) {
      firstFrame = true;
      canvas.style.opacity = '1';
      container.setAttribute('data-doll-hero', 'ready');
      resolveReady(controller);
    }
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    const dt = clock.getDelta();
    elapsed += dt;
    const e = animator.update(elapsed, dt);
    turntable.position.y = e.yOffset;
    turntable.rotation.y = scrollSpin + (userTook || reduced ? 0 : e.spin * -1);
    controls.update();
    render();
  }

  function start() {
    if (running || paused || !inView) return;
    running = true;
    clock = new THREE.Clock();
    controls.autoRotate = opts.autorotate && !reduced && !userTook;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // Only animate while the hero is actually on screen and the tab is visible.
  const io = new IntersectionObserver(entries => {
    inView = entries.some(en => en.isIntersecting);
    if (inView) start(); else stop();
  }, { threshold: 0.05 });
  io.observe(container);

  const onVisibility = () => {
    if (document.hidden) stop(); else start();
  };
  document.addEventListener('visibilitychange', onVisibility);

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion = () => {
    reduced = motionQuery.matches;
    animator.setReducedMotion(reduced);
    controls.autoRotate = opts.autorotate && !reduced && !userTook;
    if (reduced) { turntable.rotation.y = 0; turntable.position.y = 0; render(); }
  };
  motionQuery.addEventListener?.('change', onMotion);

  /* ---------------- keyboard ---------------- */
  const spherical = new THREE.Spherical();
  const onKey = ev => {
    const step = ev.shiftKey ? 0.22 : 0.09;
    let handled = true;
    const offset = camera.position.clone().sub(controls.target);
    spherical.setFromVector3(offset);
    switch (ev.key) {
      case 'ArrowLeft':  spherical.theta -= step; break;
      case 'ArrowRight': spherical.theta += step; break;
      case 'ArrowUp':    spherical.phi = Math.max(controls.minPolarAngle, spherical.phi - step * 0.5); break;
      case 'ArrowDown':  spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + step * 0.5); break;
      case 'Home': case 'Escape': controller.resetCamera(); return;
      case ' ': case 'Enter':
        if (paused) controller.resume(); else controller.pause();
        ev.preventDefault();
        return;
      default: handled = false;
    }
    if (!handled) return;
    ev.preventDefault();
    onInteract();
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    camera.lookAt(controls.target);
    if (!running) render();
  };
  canvas.addEventListener('keydown', onKey);

  const onDouble = () => controller.resetCamera();
  canvas.addEventListener('dblclick', onDouble);

  /* ---------------- controller ---------------- */
  let disposed = false;
  const controller = {
    ready,
    supported: true,
    quality: tier.name,
    element: canvas,

    /** Scroll-linked turntable angle, in radians. Independent of drag and idle spin. */
    setSpin(radians) {
      if (disposed) return;
      const n = Number(radians);
      if (!Number.isFinite(n)) return;
      scrollSpin = n;
      if (!running) { turntable.rotation.y = scrollSpin; render(); }
    },

    setName(name) {
      if (disposed) return '';
      const applied = mats.setName(name);
      if (!running) render();
      return applied;
    },

    setColors(colors) {
      if (disposed) return null;
      const applied = mats.setColors(colors);   // camera and scene untouched
      if (!running) render();
      return applied;
    },

    setSize(size) {
      if (disposed) return;
      const key = String(size);
      if (!SIZES[key] || key === currentSize) return;
      currentSize = key;
      const azimuth = camera.position.clone().sub(controls.target);
      mountDoll(key);
      // preserve the visitor's viewing angle across a size change
      if (userTook) {
        const s = new THREE.Spherical().setFromVector3(azimuth);
        s.radius = THREE.MathUtils.clamp(s.radius, controls.minDistance, controls.maxDistance);
        camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));
      }
      if (!running) render();
    },

    resetAppearance() {
      if (disposed) return;
      mats.setColors(DEFAULT_COLORS);
      mats.setName(opts.name);
      if (!running) render();
    },

    resetCamera() {
      if (disposed) return;
      userTook = false;
      turntable.rotation.y = scrollSpin;
      frameCamera();
      controls.autoRotate = opts.autorotate && !reduced;
      if (!running) render();
    },

    pause() {
      paused = true;
      stop();
    },

    resume() {
      paused = false;
      start();
    },

    isPaused: () => paused,

    /**
     * Renders one off-screen frame at an arbitrary size. Resolves to a PNG Blob.
     * `focus` frames a named part ('full' | 'face' | 'name' | 'shoes') without
     * disturbing the on-screen camera.
     */
    async capturePreview({ width = 1200, height = 1500, transparent = true, focus = null } = {}) {
      if (disposed) throw new Error('disposed');
      const framing = {
        face:  { height: 0.90, zoom: 0.30 },
        name:  { height: 0.62, zoom: 0.42 },
        shoes: { height: 0.10, zoom: 0.34 },
        full:  { height: 0.54, zoom: 1.00 }
      }[focus] || null;
      const saved = framing
        ? { pos: camera.position.clone(), target: controls.target.clone() }
        : null;
      if (framing) {
        const h = doll.stats.height;
        const ty = h * framing.height;
        const dist = h * 2.35 * framing.zoom;
        controls.target.set(0, ty, 0);
        camera.position.set(-Math.sin(0.34) * dist, ty + dist * 0.06, Math.cos(0.34) * dist);
        camera.lookAt(0, ty, 0);
      }
      const rt = new THREE.WebGLRenderTarget(width, height, {
        colorSpace: THREE.SRGBColorSpace,
        samples: tier.name === 'low' ? 0 : 4
      });
      const prevAspect = camera.aspect;
      const prevFov = camera.fov;
      camera.aspect = width / height;
      camera.fov = width / height < 0.85 ? 34 : 30;
      camera.updateProjectionMatrix();
      const prevBg = scene.background;
      if (!transparent) scene.background = new THREE.Color(opts.background || '#efe7de');

      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      const buffer = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, width, height, buffer);
      renderer.setRenderTarget(null);

      scene.background = prevBg;
      camera.aspect = prevAspect;
      camera.fov = prevFov;
      if (saved) {
        camera.position.copy(saved.pos);
        controls.target.copy(saved.target);
        camera.lookAt(saved.target);
      }
      camera.updateProjectionMatrix();
      rt.dispose();

      const out = document.createElement('canvas');
      out.width = width; out.height = height;
      const ctx = out.getContext('2d');
      const img = ctx.createImageData(width, height);
      // WebGL reads bottom-up; flip into the 2D canvas
      for (let y = 0; y < height; y++) {
        const src = (height - 1 - y) * width * 4;
        img.data.set(buffer.subarray(src, src + width * 4), y * width * 4);
      }
      ctx.putImageData(img, 0, 0);
      return new Promise((res, rej) =>
        out.toBlob(b => (b ? res(b) : rej(new Error('capture-failed'))), 'image/png'));
    },

    // Development aid only; nothing is attached unless `debug: true` is passed.
    _debug: opts.debug ? { scene, camera, controls, mats, getDoll: () => doll, render } : undefined,

    getState: () => ({
      supported: true,
      quality: tier.name,
      size: currentSize,
      name: mats.getName(),
      colors: { ...mats.colors },
      paused,
      reducedMotion: reduced,
      triangles: doll.stats.triangles
    }),

    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      motionQuery.removeEventListener?.('change', onMotion);
      canvas.removeEventListener('keydown', onKey);
      canvas.removeEventListener('dblclick', onDouble);
      controls.removeEventListener('start', onInteract);
      controls.dispose();
      doll.dispose();
      mats.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
      scene.clear();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      container.removeAttribute('data-doll-hero');
    }
  };

  render();      // paint one frame immediately, before the loop starts
  start();
  return controller;
}


/* ------------------------------------------------------------------ *
 * <doll-hero> — optional custom-element wrapper for plain HTML pages.
 * Attributes: size, doll-name, autorotate, quality, background.
 * The element itself proxies the controller API.
 * ------------------------------------------------------------------ */
if (typeof HTMLElement !== 'undefined' && !customElements.get('doll-hero')) {
  class DollHeroElement extends HTMLElement {
    #controller = null;
    #stage = null;

    connectedCallback() {
      if (this.#controller) return;
      this.#stage = document.createElement('div');
      this.#stage.style.cssText = 'position:absolute;inset:0';
      this.appendChild(this.#stage);
      if (!this.style.position) this.style.position = 'relative';

      this.#controller = createDollHero(this.#stage, {
        size: this.getAttribute('size') || undefined,
        name: this.getAttribute('doll-name') ?? undefined,
        quality: this.getAttribute('quality') || null,
        background: this.getAttribute('background') || null,
        autorotate: this.getAttribute('autorotate') !== 'false'
      });
      this.#controller.ready.then(
        () => this.dispatchEvent(new CustomEvent('doll-ready')),
        () => this.dispatchEvent(new CustomEvent('doll-unsupported'))
      );
      for (const key of ['setName', 'setColors', 'setSize', 'resetAppearance', 'resetCamera',
        'pause', 'resume', 'capturePreview', 'getState', 'isPaused', 'setSpin']) {
        this[key] = (...args) => this.#controller[key](...args);
      }
      Object.defineProperty(this, 'ready', { value: this.#controller.ready, configurable: true });
    }

    disconnectedCallback() {
      this.#controller?.dispose();
      this.#controller = null;
      this.#stage?.remove();
    }
  }
  customElements.define('doll-hero', DollHeroElement);
}


export { createDollHero, DEFAULT_COLORS, validateColor, sanitizeName, MAX_NAME_LENGTH, SIZES };
