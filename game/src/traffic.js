// traffic.js — street traffic and pedestrians. Cars drive on the right side of
// Neon Bay's streets and turn at intersections; pedestrians walk the sidewalks
// and flee from gunfire and speeding cars.
import { BLOCKS, WORLD, collideBuildings, intersection, isRoadAt, roadCenter } from './city.js';
import { makeRng } from './rng.js';

const CAR_COLORS = ['#e11d48', '#2563eb', '#d97706', '#059669', '#7c3aed', '#db2777', '#0891b2', '#ca8a04'];
const PED_COLORS = ['#fbbf24', '#34d399', '#f472b6', '#60a5fa', '#f87171', '#c084fc', '#fde68a'];

function laneOffset(axis, dir) {
  // Right-hand traffic: eastbound sits south of the centre line, and so on.
  if (axis === 'x') return dir === 1 ? 12 : -12;
  return dir === 1 ? -12 : 12;
}

export function makeTrafficCar(rng, city, kind) {
  const axis = rng.chance(0.5) ? 'x' : 'y';
  const dir = rng.chance(0.5) ? 1 : -1;
  const k = rng.int(0, BLOCKS - 1);
  const m = rng.int(0, BLOCKS - 1);
  let x;
  let y;
  if (axis === 'x') {
    x = roadCenter(rng.int(0, BLOCKS - 1));
    y = roadCenter(m) + laneOffset('x', dir);
  } else {
    x = roadCenter(m) + laneOffset('y', dir);
    y = roadCenter(rng.int(0, BLOCKS - 1));
  }
  return {
    kind: kind || 'traffic',
    x, y,
    angle: axis === 'x' ? (dir === 1 ? 0 : Math.PI) : (dir === 1 ? Math.PI / 2 : -Math.PI / 2),
    axis, dir,
    speed: 0,
    baseSpeed: kind === 'target' ? 150 : 85 + rng.range(0, 55),
    color: kind === 'target' ? '#f97316' : rng.pick(CAR_COLORS),
    brake: false,
    turnCooldown: 0,
  };
}

function nearestStreetIndex(pos) {
  return Math.round((pos - 24) / 240);
}

function legalTurns(car) {
  const k = nearestStreetIndex(car.axis === 'x' ? car.x : car.y);
  const moves = [];
  // Straight on is always legal unless the street ends at the world edge.
  const edge = car.axis === 'x'
    ? (car.dir === 1 ? k >= BLOCKS : k <= 0)
    : (car.dir === 1 ? k >= BLOCKS : k <= 0);
  if (!edge) moves.push({ axis: car.axis, dir: car.dir });
  moves.push({ axis: car.axis === 'x' ? 'y' : 'x', dir: 1 });
  moves.push({ axis: car.axis === 'x' ? 'y' : 'x', dir: -1 });
  return moves;
}

export function updateTrafficCar(car, dt, rng, city, others, playerPos, isTarget) {
  car.turnCooldown -= dt;
  const along = car.axis === 'x' ? car.x : car.y;
  const k = nearestStreetIndex(along);
  const centre = roadCenter(k);
  const nearCentre = Math.abs(along - centre) < Math.max(4, car.speed * dt + 2);
  if (nearCentre && car.turnCooldown <= 0) {
    const flee = isTarget && playerPos;
    const moves = legalTurns(car);
    let choice = null;
    if (flee && rng.chance(0.65)) {
      // The target car turns away from the player — most of the time.
      let best = -Infinity;
      for (const m of moves) {
        const nx = car.x + (m.axis === 'x' ? m.dir * 100 : 0);
        const ny = car.y + (m.axis === 'y' ? m.dir * 100 : 0);
        const d = Math.hypot(nx - playerPos.x, ny - playerPos.y);
        if (d > best) { best = d; choice = m; }
      }
    } else if (rng.chance(0.3)) {
      choice = moves[Math.floor(rng.next() * moves.length)];
    }
    if (choice && (choice.axis !== car.axis || choice.dir !== car.dir)) {
      car.axis = choice.axis;
      car.dir = choice.dir;
      if (car.axis === 'x') car.y = centre + laneOffset('x', car.dir);
      else car.x = centre + laneOffset('y', car.dir);
      car.angle = car.axis === 'x' ? (car.dir === 1 ? 0 : Math.PI) : (car.dir === 1 ? Math.PI / 2 : -Math.PI / 2);
      car.turnCooldown = 1.2;
    } else if (choice) {
      car.turnCooldown = 0.6;
    }
  }
  // Do not rear-end the car ahead in the same lane.
  let want = car.baseSpeed;
  car.brake = false;
  for (const o of others) {
    if (o === car || o.axis !== car.axis || o.dir !== car.dir) continue;
    const cross = car.axis === 'x' ? Math.abs(o.y - car.y) : Math.abs(o.x - car.x);
    if (cross > 8) continue;
    const ahead = car.axis === 'x' ? (o.x - car.x) * car.dir : (o.y - car.y) * car.dir;
    if (ahead > 0 && ahead < 78) {
      want = Math.min(want, Math.max(0, o.speed - 10));
      if (ahead < 46) { want = 0; car.brake = true; }
    }
  }
  car.speed += Math.max(-260 * dt, Math.min(200 * dt, want - car.speed));
  if (car.axis === 'x') car.x += car.dir * car.speed * dt;
  else car.y += car.dir * car.speed * dt;
  car.x = Math.max(12, Math.min(WORLD - 12, car.x));
  car.y = Math.max(12, Math.min(WORLD - 12, car.y));
}

