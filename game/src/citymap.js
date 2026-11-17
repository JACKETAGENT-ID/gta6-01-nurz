// Neon Bay: the city itself. A seeded generator lays out the road grid, the three
// districts (Downtown, Old Docks, Coral Beach), buildings with neon signs and lit
// windows, the bank, and the spots where the neon packages hide. It also owns the
// road graph the traffic and the screenshot autopilot drive on, and the circle-vs-
// building collision every moving thing in the game uses.
import { CFG, PALETTE, NEON_SIGNS } from './config.js';

export function roadsX() {
  const out = [];
  for (let x = CFG.roadOff; x < CFG.worldW; x += CFG.roadGap) out.push(x);
  return out;
}

export function roadsY() {
  const out = [];
  for (let y = CFG.roadOff; y < CFG.worldH; y += CFG.roadGap) out.push(y);
  return out;
}

// Which district a point belongs to: Downtown north-west, Old Docks north-east,
// Coral Beach along the south shore, Midtown everywhere else.
export function districtAt(x, y) {
  if (y >= 1950) return 'beach';
  if (x >= 2250 && y <= 1050) return 'docks';
  if (x < 1650 && y < 1350) return 'downtown';
  return 'midtown';
}

function roofColor(district, rng) {
  if (district === 'downtown') return rng.pick(['#3d4a63', '#46587a', '#33415c', '#4a3d63']);
  if (district === 'docks') return rng.pick(['#6e4a33', '#5c4030', '#7a5a35']);
  if (district === 'beach') return rng.pick(['#8a6f4d', '#a5855c', '#7a6a4a']);
  return rng.pick(['#5a4a3d', '#4d4438', '#63523f', '#54423a']);
}

export function generateCity(rng) {
  const xs = roadsX();
  const ys = roadsY();
  const buildings = [];
  const containers = [];
  const trees = [];
  let signIndex = 0;

  // One block = the space between four roads. Each block gets one or two buildings,
  // set back from the road edge so sidewalks stay walkable.
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const bx = xs[bi] + CFG.roadHalf + 12;
      const by = ys[bj] + CFG.roadHalf + 12;
      const bw = CFG.roadGap - 2 * CFG.roadHalf - 24;
      const bh = CFG.roadGap - 2 * CFG.roadHalf - 24;
      const district = districtAt(bx + bw / 2, by + bh / 2);
      if (district === 'beach') {
        // Beach blocks stay open sand with a few palms, no buildings.
        const palms = rng.int(2, 5);
        for (let p = 0; p < palms; p += 1) {
          trees.push({ x: rng.range(bx + 20, bx + bw - 20), y: rng.range(by + 20, by + bh - 20), r: rng.range(9, 14) });
        }
        continue;
      }
      const count = district === 'docks' ? 1 : rng.int(1, 2);
      if (count === 1) {
        const w = rng.range(bw * 0.55, bw * 0.85);
        const h = rng.range(bh * 0.55, bh * 0.85);
        buildings.push(makeBuilding(bx + (bw - w) / 2, by + (bh - h) / 2, w, h, district, rng, signIndex));
        signIndex += 1;
      } else {
        const w1 = rng.range(bw * 0.4, bw * 0.48);
        const h1 = rng.range(bh * 0.5, bh * 0.8);
        buildings.push(makeBuilding(bx, by, w1, h1, district, rng, signIndex));
        signIndex += 1;
        buildings.push(makeBuilding(bx + bw - w1, by + (bh - h1) / 2, w1, h1, district, rng, signIndex));
        signIndex += 1;
      }
      if (district === 'docks') {
        // Container stacks fill the rest of a dock block.
        const n = rng.int(2, 4);
        for (let c = 0; c < n; c += 1) {
          containers.push({
            x: rng.range(bx + 10, bx + bw - 70),
            y: rng.range(by + 10, by + bh - 34),
            w: rng.range(44, 64),
            h: 26,
            color: rng.pick(['#b3541e', '#2e6f8e', '#7a8a2e', '#8e2e4d']),
          });
        }
      }
    }
  }

  // Neon Bay Bank: a fixed landmark in Downtown, with the vault ring on its forecourt.
  const bank = { x: 1050 + CFG.roadHalf + 12, y: 750 + CFG.roadHalf + 12, w: 150, h: 110 };
  buildings.push({
    x: bank.x, y: bank.y, w: bank.w, h: bank.h, c: '#8a7a4d', lit: true,
    sign: 'NEON BAY BANK', signColor: '#ffe14d', district: 'downtown', bank: true,
    windows: { cols: 5, rows: 4 },
  });
  const vaultRing = { x: bank.x + bank.w / 2, y: bank.y + bank.h + 64, r: 52 };

  // Twenty package spots: sidewalk corners spread across all three districts.
  const packageSpots = [];
  const tries = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  for (const t of tries) {
    const ix = rng.int(0, xs.length - 1);
    const iy = rng.int(0, ys.length - 1);
    const px = xs[ix] + rng.pick([-46, 46]) + rng.range(-8, 8);
    const py = ys[iy] + rng.pick([-46, 46]) + rng.range(-8, 8);
    packageSpots.push({ x: Math.max(60, Math.min(CFG.worldW - 60, px)), y: Math.max(60, Math.min(CFG.worldH - 60, py)), id: t });
  }

  return {
    xs, ys, buildings, containers, trees, bank, vaultRing, packageSpots,
    water: { x: 0, y: 2280, w: CFG.worldW, h: 120 },
    pier: { x: 2400, y: 2100, w: 420, h: 26 },
  };
}

