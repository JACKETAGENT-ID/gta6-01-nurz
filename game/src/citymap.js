// Neon Bay city map v3: districts, roads, buildings, docks and beach.
// One fixed 4800x4800 world from a seed. Downtown sits in the middle, the
// Old Docks harbour hugs the west edge, Coral Beach runs along the south,
// and the Crescent Market fills the north-east. Roads form a grid; blocks
// hold one to three buildings, and the Neon Bay Bank anchors its own block.
// At night the windows light up; in the rain the asphalt goes dark and wet.

import { makeRng, clamp } from './rng.js';

export const WORLD = 4800;
export const ROAD_STEP = 400;
export const ROAD_HALF = 58;

const PALETTE = ['#2e3d5c', '#4a2e55', '#274b3a', '#5c3a2e', '#3a2e5c', '#553a4a', '#2e4a55', '#4a4a2e'];
const ROOFS = ['#1d2740', '#33203a', '#1c3529', '#40261d', '#282040', '#3a2830', '#20323a', '#33301c'];
const SIGN_TEXTS = [
  { text: 'LUMEN', color: '#ff4fd8' }, { text: 'NEON BAY', color: '#39d5ff' },
  { text: 'PIER 9', color: '#ffb347' }, { text: 'TAXI', color: '#ffe14d' },
  { text: 'HOTEL', color: '#7dff5e' }, { text: '24H', color: '#ff6b6b' },
  { text: 'DOCK 7', color: '#39d5ff' }, { text: 'CLUB NOVA', color: '#ff4fd8' },
  { text: 'RAMEN', color: '#ffe14d' }, { text: 'ARCADE', color: '#7dff5e' },
  { text: 'BANK', color: '#ffe14d' }, { text: 'MARKET', color: '#7dff5e' },
  { text: 'NOODLE', color: '#ff9d5c' }, { text: 'CASINO', color: '#ff4fd8' },
  { text: 'MOTEL', color: '#39d5ff' }, { text: 'PIER 12', color: '#ffb347' },
  { text: 'RADIO 101', color: '#7dff5e' }, { text: 'VAULT', color: '#ff6b6b' },
];
const CONTAINER_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#16a085'];
const STALL_COLORS = ['#e84a5f', '#39d5ff', '#ffe14d', '#7dff5e', '#ff4fd8', '#ff9d5c'];

// Bank block (bx 6, by 1) and market plaza are placed by hand, so the
// random building pass skips their blocks.
const BANK_BLOCK = { bx: 6, by: 1 };
const BANK_RECT = { x: 2920, y: 940, w: 150, h: 150 };
const MARKET_SPOT = { x: 3600, y: 2800 };

export function districtAt(x, y) {
  if (x < 1000) return 'docks';
  if (y > 3900) return 'beach';
  if (x >= 3200 && y >= 2400) return 'market';
  if (x < 2400 && y < 2400) return 'downtown';
  return 'uptown';
}

export function isRoad(x, y) {
  const rx = x % ROAD_STEP, ry = y % ROAD_STEP;
  const dx = Math.min(rx, ROAD_STEP - rx), dy = Math.min(ry, ROAD_STEP - ry);
  return dx < ROAD_HALF || dy < ROAD_HALF;
}

