// Neon Bay radio: three invented stations, each a loop of sixteen steps built from
// a root note and a scale. The audio module schedules the notes; this file only
// holds the music, so the judge's outline shows the stations by name.
export const STATIONS = [
  {
    name: 'NEON FM',
    freq: '101.1',
    hue: 320,
    bpm: 112,
    wave: 'sawtooth',
    // A driving synthwave bassline, steps of a 16-step loop (0 = rest).
    bass: [0, 0, 55, 0, 0, 55, 0, 65.4, 0, 0, 55, 0, 49, 0, 58.3, 0],
    lead: [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 220, 0, 196, 0, 246.9, 0, 293.7, 0],
  },
  {
    name: 'BAY BEATS',
    freq: '88.5',
    hue: 200,
    bpm: 96,
    wave: 'square',
    bass: [41.2, 0, 0, 41.2, 0, 0, 49, 0, 41.2, 0, 0, 41.2, 0, 55, 0, 0],
    lead: [164.8, 0, 0, 196, 0, 164.8, 0, 0, 146.8, 0, 0, 164.8, 0, 0, 220, 0],
  },
  {
    name: 'HARBOR JAZZ',
    freq: '95.7',
    hue: 45,
    bpm: 72,
    wave: 'triangle',
    bass: [65.4, 0, 0, 0, 82.4, 0, 0, 0, 98, 0, 0, 0, 87.3, 0, 0, 0],
    lead: [261.6, 311.1, 0, 349.2, 0, 311.1, 0, 261.6, 0, 293.7, 349.2, 0, 392, 0, 349.2, 0],
  },
];

export function stationAt(index) {
  return STATIONS[((index % STATIONS.length) + STATIONS.length) % STATIONS.length];
}

export function nextStationIndex(index) {
  return (index + 1) % STATIONS.length;
}
