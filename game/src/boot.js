// Boot v3: read ?shot= and ?seed=, start Neon Bay Nights.
// Any uncaught error is recorded on <html data-jserror> so a headless
// screenshot run can prove the game ran clean. The boot itself does as
// little as possible: parse, trap, create, mark.

import { createGame } from './engine.js';

function installErrorTraps() {
  const mark = (msg) => {
    document.documentElement.setAttribute('data-jserror', String(msg || 'error'));
  };
  window.addEventListener('error', (e) => mark(e && e.message));
  window.addEventListener('unhandledrejection', (e) => mark(e && e.reason && e.reason.message));
}

function readParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    seed: params.get('seed') || 'neon-bay-1',
    shot: params.get('shot') || null,
  };
}

installErrorTraps();
const { seed, shot } = readParams();
const canvas = document.getElementById('game');
createGame(canvas, { seed, shot });
document.documentElement.setAttribute('data-boot', 'ok');
