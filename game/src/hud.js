// HUD, minimap, objective arrow and menus for Neon Bay Nights.

import { currentMission, missionTarget } from './story.js';
import { clamp } from './rng.js';

function starRow(ctx, x, y, wanted) {
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wanted ? '#ffd23e' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x + i * 26, y);
  }
}

export function drawHUD(ctx, state, w, h) {
  const pl = state.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash and mission.
  ctx.fillStyle = 'rgba(8,10,24,0.62)';
  ctx.fillRect(14, 12, 470, 64);
  ctx.fillStyle = '#7dff5e';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('$' + state.money.toLocaleString('en-US'), 26, 40);
  const m = currentMission(state);
  ctx.fillStyle = '#e8ecff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  if (m) {
    const st = m.stages[state.missionStage];
    ctx.fillText(m.name, 26, 60);
    ctx.fillStyle = '#ffd23e';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(st ? st.text : '', 26, 72);
  } else {
    ctx.fillText('Free roam — Neon Bay is yours', 26, 60);
  }

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(8,10,24,0.62)';
  ctx.fillRect(w - 168, 12, 154, 40);
  starRow(ctx, w - 156, 40, state.wanted || 0);
  if (state.wanted > 0) {
    ctx.fillStyle = '#ff5e5e';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('WANTED', w - 156, 66);
  }

  // Bottom-left: health, ammo, speed.
  ctx.fillStyle = 'rgba(8,10,24,0.62)';
  ctx.fillRect(14, h - 64, 240, 50);
  ctx.fillStyle = '#ff5e5e';
  ctx.fillRect(26, h - 48, 120 * clamp(pl.hp / 100, 0, 1), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(26, h - 48, 120, 12);
  ctx.fillStyle = '#e8ecff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('HP ' + Math.ceil(pl.hp), 154, h - 37);
  ctx.fillText(pl.vehicle ? 'Driving — E to exit' : 'Ammo ' + pl.ammo + '/12' + (pl.reloadT > 0 ? '  reloading…' : ''), 26, h - 20);
  if (pl.vehicle) {
    ctx.fillStyle = '#39d5ff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(Math.round(Math.abs(pl.vehicle.speed) * 0.36) + ' km/h', 268, h - 37);
  }

  // Busted progress ring while a patrol car leans on the player.
  if (state.bustProgress > 0) {
    ctx.fillStyle = 'rgba(8,10,24,0.7)';
    ctx.fillRect(w / 2 - 130, 90, 260, 30);
    ctx.fillStyle = '#ff5e5e';
    ctx.fillRect(w / 2 - 120, 100, 240 * clamp(state.bustProgress, 0, 1), 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE COPS ARE GRABBING YOU — MOVE!', w / 2, 132 - 14);
    ctx.textAlign = 'left';
  }

  // Mission message banner (above the controls hint, never over it).
  if (state.missionMessage && state.messageT > 0) {
    ctx.fillStyle = 'rgba(8,10,24,0.72)';
    const tw = Math.min(w - 60, 640);
    ctx.fillRect((w - tw) / 2, h - 158, tw, 34);
    ctx.fillStyle = '#ffd23e';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.missionMessage, w / 2, h - 136);
    ctx.textAlign = 'left';
  }

  // Flash toast.
  if (state.hudFlash && state.flashT > 0) {
    ctx.globalAlpha = clamp(state.flashT, 0, 1);
    ctx.fillStyle = 'rgba(8,10,24,0.75)';
    ctx.fillRect(w / 2 - 190, 56, 380, 30);
    ctx.fillStyle = '#7dff5e';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.hudFlash, w / 2, 76);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Controls hint.
  ctx.fillStyle = 'rgba(232,236,255,0.55)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('WASD move/drive · E steal car · F punch · Click shoot · R reload · T taxi · P pause · M mute', 14, h - 72 - 4);

  drawObjectiveArrow(ctx, state, w, h);
}

function drawObjectiveArrow(ctx, state, w, h) {
  const t = missionTarget(state);
  const taxi = state.taxi && state.taxi.active ? state.taxi : null;
  let tx = null, ty = null, color = '#ffd23e';
  if (t) {
    tx = t.boarded ? t.dx : t.px; ty = t.boarded ? t.dy : t.py; color = '#39d5ff';
  } else if (t) {
    tx = t.x; ty = t.y;
  }
  if (tx === null) return;
  const sx = tx - state.cam.x, sy = ty - state.cam.y;
  const onScreen = sx > 40 && sx < w - 40 && sy > 40 && sy < h - 40;
  if (onScreen) {
    // Pulsing marker ring on the target itself.
    const pulse = 1 + Math.sin(state.time * 5) * 0.25;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    return;
  }
  // Edge arrow pointing at the off-screen target.
  const cx = w / 2, cy = h / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = clamp(cx + Math.cos(a) * (w / 2 - 46), 46, w - 46);
  const ey = clamp(cy + Math.sin(a) * (h / 2 - 46), 46, h - 46);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(Math.hypot(tx - state.player.x, ty - state.player.y) / 10) * 10 + 'm', ex, ey + 28);
  ctx.textAlign = 'left';
}

