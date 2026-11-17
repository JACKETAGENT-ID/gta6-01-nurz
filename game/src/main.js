// main.js — Neon Bay Nights: the game loop, the player on foot and behind the
// wheel, car stealing, wanted heat, camera, and the wiring between every system.
import { SoundEngine } from './audio.js';
import { BLOCKS, WORLD, buildCity, collideBuildings, drawCity, intersection, nextWaypoint, roadCenter } from './city.js';
import { addParticles, drawParticles, fireBullet, makeParticles, tryPunch, updateBullets, updateParticles } from './combat.js';
import { drawHUD, drawScreen } from './hud.js';
import { Input } from './input.js';
import { freshMissions, missionTarget, startMission, updateMissions } from './missions.js';
import { makePoliceCar, policeTargetCount, spawnPointNear, updatePoliceCar } from './police.js';
import { loadSave, writeSave } from './save.js';
import { makeTrafficCar, makeWorldTraffic, scatterPedestrians, drawCar, drawPedestrian, drawPoliceCar, updatePedestrian, updateTrafficCar } from './traffic.js';
import { makeRng } from './rng.js';
import { stageShot } from './shots.js';

const PLAYER_SPEED = 190;
const CAR_MAX_SPEED = 430;
const CAR_ACCEL = 320;
const STEP = 1 / 60;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.vw = canvas.width;
    this.vh = canvas.height;
    this.input = new Input(canvas);
    this.sound = new SoundEngine();
    this.screen = 'title';
    this.time = 0;
    this.saveData = loadSave();
    this.bestCash = this.saveData ? this.saveData.bestCash : 0;
    this.reset(20261117);
  }

  reset(seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.city = buildCity(seed);
    const traffic = makeWorldTraffic(seed);
    this.cars = traffic.cars;
    this.peds = traffic.peds;
    this.trafficRng = traffic.rng;
    this.parkedCars = [];
    this.police = [];
    this.bullets = [];
    this.particles = makeParticles();
    this.pickups = [];
    const home = intersection(6, 6);
    this.safehouse = { x: home.x, y: home.y };
    this.player = {
      x: home.x + 60, y: home.y + 60, angle: 0, hp: 100,
      car: null, ammo: 12, lastShot: -9, lastPunch: -9, punchAnim: 0,
      reloadTimer: 0, hitCooldown: 0,
    };
    this.cash = 120;
    this.wanted = 0;
    this.wantedDecay = 0;
    this.policeTimer = 0;
    this.missions = freshMissions();
    this.messages = [];
    this.cam = { x: 0, y: 0 };
    this.shake = 0;
    this.auto = null;
    this.pickupTimer = 0;
    for (let i = 0; i < 8; i += 1) this.spawnPickup();
  }

  spawnPickup() {
    const spot = intersection(this.rng.int(1, BLOCKS - 1), this.rng.int(1, BLOCKS - 1));
    this.pickups.push({
      x: spot.x + (this.rng.chance(0.5) ? 34 : -34),
      y: spot.y + (this.rng.chance(0.5) ? 34 : -34),
      amount: 50,
      taken: false,
    });
  }

  showMessage(text, seconds) {
    this.messages.push({ text, ttl: seconds || 3.5 });
    if (this.messages.length > 3) this.messages.shift();
  }

  save() {
    writeSave(this);
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.wantedDecay = 0;
  }

  gainWanted(n) {
    this.setWanted(this.wanted + n);
  }

  bustPlayer() {
    if (this.screen !== 'play') return;
    this.screen = 'busted';
    this.sound.busted();
    this.sound.setEngine(false, 0);
    this.save();
  }

  wastePlayer() {
    if (this.screen !== 'play') return;
    this.screen = 'over';
    this.sound.busted();
    this.sound.setEngine(false, 0);
    this.save();
  }

  startStory() {
    this.screen = 'play';
    this.sound.ensure();
    if (this.missions.step === 'idle' && !this.missions.completed) startMission(this, this.missions.index);
  }

  startMissionAt(index) {
    startMission(this, index);
  }

  spawnTargetCar() {
    const spot = intersection(4, 9);
    const car = makeTrafficCar(this.trafficRng, null, 'target');
    car.x = spot.x;
    car.y = spot.y + 12;
    car.axis = 'x';
    car.dir = 1;
    car.angle = 0;
    this.cars.push(car);
    return car;
  }

  spawnPoliceBurst(count) {
    for (let i = 0; i < count; i += 1) {
      const spot = spawnPointNear(this.rng, this.player.x, this.player.y);
      const car = makePoliceCar(spot.x, spot.y);
      this.police.push(car);
    }
  }

  // Patrol cars directly behind the player's car, on the same street.
  spawnPoliceBehind(count) {
    const p = this.player;
    const fx = Math.cos(p.angle);
    const fy = Math.sin(p.angle);
    for (let i = 0; i < count; i += 1) {
      const back = 140 + i * 85;
      const lateral = (i - 1) * 14;
      const car = makePoliceCar(
        p.x - fx * back - fy * lateral,
        p.y - fy * back + fx * lateral,
      );
      car.angle = p.angle;
      car.speed = 200;
      this.police.push(car);
    }
  }

  givePlayerCar(x, y, angle) {
    const car = {
      kind: 'player', x, y, angle: angle || 0, speed: 0,
      color: '#22d3ee', brake: false,
    };
    this.player.car = car;
    this.player.x = x;
    this.player.y = y;
    return car;
  }

  // ---- autopilot (screenshot staging only) ----
  // Steers at the next grid intersection on the route to the target, slowing
  // for corners, so the car stays on the streets instead of ramming buildings.
  autopilotInput() {
    const p = this.player;
    let tx = this.auto.x;
    let ty = this.auto.y;
    if (this.auto.follow === 'target' && this.missions.chaseCar) {
      tx = this.missions.chaseCar.x;
      ty = this.missions.chaseCar.y;
    } else if (this.auto.follow === 'mission') {
      const t = missionTarget(this.missions);
      if (t) { tx = t.x; ty = t.y; }
    }
    // No valid target (a mission just finished mid-staging): stop safely
    // instead of steering at undefined and poisoning the position with NaN.
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
      if (p.car) return { steer: 0, throttle: 0, brake: true };
      return { mx: 0, my: 0, moving: false };
    }
    const finalDist = Math.hypot(tx - p.x, ty - p.y);
    // Close on the target coupe: steer straight at it — same street, no corner
    // to cut. Otherwise follow the grid, one intersection at a time.
    const wp = (this.auto.follow === 'target' && finalDist < 350)
      ? { x: tx, y: ty }
      : nextWaypoint(p.x, p.y, tx, ty);
    const dx = wp.x - p.x;
    const dy = wp.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (p.car) {
      const car = p.car;
      const desired = Math.atan2(dy, dx);
      const diff = angleDiff(desired, car.angle);
      const sharp = Math.abs(diff) > 0.7;
      // Sharp corner ahead: crawl at ~100 px/s so the 37 px turning circle
      // fits the 48 px street instead of swinging into the building.
      const slow = dist < 160 ? (sharp ? 0.2 : 0.5) : 1;
      // Facing the wrong way: turn on the spot instead of swinging a wide
      // U-turn through the building on the corner.
      if (Math.abs(diff) > 2.4) {
        return { steer: clamp(diff * 1.8, -1, 1), throttle: 0, brake: false };
      }
      return {
        steer: clamp(diff * 1.8, -1, 1),
        throttle: finalDist < 60 ? 0 : slow * (Math.abs(diff) < 1.1 ? 1 : 0.4),
        brake: finalDist < 40 || (sharp && Math.abs(car.speed) > 110),
      };
    }
    const len = Math.max(1, dist);
    return { mx: dx / len, my: dy / len, moving: finalDist > 12 };
  }

  // ---- player ----
  updatePlayer(dt) {
    const p = this.player;
    p.punchAnim = Math.max(0, p.punchAnim - dt);
    p.hitCooldown = Math.max(0, p.hitCooldown - dt);
    if (p.reloadTimer > 0) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) p.ammo = 12;
    }
    const input = this.input;
    if (input.pressed('KeyM')) this.sound.setMuted(!this.sound.muted);
    if (input.pressed('KeyE')) this.toggleCar();
    if (input.pressed('KeyF')) tryPunch(this);
    if (input.pressed('KeyR') && p.ammo < 12 && p.reloadTimer <= 0) p.reloadTimer = 0.9;
    // Shooting: click aims at the mouse, Space fires along the facing.
    const wantShoot = input.mouse.clicked || input.down('Space');
    if (wantShoot && this.time - p.lastShot > 0.22 && p.ammo > 0 && p.reloadTimer <= 0) {
      p.lastShot = this.time;
      p.ammo -= 1;
      let angle = p.angle;
      if (input.mouse.clicked) {
        angle = Math.atan2(input.mouse.y + this.cam.y - p.y, input.mouse.x + this.cam.x - p.x);
        p.angle = angle;
      }
      fireBullet(this, p.x, p.y, angle);
      if (p.ammo === 0) p.reloadTimer = 0.9;
    }
    if (p.car) this.driveCar(p.car, dt);
    else this.walkPlayer(dt);
    // Health slowly recovers when the heat is off.
    if (this.wanted === 0 && p.hp < 100) p.hp = Math.min(100, p.hp + 4 * dt);
    if (p.hp <= 0) this.wastePlayer();
  }

  walkPlayer(dt) {
    const p = this.player;
    let mx = 0;
    let my = 0;
    if (this.auto) {
      const a = this.autopilotInput();
      if (a.moving) { mx = a.mx; my = a.my; }
    } else {
      const axis = this.input.axis();
      mx = axis.x;
      my = axis.y;
    }
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      p.angle = Math.atan2(my, mx);
      const nx = p.x + mx * PLAYER_SPEED * dt;
      const ny = p.y + my * PLAYER_SPEED * dt;
      if (!collideBuildings(this.city, nx, p.y, 13)) p.x = nx;
      if (!collideBuildings(this.city, p.x, ny, 13)) p.y = ny;
    }
    p.x = clamp(p.x, 14, WORLD - 14);
    p.y = clamp(p.y, 14, WORLD - 14);
    // Traffic that hits a pedestrian on foot hurts.
    for (const car of this.cars) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < 26 && car.speed > 60 && p.hitCooldown <= 0) {
        p.hp -= 15;
        p.hitCooldown = 1;
        this.addParticles(p.x, p.y, 10, '#fca5a5', 200);
        this.sound.crash();
        this.shake = 6;
      }
    }
  }

  driveCar(car, dt) {
    let steer = 0;
    let throttle = 0;
    let brake = false;
    if (this.auto) {
      const a = this.autopilotInput();
      steer = a.steer;
      throttle = a.throttle;
      brake = a.brake;
    } else {
      const axis = this.input.axis();
      steer = axis.x;
      throttle = axis.y < 0 ? 1 : 0;
      brake = axis.y > 0;
    }
    // Unstick: pushing against a wall with no movement for half a second
    // backs the car out (steering the other way) instead of grinding in place.
    if (this.unstickTimer > 0) {
      this.unstickTimer -= dt;
      throttle = 0;
      brake = true;
      steer = -steer;
    } else if (throttle > 0 && Math.abs(car.speed) < 30) {
      this.stuckTimer = (this.stuckTimer || 0) + dt;
      if (this.stuckTimer > 0.5) {
        this.unstickTimer = 0.7;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }
    // Tight turns at low speed (radius ~22 px at 60 px/s), wide fast sweeps:
    // the car can actually make a 48 px street corner instead of grinding it.
    const speedFactor = clamp(Math.abs(car.speed) / 60, 0.5, 1);
    car.angle += steer * 2.7 * dt * speedFactor * (car.speed < -5 ? -1 : 1);
    if (throttle > 0) car.speed = Math.min(CAR_MAX_SPEED, car.speed + CAR_ACCEL * dt);
    else if (brake) {
      if (car.speed > 0) car.speed = Math.max(0, car.speed - 520 * dt);
      else car.speed = Math.max(-130, car.speed - 200 * dt);
    } else {
      car.speed -= car.speed * 0.7 * dt;
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.brake = brake && car.speed > 20;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    let blockedX = false;
    let blockedY = false;
    if (!collideBuildings(this.city, nx, car.y, 19)) car.x = nx;
    else {
      blockedX = true;
      car.speed *= 0.6;
      this.crashFeedback(car.x, car.y);
    }
    if (!collideBuildings(this.city, car.x, ny, 19)) car.y = ny;
    else {
      blockedY = true;
      car.speed *= 0.6;
      this.crashFeedback(car.x, car.y);
    }
    // Wedged on a building corner: back out instead of grinding in place.
    if (blockedX && blockedY) car.speed = -Math.max(50, Math.abs(car.speed) * 0.3);
    car.x = clamp(car.x, 14, WORLD - 14);
    car.y = clamp(car.y, 14, WORLD - 14);
    this.player.x = car.x;
    this.player.y = car.y;
    this.player.angle = car.angle;
    // Bumping traffic.
    for (const other of this.cars) {
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const ux = (other.x - car.x) / d;
        const uy = (other.y - car.y) / d;
        other.x += ux * push;
        other.y += uy * push;
        car.x -= ux * push * 0.4;
        car.y -= uy * push * 0.4;
        if (Math.abs(car.speed) > 120) {
          car.speed *= 0.75;
          other.speed *= 0.5;
          this.crashFeedback(other.x, other.y);
          // Ramming the target car counts toward the chase — once a second
          // at most, so three quick bumps do not finish the job instantly.
          if (other.kind === 'target' && this.missions.step === 'chase'
            && this.time - (this.lastRamProgress || 0) > 1.2) {
            this.lastRamProgress = this.time;
            this.missions.progress += 1;
            this.showMessage('Ram! The courier is rattled.', 2);
          }
        }
      }
    }
    // Pedestrians scatter from a speeding car; a hard hit is a crime.
    for (let i = this.peds.length - 1; i >= 0; i -= 1) {
      const ped = this.peds[i];
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 60) ped.fleeUntil = this.time + 2;
      if (d < 24 && Math.abs(car.speed) > 150) {
        this.peds.splice(i, 1);
        this.addParticles(ped.x, ped.y, 12, '#fca5a5', 200);
        this.gainWanted(1);
        this.showMessage('Pedestrian down! The city saw that.', 3);
        this.sound.crash();
      }
    }
    this.sound.setEngine(true, Math.abs(car.speed) / CAR_MAX_SPEED);
  }

  crashFeedback(x, y) {
    if (this.time - (this.lastCrash || 0) > 0.5) {
      this.lastCrash = this.time;
      this.addParticles(x, y, 8, '#facc15', 160);
      this.sound.crash();
      this.shake = 5;
    }
  }

  toggleCar() {
    const p = this.player;
    if (p.car) {
      const car = p.car;
      const px = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      const py = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      if (!collideBuildings(this.city, px, py, 13)) {
        p.x = px;
        p.y = py;
      } else {
        p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
      }
      car.speed = 0;
      this.parkedCars.push(car);
      p.car = null;
      this.sound.setEngine(false, 0);
      return;
    }
    let best = null;
    let bestD = 62;
    const tryList = (list) => {
      for (const car of list) {
        const d = Math.hypot(car.x - p.x, car.y - p.y);
        if (d < bestD) { bestD = d; best = { car, list }; }
      }
    };
    tryList(this.cars);
    tryList(this.parkedCars);
    if (!best) return;
    if (best.car.kind === 'target') {
      this.showMessage('That coupe is the job — tail it, don\'t steal it.', 3);
      return;
    }
    const stolen = best.list === this.cars;
    best.list.splice(best.list.indexOf(best.car), 1);
    best.car.speed = 0;
    p.car = best.car;
    p.x = best.car.x;
    p.y = best.car.y;
    if (stolen) {
      this.gainWanted(1);
      this.showMessage('Car stolen! Wanted level rose.', 3);
      this.sound.crash();
    }
  }

  // ---- ambient world ----
  stepAmbient(dt) {
    this.time += dt;
    for (const car of this.cars) {
      updateTrafficCar(car, dt, this.trafficRng, this.city, this.cars, null, car.kind === 'target');
    }
    for (const ped of this.peds) updatePedestrian(ped, dt, this.time, this.trafficRng);
    updateParticles(this.particles, dt);
  }

  // ---- main step ----
  step(dt) {
    this.time += dt;
    for (let i = this.messages.length - 1; i >= 0; i -= 1) {
      this.messages[i].ttl -= dt;
      if (this.messages[i].ttl <= 0) this.messages.splice(i, 1);
    }
    if (this.screen === 'title' || this.screen === 'pause') {
      this.stepAmbient(dt);
      this.updateCamera(dt);
      this.input.endFrame();
      return;
    }
    if (this.screen !== 'play') {
      this.input.endFrame();
      return;
    }
    if (this.input.pressed('KeyP') || this.input.pressed('Escape')) {
      this.screen = 'pause';
      this.sound.setEngine(false, 0);
      this.input.endFrame();
      return;
    }
    this.updatePlayer(dt);
    if (this.screen !== 'play') {
      this.input.endFrame();
      return;
    }
    for (const car of this.cars) {
      updateTrafficCar(car, dt, this.trafficRng, this.city, this.cars, this.player, car.kind === 'target');
    }
    for (const ped of this.peds) updatePedestrian(ped, dt, this.time, this.trafficRng);
    updateBullets(this, dt);
    updateParticles(this.particles, dt);
    updateMissions(this, dt);
    // Wanted: patrol cars spawn, and heat fades when no patrol is near.
    this.policeTimer -= dt;
    const target = policeTargetCount(this.wanted);
    if (this.policeTimer <= 0) {
      this.policeTimer = 1;
      if (this.police.length < target) {
        const spot = spawnPointNear(this.rng, this.player.x, this.player.y);
        this.police.push(makePoliceCar(spot.x, spot.y));
      }
    }
    for (let i = this.police.length - 1; i >= 0; i -= 1) {
      updatePoliceCar(this.police[i], dt, this);
      if (this.wanted === 0 && Math.hypot(this.police[i].x - this.player.x, this.police[i].y - this.player.y) > 1000) {
        this.police.splice(i, 1);
      }
    }
    // Patrol cars keep their distance from each other instead of piling up.
    for (let i = 0; i < this.police.length; i += 1) {
      for (let j = i + 1; j < this.police.length; j += 1) {
        const a = this.police[i];
        const b = this.police[j];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const ux = (b.x - a.x) / d;
          const uy = (b.y - a.y) / d;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
    if (this.wanted > 0) {
      let near = false;
      for (const car of this.police) {
        if (Math.hypot(car.x - this.player.x, car.y - this.player.y) < 600) { near = true; break; }
      }
      if (!near) {
        this.wantedDecay += dt;
        if (this.wantedDecay > 8) {
          this.wanted -= 1;
          this.wantedDecay = 0;
          this.showMessage('Heat is cooling off…', 2.5);
        }
      } else {
        this.wantedDecay = 0;
      }
    }
    this.sound.updateSiren(dt, this.wanted);
    if (!this.player.car) this.sound.setEngine(false, 0);
    // Cash pickups.
    this.pickupTimer -= dt;
    if (this.pickupTimer <= 0) {
      this.pickupTimer = 18;
      if (this.pickups.filter((pk) => !pk.taken).length < 8) this.spawnPickup();
    }
    for (const pk of this.pickups) {
      if (!pk.taken && Math.hypot(pk.x - this.player.x, pk.y - this.player.y) < 28) {
        pk.taken = true;
        this.cash += pk.amount;
        this.showMessage('Street cash  +$' + pk.amount, 2);
        this.sound.cash();
      }
    }
    this.updateCamera(dt);
    this.input.endFrame();
  }

  updateCamera(dt) {
    const tx = clamp(this.player.x - this.vw / 2, 0, Math.max(0, WORLD - this.vw));
    const ty = clamp(this.player.y - this.vh / 2, 0, Math.max(0, WORLD - this.vh));
    const k = Math.min(1, dt * 6);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.shake = Math.max(0, this.shake - dt * 14);
  }

  addParticles(x, y, count, color, speed) {
    addParticles(this.particles, x, y, count, color, speed);
  }

  // ---- render ----
  render() {
    const ctx = this.ctx;
    const shx = this.shake > 0 ? Math.sin(this.time * 91.7) * this.shake : 0;
    const shy = this.shake > 0 ? Math.cos(this.time * 113.3) * this.shake : 0;
    ctx.save();
    ctx.clearRect(0, 0, this.vw, this.vh);
    ctx.translate(-Math.round(this.cam.x + shx), -Math.round(this.cam.y + shy));
    drawCity(ctx, this.city, this.cam, this.vw, this.vh, this.time);
    // Safehouse.
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(this.safehouse.x, this.safehouse.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#052e16';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', this.safehouse.x, this.safehouse.y);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Cash pickups.
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(this.time * 4 + pk.x) * 3;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#713f12';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', pk.x, pk.y + bob);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    // Mission marker beacon.
    const target = missionTarget(this.missions);
    if (target && this.screen === 'play') {
      const pulse = 24 + Math.sin(this.time * 5) * 6;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.12)';
      ctx.fillRect(target.x - 3, target.y - 320, 6, 320);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 34);
      ctx.lineTo(target.x + 10, target.y - 20);
      ctx.lineTo(target.x, target.y - 6);
      ctx.lineTo(target.x - 10, target.y - 20);
      ctx.closePath();
      ctx.fill();
    }
    for (const car of this.parkedCars) drawCar(ctx, car, this.time);
    for (const car of this.cars) {
      if (car.kind === 'target') {
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(car.x, car.y, 30 + Math.sin(this.time * 5) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawCar(ctx, car, this.time);
    }
    for (const car of this.police) drawPoliceCar(ctx, car, this.time);
    for (const ped of this.peds) drawPedestrian(ctx, ped);
    this.drawPlayer(ctx);
    drawParticles(ctx, this.particles);
    ctx.restore();
    drawHUD(ctx, this);
    if (this.screen !== 'play') drawScreen(ctx, this);
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (p.car) {
      drawCar(ctx, p.car, this.time);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.car.x, p.car.y, 30, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 5, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fcd9b8';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4 - 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick and punch arm.
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
    ctx.lineTo(p.x + Math.cos(p.angle) * (p.punchAnim > 0 ? 26 : 17), p.y + Math.sin(p.angle) * (p.punchAnim > 0 ? 26 : 17));
    ctx.stroke();
    // Pistol when armed.
    if (p.ammo > 0) {
      ctx.fillStyle = '#334155';
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillRect(10, -2, 12, 4);
      ctx.restore();
    }
  }

  // ---- menu input ----
  menuStep() {
    const input = this.input;
    if (this.screen === 'title') {
      this.sound.ensure();
      if (input.pressed('Enter') || input.mouse.clicked) {
        this.cash = 120;
        this.missions = freshMissions();
        this.player.hp = 100;
        this.startStory();
      } else if (input.pressed('KeyC') && this.saveData) {
        this.cash = this.saveData.cash;
        this.missions = freshMissions();
        this.missions.index = this.saveData.missionIndex;
        this.missions.completed = this.saveData.completed;
        this.player.hp = 100;
        if (!this.missions.completed) startMission(this, this.missions.index);
        else this.screen = 'complete';
        if (this.screen !== 'complete') this.screen = 'play';
        this.sound.ensure();
      }
    } else if (this.screen === 'pause') {
      if (input.pressed('KeyP') || input.pressed('Escape') || input.pressed('Enter')) this.screen = 'play';
    } else if (this.screen === 'over' || this.screen === 'busted' || this.screen === 'complete') {
      if (input.pressed('KeyR') || input.pressed('Enter')) {
        const keepCash = this.cash;
        const keepIndex = this.missions.index;
        this.reset(this.seed);
        this.cash = keepCash;
        this.missions.index = keepIndex;
        if (this.missions.index < 3) startMission(this, this.missions.index);
        this.screen = 'play';
      }
    }
    this.input.endFrame();
  }

  frame() {
    if (this.screen === 'title' || this.screen === 'pause' || this.screen === 'over' || this.screen === 'busted' || this.screen === 'complete') {
      this.menuStep();
    }
    this.step(STEP);
    this.render();
  }
}

function resizeCanvas(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

const canvas = document.getElementById('game');
resizeCanvas(canvas);
const game = new Game(canvas);
window.addEventListener('resize', () => {
  resizeCanvas(canvas);
  game.vw = canvas.width;
  game.vh = canvas.height;
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = params.get('seed');
if (shot) {
  const seed = seedParam ? Number(seedParam) || 1 : 1;
  game.reset(seed);
  const screen = stageShot(shot, game);
  game.screen = screen;
  game.updateCamera(1);
  game.render();
} else {
  const loop = () => {
    game.frame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
