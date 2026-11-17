// Pedestrians: five kinds of Neon Bay resident, wandering the sidewalks, opening
// an umbrella when the rain comes and running when the shooting starts.
import { CFG } from './config.js';
import { resolveCircle, nearestIntersection } from './citymap.js';

export const PED_TYPES = {
  tourist: { speed: 55, color: '#e8b4b8', shirt: '#ff8fa3' },
  suit: { speed: 70, color: '#d8d8d8', shirt: '#2c3e50' },
  jogger: { speed: 130, color: '#f0c674', shirt: '#27ae60' },
  dockworker: { speed: 60, color: '#d8b48a', shirt: '#e67e22' },
  local: { speed: 75, color: '#c9a0dc', shirt: '#8e44ad' },
};

let nextPedId = 1;

export function makePed(x, y, type, rng) {
  const t = PED_TYPES[type];
  return {
    id: nextPedId,
    type,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: t.speed * rng.range(0.85, 1.15),
    color: t.color,
    shirt: t.shirt,
    state: 'walk',
    target: null,
    panic: 0,
    alive: true,
    bob: rng.range(0, Math.PI * 2),
  };
}

export function resetPedIds() {
  nextPedId = 1;
}

export function spawnPeds(state, count) {
  const { city, rng } = state;
  const kinds = Object.keys(PED_TYPES);
  for (let i = 0; i < count; i += 1) {
    const x = rng.pick(city.xs) + rng.pick([-44, 44]) + rng.range(-10, 10);
    const y = rng.pick(city.ys) + rng.pick([-44, 44]) + rng.range(-10, 10);
    state.peds.push(makePed(x, y, rng.pick(kinds), rng));
  }
}

// A gunshot nearby sends every pedestrian in earshot running.
export function scarePeds(state, x, y, radius) {
  for (const p of state.peds) {
    if (!p.alive) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.state = 'flee';
      p.panic = 3;
      p.angle = Math.atan2(p.y - y, p.x - x);
    }
  }
}

export function updateWalkers(state, dt) {
  const { city, rng } = state;
  for (const p of state.peds) {
    if (!p.alive) continue;
    p.bob += dt * 8;
    if (p.panic > 0) {
      p.panic -= dt;
      if (p.panic <= 0) p.state = 'walk';
    }
    if (p.state === 'walk' && !p.target) {
      const n = nearestIntersection(city, p.x, p.y);
      p.target = { x: n.x + rng.range(-40, 40), y: n.y + rng.range(-40, 40) };
    }
    let speed = p.speed;
    if (p.state === 'flee') speed *= 1.9;
    let mx = 0;
    let my = 0;
    if (p.state === 'flee') {
      mx = Math.cos(p.angle);
      my = Math.sin(p.angle);
    } else if (p.target) {
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) {
        p.target = null;
        continue;
      }
      mx = dx / d;
      my = dy / d;
      p.angle = Math.atan2(dy, dx);
    }
    const nx = p.x + mx * speed * dt;
    const ny = p.y + my * speed * dt;
    const fixed = resolveCircle(city, nx, ny, 10);
    p.x = fixed.x;
    p.y = fixed.y;
    if (fixed.x !== nx || fixed.y !== ny) p.target = null;
  }
}
