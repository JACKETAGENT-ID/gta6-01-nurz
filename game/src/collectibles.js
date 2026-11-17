// Twenty neon packages hidden across Neon Bay: a small score chase that runs
// alongside the missions. Each one glows, beams into the sky, and shows as a
// dot on the minimap until the player walks over it.
import { CFG } from './config.js';
import { playPickup } from './audio.js';

export function createCollectibles(city) {
  return city.packageSpots.map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    taken: false,
    bob: s.id * 0.7,
  }));
}

export function updateCollectibles(state, dt) {
  const p = state.player;
  let found = 0;
  for (const pkg of state.collectibles) {
    pkg.bob += dt * 3;
    if (pkg.taken) {
      found += 1;
      continue;
    }
    const d = Math.hypot(pkg.x - p.x, pkg.y - p.y);
    if (d < 36) {
      pkg.taken = true;
      found += 1;
      state.money += CFG.packageValue;
      state.packagesFound += 1;
      state.toast = `Neon package ◆ ${state.packagesFound}/${CFG.packageCount}  +$${CFG.packageValue}`;
      state.toastTimer = 2;
      state.particles.push({ x: pkg.x, y: pkg.y, vx: 0, vy: -40, life: 0.7, max: 0.7, color: '#00e5ff', r: 9 });
      playPickup(state.audio);
    }
  }
  return found;
}
