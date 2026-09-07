// Ported from a standalone landing-page bundle; original module path: dollz/hero/src/geometry.js
import * as THREE from 'three';



/* ------------------------------------------------------------------ *
 * Small lofting helpers. Every soft body part is a swept elliptical
 * tube with rounded ends, which reads as stuffed cloth rather than as
 * a stack of primitives.
 * ------------------------------------------------------------------ */

/**
 * sweep(): builds a closed, smooth-shaded volume from a centre path plus
 * an elliptical cross-section that varies along it.
 *  path(t)   -> [x, y, z]
 *  section(t)-> [radiusX, radiusZ]   (0 at both ends closes the shape)
 */
function sweep(path, section, { steps = 28, radial = 32, name = 'part' } = {}) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [cx, cy, cz] = path(t);
    const [rx, rz] = section(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push(cx + Math.cos(a) * rx, cy, cz + Math.sin(a) * rz);
      uv.push(j / radial, t);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j, b = a + ring;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.name = name;
  return geo;
}

/** A flat ring whose outer edge can scallop — used for the lace collar. */
function annulus(inner, outerFn, { radial = 96, name = 'ring' } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= radial; j++) {
    const a = (j / radial) * Math.PI * 2;
    const ro = outerFn(j / radial);
    pos.push(Math.cos(a) * inner, 0, Math.sin(a) * inner);
    uv.push(j / radial, 0);
    pos.push(Math.cos(a) * ro, -Math.abs(ro - inner) * 0.35, Math.sin(a) * ro);
    uv.push(j / radial, 1);
  }
  for (let j = 0; j < radial; j++) {
    const a = j * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.name = name;
  return geo;
}

/** A gathered skirt: a lofted cone with sinusoidal pleats around it. */
function skirt({ top, hem, rTop, rHem, pleats, depth, radial, name }) {
  const steps = 26;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = top + (hem - top) * t;
    const base = rTop + (rHem - rTop) * Math.pow(t, 0.78);
    const amp = depth * Math.pow(t, 0.55);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const r = base + Math.sin(a * pleats) * amp;
      pos.push(Math.cos(a) * r, y - Math.abs(Math.sin(a * pleats)) * amp * 0.25, Math.sin(a) * r);
      uv.push(j / radial * 4, t * 2);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j, b = a + ring;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.name = name;
  return geo;
}

/**
 * A hair lock: a tapered ribbon swept along a wavy 3D path. Ribbons —
 * rather than tubes — are what keep the hair from reading as spaghetti.
 */
function lock({ start, angle, len, width, wave, phase, drift, radial, name }) {
  const steps = 26;
  const pos = [], uv = [], idx = [];
  const dirX = Math.sin(angle), dirZ = Math.cos(angle);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // fall away from the skull, wave twice, then curl gently inward at the tip
    const out = 1
      + Math.sin(Math.min(t * 2.1, 1) * Math.PI / 2) * 0.30
      + Math.sin(t * 3.4 + phase) * wave
      + Math.sin(t * 7.1 + phase * 1.7) * wave * 0.4
      - Math.pow(t, 3) * 0.26;
    const cx = start[0] * out + dirX * drift * Math.sin(t * Math.PI);
    const cz = start[2] * out + dirZ * drift * Math.sin(t * Math.PI);
    const cy = start[1] - len * t - Math.pow(t, 2.4) * len * 0.06;
    // wide near the crown, drawn to a soft point at the tip
    const w = width
      * (0.62 + 0.38 * Math.sin(Math.min(t * 5, 1) * Math.PI / 2))
      * (1 - Math.pow(t, 2.4) * 0.66);
    const thick = w * 0.5;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      // ribbon cross-section: wide, flat, rounded edges
      const px = Math.cos(a) * w;
      const pz = Math.sin(a) * thick;
      pos.push(cx + px * dirZ + pz * dirX, cy, cz - px * dirX + pz * dirZ);
      uv.push(j / radial, t * 3);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j, b = a + ring;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.name = name;
  return geo;
}

/* ------------------------------------------------------------------ *
 * Proportions. Both sizes are the same character; the 25 cm body has a
 * proportionally larger head and shorter limbs, as the real pair does.
 * All units are metres, so 0.40 === the finished 40 cm doll.
 * ------------------------------------------------------------------ */
