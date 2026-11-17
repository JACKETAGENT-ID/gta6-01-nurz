// hud.js — everything drawn on top of the world: health, cash, ammo, wanted
// stars, mission objective, speed, minimap, messages, crosshair, off-screen
// objective arrow, and the title / pause / busted / wasted / complete screens.
import { BLOCKS, WORLD, districtName, roadCenter } from './city.js';
import { drawWantedStars } from './police.js';
import { missionObjectiveText, missionTarget, MISSIONS } from './missions.js';

const MINI = 184;

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 8, 18, 0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawMinimap(ctx, game) {
  const x0 = game.vw - MINI - 14;
  const y0 = 52;
  const s = MINI / WORLD;
  panel(ctx, x0 - 4, y0 - 4, MINI + 8, MINI + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MINI, MINI);
  ctx.clip();
  ctx.fillStyle = '#0d0a18';
  ctx.fillRect(x0, y0, MINI, MINI);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 1;
  for (let k = 0; k <= BLOCKS; k += 1) {
    const c = roadCenter(k) * s;
    ctx.beginPath();
    ctx.moveTo(x0 + c, y0);
    ctx.lineTo(x0 + c, y0 + MINI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + c);
    ctx.lineTo(x0 + MINI, y0 + c);
    ctx.stroke();
  }
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + wx * s, y0 + wy * s, r, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(game.safehouse.x, game.safehouse.y, '#22c55e', 4);
  for (const car of game.cars) dot(car.x, car.y, 'rgba(226, 232, 240, 0.8)', 2);
  for (const car of game.parkedCars) dot(car.x, car.y, 'rgba(226, 232, 240, 0.5)', 2);
  for (const car of game.police) dot(car.x, car.y, '#ef4444', 3);
  const target = missionTarget(game.missions);
  if (target) {
    const pulse = 4 + Math.sin(game.time * 5) * 1.5;
    dot(target.x, target.y, '#facc15', pulse);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x0 + target.x * s, y0 + target.y * s, pulse + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Player arrow.
  const px = x0 + game.player.x * s;
  const py = y0 + game.player.y * s;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('NEON BAY', x0, y0 + MINI + 18);
}

export function drawHUD(ctx, game) {
  const p = game.player;
  // Top-left: cash, health, ammo.
  panel(ctx, 12, 12, 210, 86);
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('$' + game.cash.toLocaleString('en-US'), 24, 42);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('HEALTH', 24, 62);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(84, 52, 120, 12);
  ctx.fillStyle = p.hp > 40 ? '#22c55e' : '#ef4444';
  ctx.fillRect(84, 52, Math.max(0, 120 * p.hp / 100), 12);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(p.car ? 'PISTOL  ' + p.ammo + '/12' : 'PISTOL  ' + p.ammo + '/12   [E] car', 24, 84);
  // Top-right: wanted stars + minimap.
  drawWantedStars(ctx, game.wanted, game.vw - 150, 30);
  drawMinimap(ctx, game);
  // Bottom-left: objective + district + controls.
  const objective = missionObjectiveText(game);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = ctx.measureText(objective).width + 24;
  panel(ctx, 12, game.vh - 96, Math.min(ow, game.vw - 24), 34);
  ctx.fillStyle = '#facc15';
  ctx.fillText(objective, 24, game.vh - 73);
  ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(districtName(p.x, p.y) + '  •  WASD move/drive  •  E enter car  •  F punch  •  Click/Space shoot  •  R reload  •  P pause  •  M mute', 14, game.vh - 40);
  ctx.fillText('Save: localStorage (autosaves after every job)   •   ' + (p.car ? 'DRIVING — hold W to accelerate' : 'ON FOOT — find a car and press E'), 14, game.vh - 20);
  // Speed when driving.
  if (p.car) {
    const mph = Math.round(Math.abs(p.car.speed) * 0.14);
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(mph + ' mph', game.vw - 24, game.vh - 24);
    ctx.textAlign = 'left';
  }
  // Off-screen objective arrow.
  const target = missionTarget(game.missions);
  if (target && game.screen === 'play') {
    const sx = target.x - game.cam.x;
    const sy = target.y - game.cam.y;
    if (sx < 0 || sy < 0 || sx > game.vw || sy > game.vh) {
      const cx = Math.max(60, Math.min(game.vw - 60, sx));
      const cy = Math.max(110, Math.min(game.vh - 130, sy));
      const ang = Math.atan2(sy - cy, sx - cx);
      const dist = Math.round(Math.hypot(target.x - p.x, target.y - p.y) / 10) * 10;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dist + 'm', cx, cy + 28);
      ctx.textAlign = 'left';
    }
  }
  // Messages, centre-top, wrapped so a long briefing never spans the screen.
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px system-ui, sans-serif';
  let my = 116;
  for (const msg of game.messages) {
    const words = msg.text.split(' ');
    const lines = [''];
    for (const w of words) {
      const test = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w;
      if (ctx.measureText(test).width > 820 && lines[lines.length - 1]) lines.push(w);
      else lines[lines.length - 1] = test;
    }
    for (const line of lines) {
      const w = ctx.measureText(line).width + 28;
      panel(ctx, (game.vw - w) / 2, my, w, 30);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(line, game.vw / 2, my + 21);
      my += 36;
    }
  }
  ctx.textAlign = 'left';
  // Crosshair.
  if (game.screen === 'play') {
    const mx = game.input.mouse.x;
    const my2 = game.input.mouse.y;
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx, my2, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 13, my2);
    ctx.lineTo(mx - 5, my2);
    ctx.moveTo(mx + 5, my2);
    ctx.lineTo(mx + 13, my2);
    ctx.moveTo(mx, my2 - 13);
    ctx.lineTo(mx, my2 - 5);
    ctx.moveTo(mx, my2 + 5);
    ctx.lineTo(mx, my2 + 13);
    ctx.stroke();
  }
}

