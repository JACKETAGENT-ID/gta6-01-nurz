// city.js — Neon Bay itself: a deterministic street grid, blocks, buildings,
// parks and districts, all generated from one seed. No real-world map is copied:
// Neon Bay is a fictional neon city invented for this game.
import { makeRng } from './rng.js';

export const PITCH = 240; // street pitch: road + block
export const ROAD_W = 48; // street width
export const BLOCK = PITCH - ROAD_W; // city block size
export const BLOCKS = 13; // blocks per side
export const WORLD = PITCH * BLOCKS; // 3120 px square

const DISTRICTS = [
  'Lumen Strip', 'Pelabuhan Kaca', 'Distrik Volt', 'Kota Tua Neon',
  'Pasar Malam', 'Dermaga Biru', 'Bukit Sinyal', 'Kawasan Aurora',
];

export function districtName(x, y) {
  const i = Math.max(0, Math.min(3, Math.floor(x / WORLD * 4)));
  const j = Math.max(0, Math.min(1, Math.floor(y / WORLD * 2)));
  return DISTRICTS[j * 4 + i];
}

export function isRoadAt(x, y) {
  if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return false;
  const xm = ((x % PITCH) + PITCH) % PITCH;
  const ym = ((y % PITCH) + PITCH) % PITCH;
  return xm < ROAD_W || ym < ROAD_W;
}

export function roadCenter(k) {
  return k * PITCH + ROAD_W / 2;
}

export function intersection(i, j) {
  return { x: roadCenter(i), y: roadCenter(j) };
}

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function nearestIntersectionIndex(v) {
  return Math.round((v - ROAD_W / 2) / PITCH);
}

// The next street intersection on a Manhattan route from (x, y) to (tx, ty):
// first reach the nearest intersection, then walk the grid one block at a time.
// Cars (player autopilot and police) steer at this, never diagonally through
// buildings, so a chase stays on the streets.
export function nextWaypoint(x, y, tx, ty) {
  const ix = clampInt(nearestIntersectionIndex(x), 0, BLOCKS - 1);
  const iy = clampInt(nearestIntersectionIndex(y), 0, BLOCKS - 1);
  const txi = clampInt(nearestIntersectionIndex(tx), 0, BLOCKS - 1);
  const tyi = clampInt(nearestIntersectionIndex(ty), 0, BLOCKS - 1);
  const here = intersection(ix, iy);
  if (Math.hypot(x - here.x, y - here.y) > 26) return here;
  if (ix !== txi) return intersection(ix + Math.sign(txi - ix), iy);
  if (iy !== tyi) return intersection(ix, iy + Math.sign(tyi - iy));
  return { x: tx, y: ty };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const byBlock = new Map();
  const palette = ['#1d2b4a', '#2a1e3f', '#3f1e33', '#142e2b', '#33241a', '#241a33', '#1c2438'];
  const neon = ['#22d3ee', '#f472b6', '#facc15', '#a3e635', '#fb7185', '#818cf8'];
  for (let i = 0; i < BLOCKS; i += 1) {
    for (let j = 0; j < BLOCKS; j += 1) {
      const bx = i * PITCH + ROAD_W;
      const by = j * PITCH + ROAD_W;
      if (rng.next() < 0.13) {
        parks.push({ x: bx, y: by, w: BLOCK, h: BLOCK, trees: rng.int(3, 6), seed: rng.int(0, 99999) });
        byBlock.set(i + ',' + j, []);
        continue;
      }
      const list = [];
      const count = 1 + Math.floor(rng.next() * 2);
      for (let b = 0; b < count; b += 1) {
        const w = 62 + rng.range(0, 88);
        const h = 62 + rng.range(0, 88);
        const x = bx + 10 + rng.range(0, Math.max(1, BLOCK - w - 20));
        const y = by + 10 + rng.range(0, Math.max(1, BLOCK - h - 20));
        let ok = true;
        for (const o of list) {
          if (x < o.x + o.w + 10 && x + w + 10 > o.x && y < o.y + o.h + 10 && y + h + 10 > o.y) ok = false;
        }
        if (!ok) continue;
        const windows = [];
        const cols = Math.max(1, Math.floor(w / 22));
        const rows = Math.max(1, Math.floor(h / 22));
        for (let cx = 0; cx < cols; cx += 1) {
          for (let cy = 0; cy < rows; cy += 1) {
            if (rng.next() < 0.55) {
              windows.push({ x: x + 6 + cx * 22, y: y + 6 + cy * 22, lit: rng.next() < 0.6 });
            }
          }
        }
        const bd = { x, y, w, h, color: rng.pick(palette), edge: rng.pick(neon), windows };
        buildings.push(bd);
        list.push(bd);
      }
      byBlock.set(i + ',' + j, list);
    }
  }
  return { seed, buildings, parks, byBlock };
}

