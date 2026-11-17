// Collectibles for Neon Bay Nights v3: twenty neon packages.
// Lumen stashed glowing packages all over Neon Bay — docks, beach, market,
// downtown alleys. Walk or drive over one to grab it: +$25 each, and the
// counter in the HUD tracks the hunt. Positions come from the world's
// seeded stream, so the same seed hides them in the same places.

import { randomRoadPoint } from './citymap.js';

export const PACKAGE_COUNT = 20;
export const PACKAGE_VALUE = 25;

export function spawnPackages(state) {
  const pkgs = [];
  const landmarks = [
    state.city.spots.warehouse, state.city.spots.containerYard,
    state.city.spots.lifeguard, state.city.spots.marketPlaza,
    state.city.spots.alleyMeet, state.city.spots.bank,
    state.city.spots.hideout, state.city.spots.lumenLounge,
  ];
  for (const spot of landmarks) {
    if (spot) pkgs.push({ x: spot.x + 70, y: spot.y + 40, taken: false });
  }
  while (pkgs.length < PACKAGE_COUNT) {
    const p = randomRoadPoint(state.city, state.rng);
    pkgs.push({
      x: p.x + state.rng.range(-140, 140),
      y: p.y + state.rng.range(-140, 140),
      taken: false,
    });
  }
  state.packages = pkgs;
  state.packagesTaken = 0;
}

export function updatePackages(state, dt) {
  void dt;
  if (state.mode !== 'playing' || !state.packages) return;
  const pl = state.player;
  for (const pkg of state.packages) {
    if (pkg.taken) continue;
    const d = Math.hypot(pl.x - pkg.x, pl.y - pkg.y);
    if (d < 46) {
      pkg.taken = true;
      state.packagesTaken += 1;
      state.money += PACKAGE_VALUE;
      state.earned += PACKAGE_VALUE;
      state.hudFlash = `Neon package +$${PACKAGE_VALUE}! (${state.packagesTaken}/${PACKAGE_COUNT})`;
      state.flashT = 2.5;
      state.audio.sfx('cash');
      state.particles.push({ x: pkg.x, y: pkg.y, kind: 'pickup', life: 0.5, n: 12 });
    }
  }
}

export function drawPackages(ctx, state) {
  if (!state.packages) return;
  for (const pkg of state.packages) {
    if (pkg.taken) continue;
    const pulse = 0.7 + Math.sin(state.time * 4 + pkg.x * 0.01) * 0.3;
    // Faint beacon column so a package reads from a distance.
    ctx.save();
    ctx.globalAlpha = 0.16 * pulse;
    ctx.fillStyle = '#39d5ff';
    ctx.fillRect(pkg.x - 3, pkg.y - 150, 6, 150);
    ctx.globalAlpha = 1;
    ctx.translate(pkg.x, pkg.y);
    ctx.rotate(Math.PI / 4);
    ctx.shadowColor = '#39d5ff';
    ctx.shadowBlur = 14 * pulse;
    ctx.fillStyle = '#39d5ff';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
}