export function drawMinimap(ctx, state, w, h) {
  const S = 200, scale = S / 4800;
  const mx = w - S - 14, my = h - S - 14;
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.fillRect(mx - 6, my - 6, S + 12, S + 12);
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, S, S); ctx.clip();
  ctx.fillStyle = '#2c4a2e';
  ctx.fillRect(mx, my, S, S);
  // Sea and sand.
  ctx.fillStyle = '#1e6f9e';
  ctx.fillRect(mx, my + 3900 * scale, S, S - 3900 * scale);
  ctx.fillRect(mx, my, 300 * scale, 3900 * scale);
  ctx.fillStyle = '#e8cf8f';
  ctx.fillRect(mx + 1000 * scale, my + 3900 * scale, S - 1000 * scale, 650 * scale);
  // Roads.
  ctx.strokeStyle = '#565e6e';
  ctx.lineWidth = 2;
  for (const g of state.city.roadLines) {
    ctx.beginPath(); ctx.moveTo(mx + g * scale, my); ctx.lineTo(mx + g * scale, my + S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + g * scale); ctx.lineTo(mx + S, my + g * scale); ctx.stroke();
  }
  const dot = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx + x * scale, my + y * scale, r, 0, Math.PI * 2); ctx.fill();
  };
  // Mission target.
  const t = missionTarget(state);
  if (t) {
    const pulse = 4 + Math.sin(state.time * 5) * 2;
    dot(t.x, t.y, '#ffd23e', pulse);
  }
  const taxi = state.taxi;
  if (taxi && taxi.active) dot(taxi.boarded ? taxi.dx : taxi.px, taxi.boarded ? taxi.dy : taxi.py, '#39d5ff', 4);
  for (const c of state.police) dot(c.x, c.y, '#ff2d2d', 3.5);
  if (state.shadowCar) dot(state.shadowCar.x, state.shadowCar.y, '#c9c9c9', 4);
  // Player arrow.
  const px = mx + state.player.x * scale, py = my + state.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#7dff5e';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 6, my - 6, S + 12, S + 12);
  ctx.fillStyle = 'rgba(232,236,255,0.8)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('NEON BAY', mx, my - 10);
}

function panel(ctx, w, h, title, lines, accent, foot) {
  ctx.fillStyle = 'rgba(6,8,20,0.82)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(title, w / 2, h / 2 - 110);
  ctx.fillStyle = '#e8ecff';
  ctx.font = '16px system-ui, sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, w / 2, h / 2 - 58 + i * 26));
  if (foot) {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(foot, w / 2, h / 2 + 40 + lines.length * 4);
  }
  ctx.textAlign = 'left';
}

export function drawMenus(ctx, state, w, h) {
  if (state.mode === 'menu') {
    ctx.fillStyle = 'rgba(6,8,20,0.45)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4fd8';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('NEON BAY', w / 2, h / 2 - 150);
    ctx.fillStyle = '#39d5ff';
    ctx.fillText('NIGHTS', w / 2, h / 2 - 84);
    ctx.fillStyle = '#e8ecff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('An original open-world crime story. Raka runs packages for Madame Lumen,', w / 2, h / 2 - 34);
    ctx.fillText('steals cars, dodges the Neon Bay police — and chases one last boat out.', w / 2, h / 2 - 8);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('WASD move / drive · E steal car · F punch · Click shoot · R reload · T taxi job · P pause · M mute', w / 2, h / 2 + 34);
    const pulse = 0.6 + Math.sin(state.time * 4) * 0.4;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#7dff5e';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(state.save ? 'CLICK TO CONTINUE — MISSION ' + (state.save.missionIdx + 1) + ' OF 4' : 'CLICK TO START', w / 2, h / 2 + 84);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(232,236,255,0.6)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('A 100% original game: its city, characters, story and sounds are our own.', w / 2, h - 24);
    ctx.textAlign = 'left';
  } else if (state.mode === 'paused') {
    panel(ctx, w, h, 'PAUSED', ['Take a breath, Raka. Neon Bay waits.'], '#39d5ff', 'Press P or click to resume');
  } else if (state.mode === 'busted') {
    panel(ctx, w, h, 'BUSTED', ['The Neon Bay police caught Raka.', 'They took 10% of your cash as a fine.'], '#ff5e5e', 'Press R or click to get back out there');
  } else if (state.mode === 'wasted') {
    panel(ctx, w, h, 'WASTED', ['Raka went down in the streets of Neon Bay.', 'Madame Lumen is not impressed.'], '#ff5e5e', 'Press R or click to try again');
  } else if (state.mode === 'complete') {
    panel(ctx, w, h, 'NEON BAY IS YOURS', [
      'All four missions done. The boat is gone, the money is yours,',
      'and Madame Lumen owes you one.',
      '',
      'Cash earned: $' + state.earned.toLocaleString('en-US'),
    ], '#7dff5e', 'Press Enter to keep roaming free');
  }
}