const SIZES = {
  '40': {
    cm: 40, height: 0.400,
    headH: 0.104, headW: 0.094, headD: 0.064,
    hipY: 0.176, shoulderY: 0.272, neckTop: 0.296,
    shoulderHalf: 0.040, waistHalf: 0.033, hipHalf: 0.042, bodyDepth: 0.60,
    armLen: 0.118, armR: 0.0115, legLen: 0.176, legR: 0.0145,
    hairLen: 0.215, lockWidth: 0.0145, locks: 21,
    skirtHem: 0.116, skirtR: 0.086
  },
  '25': {
    cm: 25, height: 0.250,
    headH: 0.075, headW: 0.068, headD: 0.046,
    hipY: 0.100, shoulderY: 0.163, neckTop: 0.178,
    shoulderHalf: 0.026, waistHalf: 0.022, hipHalf: 0.028, bodyDepth: 0.60,
    armLen: 0.072, armR: 0.0082, legLen: 0.100, legR: 0.0098,
    hairLen: 0.120, lockWidth: 0.0104, locks: 19,
    skirtHem: 0.064, skirtR: 0.056
  }
};

/* ------------------------------------------------------------------ *
 * buildDoll()
 * Returns { group, parts, stats }. `parts` exposes the nodes the
 * animation layer needs; every mesh and material is named for handoff.
 * ------------------------------------------------------------------ */
