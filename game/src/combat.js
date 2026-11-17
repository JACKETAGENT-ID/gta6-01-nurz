// Combat: fists, pistol, reload, bullets and particles.
// Raka fights on foot. Punching and shooting are crimes: the wanted heat
// notices, nearby pedestrians scatter, and the police answer.

import { clamp } from './rng.js';
import { collideBuildings } from './citymap.js';
import { addHeat } from './police.js';
import { scarePeds } from './walkers.js';

export function tryPunch(state) {
  const p = state.player;
  if (p.vehicle || p.punchCd > 0 || state.mode !== 'playing') return;
  p.punchCd = 0.45;
  p.punchAnim = 0.22;
  state.audio.sfx('punch');
  const fx = p.x + Math.cos(p.angle) * 34, fy = p.y + Math.sin(p.angle) * 34;
  let hit = false;
  for (const ped of state.peds) {
    if (ped.mode === 'down') continue;
    if (Math.hypot(ped.x - fx, ped.y - fy) < 30) {
      ped.mode = 'down'; ped.down = 4;
      hit = true;
    }
  }
  if (hit) {
    addHeat(state, 0.8);
    scarePeds(state, p.x, p.y, 240);
    state.particles.push({ x: fx, y: fy, kind: 'hit', life: 0.4, n: 8 });
  }
}

export function tryShoot(state) {
  const p = state.player;
  if (p.vehicle || state.mode !== 'playing') return;
  if (p.reloadT > 0 || p.shootCd > 0) return;
  if (p.ammo <= 0) { startReload(state); return; }
  p.ammo -= 1;
  p.shootCd = 0.22;
  p.muzzle = 0.07;
  const a = Math.atan2(state.input.mouseWy - p.y, state.input.mouseWx - p.x);
  p.angle = a;
  state.bullets.push({
    x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
    vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.7,
  });
  state.audio.sfx('shot');
  state.shake = Math.min(8, state.shake + 1.5);
  scarePeds(state, p.x, p.y, 260);
  addHeat(state, 0.25);
}

export function startReload(state) {
  const p = state.player;
  if (p.reloadT > 0 || p.ammo >= 12) return;
  p.reloadT = 1.2;
  state.audio.sfx('reload');
}

export function updateBullets(state, dt) {
  const p = state.player;
  p.shootCd = Math.max(0, (p.shootCd || 0) - dt);
  p.punchCd = Math.max(0, (p.punchCd || 0) - dt);
  p.punchAnim = Math.max(0, (p.punchAnim || 0) - dt);
  p.muzzle = Math.max(0, (p.muzzle || 0) - dt);
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) { p.ammo = 12; state.audio.sfx('click'); }
  }
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    const probe = { x: b.x, y: b.y };
    if (!dead && collideBuildings(state.city, probe, 3)) {
      state.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.3, n: 6 });
      dead = true;
    }
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.mode !== 'down' && Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          ped.mode = 'down'; ped.down = 6;
          state.particles.push({ x: b.x, y: b.y, kind: 'hit', life: 0.4, n: 10 });
          addHeat(state, 0.8);
          scarePeds(state, b.x, b.y, 240);
          dead = true; break;
        }
      }
    }
    if (!dead) {
      for (const c of state.police) {
        if (Math.hypot(c.x - b.x, c.y - b.y) < 26) {
          c.hp -= 25;
          state.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.3, n: 8 });
          addHeat(state, 1);
          if (c.hp <= 0) {
            state.particles.push({ x: c.x, y: c.y, kind: 'boom', life: 1, n: 24 });
            state.audio.sfx('boom');
            state.police.splice(state.police.indexOf(c), 1);
          }
          dead = true; break;
        }
      }
    }
    if (!dead) {
      for (const r of state.roadblocks) {
        if (Math.hypot(r.x - b.x, r.y - b.y) < 26) {
          r.hp -= 25;
          if (r.hp <= 0) state.roadblocks.splice(state.roadblocks.indexOf(r), 1);
          dead = true; break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

export function damagePlayer(state, dmg) {
  const p = state.player;
  p.hp = clamp(p.hp - dmg, 0, 100);
  state.shake = Math.min(12, state.shake + 6);
  state.audio.sfx('hurt');
  if (p.hp <= 0) {
    state.mode = 'wasted';
    state.audio.sfx('wasted');
  }
}

export function spawnParticles(state, kind, x, y, n) {
  state.particles.push({ x, y, kind, life: kind === 'boom' ? 1 : 0.5, n });
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.skids.length - 1; i >= 0; i--) {
    state.skids[i].life -= dt;
    if (state.skids[i].life <= 0) state.skids.splice(i, 1);
  }
}

export function drawBulletsAndParticles(ctx, state) {
  ctx.fillStyle = '#ffe14d';
  for (const b of state.bullets) {
    ctx.fillRect(b.x - 3, b.y - 1.5, 7, 3);
  }
  for (const pt of state.particles) {
    const a = clamp(pt.life / 0.5, 0, 1);
    if (pt.kind === 'boom') {
      const r = (1 - pt.life) * 90 + 12;
      const g = ctx.createRadialGradient(pt.x, pt.y, 4, pt.x, pt.y, r);
      g.addColorStop(0, `rgba(255,220,80,${a})`);
      g.addColorStop(0.5, `rgba(255,90,20,${a * 0.8})`);
      g.addColorStop(1, 'rgba(120,20,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,220,100,${a})`;
      for (let i = 0; i < pt.n; i++) {
        const ang = (i / pt.n) * Math.PI * 2 + pt.life * 9;
        ctx.fillRect(pt.x + Math.cos(ang) * 12 * (1 - a), pt.y + Math.sin(ang) * 12 * (1 - a), 3, 3);
      }
    } else {
      ctx.fillStyle = `rgba(255,80,80,${a})`;
      for (let i = 0; i < pt.n; i++) {
        const ang = (i / pt.n) * Math.PI * 2;
        ctx.fillRect(pt.x + Math.cos(ang) * 9, pt.y + Math.sin(ang) * 9, 3, 3);
      }
    }
  }
}
