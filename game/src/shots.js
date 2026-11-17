// Deterministic screenshot staging for Neon Bay Nights.
// ?shot=start|play|chase|mission&seed=N puts the game in a fixed scene and
// runs a few fixed update ticks, so every screenshot is a real render of
// the game code and reproducible from the seed alone.

import { startMission } from './story.js';
import { makeVehicle } from './vehicles.js';

function placePlayerCar(state, kind, x, y, angle, speed) {
  const v = makeVehicle(state.rng, kind, x, y, angle);
  v.driver = 'player';
  v.speed = speed;
  state.vehicles.push(v);
  state.player.vehicle = v;
  state.player.x = x; state.player.y = y; state.player.angle = angle;
  // Clear the lane ahead so the staged car is not stuck on traffic.
  state.vehicles = state.vehicles.filter((o) => o === v || Math.hypot(o.x - x, o.y - y) > 300);
  return v;
}

function stagePoliceChase(state) {
  const pl = state.player;
  const offsets = [[-430, -70], [-540, 90], [-470, 170]];
  for (const [dx, dy] of offsets) {
    state.police.push({
      kind: 'police', x: pl.x + dx, y: pl.y + dy,
      angle: Math.atan2(pl.y - (pl.y + dy), pl.x - (pl.x + dx)),
      speed: 330, hp: 100, w: 48, h: 22, top: 430, accel: 360,
      color: '#1c2733', driver: 'police', axis: 'v', dir: 1,
      bustTimer: 0, siren: 0.4,
    });
  }
}

export function applyShot(state, shot, tick) {
  const spots = state.city.spots;
  if (shot === 'start') {
    state.mode = 'menu';
    state.dayT = 0.3;
    state.cam.x = 2000 - state.cam.w / 2;
    state.cam.y = 2000 - state.cam.h / 2;
    return;
  }
  if (shot === 'play') {
    state.mode = 'playing';
    state.dayT = 0.3;
    state.player.x = spots.playerStart.x;
    state.player.y = spots.playerStart.y;
    state.player.angle = -0.6;
    state.missionMessage = 'Pick up the package at the Old Docks warehouse';
    state.messageT = 999;
    for (let i = 0; i < 40; i++) tick(1 / 30);
    return;
  }
  if (shot === 'chase') {
    state.mode = 'playing';
    state.dayT = 0.56; // dusk: neon on, headlights on, city still readable
    startMission(state, 3);
    state.heat = 3.6; state.wanted = 3;
    placePlayerCar(state, 'sport', 2000, 2000, 0, 380);
    stagePoliceChase(state);
    state.missionMessage = 'Escape to the boat on Coral Beach — wanted level 4!';
    state.messageT = 999;
    state.cruise = true; // keep the getaway rolling while the shot is taken
    for (let i = 0; i < 18; i++) tick(1 / 30);
    // Keep the getaway speed for the frame.
    if (state.player.vehicle) state.player.vehicle.speed = 380;
    return;
  }
  if (shot === 'mission') {
    state.mode = 'playing';
    state.dayT = 0.16; // bright morning over the harbour
    startMission(state, 1);
    // Parked at the yard's edge, nose toward the crate beacon.
    placePlayerCar(state, 'truck', 1050, 3200, Math.PI, 0);
    state.missionMessage = 'Steal the cargo crate from the container yard';
    state.messageT = 999;
    for (let i = 0; i < 30; i++) tick(1 / 30);
    return;
  }
  // Unknown shot: plain play scene.
  state.mode = 'playing';
  state.dayT = 0.3;
}
