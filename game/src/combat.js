// Combat: fists and a pistol, with tracers, reloads and consequences. Every shot
// is loud — pedestrians run, the wanted level climbs, and the police notice.
import { CFG } from './config.js';
import { hitsBuilding } from './citymap.js';
import { scarePeds } from './walkers.js';
import { addWanted } from './police.js';
import { playShot, playPunch } from './audio.js';

export function createCombat() {
  return {
    bullets: [],
    ammo: 12,
    reloading: 0,
    punchCooldown: 0,
    muzzle: 0,
  };
}

// Fire toward a world point (the mouse). Returns false while reloading or empty.
export function shoot(state, tx, ty) {
  const c = state.combat;
  const p = state.player;
  if (c.reloading > 0 || c.ammo <= 0) return false;
  const ox = p.car ? p.car.x : p.x;
  const oy = p.car ? p.car.y : p.y;
  const angle = Math.atan2(ty - oy, tx - ox);
  c.bullets.push({
    x: ox + Math.cos(angle) * 26,
    y: oy + Math.sin(angle) * 26,
    vx: Math.cos(angle) * CFG.bulletSpeed,
    vy: Math.sin(angle) * CFG.bulletSpeed,
    life: 1.2,
  });
  c.ammo -= 1;
  c.muzzle = 0.08;
  state.particles.push({ x: ox + Math.cos(angle) * 30, y: oy + Math.sin(angle) * 30, vx: 0, vy: 0, life: 0.12, max: 0.12, color: '#ffe14d', r: 8 });
  playShot(state.audio);
  scarePeds(state, ox, oy, 320);
  if (c.ammo === 0) {
    c.reloading = CFG.reloadSeconds;
    state.toast = 'Reloading…';
    state.toastTimer = 1.2;
  }
  return true;
}

// A swing at arm's length: hurts a pedestrian or a cop, and the law notices.
export function punch(state) {
  const c = state.combat;
  const p = state.player;
  if (c.punchCooldown > 0 || p.car) return false;
  c.punchCooldown = 0.45;
  playPunch(state.audio);
  const fx = p.x + Math.cos(p.angle) * 34;
  const fy = p.y + Math.sin(p.angle) * 34;
  let hit = false;
  for (const ped of state.peds) {
    if (!ped.alive) continue;
    if (Math.hypot(ped.x - fx, ped.y - fy) < CFG.punchRange) {
      ped.alive = false;
      state.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: -30, life: 0.6, max: 0.6, color: '#ff5a5a', r: 7 });
      hit = true;
    }
  }
  if (hit) addWanted(state, 1, 'Assault');
  return hit;
}

export function updateCombat(state, dt) {
  const c = state.combat;
  if (c.reloading > 0) {
    c.reloading -= dt;
    if (c.reloading <= 0) {
      c.ammo = 12;
      state.toast = 'Reloaded';
      state.toastTimer = 1;
    }
  }
  if (c.punchCooldown > 0) c.punchCooldown -= dt;
  if (c.muzzle > 0) c.muzzle -= dt;

  for (let i = c.bullets.length - 1; i >= 0; i -= 1) {
    const b = c.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > CFG.worldW || b.y > CFG.worldH;
    if (!dead && hitsBuilding(state.city, b.x, b.y, 2)) {
      state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffd34d', r: 4 });
      dead = true;
    }
    if (!dead) {
      for (const ped of state.peds) {
        if (!ped.alive) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.alive = false;
          state.particles.push({ x: ped.x, y: ped.y, vx: 0, vy: -30, life: 0.6, max: 0.6, color: '#ff5a5a', r: 7 });
          addWanted(state, 1, 'Shooting');
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.cars) {
        if (car.driver === 'player') continue;
        const dx = car.x - b.x;
        const dy = car.y - b.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const across = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (Math.abs(along) < car.len / 2 && across < car.wid / 2 + 4) {
          car.health -= CFG.bulletDamage;
          state.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ffd34d', r: 5 });
          if (car.driver === 'police') addWanted(state, 1, 'Attacking police');
          if (car.health <= 0) {
            car.health = 100;
            car.driver = 'traffic';
            car.speed = 0;
          }
          dead = true;
          break;
        }
      }
    }
    if (dead) c.bullets.splice(i, 1);
  }
}
