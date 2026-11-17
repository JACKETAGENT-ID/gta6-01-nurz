// The engine: one state object, one step function, one render. It wires every
// system together — city, weather, radio, vehicles, walkers, police, combat,
// collectibles, story, clock, HUD — and owns the camera, the particles and the
// taxi side-job. Nothing else in the game reaches across modules: the engine
// passes the state down and each module does its own job.
import { CFG } from './config.js';
import { makeRng } from './rng.js';
import { generateCity, resolveCircle } from './citymap.js';
import { createWeather, updateWeather, gripFactor } from './weather.js';
import { createClock, updateClock, dayFactor } from './daynight.js';
import { createAudio, ensureAudio, updateAudio, playClick } from './audio.js';
import { makeCar, spawnTraffic, updateTraffic, driveCar, stealCar, exitCar, resetCarIds, nearestCar } from './vehicles.js';
import { spawnPeds, updateWalkers, resetPedIds } from './walkers.js';
import { updatePolice, updateWanted, addWanted } from './police.js';
import { createCombat, updateCombat, shoot, punch } from './combat.js';
import { createCollectibles, updateCollectibles } from './collectibles.js';
import { createStory, startMission, updateStory } from './story.js';
import { saveGame, loadGame } from './savegame.js';
import { driveInput, walkInput, keyPressed } from './controls.js';
import { drawHUD, drawTitle, drawPause, drawBusted, drawWasted, drawComplete } from './hud.js';
import { nextStationIndex } from './radio.js';

export function createGame(seed, opts) {
  const rng = makeRng(seed === undefined ? 1337 : seed);
  resetCarIds();
  resetPedIds();
  const city = generateCity(rng);
  const saveData = loadGame();
  const state = {
    seed: seed === undefined ? 1337 : seed,
    rng,
    vrng: makeRng(99),
    time: 0,
    city,
    weather: createWeather(),
    clock: createClock(opts && opts.hour !== undefined ? opts.hour : 10),
    audio: createAudio(),
    player: {
      x: 450, y: 450, angle: 0, speed: 0,
      health: CFG.playerHealth, car: null, lastHurt: -99,
    },
    money: saveData ? saveData.money : 0,
    packagesFound: saveData ? saveData.packages : 0,
    best: saveData ? saveData.best : 0,
    saveData,
    cars: [],
    peds: [],
    particles: [],
    collectibles: createCollectibles(city),
    story: createStory(),
    combat: createCombat(),
    wanted: 0,
    heatTimer: 0,
    decayTimer: CFG.decaySeconds,
    arrestTimer: 0,
    roadblockTimer: 10,
    screen: 'title',
    camera: { x: 450, y: 450, viewW: CFG.viewW, viewH: CFG.viewH },
    radioStation: 0,
    radioOn: true,
    toast: '',
    toastTimer: 0,
    taxi: { active: false, stage: 0, target: null, fare: 0 },
    saveTimer: 10,
    muted: false,
  };
  // A few parked cars near the start, ready to steal; traffic fills the rest.
  const parked = [
    ['sedan', 510, 450, 0],
    ['sports', 450, 510, Math.PI / 2],
    ['taxi', 390, 450, Math.PI],
  ];
  for (const [type, x, y, angle] of parked) {
    const car = makeCar(type, x, y, angle, 'traffic', rng);
    car.parked = true;
    state.cars.push(car);
  }
  spawnTraffic(state, CFG.trafficCount);
  spawnPeds(state, CFG.pedCount);
  startMission(state, saveData ? Math.min(saveData.mission, 5) : 0);
  return state;
}

// Put the player back on their feet at the start, keeping money and progress.
export function resetRun(state) {
  const p = state.player;
  if (p.car) {
    p.car.driver = 'traffic';
    p.car = null;
  }
  p.x = 450;
  p.y = 450;
  p.angle = 0;
  p.health = CFG.playerHealth;
  state.wanted = 0;
  state.heatTimer = 0;
  state.arrestTimer = 0;
  state.screen = 'play';
  state.toast = 'Back on the streets of Neon Bay';
  state.toastTimer = 2.5;
}