// Distance from (x,y) to the nearest road centre line, and which axis it is on.
export function roadAxis(x, y) {
  const rx = x % ROAD_STEP, ry = y % ROAD_STEP;
  const dx = Math.min(rx, ROAD_STEP - rx), dy = Math.min(ry, ROAD_STEP - ry);
  return dx <= dy ? { axis: 'v', at: Math.round(x / ROAD_STEP) * ROAD_STEP, d: dx }
                   : { axis: 'h', at: Math.round(y / ROAD_STEP) * ROAD_STEP, d: dy };
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    seed, buildings: [], containers: [], cranes: [], palms: [],
    lamps: [], signs: [], piers: [], boats: [], stalls: [],
    taxiStands: [], spots: {},
  };
  const roadLines = [];
  for (let v = ROAD_STEP; v < WORLD; v += ROAD_STEP) roadLines.push(v);
  city.roadLines = roadLines;

  // Buildings: one to three per block, skipped in the docks, on the beach,
  // and in the hand-placed bank block.
  for (let bx = 0; bx < 11; bx++) {
    for (let by = 0; by < 11; by++) {
      if (bx === BANK_BLOCK.bx && by === BANK_BLOCK.by) continue;
      const x0 = bx * ROAD_STEP + ROAD_STEP, y0 = by * ROAD_STEP + ROAD_STEP;
      const cx = x0 + ROAD_STEP / 2, cy = y0 + ROAD_STEP / 2;
      const d = districtAt(cx, cy);
      if (d === 'docks' || d === 'beach') continue;
      if (rng.chance(0.12)) continue; // empty lot / plaza
      const n = rng.int(1, 3);
      const ci = rng.int(0, PALETTE.length - 1);
      for (let i = 0; i < n; i++) {
        const w = rng.range(70, 130), h = rng.range(70, 130);
        const x = cx + rng.range(-110, 110) - w / 2;
        const y = cy + rng.range(-110, 110) - h / 2;
        const b = {
          x: clamp(x, x0 + 8, x0 + ROAD_STEP - 8 - w),
          y: clamp(y, y0 + 8, y0 + ROAD_STEP - 8 - h),
          w, h, color: PALETTE[ci], roof: ROOFS[ci],
          downtown: d === 'downtown',
        };
        city.buildings.push(b);
        if (b.downtown && rng.chance(0.45)) {
          const s = rng.pick(SIGN_TEXTS);
          city.signs.push({ x: b.x + b.w / 2, y: b.y - 6, text: s.text, color: s.color });
        }
      }
    }
  }

  // The Neon Bay Bank: one big marble block with columns, on its own block.
  city.buildings.push({
    ...BANK_RECT, color: '#8a7a5c', roof: '#5c4f38', downtown: false, bank: true,
  });
  city.signs.push({ x: BANK_RECT.x + BANK_RECT.w / 2, y: BANK_RECT.y - 8, text: 'NEON BAY BANK', color: '#ffe14d' });

  // Crescent Market: striped stalls around the plaza.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    city.stalls.push({
      x: MARKET_SPOT.x + Math.cos(a) * 150,
      y: MARKET_SPOT.y + Math.sin(a) * 120,
      angle: a + Math.PI / 2,
      color: STALL_COLORS[i % STALL_COLORS.length],
    });
  }
  city.signs.push({ x: MARKET_SPOT.x, y: MARKET_SPOT.y - 170, text: 'CRESCENT MARKET', color: '#7dff5e' });

  // Old Docks: container stacks, gantry cranes, piers, moored boats.
  for (let i = 0; i < 46; i++) {
    city.containers.push({
      x: rng.range(340, 900), y: rng.range(500, 3700),
      w: rng.range(70, 120), h: rng.range(28, 40),
      color: rng.pick(CONTAINER_COLORS), angle: rng.chance(0.5) ? 0 : Math.PI / 2,
    });
  }
  for (const y of [900, 1700, 2500, 3300]) {
    city.cranes.push({ x: 330, y, arm: rng.range(120, 200) });
  }
  for (const y of [700, 1500, 2300, 3100, 3700]) {
    city.piers.push({ x: 120, y, w: 190, h: 46 });
  }
  for (let i = 0; i < 5; i++) {
    city.boats.push({ x: rng.range(60, 220), y: rng.range(500, 3800), angle: rng.range(-0.4, 0.4) });
  }

  // Coral Beach: palms, umbrellas, lifeguard hut.
  for (let i = 0; i < 34; i++) {
    city.palms.push({ x: rng.range(1100, 4700), y: rng.range(3980, 4480) });
  }
  city.spots.lifeguard = { x: 2400, y: 4300 };

  // Taxi stands on downtown intersections.
  for (const [x, y] of [[1200, 1200], [2000, 1600], [2800, 1200], [1600, 2400], [2400, 2800]]) {
    city.taxiStands.push({ x, y });
  }

  // Named story spots.
  city.spots = {
    ...city.spots,
    playerStart: { x: 2000, y: 2000 },
    lumenLounge: { x: 2400, y: 1560 },
    warehouse: { x: 620, y: 2400 },
    containerYard: { x: 700, y: 3200 },
    hideout: { x: 3600, y: 3600 },
    shadowStart: { x: 2800, y: 2800 },
    shadowEnd: { x: 1200, y: 1200 },
    escapeBoat: { x: 2400, y: 4450 },
    pierGate: { x: 900, y: 2400 },
    bank: { x: BANK_RECT.x + BANK_RECT.w / 2, y: BANK_RECT.y + BANK_RECT.h / 2 },
    marketPlaza: { x: MARKET_SPOT.x, y: MARKET_SPOT.y },
    alleyMeet: { x: 1300, y: 3200 },
  };

  // Street lamps at every intersection.
  for (const gx of roadLines) for (const gy of roadLines) {
    city.lamps.push({ x: gx - ROAD_HALF - 12, y: gy - ROAD_HALF - 12 });
  }
  return city;
}

