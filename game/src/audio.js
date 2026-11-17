// Synthesised sound for Neon Bay Nights v3: WebAudio only, no audio files.
// Engine hum, two-tone sirens, gunshots, punches, pickups and three radio
// stations — NEON FM, BAY BEATS and HARBOR JAZZ — each with its own
// bassline, lead line and tempo. Rain adds a soft patter on the roof.
// Everything is a no-op until the first user gesture unlocks the
// AudioContext, and M mutes it.

import { STATIONS } from './radio.js';

export function createAudio() {
  const audio = {
    ctx: null, muted: false, engineOsc: null, engineGain: null,
    musicNext: 0, musicStep: 0, sirenOn: false,
    station: 0, rainNext: 0,

    init() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio.ctx = new AC();
        audio.engineOsc = audio.ctx.createOscillator();
        audio.engineOsc.type = 'sawtooth';
        audio.engineOsc.frequency.value = 50;
        audio.engineGain = audio.ctx.createGain();
        audio.engineGain.gain.value = 0;
        const filt = audio.ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 420;
        audio.engineOsc.connect(filt);
        filt.connect(audio.engineGain);
        audio.engineGain.connect(audio.ctx.destination);
        audio.engineOsc.start();
      } catch (e) { audio.ctx = null; }
    },

    setMuted(m) { audio.muted = m; if (audio.engineGain) audio.engineGain.gain.value = 0; },

    setStation(i) {
      audio.station = i % STATIONS.length;
      audio.musicStep = 0;
      audio.musicNext = 0;
    },

    tone(freq, dur, type, vol, slideTo) {
      if (!audio.ctx || audio.muted) return;
      try {
        const t = audio.ctx.currentTime;
        const o = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(vol || 0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(audio.ctx.destination);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* sound is decoration, never fatal */ }
    },

    noise(dur, vol, lowpass) {
      if (!audio.ctx || audio.muted) return;
      try {
        const t = audio.ctx.currentTime;
        const len = Math.floor(audio.ctx.sampleRate * dur);
        const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = audio.ctx.createBufferSource();
        src.buffer = buf;
        const g = audio.ctx.createGain();
        g.gain.value = vol || 0.2;
        if (lowpass) {
          const f = audio.ctx.createBiquadFilter();
          f.type = 'lowpass'; f.frequency.value = lowpass;
          src.connect(f); f.connect(g);
        } else { src.connect(g); }
        g.connect(audio.ctx.destination);
        src.start(t);
      } catch (e) { /* ignore */ }
    },

    sfx(name) {
      if (!audio.ctx || audio.muted) return;
      switch (name) {
        case 'click': audio.tone(700, 0.06, 'square', 0.08); break;
        case 'door': audio.noise(0.09, 0.14, 900); audio.tone(180, 0.08, 'triangle', 0.1); break;
        case 'steal': audio.tone(520, 0.09, 'square', 0.1); setTimeout(() => audio.tone(780, 0.12, 'square', 0.1), 90); break;
        case 'crash': audio.noise(0.22, 0.3, 500); break;
        case 'shot': audio.noise(0.12, 0.32, 2400); audio.tone(160, 0.1, 'sawtooth', 0.16, 60); break;
        case 'punch': audio.noise(0.1, 0.24, 700); break;
        case 'thud': audio.noise(0.14, 0.2, 400); break;
        case 'reload': audio.tone(300, 0.05, 'square', 0.09); setTimeout(() => audio.tone(420, 0.05, 'square', 0.09), 120); break;
        case 'pickup': audio.tone(880, 0.09, 'sine', 0.14); setTimeout(() => audio.tone(1318, 0.14, 'sine', 0.14), 90); break;
        case 'cash': [1046, 1318, 1568].forEach((f, i) => setTimeout(() => audio.tone(f, 0.12, 'sine', 0.13), i * 80)); break;
        case 'vault': audio.tone(110, 0.4, 'sawtooth', 0.16, 55); audio.noise(0.4, 0.2, 300); break;
        case 'mission': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => audio.tone(f, 0.16, 'triangle', 0.14), i * 110)); break;
        case 'siren': audio.tone(720, 0.5, 'sine', 0.07, 980); setTimeout(() => audio.tone(980, 0.5, 'sine', 0.07, 720), 500); break;
        case 'boom': audio.noise(0.7, 0.4, 300); audio.tone(90, 0.6, 'sine', 0.22, 35); break;
        case 'hurt': audio.tone(220, 0.16, 'sawtooth', 0.14, 110); break;
        case 'busted': [392, 330, 262].forEach((f, i) => setTimeout(() => audio.tone(f, 0.3, 'triangle', 0.14), i * 220)); break;
        case 'wasted': [330, 262, 196, 131].forEach((f, i) => setTimeout(() => audio.tone(f, 0.34, 'sawtooth', 0.12), i * 240)); break;
        case 'taxi': audio.tone(1046, 0.1, 'sine', 0.12); setTimeout(() => audio.tone(1046, 0.1, 'sine', 0.12), 160); break;
        default: break;
      }
    },

    engine(level, bike) {
      if (!audio.ctx || audio.muted || !audio.engineOsc) return;
      const base = bike ? 90 : 55;
      audio.engineOsc.frequency.value = base + level * (bike ? 220 : 130);
      audio.engineGain.gain.value = level > 0.02 ? 0.035 + level * 0.05 : 0;
    },

    engineOff() { if (audio.engineGain) audio.engineGain.gain.value = 0; },

    update(dt, playing, rain) {
      if (!audio.ctx || audio.muted) return;
      // Rain patter on the roof, louder the harder it falls.
      if (rain > 0.4 && playing) {
        audio.rainNext -= dt;
        if (audio.rainNext <= 0) {
          audio.rainNext = 0.34;
          audio.noise(0.18, 0.028 * rain, 3200);
        }
      }
      if (!playing) return;
      audio.musicNext -= dt;
      if (audio.musicNext > 0) return;
      const st = STATIONS[audio.station % STATIONS.length];
      audio.musicNext = st.tempo;
      const bass = st.bass[audio.musicStep % st.bass.length];
      if (bass) audio.tone(bass, st.tempo * 0.9, st.wave, 0.05);
      if (audio.musicStep % 4 === 0) {
        const lead = st.lead[(audio.musicStep / 4) % st.lead.length];
        if (lead) audio.tone(lead, st.tempo * 1.6, 'sine', 0.035);
      }
      if (st.hat && audio.musicStep % 2 === 0) audio.noise(0.03, 0.02, 6000);
      audio.musicStep += 1;
    },
  };
  return audio;
}