// One fixed step of the game, driven by the current input.
export function stepGame(state, dt, input) {
  state.time += dt;
  if (state.toastTimer > 0) state.toastTimer -= dt;
  updateClock(state.clock, dt);
  updateWeather(state.weather, dt, state.rng);

  if (state.screen === 'title') {
    updateTraffic(state, dt);
    updateWalkers(state, dt);
    updateParticles(state, dt);
    followCamera(state, dt);
    if (keyPressed(input, 'Enter')) {
      ensureAudio(state.audio);
      playClick(state.audio);
      state.screen = 'play';
    }
    return;
  }
  if (state.screen === 'pause') {
    if (keyPressed(input, 'KeyP') || keyPressed(input, 'Escape')) state.screen = 'play';
    return;
  }
  if (state.screen === 'busted' || state.screen === 'wasted') {
    if (keyPressed(input, 'Enter')) resetRun(state);
    return;
  }
  if (state.screen === 'complete') {
    updateTraffic(state, dt);
    updateWalkers(state, dt);
    if (keyPressed(input, 'Enter')) state.screen = 'play';
    return;
  }

  // --- play ---------------------------------------------------------------
  if (keyPressed(input, 'KeyP') || keyPressed(input, 'Escape')) {
    state.screen = 'pause';
    return;
  }
  if (keyPressed(input, 'KeyM')) {
    state.muted = !state.muted;
    if (state.audio.master) state.audio.master.gain.value = state.muted ? 0 : 0.5;
  }
  if (keyPressed(input, 'KeyR') && state.player.car) {
    state.radioStation = nextStationIndex(state.radioStation);
    state.toast = `♪ ${state.radioStation + 1} — radio changed`;
    state.toastTimer = 1.5;
  }
  if (keyPressed(input, 'KeyV')) {
    state.radioOn = !state.radioOn;
  }
  if (keyPressed(input, 'KeyT')) toggleTaxi(state);
  if (keyPressed(input, 'KeyE')) {
    if (state.player.car) exitCar(state);
    else if (stealCar(state)) addWanted(state, 1, 'Grand theft auto');
  }
  if (keyPressed(input, 'KeyF')) punch(state);
  if (input.clicked && !state.player.car) {
    const wx = state.camera.x - state.camera.viewW / 2 + input.mouseX;
    const wy = state.camera.y - state.camera.viewH / 2 + input.mouseY;
    shoot(state, wx, wy);
  }

  updatePlayer(state, dt, input);
  updateStory(state, dt);
  updateCollectibles(state, dt);
  updateCombat(state, dt);
  updatePolice(state, dt);
  updateWanted(state, dt);
  updateTraffic(state, dt);
  updateWalkers(state, dt);
  updateTaxi(state, dt);
  updateParticles(state, dt);
  followCamera(state, dt);
  updateAudio(state.audio, state, dt);

  // Slow health recovery while the heat is off.
  if (state.wanted === 0 && state.player.health < CFG.playerHealth) {
    state.player.health = Math.min(CFG.playerHealth, state.player.health + 2 * dt);
  }
  if (state.player.health <= 0) {
    state.screen = 'wasted';
    state.toast = '';
  }
  // Autosave every ten seconds of play.
  state.saveTimer -= dt;
  if (state.saveTimer <= 0) {
    state.saveTimer = 10;
    saveGame(state);
  }
}

function updatePlayer(state, dt, input) {
  const p = state.player;
  if (p.car) {
    const d = driveInput(input);
    const before = p.car.speed;
    driveCar(state, p.car, dt, d.throttle, d.steer);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    // Hard cornering at speed leaves tyre smoke.
    if (Math.abs(d.steer) > 0.7 && Math.abs(p.car.speed) > 300 && state.rng.chance(0.5)) {
      state.particles.push({
        x: p.car.x - Math.cos(p.angle) * 20, y: p.car.y - Math.sin(p.angle) * 20,
        vx: state.rng.range(-20, 20), vy: state.rng.range(-20, 20),
        life: 0.5, max: 0.5, color: '#9aa0aa', r: 5,
      });
    }
    if (Math.abs(before - p.car.speed) > 200) {
      // A sudden stop after a crash.
    }
  } else {
    const w = walkInput(input);
    const speed = w.run ? CFG.runSpeed : CFG.walkSpeed;
    let mx = w.x;
    let my = w.y;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.angle = Math.atan2(my, mx);
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      const fixed = resolveCircle(state.city, nx, ny, CFG.playerRadius);
      p.x = fixed.x;
      p.y = fixed.y;
    }
  }
}