function buildDoll({ size = '40', materials, tier }) {
  const P = SIZES[size] || SIZES['40'];
  const M = materials.materials;
  const radial = tier.radial;
  const geometries = [];

  const group = new THREE.Group();
  group.name = `doll_${P.cm}cm`;

  const body = new THREE.Group();      // breathes and sways
  body.name = 'body';
  const headPivot = new THREE.Group(); // micro head motion
  headPivot.name = 'head_pivot';
  const hairGroup = new THREE.Group(); // lags behind the body
  hairGroup.name = 'hair';

  const mesh = (name, geo, mat, parent = body) => {
    geometries.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = tier.shadows;
    m.receiveShadow = tier.shadows;
    parent.add(m);
    return m;
  };

  /* ---- torso: one lofted stuffed shape from hip to neck ---- */
  const torsoProfile = t => {
    // t: 0 at hip, 1 at neck top
    const y = P.hipY + (P.neckTop - P.hipY) * t;
    return [0, y, 0];
  };
  const torsoSection = t => {
    let r;
    if (t < 0.06) r = P.hipHalf * (0.55 + 0.45 * Math.sqrt(t / 0.06));
    else if (t < 0.34) r = P.hipHalf - (P.hipHalf - P.waistHalf) * ((t - 0.06) / 0.28);
    else if (t < 0.78) r = P.waistHalf + (P.shoulderHalf - P.waistHalf) * Math.pow((t - 0.34) / 0.44, 0.85);
    else r = P.shoulderHalf * (1 - Math.pow((t - 0.78) / 0.22, 1.5) * 0.72);
    return [r, r * P.bodyDepth];
  };
  mesh('torso', sweep(torsoProfile, torsoSection, { steps: 34, radial, name: 'torso' }), M.skin);

  /* ---- head: flat oval cloth head on a short neck ---- */
  const headY = P.neckTop + P.headH * 0.46;
  const headGeo = new THREE.SphereGeometry(P.headH / 2, radial, Math.round(radial * 0.8));
  headGeo.scale(P.headW / P.headH, 1.0, P.headD / P.headH);
  // gentle jaw taper so the chin is narrower than the cranium
  {
    const pos = headGeo.attributes.position;
    const r = P.headH / 2;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const k = y < 0 ? 1 - Math.pow(-y / r, 2.4) * 0.13 : 1;
      pos.setX(i, pos.getX(i) * k);
      pos.setZ(i, pos.getZ(i) * k);
    }
    pos.needsUpdate = true;
    headGeo.computeVertexNormals();
  }
  headPivot.position.set(0, P.neckTop, 0);
  body.add(headPivot);
  const head = mesh('head', headGeo, M.skin, headPivot);
  head.position.y = headY - P.neckTop;

  mesh('neck', sweep(
    t => [0, -P.headH * 0.10 + t * P.headH * 0.16, 0],
    t => { const r = P.shoulderHalf * (0.30 - 0.04 * t); return [r, r * 0.85]; },
    { steps: 8, radial, name: 'neck' }
  ), M.skin, headPivot);

  /* ---- face: a spherical patch just above the skin, UVs 0..1 ---- */
  const faceGeo = new THREE.SphereGeometry(
    P.headH / 2 * 1.004, 48, 48,
    Math.PI * 0.5 - 0.62, 1.24,        // phi: centred on +Z
    Math.PI * 0.24, Math.PI * 0.52     // theta: the front of the face
  );
  faceGeo.scale(P.headW / P.headH, 1.0, P.headD / P.headH);
  const face = mesh('face_embroidery', faceGeo, M.eyes, headPivot);
  face.position.y = headY - P.neckTop;
  face.castShadow = false;

  /* ---- arms ---- */
  for (const s of [-1, 1]) {
    const tag = s < 0 ? 'left' : 'right';
    const arm = new THREE.Group();
    arm.name = `arm_${tag}`;
    arm.position.set(s * P.shoulderHalf * 0.86, P.shoulderY, 0);
    arm.rotation.z = s * 0.30;   // hangs clear of the skirt
    arm.rotation.x = 0.04;
    body.add(arm);
    geometries.push();
    const g = sweep(
      t => [s * Math.sin(t * 0.9) * P.armLen * 0.10, -t * P.armLen, Math.sin(t * Math.PI) * P.armLen * 0.02],
      t => {
        const taper = 1 - Math.pow(t, 1.3) * 0.34;
        const end = t > 0.90 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.90) / 0.10, 2))) : 1;
        const cap = t < 0.05 ? Math.sqrt(t / 0.05) : 1;
        const r = P.armR * taper * end * cap;
        return [r, r * 0.82];
      },
      { steps: 26, radial: Math.max(14, radial - 12), name: `arm_${tag}` }
    );
    const m = new THREE.Mesh(g, M.skin);
    m.name = `arm_${tag}`;
    m.castShadow = tier.shadows;
    geometries.push(g);
    arm.add(m);

    // a small mitten hand at the wrist
    const handGeo = new THREE.SphereGeometry(P.armR * 1.12, 22, 16);
    handGeo.scale(0.92, 1.35, 0.66);
    geometries.push(handGeo);
    const hand = new THREE.Mesh(handGeo, M.skin);
    hand.name = `hand_${tag}`;
    hand.castShadow = tier.shadows;
    hand.position.set(s * Math.sin(0.9) * P.armLen * 0.10, -P.armLen * 0.975, 0);
    arm.add(hand);

    arm.userData.rest = arm.rotation.z;
  }

  /* ---- legs, socks, shoes ---- */
  const ankle = P.legLen * 0.115;
  for (const s of [-1, 1]) {
    const tag = s < 0 ? 'left' : 'right';
    const legX = s * P.hipHalf * 0.52;
    const g = sweep(
      t => [legX * (0.82 + 0.18 * t), P.hipY - t * (P.legLen - ankle * 0.4), 0],
      t => {
        const thigh = 1 - Math.pow(t, 1.15) * 0.36;
        const cap = t < 0.05 ? Math.sqrt(t / 0.05) : 1;
        const end = t > 0.93 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.93) / 0.07, 2))) : 1;
        const r = P.legR * thigh * cap * end;
        return [r, r * 0.88];
      },
      { steps: 26, radial: Math.max(14, radial - 12), name: `leg_${tag}` }
    );
    mesh(`leg_${tag}`, g, M.skin);

    // sock: a short cuffed sleeve over the ankle
    mesh(`sock_${tag}`, sweep(
      t => [legX * (0.97 + 0.03 * t), ankle * 2.6 - t * ankle * 1.9, 0],
      t => {
        const r = P.legR * (0.80 + 0.30 * Math.pow(1 - t, 2.2));
        return [r, r * 0.9];
      },
      { steps: 12, radial: Math.max(14, radial - 12), name: `sock_${tag}` }
    ), M.socks);

    // Mary Jane: a soft rounded foot pad plus a strap
    const footGeo = new THREE.SphereGeometry(P.legR * 1.26, 28, 22);
    footGeo.scale(0.86, 0.72, 1.42);
    const foot = mesh(`shoe_${tag}`, footGeo, M.shoes);
    foot.position.set(legX, P.legR * 0.86, P.legR * 0.5);

    const strapGeo = new THREE.TorusGeometry(P.legR * 0.94, P.legR * 0.15, 10, 26);
    const strap = mesh(`shoe_strap_${tag}`, strapGeo, M.shoes);
    strap.position.set(legX, P.legR * 1.55, P.legR * 0.06);
    strap.rotation.set(Math.PI / 2 - 0.22, 0, 0);
  }

  /* ---- dress: bodice, lace collar, gathered skirt, name ---- */
  const waistY = P.hipY + (P.neckTop - P.hipY) * 0.30;
  const bodice = mesh('dress_bodice', sweep(
    t => [0, waistY - P.headH * 0.06 + t * (P.shoulderY + (P.neckTop - P.shoulderY) * 0.55 - waistY + P.headH * 0.06), 0],
    t => {
      const base = torsoSection(Math.min(1, 0.28 + t * 0.62));
      const pad = 1.055 + 0.02 * Math.sin(t * Math.PI);
      return [base[0] * pad, base[1] * pad * 1.06];
    },
    { steps: 22, radial, name: 'dress_bodice' }
  ), M.dress);
  void bodice;

  const skirtTop = waistY + P.headH * 0.02;
  mesh('dress_skirt', skirt({
    top: skirtTop,
    hem: P.skirtHem,
    rTop: P.waistHalf * 1.14,
    rHem: P.skirtR,
    pleats: 26,
    depth: P.waistHalf * 0.062,
    radial: Math.max(48, radial * 2),
    name: 'dress_skirt'
  }), M.dress);

  const collarY = P.shoulderY + (P.neckTop - P.shoulderY) * 0.62;
  const collarInner = P.shoulderHalf * 0.52;
  const collar = mesh('lace_collar', annulus(
    collarInner,
    u => collarInner + P.shoulderHalf * (0.30 + 0.16 * Math.abs(Math.sin(u * Math.PI * 14))),
    { radial: Math.max(72, radial * 2), name: 'lace_collar' }
  ), M.lace);
  collar.position.y = collarY;
  collar.scale.set(1, 1, P.bodyDepth * 1.25);

  // name patch: an arc of the bodice surface, offset a hair outward
  const nameY = waistY + (P.shoulderY - waistY) * 0.62;
  const nameSection = torsoSection(0.55);
  // The patch must sit just OUTSIDE the padded bodice surface, or it hides
  // inside it. Bodice pad is 1.055 + up to 0.02, so clear it by ~3%.
  const nameGeo = new THREE.CylinderGeometry(
    nameSection[0] * 1.108, nameSection[0] * 1.108,
    P.headH * 0.34, 56, 1, true,
    -0.70, 1.40
  );
  nameGeo.scale(1, 1, P.bodyDepth * 1.10);
  const namePatch = mesh('name_embroidery', nameGeo, M.name_embroidery);
  namePatch.position.y = nameY;
  namePatch.castShadow = false;

  /* ---- hair: centre-parted cap, framing locks, long back locks ---- */
  headPivot.add(hairGroup);
  hairGroup.position.y = headY - P.neckTop;

  const hairR = P.headH / 2 * 1.03;
  const capGeo = new THREE.SphereGeometry(hairR, radial, Math.round(radial * 0.7), 0, Math.PI * 2, 0, Math.PI * 0.46);
  capGeo.scale(P.headW / P.headH * 1.03, 1.06, P.headD / P.headH * 1.05);
  // lift and set back the front of the cap: a centre-parted hairline that
  // leaves the whole embroidered face open, as on the real doll
  {
    const pos = capGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i), y = pos.getY(i);
      if (z > 0) {
        pos.setY(i, y + z * 0.62);
        pos.setZ(i, z * 0.92);
      }
    }
    pos.needsUpdate = true;
    capGeo.computeVertexNormals();
  }
  const cap = new THREE.Mesh(capGeo, M.hair);
  cap.name = 'hair_cap';
  cap.castShadow = tier.shadows;
  geometries.push(capGeo);
  hairGroup.add(cap);

  const lockRadial = Math.max(10, Math.round(radial * 0.36));
  const spread = 132;                      // degrees each side of centre-back
  const jitter = i => (Math.sin(i * 12.9898) * 43758.5453) % 1;
  for (let i = 0; i < P.locks; i++) {
    const u = P.locks === 1 ? 0.5 : i / (P.locks - 1);
    const deg = 180 - spread + u * spread * 2;
    const a = deg * Math.PI / 180;
    const frontness = Math.abs(deg - 180) / spread;   // 0 back, 1 at the face
    const rx = Math.sin(a) * P.headW * 0.47;
    const rz = Math.cos(a) * P.headD * 0.62;
    // locks start at the hairline, higher at the temples than at the nape
    const startY = hairR * (0.30 + 0.34 * frontness);
    const r = Math.abs(jitter(i + 1));
    const len = P.hairLen
      * (0.74 + 0.26 * (1 - frontness * 0.45))  // shorter at the face
      * (0.90 + 0.18 * r);                      // staggered ends, no cut line
    const g = lock({
      start: [rx, startY, rz],
      angle: a,
      len,
      width: P.lockWidth * (0.78 + 0.34 * (1 - frontness) + 0.14 * r),
      wave: 0.055 + 0.045 * r,
      phase: i * 1.7 + r * 3,
      drift: P.headW * (0.06 + 0.10 * r),
      radial: lockRadial,
      name: `hair_lock_${i}`
    });
    geometries.push(g);
    const m = new THREE.Mesh(g, M.hair);
    m.name = `hair_lock_${i}`;
    m.castShadow = tier.shadows;
    m.userData.lag = 0.35 + 0.65 * (1 - frontness);
    hairGroup.add(m);
  }

  /* ---- bow, worn to one side ---- */
  const bow = new THREE.Group();
  bow.name = 'bow';
  const loopGeo = new THREE.SphereGeometry(P.headH * 0.13, 24, 18);
  loopGeo.scale(1.35, 0.82, 0.5);
  for (const s of [-1, 1]) {
    const g = loopGeo.clone();
    geometries.push(g);
    const m = new THREE.Mesh(g, M.bow);
    m.name = `bow_loop_${s < 0 ? 'left' : 'right'}`;
    m.position.x = s * P.headH * 0.145;
    m.rotation.z = s * 0.42;
    m.castShadow = tier.shadows;
    bow.add(m);
  }
  const knotGeo = new THREE.SphereGeometry(P.headH * 0.055, 18, 14);
  geometries.push(knotGeo, loopGeo);
  const knot = new THREE.Mesh(knotGeo, M.bow);
  knot.name = 'bow_knot';
  knot.castShadow = tier.shadows;
  bow.add(knot);
  const flowerGeo = new THREE.SphereGeometry(P.headH * 0.028, 12, 10);
  geometries.push(flowerGeo);
  for (let i = 0; i < 5; i++) {
    const t = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(flowerGeo, M.lace);
    petal.name = `bow_flower_petal_${i}`;
    petal.position.set(Math.cos(t) * P.headH * 0.036, Math.sin(t) * P.headH * 0.036, P.headH * 0.05);
    bow.add(petal);
  }
  bow.position.set(P.headW * 0.30, hairR * 0.80, P.headD * 0.16);
  bow.rotation.set(0.30, 0.42, -0.22);
  hairGroup.add(bow);

  group.add(body);

  // sit the doll exactly on the ground plane
  const box = new THREE.Box3().setFromObject(group);
  group.position.y -= box.min.y;

  let tris = 0;
  group.traverse(o => {
    if (o.isMesh && o.geometry.index) tris += o.geometry.index.count / 3;
  });

  return {
    group,
    parts: {
      body,
      headPivot,
      hairGroup,
      locks: hairGroup.children.filter(c => c.name.startsWith('hair_lock')),
      arms: body.children.filter(c => c.name.startsWith('arm_')),
      skirt: body.getObjectByName('dress_skirt'),
      namePatch
    },
    stats: { triangles: Math.round(tris), meshes: geometries.length, height: P.height, cm: P.cm },
    dispose() {
      for (const g of geometries) g.dispose();
    }
  };
}


export { SIZES, buildDoll };
