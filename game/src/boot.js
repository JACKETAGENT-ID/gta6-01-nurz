// Boot: the entrypoint of Neon Bay Nights. It sizes the canvas, wires the input,
// and either stages one deterministic screenshot scene (?shot=...&seed=1) or
// runs the interactive game loop. A clean first frame sets data-boot="ok"; any
// uncaught error sets data-jserror instead, so a screenshot run can prove the
// game actually booted.
import { createGame, stepGame, renderGame } from './engine.js';
import { stageShot } from './shots.js';
import { createInput, bindInput, endInputStep } from './controls.js';

const params = new URLSearchParams(window.location.search);
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('error', (event) => {
  document.documentElement.dataset.jserror = String((event && event.message) || 'error');
});
window.addEventListener('unhandledrejection', (event) => {
  document.documentElement.dataset.jserror = String((event && event.reason) || 'rejection');
});

const input = createInput();
bindInput(input, canvas);
const state = createGame(seed);

if (shot) {
  // One deterministic frame for a screenshot.
  try {
    stageShot(shot, state);
    renderGame(ctx, state);
    document.documentElement.dataset.boot = 'ok';
  } catch (err) {
    document.documentElement.dataset.jserror = String((err && err.message) || err);
    console.error(err);
  }
} else {
  // The interactive game.
  let last = performance.now();
  let booted = false;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      stepGame(state, dt, input);
      renderGame(ctx, state);
      if (!booted) {
        document.documentElement.dataset.boot = 'ok';
        booted = true;
      }
    } catch (err) {
      document.documentElement.dataset.jserror = String((err && err.message) || err);
      console.error(err);
    }
    endInputStep(input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