function overlay(ctx, game) {
  const g = ctx.createLinearGradient(0, 0, 0, game.vh);
  g.addColorStop(0, 'rgba(10, 6, 24, 0.88)');
  g.addColorStop(1, 'rgba(30, 10, 50, 0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, game.vw, game.vh);
}

function bigTitle(ctx, game, title, color) {
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText(title, game.vw / 2, game.vh * 0.26);
  ctx.textAlign = 'left';
}

function menuLines(ctx, game, lines, startY) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '17px system-ui, sans-serif';
  let y = startY;
  for (const line of lines) {
    ctx.fillText(line, game.vw / 2, y);
    y += 28;
  }
  ctx.textAlign = 'left';
  return y;
}

export function drawScreen(ctx, game) {
  const p = game.player;
  if (game.screen === 'title') {
    overlay(ctx, game);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText('WELCOME TO', game.vw / 2, game.vh * 0.26 - 78);
    bigTitle(ctx, game, 'NEON BAY NIGHTS', '#f472b6');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('An open-world crime story — a city of your own, not anyone else\'s.', game.vw / 2, game.vh * 0.26 + 36);
    const y = menuLines(ctx, game, [
      'You are Raka, a courier for Madame Lumen, fixer of Neon Bay.',
      'Three jobs stand between you and the big score. Steal cars, dodge the',
      'Neon Bay Police, and finish all three jobs to own the night.',
      '',
      'WASD / arrows — move & drive      E — enter / steal a car      F — punch',
      'Mouse / Space — shoot      R — reload      P — pause      M — mute',
      '',
      'ENTER — start a new story' + (game.saveData ? '      C — continue ($' + game.saveData.cash + ', job ' + (game.saveData.missionIndex + 1) + '/3)' : ''),
      'Best cash so far: $' + (game.bestCash || 0),
    ], game.vh * 0.38);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('An original game. Neon Bay, Raka and Madame Lumen are invented here — no Rockstar / GTA names, art or music.', game.vw / 2, y + 30);
    ctx.textAlign = 'left';
  } else if (game.screen === 'pause') {
    overlay(ctx, game);
    bigTitle(ctx, game, 'PAUSED', '#22d3ee');
    menuLines(ctx, game, [
      'Take a breath, Raka. The city waits.',
      '',
      'P or Esc — resume      M — mute sound',
      'Progress autosaves after every finished job.',
    ], game.vh * 0.42);
  } else if (game.screen === 'over' || game.screen === 'busted') {
    overlay(ctx, game);
    bigTitle(ctx, game, game.screen === 'busted' ? 'BUSTED' : 'WASTED', '#ef4444');
    menuLines(ctx, game, [
      game.screen === 'busted' ? 'The Neon Bay Police caught up with you.' : 'Raka went down in the neon rain.',
      '',
      'Cash kept: $' + game.cash + '      Jobs finished: ' + game.missions.index + ' / 3',
      '',
      'R — try again from the last job',
    ], game.vh * 0.42);
  } else if (game.screen === 'complete') {
    overlay(ctx, game);
    bigTitle(ctx, game, 'STORY COMPLETE', '#facc15');
    menuLines(ctx, game, [
      'All three jobs done. Madame Lumen pays in full, and Neon Bay is yours.',
      '',
      'Final cash: $' + game.cash + '      Jobs: 3 / 3',
      '',
      'R — play the story again',
    ], game.vh * 0.42);
  }
}
