// The law: a wanted level from 0 to 5, police cruisers that chase and ram, an
// Interceptor that joins at wanted 4, roadblocks at wanted 3, and heat that cools
// off when the player stays clean. Getting caught on foot means Busted.
import { CFG } from './config.js';
import { makeCar, driveCar, CAR_TYPES } from './vehicles.js';
import { resolveCircle } from './citymap.js';

export function addWanted(state, amount, reason) {
  const before = state.wanted;
  state.wanted = Math.max(0, Math.min(CFG.wantedMax, state.wanted + amount));
  if (state.wanted > before) {
    state.heatTimer = CFG.heatSeconds;
    state.toast = reason ? `${reason} — wanted level ${state.wanted}` : `Wanted level ${state.wanted}`;
    state.toastTimer = 2.5;
  }
}

export function updateWanted(state, dt) {
  if (state.wanted <= 0) return;
  state.heatTimer -= dt;
  if (state.heatTimer > 0) return;
  state.decayTimer -= dt;
  if (state.decayTimer <= 0) {
    state.decayTimer = CFG.decaySeconds;
    state.wanted = Math.max(0, state.wanted - 1);
    if (state.wanted === 0) {
      state.toast = 'You lost the cops';
      state.toastTimer = 2.5;
    }
  }
}

// How many police cars the wanted level calls for (plus an Interceptor at 4+).
export function wantedPoliceCount(wanted) {
  if (wanted <= 0) return 0;
  return Math.min(5, wanted + 1);
}

function spawnPoliceCar(state, type) {
  const { city, rng, player } = state;
  // Appear on a road a little way off, never on top of the player.
  for (let tries = 0; tries < 12; tries += 1) {
    const x = rng.pick(city.xs) + rng.range(-8, 8);
    const y = rng.pick(city.ys) + rng.range(-8, 8);
    const d = Math.hypot(x - player.x, y - player.y);
    if (d > 420 && d < 1100) {
      const car = makeCar(type, x, y, Math.atan2(player.y - y, player.x - x), 'police', rng);
      car.speed = 200;
      state.cars.push(car);
      return car;
    }
  }
  return null;
}

export function updatePolice(state, dt) {
  const { player } = state;
  const want = wantedPoliceCount(state.wanted);
  const police = state.cars.filter((c) => c.driver === 'police');
  const interceptors = police.filter((c) => c.type === 'interceptor').length;
  // Top up the pursuit to the wanted level's strength.
  if (police.length < want) {
    const type = state.wanted >= 4 && interceptors === 0 ? 'interceptor' : 'cruiser';
    spawnPoliceCar(state, type);
  }
  // Drop the pursuit when the heat is gone.
  if (state.wanted === 0) {
    for (const car of police) {
      car.driver = 'traffic';
      car.speed = 150;
    }
  }
  // Chase: steer straight at the player, ram on contact, and lean on the gas.
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.5));
    const throttle = dist > 60 ? 1 : 0.4;
    driveCar(state, car, dt, throttle, steer);
    // Ram: a hard hit on the player's car hurts it; on foot, being touched arrests.
    if (dist < 46) {
      if (player.car) {
        player.car.health -= 14 * dt;
        if (player.car.health <= 0) {
          state.toast = 'Your car is wrecked';
          state.toastTimer = 2;
          player.car.health = 100;
        }
      } else {
        state.arrestTimer += dt;
        if (state.arrestTimer > 1.5) {
          state.screen = 'busted';
          state.arrestTimer = 0;
        }
      }
    }
  }
  if (state.wanted === 0 || player.car) state.arrestTimer = Math.max(0, state.arrestTimer - dt * 2);

  // Roadblocks at wanted 3+: two cruisers parked across the road ahead.
  state.roadblockTimer -= dt;
  if (state.wanted >= 3 && state.roadblockTimer <= 0) {
    state.roadblockTimer = 18;
    const ahead = nearestRoadAhead(state);
    if (ahead) {
      for (const off of [-30, 30]) {
        const car = makeCar('cruiser', ahead.x + off, ahead.y, ahead.angle + Math.PI / 2, 'police', state.rng);
        car.speed = 0;
        car.block = true;
        state.cars.push(car);
      }
      state.toast = 'Roadblock ahead';
      state.toastTimer = 2.5;
    }
  }
}

// A point on the player's road, some way ahead of them, for the roadblock.
function nearestRoadAhead(state) {
  const { city, player } = state;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  const ang = player.car ? player.car.angle : player.angle;
  const ax = px + Math.cos(ang) * 520;
  const ay = py + Math.sin(ang) * 520;
  let best = null;
  let bestD = Infinity;
  for (const ix of city.xs) {
    for (const iy of city.ys) {
      const d = (ix - ax) * (ix - ax) + (iy - ay) * (iy - ay);
      if (d < bestD) {
        bestD = d;
        best = { x: ix, y: iy, angle: ang };
      }
    }
  }
  return best;
}
