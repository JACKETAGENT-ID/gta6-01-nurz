// missions.js — Raka's story in three jobs for Madame Lumen, the fixer of Neon
// Bay. Each mission is a small state machine with a map marker, an objective
// line for the HUD, and a cash reward on completion.
import { intersection } from './city.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'Neon Package',
    brief: 'Madame Lumen needs a package moved across town. Pick it up at the Lumen Strip, then drop it at the Glass Harbour. No questions, no cops.',
    reward: 300,
  },
  {
    id: 'm2',
    title: 'Chase the Shadow',
    brief: 'A rival courier in an orange coupe is carrying Lumen\'s ledger. Tail him close for 4 seconds — or ram him — until he gives it up.',
    reward: 500,
  },
  {
    id: 'm3',
    title: 'The Big Escape',
    brief: 'The whole department is on you now. Survive 45 seconds at 3 stars, then vanish into the safehouse at Bukit Sinyal.',
    reward: 800,
  },
];

export function freshMissions() {
  return {
    index: 0,
    step: 'idle',
    target: null,
    timer: 0,
    progress: 0,
    completed: false,
    chaseCar: null,
  };
}

// Where the current objective marker sits on the map (null when none).
export function missionTarget(missions) {
  if (missions.step === 'pickup' || missions.step === 'deliver' || missions.step === 'escape') return missions.target;
  if (missions.step === 'chase' && missions.chaseCar) return { x: missions.chaseCar.x, y: missions.chaseCar.y };
  return null;
}

export function missionObjectiveText(game) {
  const m = game.missions;
  if (m.completed) return 'All jobs done — Neon Bay is yours, Raka.';
  const def = MISSIONS[m.index];
  if (!def) return '';
  if (m.step === 'pickup') return 'MISSION: ' + def.title + ' — pick up the package';
  if (m.step === 'deliver') return 'MISSION: ' + def.title + ' — deliver the package';
  if (m.step === 'chase') return 'MISSION: ' + def.title + ' — stay close to the orange coupe (' + Math.max(0, 4 - m.progress).toFixed(1) + 's)';
  if (m.step === 'survive') return 'MISSION: ' + def.title + ' — survive the heat (' + Math.ceil(m.timer) + 's)';
  if (m.step === 'escape') return 'MISSION: ' + def.title + ' — reach the safehouse!';
  return 'MISSION: ' + def.title;
}

export function startMission(game, index) {
  const m = game.missions;
  m.index = index;
  m.progress = 0;
  m.chaseCar = null;
  if (index === 0) {
    m.step = 'pickup';
    m.target = intersection(3, 3);
  } else if (index === 1) {
    m.step = 'chase';
    m.target = null;
    const car = game.spawnTargetCar();
    m.chaseCar = car;
  } else if (index === 2) {
    m.step = 'survive';
    m.timer = 45;
    m.target = null;
    game.setWanted(3);
  }
  const def = MISSIONS[index];
  game.showMessage(def.title + ' — ' + def.brief, 6);
  game.sound.jingle();
}

function completeMission(game) {
  const m = game.missions;
  const def = MISSIONS[m.index];
  game.cash += def.reward;
  game.showMessage(def.title + ' complete!  +$' + def.reward, 4);
  game.sound.cash();
  game.sound.jingle();
  m.index += 1;
  m.progress = 0;
  m.chaseCar = null;
  m.target = null;
  if (m.index >= MISSIONS.length) {
    m.completed = true;
    m.step = 'done';
    game.screen = 'complete';
    game.sound.jingle();
  } else {
    startMission(game, m.index);
  }
  game.save();
}

export function updateMissions(game, dt) {
  const m = game.missions;
  if (m.completed || m.step === 'idle') return;
  const p = game.player;
  if (m.step === 'pickup' || m.step === 'deliver' || m.step === 'escape') {
    if (!m.target) return;
    const d = Math.hypot(p.x - m.target.x, p.y - m.target.y);
    if (d < 52) {
      if (m.step === 'pickup') {
        m.step = 'deliver';
        m.target = intersection(9, 8);
        game.showMessage('Package secured. Deliver it to the Glass Harbour.', 4);
        game.sound.pickup();
      } else if (m.step === 'deliver') {
        completeMission(game);
      } else if (m.step === 'escape') {
        game.setWanted(0);
        completeMission(game);
      }
    }
  } else if (m.step === 'chase') {
    const car = m.chaseCar;
    if (!car) return;
    const d = Math.hypot(p.x - car.x, p.y - car.y);
    if (d < 150) {
      m.progress += dt;
      if (m.progress >= 4) completeMission(game);
    }
  } else if (m.step === 'survive') {
    m.timer -= dt;
    if (m.timer <= 0) {
      m.step = 'escape';
      m.target = intersection(9, 10);
      game.showMessage('You shook them — now reach the safehouse!', 4);
      game.sound.pickup();
    }
  }
}
