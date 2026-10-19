/* StreetSound — procedural soundscape for Plotline. Native Web Audio, no files.
 * Each district has its own small band: a pad chord and an arpeggio whose timbre
 * gets richer as property value rises (honky square -> warm triangle -> harp ->
 * jazzy filtered saw -> shimmering pad). The casino adds bright bells when you are
 * near; footsteps, dice, passing GO and Chance events each have a sound.
 * start() from a user gesture, then update({...}) every frame.
 */
const TIER_SOUND = [
  { chord: [130.81, 155.56, 196.0, 233.08], type: 'square', cutoff: 900, arpGap: 0.42, scale: [0, 3, 5, 7, 10, 12, 15] },     // Rusty Row: bluesy
  { chord: [174.61, 220.0, 261.63, 329.63], type: 'triangle', cutoff: 1800, arpGap: 0.36, scale: [0, 2, 4, 7, 9, 12, 14] },  // Maple Terrace
  { chord: [116.54, 146.83, 174.61, 261.63], type: 'sine', cutoff: 3000, arpGap: 0.3, scale: [0, 4, 7, 11, 14, 16, 19] },    // Gilded Gardens: harp
  { chord: [155.56, 196.0, 233.08, 293.66], type: 'sawtooth', cutoff: 1400, arpGap: 0.33, scale: [0, 4, 7, 10, 14, 15, 17] }, // Brick & Glass: jazz
  { chord: [207.65, 261.63, 311.13, 466.16], type: 'sine', cutoff: 5000, arpGap: 0.24, scale: [0, 4, 7, 12, 14, 16, 19, 24] } // Pinnacle Heights
];

