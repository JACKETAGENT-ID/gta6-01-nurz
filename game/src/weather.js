// Weather for Neon Bay Nights v3: rain fronts, wet roads, screen rain.
// Rain comes in fronts that drift in and out on a seeded timer. While it
// rains the roads are wet (less grip), the city darkens, and the audio
// layer adds a patter. A shot or a mission can lock the rain on.
// Drops are positioned by a fixed table plus elapsed time, never by the
// world's random stream, so a staged screenshot stays reproducible.

import { clamp, hash2 } from './rng.js';

const DROP_COUNT = 150;
const DROPS = [];
for (let i = 0; i < DROP_COUNT; i++) {
  DROPS.push({ x: hash2(i, 11), y: hash2(i, 47), len: 10 + hash2(i, 83) * 14, fast: 0.8 + hash2(i, 131) * 0.5 });
}

export function createWeather() {
  return { intensity: 0, target: 0, locked: false, frontT: 55 };
}

export function setRain(state, intensity, locked) {
  const w = state.weather;
  w.intensity = clamp(intensity, 0, 1);
  w.target = w.intensity;
  w.locked = !!locked;
  if (locked) w.frontT = 9999;
}

export function unlockRain(state) {
  const w = state.weather;
  w.locked = false;
  w.target = 0;
  w.frontT = 30;
}

export function updateWeather(state, dt) {
  const w = state.weather;
  if (!w) return;
  if (!w.locked) {
    w.frontT -= dt;
    if (w.frontT <= 0) {
      // A new front: mostly dry, sometimes a shower.
      const roll = state.rng.next();
      w.target = roll < 0.55 ? 0 : 0.45 + state.rng.next() * 0.55;
      w.frontT = 45 + state.rng.next() * 55;
    }
  }
  const rate = w.target > w.intensity ? 0.35 : 0.12;
  w.intensity += clamp(w.target - w.intensity, -rate * dt, rate * dt);
}

export function isWet(state) {
  return (state.weather && state.weather.intensity > 0.3) || false;
}

export function drawRain(ctx, state, w, h) {
  const intensity = state.weather ? state.weather.intensity : 0;
  if (intensity < 0.05) return;
  const t = state.time;
  ctx.save();
  ctx.strokeStyle = `rgba(178,202,255,${(0.34 * intensity).toFixed(3)})`;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  const n = Math.floor(DROP_COUNT * intensity);
  for (let i = 0; i < n; i++) {
    const d = DROPS[i];
    const fall = (d.y * (h + 120) + t * 620 * d.fast) % (h + 120);
    const x = d.x * (w + 120) - 60 + fall * 0.12;
    const y = fall - 60;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y + d.len);
  }
  ctx.stroke();
  // Occasional splash rings on the "ground" at the bottom of the screen.
  ctx.strokeStyle = `rgba(178,202,255,${(0.2 * intensity).toFixed(3)})`;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const sx = hash2(i, 201) * w;
    const sy = h - hash2(i, 307) * 130;
    const r = 3 + ((t * 30 + i * 13) % 14);
    ctx.moveTo(sx + r, sy);
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
  }
  ctx.stroke();
  ctx.restore();
}
