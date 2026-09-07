// Ported from a standalone landing-page bundle; original module path: dollz/hero/src/animation.js


/**
 * Idle + entrance motion. Deliberately tiny: breathing, a slow sway, a
 * lagging hair response, and an occasional blink. Everything is driven
 * from one clock so the ~10s loop closes seamlessly.
 */
const LOOP = 10.4;          // seconds
const ENTRANCE = 1.5;       // seconds

function createAnimator({ parts, materials, reducedMotion = false }) {
  const rest = {
    bodyY: parts.body.position.y,
    headRot: { x: parts.headPivot.rotation.x, y: parts.headPivot.rotation.y, z: parts.headPivot.rotation.z },
    arms: parts.arms.map(a => a.rotation.z),
    lockRot: parts.locks.map(l => l.rotation.z)
  };

  let reduced = reducedMotion;
  let blinkAt = 3.2;
  let lid = 'open';
  let swayVel = 0;
  let sway = 0;

  const setLid = state => {
    if (state !== lid) {
      lid = state;
      materials.setLid(state);
    }
  };

  const api = {
    entranceDone: reduced,
    /** 0 → 1 while the doll fades and rises into place. */
    entranceProgress: reduced ? 1 : 0,

    setReducedMotion(value) {
      reduced = !!value;
      if (reduced) {
        api.entranceProgress = 1;
        api.entranceDone = true;
        parts.body.position.y = rest.bodyY;
        parts.body.rotation.set(0, 0, 0);
        parts.headPivot.rotation.set(rest.headRot.x, rest.headRot.y, rest.headRot.z);
        parts.hairGroup.rotation.set(0, 0, 0);
        parts.arms.forEach((a, i) => { a.rotation.z = rest.arms[i]; });
        parts.locks.forEach((l, i) => { l.rotation.z = rest.lockRot[i]; });
        setLid('open');
      }
    },

    /**
     * @param {number} t   seconds since the hero became visible
     * @param {number} dt  seconds since the previous frame
     * @returns {{opacity:number, yOffset:number, spin:number}} entrance values
     *          the host applies to the group and the crossfade.
     */
    update(t, dt) {
      if (reduced) return { opacity: 1, yOffset: 0, spin: 0 };

      // ---- entrance: fade in, lift slightly, settle into three-quarter ----
      const e = Math.min(1, t / ENTRANCE);
      const eased = 1 - Math.pow(1 - e, 3);
      api.entranceProgress = eased;
      api.entranceDone = e >= 1;

      // ---- idle: breathing ----
      const phase = (t % LOOP) / LOOP * Math.PI * 2;
      const breath = Math.sin(phase * 2);
      parts.body.scale.set(1 + breath * 0.004, 1 + breath * 0.0022, 1 + breath * 0.005);
      parts.body.position.y = rest.bodyY + breath * 0.0012;

      // ---- idle: sway, critically damped toward a slow target ----
      const target = Math.sin(phase) * 0.020 + Math.sin(phase * 0.5 + 1.1) * 0.008;
      const k = 6.5, c = 4.6;
      swayVel += (k * (target - sway) - c * swayVel) * Math.min(dt, 0.05);
      sway += swayVel * Math.min(dt, 0.05);
      parts.body.rotation.z = sway;
      parts.body.rotation.y = Math.sin(phase * 0.5) * 0.030;

      // ---- head: a little counter-rotation, never a turn ----
      parts.headPivot.rotation.z = rest.headRot.z - sway * 0.45;
      parts.headPivot.rotation.y = rest.headRot.y + Math.sin(phase * 0.5 + 0.6) * 0.035;
      parts.headPivot.rotation.x = rest.headRot.x + Math.sin(phase * 2 + 0.4) * 0.008;

      // ---- hair: the whole mass lags, individual locks lag more ----
      parts.hairGroup.rotation.z = -sway * 0.85;
      parts.hairGroup.rotation.x = Math.sin(phase - 0.5) * 0.012;
      for (let i = 0; i < parts.locks.length; i++) {
        const l = parts.locks[i];
        l.rotation.z = rest.lockRot[i] - sway * l.userData.lag * 1.25;
      }

      // ---- arms: a barely-there follow-through ----
      parts.arms.forEach((a, i) => {
        const s = i === 0 ? -1 : 1;
        a.rotation.z = rest.arms[i] + sway * 0.5 + Math.sin(phase + i) * 0.006 * s;
      });

      // ---- dress: a slight delayed twist ----
      if (parts.skirt) parts.skirt.rotation.y = -sway * 0.5;

      // ---- blink ----
      if (t > blinkAt) {
        const d = t - blinkAt;
        if (d < 0.055) setLid('half');
        else if (d < 0.14) setLid('closed');
        else if (d < 0.2) setLid('half');
        else {
          setLid('open');
          blinkAt = t + 3.6 + Math.random() * 3.4;
        }
      }

      return {
        opacity: eased,
        yOffset: (1 - eased) * -0.02,
        spin: (1 - eased) * 0.5
      };
    },

    reset() {
      api.setReducedMotion(true);
      api.setReducedMotion(reducedMotion);
      sway = 0; swayVel = 0; blinkAt = 3.2;
    }
  };

  return api;
}


export { createAnimator };
