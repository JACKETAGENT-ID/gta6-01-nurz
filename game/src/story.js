// Story: four missions for Raka, plus the taxi side-job.
// Madame Lumen runs the Neon Bay night scene. Raka starts as her courier
// and ends up running from the whole Neon Bay police force to a boat on
// Coral Beach. Each mission is a chain of stages with a map target.

import { addHeat } from './police.js';
import { randomRoadPoint } from './citymap.js';

export const MISSIONS = [
  {
    name: 'Neon Package',
    giver: 'Madame Lumen',
    pay: 400,
    briefing: 'Pick up the glowing case at the dock warehouse, then bring it to Lumen\'s lounge. No questions, no stops.',
    stages: [
      { text: 'Pick up the package at the Old Docks warehouse', spot: 'warehouse', radius: 90 },
      { text: 'Deliver the package to Lumen\'s Lounge downtown', spot: 'lumenLounge', radius: 90 },
    ],
  },
  {
    name: 'Harbor Heist',
    giver: 'Madame Lumen',
    pay: 700,
    briefing: 'A crate of Lumen\'s goods is sitting unguarded in the container yard. Take it. The harbour patrol will not like it.',
    stages: [
      { text: 'Steal the cargo crate from the container yard', spot: 'containerYard', radius: 100 },
      { text: 'Lose the heat and stash the crate at the hideout', spot: 'hideout', radius: 90 },
    ],
  },
  {
    name: 'Chase the Shadow',
    giver: 'Madame Lumen',
    pay: 900,
    briefing: 'Someone has been tailing Lumen\'s couriers. Follow the grey shadow car without spooking it, then cut it off at the plaza.',
    stages: [
      { text: 'Tail the shadow car — stay close, do not ram it', shadow: true, radius: 520 },
      { text: 'Cut off the shadow car at the north plaza', spot: 'shadowEnd', radius: 110 },
    ],
  },
  {
    name: 'The Big Escape',
    giver: 'Madame Lumen',
    pay: 1500,
    briefing: 'The whole force is coming down. Run the roadblocks, reach the boat on Coral Beach, and Neon Bay is yours.',
    stages: [
      { text: 'Escape to the boat on Coral Beach — wanted level 4!', spot: 'escapeBoat', radius: 110 },
    ],
  },
];

export function currentMission(state) {
  return state.missionIdx < MISSIONS.length ? MISSIONS[state.missionIdx] : null;
}

export function missionTarget(state) {
  const m = currentMission(state);
  if (!m) return null;
  const st = m.stages[state.missionStage];
  if (!st) return null;
  if (st.shadow) return state.shadowCar ? { x: state.shadowCar.x, y: state.shadowCar.y, label: 'Shadow car' } : null;
  const spot = state.city.spots[st.spot];
  return spot ? { x: spot.x, y: spot.y, label: st.text } : null;
}

export function startMission(state, idx) {
  state.missionIdx = idx;
  state.missionStage = 0;
  state.missionDone = false;
  const m = MISSIONS[idx];
  state.missionMessage = `${m.giver}: ${m.briefing}`;
  state.hudFlash = `Mission: ${m.name}`;
  if (idx === 2) spawnShadowCar(state);
  if (idx === 3) {
    state.heat = 5.5;
    state.wanted = 4;
    state.lastCrime = state.time;
  }
  state.audio.sfx('mission');
}

export function spawnShadowCar(state) {
  const s = state.city.spots.shadowStart;
  state.shadowCar = {
    x: s.x, y: s.y, angle: 0, speed: 150, hp: 100,
    w: 48, h: 22, color: '#6a6f7a', kind: 'shadow',
    waypoints: [
      { x: 2800, y: 2800 }, { x: 3600, y: 2000 }, { x: 3600, y: 1200 },
      { x: 2000, y: 1200 }, { x: 1200, y: 1200 },
    ],
    wp: 0, tailTime: 0,
  };
}

