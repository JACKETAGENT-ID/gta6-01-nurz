// The story: six missions for Raka, from a first package run for Madame Lumen to
// the vault job at Neon Bay Bank. Missions run in order; each one is a small
// state machine of stages with a map marker, a timer where it fits, and a payout.
// Total rewards: $7,200.
import { lockRain, unlockRain } from './weather.js';
import { addWanted } from './police.js';
import { makeCar } from './vehicles.js';
import { playSting } from './audio.js';

export const MISSIONS = [
  { name: 'Neon Package', brief: 'Pick up the package in the Downtown alley, deliver it to Coral Beach.', reward: 800 },
  { name: 'Harbor Heist', brief: 'Lift the crate at the Old Docks container yard, then lose the heat.', reward: 1000 },
  { name: 'Chase the Shadow', brief: 'Tail the black sedan through Downtown — stay close, then stop it.', reward: 1200 },
  { name: 'The Big Escape', brief: 'The heat is on. Survive 45 seconds or reach the safehouse.', reward: 1400 },
  { name: 'Rainy Getaway', brief: 'Meet the fixer in the rain, then run the pier with the cops behind you.', reward: 1300 },
  { name: 'The Vault', brief: 'Crack the vault at Neon Bay Bank: hold the ring for 8 seconds, then vanish.', reward: 1500 },
];

export function createStory() {
  return {
    index: 0,
    stage: 0,
    timer: 0,
    hold: 0,
    target: null,
    targetCar: null,
    done: false,
    objectiveText: '',
  };
}

function setObjective(state, x, y, text) {
  state.story.target = { x, y };
  state.story.objectiveText = text;
}

function finishMission(state) {
  const m = MISSIONS[state.story.index];
  state.money += m.reward;
  state.toast = `Mission complete: ${m.name}  +$${m.reward}`;
  state.toastTimer = 3.5;
  playSting(state.audio);
  state.story.index += 1;
  state.story.stage = 0;
  state.story.timer = 0;
  state.story.hold = 0;
  state.story.targetCar = null;
  if (state.story.index >= MISSIONS.length) {
    state.story.done = true;
    state.screen = 'complete';
    unlockRain(state.weather);
    return;
  }
  startMission(state, state.story.index);
}

export function startMission(state, index) {
  const s = state.story;
  s.index = index;
  s.stage = 0;
  s.timer = 0;
  s.hold = 0;
  const m = MISSIONS[index];
  state.toast = `Mission ${index + 1}/6: ${m.name}`;
  state.toastTimer = 3;
  if (index === 0) setObjective(state, 1350, 450, 'Pick up the package');
  else if (index === 1) setObjective(state, 2550, 750, 'Reach the container yard');
  else if (index === 2) {
    const car = makeCar('sedan', 1050, 750, 0, 'traffic', state.rng);
    car.color = '#111111';
    car.speed = 220;
    state.cars.push(car);
    s.targetCar = car;
    setObjective(state, car.x, car.y, 'Tail the black sedan');
  } else if (index === 3) {
    addWanted(state, 3, 'The Big Escape');
    s.timer = 45;
    setObjective(state, 1650, 1650, 'Reach the safehouse — or survive 45s');
  } else if (index === 4) {
    lockRain(state.weather, 0.85);
    state.clock.hour = 22;
    setObjective(state, 1950, 1350, 'Meet the fixer in the alley');
  } else if (index === 5) {
    setObjective(state, state.city.vaultRing.x, state.city.vaultRing.y, 'Reach the bank forecourt');
  }
}

function nearPlayer(state, x, y, r) {
  const p = state.player;
  return Math.hypot(p.x - x, p.y - y) < r;
}

