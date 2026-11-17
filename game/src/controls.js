// Keyboard and mouse input for Neon Bay Nights v3.
// Keys are tracked in a live set; edge-triggered actions (E, F, R, V, T,
// P, M, mouse) land in `pressed` once per keydown and the engine clears it
// each frame. R means reload on foot and radio while driving; V always
// changes the radio station.

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyR', 'KeyV', 'KeyT', 'KeyP', 'KeyM',
]);

export function bindControls(state, canvas) {
  const input = state.input;

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
    state.audio.init();
  });
  window.addEventListener('keyup', (e) => { input.keys.delete(e.code); });
  window.addEventListener('blur', () => { input.keys.clear(); });

  const trackMouse = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - r.left;
    input.mouse.y = e.clientY - r.top;
  };
  canvas.addEventListener('mousemove', trackMouse);
  canvas.addEventListener('mousedown', (e) => {
    trackMouse(e);
    input.mouse.down = true;
    input.pressed.add('Mouse0');
    state.audio.init();
  });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
