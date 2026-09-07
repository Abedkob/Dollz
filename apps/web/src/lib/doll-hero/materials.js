// Ported from a standalone landing-page bundle; original module path: dollz/hero/src/materials.js
import * as THREE from 'three';



/* ------------------------------------------------------------------ *
 * Palette + validation
 * ------------------------------------------------------------------ */
const DEFAULT_COLORS = {
  skin:  '#e3bb96',
  hair:  '#7a4a30',
  eyes:  '#5a3521',
  dress: '#c2808f',
  lace:  '#f6efe6',
  blush: '#dd9295',
  shoes: '#c8808d',
  socks: '#f6efe6',
  bow:   '#c2808f',
  name_embroidery: '#fbf6f0'
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Returns a normalized #rrggbb string, or null when the input is not a plain hex color. */
function validateColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!HEX.test(v)) return null;
  if (v.length === 4) return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
  return v.toLowerCase();
}

const MAX_NAME_LENGTH = 14;

/** Strips anything that would not embroider cleanly and enforces the length cap. */
function sanitizeName(value) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex -- deliberately stripping control characters
  return value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
}

/* ------------------------------------------------------------------ *
 * Procedural fabric bump — a woven crosshatch plus low-frequency slub.
 * One canvas, shared by every fabric material via cloned textures.
 * ------------------------------------------------------------------ */
function fabricCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);

  const step = Math.max(3, Math.round(size / 128));
  g.lineWidth = 1;
  for (let x = 0; x < size; x += step) {
    g.strokeStyle = x % (step * 2) ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)';
    g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, size); g.stroke();
  }
  for (let y = 0; y < size; y += step) {
    g.strokeStyle = y % (step * 2) ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.13)';
    g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(size, y + 0.5); g.stroke();
  }
  // slub: soft blotches so the weave is not perfectly regular
  for (let i = 0; i < size / 3; i++) {
    const r = 2 + Math.random() * size / 26;
    const v = Math.random() > 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},0.045)`;
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/* ------------------------------------------------------------------ *
 * Embroidered face — drawn into a transparent canvas and applied to a
 * spherical face patch (its UVs run 0..1 across the patch).
 * Three lid states are pre-rendered so blinking is a texture swap.
 * ------------------------------------------------------------------ */
const FACE_STATES = ['open', 'half', 'closed'];

function drawFace(canvas, { eyes, blush, lid }) {
  const s = canvas.width;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, s, s);
  const P = (x, y) => [x * s, y * s];
  const ink = '#3b2318';

  // cheeks first, so stitching sits over them
  for (const sx of [-1, 1]) {
    const [cx, cy] = P(0.5 + sx * 0.175, 0.585);
    g.globalAlpha = 0.5;
    g.fillStyle = blush;
    g.filter = `blur(${s * 0.03}px)`;
    g.beginPath(); g.ellipse(cx, cy, s * 0.072, s * 0.05, 0, 0, Math.PI * 2); g.fill();
    g.filter = 'none';
    g.globalAlpha = 1;
  }

  const eyeY = 0.5;
  const openness = lid === 'open' ? 1 : lid === 'half' ? 0.45 : 0.06;

  for (const sx of [-1, 1]) {
    const [ex, ey] = P(0.5 + sx * 0.145, eyeY);
    const rw = s * 0.062;
    const rh = s * 0.052 * openness;

    // iris — a satin-stitched almond
    g.save();
    g.beginPath();
    g.moveTo(ex - rw, ey);
    g.quadraticCurveTo(ex, ey - rh * 1.5, ex + rw, ey);
    g.quadraticCurveTo(ex, ey + rh * 1.25, ex - rw, ey);
    g.closePath();
    g.clip();
    g.fillStyle = eyes;
    g.fillRect(ex - rw, ey - rh * 2, rw * 2, rh * 4);
    // stitch direction: fine vertical threads
    g.globalAlpha = 0.22;
    g.strokeStyle = '#000';
    g.lineWidth = Math.max(1, s / 420);
    for (let x = ex - rw; x < ex + rw; x += Math.max(2, s / 150)) {
      g.beginPath(); g.moveTo(x, ey - rh * 2); g.lineTo(x + s * 0.006, ey + rh * 2); g.stroke();
    }
    g.globalAlpha = 1;
    // highlight
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.beginPath(); g.ellipse(ex - sx * rw * 0.34, ey - rh * 0.45, rw * 0.16, rh * 0.2, 0, 0, Math.PI * 2); g.fill();
    g.restore();

    // upper lid line + lashes
    g.strokeStyle = ink;
    g.lineCap = 'round';
    g.lineWidth = Math.max(1.6, s * 0.0062);
    g.beginPath();
    g.moveTo(ex - rw * 1.06, ey + (lid === 'closed' ? 0 : s * 0.004));
    g.quadraticCurveTo(ex, ey - Math.max(rh * 1.55, s * 0.012), ex + rw * 1.06, ey + (lid === 'closed' ? 0 : s * 0.004));
    g.stroke();

    g.lineWidth = Math.max(1.1, s * 0.0038);
    for (let i = 0; i < 3; i++) {
      const t = 0.55 + i * 0.2;
      const lx = ex + sx * rw * t;
      const ly = ey - rh * (1.05 - Math.abs(t - 0.75)) - s * 0.004;
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(lx + sx * s * 0.019, ly - s * 0.016 + i * s * 0.002);
      g.stroke();
    }

    // brow — a fine arc well above the lid
    g.lineWidth = Math.max(1.2, s * 0.0042);
    g.strokeStyle = 'rgba(59,35,24,0.72)';
    g.beginPath();
    g.moveTo(ex - rw * 0.95, ey - s * 0.085);
    g.quadraticCurveTo(ex + sx * rw * 0.15, ey - s * 0.113, ex + rw * 0.95, ey - s * 0.079);
    g.stroke();
  }

  // small curved smile
  g.strokeStyle = ink;
  g.lineWidth = Math.max(1.6, s * 0.0058);
  g.lineCap = 'round';
  const [mx, my] = P(0.5, 0.645);
  g.beginPath();
  g.moveTo(mx - s * 0.052, my - s * 0.004);
  g.quadraticCurveTo(mx, my + s * 0.036, mx + s * 0.052, my - s * 0.004);
  g.stroke();
  // stitch gaps along the smile, so it reads as thread rather than paint
  g.globalCompositeOperation = 'destination-out';
  g.lineWidth = Math.max(1, s * 0.0022);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const px = mx - s * 0.052 + t * s * 0.104;
    const py = my - s * 0.004 + Math.sin(t * Math.PI) * s * 0.02;
    g.beginPath(); g.moveTo(px, py - s * 0.006); g.lineTo(px, py + s * 0.006); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
}

/* ------------------------------------------------------------------ *
 * Embroidered name — transparent canvas, satin-stitch look.
 * ------------------------------------------------------------------ */
function drawName(canvas, name, color) {
  const g = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  g.clearRect(0, 0, w, h);
  if (!name) return;

  let size = Math.round(h * 0.60);
  const font = px => `italic 600 ${px}px "Snell Roundhand", "Brush Script MT", "Segoe Script", "Apple Chancery", cursive`;
  g.font = font(size);
  while (g.measureText(name).width > w * 0.92 && size > 18) {
    size -= 3;
    g.font = font(size);
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(name, w / 2, h * 0.52);

  // thread relief: a soft dark edge under the glyphs
  g.globalCompositeOperation = 'destination-over';
  g.strokeStyle = 'rgba(90,52,44,0.34)';
  g.lineWidth = Math.max(2, size * 0.04);
  g.strokeText(name, w / 2, h * 0.52 + Math.max(1, size * 0.014));
  g.globalCompositeOperation = 'source-over';

  // satin stitch gaps across the strokes
  g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = '#000';
  g.lineWidth = Math.max(1, size * 0.008);
  for (let x = 0; x < w; x += Math.max(3, size * 0.055)) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + size * 0.14, h); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
}

/* ------------------------------------------------------------------ *
 * Material set
 * ------------------------------------------------------------------ */
function createMaterials({ tier, colors = {} }) {
  const c = { ...DEFAULT_COLORS, ...colors };
  const disposables = [];

  const weave = new THREE.CanvasTexture(fabricCanvas(tier.fabricTex));
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.anisotropy = 4;
  disposables.push(weave);

  const bumpFor = (repeat, scale) => {
    const t = weave.clone();
    t.needsUpdate = true;
    t.repeat.set(repeat, repeat);
    disposables.push(t);
    return { bumpMap: t, bumpScale: scale };
  };

  const fabric = (name, color, opts = {}) => new THREE.MeshStandardMaterial({
    name,
    color: new THREE.Color(color),
    roughness: 0.94,
    metalness: 0,
    ...bumpFor(opts.repeat ?? 6, opts.bump ?? 0.012),
    ...opts.extra
  });

  // face patch texture states
  const faceCanvases = {};
  const faceTextures = {};
  for (const state of FACE_STATES) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = tier.faceTex;
    faceCanvases[state] = cv;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    faceTextures[state] = tex;
    disposables.push(tex);
  }
  const paintFace = () => {
    for (const state of FACE_STATES) {
      drawFace(faceCanvases[state], { eyes: c.eyes, blush: c.blush, lid: state });
      faceTextures[state].needsUpdate = true;
    }
  };
  paintFace();

  // name texture
  const nameCanvas = document.createElement('canvas');
  nameCanvas.width = Math.min(1024, tier.faceTex);
  nameCanvas.height = Math.round(nameCanvas.width / 3.2);
  const nameTex = new THREE.CanvasTexture(nameCanvas);
  nameTex.colorSpace = THREE.SRGBColorSpace;
  nameTex.anisotropy = 4;
  disposables.push(nameTex);

  const materials = {
    skin:  fabric('skin', c.skin, { repeat: 7, bump: 0.014 }),
    hair:  fabric('hair', c.hair, { repeat: 3, bump: 0.006, extra: { roughness: 0.72 } }),
    eyes:  new THREE.MeshStandardMaterial({
      name: 'eyes', map: faceTextures.open, transparent: true, roughness: 0.9, metalness: 0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }),
    dress: fabric('dress', c.dress, { repeat: 8, bump: 0.016, extra: { side: THREE.DoubleSide } }),
    lace:  fabric('lace', c.lace, { repeat: 12, bump: 0.02, extra: { side: THREE.DoubleSide, roughness: 0.97 } }),
    blush: fabric('blush', c.blush, { repeat: 7 }),
    shoes: fabric('shoes', c.shoes, { repeat: 9, bump: 0.01, extra: { roughness: 0.78 } }),
    socks: fabric('socks', c.socks, { repeat: 14, bump: 0.024 }),
    bow:   fabric('bow', c.bow, { repeat: 10, bump: 0.014 }),
    name_embroidery: new THREE.MeshStandardMaterial({
      name: 'name_embroidery', map: nameTex, bumpMap: nameTex, bumpScale: 0.05,
      transparent: true, roughness: 0.88, metalness: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
    })
  };

  let currentName = '';
  const api = {
    materials,
    colors: c,
    faceTextures,
    setName(raw) {
      currentName = sanitizeName(raw);
      drawName(nameCanvas, currentName, c.name_embroidery);
      nameTex.needsUpdate = true;
      materials.name_embroidery.visible = currentName.length > 0;
      return currentName;
    },
    getName: () => currentName,
    setColors(next) {
      let facesDirty = false;
      for (const [key, value] of Object.entries(next || {})) {
        if (!(key in materials) && key !== 'blush' && key !== 'name_embroidery') continue;
        const hex = validateColor(value);
        if (!hex) continue;
        c[key] = hex;
        if (key === 'eyes' || key === 'blush') facesDirty = true;
        else if (key === 'name_embroidery') api.setName(currentName);
        else if (materials[key]) materials[key].color.set(hex);
      }
      if (facesDirty) paintFace();
      return { ...c };
    },
    setLid(state) {
      const tex = faceTextures[state] || faceTextures.open;
      if (materials.eyes.map !== tex) {
        materials.eyes.map = tex;
        materials.eyes.needsUpdate = true;
      }
    },
    dispose() {
      for (const m of Object.values(materials)) m.dispose();
      for (const t of disposables) t.dispose();
    }
  };
  api.setName('');
  return api;
}


export { DEFAULT_COLORS, validateColor, MAX_NAME_LENGTH, sanitizeName, createMaterials };
