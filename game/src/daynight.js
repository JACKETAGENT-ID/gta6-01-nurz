// The clock: one game hour per minute of play, a sun that rises and sets, and
// headlights that come on when the city goes dark. Shots pin the hour they need.
export function createClock(hour) {
  return { hour: hour === undefined ? 10 : hour };
}

export function updateClock(clock, dt) {
  clock.hour += dt / 60;
  if (clock.hour >= 24) clock.hour -= 24;
}

// 1 at noon, 0 at midnight — drives the night overlay, lit windows and headlights.
export function dayFactor(clock) {
  const h = clock.hour;
  const s = Math.sin(((h - 6) / 12) * Math.PI);
  return Math.max(0, Math.min(1, s));
}

export function headlightsOn(clock) {
  return dayFactor(clock) < 0.35;
}

// Sky tint for the overlay: warm at dusk and dawn, deep blue at night.
export function skyTint(clock) {
  const f = dayFactor(clock);
  if (f > 0.85) return null;
  const h = clock.hour;
  const dusk = (h > 16 && h < 19) || (h > 5 && h < 7);
  if (dusk) return { color: '255,120,40', alpha: 0.10 * (1 - f) };
  return { color: '10,16,48', alpha: 0.52 * (1 - f) };
}

export function clockLabel(clock) {
  const h = Math.floor(clock.hour);
  const m = Math.floor((clock.hour - h) * 60);
  const hh = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? 'AM' : 'PM';
  return `${hh}:${m < 10 ? '0' : ''}${m} ${ap}`;
}
