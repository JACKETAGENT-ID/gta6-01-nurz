// The HUD: money and health, wanted stars, the minimap, speed and radio, the
// objective banner and the toast line — plus every menu screen (title, pause,
// busted, wasted, mission complete). All of it is drawn in screen space, over
// the world, so a screenshot shows the game and its interface at once.
import { CFG } from './config.js';
import { MISSIONS } from './story.js';
import { dayFactor, clockLabel } from './daynight.js';
import { stationAt } from './radio.js';

function star(ctx, x, y, r, filled, pulse) {
  ctx.save();
  ctx.translate(x, y);
  if (pulse) ctx.scale(1 + 0.08 * Math.sin(performance.now() / 120), 1 + 0.08 * Math.sin(performance.now() / 120));
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd34d' : 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Math.max(0, Math.min(1, frac))), h - 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawHUD(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const p = state.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash, health, mission name.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, 12, 250, 74);
  ctx.fillStyle = '#7cff9e';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(`$${state.money.toLocaleString('en-US')}`, 26, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  bar(ctx, 26, 50, 150, 10, p.health / 100, p.health > 30 ? '#37d67a' : '#e74c3c');
  const mission = MISSIONS[state.story.index];
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(state.story.done ? 'ALL MISSIONS DONE' : `MISSION ${state.story.index + 1}/6 — ${mission ? mission.name : ''}`, 26, 78);

  // Top-right: wanted stars, clock, rain.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W - 250, 12, 236, 52);
  for (let i = 0; i < 5; i += 1) {
    star(ctx, W - 232 + i * 26, 38, 11, i < state.wanted, state.wanted > 0);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(clockLabel(state.clock), W - 26, 32);
  ctx.fillStyle = state.weather.rain > 0.15 ? '#7ec8ff' : '#bbbbbb';
  ctx.fillText(state.weather.rain > 0.15 ? '☂ RAIN' : '☀ CLEAR', W - 26, 52);
  ctx.textAlign = 'left';

  // Objective banner, top-centre.
  if (state.story.objectiveText && state.screen === 'play') {
    ctx.font = 'bold 15px monospace';
    const tw = ctx.measureText(state.story.objectiveText).width;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(W / 2 - tw / 2 - 16, 14, tw + 32, 30);
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText(state.story.objectiveText, W / 2, 34);
    ctx.textAlign = 'left';
  }

  // Vault hold bar, during the vault mission.
  if (state.story.index === 5 && state.story.stage === 1) {
    const frac = state.story.hold / 8;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(W / 2 - 130, 52, 260, 34);
    ctx.fillStyle = '#ffe14d';
    ctx.textAlign = 'center';
    ctx.fillText('CRACKING THE VAULT…', W / 2, 66);
    bar(ctx, W / 2 - 120, 72, 240, 10, frac, '#00e5ff');
    ctx.textAlign = 'left';
  }

  // Tail progress bar, during the tail mission.
  if (state.story.index === 2 && state.story.stage === 0) {
    const frac = state.story.hold / 20;
    ctx.font = 'bold 14px monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(W / 2 - 130, 52, 260, 34);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('STAY ON HIS TAIL', W / 2, 66);
    bar(ctx, W / 2 - 120, 72, 240, 10, frac, '#ff7a1a');
    ctx.textAlign = 'left';
  }

  // Bottom-left: speed and vehicle, or on-foot hint; radio panel in a car.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, H - 66, 200, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`${kmh}`, 26, H - 32);
    ctx.font = '13px monospace';
    ctx.fillText('km/h', 82, H - 32);
    ctx.fillStyle = '#bbbbbb';
    ctx.fillText(p.car.name, 26, H - 20);
    const st = stationAt(state.radioStation);
    ctx.fillStyle = `hsl(${st.hue}, 80%, 55%)`;
    ctx.fillRect(228, H - 66, 190, 52);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`♪ ${st.name} ${st.freq}`, 238, H - 44);
    ctx.font = '12px monospace';
    ctx.fillText(state.radioOn ? 'R: change station' : 'R: radio off', 238, H - 24);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, H - 66, 250, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px monospace';
    ctx.fillText('WASD move · E steal car · Click shoot', 26, H - 44);
    ctx.fillText('F punch · T taxi job · P pause', 26, H - 24);
  }

  // Package counter.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(14, H - 104, 200, 28);
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`◆ ${state.packagesFound}/${CFG.packageCount} packages`, 26, H - 84);

  // Toast line, bottom-centre.
  if (state.toastTimer > 0 && state.toast) {
    ctx.font = 'bold 16px monospace';
    const tw = ctx.measureText(state.toast).width;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(W / 2 - tw / 2 - 14, H - 116, tw + 28, 30);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(state.toast, W / 2, H - 95);
    ctx.textAlign = 'left';
  }

  drawMinimap(ctx, state);
  drawObjectiveArrow(ctx, state);
  ctx.restore();
}