function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
}

function followCamera(state, dt) {
  const p = state.player;
  const k = 1 - Math.pow(0.001, dt);
  state.camera.x += (p.x - state.camera.x) * k;
  state.camera.y += (p.y - state.camera.y) * k;
}

// The taxi side-job: pick up a fare, drop them off, get paid.
function toggleTaxi(state) {
  const t = state.taxi;
  if (t.active) {
    t.active = false;
    t.stage = 0;
    state.toast = 'Taxi job cancelled';
    state.toastTimer = 2;
    return;
  }
  if (!state.player.car || state.player.car.type !== 'taxi') {
    state.toast = 'You need a taxi for that job (T)';
    state.toastTimer = 2;
    return;
  }
  const { city, rng } = state;
  const px = rng.pick(city.xs) + rng.range(-30, 30);
  const py = rng.pick(city.ys) + rng.range(-30, 30);
  t.active = true;
  t.stage = 0;
  t.target = { x: px, y: py };
  t.fare = 0;
  state.toast = 'Taxi job: pick up the fare';
  state.toastTimer = 2.5;
}

function updateTaxi(state, dt) {
  const t = state.taxi;
  if (!t.active || !t.target) return;
  const p = state.player;
  const d = Math.hypot(p.x - t.target.x, p.y - t.target.y);
  if (d > 60) return;
  if (t.stage === 0) {
    t.stage = 1;
    t.fare = state.rng.int(40, 80);
    const { city, rng } = state;
    t.target = { x: rng.pick(city.xs) + rng.range(-30, 30), y: rng.pick(city.ys) + rng.range(-30, 30) };
    state.toast = `Fare aboard — drop them off for $${t.fare}`;
    state.toastTimer = 2.5;
  } else {
    state.money += t.fare;
    state.toast = `Taxi fare +$${t.fare}`;
    state.toastTimer = 2.5;
    t.active = false;
    t.stage = 0;
    t.target = null;
  }
}

// --- Rendering --------------------------------------------------------------