class StreetSound {
  constructor() {
    this.enabled = false; this.context = null; this.voices = 0; this.tier = -1;
    this.arpIn = 0; this.arpStep = 0; this.bellIn = 0;
    document.addEventListener('visibilitychange', () => this._sync());
  }
  async start() { this.enabled = true; if (!this.context) {this._build();} await this._sync(); }
  async toggle() { this.enabled = !this.enabled; if (this.enabled && !this.context) {this._build();} await this._sync(); }
  async _sync() {
    const ctx = this.context; if (!ctx) {return;}
    if (this.enabled && !document.hidden) { await ctx.resume(); this.master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4); }
    else { this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => { if (!this.enabled || document.hidden) {ctx.suspend();} }, 300); }
  }
  _build() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) {return;}
    const ctx = this.context = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) {d[i] = Math.random() * 2 - 1;}
    // Street hum and breeze.
    this.hum = this._noiseBed(260, 'lowpass', 0.035);
    this.air = this._noiseBed(2400, 'bandpass', 0.008);
    // District pad: four voices through one filter.
    this.padFilter = ctx.createBiquadFilter(); this.padFilter.type = 'lowpass'; this.padFilter.frequency.value = 1200;
    this.padGain = ctx.createGain(); this.padGain.gain.value = 0;
    this.padFilter.connect(this.padGain); this.padGain.connect(this.master);
    this.pad = [0, 1, 2, 3].map(() => { const o = ctx.createOscillator(); o.connect(this.padFilter); o.start(); return o; });
  }
  _noiseBed(freq, type, gain) {
    const ctx = this.context, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; s.loop = true; f.type = type; f.frequency.value = freq; g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(); return g;
  }
  _ok(n = 3) { return this.enabled && this.context && this.context.state === 'running' && this.voices + n <= 28; }
  _note(freq, when, dur, type, gain, cutoff = 4000, pan = 0) {
    const ctx = this.context, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff; p.pan.value = pan;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f); f.connect(g); g.connect(p); p.connect(this.master);
    this.voices += 4; o.onended = () => { this.voices -= 4; o.disconnect(); f.disconnect(); g.disconnect(); p.disconnect(); };
    o.start(when); o.stop(when + dur + 0.05);
  }
  _burst(when, dur, freq, gain, type = 'highpass') {
    const ctx = this.context, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    this.voices += 3; s.onended = () => { this.voices -= 3; s.disconnect(); f.disconnect(); g.disconnect(); };
    s.start(when, Math.random() * 2); s.stop(when + dur + 0.02);
  }
  update({ dt = 0, tier = 0, casino = 1, night = 0, moving = false } = {}) {
    if (!this.enabled || !this.context || this.context.state !== 'running') {return;}
    const ctx = this.context, now = ctx.currentTime, T = TIER_SOUND[tier];
    if (tier !== this.tier) {
      // New district: dip, retune and re-voice the pad.
      this.tier = tier;
      this.padGain.gain.setTargetAtTime(0, now, 0.15);
      setTimeout(() => {
        if (!this.context) {return;} const t = this.context.currentTime;
        this.pad.forEach((o, i) => { o.type = T.type; o.frequency.setTargetAtTime(T.chord[i], t, 0.2); });
        this.padFilter.frequency.setTargetAtTime(T.cutoff, t, 0.3);
        this.padGain.gain.setTargetAtTime(T.type === 'square' || T.type === 'sawtooth' ? 0.012 : 0.022, t, 0.8);
      }, 400);
    }
    this.hum.gain.setTargetAtTime(0.03 + (tier >= 3 ? 0.02 : 0), now, 1);
    // Arpeggio in the district's scale; slightly sparser when standing still.
    this.arpIn -= dt;
    if (this.arpIn <= 0 && this._ok(4)) {
      const s = T.scale, stepIdx = this.arpStep++ % (s.length * 2 - 2), idx = stepIdx < s.length ? stepIdx : s.length * 2 - 2 - stepIdx;
      const f = T.chord[0] * 2 * Math.pow(2, s[idx] / 12) * (night > 0.5 ? 0.5 : 1);
      const type = T.type === 'square' ? 'square' : T.type === 'sawtooth' ? 'triangle' : 'sine';
      this._note(f, now + 0.01, T.type === 'sine' ? 0.9 : 0.35, type, type === 'square' ? 0.012 : 0.03, T.cutoff, (Math.random() - 0.5) * 0.6);
      this.arpIn = T.arpGap * (moving ? 1 : 1.6);
    }
    // Casino bells, louder as you get closer (casino: 0 = at the door, 1 = far).
    if (casino < 1) {
      this.bellIn -= dt;
      if (this.bellIn <= 0 && this._ok(4)) {
        const bells = [1046.5, 1318.5, 1568, 2093];
        this._note(bells[Math.floor(Math.random() * 4)], now + 0.01, 0.35, 'triangle', 0.05 * (1 - casino), 6000, (Math.random() - 0.5));
        this.bellIn = 0.09 + casino * 0.3;
      }
    }
  }
  footstep(pace = 0.4) { if (!this._ok(3)) {return;} const t = this.context.currentTime; this._burst(t, 0.07, 1600 + pace * 900, 0.08 + pace * 0.05); this._burst(t, 0.09, 180, 0.06, 'lowpass'); }
  dice() { if (!this._ok(3)) {return;} const t = this.context.currentTime; for (let i = 0; i < 9; i++) {this._burst(t + i * 0.07 + Math.random() * 0.03, 0.04, 3000, 0.12 - i * 0.008);} }
  go() { if (!this._ok(12)) {return;} const t = this.context.currentTime; [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this._note(f, t + i * 0.09, 0.5, 'triangle', 0.07)); this._note(2093, t + 0.5, 0.8, 'sine', 0.05); }
  chance(kind) {
    if (!this._ok(12)) {return;} const t = this.context.currentTime;
    const seq = kind === 'boom' ? [392, 523.25, 659.25, 783.99, 1046.5] : kind === 'crash' ? [659.25, 554.37, 466.16, 392, 311.13] : [220, 261.63, 329.63, 392, 493.88];
    seq.forEach((f, i) => this._note(f, t + i * 0.11, 0.6, kind === 'crash' ? 'sawtooth' : 'triangle', 0.06, 2200));
  }
  // A building springing up: a soft thud and a quick rising pluck, higher in richer districts.
  rise(tier = 0, side = 0, ahead = 20) {
    if (!this._ok(8)) {return;} const t = this.context.currentTime + Math.random() * 0.03, near = 1 - Math.min(1, ahead / 60);
    this._burst(t, 0.18, 160 + tier * 30, 0.05 + near * 0.08, 'lowpass');
    const base = [110, 146.83, 196, 261.63, 329.63][tier], ctx = this.context, o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = tier < 2 ? 'triangle' : 'sine'; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * 2, t + 0.25);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025 + near * 0.04, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    p.pan.value = side * 0.6; o.connect(g); g.connect(p); p.connect(this.master);
    this.voices += 3; o.onended = () => { this.voices -= 3; o.disconnect(); g.disconnect(); p.disconnect(); };
    o.start(t); o.stop(t + 0.55);
  }
  // Money: a till chime up for pay, down for spending.
  cash(up = true) { if (!this._ok(8)) {return;} const t = this.context.currentTime; const seq = up ? [783.99, 1046.5, 1318.5] : [1318.5, 1046.5]; seq.forEach((f, i) => this._note(f, t + i * 0.08, 0.4, 'triangle', 0.07)); this._burst(t, 0.05, 5000, 0.06); }
  // Turning a corner: a soft swish across the stereo field.
  turn(dir = 1) { if (!this._ok(4)) {return;} const ctx = this.context, t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.6); p.pan.setValueAtTime(-dir * 0.7, t); p.pan.linearRampToValueAtTime(dir * 0.7, t + 0.8);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    s.connect(f); f.connect(g); g.connect(p); p.connect(this.master); this.voices += 4; s.onended = () => { this.voices -= 4; s.disconnect(); f.disconnect(); g.disconnect(); p.disconnect(); };
    s.start(t); s.stop(t + 0.95); }
  jail() { if (!this._ok(6)) {return;} const t = this.context.currentTime; this._note(98, t, 0.6, 'square', 0.04, 600); this._burst(t, 0.25, 900, 0.1, 'bandpass'); }
}
window.StreetSound = StreetSound;