// Push a circle out of every building and container it overlaps. Returns true on contact.
export function collideBuildings(city, p, r) {
  let hit = false;
  const pushOut = (x0, y0, x1, y1) => {
    const nx = clamp(p.x, x0, x1), ny = clamp(p.y, y0, y1);
    const dx = p.x - nx, dy = p.y - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r; p.y = ny + (dy / d) * r;
      } else { p.x = x0 - r; }
    }
  };
  for (const b of city.buildings) pushOut(b.x, b.y, b.x + b.w, b.y + b.h);
  for (const c of city.containers) {
    const hw = c.angle === 0 ? c.w / 2 : c.h / 2, hh = c.angle === 0 ? c.h / 2 : c.w / 2;
    pushOut(c.x - hw, c.y - hh, c.x + hw, c.y + hh);
  }
  return hit;
}

export function inWater(x, y) {
  return (x < 300 && y < 3900) || y > 4550;
}

export function randomRoadPoint(city, rng, district) {
  for (let tries = 0; tries < 40; tries++) {
    const gx = rng.pick(city.roadLines), gy = rng.pick(city.roadLines);
    if (district && districtAt(gx, gy) !== district) continue;
    return { x: gx + rng.range(-30, 30), y: gy + rng.range(-30, 30) };
  }
  return { x: 2000, y: 2000 };
}

