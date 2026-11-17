// Day and night in Neon Bay.
// A full cycle lasts five minutes. Dusk turns the neon on, night brings the
// dark overlay and the headlights; dawn burns it off again.

export const CYCLE_SECONDS = 300;

export function updateDayNight(state, dt) {
  state.dayT = ((state.dayT || 0.3) + dt / CYCLE_SECONDS) % 1;
  const sun = Math.sin(state.dayT * Math.PI * 2);
  state.night = sun < 0.12;
  state.dusk = sun >= 0.12 && sun < 0.45;
  state.darkness = sun < 0 ? Math.min(1, -sun * 1.6) : 0;
}

export function skyTint(state) {
  if (state.night) return 'rgba(10,12,42,0.55)';
  if (state.dusk) return 'rgba(70,30,70,0.22)';
  return 'rgba(255,190,90,0.05)';
}

export function drawNightOverlay(ctx, state, w, h) {
  const d = state.darkness || 0;
  if (d <= 0.01) {
    const tint = skyTint(state);
    if (tint !== 'rgba(255,190,90,0.05)') { ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h); }
    return;
  }
  ctx.fillStyle = `rgba(8,10,38,${(d * 0.5).toFixed(3)})`;
  ctx.fillRect(0, 0, w, h);
  // A pool of light follows the player so the night stays playable.
  const px = state.player.x - state.cam.x, py = state.player.y - state.cam.y;
  const g = ctx.createRadialGradient(px, py, 60, px, py, 340);
  g.addColorStop(0, 'rgba(255,220,150,0.20)');
  g.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(px, py, 340, 0, Math.PI * 2); ctx.fill();
}
