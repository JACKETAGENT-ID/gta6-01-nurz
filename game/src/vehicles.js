// Vehicles: cars and motorbikes, traffic AI, stealing and driving.
// Traffic cars stay on the road grid and turn at intersections; the player
// can steal any of them with E, and every stolen car raises the wanted heat.

import { clamp, angleDiff, dist2 } from './rng.js';
import { collideBuildings, roadAxis, randomRoadPoint, WORLD } from './citymap.js';
import { addHeat } from './police.js';

export const VEHICLE_TYPES = {
  sedan:  { w: 46, h: 22, top: 400, accel: 300, color: '#c94f4f' },
  taxi:   { w: 46, h: 22, top: 380, accel: 290, color: '#f2c230' },
  truck:  { w: 62, h: 26, top: 320, accel: 220, color: '#7d8a99' },
  sport:  { w: 48, h: 22, top: 480, accel: 380, color: '#39d5ff' },
  bike:   { w: 34, h: 12, top: 460, accel: 360, color: '#ff4fd8' },
};
const TRAFFIC_COLORS = ['#c94f4f', '#4f7dc9', '#e8e8e8', '#3a3f4a', '#7dc94f', '#c9a24f', '#8e44ad', '#b8bcc4'];
const TRAFFIC_KINDS = ['sedan', 'sedan', 'sedan', 'taxi', 'truck', 'sport'];

export function makeVehicle(rng, kind, x, y, angle) {
  const t = VEHICLE_TYPES[kind];
  return {
    kind, x, y, angle, speed: 0, hp: 100,
    w: t.w, h: t.h, top: t.top, accel: t.accel,
    color: kind === 'taxi' ? '#f2c230' : rng.pick(TRAFFIC_COLORS),
    driver: 'traffic', axis: 'v', dir: 1, lane: 18,
    stuck: 0, honk: 0,
  };
}