export function drawCity(ctx, city, cam, time, night, wet) {
  const { x: cx, y: cy, w: vw, h: vh } = cam;
  const x0 = Math.max(0, cx - 80), y0 = Math.max(0, cy - 80);
  const x1 = Math.min(WORLD, cx + vw + 80), y1 = Math.min(WORLD, cy + vh + 80);

  // Ground base: grass, darker when the rain has soaked it.
  ctx.fillStyle = wet ? '#2f5e36' : '#3d7a44';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Beach sand and sea.
  ctx.fillStyle = '#e8cf8f';
  ctx.fillRect(Math.max(x0, 1000), Math.max(y0, 3900), x1 - Math.max(x0, 1000), y1 - Math.max(y0, 3900));
  ctx.fillStyle = '#1e6f9e';
  ctx.fillRect(x0, Math.max(y0, 4550), x1 - x0, y1 - Math.max(y0, 4550));
  ctx.fillRect(Math.max(x0, 0), y0, Math.min(300, x1) - Math.max(x0, 0), Math.min(y1, 3900) - y0);
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let wy = 4560; wy < 4800; wy += 46) {
    ctx.beginPath();
    for (let wx = Math.max(x0, 1000); wx < x1; wx += 26) {
      const yy = wy + Math.sin(wx * 0.02 + time * 1.4 + wy) * 4;
      wx === Math.max(x0, 1000) ? ctx.moveTo(wx, yy) : ctx.lineTo(wx, yy);
    }
    ctx.stroke();
  }
  for (let wx = 300; wx > 0; wx -= 46) {
    ctx.beginPath();
    for (let wy = Math.max(y0, 0); wy < Math.min(y1, 3900); wy += 26) {
      const xx = wx + Math.sin(wy * 0.02 + time * 1.2 + wx) * 4;
      wy === Math.max(y0, 0) ? ctx.moveTo(xx, wy) : ctx.lineTo(xx, wy);
    }
    ctx.stroke();
  }

  // Docks concrete apron.
  ctx.fillStyle = wet ? '#6e7278' : '#8a8f98';
  ctx.fillRect(Math.max(x0, 300), y0, Math.min(1000, x1) - Math.max(x0, 300), Math.min(y1, 3900) - y0);

  // Roads: asphalt strips with sidewalks. Wet asphalt is darker and glossier.
  ctx.fillStyle = wet ? '#1f222a' : '#2b2f38';
  for (const gx of city.roadLines) {
    if (gx > x0 - 80 && gx < x1 + 80) ctx.fillRect(gx - ROAD_HALF, y0, ROAD_HALF * 2, y1 - y0);
    if (gx > y0 - 80 && gx < y1 + 80) ctx.fillRect(x0, gx - ROAD_HALF, x1 - x0, ROAD_HALF * 2);
  }
  ctx.fillStyle = '#9aa0ab';
  for (const gx of city.roadLines) {
    if (gx > x0 - 80 && gx < x1 + 80) {
      ctx.fillRect(gx - ROAD_HALF - 8, y0, 8, y1 - y0);
      ctx.fillRect(gx + ROAD_HALF, y0, 8, y1 - y0);
    }
    if (gx > y0 - 80 && gx < y1 + 80) {
      ctx.fillRect(x0, gx - ROAD_HALF - 8, x1 - x0, 8);
      ctx.fillRect(x0, gx + ROAD_HALF, x1 - x0, 8);
    }
  }
  // Centre dashes.
  ctx.fillStyle = '#e8d44d';
  for (const gx of city.roadLines) {
    if (gx > x0 - 80 && gx < x1 + 80) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(gx - 2, y, 4, 22);
    }
    if (gx > y0 - 80 && gx < y1 + 80) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, gx - 2, 22, 4);
    }
  }
  // Wet-road sheen: pale streaks catching the neon.
  if (wet) {
    ctx.fillStyle = 'rgba(160,190,255,0.08)';
    for (const gx of city.roadLines) {
      if (gx > x0 - 80 && gx < x1 + 80) ctx.fillRect(gx - ROAD_HALF + 14, y0, 10, y1 - y0);
      if (gx > y0 - 80 && gx < y1 + 80) ctx.fillRect(x0, gx + ROAD_HALF - 24, x1 - x0, 10);
    }
  }

  // Piers and boats.
  ctx.fillStyle = '#6e5136';
  for (const p of city.piers) if (p.x < x1 && p.x + p.w > x0 && p.y < y1 && p.y + p.h > y0) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  for (const b of city.boats) if (b.x > x0 - 60 && b.x < x1 + 60 && b.y > y0 - 60 && b.y < y1 + 60) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-34, -10, 68, 20);
    ctx.fillStyle = '#c0392b'; ctx.fillRect(-10, -16, 22, 12);
    ctx.restore();
  }

  // Containers.
  for (const c of city.containers) {
    if (c.x < x0 - 80 || c.x > x1 + 80 || c.y < y0 - 80 || c.y > y1 + 80) continue;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = c.color; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    ctx.beginPath(); ctx.moveTo(-c.w / 2 + 8, -c.h / 2); ctx.lineTo(-c.w / 2 + 8, c.h / 2);
    ctx.moveTo(c.w / 2 - 8, -c.h / 2); ctx.lineTo(c.w / 2 - 8, c.h / 2); ctx.stroke();
    ctx.restore();
  }

  // Gantry cranes.
  ctx.strokeStyle = '#d8b13c'; ctx.lineWidth = 6;
  for (const cr of city.cranes) {
    if (cr.x < x0 - 220 || cr.x > x1 + 220 || cr.y < y0 - 40 || cr.y > y1 + 40) continue;
    ctx.beginPath();
    ctx.moveTo(cr.x - 26, cr.y - 30); ctx.lineTo(cr.x - 26, cr.y + 30);
    ctx.moveTo(cr.x + 26, cr.y - 30); ctx.lineTo(cr.x + 26, cr.y + 30);
    ctx.moveTo(cr.x - 34, cr.y - 30); ctx.lineTo(cr.x + cr.arm, cr.y - 30);
    ctx.stroke();
    ctx.fillStyle = '#8a6d1f'; ctx.fillRect(cr.x + cr.arm - 8, cr.y - 38, 16, 16);
  }

  // Market stalls: striped awnings around the plaza.
  for (const s of city.stalls) {
    if (s.x < x0 - 60 || s.x > x1 + 60 || s.y < y0 - 60 || s.y > y1 + 60) continue;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.angle);
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.moveTo(-26, -14); ctx.lineTo(26, -14); ctx.lineTo(18, 10); ctx.lineTo(-18, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = -2; k <= 2; k += 2) ctx.fillRect(k * 10 - 4, -14, 8, 24);
    ctx.fillStyle = '#5c3a1e'; ctx.fillRect(-20, 10, 40, 6);
    ctx.restore();
  }

  // Buildings: fake shadow, walls, roof, and windows that light up at night.
  for (const b of city.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    // Windows: a fixed lit/unlit pattern per building, warm at night.
    const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const lit = (i * 7 + j * 13 + Math.floor(b.x)) % 4 === 0;
      if (night && lit) {
        ctx.fillStyle = 'rgba(255,205,110,0.95)';
        ctx.fillRect(b.x + 10 + i * 22, b.y + 10 + j * 22, 9, 9);
      } else if (!night) {
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        if ((i * 7 + j * 13 + Math.floor(b.x)) % 3 === 0) ctx.fillRect(b.x + 10 + i * 22, b.y + 10 + j * 22, 9, 9);
      }
    }
    if (b.bank) {
      // Marble columns and a vault door on the front face.
      ctx.fillStyle = '#f2ead8';
      for (let k = 0; k < 4; k++) ctx.fillRect(b.x + 18 + k * 36, b.y + b.h - 42, 12, 42);
      ctx.fillStyle = '#3a3f4a';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h - 18, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a24f';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h - 18, 6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Neon signs (glow at night, bright by day too).
  for (const s of city.signs) {
    if (s.x < x0 - 120 || s.x > x1 + 120 || s.y < y0 - 40 || s.y > y1 + 40) continue;
    ctx.save();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = s.color; ctx.shadowBlur = night ? 18 : 6;
    ctx.fillStyle = s.color;
    ctx.fillText(s.text, s.x, s.y);
    ctx.restore();
  }

  // Palms on the beach.
  for (const p of city.palms) {
    if (p.x < x0 - 30 || p.x > x1 + 30 || p.y < y0 - 30 || p.y > y1 + 30) continue;
    ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4, p.y - 16); ctx.stroke();
    ctx.fillStyle = '#2e8b57';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath(); ctx.ellipse(p.x + 4 + Math.cos(a) * 12, p.y - 16 + Math.sin(a) * 10, 12, 5, a, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Street lamps (glow pools at night).
  for (const l of city.lamps) {
    if (l.x < x0 - 20 || l.x > x1 + 20 || l.y < y0 - 20 || l.y > y1 + 20) continue;
    ctx.fillStyle = '#3a3f4a'; ctx.fillRect(l.x - 2, l.y - 2, 5, 5);
    if (night) {
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 46);
      g.addColorStop(0, 'rgba(255,214,120,0.5)'); g.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, Math.PI * 2); ctx.fill();
    }
  }
}
