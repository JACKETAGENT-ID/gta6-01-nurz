// Boot: read ?shot= and ?seed=, start Neon Bay Nights.
// Any uncaught error is recorded on <html data-jserror> so a headless
// screenshot run can prove the game ran clean.

import { createGame } from './engine.js';

window.addEventListener('error', (e) => {
  document.documentElement.setAttribute('data-jserror', String((e && e.message) || 'error'));
});
window.addEventListener('unhandledrejection', (e) => {
  document.documentElement.setAttribute('data-jserror', String((e && e.reason && e.reason.message) || 'rejection'));
});

const params = new URLSearchParams(window.location.search);
const seed = params.get('seed') || 'neon-bay-1';
const shot = params.get('shot') || null;

const canvas = document.getElementById('game');
createGame(canvas, { seed, shot });
document.documentElement.setAttribute('data-boot', 'ok');
