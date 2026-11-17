// police.js — the wanted system and the Neon Bay Police Department. Wanted
// stars rise when the player steals, shoots or punches; patrol cars spawn on
// the streets, chase the player, ram cars, and bust the player on foot.
import { BLOCKS, WORLD, collideBuildings, intersection, nextWaypoint, roadCenter } from './city.js';
import { makeRng } from './rng.js';

export const MAX_WANTED = 5;

export function makePoliceCar(x, y) {
  return {
    kind: 'police',
    x, y,
    angle: 0,
    speed: 0,
    color: '#e2e8f0',
    hp: 100,
    vx: 0,
    vy: 0,
    bustedTimer: 0,
  };
}

export function policeTargetCount(wanted) {
  if (wanted <= 0) return 0;
  return Math.min(wanted + 1, 5);
}

// A street point 550-750 px from the player, for spawning a patrol car.
export function spawnPointNear(rng, px, py) {
  for (let tries = 0; tries < 20; tries += 1) {
    const spot = intersection(rng.int(0, BLOCKS - 1), rng.int(0, BLOCKS - 1));
    const d = Math.hypot(spot.x - px, spot.y - py);
    if (d > 520 && d < 800) return { x: spot.x + rng.range(-28, 28), y: spot.y + rng.range(-28, 28) };
  }
  const spot = intersection(rng.int(0, BLOCKS - 1), rng.int(0, BLOCKS - 1));
  return { x: spot.x + rng.range(-28, 28), y: spot.y + rng.range(-28, 28) };
}

function angleTowards(fromX, fromY, toX, toY) {
  return Math.atan2(toY - fromY, toX - fromX);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updatePoliceCar(car, dt, game) {
  const p = game.player;
  const distToPlayer = Math.hypot(p.x - car.x, p.y - car.y);
  // Far away: follow the street grid toward the player. Close in: ram straight.
  let targetAngle;
  let maxSpeed = 455;
  if (distToPlayer > 150) {
    const wp = nextWaypoint(car.x, car.y, p.x, p.y);
    targetAngle = angleTowards(car.x, car.y, wp.x, wp.y);
    const wpDist = Math.hypot(wp.x - car.x, wp.y - car.y);
    if (wpDist < 150) maxSpeed = 270;
    if (Math.abs(angleDiff(targetAngle, car.angle)) > 0.7) maxSpeed = Math.min(maxSpeed, 120);
  } else {
    targetAngle = angleTowards(car.x, car.y, p.x, p.y);
  }
  const diff = angleDiff(targetAngle, car.angle);
  const turnRate = 3.4;
  car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
  car.speed = Math.min(maxSpeed, car.speed + 300 * dt);
  // Knockback from punches decays.
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  car.vx *= Math.max(0, 1 - 4 * dt);
  car.vy *= Math.max(0, 1 - 4 * dt);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  let blockedX = false;
  let blockedY = false;
  if (!collideBuildings(game.city, nx, car.y, 16)) car.x = nx;
  else { blockedX = true; car.speed *= 0.6; }
  if (!collideBuildings(game.city, car.x, ny, 16)) car.y = ny;
  else { blockedY = true; car.speed *= 0.6; }
  // Wedged on a building corner: back out instead of grinding in place.
  if (blockedX && blockedY) car.speed = -Math.max(50, Math.abs(car.speed) * 0.3);
  car.x = Math.max(14, Math.min(WORLD - 14, car.x));
  car.y = Math.max(14, Math.min(WORLD - 14, car.y));
  // Ramming the player's car slows it and throws sparks.
  if (p.car) {
    const d = Math.hypot(car.x - p.car.x, car.y - p.car.y);
    if (d < 40) {
      p.car.speed *= Math.max(0, 1 - 1.6 * dt);
      if (game.time - (car.lastRam || 0) > 0.7) {
        car.lastRam = game.time;
        game.addParticles(p.car.x, p.car.y, 8, '#facc15');
        game.sound.crash();
      }
    }
  }
  // On foot, a patrol car that stays on the player busts them.
  if (!p.car) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < 34) {
      car.bustedTimer += dt;
      if (car.bustedTimer > 1.1) game.bustPlayer();
    } else {
      car.bustedTimer = Math.max(0, car.bustedTimer - dt * 2);
    }
  }
}

export function drawWantedStars(ctx, wanted, x, y) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px system-ui, sans-serif';
  for (let i = 0; i < MAX_WANTED; i += 1) {
    ctx.fillStyle = i < wanted ? '#facc15' : 'rgba(148, 163, 184, 0.35)';
    ctx.fillText('★', x + i * 24, y);
  }
}