export function updateStory(state, dt) {
  const s = state.story;
  if (s.done || state.screen !== 'play') return;
  const p = state.player;
  if (s.index === 0) {
    if (s.stage === 0 && nearPlayer(state, 1350, 450, 60)) {
      s.stage = 1;
      setObjective(state, 750, 2100, 'Deliver the package to Coral Beach');
      state.toast = 'Package picked up — deliver it south';
      state.toastTimer = 2.5;
    } else if (s.stage === 1 && nearPlayer(state, 750, 2100, 60)) {
      finishMission(state);
    }
  } else if (s.index === 1) {
    if (s.stage === 0 && nearPlayer(state, 2550, 750, 60)) {
      s.stage = 1;
      s.hold = 0;
      setObjective(state, 2550, 750, 'Hold the ring — loading the crate');
      addWanted(state, 2, 'Heist spotted');
    } else if (s.stage === 1) {
      if (nearPlayer(state, 2550, 750, 70)) {
        s.hold += dt;
        if (s.hold >= 5) {
          s.stage = 2;
          setObjective(state, 450, 450, 'Escape to the north-west corner');
          state.toast = 'Crate loaded — run!';
          state.toastTimer = 2.5;
        }
      } else {
        s.hold = Math.max(0, s.hold - dt);
      }
    } else if (s.stage === 2 && nearPlayer(state, 450, 450, 70)) {
      finishMission(state);
    }
  } else if (s.index === 2) {
    const t = s.targetCar;
    if (!t) return;
    if (s.stage === 0) {
      setObjective(state, t.x, t.y, 'Tail the black sedan');
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      if (d < 230) {
        s.hold += dt;
        if (s.hold >= 20) {
          s.stage = 1;
          setObjective(state, t.x, t.y, 'Stop the sedan — ram it!');
          state.toast = 'You have his route — stop him now';
          state.toastTimer = 2.5;
        }
      } else {
        s.hold = Math.max(0, s.hold - dt * 0.5);
      }
      if (d > 700) {
        s.hold = 0;
        state.toast = 'You lost him — get back on his tail';
        state.toastTimer = 2;
      }
    } else if (s.stage === 1) {
      setObjective(state, t.x, t.y, 'Stop the sedan — ram it!');
      const d = Math.hypot(p.x - t.x, p.y - t.y);
      const closing = p.car ? Math.abs(p.car.speed) : 0;
      if (d < 55 && closing > 150) {
        t.speed = 0;
        finishMission(state);
      }
    }
  } else if (s.index === 3) {
    s.timer -= dt;
    if (s.timer <= 0) {
      finishMission(state);
    } else if (nearPlayer(state, 1650, 1650, 70)) {
      finishMission(state);
    }
  } else if (s.index === 4) {
    if (s.stage === 0 && nearPlayer(state, 1950, 1350, 60)) {
      s.stage = 1;
      addWanted(state, 3, 'The fixer is hot');
      setObjective(state, 2550, 2100, 'Run the pier in the rain');
      state.toast = 'The fixer talked — the pier, now!';
      state.toastTimer = 2.5;
    } else if (s.stage === 1 && nearPlayer(state, 2550, 2100, 70)) {
      unlockRain(state.weather);
      finishMission(state);
    }
  } else if (s.index === 5) {
    const ring = state.city.vaultRing;
    if (s.stage === 0 && nearPlayer(state, ring.x, ring.y, 70)) {
      s.stage = 1;
      s.hold = 0;
      addWanted(state, 4, 'The vault alarm');
      setObjective(state, ring.x, ring.y, 'Hold the vault ring — 8 seconds');
    } else if (s.stage === 1) {
      if (nearPlayer(state, ring.x, ring.y, ring.r)) {
        s.hold += dt;
        if (s.hold >= 8) {
          s.stage = 2;
          setObjective(state, 450, 1950, 'Escape to the beach safehouse');
          state.toast = 'Vault cracked — run for the beach!';
          state.toastTimer = 2.5;
        }
      } else {
        s.hold = Math.max(0, s.hold - dt);
      }
    } else if (s.stage === 2 && nearPlayer(state, 450, 1950, 70)) {
      finishMission(state);
    }
  }
}
