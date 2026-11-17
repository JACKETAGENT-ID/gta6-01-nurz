// Pedestrians v3: Neon Bay locals with kinds, outfits and umbrellas.
// Tourists stroll the beach, suits hurry downtown, dockworkers hang around
// the piers, joggers run the boardwalk. They stroll, cross streets, scatter
// when a car speeds at them or a gun goes off, and go down when hit.
// In the rain most of them put up an umbrella.

import { clamp } from './rng.js';
import { collideBuildings, isRoad, randomRoadPoint } from './citymap.js';
import { addHeat } from './police.js';
import { isWet } from './weather.js';

const KINDS = {
  local:      { shirts: ['#e86a6a', '#6aa8e8', '#7de87d', '#e8d44d'], speed: 40, hat: null },
  tourist:    { shirts: ['#ff9d5c', '#ffe14d', '#7dff5e', '#ff7db0'], speed: 34, hat: 'cap' },
  suit:       { shirts: ['#2e3d5c', '#3a3f4a', '#5c3a2e'], speed: 62, hat: null },
  jogger:     { shirts: ['#39d5ff', '#ff4fd8', '#e8e8e8'], speed: 96, hat: 'band' },
  dockworker: { shirts: ['#e8a13c', '#c0392b', '#7d8a99'], speed: 36, hat: 'helmet' },
};
const KIND_KEYS = Object.keys(KINDS);

export function spawnWalkers(state, n) {
  state.peds = state.peds || [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(state.city, state.rng);
    const kind = state.rng.pick(KIND_KEYS);
    const k = KINDS[kind];
    state.peds.push({
      x: p.x + state.rng.range(-60, 60), y: p.y + state.rng.range(-60, 60),
      angle: state.rng.angle(), speed: k.speed + state.rng.range(-6, 6),
      color: state.rng.pick(k.shirts), mode: 'walk', down: 0, panic: 0,
      kind, target: null,
    });
  }
}

export function scarePeds(state, x, y, radius) {
  for (const p of state.peds) {
    if (p.mode === 'down') continue;
    const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      p.mode = 'flee'; p.panic = 3;
      p.angle = Math.atan2(dy, dx);
    }
  }
}

export function updateWalkers(state, dt) {
  const pl = state.player;
  for (const p of state.peds) {
    if (p.mode === 'down') {
      p.down -= dt;
      if (p.down <= 0) { p.mode = 'walk'; p.speed = KINDS[p.kind].speed; }
      continue;
    }
    if (p.mode === 'flee') {
      p.panic -= dt;
      p.speed = 150;
      if (p.panic <= 0) p.mode = 'walk';
    } else {
      p.speed = KINDS[p.kind].speed;
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 30) {
        const t = randomRoadPoint(state.city, state.rng);
        p.target = t;
        p.angle = Math.atan2(t.y - p.y, t.x - p.x);
      }
    }
    const step = p.speed * dt;
    const nx = p.x + Math.cos(p.angle) * step;
    const ny = p.y + Math.sin(p.angle) * step;
    const probe = { x: nx, y: ny };
    if (!collideBuildings(state.city, probe, 10)) { p.x = nx; p.y = ny; }
    p.x = clamp(p.x, 90, 4710); p.y = clamp(p.y, 90, 4710);
    // A speeding car ploughing into a pedestrian is a crime.
    if (pl.vehicle && pl.vehicle.speed > 140) {
      const d2 = (p.x - pl.x) * (p.x - pl.x) + (p.y - pl.y) * (p.y - pl.y);
      if (d2 < 40 * 40) {
        p.mode = 'down'; p.down = 5;
        addHeat(state, 1);
        state.audio.sfx('thud');
        state.shake = Math.min(10, state.shake + 4);
        scarePeds(state, p.x, p.y, 220);
      }
    }
  }
}

function drawUmbrella(ctx) {
  ctx.fillStyle = '#ff4fd8';
  ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#39d5ff';
  ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI * 1.25, Math.PI * 1.75); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, -16); ctx.stroke();
}

export function drawWalkers(ctx, state) {
  const wet = isWet(state);
  for (const p of state.peds) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.mode === 'down') {
      ctx.rotate(1.2);
      ctx.fillStyle = p.color;
      ctx.fillRect(-11, -5, 22, 10);
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(1, 3, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 4.5, 0, Math.PI * 2); ctx.fill();
      // Hats by kind.
      if (p.kind === 'tourist') {
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3 - 2, 4.5, Math.PI, 0); ctx.fill();
      } else if (p.kind === 'jogger') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-5, -6, 10, 2);
      } else if (p.kind === 'dockworker') {
        ctx.fillStyle = '#f2c230';
        ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3 - 1, 5, Math.PI, 0); ctx.fill();
      } else {
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3 - 2, 4.5, Math.PI, 0); ctx.fill();
      }
      // Umbrella in the rain (joggers just get wet).
      if (wet && p.kind !== 'jogger') drawUmbrella(ctx);
    }
    ctx.restore();
  }
  void isRoad;
}