// The building a circle at (x, y) with radius r touches, or null.
export function collideBuildings(city, x, y, r) {
  const i0 = Math.floor((x - r) / PITCH);
  const i1 = Math.floor((x + r) / PITCH);
  const j0 = Math.floor((y - r) / PITCH);
  const j1 = Math.floor((y + r) / PITCH);
  for (let i = i0; i <= i1; i += 1) {
    for (let j = j0; j <= j1; j += 1) {
      const list = city.byBlock.get(i + ',' + j);
      if (!list) continue;
      for (const b of list) {
        const cx = Math.max(b.x, Math.min(x, b.x + b.w));
        const cy = Math.max(b.y, Math.min(y, b.y + b.h));
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < r * r) return b;
      }
    }
  }
  return null;
}

export function pointInBuilding(city, x, y) {
  return collideBuildings(city, x, y, 1) !== null;
}

// Draw only the visible slice of the city: ground, streets, markings, parks,
// buildings with lit windows, and faint district labels.
export function drawCity(ctx, city, cam, vw, vh, time) {
  ctx.fillStyle = '#100c1c';
  ctx.fillRect(cam.x, cam.y, vw, vh);
  // City blocks (the ground between streets).
  ctx.fillStyle = '#171226';
  const i0 = Math.max(0, Math.floor(cam.x / PITCH) - 1);
  const i1 = Math.min(BLOCKS - 1, Math.ceil((cam.x + vw) / PITCH));
  const j0 = Math.max(0, Math.floor(cam.y / PITCH) - 1);
  const j1 = Math.min(BLOCKS - 1, Math.ceil((cam.y + vh) / PITCH));
  for (let i = i0; i <= i1; i += 1) {
    for (let j = j0; j <= j1; j += 1) {
      ctx.fillRect(i * PITCH + ROAD_W, j * PITCH + ROAD_W, BLOCK, BLOCK);
    }
  }
  // Streets.
  ctx.fillStyle = '#262233';
  for (let k = Math.max(0, Math.floor(cam.x / PITCH) - 1); k <= Math.min(BLOCKS, Math.ceil((cam.x + vw) / PITCH)); k += 1) {
    ctx.fillRect(k * PITCH, cam.y - 4, ROAD_W, vh + 8);
  }
  for (let k = Math.max(0, Math.floor(cam.y / PITCH) - 1); k <= Math.min(BLOCKS, Math.ceil((cam.y + vh) / PITCH)); k += 1) {
    ctx.fillRect(cam.x - 4, k * PITCH, vw + 8, ROAD_W);
  }
  // Dashed centre lines.
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (let k = Math.max(0, Math.floor(cam.x / PITCH) - 1); k <= Math.min(BLOCKS, Math.ceil((cam.x + vw) / PITCH)); k += 1) {
    const cx = roadCenter(k);
    ctx.moveTo(cx, cam.y);
    ctx.lineTo(cx, cam.y + vh);
  }
  for (let k = Math.max(0, Math.floor(cam.y / PITCH) - 1); k <= Math.min(BLOCKS, Math.ceil((cam.y + vh) / PITCH)); k += 1) {
    const cy = roadCenter(k);
    ctx.moveTo(cam.x, cy);
    ctx.lineTo(cam.x + vw, cy);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // Parks.
  for (const p of city.parks) {
    if (p.x > cam.x + vw || p.y > cam.y + vh || p.x + p.w < cam.x || p.y + p.h < cam.y) continue;
    ctx.fillStyle = '#0f2a1c';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
    ctx.fillStyle = '#16a34a';
    const prng = makeRng(p.seed);
    for (let t = 0; t < p.trees; t += 1) {
      const tx = p.x + 20 + prng.range(0, p.w - 40);
      const ty = p.y + 20 + prng.range(0, p.h - 40);
      ctx.beginPath();
      ctx.arc(tx, ty, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Buildings with neon rims and lit windows.
  for (let i = i0; i <= i1; i += 1) {
    for (let j = j0; j <= j1; j += 1) {
      const list = city.byBlock.get(i + ',' + j);
      if (!list) continue;
      for (const b of list) {
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = b.edge;
        ctx.globalAlpha = 0.55 + 0.25 * Math.sin(time * 1.4 + b.x * 0.01);
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
        ctx.globalAlpha = 1;
        for (const w of b.windows) {
          ctx.fillStyle = w.lit ? 'rgba(253, 230, 138, 0.85)' : 'rgba(30, 41, 59, 0.9)';
          ctx.fillRect(w.x, w.y, 10, 12);
        }
      }
    }
  }
  // District labels, faint, at a few intersections.
  ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const labels = [
    [2, 2, 'LUMEN STRIP'], [9, 3, 'PELABUHAN KACA'], [3, 9, 'PASAR MALAM'], [9, 10, 'BUKIT SINYAL'],
  ];
  for (const [li, lj, text] of labels) {
    const cx = roadCenter(li);
    const cy = roadCenter(lj);
    if (cx > cam.x - 100 && cx < cam.x + vw + 100 && cy > cam.y - 100 && cy < cam.y + vh + 100) {
      ctx.fillText(text, cx, cy - 34);
    }
  }
}
