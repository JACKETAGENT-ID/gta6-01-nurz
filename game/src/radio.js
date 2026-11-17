// Radio for Neon Bay Nights v3: three synthesised stations.
// Each station is a bassline plus a lead line plus a tempo, all played by
// the WebAudio synth in audio.js — no audio files, no network. R (in a car)
// or V switches station; the HUD shows what is playing.

export const STATIONS = [
  {
    name: 'NEON FM', freq: '101.1', wave: 'triangle', tempo: 0.21,
    bass: [55, 0, 55, 65.4, 55, 0, 82.4, 73.4],
    lead: [220, 262, 330, 392, 330, 262, 220, 0],
    hat: true,
  },
  {
    name: 'BAY BEATS', freq: '88.5', wave: 'square', tempo: 0.17,
    bass: [49, 49, 0, 58.3, 49, 0, 65.4, 73.4],
    lead: [196, 0, 233, 294, 233, 196, 0, 175],
    hat: true,
  },
  {
    name: 'HARBOR JAZZ', freq: '95.7', wave: 'sine', tempo: 0.3,
    bass: [41.2, 0, 49, 0, 55, 0, 49, 43],
    lead: [174, 208, 262, 311, 262, 208, 174, 0],
    hat: false,
  },
];

export function stationCount() { return STATIONS.length; }

export function nextStation(state) {
  const next = ((state.radioStation || 0) + 1) % STATIONS.length;
  state.radioStation = next;
  state.audio.setStation(next);
  const s = STATIONS[next];
  state.hudFlash = `Radio: ${s.name} ${s.freq}`;
  state.flashT = 2.5;
  state.audio.sfx('click');
  return s;
}

export function currentStation(state) {
  return STATIONS[(state.radioStation || 0) % STATIONS.length];
}