export function updateMissions(state, dt) {
  const m = currentMission(state);
  if (!m) return;
  const st = m.stages[state.missionStage];
  if (!st) return;
  const pl = state.player;

  if (st.shadow && state.shadowCar) {
    const sc = state.shadowCar;
    const wp = sc.waypoints[sc.wp];
    const d = Math.hypot(wp.x - sc.x, wp.y - sc.y);
    if (d < 60) sc.wp = Math.min(sc.wp + 1, sc.waypoints.length - 1);
    const a = Math.atan2(wp.y - sc.y, wp.x - sc.x);
    let diff = a - sc.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    sc.angle += Math.max(-1.8 * dt, Math.min(1.8 * dt, diff));
    sc.x += Math.cos(sc.angle) * sc.speed * dt;
    sc.y += Math.sin(sc.angle) * sc.speed * dt;
    const pd = Math.hypot(pl.x - sc.x, pl.y - sc.y);
    if (pd < 520 && pd > 50) {
      sc.tailTime += dt;
      if (sc.tailTime > 10) {
        state.missionStage = 1;
        state.shadowCar = null;
        state.missionMessage = 'You know its route now. Cut it off at the north plaza!';
        state.audio.sfx('mission');
      }
    } else if (pd >= 520) {
      sc.tailTime = Math.max(0, sc.tailTime - dt * 2);
    }
    if (pd < 50) {
      sc.tailTime = Math.max(0, sc.tailTime - dt * 3);
      state.missionMessage = 'Too close! Back off or the shadow car will spook.';
    }
    return;
  }

  const spot = state.city.spots[st.spot];
  if (!spot) return;
  const d = Math.hypot(pl.x - spot.x, pl.y - spot.y);
  if (d < st.radius) {
    if (state.missionIdx === 1 && state.missionStage === 0) {
      addHeat(state, 2);
      state.missionMessage = 'Crate grabbed! The harbour patrol is on you — run!';
    }
    state.missionStage += 1;
    state.audio.sfx('pickup');
    if (state.missionStage >= m.stages.length) {
      completeMission(state, m);
    } else {
      state.missionMessage = m.stages[state.missionStage].text;
    }
  }
}

function completeMission(state, m) {
  state.money += m.pay;
  state.earned += m.pay;
  state.missionMessage = `Mission complete: ${m.name} — $${m.pay} earned.`;
  state.hudFlash = `+$${m.pay} — ${m.name} complete!`;
  state.audio.sfx('mission');
  state.missionIdx += 1;
  state.missionStage = 0;
  if (state.missionIdx >= MISSIONS.length) {
    state.mode = 'complete';
    state.audio.sfx('mission');
  } else {
    startMission(state, state.missionIdx);
  }
}

// ---- Taxi side-job -------------------------------------------------------

export function startTaxiJob(state) {
  if (state.taxi.active || state.mode !== 'playing') return;
  const stand = state.rng.pick(state.city.taxiStands);
  const dest = randomRoadPoint(state.city, state.rng);
  const fare = 30 + Math.round(Math.hypot(dest.x - stand.x, dest.y - stand.y) / 60);
  state.taxi = {
    active: true, boarded: false, fare,
    px: stand.x, py: stand.y, dx: dest.x, dy: dest.y,
    timer: 150,
  };
  state.missionMessage = `Taxi job: pick up the passenger at the stand ($${fare} fare).`;
  state.audio.sfx('taxi');
}

export function updateTaxi(state, dt) {
  const t = state.taxi;
  if (!t.active) return;
  t.timer -= dt;
  if (t.timer <= 0) {
    state.taxi = { active: false };
    state.missionMessage = 'Taxi job expired — the passenger gave up waiting.';
    return;
  }
  const pl = state.player;
  if (!t.boarded) {
    if (pl.vehicle && Math.hypot(pl.x - t.px, pl.y - t.py) < 80) {
      t.boarded = true;
      t.vehicle = pl.vehicle;
      state.missionMessage = 'Passenger aboard! Drive them to the yellow marker.';
      state.audio.sfx('pickup');
    }
  } else if (Math.hypot(pl.x - t.dx, pl.y - t.dy) < 100) {
    state.money += t.fare;
    state.earned += t.fare;
    state.hudFlash = `Taxi fare +$${t.fare}!`;
    state.missionMessage = 'Fare paid. Press T for another passenger.';
    state.audio.sfx('mission');
    state.taxi = { active: false };
  }
}