export function spawnTraffic(state) {
  const { rng, city } = state;
  state.vehicles = [];
  for (let i = 0; i < 26; i++) {
    const p = randomRoadPoint(city, rng);
    const axis = rng.chance(0.5) ? 'v' : 'h';
    const dir = rng.chance(0.5) ? 1 : -1;
    const v = makeVehicle(rng, rng.pick(TRAFFIC_KINDS), p.x, p.y, axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    v.axis = axis; v.dir = dir;
    if (axis === 'v') v.x = Math.round(p.x / 400) * 400 + dir * 18;
    else v.y = Math.round(p.y / 400) * 400 + dir * 18;
    v.speed = rng.range(90, 150);
    state.vehicles.push(v);
  }
  // A few parked cars and two motorbikes waiting to be borrowed.
  for (let i = 0; i < 6; i++) {
    const p = randomRoadPoint(city, rng);
    const v = makeVehicle(rng, 'sedan', p.x + rng.range(-40, 40), p.y + rng.range(-40, 40), rng.angle());
    v.driver = null; v.speed = 0;
    state.vehicles.push(v);
  }
  for (let i = 0; i < 2; i++) {
    const p = randomRoadPoint(city, rng, 'downtown');
    const v = makeVehicle(rng, 'bike', p.x, p.y, rng.angle());
    v.driver = null; v.speed = 0;
    state.vehicles.push(v);
  }
}

function nearestAhead(state, v, range) {
  const fx = Math.cos(v.angle), fy = Math.sin(v.angle);
  let best = null;
  for (const o of state.vehicles) {
    if (o === v) continue;
    const dx = o.x - v.x, dy = o.y - v.y;
    const along = dx * fx + dy * fy;
    if (along > 0 && along < range && Math.abs(-dx * fy + dy * fx) < 34) {
      if (!best || along < best.along) best = { v: o, along };
    }
  }
  return best;
}

export function updateTraffic(state, dt) {
  for (const v of state.vehicles) {
    if (v.driver !== 'traffic') continue;
    // Slow down for the car ahead.
    const ahead = nearestAhead(state, v, 110);
    const target = ahead ? Math.max(0, ahead.v.speed - 20) : v.top * 0.38;
    v.speed += clamp(target - v.speed, -260 * dt, 160 * dt);
    const step = v.speed * dt;
    if (v.axis === 'v') v.y += v.dir * step; else v.x += v.dir * step;
    // At an intersection, sometimes turn onto the cross road.
    const nearX = Math.abs(v.x % 400) < 26 || Math.abs(v.x % 400) > 374;
    const nearY = Math.abs(v.y % 400) < 26 || Math.abs(v.y % 400) > 374;
    if (nearX && nearY && state.rng.chance(dt * 0.55)) {
      if (v.axis === 'v') {
        v.axis = 'h'; v.dir = state.rng.chance(0.5) ? 1 : -1;
        v.y = Math.round(v.y / 400) * 400 + v.dir * 18;
        v.angle = v.dir > 0 ? 0 : Math.PI;
      } else {
        v.axis = 'v'; v.dir = state.rng.chance(0.5) ? 1 : -1;
        v.x = Math.round(v.x / 400) * 400 + v.dir * 18;
        v.angle = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    // Wrap around the world edges so traffic never runs out.
    if (v.x < 200) { v.x = 200; v.dir = 1; }
    if (v.x > WORLD - 200) { v.x = WORLD - 200; v.dir = -1; }
    if (v.y < 200) { v.y = 200; v.dir = 1; }
    if (v.y > WORLD - 200) { v.y = WORLD - 200; v.dir = -1; }
    v.x = clamp(v.x, 120, WORLD - 120); v.y = clamp(v.y, 120, WORLD - 120);
  }
}

export function nearestVehicle(state, x, y, maxD) {
  let best = null, bestD = maxD * maxD;
  for (const v of state.vehicles) {
    if (v.hp <= 0) continue;
    const d = dist2(x, y, v.x, v.y);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

export function tryEnterVehicle(state) {
  const p = state.player;
  if (p.vehicle) return false;
  const v = nearestVehicle(state, p.x, p.y, 70);
  if (!v) return false;
  if (v.driver === 'traffic') {
    // Yank the driver out: they flee on foot, and the law notices.
    state.peds.push({ x: v.x + 30, y: v.y + 30, angle: state.rng.angle(), speed: 130,
      color: '#e8b04d', mode: 'flee', down: 0, panic: 3 });
    v.driver = 'player';
    addHeat(state, 1);
    state.audio.sfx('steal');
    state.hudFlash = 'Car jacked! The driver ran off — the cops noticed.';
  } else {
    v.driver = 'player';
    addHeat(state, 0.6);
    state.audio.sfx('door');
  }
  p.vehicle = v;
  p.x = v.x; p.y = v.y;
  return true;
}

export function exitVehicle(state) {
  const p = state.player;
  if (!p.vehicle) return;
  const v = p.vehicle;
  v.driver = null; v.speed = 0;
  p.vehicle = null;
  p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 44;
  p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 44;
  p.angle = v.angle;
  state.audio.sfx('door');
}

export function updatePlayerDriving(state, dt) {
  const p = state.player, v = p.vehicle;
  if (!v) return;
  const k = state.input.keys;
  const up = k.has('KeyW') || k.has('ArrowUp');
  const down = k.has('KeyS') || k.has('ArrowDown');
  const left = k.has('KeyA') || k.has('ArrowLeft');
  const right = k.has('KeyD') || k.has('ArrowRight');
  const handbrake = k.has('Space');

  if (up) v.speed += v.accel * dt;
  else if (down) v.speed -= v.accel * 0.8 * dt;
  else v.speed -= Math.sign(v.speed) * 130 * dt;
  if (handbrake) v.speed -= Math.sign(v.speed) * 420 * dt;
  v.speed = clamp(v.speed, -v.top * 0.45, v.top);

  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const turnRate = 2.1 * clamp(Math.abs(v.speed) / 180, 0, 1) * Math.sign(v.speed || 1);
  v.angle += steer * turnRate * dt * (handbrake ? 1.5 : 1);
  if (handbrake && Math.abs(v.speed) > 120 && steer !== 0) {
    state.skids.push({ x: v.x, y: v.y, angle: v.angle, life: 1.6 });
  }

  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  const probe = { x: nx, y: ny };
  const hitWall = collideBuildings(state.city, probe, v.w / 2 - 4);
  if (hitWall) {
    v.speed *= -0.25;
    state.audio.sfx('crash');
    state.shake = Math.min(10, state.shake + 5);
    if (Math.abs(v.speed) > 90) addHeat(state, 0.2);
  } else {
    v.x = nx; v.y = ny;
  }
  // Bumping into traffic: shove the other car aside, keep most of our speed.
  for (const o of state.vehicles) {
    if (o === v || o.hp <= 0) continue;
    const d2 = dist2(v.x, v.y, o.x, o.y);
    if (d2 < 46 * 46) {
      const d = Math.sqrt(d2) || 1;
      const push = (46 - d) * 0.35;
      o.x += ((o.x - v.x) / d) * push; o.y += ((o.y - v.y) / d) * push;
      o.speed = Math.max(o.speed, v.speed * 0.85);
      v.speed *= 0.94;
      if (state.time - (v.lastBump || -9) > 0.6) {
        v.lastBump = state.time;
        state.audio.sfx('crash');
        state.shake = Math.min(10, state.shake + 3);
        addHeat(state, 0.1);
      }
    }
  }
  v.x = clamp(v.x, 90, WORLD - 90); v.y = clamp(v.y, 90, WORLD - 90);
  p.x = v.x; p.y = v.y; p.angle = v.angle;
  state.audio.engine(Math.abs(v.speed) / v.top, v.kind === 'bike');
}

function drawOneVehicle(ctx, v, night, time) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.rotate(v.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-v.w / 2 + 4, -v.h / 2 + 5, v.w, v.h);
  if (v.kind === 'bike') {
    ctx.fillStyle = v.color;
    ctx.fillRect(-v.w / 2, -v.h / 2, v.w, v.h);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(-v.w / 2 + 4, 0, 5, 0, Math.PI * 2); ctx.arc(v.w / 2 - 4, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b04d';
    ctx.beginPath(); ctx.arc(-2, 0, 5, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = v.color;
    ctx.beginPath();
    const r = 7;
    ctx.roundRect(-v.w / 2, -v.h / 2, v.w, v.h, r);
    ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-v.w / 6, -v.h / 2 + 3, v.w / 3, v.h - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(v.w / 2 - 8, -v.h / 2 + 4, 4, v.h - 8);
    ctx.fillStyle = '#111';
    ctx.fillRect(-v.w / 2 + 2, -v.h / 2 - 2, 8, 4); ctx.fillRect(-v.w / 2 + 2, v.h / 2 - 2, 8, 4);
    ctx.fillRect(v.w / 2 - 10, -v.h / 2 - 2, 8, 4); ctx.fillRect(v.w / 2 - 10, v.h / 2 - 2, 8, 4);
    if (v.kind === 'taxi') {
      ctx.fillStyle = '#111'; ctx.font = 'bold 8px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (night) {
      const g = ctx.createRadialGradient(v.w / 2 + 30, 0, 4, v.w / 2 + 30, 0, 90);
      g.addColorStop(0, 'rgba(255,240,180,0.55)'); g.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(v.w / 2, -8); ctx.lineTo(v.w / 2 + 110, -34); ctx.lineTo(v.w / 2 + 110, 34); ctx.lineTo(v.w / 2, 8); ctx.closePath(); ctx.fill();
    }
  }
  ctx.restore();
  void time;
}

export function drawVehicles(ctx, state) {
  const night = state.night;
  for (const s of state.skids) {
    ctx.save(); ctx.globalAlpha = Math.max(0, s.life / 1.6) * 0.5;
    ctx.translate(s.x, s.y); ctx.rotate(s.angle);
    ctx.fillStyle = '#111'; ctx.fillRect(-16, -9, 32, 4); ctx.fillRect(-16, 5, 32, 4);
    ctx.restore();
  }
  for (const v of state.vehicles) {
    if (v.hp <= 0) continue;
    drawOneVehicle(ctx, v, night, state.time);
  }
}
