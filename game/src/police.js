// Wanted system and the Neon Bay police.
// Heat rises with crimes and slowly cools off. Wanted stars 0-5 follow the
// heat; patrol cars spawn, chase and ram, and at 3+ stars they set roadblocks
// across the road ahead of the player. Get caught on foot and it is over.

import { clamp, angleDiff } from './rng.js';
import { randomRoadPoint, WORLD } from './citymap.js';
import { scarePeds } from './walkers.js';

export function wantedFromHeat(heat) {
  if (heat < 1) return 0;
  if (heat < 2) return 1;
  if (heat < 3.5) return 2;
  if (heat < 5) return 3;
  if (heat < 7) return 4;
  return 5;
}

export function addHeat(state, amount) {
  state.heat = clamp((state.heat || 0) + amount, 0, 8);
  state.wanted = wantedFromHeat(state.heat);
  state.lastCrime = state.time;
}

export function spawnPolice(state) {
  const p = randomRoadPoint(state.city, state.rng);
  const pl = state.player;
  // Spawn on a road 350-600 px away from the player.
  const a = state.rng.angle();
  const x = clamp(pl.x + Math.cos(a) * 480, 200, WORLD - 200);
  const y = clamp(pl.y + Math.sin(a) * 480, 200, WORLD - 200);
  const cop = {
    kind: 'police', x, y, angle: Math.atan2(pl.y - y, pl.x - x),
    speed: 0, hp: 100, w: 48, h: 22, top: 430, accel: 360,
    color: '#1c2733', driver: 'police', axis: 'v', dir: 1,
    bustTimer: 0, siren: state.rng.range(0, 1),
  };
  void p;
  state.police.push(cop);
  state.audio.sfx('siren');
}

export function updatePolice(state, dt) {
  // Heat cools off when the player keeps their nose clean.
  if (state.time - (state.lastCrime || -99) > 6) {
    state.heat = Math.max(0, (state.heat || 0) - dt * 0.09);
    state.wanted = wantedFromHeat(state.heat);
  }
  const want = state.wanted || 0;
  const pl = state.player;

  while (state.police.length < want) spawnPolice(state);
  while (state.police.length > want) state.police.pop();

  // Roadblocks at 3+ stars: two patrol cars parked across the road ahead.
  state.roadblockTimer = (state.roadblockTimer || 0) - dt;
  if (want >= 3 && state.roadblockTimer <= 0 && state.roadblocks.length < 2) {
    const a = pl.vehicle ? pl.angle : pl.angle;
    const bx = pl.x + Math.cos(a) * 520, by = pl.y + Math.sin(a) * 520;
    if (bx > 200 && bx < WORLD - 200 && by > 200 && by < WORLD - 200) {
      for (const off of [-40, 40]) {
        state.roadblocks.push({
          x: bx + Math.cos(a + Math.PI / 2) * off,
          y: by + Math.sin(a + Math.PI / 2) * off,
          angle: a + Math.PI / 2, life: 14, hp: 60,
        });
      }
      state.hudFlash = 'Roadblock ahead!';
      state.audio.sfx('siren');
    }
    state.roadblockTimer = 9;
  }
  for (let i = state.roadblocks.length - 1; i >= 0; i--) {
    state.roadblocks[i].life -= dt;
    if (state.roadblocks[i].life <= 0) state.roadblocks.splice(i, 1);
  }

  for (const c of state.police) {
    c.siren += dt;
    const dx = pl.x - c.x, dy = pl.y - c.y;
    const d = Math.hypot(dx, dy);
    const targetAngle = Math.atan2(dy, dx);
    const diff = angleDiff(c.angle, targetAngle);
    c.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
    const wantSpeed = d > 260 ? c.top : c.top * 0.55;
    c.speed += clamp(wantSpeed - c.speed, -300 * dt, 320 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.x = clamp(c.x, 90, WORLD - 90); c.y = clamp(c.y, 90, WORLD - 90);

    if (d < 70) {
      if (pl.vehicle) {
        // Ram the getaway car.
        pl.vehicle.hp -= 14 * dt;
        c.speed *= 0.6;
        state.shake = Math.min(10, state.shake + 3);
        state.audio.sfx('crash');
        if (pl.vehicle.hp <= 0) {
          state.particles.push({ x: pl.vehicle.x, y: pl.vehicle.y, kind: 'boom', life: 1, n: 26 });
          state.audio.sfx('boom');
          pl.vehicle.hp = 0;
          const v = pl.vehicle;
          v.driver = null; v.speed = 0;
          pl.vehicle = null;
          pl.hp -= 25;
          pl.x = v.x + 50; pl.y = v.y + 50;
          state.hudFlash = 'Your car is wrecked! Run!';
        }
      } else {
        // On foot: standing next to a patrol car gets you busted.
        c.bustTimer += dt;
        state.bustProgress = c.bustTimer / 1.4;
        if (c.bustTimer > 1.4) {
          state.mode = 'busted';
          state.audio.sfx('busted');
          return;
        }
      }
    } else {
      c.bustTimer = Math.max(0, c.bustTimer - dt * 2);
      state.bustProgress = 0;
    }
    // Scare nearby pedestrians.
    if (d < 200) scarePeds(state, c.x, c.y, 160);
  }
  if (!state.police.some((c) => Math.hypot(pl.x - c.x, pl.y - c.y) < 70)) state.bustProgress = 0;
}

export function drawPolice(ctx, state) {
  for (const c of state.police) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-c.w / 2 + 4, -c.h / 2 + 5, c.w, c.h);
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath(); ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 7); ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-c.w / 2, -c.h / 2 + 4, c.w / 2.4, c.h - 8);
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-c.w / 6, -c.h / 2 + 3, c.w / 3, c.h - 6);
    // Flashing light bar.
    const phase = Math.floor(c.siren * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-8, -c.h / 2 - 2, 16, 5);
    ctx.restore();
  }
  for (const r of state.roadblocks) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.angle);
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath(); ctx.roundRect(-24, -11, 48, 22, 7); ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-24, -7, 20, 14);
    const phase = Math.floor(state.time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-8, -13, 16, 5);
    ctx.restore();
  }
}
