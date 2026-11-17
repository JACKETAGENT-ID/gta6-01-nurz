// Vehicles: eight types with their own handling, the traffic that drives the
// road grid, and stealing. A car is a small physics body (position, heading,
// speed) with arcade steering; traffic cars follow routes across intersections.
import { CFG } from './config.js';
import { findRoute, nearestIntersection, resolveCircle } from './citymap.js';
import { gripFactor } from './weather.js';

export const CAR_TYPES = {
  sedan: { len: 48, wid: 22, accel: 300, top: 430, turn: 2.7, brake: 520, name: 'Sedan' },
  taxi: { len: 48, wid: 22, accel: 290, top: 410, turn: 2.7, brake: 520, name: 'Taxi' },
  sports: { len: 50, wid: 22, accel: 410, top: 580, turn: 3.3, brake: 620, name: 'Sports', spoiler: true },
  van: { len: 58, wid: 24, accel: 220, top: 340, turn: 2.2, brake: 460, name: 'Van' },
  bus: { len: 78, wid: 26, accel: 160, top: 290, turn: 1.8, brake: 420, name: 'Bus' },
  bike: { len: 32, wid: 13, accel: 450, top: 540, turn: 3.7, brake: 700, name: 'Motorbike' },
  cruiser: { len: 50, wid: 22, accel: 360, top: 540, turn: 3.1, brake: 640, name: 'Police Cruiser', police: true },
  interceptor: { len: 52, wid: 22, accel: 480, top: 660, turn: 3.5, brake: 700, name: 'Interceptor', police: true, spoiler: true },
};

const PAINT = ['#c0392b', '#2e86c1', '#e67e22', '#7d3c98', '#16a085', '#b7950b', '#5d6d7e', '#a93226'];

let nextCarId = 1;

export function makeCar(type, x, y, angle, driver, rng) {
  const t = CAR_TYPES[type];
  return {
    id: nextCarId,
    type,
    name: t.name,
    x, y, angle,
    speed: 0,
    len: t.len,
    wid: t.wid,
    color: type === 'taxi' ? '#f1c40f' : type === 'cruiser' ? '#1a1a2e' : type === 'interceptor' ? '#111122' : rng.pick(PAINT),
    driver: driver || 'traffic',
    route: null,
    routeIdx: 0,
    wait: 0,
    health: 100,
    stuck: 0,
  };
}

export function resetCarIds() {
  nextCarId = 1;
}

// Scatter traffic across the road grid, each car with a route to follow.
export function spawnTraffic(state, count) {
  const { city, rng } = state;
  for (let i = 0; i < count; i += 1) {
    const x = rng.pick(city.xs) + rng.range(-6, 6);
    const y = rng.pick(city.ys) + rng.range(-6, 6);
    const type = rng.pick(['sedan', 'sedan', 'taxi', 'sports', 'van', 'bus', 'bike']);
    const car = makeCar(type, x, y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), 'traffic', rng);
    const tx = rng.pick(city.xs);
    const ty = rng.pick(city.ys);
    car.route = findRoute(city, x, y, tx, ty);
    car.routeIdx = 1;
    car.speed = rng.range(120, 200);
    state.cars.push(car);
  }
}

// Drive one car one step: acceleration, steering, friction, building collision.
export function driveCar(state, car, dt, throttle, steer) {
  const t = CAR_TYPES[car.type];
  const grip = gripFactor(state.weather);
  if (throttle > 0) car.speed += t.accel * grip * throttle * dt;
  else if (throttle < 0) car.speed += t.brake * throttle * dt;
  else car.speed -= Math.sign(car.speed) * 140 * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  car.speed = Math.max(-t.top * 0.35, Math.min(t.top, car.speed));
  const turnRate = t.turn * grip * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 120 + 0.25);
  car.angle += steer * turnRate * dt;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = resolveCircle(state.city, nx, ny, car.len * 0.42);
  if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) {
    // A hard hit on a building: lose speed and spark.
    if (Math.abs(car.speed) > 240) state.particles.push({ x: nx, y: ny, vx: 0, vy: 0, life: 0.5, max: 0.5, color: '#ffd34d', r: 6 });
    car.speed *= 0.45;
  }
  car.x = fixed.x;
  car.y = fixed.y;
}

// Traffic AI: follow the route, one intersection at a time, pausing at red lights
// that exist only in the driver's head — a short random wait at each corner.
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    if (car.parked) continue;
    if (car.wait > 0) {
      car.wait -= dt;
      car.speed *= 0.9;
      continue;
    }
    if (!car.route || car.routeIdx >= car.route.length) {
      const tx = state.rng.pick(state.city.xs);
      const ty = state.rng.pick(state.city.ys);
      car.route = findRoute(state.city, car.x, car.y, tx, ty);
      car.routeIdx = 1;
      continue;
    }
    const target = car.route[car.routeIdx];
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) {
      car.routeIdx += 1;
      if (state.rng.chance(0.25)) car.wait = state.rng.range(0.5, 1.6);
      continue;
    }
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const cruise = CAR_TYPES[car.type].top * 0.5;
    const throttle = car.speed < cruise ? 1 : 0;
    driveCar(state, car, dt, throttle, steer);
    // Keep a gap from the car ahead: slow down when something is close in front.
    for (const other of state.cars) {
      if (other === car) continue;
      const ox = other.x - car.x;
      const oy = other.y - car.y;
      const ahead = ox * Math.cos(car.angle) + oy * Math.sin(car.angle);
      const side = Math.abs(-ox * Math.sin(car.angle) + oy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 70 && side < 26) {
        car.speed *= 0.92;
        break;
      }
    }
  }
  // Gentle separation so traffic does not stack on one spot.
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i];
      const b = state.cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.len + b.len) / 2 - 8;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
  }
}

// The nearest car the player could steal, or null.
export function nearestCar(state, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of state.cars) {
    if (car.driver === 'police') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// Steal the nearest car: the player gets in, the car becomes theirs.
export function stealCar(state) {
  const car = nearestCar(state, state.player.x, state.player.y, 64);
  if (!car) return false;
  car.driver = 'player';
  car.parked = false;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  return true;
}

// Step out of the car, leaving it where it stands.
export function exitCar(state) {
  const car = state.player.car;
  if (!car) return;
  car.driver = 'traffic';
  car.speed = 0;
  const side = state.player.angle + Math.PI / 2;
  state.player.x = car.x + Math.cos(side) * 34;
  state.player.y = car.y + Math.sin(side) * 34;
  const fixed = resolveCircle(state.city, state.player.x, state.player.y, CFG.playerRadius);
  state.player.x = fixed.x;
  state.player.y = fixed.y;
  state.player.car = null;
}
