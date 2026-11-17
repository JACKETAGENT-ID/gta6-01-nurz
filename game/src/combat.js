// combat.js — fists and the pistol: bullets, muzzle sparks, punch arcs and the
// particle bursts that sell every hit. Shooting or punching police raises heat.
import { pointInBuilding } from './city.js';

export function makeParticles() {
  return [];
}

export function addParticles(list, x, y, count, color, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 160) * (0.4 + Math.random() * 0.8);
    list.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.3,
      maxLife: 0.65,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

export function updateParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - 3 * dt);
    p.vy *= Math.max(0, 1 - 3 * dt);
    if (p.life <= 0) list.splice(i, 1);
  }
}

export function drawParticles(ctx, list) {
  for (const p of list) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

export function fireBullet(game, x, y, angle) {
  game.bullets.push({
    x: x + Math.cos(angle) * 20,
    y: y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * 760,
    vy: Math.sin(angle) * 760,
    life: 0.85,
  });
  game.addParticles(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, 4, '#fde68a', 120);
  game.sound.shot();
}

// Punch the nearest police car inside a short frontal arc.
export function tryPunch(game) {
  const p = game.player;
  const now = game.time;
  if (now - p.lastPunch < 0.45) return false;
  p.lastPunch = now;
  p.punchAnim = 0.22;
  game.sound.punch();
  let hit = false;
  for (const car of game.police) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d > 46) continue;
    const ang = Math.atan2(car.y - p.y, car.x - p.x);
    let diff = ang - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.1) continue;
    car.hp -= 30;
    car.vx += Math.cos(ang) * 260;
    car.vy += Math.sin(ang) * 260;
    game.addParticles(car.x, car.y, 8, '#fca5a5', 180);
    hit = true;
  }
  if (hit) game.gainWanted(1);
  return hit;
}

export function updateBullets(game, dt) {
  const bullets = game.bullets;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && pointInBuilding(game.city, b.x, b.y)) {
      game.addParticles(b.x, b.y, 5, '#facc15', 140);
      dead = true;
    }
    if (!dead) {
      for (const car of game.police) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 20) {
          car.hp -= 34;
          game.addParticles(b.x, b.y, 8, '#fca5a5', 180);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const ped of game.peds) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          ped.fleeUntil = game.time + 5;
          game.addParticles(b.x, b.y, 6, '#fca5a5', 150);
          game.gainWanted(1);
          dead = true;
          break;
        }
      }
    }
    if (dead) bullets.splice(i, 1);
  }
  // Wrecked patrol cars smoke, then get towed away.
  for (let i = game.police.length - 1; i >= 0; i -= 1) {
    const car = game.police[i];
    if (car.hp <= 0) {
      game.addParticles(car.x, car.y, 22, '#f97316', 260);
      game.addParticles(car.x, car.y, 12, '#475569', 120);
      game.sound.crash();
      game.cash += 25;
      game.showMessage('Patrol car wrecked  +$25');
      game.police.splice(i, 1);
    }
  }
}
