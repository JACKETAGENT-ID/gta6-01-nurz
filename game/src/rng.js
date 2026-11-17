// Seeded randomness for Neon Bay Nights v3.
// One mulberry32 stream per world: buildings, traffic, pedestrians, mission
// spots and collectibles all flow from it, so a ?shot=...&seed=N staging is
// reproducible from the seed alone. Pure helpers (clamp, lerp, angles) live
// here too, so every module shares the same math.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Tiny integer hash for screen-space effects (rain, stars) that must not
// consume the world's random stream.
export function hash2(i, salt) {
  let h = (Math.imul(i + 1, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function makeRng(seed) {
  const next = mulberry32(typeof seed === 'number' ? seed : hashSeed(String(seed)));
  return {
    next,
    range(a, b) { return a + (b - a) * next(); },
    int(a, b) { return Math.floor(a + (b - a + 1) * next()); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    pickWeighted(pairs) {
      let total = 0;
      for (const [, w] of pairs) total += w;
      let roll = next() * total;
      for (const [v, w] of pairs) {
        roll -= w;
        if (roll <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
    chance(p) { return next() < p; },
    angle() { return next() * Math.PI * 2; },
    gauss() {
      // Rough bell curve from three uniforms, centred on 0.
      return (next() + next() + next() - 1.5) * 2;
    },
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = out[i]; out[i] = out[j]; out[j] = t;
      }
      return out;
    },
  };
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function turnToward(a, target, maxStep) {
  const d = angleDiff(a, target);
  return a + clamp(d, -maxStep, maxStep);
}