function makeBuilding(x, y, w, h, district, rng, signIndex) {
  const signed = district === 'downtown' && signIndex % 2 === 0 && signIndex < NEON_SIGNS.length * 2;
  return {
    x, y, w, h,
    c: roofColor(district, rng),
    lit: rng.chance(0.75),
    sign: signed ? NEON_SIGNS[signIndex % NEON_SIGNS.length] : null,
    signColor: signed ? PALETTE.neon[signIndex % PALETTE.neon.length] : null,
    district,
    windows: { cols: Math.max(2, Math.floor(w / 26)), rows: Math.max(2, Math.floor(h / 26)) },
  };
}

// Snap a point to the nearest intersection of the road grid.
export function nearestIntersection(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ix of city.xs) {
    for (const iy of city.ys) {
      const d = (ix - x) * (ix - x) + (iy - y) * (iy - y);
      if (d < bestD) {
        bestD = d;
        best = { x: ix, y: iy };
      }
    }
  }
  return best;
}

// Breadth-first route across the intersection grid, returned as a list of points.
export function findRoute(city, ax, ay, bx, by) {
  const start = nearestIntersection(city, ax, ay);
  const goal = nearestIntersection(city, bx, by);
  const key = (p) => `${p.x},${p.y}`;
  const prev = new Map();
  const seen = new Set([key(start)]);
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.x === goal.x && cur.y === goal.y) break;
    for (const n of neighbors(city, cur)) {
      if (!seen.has(key(n))) {
        seen.add(key(n));
        prev.set(key(n), cur);
        queue.push(n);
      }
    }
  }
  const path = [goal];
  let cur = goal;
  while (prev.has(key(cur))) {
    cur = prev.get(key(cur));
    path.unshift(cur);
  }
  return path;
}

function neighbors(city, p) {
  const out = [];
  for (const dx of [-CFG.roadGap, 0, CFG.roadGap]) {
    for (const dy of [-CFG.roadGap, 0, CFG.roadGap]) {
      if ((dx === 0) === (dy === 0)) continue;
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (city.xs.includes(nx) && city.ys.includes(ny)) out.push({ x: nx, y: ny });
    }
  }
  return out;
}

// Push a circle out of every building it overlaps; returns the corrected position.
export function resolveCircle(city, x, y, r) {
  let nx = x;
  let ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    } else if (d2 <= 0.0001) {
      // Centre inside the building: push out along the shortest side.
      const left = nx - b.x;
      const right = b.x + b.w - nx;
      const top = ny - b.y;
      const bottom = b.y + b.h - ny;
      const m = Math.min(left, right, top, bottom);
      if (m === left) nx = b.x - r;
      else if (m === right) nx = b.x + b.w + r;
      else if (m === top) ny = b.y - r;
      else ny = b.y + b.h + r;
    }
  }
  nx = Math.max(r, Math.min(CFG.worldW - r, nx));
  ny = Math.max(r, Math.min(CFG.worldH - r, ny));
  return { x: nx, y: ny };
}

// True when a circle of radius r at (x, y) touches any building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return true;
  }
  return false;
}
