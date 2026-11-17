// Rain over Neon Bay: fronts drift in and out on their own, wet roads cut grip,
// and a mission can lock the rain on. One number, 0 to 1, drives the visuals,
// the physics and the sound.
export function createWeather() {
  return {
    rain: 0,
    target: 0,
    timer: 6,
    locked: false,
    lockedValue: 0,
  };
}

export function updateWeather(w, dt, rng) {
  if (w.locked) {
    w.target = w.lockedValue;
  } else {
    w.timer -= dt;
    if (w.timer <= 0) {
      w.timer = rng.range(8, 16);
      // Rain is rarer than sun: a front rolls in about one time in three.
      w.target = rng.chance(0.33) ? rng.range(0.35, 1) : 0;
    }
  }
  const rate = w.target > w.rain ? 0.12 : 0.06;
  if (w.rain < w.target) w.rain = Math.min(w.target, w.rain + rate * dt);
  else if (w.rain > w.target) w.rain = Math.max(w.target, w.rain - rate * dt);
}

// Wet roads: grip falls by up to 12% in the heaviest rain.
export function gripFactor(w) {
  return 1 - 0.12 * w.rain;
}

export function lockRain(w, value) {
  w.locked = true;
  w.lockedValue = value;
  w.target = value;
}

export function unlockRain(w) {
  w.locked = false;
  w.timer = 4;
}

export function isRaining(w) {
  return w.rain > 0.25;
}
