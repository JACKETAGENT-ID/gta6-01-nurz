// shots.js — deterministic screenshot scenes behind ?shot=start|play|chase|mission.
// Each scene plays the real game forward from a fresh world for a fixed number
// of steps with a scripted autopilot, so the frame is what a short real game
// looks like and the same seed always gives the same frame.
import { intersection } from './city.js';

const STEP = 1 / 60;

export function stageShot(name, game) {
  game.reset(1);
  if (name === 'play') {
    game.startStory();
    // Facing west: the first leg of the route to the pickup runs west.
    game.givePlayerCar(intersection(6, 6).x, intersection(6, 6).y, Math.PI);
    game.auto = { follow: 'mission' };
    for (let i = 0; i < 15 / STEP; i += 1) game.step(STEP);
    game.auto = null;
    return 'play';
  }
  if (name === 'chase') {
    game.startStory();
    // Facing west: the first leg of the route to the pickup runs west.
    game.givePlayerCar(intersection(6, 6).x, intersection(6, 6).y, Math.PI);
    game.setWanted(3);
    // Patrol cars right behind the player, on the same street, so the frame
    // shows the chase itself instead of distant dots on the minimap.
    game.spawnPoliceBehind(3);
    game.auto = { follow: 'mission' };
    for (let i = 0; i < 6.5 / STEP; i += 1) game.step(STEP);
    game.auto = null;
    return 'play';
  }
  if (name === 'mission') {
    game.startStory();
    game.startMissionAt(1);
    const car = game.missions.chaseCar;
    // Same lane, 260 px behind the target coupe: outside the 150 px tail
    // radius, so the frame still shows the chase in progress, not the payout.
    game.givePlayerCar(car.x - 260, car.y, 0);
    // One short line for the frame; the two mission briefs would stack.
    game.messages = [];
    game.showMessage('Tail the orange coupe!', 4);
    game.auto = { follow: 'target' };
    for (let i = 0; i < 2.0 / STEP; i += 1) game.step(STEP);
    game.auto = null;
    return 'play';
  }
  // start (default): a living city behind the title screen.
  for (let i = 0; i < 5 / STEP; i += 1) game.stepAmbient(STEP);
  return 'title';
}
