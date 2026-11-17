// Engine v3: game state, main loop, camera, player movement and rendering.
// The glue: the city, vehicles, pedestrians, police, combat, story, weather,
// radio, collectibles, day/night, audio, HUD and save systems all meet here.
// Six missions now, rain fronts, three radio stations and twenty neon
// packages hidden around Neon Bay.

import { makeRng, clamp, hashSeed } from './rng.js';
import { buildCity, drawCity, collideBuildings, inWater, WORLD } from './citymap.js';
import { createAudio } from './audio.js';
import { bindControls } from './controls.js';
import { spawnTraffic, updateTraffic, tryEnterVehicle, exitVehicle, updatePlayerDriving, drawVehicles, nearestVehicle } from './vehicles.js';
import { spawnWalkers, updateWalkers, drawWalkers } from './walkers.js';
import { updatePolice, drawPolice } from './police.js';
import { tryPunch, tryShoot, startReload, updateBullets, updateParticles, drawBulletsAndParticles } from './combat.js';
import { startMission, updateMissions, missionTarget, currentMission, startTaxiJob, updateTaxi } from './story.js';
import { updateDayNight, drawNightOverlay } from './daynight.js';
import { createWeather, updateWeather, drawRain, isWet } from './weather.js';
import { nextStation } from './radio.js';
import { spawnPackages, updatePackages, drawPackages } from './collectibles.js';
import { drawHUD, drawMinimap, drawMenus } from './hud.js';
import { saveGame, loadGame } from './savegame.js';
import { applyShot } from './shots.js';