export function makePedestrian(rng) {
  const spot = intersection(rng.int(0, BLOCKS - 1), rng.int(0, BLOCKS - 1));
  return {
    x: spot.x + (rng.chance(0.5) ? 34 : -34),
    y: spot.y + (rng.chance(0.5) ? 34 : -34),
    tx: spot.x,
    ty: spot.y,
    speed: 42 + rng.range(0, 26),
    color: rng.pick(PED_COLORS),
    fleeUntil: 0,
    walkPhase: rng.range(0, 6),
  };
}

export function updatePedestrian(ped, dt, time, rng) {
  const fleeing = time < ped.fleeUntil;
  const speed = ped.speed * (fleeing ? 2.4 : 1);
  const dx = ped.tx - ped.x;
  const dy = ped.ty - ped.y;
  if (Math.abs(dx) > 4) {
    ped.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
  } else if (Math.abs(dy) > 4) {
    ped.y += Math.sign(dy) * Math.min(Math.abs(dy), speed * dt);
  } else {
    const spot = intersection(rng.int(0, BLOCKS - 1), rng.int(0, BLOCKS - 1));
    const side = rng.chance(0.5);
    ped.tx = spot.x + (side ? 34 : -34);
    ped.ty = spot.y + (side ? -34 : 34);
    if (fleeing) {
      ped.tx = Math.max(60, Math.min(WORLD - 60, ped.x + rng.range(-500, 500)));
      ped.ty = Math.max(60, Math.min(WORLD - 60, ped.y + rng.range(-500, 500)));
    }
  }
  ped.walkPhase += dt * (fleeing ? 14 : 8);
}

export function scatterPedestrians(ped, game) {
  ped.fleeUntil = game.time + 3;
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(-24, -11, 48, 26);
  ctx.fillStyle = car.color;
  roundRect(ctx, -23, -12, 46, 24, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  roundRect(ctx, -6, -10, 16, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(20, -10, 3, 5);
  ctx.fillRect(20, 5, 3, 5);
  if (car.brake) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-24, -10, 3, 5);
    ctx.fillRect(-24, 5, 3, 5);
  }
  ctx.restore();
}

export function drawPoliceCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(-24, -11, 48, 26);
  ctx.fillStyle = '#e2e8f0';
  roundRect(ctx, -23, -12, 46, 24, 7);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-2, -12, 12, 24);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  roundRect(ctx, -16, -10, 10, 20, 3);
  ctx.fill();
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(20, -10, 3, 5);
  ctx.fillRect(20, 5, 3, 5);
  const flash = Math.floor(time * 6) % 2 === 0;
  ctx.fillStyle = flash ? '#ef4444' : '#3b82f6';
  ctx.fillRect(-4, -13, 8, 5);
  ctx.fillStyle = flash ? '#3b82f6' : '#ef4444';
  ctx.fillRect(-4, 8, 8, 5);
  ctx.restore();
}

export function drawPedestrian(ctx, ped) {
  const bob = Math.sin(ped.walkPhase) * 1.5;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(ped.x, ped.y + 4, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath();
  ctx.arc(ped.x, ped.y + bob * 0.3, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fcd9b8';
  ctx.beginPath();
  ctx.arc(ped.x, ped.y - 2 + bob * 0.3, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function makeWorldTraffic(seed) {
  const rng = makeRng(seed + ':traffic');
  const cars = [];
  for (let i = 0; i < 20; i += 1) cars.push(makeTrafficCar(rng, null, 'traffic'));
  const peds = [];
  for (let i = 0; i < 30; i += 1) peds.push(makePedestrian(rng));
  return { cars, peds, rng };
}
