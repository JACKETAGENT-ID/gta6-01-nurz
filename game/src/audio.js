// Every sound in Neon Bay is synthesized with WebAudio: engine hum, sirens,
// gunshots, rain patter and the three radio stations. Nothing is loaded from a
// file, and every call is safe when the audio context is suspended or missing
// (headless screenshots run with no sound at all).
import { stationAt } from './radio.js';

export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    rainSrc: null,
    rainGain: null,
    radioTimer: 0,
    radioStep: 0,
    nextNoteTime: 0,
    started: false,
  };
}

// Create the context on the first user gesture; screenshots never call this.
export function ensureAudio(a) {
  if (a.started) return true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(a.ctx.destination);
    // Engine: a sawtooth through a low-pass filter, pitch follows speed.
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 60;
    const engineFilter = a.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    a.engineOsc.connect(engineFilter);
    engineFilter.connect(a.engineGain);
    a.engineGain.connect(a.master);
    a.engineOsc.start();
    // Siren: a sine that wails up and down.
    a.sirenOsc = a.ctx.createOscillator();
    a.sirenOsc.type = 'sine';
    a.sirenOsc.frequency.value = 700;
    a.sirenGain = a.ctx.createGain();
    a.sirenGain.gain.value = 0;
    a.sirenOsc.connect(a.sirenGain);
    a.sirenGain.connect(a.master);
    a.sirenOsc.start();
    // Rain: looped filtered noise.
    const len = a.ctx.sampleRate;
    const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    a.rainSrc = a.ctx.createBufferSource();
    a.rainSrc.buffer = buf;
    a.rainSrc.loop = true;
    const rainFilter = a.ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 1200;
    a.rainGain = a.ctx.createGain();
    a.rainGain.gain.value = 0;
    a.rainSrc.connect(rainFilter);
    rainFilter.connect(a.rainGain);
    a.rainGain.connect(a.master);
    a.rainSrc.start();
    a.started = true;
    return true;
  } catch (err) {
    return false;
  }
}

function blip(a, freq, dur, type, vol, slideTo) {
  if (!a.started || !a.ctx || a.ctx.state !== 'running') return;
  try {
    const osc = a.ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, a.ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, a.ctx.currentTime + dur);
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, a.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + dur);
    osc.connect(g);
    g.connect(a.master);
    osc.start();
    osc.stop(a.ctx.currentTime + dur + 0.02);
  } catch (err) {
    /* sound is optional */
  }
}

export function playShot(a) {
  blip(a, 900, 0.09, 'square', 0.25, 120);
}

export function playPunch(a) {
  blip(a, 140, 0.12, 'sine', 0.3, 60);
}

export function playPickup(a) {
  blip(a, 660, 0.09, 'sine', 0.22);
  if (a.started && a.ctx) {
    setTimeout(() => blip(a, 990, 0.12, 'sine', 0.22), 70);
  }
}

export function playSting(a) {
  blip(a, 523, 0.16, 'triangle', 0.25);
  if (a.started && a.ctx) {
    setTimeout(() => blip(a, 784, 0.24, 'triangle', 0.25), 140);
  }
}

export function playClick(a) {
  blip(a, 440, 0.05, 'sine', 0.15);
}

export function playCrash(a) {
  blip(a, 90, 0.25, 'sawtooth', 0.3, 40);
}

// Per-frame sound: engine pitch, siren wail, rain level and radio scheduling.
export function updateAudio(a, state, dt) {
  if (!a.started || !a.ctx || a.ctx.state !== 'running') return;
  const t = a.ctx.currentTime;
  try {
    const speed = state.player.car ? Math.abs(state.player.car.speed) : 0;
    a.engineGain.gain.setTargetAtTime(state.player.car ? 0.05 + 0.05 * (speed / 600) : 0, t, 0.1);
    a.engineOsc.frequency.setTargetAtTime(50 + speed * 0.35, t, 0.1);
    const wanted = state.wanted || 0;
    a.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.045 : 0, t, 0.2);
    a.sirenOsc.frequency.setTargetAtTime(650 + 250 * Math.sin(t * 3.2), t, 0.05);
    a.rainGain.gain.setTargetAtTime(0.06 * state.weather.rain, t, 0.2);
    // Radio: schedule the station's 16-step loop a little ahead of time.
    if (state.player.car && state.radioOn) {
      const st = stationAt(state.radioStation);
      const stepDur = 60 / st.bpm / 4;
      if (a.nextNoteTime < t) a.nextNoteTime = t + 0.05;
      while (a.nextNoteTime < t + 0.15) {
        const step = a.radioStep % 16;
        const bass = st.bass[step];
        const lead = st.lead[step];
        if (bass) scheduleNote(a, bass, a.nextNoteTime, stepDur * 0.9, 'triangle', 0.16);
        if (lead) scheduleNote(a, lead, a.nextNoteTime, stepDur * 0.9, st.wave, 0.07);
        a.radioStep += 1;
        a.nextNoteTime += stepDur;
      }
    }
  } catch (err) {
    /* sound is optional */
  }
}

function scheduleNote(a, freq, when, dur, type, vol) {
  try {
    const osc = a.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(g);
    g.connect(a.master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  } catch (err) {
    /* sound is optional */
  }
}
