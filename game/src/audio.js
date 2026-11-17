// audio.js — all sound is synthesised live with WebAudio: engine hum, police
// siren, gunshots, punches, pickups and mission jingles. No audio files exist.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenFlip = false;
    this.sirenTimer = 0;
  }

  // Call from a user gesture; safe to call repeatedly and safe headless.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.value = muted ? 0 : 0.45;
  }

  tone(freq, dur, type, vol, delay, slideTo) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || !this.master) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.value = vol || 0.25;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  shot() {
    this.noise(0.12, 0.3, 2200);
    this.tone(170, 0.09, 'square', 0.16, 0, 60);
  }

  punch() {
    this.tone(95, 0.11, 'sine', 0.32, 0, 45);
    this.noise(0.06, 0.15, 700);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.2);
    this.tone(880, 0.13, 'sine', 0.2, 0.09);
  }

  cash() {
    this.tone(988, 0.1, 'triangle', 0.22);
    this.tone(1319, 0.16, 'triangle', 0.22, 0.08);
  }

  jingle() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.22, i * 0.11));
  }

  crash() {
    this.noise(0.25, 0.32, 500);
    this.tone(70, 0.2, 'sine', 0.25, 0, 40);
  }

  busted() {
    [392, 311, 233].forEach((f, i) => this.tone(f, 0.22, 'sawtooth', 0.14, i * 0.18));
  }

  // Engine hum follows driving speed; call every frame.
  setEngine(driving, speedNorm) {
    if (!this.ctx || !this.master) return;
    if (!driving) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.value = 55 + speedNorm * 165;
    this.engineGain.gain.value = 0.045 + speedNorm * 0.05;
  }

  // Two-tone siren while any wanted level is active; call every frame.
  updateSiren(dt, wanted) {
    if (!this.ctx || wanted <= 0) return;
    this.sirenTimer -= dt;
    if (this.sirenTimer <= 0) {
      this.sirenFlip = !this.sirenFlip;
      this.sirenTimer = 0.42;
      this.tone(this.sirenFlip ? 715 : 950, 0.4, 'square', 0.045);
    }
  }
}