export function renderGame(ctx, state) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  state.camera.viewW = W;
  state.camera.viewH = H;
  const cam = state.camera;
  const camX = Math.max(W / 2, Math.min(state.city ? 3200 - W / 2 : W / 2, cam.x));
  const camY = Math.max(H / 2, Math.min(2400 - H / 2, cam.y));

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2 - camX, H / 2 - camY);
  drawGround(ctx, state);
  drawBuildings(ctx, state);
  drawMissionRing(ctx, state);
  drawCollectibles(ctx, state);
  drawCars(ctx, state);
  drawPeds(ctx, state);
  drawPlayer(ctx, state);
  drawBullets(ctx, state);
  drawParticles(ctx, state);
  ctx.restore();

  // Rain falls in screen space, over the world.
  if (state.weather.rain > 0.15) drawRain(ctx, state, camX, camY, W, H);

  // Night falls over the world, then the headlights cut through it.
  const tint = skyTintFor(state);
  if (tint) {
    ctx.fillStyle = `rgba(${tint.color},${tint.alpha})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (headlightsNeeded(state)) drawHeadlights(ctx, state, camX, camY, W, H);

  // Vignette: a soft dark edge, like a camera lens.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  if (state.screen === 'title') drawTitle(ctx, state);
  else if (state.screen === 'pause') { drawHUD(ctx, state); drawPause(ctx, state); }
  else if (state.screen === 'busted') { drawHUD(ctx, state); drawBusted(ctx, state); }
  else if (state.screen === 'wasted') { drawHUD(ctx, state); drawWasted(ctx, state); }
  else if (state.screen === 'complete') { drawHUD(ctx, state); drawComplete(ctx, state); }
  else drawHUD(ctx, state);
}

function skyTintFor(state) {
  const f = dayFactor(state.clock);
  if (f > 0.85) return null;
  const h = state.clock.hour;
  const dusk = (h > 16 && h < 19) || (h > 5 && h < 7);
  if (dusk) return { color: '255,120,40', alpha: 0.10 * (1 - f) };
  return { color: '10,16,48', alpha: 0.52 * (1 - f) };
}

function headlightsNeeded(state) {
  return dayFactor(state.clock) < 0.35 && !!state.player.car;
}

function drawGround(ctx, state) {
  const city = state.city;
  // Base ground.
  ctx.fillStyle = '#2b2f38';
  ctx.fillRect(0, 0, 3200, 2400);
  // Districts: sand along the shore, water at the bottom, docks in the north-east.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(0, 1950, 3200, 330);
  ctx.fillStyle = '#1d6f8f';
  ctx.fillRect(city.water.x, city.water.y, city.water.w, city.water.h);
  ctx.fillStyle = '#3a3430';
  ctx.fillRect(2250, 0, 950, 1050);
  // Pier.
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  // Sidewalks: a lighter band around every road, then the road itself.
  ctx.fillStyle = '#4a4d55';
  for (const x of city.xs) ctx.fillRect(x - 34, 0, 68, 2400);
  for (const y of city.ys) ctx.fillRect(0, y - 34, 3200, 68);
  ctx.fillStyle = '#1c1e24';
  for (const x of city.xs) ctx.fillRect(x - 26, 0, 52, 2400);
  for (const y of city.ys) ctx.fillRect(0, y - 26, 3200, 52);
  // Lane dashes.
  ctx.strokeStyle = '#d8c25a';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const x of city.xs) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 2400);
    ctx.stroke();
  }
  for (const y of city.ys) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(3200, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const x of city.xs) {
    for (const y of city.ys) {
      for (let i = -2; i <= 2; i += 1) {
        ctx.fillRect(x - 30 + i * 12, y - 34, 6, 12);
        ctx.fillRect(x - 30 + i * 12, y + 22, 6, 12);
      }
    }
  }
  // Palms on the beach.
  for (const t of city.trees) {
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Containers at the docks.
  for (const c of city.containers) {
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w, c.h);
  }
}

function drawBuildings(ctx, state) {
  const night = dayFactor(state.clock) < 0.5;
  for (const b of state.city.buildings) {
    ctx.fillStyle = b.c;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Windows: lit gold at night, dark glass by day.
    const cols = b.windows.cols;
    const rows = b.windows.rows;
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const wx = b.x + 8 + (i * (b.w - 16)) / Math.max(1, cols - 1);
        const wy = b.y + 8 + (j * (b.h - 16)) / Math.max(1, rows - 1);
        ctx.fillStyle = night && b.lit ? '#ffd76a' : 'rgba(20,28,44,0.85)';
        ctx.fillRect(wx - 4, wy - 4, 8, 8);
      }
    }
    // Neon sign along the roof edge.
    if (b.sign) {
      ctx.save();
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = b.signColor;
      ctx.shadowBlur = night ? 14 : 4;
      ctx.fillStyle = b.signColor;
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + 16);
      ctx.restore();
    }
  }
}

function drawMissionRing(ctx, state) {
  let ring = null;
  let label = '';
  if (state.story.index === 1 && state.story.stage === 1) {
    ring = { x: 2550, y: 750, r: 70 };
    label = 'LOADING';
  } else if (state.story.index === 5 && state.story.stage === 1) {
    ring = state.city.vaultRing;
    label = 'VAULT';
  }
  if (!ring) return;
  ctx.save();
  ctx.strokeStyle = '#ffe14d';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,225,77,0.10)';
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe14d';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, ring.x, ring.y - ring.r - 8);
  ctx.restore();
}

function drawCollectibles(ctx, state) {
  for (const pkg of state.collectibles) {
    if (pkg.taken) continue;
    const bob = Math.sin(pkg.bob) * 3;
    ctx.save();
    ctx.translate(pkg.x, pkg.y + bob);
    // Beam into the sky.
    const grad = ctx.createLinearGradient(0, -70, 0, 0);
    grad.addColorStop(0, 'rgba(0,229,255,0)');
    grad.addColorStop(1, 'rgba(0,229,255,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(-2, -70, 4, 70);
    // The diamond itself.
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }
}

function drawCars(ctx, state) {
  for (const car of state.cars) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const half = car.len / 2;
    const hw = car.wid / 2;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-half + 2, -hw + 3, car.len, car.wid);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -half, -hw, car.len, car.wid, 7);
    ctx.fill();
    // Roof and windshield.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-half + 10, -hw + 4, car.len * 0.34, car.wid - 8);
    ctx.fillStyle = 'rgba(10,14,24,0.85)';
    ctx.fillRect(half - 14, -hw + 4, 8, car.wid - 8);
    if (car.type === 'bus') {
      ctx.fillStyle = 'rgba(180,220,255,0.8)';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(-half + 12 + i * 15, -hw + 4, 10, car.wid - 8);
    }
    if (car.type === 'sports' || car.type === 'interceptor') {
      ctx.fillStyle = '#111111';
      ctx.fillRect(-half - 2, -hw - 2, 5, car.wid + 4);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#111111';
      for (let i = 0; i < 5; i += 1) ctx.fillRect(-half + 12 + i * 8, -hw, 4, 4);
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -hw - 5);
    }
    if (car.type === 'cruiser' || car.type === 'interceptor') {
      // Light bar, flashing red and blue.
      const on = Math.floor(state.time * 6) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-6, -hw - 3, 12, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
      if (car.type === 'interceptor') {
        ctx.fillStyle = '#ff3b30';
        ctx.fillRect(-half, -3, car.len, 6);
      }
    }
    if (car.block) {
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ROADBLOCK', 0, -hw - 10);
    }
    // Headlight dots at the front when dark.
    if (dayFactor(state.clock) < 0.5) {
      ctx.fillStyle = '#fff6b0';
      ctx.beginPath();
      ctx.arc(half - 2, -hw + 5, 3, 0, Math.PI * 2);
      ctx.arc(half - 2, hw - 5, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawPeds(ctx, state) {
  for (const p of state.peds) {
    if (!p.alive) continue;
    const bob = Math.sin(p.bob) * 1.5;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.fillStyle = p.shirt;
    ctx.beginPath();
    ctx.arc(0, bob, 8, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, bob - 2, 5, 0, Math.PI * 2);
    ctx.fill();
    // Umbrella in the rain.
    if (state.weather.rain > 0.25) {
      ctx.fillStyle = p.type === 'tourist' ? '#ff2d78' : '#2f7bff';
      ctx.beginPath();
      ctx.arc(0, bob - 6, 11, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-1, bob - 6, 2, 10);
    }
    ctx.restore();
  }
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (p.car) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Raka: a teal jacket, facing where he walks.
  ctx.rotate(p.angle);
  ctx.fillStyle = '#0aa5a0';
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath();
  ctx.arc(6, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.fillRect(10, -3, 8, 6);
  ctx.restore();
  // Muzzle flash.
  if (state.combat.muzzle > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(38, -6);
    ctx.lineTo(38, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawBullets(ctx, state) {
  ctx.save();
  ctx.strokeStyle = '#fff6b0';
  ctx.lineWidth = 2;
  for (const b of state.combat.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(ctx, state) {
  for (const pt of state.particles) {
    const frac = Math.max(0, pt.life / pt.max);
    ctx.save();
    ctx.globalAlpha = frac;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r * frac + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Rain streaks in screen space, recycled from a fixed pool.
const RAIN_DROPS = 130;
function drawRain(ctx, state, camX, camY, W, H) {
  const rain = state.weather.rain;
  const count = Math.floor(RAIN_DROPS * rain);
  ctx.save();
  ctx.strokeStyle = 'rgba(174,214,255,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i += 1) {
    const x = ((i * 97.3 + state.time * 60) % (W + 40)) - 20;
    const y = ((i * 57.7 + state.time * 900) % (H + 40)) - 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y + 16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeadlights(ctx, state, camX, camY, W, H) {
  const car = state.player.car;
  if (!car) return;
  const sx = car.x - (camX - W / 2);
  const sy = car.y - (camY - H / 2);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const side of [-1, 1]) {
    const a = car.angle + side * 0.16;
    const grad = ctx.createRadialGradient(sx, sy, 10, sx + Math.cos(a) * 200, sy + Math.sin(a) * 200, 220);
    grad.addColorStop(0, 'rgba(255,240,170,0.20)');
    grad.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a - 0.14) * 260, sy + Math.sin(a - 0.14) * 260);
    ctx.lineTo(sx + Math.cos(a + 0.14) * 260, sy + Math.sin(a + 0.14) * 260);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
