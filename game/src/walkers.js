// Pedestrians: Neon Bay locals walking the sidewalks.
// They stroll, cross streets, scatter when a car speeds at them or a gun
// goes off, and go down when hit. Knocking one down raises the wanted heat.

import { clamp } from './rng.js';
import { collideBuildings, isRoad, randomRoadPoint } from './citymap.js';
import { addHeat } from './police.js';

const SHIRTS = ['#e86a6a', '#6aa8e8', '#7de87d', '#e8d44d', '#c97de8', '#e8e8e8', '#e8a25e', '#5ed8c9'];

export function spawnWalkers(state, n) {
  state.peds = state.peds || [];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(state.city, state.rng);
    state.peds.push({
      x: p.x + state.rng.range(-60, 60), y: p.y + state.rng.range(-60, 60),
      angle: state.rng.angle(), speed: state.rng.range(28, 52),
      color: state.rng.pick(SHIRTS), mode: 'walk', down: 0, panic: 0,
      target: null,
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
      if (p.down <= 0) { p.mode = 'walk'; p.speed = 34; }
      continue;
    }
    if (p.mode === 'flee') {
      p.panic -= dt;
      p.speed = 150;
      if (p.panic <= 0) p.mode = 'walk';
    } else {
      p.speed = 40;
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

export function drawWalkers(ctx, state) {
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
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3 - 2, 4.5, Math.PI, 0); ctx.fill();
    }
    ctx.restore();
  }
  void isRoad;
}