export function createGame(canvas, opts) {
  const seed = opts.seed ?? 'neon-bay-1';
  const rng = makeRng(typeof seed === 'number' ? seed : hashSeed(String(seed)));
  const city = buildCity(rng.next() * 0xffffffff);
  const audio = createAudio();
  const save = opts.shot ? null : loadGame();

  const state = {
    time: 0, rng, city, audio, save,
    mode: 'menu',
    player: {
      x: city.spots.playerStart.x, y: city.spots.playerStart.y,
      angle: -Math.PI / 2, hp: 100, ammo: 12, vehicle: null,
      shootCd: 0, punchCd: 0, punchAnim: 0, muzzle: 0, reloadT: 0,
    },
    vehicles: [], peds: [], police: [], roadblocks: [],
    bullets: [], particles: [], skids: [], smoke: [],
    packages: [], packagesTaken: 0,
    weather: createWeather(),
    radioStation: save ? save.radioStation || 0 : 0,
    heat: 0, wanted: 0, lastCrime: -99,
    money: save ? save.money : 50,
    earned: 0,
    missionIdx: save ? save.missionIdx : 0,
    missionStage: 0,
    missionMessage: '', messageT: 0,
    hudFlash: '', flashT: 0,
    taxi: { active: false },
    shadowCar: null,
    vaultT: 0, holdProgress: 0,
    dayT: 0.3, night: false, dusk: false, darkness: 0,
    cam: { x: 0, y: 0, w: 1280, h: 800 },
    input: { keys: new Set(), pressed: new Set(), mouse: { x: 640, y: 400, down: false }, mouseWx: 0, mouseWy: 0 },
    shake: 0, bustProgress: 0, roadblockTimer: 0,
    saveT: 0, menuDrift: 0, errors: [],
  };

  spawnTraffic(state);
  spawnWalkers(state, 40);
  spawnPackages(state);
  bindControls(state, canvas);
  startMission(state, state.missionIdx);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    document.getElementById('fallback').style.display = 'grid';
    return state;
  }

  function resize() {
    const w = window.innerWidth || 1280, h = window.innerHeight || 800;
    canvas.width = w; canvas.height = h;
    state.cam.w = w; state.cam.h = h;
  }
  window.addEventListener('resize', resize);
  resize();

  function retryAfterFail() {
    const pl = state.player;
    if (state.mode === 'busted') state.money = Math.floor(state.money * 0.9);
    if (pl.vehicle) { pl.vehicle.driver = null; pl.vehicle.speed = 0; pl.vehicle = null; }
    pl.x = city.spots.playerStart.x; pl.y = city.spots.playerStart.y;
    pl.hp = 100; pl.ammo = 12; pl.reloadT = 0;
    state.police = []; state.roadblocks = [];
    state.heat = 0; state.wanted = 0; state.bustProgress = 0;
    state.mode = 'playing';
    state.missionMessage = 'Back on the streets. Madame Lumen is waiting.';
    state.messageT = 6;
    saveGame(state);
    audio.sfx('click');
  }

  function startFromMenu() {
    if (state.save && state.missionIdx > 0) {
      state.money = state.save.money;
    }
    startMission(state, state.missionIdx);
    state.mode = 'playing';
    state.missionMessage = currentMission(state)
      ? currentMission(state).stages[0].text
      : 'Free roam — Neon Bay is yours.';
    state.messageT = 8;
    audio.init();
    audio.sfx('click');
  }

  function handlePressed() {
    const pr = state.input.pressed;
    if (pr.has('KeyM')) audio.setMuted(!audio.muted);
    if (state.mode === 'menu') {
      if (pr.has('Mouse0') || pr.has('Enter') || pr.has('Space')) startFromMenu();
    } else if (state.mode === 'paused') {
      if (pr.has('KeyP') || pr.has('Escape') || pr.has('Mouse0')) { state.mode = 'playing'; audio.sfx('click'); }
    } else if (state.mode === 'busted' || state.mode === 'wasted') {
      if (pr.has('KeyR') || pr.has('Mouse0') || pr.has('Enter')) retryAfterFail();
    } else if (state.mode === 'complete') {
      if (pr.has('Enter') || pr.has('Mouse0')) { state.mode = 'playing'; state.missionMessage = 'Free roam — Neon Bay is yours.'; state.messageT = 6; }
    } else if (state.mode === 'playing') {
      if (pr.has('KeyP') || pr.has('Escape')) { state.mode = 'paused'; audio.engineOff(); }
      else if (pr.has('KeyE')) {
        if (state.player.vehicle) exitVehicle(state);
        else tryEnterVehicle(state);
      }
      else if (pr.has('KeyF')) tryPunch(state);
      // R reloads on foot and changes the radio while driving.
      else if (pr.has('KeyR')) {
        if (state.player.vehicle) nextStation(state);
        else startReload(state);
      }
      else if (pr.has('KeyV')) nextStation(state);
      else if (pr.has('KeyT')) startTaxiJob(state);
    }
    pr.clear();
  }

  function updatePlayerOnFoot(state, dt) {
    const p = state.player, k = state.input.keys;
    let mx = 0, my = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = run ? 265 : 175;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      const nx = p.x + (mx / len) * speed * dt;
      const ny = p.y + (my / len) * speed * dt;
      const probe = { x: nx, y: p.y };
      if (!inWater(probe.x, probe.y) && !collideBuildings(state.city, probe, 12)) p.x = nx;
      probe.x = p.x; probe.y = ny;
      if (!inWater(probe.x, probe.y) && !collideBuildings(state.city, probe, 12)) p.y = ny;
      p.x = clamp(p.x, 90, WORLD - 90);
      p.y = clamp(p.y, 90, WORLD - 90);
    }
    // Aim at the mouse.
    p.angle = Math.atan2(state.input.mouseWy - p.y, state.input.mouseWx - p.x);
    if (state.input.mouse.down) tryShoot(state);
  }

  function update(dt) {
    state.time += dt;
    state.messageT = Math.max(0, state.messageT - dt);
    state.flashT = Math.max(0, state.flashT - dt);
    state.shake = Math.max(0, state.shake - dt * 22);
    updateDayNight(state, dt);
    updateWeather(state, dt);
    audio.update(dt, state.mode === 'playing', state.weather.intensity);
    handlePressed();

    if (state.mode === 'menu') {
      state.menuDrift += dt * 0.12;
      state.cam.x = clamp(2000 + Math.cos(state.menuDrift) * 500 - state.cam.w / 2, 0, WORLD - state.cam.w);
      state.cam.y = clamp(2000 + Math.sin(state.menuDrift * 0.7) * 400 - state.cam.h / 2, 0, WORLD - state.cam.h);
      updateTraffic(state, dt);
      updateWalkers(state, dt);
      updateParticles(state, dt);
      return;
    }
    if (state.mode !== 'playing') return;

    const pl = state.player;
    state.input.mouseWx = state.cam.x + state.input.mouse.x;
    state.input.mouseWy = state.cam.y + state.input.mouse.y;
    // Staged screenshots keep the getaway rolling (virtual time would
    // otherwise coast the car to a stop before the shutter fires).
    if (state.cruise && pl.vehicle) state.input.keys.add('KeyW');
    if (pl.vehicle) updatePlayerDriving(state, dt);
    else updatePlayerOnFoot(state, dt);
    updateTraffic(state, dt);
    updateWalkers(state, dt);
    updatePolice(state, dt);
    updateBullets(state, dt);
    updateParticles(state, dt);
    updateMissions(state, dt);
    updateTaxi(state, dt);
    updatePackages(state, dt);

    // Camera follows the player.
    const tx = clamp(pl.x - state.cam.w / 2, 0, Math.max(0, WORLD - state.cam.w));
    const ty = clamp(pl.y - state.cam.h / 2, 0, Math.max(0, WORLD - state.cam.h));
    state.cam.x += (tx - state.cam.x) * Math.min(1, dt * 6);
    state.cam.y += (ty - state.cam.y) * Math.min(1, dt * 6);

    state.saveT += dt;
    if (state.saveT > 15) { state.saveT = 0; saveGame(state); }
  }

  function drawPlayer(ctx, state) {
    const p = state.player;
    if (p.vehicle) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(1, 4, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Raka: teal jacket with a neon stripe, dark jeans, cap.
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2ec4b6';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4fd8';
    ctx.fillRect(-2, -11, 4, 22);
    ctx.fillStyle = '#22283a';
    ctx.fillRect(-4, -9, 8, 4);
    ctx.fillRect(-4, 5, 8, 4);
    // Pistol in hand.
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(8, -2, 12, 4);
    if (p.punchAnim > 0) {
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath(); ctx.arc(20, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (p.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,220,100,0.9)';
      ctx.beginPath(); ctx.arc(24, 0, 7, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(24, 0, 2, 24, 0, 26);
      g.addColorStop(0, 'rgba(255,220,100,0.5)'); g.addColorStop(1, 'rgba(255,220,100,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(24, 0, 26, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Head with cap.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 2, p.y + Math.sin(p.angle) * 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2ec4b6';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 2, p.y + Math.sin(p.angle) * 2 - 1, 5, Math.PI, 0); ctx.fill();
  }

  function drawShadowCar(ctx, state) {
    const sc = state.shadowCar;
    if (!sc) return;
    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.rotate(sc.angle);
    ctx.fillStyle = '#6a6f7a';
    ctx.beginPath(); ctx.roundRect(-24, -11, 48, 22, 7); ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', sc.x, sc.y - 22);
    ctx.textAlign = 'left';
  }

  function drawMissionBeacon(ctx, state) {
    const t = missionTarget(state);
    if (t) {
      const pulse = 1 + Math.sin(state.time * 4) * 0.2;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(t.x - 4, t.y - 160, 8, 160);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(t.x, t.y, 8, 0, Math.PI * 2); ctx.fillStyle = '#ffd23e'; ctx.fill();
      // Vault hold ring: a second, wider ring while the drill works.
      const m = currentMission(state);
      if (m && m.stages[state.missionStage] && m.stages[state.missionStage].hold) {
        ctx.strokeStyle = '#c9a24f';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(t.x, t.y, 130, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    const taxi = state.taxi;
    if (taxi.active && !taxi.boarded) {
      ctx.fillStyle = '#39d5ff';
      ctx.beginPath(); ctx.arc(taxi.px, taxi.py, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', taxi.px, taxi.py + 4);
      ctx.textAlign = 'left';
    }
    if (taxi.active && taxi.boarded) {
      ctx.strokeStyle = '#39d5ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(taxi.dx, taxi.dy, 26, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function render() {
    const w = state.cam.w, h = state.cam.h;
    const shx = state.shake > 0 ? (state.rng.next() - 0.5) * state.shake : 0;
    const shy = state.shake > 0 ? (state.rng.next() - 0.5) * state.shake : 0;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-Math.round(state.cam.x + shx), -Math.round(state.cam.y + shy));
    drawCity(ctx, state.city, state.cam, state.time, state.night, isWet(state));
    drawMissionBeacon(ctx, state);
    drawPackages(ctx, state);
    drawVehicles(ctx, state);
    drawWalkers(ctx, state);
    drawPolice(ctx, state);
    drawShadowCar(ctx, state);
    drawPlayer(ctx, state);
    drawBulletsAndParticles(ctx, state);
    ctx.restore();
    drawNightOverlay(ctx, state, w, h);
    drawRain(ctx, state, w, h);
    if (state.mode !== 'menu') {
      drawHUD(ctx, state, w, h);
      drawMinimap(ctx, state, w, h);
    }
    drawMenus(ctx, state, w, h);
  }

  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    try {
      update(dt);
    } catch (e) {
      state.errors.push(String(e && e.message || e));
    }
    try {
      render();
    } catch (e) {
      state.errors.push(String(e && e.message || e));
    }
    requestAnimationFrame(frame);
  }

  if (opts.shot) {
    applyShot(state, opts.shot, (dt) => update(dt));
    render();
  }
  requestAnimationFrame(frame);
  window.__nbn = state;
  return state;
}