// The minimap: the whole city in a corner, with the player, the objective,
// police and uncollected packages as dots.
export function drawMinimap(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const mw = 220;
  const mh = 165;
  const mx = W - mw - 14;
  const my = H - mh - 14;
  const sx = mw / CFG.worldW;
  const sy = mh / CFG.worldH;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#20242c';
  ctx.fillRect(mx, my, mw, mh);
  // Water and sand.
  ctx.fillStyle = '#1d6f8f';
  ctx.fillRect(mx, my + state.city.water.y * sy, mw, state.city.water.h * sy);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(mx, my + 1950 * sy, mw, 330 * sy);
  // Roads.
  ctx.strokeStyle = '#555a66';
  ctx.lineWidth = 2;
  for (const rx of state.city.xs) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + mh);
    ctx.stroke();
  }
  for (const ry of state.city.ys) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + mw, my + ry * sy);
    ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#6a7080';
  for (const b of state.city.buildings) {
    ctx.fillRect(mx + b.x * sx, my + b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  // Packages.
  ctx.fillStyle = '#00e5ff';
  for (const pkg of state.collectibles) {
    if (pkg.taken) continue;
    ctx.beginPath();
    ctx.arc(mx + pkg.x * sx, my + pkg.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#ff3b30';
  for (const car of state.cars) {
    if (car.driver !== 'police') continue;
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Objective marker, pulsing.
  if (state.story.target) {
    const pulse = 4 + 2 * Math.sin(state.time * 5);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(mx + state.story.target.x * sx, my + state.story.target.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // The player, as a white arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 4.5, my - 4.5, mw + 9, mh + 9);
  ctx.restore();
}

// An arrow at the screen edge pointing at an off-screen objective.
function drawObjectiveArrow(ctx, state) {
  if (!state.story.target || state.screen !== 'play') return;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const cam = state.camera;
  const sx = state.story.target.x - (cam.x - W / 2);
  const sy = state.story.target.y - (cam.y - H / 2);
  if (sx > 60 && sx < W - 60 && sy > 90 && sy < H - 90) return;
  const cx = W / 2;
  const cy = H / 2;
  const ang = Math.atan2(sy - cy, sx - cx);
  const ax = cx + Math.cos(ang) * (Math.min(W, H) / 2 - 70);
  const ay = cy + Math.sin(ang) * (Math.min(W, H) / 2 - 70);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// --- Menu screens -----------------------------------------------------------

function dimScreen(ctx) {
  ctx.fillStyle = 'rgba(4,6,16,0.72)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function drawTitle(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  dimScreen(ctx);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff2d78';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('NEON BAY', W / 2, H / 2 - 120);
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('NIGHTS', W / 2, H / 2 - 52);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('AN OPEN-WORLD CRIME GAME  ·  6 MISSIONS', W / 2, H / 2 - 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('WASD drive & walk  ·  E steal a car  ·  Mouse + click shoot  ·  F punch', W / 2, H / 2 + 34);
  ctx.fillText('T taxi job  ·  R radio  ·  P pause  ·  collect 20 neon packages ◆', W / 2, H / 2 + 60);
  const saved = state.saveData;
  if (saved) {
    ctx.fillStyle = '#7cff9e';
    ctx.fillText(`Welcome back — $${saved.money.toLocaleString('en-US')} banked, mission ${Math.min(6, saved.mission + 1)}/6`, W / 2, H / 2 + 92);
  }
  const blink = Math.sin(state.time * 4) > -0.2;
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('PRESS ENTER TO START', W / 2, H / 2 + 140);
  }
  ctx.restore();
}

export function drawPause(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  dimScreen(ctx);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px monospace';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '16px monospace';
  ctx.fillText('P resume  ·  M mute  ·  R restart mission', W / 2, H / 2 + 20);
  ctx.restore();
}

export function drawBusted(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  dimScreen(ctx);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff3b30';
  ctx.font = 'bold 56px monospace';
  ctx.fillText('BUSTED', W / 2, H / 2 - 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('The Neon Bay police caught you. Your cash is safe — but the mission resets.', W / 2, H / 2 + 20);
  ctx.fillText('Press ENTER to get back out there.', W / 2, H / 2 + 48);
  ctx.restore();
}

export function drawWasted(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  dimScreen(ctx);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff3b30';
  ctx.font = 'bold 56px monospace';
  ctx.fillText('WASTED', W / 2, H / 2 - 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('Raka went down in Neon Bay. The city keeps its lights on without you.', W / 2, H / 2 + 20);
  ctx.fillText('Press ENTER to try again.', W / 2, H / 2 + 48);
  ctx.restore();
}

export function drawComplete(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  dimScreen(ctx);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7cff9e';
  ctx.font = 'bold 48px monospace';
  ctx.fillText('ALL 6 MISSIONS DONE', W / 2, H / 2 - 40);
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(`$${state.money.toLocaleString('en-US')} banked  ·  ${state.packagesFound}/20 packages`, W / 2, H / 2 + 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px monospace';
  ctx.fillText('Madame Lumen owns the night now — and so do you. Press ENTER to keep playing.', W / 2, H / 2 + 44);
  ctx.restore();
}
