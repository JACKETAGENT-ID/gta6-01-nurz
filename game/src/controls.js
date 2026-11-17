// Keyboard and mouse: one shared input state the engine reads every step.
// Keys are tracked by code so layouts do not matter; the mouse aims the pistol.
export function createInput() {
  return {
    keys: {},
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    clicked: false,
    pressed: {},
  };
}

export function bindInput(input, canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!input.keys[e.code]) input.pressed[e.code] = true;
    input.keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    input.keys[e.code] = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.clicked = true;
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// True once for the step in which the key went down; call after the engine step.
export function endInputStep(input) {
  input.pressed = {};
  input.clicked = false;
}

export function keyDown(input, code) {
  return !!input.keys[code];
}

export function keyPressed(input, code) {
  return !!input.pressed[code];
}

// Steering and throttle from WASD or arrows, as -1..1 and -1..1.
export function driveInput(input) {
  const up = keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp');
  const down = keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown');
  const left = keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft');
  const right = keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight');
  return {
    throttle: (up ? 1 : 0) + (down ? -1 : 0),
    steer: (left ? -1 : 0) + (right ? 1 : 0),
  };
}

export function walkInput(input) {
  const up = keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp');
  const down = keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown');
  const left = keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft');
  const right = keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight');
  const run = keyDown(input, 'ShiftLeft') || keyDown(input, 'ShiftRight');
  return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0), run };
}
