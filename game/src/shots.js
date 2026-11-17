// Screenshot staging: each ?shot= scene plays the real game forward from a
// fresh world for a fixed number of steps, steered by a small autopilot, so the
// frame is what a short game really looks like and the same seed always gives
// the same frame. The four scenes are the cover and the three that show the
// systems: start, on foot downtown, a rainy night chase, and the vault job.
import { CFG } from './config.js';
import { findRoute } from './citymap.js';
import { lockRain, unlockRain } from './weather.js';
import { makeCar } from './vehicles.js';
import { stepGame } from './engine.js';

const STEP = 1 / 60;

// A synthetic input the autopilot fills in each step, so staging reuses the
// exact step the player runs through.
function fakeInput() {
  return { keys: {}, pressed: {}, mouseX: 0, mouseY: 0, mouseDown: false, clicked: false };
}

function runSteps(state, steps, control) {
  const input = fakeInput();
  for (let i = 0; i < steps; i += 1) {
    input.keys = {};
    if (control) control(input, state);
    stepGame(state, STEP, input);
  }
}

// Steer a car along a route: full throttle, bang-bang steering toward the next
// waypoint, like a hurried driver yanking the wheel.
function driveToward(state, car, route, idx, input) {
  if (idx.i >= route.length) return;
  const target = route[idx.i];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  if (Math.hypot(dx, dy) < 20) {
    idx.i += 1;
    return;
  }
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.keys.KeyW = true;
  if (diff > 0.22) input.keys.KeyD = true;
  else if (diff < -0.22) input.keys.KeyA = true;
}

// Walk toward a waypoint on foot, one axis at a time.
function walkToward(state, target, input) {
  const p = state.player;
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  if (Math.abs(dx) > 14) input.keys[dx > 0 ? 'KeyD' : 'KeyA'] = true;
  else if (Math.abs(dy) > 14) input.keys[dy > 0 ? 'KeyS' : 'KeyW'] = true;
}

function placePlayerCar(state, type, x, y, angle, speed) {
  const car = makeCar(type, x, y, angle, 'player', state.rng);
  car.speed = speed;
  state.cars.push(car);
  state.player.car = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

function placePolice(state, spots) {
  for (const [type, x, y] of spots) {
    const car = makeCar(type, x, y, 0, 'police', state.rng);
    car.speed = 220;
    state.cars.push(car);
  }
}

/**
 * Set the world to the named scene (start, play, chase or mission) and return
 * the screen to draw over it. Any other name is the start scene.
 */
export function stageShot(name, state) {
  const city = state.city;
  state.toast = '';
  state.toastTimer = 0;
  unlockRain(state.weather);

  if (name === 'chase') {
    // Rainy Getaway, night: a sports car at 173 km/h down the Downtown grid,
    // four cruisers and an Interceptor on its tail, neon and rain everywhere.
    state.clock.hour = 22;
    lockRain(state.weather, 0.85);
    state.wanted = 4;
    state.heatTimer = 20;
    state.screen = 'play';
    // A straight run east along the Downtown road: no turns, so the sports car
    // holds its speed and the police stay on its tail the whole way.
    placePlayerCar(state, 'sports', 450, 450, 0, 480);
    placePolice(state, [
      ['cruiser', 150, 450],
      ['cruiser', 200, 450],
      ['cruiser', 250, 450],
      ['cruiser', 300, 450],
      ['interceptor', 350, 450],
    ]);
    const route = findRoute(city, 450, 450, 3150, 450);
    const idx = { i: 1 };
    runSteps(state, 360, (input) => {
      if (state.player.car) driveToward(state, state.player.car, route, idx, input);
    });
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // The Vault, morning: Raka holds the vault ring at wanted 4, the bar over
    // halfway cracked, two cruisers closing in across the Downtown grid.
    state.clock.hour = 9;
    state.wanted = 4;
    state.heatTimer = 20;
    state.screen = 'play';
    state.story.index = 5;
    state.story.stage = 1;
    state.story.hold = 4.4;
    state.story.target = { x: city.vaultRing.x, y: city.vaultRing.y };
    state.story.objectiveText = 'Hold the vault ring — 8 seconds';
    const ring = city.vaultRing;
    state.player.x = ring.x;
    state.player.y = ring.y;
    state.player.angle = -Math.PI / 2;
    placePolice(state, [
      ['cruiser', 750, 750],
      ['cruiser', 1650, 1050],
    ]);
    runSteps(state, 120, () => {});
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return { screen: 'play' };
  }

  if (name === 'play') {
    // On foot in Downtown: Raka walks toward the first package pickup while
    // traffic and pedestrians move around him.
    state.clock.hour = 10;
    state.screen = 'play';
    state.player.x = 1050;
    state.player.y = 750;
    state.player.angle = 0;
    const route = findRoute(city, 1050, 750, 1350, 450);
    const idx = { i: 1 };
    runSteps(state, 1080, (input) => {
      if (idx.i < route.length) {
        walkToward(state, route[idx.i], input);
        if (Math.hypot(route[idx.i].x - state.player.x, route[idx.i].y - state.player.y) < 20) idx.i += 1;
      } else {
        walkToward(state, { x: 1350, y: 450 }, input);
      }
    });
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    return { screen: 'play' };
  }

  // start: the title screen over a living city, five seconds in.
  state.clock.hour = 10;
  state.screen = 'title';
  state.player.x = 750;
  state.player.y = 1050;
  runSteps(state, 300, () => {});
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  return { screen: 'title' };
}
