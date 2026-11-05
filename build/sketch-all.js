// noprotect
// Plotline — We Build Our World: combined file for the p5.js Web Editor (works with p5.js 1.x and 2.x).
// Paste this whole file into sketch.js. It is street-sound.js, build/music.js, build/trees.js, build/dabforest.js, build/sketch.js and build/board.js in one.

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
  // A shop door opening: a small bell.
  door() { if (!this._ok(6)) {return;} const t = this.context.currentTime; this._note(1760, t, 0.6, 'sine', 0.05); this._note(2217.5, t + 0.07, 0.5, 'sine', 0.035); }
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

/* WalkSound — the Landlord's Walk soundscape: StreetSound's footsteps, street hum and effects,
 * with music that sounds like the money on the street you are walking down.
 *   The rich (Castle Hill, Mansion Row): strings and a harp, slow and lush, celesta, champagne glasses.
 *   The City: a house beat, kick on every beat, off-beat hi-hats, claps, a jumping synth bass.
 *   The suburbs (Leafy Suburbs): bright pop, plucked chords and a bouncing bass.
 *   The poor edge (Working Town, The Fringe): a slow, broken, out-of-tune piano, record crackle,
 *     no beat at all, and now and then a lonely whistle.
 * The style is set by the town you are in; on a turn the music changes at the next bar.
 * Native Web Audio, no files.
 */
// The band's volume, well above the street hum so it is clearly heard.
const MUSIC_VOL = 6;
const MUSIC_NAME = { rich: 'Strings & harp · the forest', city: 'House beat · the city', mid: 'Pop · the new town', poor: 'Old piano' };
const MIDI = n => 440 * Math.pow(2, (n - 69) / 12);
const STYLES = {
  // chords as MIDI notes, one bar each
  rich: { bpm: 72, swing: 0.5, chords: [[48, 55, 59, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 64], [43, 50, 55, 59, 62]], gain: 0.95 },
  city: { bpm: 122, swing: 0.5, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]], gain: 0.75 },
  mid: { bpm: 108, swing: 0.5, chords: [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]], gain: 0.8 },
  poor: { bpm: 60, swing: 0.5, chords: [[45, 52, 57, 60], [40, 47, 52, 55], [41, 48, 53, 57], [40, 47, 52, 56]], gain: 0.9 }
};

class WalkSound extends StreetSound {
  constructor() { super(); this.style = null; this.nextStyle = 'mid'; this.step = 0; this.nextAt = 0; this.mvoices = 0; this.wealth = 0.5; }
  _build() {
    super._build(); if (!this.context) { return; }
    // The old district pad is kept silent: the band below replaces it.
    this.padGain.disconnect();
    // Every family that moves out muffles the band a little, as if the street were emptying.
    this.muffle = this.context.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 16000; this.muffle.connect(this.master);
    this.music = this.context.createGain(); this.music.gain.value = 0; this.music.connect(this.muffle);
    this.styleGain = this.context.createGain(); this.styleGain.gain.value = 1; this.styleGain.connect(this.music);
    this.music.gain.setTargetAtTime(MUSIC_VOL, this.context.currentTime, 1);
    // Life inside the houses, heard through the walls: muffled while you walk, clear when you stop to listen.
    this.lifeFilter = this.context.createBiquadFilter(); this.lifeFilter.type = 'lowpass'; this.lifeFilter.frequency.value = 1100;
    this.lifeGain = this.context.createGain(); this.lifeGain.gain.value = 1; this.lifeFilter.connect(this.lifeGain); this.lifeGain.connect(this.master);
    this.listenK = 0;
    // The forest before the street: wind in the leaves (birds are added in update).
    this.wind = this._noiseBed(700, 'bandpass', 0); this.leaves = this._noiseBed(3500, 'highpass', 0); this.devK = this.devK || 0; this.devSmooth = 0;
  }
  // One sound of somebody's home: kids, a dog, a piano, the TV... Returns how long it lasts.
  life(kind, gain, pan, memory) {
    if (!this.enabled || !this.context || this.context.state !== 'running' || this.mvoices > 36 || !this.lifeFilter) { return 0; }
    const ctx = this.context, t = ctx.currentTime + 0.02, out = ctx.createGain(), p = ctx.createStereoPanner(), made = [out, p];
    out.gain.value = gain; p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p);
    if (memory) {
      // A memory: far away, dark, with an echo.
      const f = ctx.createBiquadFilter(), d = ctx.createDelay(1), fb = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 650; d.delayTime.value = 0.27; fb.gain.value = 0.5;
      p.connect(f); f.connect(this.lifeGain); f.connect(d); d.connect(fb); fb.connect(d); d.connect(this.lifeGain); made.push(f, d, fb);
    } else { p.connect(this.lifeFilter); }
    const R = Math.random;
    const tone = (freq, when, dur, type, g, to) => {
      const o = ctx.createOscillator(), e = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = type; f.type = 'lowpass'; f.frequency.value = 2600;
      o.frequency.setValueAtTime(freq, when); if (to) { o.frequency.exponentialRampToValueAtTime(to, when + dur); }
      e.gain.setValueAtTime(0, when); e.gain.linearRampToValueAtTime(g, when + 0.012); e.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.connect(f); f.connect(e); e.connect(out); this.mvoices++; o.onended = () => { this.mvoices--; o.disconnect(); f.disconnect(); e.disconnect(); }; o.start(when); o.stop(when + dur + 0.03);
    };
    const hiss = (when, dur, freq, g, type = 'bandpass', q = 3) => {
      const s2 = ctx.createBufferSource(), f = ctx.createBiquadFilter(), e = ctx.createGain(); s2.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
      e.gain.setValueAtTime(0, when); e.gain.linearRampToValueAtTime(g, when + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      s2.connect(f); f.connect(e); e.connect(out); this.mvoices++; s2.onended = () => { this.mvoices--; s2.disconnect(); f.disconnect(); e.disconnect(); }; s2.start(when, R() * 2); s2.stop(when + dur + 0.03);
    };
    let len = 1;
    if (kind === 'kids') { const n = 3 + Math.floor(R() * 4); for (let i = 0; i < n; i++) { const f0 = 650 + R() * 600; tone(f0, t + i * 0.15, 0.13, 'sine', 0.07, f0 * (1.2 + R() * 0.4)); } hiss(t + 0.1, 0.3, 3000, 0.03); len = n * 0.15 + 0.3; }
    else if (kind === 'dog') { const n = 1 + Math.floor(R() * 3); for (let i = 0; i < n; i++) { tone(430, t + i * 0.3, 0.14, 'square', 0.035, 240); hiss(t + i * 0.3, 0.1, 850, 0.12); } len = n * 0.3; }
    else if (kind === 'piano') { const sc = [60, 62, 64, 67, 69, 72], n = 4 + Math.floor(R() * 3); let k = Math.floor(R() * 3); for (let i = 0; i < n; i++) { k = Math.max(0, Math.min(5, k + Math.floor(R() * 3) - 1)); tone(MIDI(sc[k]), t + i * 0.34, 0.9, 'triangle', 0.06); tone(MIDI(sc[k] + 12), t + i * 0.34, 0.4, 'sine', 0.015); } len = n * 0.34 + 0.6; }
    else if (kind === 'tv' || kind === 'talk') { const n = 6 + Math.floor(R() * 7), base = kind === 'tv' ? 160 : 120; for (let i = 0; i < n; i++) { const w = t + i * 0.14 + (i % 4 === 3 ? 0.12 : 0); hiss(w, 0.11, 500 + R() * 800, 0.09, 'bandpass', 6); tone(base + R() * 70, w, 0.11, 'sawtooth', 0.012); } if (kind === 'tv' && R() < 0.4) { for (let i = 0; i < 8; i++) { hiss(t + n * 0.15 + i * 0.05, 0.08, 1200 + R() * 900, 0.03, 'bandpass', 2); } } len = n * 0.16 + 0.4; }
    else if (kind === 'baby') { for (let i = 0; i < 2; i++) { tone(470 + R() * 40, t + i * 0.75, 0.6, 'sawtooth', 0.018, 640); } len = 1.5; }
    else if (kind === 'cook') { hiss(t, 1.5, 5200, 0.035, 'highpass', 0.7); tone(2300 + R() * 400, t + 0.5, 0.3, 'sine', 0.035); tone(2900, t + 0.55, 0.2, 'sine', 0.02); len = 1.6; }
    else if (kind === 'radio') { const sc = [57, 60, 62, 64, 67]; for (let i = 0; i < 6; i++) { tone(MIDI(sc[Math.floor(R() * 5)]), t + i * 0.22, 0.2, 'square', 0.014); hiss(t + i * 0.22, 0.2, 2500, 0.008, 'highpass', 1); } len = 1.5; }
    setTimeout(() => { made.forEach(nd => { try { nd.disconnect(); } catch (e) { } }); }, (len + 3) * 1000);
    return len;
  }
  // Round 2: you carry a box, and the plates in it rattle with each step.
  footstep(pace = 0.4) {
    super.footstep(pace);
    if (typeof rules !== 'undefined' && rules === 2 && this._ok && this.context && this.context.state === 'running' && Math.random() < 0.7) { const t = this.context.currentTime + 0.03; this._m(2600 + Math.random() * 900, t, 0.09, 'sine', 0.02, 9000); if (Math.random() < 0.5) { this._m(3400 + Math.random() * 600, t + 0.05, 0.07, 'sine', 0.012, 9000); } }
  }
  // A tree comes down, loud: the axe bites, the wood cracks, branches crash, and the trunk thumps down.
  chop(side) {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const ctx = this.context, t = ctx.currentTime, p = ctx.createStereoPanner(), out = ctx.createGain(); p.pan.value = side * 0.7; out.gain.value = 1.6; p.connect(out); out.connect(this.master);
    const burst = (when, dur, freq, gain, type, q = 1) => { const s2 = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s2.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); s2.connect(f); f.connect(g); g.connect(p); s2.start(when, Math.random()); s2.stop(when + dur + 0.02); };
    const thump = (when, f0, gain, dur) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(f0 * 0.35, when + dur); g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); o.connect(g); g.connect(p); o.start(when); o.stop(when + dur + 0.02); };
    // The axe: a hard, bright chop with a woody knock.
    burst(t, 0.06, 3200, 0.9, 'highpass'); burst(t, 0.12, 900, 0.7, 'bandpass', 3); thump(t, 220, 0.6, 0.12);
    // The wood splitting: a run of cracks.
    for (let i = 0; i < 6; i++) { burst(t + 0.12 + i * 0.045 + Math.random() * 0.02, 0.04, 1500 + Math.random() * 2500, 0.45, 'bandpass', 4); }
    // The creak as it leans over.
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 6; o.frequency.setValueAtTime(160, t + 0.35); o.frequency.exponentialRampToValueAtTime(60, t + 1.0); g.gain.setValueAtTime(0.0001, t + 0.35); g.gain.linearRampToValueAtTime(0.25, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05); o.connect(f); f.connect(g); g.connect(p); o.start(t + 0.35); o.stop(t + 1.1);
    // The crash of branches and the trunk hitting the ground.
    burst(t + 0.95, 1.3, 1800, 0.6, 'lowpass'); burst(t + 0.95, 0.5, 5000, 0.25, 'highpass'); thump(t + 1.0, 95, 1.0, 0.6); thump(t + 1.12, 70, 0.6, 0.5);
  }
  // Building up, floor by floor: a heavy "dun" for every floor, a little higher each time.
  floorUp(i, n, side = 0) {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const ctx = this.context, t = ctx.currentTime, p = ctx.createStereoPanner(), out = ctx.createGain(); p.pan.value = side * 0.5; out.gain.value = 1.3; p.connect(out); out.connect(this.master);
    const f0 = 70 + i / n * 90, o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(f0 * 1.8, t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.12); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35); o.connect(g); g.connect(p); o.start(t); o.stop(t + 0.37);
    const s2 = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain(); s2.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 1800 + i / n * 1500; f.Q.value = 5; g2.gain.setValueAtTime(0.35, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); s2.connect(f); f.connect(g2); g2.connect(p); s2.start(t, Math.random()); s2.stop(t + 0.1);
  }
  // Finished: a big landing thump and a bright, hollow fanfare (a home) or a cold, glassy chord (a tower).
  built(tower) {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const ctx = this.context, t = ctx.currentTime, out = ctx.createGain(); out.gain.value = 1.2; out.connect(this.master);
    const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.62);
    const notes = tower ? [59, 62, 66, 71, 74] : [60, 64, 67, 72, 76];
    notes.forEach((n, i) => { const v = ctx.createOscillator(), vg = ctx.createGain(); v.type = tower ? 'sine' : 'triangle'; v.frequency.value = MIDI(n + 12); vg.gain.setValueAtTime(0.0001, t + 0.15 + i * 0.07); vg.gain.linearRampToValueAtTime(0.12, t + 0.17 + i * 0.07); vg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4 + i * 0.07); v.connect(vg); vg.connect(out); v.start(t + 0.15 + i * 0.07); v.stop(t + 1.5 + i * 0.07); });
  }
  // A phone notification: your application was turned down.
  ding() {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const t = this.context.currentTime, ctx = this.context;
    [[1320, 0], [990, 0.14]].forEach(([f, dt]) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + dt); g.gain.linearRampToValueAtTime(0.09, t + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.5); o.connect(g); g.connect(this.master); o.start(t + dt); o.stop(t + dt + 0.55); });
  }
  // One synth note through its own filter and pan, with an envelope.
  _m(freq, when, dur, type, gain, cutoff = 3000, pan = 0, attack = 0.01) {
    if (this.mvoices > 40) { return; }
    const ctx = this.context, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff; p.pan.value = pan;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + attack); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f); f.connect(g); g.connect(p); p.connect(this.styleGain);
    this.mvoices++; o.onended = () => { this.mvoices--; o.disconnect(); f.disconnect(); g.disconnect(); p.disconnect(); };
    o.start(when); o.stop(when + dur + 0.05);
    return o;
  }
  _hit(when, dur, freq, gain, type = 'highpass', q = 1) {
    if (this.mvoices > 40) { return; }
    const ctx = this.context, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(gain, when + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f); f.connect(g); g.connect(this.styleGain);
    this.mvoices++; s.onended = () => { this.mvoices--; s.disconnect(); f.disconnect(); g.disconnect(); };
    s.start(when, Math.random() * 2); s.stop(when + dur + 0.02);
  }
  _kick(when, gain) {
    const ctx = this.context, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.18);
    g.gain.setValueAtTime(gain, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    o.connect(g); g.connect(this.styleGain); this.mvoices++; o.onended = () => { this.mvoices--; o.disconnect(); g.disconnect(); };
    o.start(when); o.stop(when + 0.32);
  }
  update(opts = {}) {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const ctx = this.context, now = ctx.currentTime, tier = opts.tier || 0;
    // How rich is this street? The town counts most, then the block's district.
    const z = typeof zone === 'number' ? zone : 0;
    this.wealth = constrain((5 - z) / 5 * 0.8 + tier * 0.05, 0, 1);   // Castle Hill ~0.9, the suburbs ~0.37, the Fringe ~0
    // The music follows how built-up the street is: forest strings, then town pop, then the city's beat.
    const dv = this.devSmooth || 0; this.nextStyle = dv < 0.3 ? 'rich' : dv < 0.65 ? 'mid' : 'city';
    if (!this.style) { this.style = this.nextStyle; this.nextAt = now + 0.1; }
    const life = typeof streetLife === 'function' ? streetLife() : 1;
    const listen = this.listenK || 0;
    // Forest to city: the less built-up the street around you, the more wind and birds; the more
    // built-up, the more traffic hum and the louder the band.
    this.devSmooth += ((this.devK || 0) - this.devSmooth) * 0.03; const dev = this.devSmooth, wild = typeof ending !== 'undefined' && ending ? 0 : 1 - dev;   // at the end the birds stop for good
    if (this.wind) { this.wind.gain.setTargetAtTime(0.05 * wild, now, 0.8); this.leaves.gain.setTargetAtTime(0.012 * wild * (0.6 + 0.4 * Math.sin(now * 0.7)), now, 0.5); }
    this.hum.gain.setTargetAtTime((0.03 + (tier >= 3 ? 0.02 : 0)) * (0.15 + dev * 1.2), now, 1);
    if (Math.random() < 0.05 * wild * wild && this.mvoices < 30) {
      // A bird: two to five quick chirps, sliding up.
      const f0 = 2400 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 4), p = (Math.random() - 0.5) * 1.6, t0 = now + 0.02;
      for (let i = 0; i < n; i++) { const o = this.context.createOscillator(), g = this.context.createGain(), pn = this.context.createStereoPanner(); pn.pan.value = p; o.type = 'sine'; o.frequency.setValueAtTime(f0, t0 + i * 0.11); o.frequency.exponentialRampToValueAtTime(f0 * 1.35, t0 + i * 0.11 + 0.07); g.gain.setValueAtTime(0, t0 + i * 0.11); g.gain.linearRampToValueAtTime(0.025 * wild, t0 + i * 0.11 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.11 + 0.09); o.connect(g); g.connect(pn); pn.connect(this.master); o.start(t0 + i * 0.11); o.stop(t0 + i * 0.11 + 0.1); o.onended = () => { o.disconnect(); g.disconnect(); pn.disconnect(); }; }
    }
    this.muffle.frequency.setTargetAtTime(350 + life * life * 15000, now, 0.8);
    // Stop and listen: the band and the street fade back, the homes beside you come through the wall.
    this.music.gain.setTargetAtTime(MUSIC_VOL * (1 - 0.8 * listen) * (0.35 + 0.65 * dev), now, 0.4);
    if (this.lifeFilter) { this.lifeFilter.frequency.setTargetAtTime(1100 + listen * 4500, now, 0.4); this.lifeGain.gain.setTargetAtTime(1 + listen * 0.9, now, 0.4); }
    // The poor tape crackles all the time it plays.
    if (this.style === 'poor' && Math.random() < 0.8) { this._hit(now + Math.random() * 0.05, 0.012, 3000 + Math.random() * 4000, 0.02 + Math.random() * 0.03, 'bandpass', 4); }
    // Schedule the band a little ahead, an eighth note at a time.
    while (this.nextAt < now + 0.15) { this._play(this.nextAt); }
  }
  // A family leaves: the band stops for a moment, a door shuts, and a falling minor phrase.
  evict() {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const t = this.context.currentTime, g = this.styleGain.gain;
    g.cancelScheduledValues(t); g.setTargetAtTime(0, t, 0.05); g.setTargetAtTime(STYLES[this.style || 'mid'].gain, t + 2.6, 0.6);
    this._kick(t + 0.05, 0.35); this._hit(t + 0.05, 0.25, 400, 0.15, 'lowpass');
    [64, 60, 57, 52].forEach((n, i) => { this._m(MIDI(n), t + 0.4 + i * 0.42, 1.4, 'triangle', 0.05, 1600); this._m(MIDI(n) * 1.006, t + 0.4 + i * 0.42, 1.4, 'triangle', 0.025, 1200); });
  }
  // A plastic piece lands on the board: a hollow click and a little rattle, straight to the speakers
  // (the band may be silent just then).
  clack(kind) {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const ctx = this.context, t = ctx.currentTime, out = this.master || ctx.destination, lo = kind === 'grey' ? 0.7 : kind === 'hotel' ? 0.85 : 1;
    [0, 0.07, 0.11].forEach((dt, i) => {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), gain = [0.22, 0.08, 0.04][i];
      s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 2400 * lo; f.Q.value = 4;
      g.gain.setValueAtTime(gain, t + dt); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.05);
      s.connect(f); f.connect(g); g.connect(out); s.start(t + dt, Math.random()); s.stop(t + dt + 0.07);
    });
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(900 * lo, t); o.frequency.exponentialRampToValueAtTime(320 * lo, t + 0.08);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.14);
  }
  // New neighbours arrive (Rule 2): a rising major phrase and a ring of a bike bell.
  welcome() {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const t = this.context.currentTime;
    [60, 64, 67, 72, 76].forEach((n, i) => this._m(MIDI(n + 12), t + 0.1 + i * 0.12, 0.9, 'triangle', 0.04, 5000, -0.4 + i * 0.2));
    this._m(2637, t + 0.8, 0.6, 'sine', 0.02, 9000); this._m(2637, t + 1.0, 0.6, 'sine', 0.02, 9000);
  }
  _play(t) {
    const S = STYLES[this.style], eighth = 60 / S.bpm / 2, step = this.step % 32, bar = Math.floor(step / 8), beat8 = step % 8;
    // Swing: the off-beat eighths land late.
    const len = beat8 % 2 === 0 ? eighth * 2 * S.swing : eighth * 2 * (1 - S.swing);
    const chord = S.chords[bar], pan = () => (Math.random() - 0.5) * 0.6;
    if (this.style === 'rich') {
      // A string section and a harp: slow, lush, expensive. Long bowed chords that swell in each bar...
      const barLen = eighth * 8;
      if (beat8 === 0) { chord.forEach((n, i) => { this._m(MIDI(n + 12), t, barLen * 1.1, 'sawtooth', 0.007, 1500, -0.4 + i * 0.2, barLen * 0.35); this._m(MIDI(n + 12) * 1.004, t, barLen * 1.1, 'sawtooth', 0.006, 1300, 0.4 - i * 0.2, barLen * 0.35); }); this._m(MIDI(chord[0] - 12), t, barLen, 'sawtooth', 0.03, 420, 0, 0.15); }
      // ...a harp rippling up the chord on every eighth...
      this._m(MIDI(chord[(beat8 % chord.length)] + 24), t, 0.9, 'triangle', 0.024, 5200, -0.3 + beat8 * 0.08);
      // ...a celesta tune on top, and the clink of champagne glasses.
      if ((beat8 === 2 || beat8 === 6) && Math.random() < 0.7) { const top = [72, 74, 76, 79, 81, 84], f = MIDI(top[Math.floor(Math.random() * top.length)] + 12); this._m(f, t, 1.4, 'sine', 0.02, 9000); this._m(f * 2, t, 0.6, 'sine', 0.006, 9000); }
    } else if (this.style === 'city') {
      // The city: a house beat. Kick on every beat, open hi-hat on the off-beats, claps on 2 and 4...
      if (beat8 % 2 === 0) { this._kick(t, 0.2); }
      if (beat8 % 2 === 1) { this._hit(t, 0.09, 8000, 0.035); }
      this._hit(t, 0.03, 10000, 0.012);
      if (beat8 === 2 || beat8 === 6) { this._hit(t, 0.14, 1400, 0.06, 'bandpass', 1.4); this._hit(t + 0.012, 0.12, 1700, 0.04, 'bandpass', 1.4); }
      // ...an off-beat synth bass jumping octaves, and short synth stabs.
      if (beat8 % 2 === 1) { this._m(MIDI(chord[0] - 12 + (beat8 % 4 === 3 ? 12 : 0)), t, 0.2, 'sawtooth', 0.05, 800); }
      if (beat8 === 3 || beat8 === 7) { chord.forEach((n, i) => this._m(MIDI(n + 12), t, 0.16, 'sawtooth', 0.012, 2800, -0.3 + i * 0.2)); }
    } else if (this.style === 'mid') {
      // Plucked chord, broken over the bar.
      const n = chord[(beat8 + Math.floor(beat8 / 4)) % chord.length]; this._m(MIDI(n + 12), t, 0.35, 'triangle', 0.035, 3200, pan());
      if (beat8 === 0) { chord.forEach(c => this._m(MIDI(c + 12), t, 0.9, 'sine', 0.012, 2400)); }
      // Bouncing bass on the root and fifth.
      if (beat8 % 2 === 0) { this._m(MIDI(chord[0] - 12 + (beat8 === 4 ? 7 : 0)), t, 0.3, 'triangle', 0.08, 900); }
      this._hit(t, 0.04, 6500, 0.018);
      if (beat8 === 2 || beat8 === 6) { this._hit(t, 0.12, 1500, 0.03, 'bandpass', 1.2); }
      if (beat8 === 0 || beat8 === 5) { this._kick(t, 0.12); }
    } else {
      // An old, slightly out-of-tune piano: two detuned strings, wobbling like a worn tape.
      const wobble = 1 + Math.sin(t * 1.3) * 0.006 + (Math.random() - 0.5) * 0.004;
      if (beat8 === 0) { chord.forEach((n, i) => { const f = MIDI(n + 12) * wobble; this._m(f, t + i * 0.03, 2.4, 'triangle', 0.016, 1400, -0.2 + i * 0.12); this._m(f * 1.007, t + i * 0.03, 2.4, 'triangle', 0.01, 1200); }); }
      // A sparse, sad tune in A minor pentatonic.
      if ((beat8 === 3 || beat8 === 6) && Math.random() < 0.55) { const scale = [69, 72, 74, 76, 79, 81], f = MIDI(scale[Math.floor(Math.random() * scale.length)]) * wobble; this._m(f, t, 1.2, 'triangle', 0.03, 1800, pan()); this._m(f * 0.995, t, 1.2, 'triangle', 0.012, 1500); }
      if (beat8 === 0) { this._m(MIDI(chord[0] - 12) * wobble, t, 1.6, 'sine', 0.09, 400, 0, 0.02); }
      // No band, no beat: now and then a lonely whistled note, sliding flat.
      if (beat8 === 4 && Math.random() < 0.35) { const f = MIDI([76, 79, 81, 74][Math.floor(Math.random() * 4)]); const o = this._m(f, t, 1.6, 'sine', 0.02, 4000, pan(), 0.15); if (o) { o.frequency.setValueAtTime(f, t + 0.6); o.frequency.exponentialRampToValueAtTime(f * 0.94, t + 1.5); } }
    }
    this.nextAt += len; this.step++;
    // Change style at the end of a bar: dip the band, swap, and bring it back.
    if (this.step % 8 === 0 && this.nextStyle !== this.style) {
      const g = this.styleGain.gain, at = this.nextAt; g.setTargetAtTime(0, at - 0.25, 0.1); g.setTargetAtTime(STYLES[this.nextStyle].gain, at + 0.05, 0.3);
      this.style = this.nextStyle; this.step = 0;
    }
  }
}
window.WalkSound = WalkSound;

/* Painted trees. Each tree is grown once at start-up from a seed: a trunk that splits into
 * tapering branches (recursive), and hundreds of small leaf dabs clustered at the branch tips.
 * Leaves are shaded by where they sit in the crown: lit and yellow-green on the sun side (the
 * far end of the street), cool blue-green in the shade and underneath, with gaps where the sky
 * shows through. The result is kept as a sprite and drawn into the street with the same haze as
 * everything else, plus a soft shadow on the ground.
 */
let brushTrees = null;
const BT_W = 300, BT_H = 420;
function makeBrushTrees() {
  if (brushTrees) { return; }
  brushTrees = [];
  const kinds = [
    { leaf: ['#3f6b3a', '#5b8a45', '#86b25a', '#b9d47a'], spread: 0.95, crown: 0.55 },   // plane tree
    { leaf: ['#355f3e', '#4f7d4c', '#76a462', '#a9cc86'], spread: 0.8, crown: 0.6 },     // gum
    { leaf: ['#4a6b2f', '#6f9440', '#9fbf55', '#d2df86'], spread: 1.05, crown: 0.5 },    // spring green
    { leaf: ['#7a3f55', '#b85f7c', '#e08aa4', '#f6c3d2'], spread: 0.9, crown: 0.55 },    // jacaranda / blossom
    { leaf: ['#3a5f45', '#557f58', '#7fa874', '#b4d0a0'], spread: 0.75, crown: 0.62 },
    { leaf: ['#4b6a33', '#6c8f46', '#94b65e', '#c6d98c'], spread: 1.0, crown: 0.52 }
  ];
  kinds.forEach((k, v) => {
    const big = document.createElement('canvas'); big.width = 900; big.height = 900;   // grow freely, then crop to the sprite
    const c = big.getContext('2d'), r = rngN(4242 + v * 977), tips = [];
    // Branches: recursive, tapering, slightly crooked.
    function branch(x, y, ang, len, w, depth) {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, mx = (x + x2) / 2 + (r() - 0.5) * len * 0.25, my = (y + y2) / 2 + (r() - 0.5) * len * 0.15;
      c.strokeStyle = depth < 2 ? '#4a3a30' : '#5a463a'; c.lineCap = 'round'; c.lineWidth = w;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, x2, y2); c.stroke();
      if (depth >= 2) { tips.push([x2, y2, depth]); }
      if (depth >= 5 || len < 10) { return; }
      const n = depth === 0 ? 3 : 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) { const a2 = ang + (i - (n - 1) / 2) * (0.42 + r() * 0.25) * k.spread + (r() - 0.5) * 0.3; branch(x2, y2, a2 + (-Math.PI / 2 - a2) * 0.18, len * (0.7 + r() * 0.12), w * 0.66, depth + 1); }
    }
    const baseX = 450, baseY = 880, trunk = 150 * (1 - k.crown);
    // Trunk with a lit edge.
    c.fillStyle = '#4a3a30'; c.beginPath(); c.moveTo(baseX - 9, baseY); c.quadraticCurveTo(baseX - 4, baseY - trunk * 0.6, baseX - 3, baseY - trunk); c.lineTo(baseX + 3, baseY - trunk); c.quadraticCurveTo(baseX + 5, baseY - trunk * 0.6, baseX + 10, baseY); c.fill();
    branch(baseX, baseY - trunk + 2, -Math.PI / 2 + (r() - 0.5) * 0.15, 80, 7, 0);
    // Crown bounds, for shading.
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of tips) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 30, ry = (y1 - y0) / 2 + 30;
    // Leaf dabs: back (dark) to front (lit), so the crown has depth.
    const dabs = [];
    for (const [tx, ty, dp] of tips) {
      const spreadR = dp <= 2 ? 52 : dp === 3 ? 40 : 30, n = dp <= 2 ? 30 : 20;
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.pow(r(), 0.55) * spreadR, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.85 + spreadR * 0.15;
        const nx = (x - cxm) / rx, ny = (y - cym) / ry, light = constrain(0.55 - ny * 0.45 - nx * 0.15 + (r() - 0.5) * 0.35, 0, 1);
        dabs.push({ x, y, light, rot: r() * Math.PI, s: 3 + r() * 4.5 });
      }
    }
    dabs.sort((a, b) => a.light - b.light);
    for (const d of dabs) {
      const idx = Math.min(3, Math.floor(d.light * 4)); c.fillStyle = k.leaf[idx]; c.globalAlpha = 0.75 + d.light * 0.25;
      c.beginPath(); c.ellipse(d.x, d.y, d.s, d.s * 0.62, d.rot, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    // Crop to the tree and fit it into the sprite, base at the bottom centre.
    const bx0 = Math.min(x0 - 70, baseX - 20), bx1 = Math.max(x1 + 70, baseX + 20), by0 = y0 - 60, sc = Math.min(BT_W / (bx1 - bx0), BT_H / (baseY + 4 - by0));
    const g = createGraphics(BT_W, BT_H); g.pixelDensity(1); g.clear();
    const dw = (bx1 - bx0) * sc, dh = (baseY + 4 - by0) * sc;
    g.drawingContext.drawImage(big, bx0, by0, bx1 - bx0, baseY + 4 - by0, BT_W / 2 - (baseX - bx0) * sc, BT_H - dh, dw, dh);
    brushTrees.push(g);
  });
}

/* The forest, painted in leaf dabs: every tree is grown once at start-up from a seed and painted
 * as hundreds of small, overlapping leaf dabs, lit and yellow-green on the sun side, cool and dark
 * in the shade and underneath, over branching, tapering branches. One style for every tree; the
 * kinds differ in shape, colour and height: round broadleaf trees (green, deep green, autumn),
 * narrow poplars, pale gums with leaves high up, dark pines in tiers, and low bushes.
 * The sprites are drawn into the street scaled with distance (drawBrushTree).
 */
let forestSprites = null;
const FW = 260, FH = 420;
const FOREST_TOP = { broad: 1, pine: 1, poplar: 1, gum: 1, bush: 1 };
function makeForest() {
  if (forestSprites) { return; }
  forestSprites = { broad: [], pine: [], poplar: [], gum: [], bush: [] };
  const PAL = {
    green: ['#3f6b3a', '#5b8a45', '#86b25a', '#b9d47a'], deep: ['#2c4f34', '#43704a', '#6a9a62', '#a0c48a'],
    autumn: ['#7a3a1e', '#b8592a', '#e08a3a', '#f4c36a'], gold: ['#6a5a1e', '#9a8a2a', '#c8b43e', '#ecdc7a'],
    poplar: ['#3f6230', '#64883e', '#94b450', '#cddf86'], gum: ['#4f5f3f', '#6f7f52', '#94a26a', '#c0c898'],
    pine: ['#1c3a2a', '#28503a', '#3d6a48', '#6a9466'], bush: ['#34583a', '#4f7a46', '#78a058', '#a8c87a']
  };
  const grow = (kind, seedN, pal, opt) => {
    const big = document.createElement('canvas'); big.width = 900; big.height = 900;
    const c = big.getContext('2d'), r = rngN(seedN), tips = [], dabs = [], baseX = 450, baseY = 880;
    let x0 = baseX - 20, x1 = baseX + 20, y0 = baseY - 40;
    const keep = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); };
    // Branches: recursive, tapering, slightly crooked.
    const branch = (x, y, ang, len, w, depth) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, mx = (x + x2) / 2 + (r() - 0.5) * len * 0.25, my = (y + y2) / 2 + (r() - 0.5) * len * 0.15;
      c.strokeStyle = opt.bark || (depth < 2 ? '#4a3a30' : '#5a463a'); c.lineCap = 'round'; c.lineWidth = w;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, x2, y2); c.stroke(); keep(x2, y2);
      if (depth >= (opt.leafFrom || 2)) { tips.push([x2, y2, depth]); }
      if (depth >= (opt.depth || 5) || len < 10) { return; }
      const n = depth === 0 ? 3 : 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) { const a2 = ang + (i - (n - 1) / 2) * (0.42 + r() * 0.25) * opt.spread + (r() - 0.5) * 0.3; branch(x2, y2, a2 + (-Math.PI / 2 - a2) * (opt.up || 0.18), len * (0.7 + r() * 0.12), w * 0.66, depth + 1); }
    };
    const trunk = (h, w, col, lean = 0) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(baseX - w, baseY); c.quadraticCurveTo(baseX - w * 0.4 + lean * 0.5, baseY - h * 0.6, baseX - w * 0.3 + lean, baseY - h); c.lineTo(baseX + w * 0.3 + lean, baseY - h); c.quadraticCurveTo(baseX + w * 0.5 + lean * 0.5, baseY - h * 0.6, baseX + w, baseY); c.fill(); keep(baseX + lean, baseY - h);
    };
    if (kind === 'pine') {
      // A straight trunk and needles in tiers: dabs fill a cone that narrows to the top, wider at the bottom of each tier.
      const H = opt.h, top = baseY - H; trunk(H * 0.9, 7, '#3a2a20');
      for (let i = 0; i < 1400; i++) {
        const v = Math.pow(r(), 0.8), y = top + v * (H - 70), tier = (v * 6) % 1, half = (16 + v * opt.w) * (0.55 + 0.45 * tier), x = baseX + (r() * 2 - 1) * half;
        const light = constrain(0.6 - (x - baseX) / (opt.w + 16) * 0.35 - tier * 0.25 + (r() - 0.5) * 0.35, 0, 1);
        dabs.push({ x, y, light, rot: (r() - 0.5) * 0.6, s: 2.5 + r() * 3, flat: 0.45 }); keep(x, y);
      }
    } else if (kind === 'bush') {
      // No trunk: a low dome of leaves with a few twigs.
      for (let i = 0; i < 6; i++) { c.strokeStyle = '#4a3a30'; c.lineWidth = 3; c.beginPath(); c.moveTo(baseX + (r() - 0.5) * 40, baseY); c.lineTo(baseX + (r() - 0.5) * 150, baseY - 40 - r() * 50); c.stroke(); }
      for (let i = 0; i < 900; i++) {
        const a = Math.PI + r() * Math.PI, d = Math.pow(r(), 0.5), x = baseX + Math.cos(a) * d * opt.w, y = baseY - 6 + Math.sin(a) * d * opt.h;
        const light = constrain(0.5 + (baseY - y) / opt.h * 0.4 - (x - baseX) / opt.w * 0.15 + (r() - 0.5) * 0.35, 0, 1);
        dabs.push({ x, y, light, rot: r() * Math.PI, s: 3 + r() * 4, flat: 0.62 }); keep(x, y);
      }
    } else {
      // Trees with branches: broadleaf, poplar and gum.
      const th = opt.trunk;
      trunk(th, opt.trunkW || 9, opt.bark || '#4a3a30', opt.lean || 0);
      branch(baseX + (opt.lean || 0), baseY - th + 2, -Math.PI / 2 + (r() - 0.5) * 0.15, opt.len || 80, opt.trunkW ? opt.trunkW * 0.8 : 7, 0);
      let cx0 = 1e9, cx1 = -1e9, cy0 = 1e9, cy1 = -1e9; for (const [x, y] of tips) { cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); cy0 = Math.min(cy0, y); cy1 = Math.max(cy1, y); }
      const cxm = (cx0 + cx1) / 2, cym = (cy0 + cy1) / 2, rx = (cx1 - cx0) / 2 + 30, ry = (cy1 - cy0) / 2 + 30;
      for (const [tx, ty, dp] of tips) {
        const spreadR = (dp <= 2 ? 52 : dp === 3 ? 40 : 30) * (opt.clump || 1), n = Math.round((dp <= 2 ? 30 : 20) * (opt.dense || 1));
        for (let i = 0; i < n; i++) {
          const a = r() * Math.PI * 2, d = Math.pow(r(), 0.55) * spreadR, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.85 + spreadR * 0.15;
          const nx = (x - cxm) / rx, ny = (y - cym) / ry, light = constrain(0.55 - ny * 0.45 - nx * 0.15 + (r() - 0.5) * 0.35, 0, 1);
          dabs.push({ x, y, light, rot: r() * Math.PI, s: 3 + r() * 4.5, flat: 0.62 }); keep(x, y);
        }
      }
    }
    // Paint the dabs from shade to light, so the crown has depth.
    dabs.sort((a, b) => a.light - b.light);
    for (const d of dabs) { c.fillStyle = pal[Math.min(3, Math.floor(d.light * 4))]; c.globalAlpha = 0.75 + d.light * 0.25; c.beginPath(); c.ellipse(d.x, d.y, d.s, d.s * d.flat, d.rot, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
    // Crop to the tree and fit it into the sprite, base at the bottom centre; remember how tall it came out.
    const bx0 = Math.min(x0 - 12, baseX - 20), bx1 = Math.max(x1 + 12, baseX + 20), by0 = y0 - 12, half = Math.max(baseX - bx0, bx1 - baseX), sc = Math.min(FW / (half * 2), FH / (baseY + 4 - by0));
    const g = createGraphics(FW, FH); g.pixelDensity(1); g.clear();
    const dh = (baseY + 4 - by0) * sc;
    g.drawingContext.drawImage(big, baseX - half, by0, half * 2, baseY + 4 - by0, FW / 2 - half * sc, FH - dh, half * 2 * sc, dh);
    g.top = dh / FH; forestSprites[kind].push(g);
  };
  try {
    // Round broadleaf trees in four colours.
    [['green', 1.0], ['deep', 0.9], ['autumn', 1.05], ['gold', 0.95]].forEach(([p, sp], v) => grow('broad', 7100 + v * 13, PAL[p], { spread: sp, trunk: 70 }));
    // Poplars: a short trunk, branches that all turn upwards, a tall narrow crown.
    [0, 1].forEach(v => grow('poplar', 7200 + v * 13, PAL.poplar, { spread: 0.32, up: 0.55, trunk: 30, len: 70, depth: 6, leafFrom: 1, clump: 0.85, dense: 1.3 }));
    // Gums: a tall pale trunk that leans, leaves only high up in loose clumps.
    [0, 1].forEach(v => grow('gum', 7300 + v * 13, PAL.gum, { spread: 1.25, trunk: 190, trunkW: 11, bark: v ? '#d8d0c0' : '#e6dfd2', lean: v ? -30 : 30, len: 70, depth: 4, leafFrom: 3, clump: 0.8, dense: 0.8 }));
    // Pines: dark tiers of needles.
    [0, 1].forEach(v => grow('pine', 7400 + v * 13, PAL.pine, { h: 420 + v * 60, w: 120 }));
    // Bushes: low and wide.
    [0, 1].forEach(v => grow('bush', 7500 + v * 13, PAL.bush, { w: 150 + v * 30, h: 110 }));
  } catch (e) { console.warn('forest failed, using the plain trees', e && e.stack); forestSprites = null; }
}
// Draw one painted tree at a ground point: its kind sets the shape, h its real height in metres.
function drawBrushTree(q, kind, tone, h, z) {
  const list = forestSprites && forestSprites[kind]; if (!list || !list.length) { return false; }
  const img = list[Math.floor(tone * 997) % list.length], hpx = h * q.k / (img.top || 1), wpx = hpx * FW / FH, fog = fogFor(z), y0 = q.y - hpx;
  ctx.save(); ctx.fillStyle = `rgba(40,30,20,${0.16 * (1 - fog)})`; ctx.beginPath(); ctx.ellipse(q.x, q.y + 0.15 * q.k, Math.min(wpx * 0.25, h * q.k * 0.4), 0.3 * q.k, 0, 0, TWO_PI); ctx.fill();
  ctx.drawImage(img.elt || img.canvas, q.x - wpx / 2, y0, wpx, hpx); ctx.restore();
  if (fog > 0.02) { ctx.save(); ctx.globalAlpha = fog * 0.85; ctx.drawImage(hazeSprite(img), q.x - wpx / 2, y0, wpx, hpx); ctx.restore(); }
  return true;
}

/* Plotline — We Build Our World: the street (camera, generation, buildings, forest, ground and sky).
 * A first-person, endless street in p5.js (Canvas 2D). Every lot starts as forest (drawForest); the
 * player cuts it down and raises the buildings (board.js). Every building, tree, person and sound is
 * generated in code.
 */
const EYE_H = 1.6, ROAD_W = 4.2, PAVE_W = 3.4, EDGE_X = ROAD_W + PAVE_W;   // building line at 7.6 m
const CHUNK_LEN = 48, CROSS_W = 10, LAP_LEN = 10, FAR_Z = 230;
const STROLL_SPD = 3, WALK_SPD = 4.5, RUN_SPD = 9, DASH_SPD = 11;   // metres per second
const TIER_OF = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
const BOARD_COL = { brown: '#8b5a2b', sky: '#a9d8f0', pink: '#d94f9a', orange: '#f28c28', red: '#e23b3b', yellow: '#f2d13a', green: '#1fa35b', navy: '#1f4fa8' };
const DISTRICTS = [
  { name: 'Rusty Row', tag: 'Rent: almost nothing', stripe: [BOARD_COL.brown, BOARD_COL.sky] },
  { name: 'Maple Terrace', tag: 'Rent: modest', stripe: [BOARD_COL.pink, BOARD_COL.orange] },
  { name: 'Gilded Gardens', tag: 'Rent: steep', stripe: [BOARD_COL.red, BOARD_COL.yellow] },
  { name: 'Brick & Glass Quarter', tag: 'Rent: eye-watering', stripe: [BOARD_COL.green, '#7fd1a0'] },
  { name: 'Pinnacle Heights', tag: 'Rent: if you have to ask…', stripe: [BOARD_COL.navy, '#6f93d8'] }
];
const SHOP_NAMES = [
  ['Bargain Bin', 'Rusty Nails', 'Patch & Mend', 'Penny Pantry', 'Junk & Co.', 'Second Chance', 'Odd Socks'],
  ['Corner Café', 'Maple Bakery', 'Paper Moon Books', 'Petal Florist', 'Teapot', 'Little Deli'],
  ['', '', '', '', ''],
  ['Gallery 9', 'Boutique Noir', 'Bistro Lumière', 'The Atelier', 'Velvet Lounge', 'Grand Hotel'],
  ['', '', '']
];

let seed = 2718, distanceWalked = 0, clockT = 0, paused = false, stepSpeed = 0, autoWalk = false, pointerHeld = false;
let stillT = 0, mouseMoveT = -9, lastMX = 0, lastMY = 0;
let stepPhase = 0, bobAmp = 0, lookYaw = 0, lookPitch = 0, canvasNode, sound, audioStarted = false, grain;
let dashTarget = null, card = null, districtCard = null, lastTier = -1, lastChunk = -1;
let economy = 1, economyTarget = 1, economyUntil = 0, night = 0, nightTarget = 0, crash = 0, crashTarget = 0;
const chunks = new Map(), firedCasinos = new Set(), visitedJails = new Set();
let cam = { x: 0, z: 0, yaw: 0, f: 700, cx: 0, hy: 0, eye: EYE_H }, ctx, skyline = [];
const APPEAR_Z = 36, RISE_T = 2.4;   // lots build when you come this close; rise time in seconds
let riseK = 1, mouseMoved = false;
// Held keys are tracked directly from the browser, so walking works the same in p5.js 1.x and 2.x.
const keysHeld = new Set();
window.addEventListener('keydown', e => keysHeld.add(e.code));
window.addEventListener('keyup', e => keysHeld.delete(e.code));
window.addEventListener('blur', () => keysHeld.clear());
function held(keyName) { return keysHeld.has(keyName); }
window.addEventListener('pointermove', () => { mouseMoved = true; });                   // vertical scale applied while a building is rising

function rngN(s) { let x = s | 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) | 0; return (x >>> 0) / 4294967296; }; }
function mixN(a, b, t) { return a + (b - a) * t; }
function easeN(a) { a = constrain(a, 0, 1); return a * a * (3 - 2 * a); }
function modN(a, n) { return ((a % n) + n) % n; }
function pickN(r, list) { return list[Math.floor(r() * list.length)]; }
function shadeN(hexCol, k) { const c = color(hexCol); return `rgb(${constrain(red(c) * k, 0, 255) | 0},${constrain(green(c) * k, 0, 255) | 0},${constrain(blue(c) * k, 0, 255) | 0})`; }
function mixHex(a, b, t) { const c = lerpColor(color(a), color(b), t); return `rgb(${red(c) | 0},${green(c) | 0},${blue(c) | 0})`; }
function rgbaN(hexCol, a) { const c = color(hexCol); return `rgba(${red(c) | 0},${green(c) | 0},${blue(c) | 0},${a})`; }

function setup() {
  const c = createCanvas(windowWidth, windowHeight); pixelDensity(min(1.5, window.devicePixelRatio || 1));
  canvasNode = c.elt; canvasNode.tabIndex = 0; ctx = drawingContext; setTimeout(() => canvasNode.focus({ preventScroll: true }), 100);
  canvasNode.setAttribute('aria-label', 'Plotline, a first-person board-game street. Hold W or the mouse to walk, Shift to hurry, E or Space to buy or build, Left or Right arrow to turn at a crossing, Enter to stroll, M for sound.');
  sound = new (window.WalkSound || StreetSound)(); textFont('Georgia');   // walk/music.js: music that sounds like the street's money
  grain = createGraphics(320, 320); grain.pixelDensity(1); grain.loadPixels();
  for (let i = 0; i < grain.pixels.length; i += 4) { const v = random() < 0.5 ? 255 : 0; grain.pixels[i] = grain.pixels[i + 1] = grain.pixels[i + 2] = v; grain.pixels[i + 3] = random(10); }
  grain.updatePixels(); buildSkyline();
  if (typeof makeBrushTrees === 'function') { makeBrushTrees(); }
  if (typeof makeForest === 'function') { makeForest(); }
}
function buildSkyline() {
  const r = rngN(seed + 99); skyline = [];
  for (let i = 0; i < 46; i++) { const a = (r() - 0.5) * 1.5; skyline.push({ a, w: mixN(0.012, 0.04, r()), h: mixN(0.05, 0.2, r()) * (1 - Math.abs(a) * 0.6), spire: r() < 0.3, tone: r() }); }
  skyline.sort((p, q) => q.h - p.h);
}

/* ---------- Camera ---------- */
function P(x, y, z) {
  const dx = x - cam.x, dz = z - cam.z, c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
  const rz = dx * s + dz * c, rx = dx * c - dz * s;
  const ry = cam.eye - y * riseK;
  return { x: cam.cx + rx * cam.f / rz, y: cam.hy + ry * cam.f / rz, rz, k: cam.f / rz, rx, ry };
}
// Clip a polygon against the near plane in camera space before drawing, so shapes that
// reach behind you (cross streets while you look sideways) never flip across the screen.
const CLIP_Z = 0.25;
function clipNear(pts) {
  if (pts.every(p => p.rz >= CLIP_Z)) {return pts;}
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (a.rz >= CLIP_Z) {out.push(a);}
    if ((a.rz >= CLIP_Z) !== (b.rz >= CLIP_Z)) {
      const t = (CLIP_Z - a.rz) / (b.rz - a.rz), rx = a.rx + (b.rx - a.rx) * t, ry = a.ry + (b.ry - a.ry) * t;
      out.push({ x: cam.cx + rx * cam.f / CLIP_Z, y: cam.hy + ry * cam.f / CLIP_Z, rz: CLIP_Z, rx, ry, k: cam.f / CLIP_Z });
    }
  }
  return out;
}
function polyN(pts, fillCol, strokeCol, lw) {
  pts = clipNear(pts); if (pts.length < 3) {return;}
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) {ctx.lineTo(pts[i].x, pts[i].y);} ctx.closePath();
  if (fillCol) { ctx.fillStyle = fillCol; ctx.fill(); } if (strokeCol) { ctx.strokeStyle = strokeCol; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
// A rectangle lying in a vertical plane. a and b are its bottom corners (x, z); y0..y1 its height.
function wallQuad(ax, az, bx, bz, y0, y1) { return [P(ax, y0, az), P(bx, y0, bz), P(bx, y1, bz), P(ax, y1, az)]; }
const NEAR_Z = 0.45;
function clipZ(z) { return Math.max(z, cam.z + NEAR_Z); }

/* ---------- The board: chunks of street ---------- */
function chunkAt(c) {
  if (chunks.has(c)) {return chunks.get(c);}
  const lap = Math.floor(c / LAP_LEN), slot = modN(c, LAP_LEN), tier = chunkTier(slot), z0 = c * CHUNK_LEN;
  const r = rngN(seed + slot * 7919 + zone * 104729);
  const style = typeof chunkStyle === 'function' ? chunkStyle(slot) : null, sty = style ? STYLES_LOT[style] : null;
  const ch = { c, slot, tier, z0, lots: [], props: [], back: [], style, green: typeof TOWNS !== 'undefined' && TOWNS[zone] && TOWNS[zone].green };
  for (const side of [-1, 1]) {
    let z = z0 + CROSS_W + 0.5;
    const special = null;   // no casinos or jail: the walk is about rent, not luck
    let specialAt = special ? z0 + CROSS_W + 6 + r() * 6 : Infinity;
    while (z < z0 + CHUNK_LEN - 3) {
      if (z >= specialAt - 0.5) { const len = special === 'jail' ? 20 : 18; ch.lots.push(makeLot(special, tier, side, z, len, r)); z += len + 0.6; specialAt = Infinity; continue; }
      const len = sty ? mixN(sty.len[0], sty.len[1], r()) : lotLength(tier, r); if (z + len > z0 + CHUNK_LEN - 1) {break;}
      const L = makeLot(null, tier, side, z, len, r); if (sty) {styleLot(L, style, r);}
      ch.lots.push(L); z += len + (style === 'caravan' ? mixN(1, 2.5, r()) : style === 'bungalow' ? 1.6 : tier === 2 ? 2.5 : tier >= 3 ? 1.2 : r() < 0.3 ? 1 : 0.15);
    }
    // A taller back row seen through the cross streets.
    ch.back.push({ side, z0: z0 + CROSS_W - 2, z1: z0 + CHUNK_LEN, x: EDGE_X + 26, h: [9, 14, 20, 40, 80][tier] * mixN(0.8, 1.3, r()), color: pickN(r, ['#c99a7a', '#b78a8a', '#9fa8b8', '#c2b090']) });
  }
  // Street furniture.
  for (let z = z0 + CROSS_W + 2; z < z0 + CHUNK_LEN; z += 12) {for (const side of [-1, 1]) {ch.props.push({ kind: 'lamp', x: side * (ROAD_W + 0.55), z: z + (side > 0 ? 6 : 0), side, flick: r() });}}
  if (tier === 1 || tier === 2) {for (let z = z0 + CROSS_W + 5; z < z0 + CHUNK_LEN - 2; z += 9) {for (const side of [-1, 1]) {if (r() < 0.8) {ch.props.push({ kind: 'tree', x: side * (ROAD_W + 2.3), z: z + r() * 2, h: mixN(4, 6.5, r()), tone: r() });}}}}
  if (tier === 0) {for (let i = 0; i < 5; i++) { const side = r() < 0.5 ? -1 : 1; ch.props.push({ kind: 'bin', x: side * (EDGE_X - 0.6), z: z0 + CROSS_W + r() * (CHUNK_LEN - CROSS_W), tone: r() }); }}
  if (tier >= 3) {for (let z = z0 + CROSS_W + 4; z < z0 + CHUNK_LEN; z += 12) {for (const side of [-1, 1]) {ch.props.push({ kind: 'banner', x: side * (ROAD_W + 0.55), z: z + (side > 0 ? 6 : 0), color: pickN(r, DISTRICTS[tier].stripe) });}}}
  plotsForChunk(ch, r);
  rememberStreet(ch);
  chunks.set(c, ch); return ch;
}
function lotLength(tier, r) { return [mixN(5, 7.5, r()), mixN(6, 8.5, r()), mixN(14, 18, r()), mixN(10, 15, r()), mixN(16, 24, r())][tier]; }
function makeLot(special, tier, side, z, len, r) {
  const L = { special, tier, side, z0: z, z1: z + len, seed: Math.floor(r() * 1e9), setback: 0, econ: 1, econNow: 1 };
  const lap = Math.floor(z / (CHUNK_LEN * LAP_LEN));
  if (special === 'jail') {Object.assign(L, { H: 9, depth: 14, color: '#7a7c86', accent: '#f28c28' });}
  else if (special === 'casino') {Object.assign(L, { H: 11, depth: 14, color: '#7b2b6e', accent: '#ffcf3a' });}
  else if (tier === 0) {Object.assign(L, { H: mixN(3.4, 5.4, r()), depth: mixN(6, 9, r()), color: pickN(r, ['#7d8f8a', '#9b7b5a', '#8a6a4a', '#6f8399', '#a08060', '#7a6a5e', '#8f9a7a']), accent: pickN(r, ['#c9b48a', '#b3c4c0', '#c78f6a']), crooked: (r() - 0.5) * 0.5, name: pickN(r, SHOP_NAMES[0]), sign: r() < 0.75 });}
  else if (tier === 1) {Object.assign(L, { H: mixN(6.8, 9.2, r()), depth: mixN(8, 11, r()), color: pickN(r, ['#e8a0a8', '#f2c28a', '#a8d0c8', '#c8b8e0', '#f0d890', '#9cc0e0', '#e6b8a2']), accent: '#fbf6ee', awning: pickN(r, [BOARD_COL.pink, BOARD_COL.orange, '#3f8fd6', '#5fb36b']), name: pickN(r, SHOP_NAMES[1]), sign: r() < 0.6 });}
  else if (tier === 2) {Object.assign(L, { H: mixN(9, 12, r()), depth: mixN(12, 15, r()), setback: mixN(5, 7, r()), color: pickN(r, ['#f2ead8', '#e8dcc0', '#f0e4d0', '#efe2c4']), accent: '#5a6b7e', fountain: r() < 0.45 });}
  else if (tier === 3) {Object.assign(L, { H: mixN(15, 34, r()), depth: mixN(12, 16, r()), color: r() < 0.65 ? pickN(r, ['#a8483a', '#b85a40', '#8c3e34', '#9a5038']) : pickN(r, ['#5e8fa8', '#6aa0b8', '#4f7f98']), glass: false, name: pickN(r, SHOP_NAMES[3]), sign: r() < 0.7 });}
  else {Object.assign(L, { H: mixN(45, 120, r()), depth: mixN(16, 22, r()), color: pickN(r, ['#7fa8c8', '#8fb6d0', '#a7bcd0', '#6f98bc']), crown: r() < 0.7, spire: r() < 0.5 });}
  if (tier === 3) {L.glass = L.color.startsWith('#5') || L.color.startsWith('#6') || L.color.startsWith('#4');}
  return L;
}

/* ---------- Frame ---------- */
function draw() {
  const dt = Math.min(deltaTime / 1000, 0.05); if (!paused) {clockT += dt;}
  // Input.
  const focus = document.activeElement === canvasNode, back = held('KeyS') || held('ArrowDown');
  const fwd = held('KeyW') || held('ArrowUp') || pointerHeld, hurry = held('ShiftLeft') || held('ShiftRight');
  let target = 0;
  if (dashTarget !== null) { target = DASH_SPD; if (distanceWalked >= dashTarget - 2) {target = mixN(1.5, DASH_SPD, easeN((dashTarget - distanceWalked) / 6));} if (distanceWalked >= dashTarget) { dashTarget = null; target = 0; } }
  else if (turnAnim || nameBox || intro || ending) { target = 0; }
  else if (!paused && focus) { if (back) {target = -WALK_SPD * 0.7;} else if (fwd) {target = hurry ? RUN_SPD : WALK_SPD;} else if (autoWalk) {target = hurry ? RUN_SPD : STROLL_SPD;} }
  stepSpeed = paused ? 0 : lerp(stepSpeed, target, 1 - Math.exp(-dt * (dashTarget !== null ? 4 : 4.5)));
  distanceWalked = Math.max(0, distanceWalked + stepSpeed * dt);
  // Footsteps drive the head bob.
  const ratio = Math.min(1.5, Math.abs(stepSpeed) / WALK_SPD);
  if (!paused && Math.abs(stepSpeed) > 0.08) { const b = Math.floor(stepPhase); stepPhase += dt * (1.6 + Math.min(Math.abs(stepSpeed), 7) * 0.3); if (Math.floor(stepPhase) !== b && dashTarget === null) {sound.footstep(Math.abs(stepSpeed) / RUN_SPD);} }
  bobAmp = lerp(bobAmp, dashTarget !== null ? 0.4 : ratio, 1 - Math.exp(-dt * 4));
  const mx = mouseMoved ? mouseX / width - 0.5 : 0, my = mouseMoved ? mouseY / height - 0.5 : 0;
  // Stop walking and you can stop and look: the mouse turns your head much further, and if you
  // stand still beside a home for sale, you turn to face it.
  if (mouseX !== lastMX || mouseY !== lastMY) { lastMX = mouseX; lastMY = mouseY; mouseMoveT = clockT; }
  stillT = Math.abs(stepSpeed) < 0.15 && !turnAnim && !intro ? stillT + dt : 0;
  const lookRange = mixN(0.3, 1.2, easeN((stillT - 0.3) / 0.8));
  let yawAim = constrain(mx, -0.5, 0.5) * 2 * lookRange;
  const facing = stillT > 0.9 && clockT - mouseMoveT > 1.2 && typeof plotHere === 'function' ? plotHere(distanceWalked) : null;
  if (facing) { yawAim = facing.side * 0.85; }
  lookYaw = lerp(lookYaw, yawAim, facing ? 0.035 : 0.05);
  lookPitch = lerp(lookPitch, constrain(my, -0.5, 0.5) * 0.2, 0.05);
  updateTurn();
  const z = distanceWalked, swing = Math.sin(PI * stepPhase), dip = Math.abs(Math.sin(PI * stepPhase));
  cam.f = Math.max(height * 0.85, width * 0.55); cam.z = z; cam.x = swing * 0.05 * bobAmp; cam.yaw = lookYaw + turnYaw; cam.cx = width / 2;
  cam.eye = EYE_H + (0.045 * dip - 0.03) * bobAmp; cam.hy = height * 0.52 - lookPitch * cam.f + Math.cos(TWO_PI * stepPhase) * 0.005 * bobAmp * cam.f;

  // World state: chunks in view, district changes, landmarks, economy.
  const c0 = Math.floor((z - 6) / CHUNK_LEN), c1 = Math.floor((z + FAR_Z) / CHUNK_LEN);
  for (let c = c0; c <= c1; c++) {chunkAt(c);}
  for (const [c] of chunks) {if (c < c0 - 1 || c > c1 + 1) {chunks.delete(c);}}
  const here = chunkAt(Math.floor(z / CHUNK_LEN)), tier = here.tier;
  canvasNode.dataset.year=lifeAge;canvasNode.dataset.vacant=here.lots.filter(l=>l.vacant).length;
  if (here.c !== lastChunk) { if (here.slot % 5 === 0 && lastChunk >= 0 && here.c > lastChunk) { sound.go(); onPassGo(); } lastChunk = here.c; }
  if (tier !== lastTier) { districtCard = { tier, t: clockT, lap: Math.floor(here.c / LAP_LEN) + 1 }; lastTier = tier; }
  updateLandmarks(z); boardUpdate(z);
  if (economyUntil && clockT > economyUntil) { economyTarget = 1; nightTarget = baseNight; crashTarget = 0; economyUntil = 0; }
  economy = lerp(economy, economyTarget, 1 - Math.exp(-dt * 0.8)); night = lerp(night, nightTarget, 1 - Math.exp(-dt * 0.5)); crash = lerp(crash, crashTarget, 1 - Math.exp(-dt * 0.8));
  let casinoDist = 1; for (const ch of chunks.values()) {for (const L of ch.lots) {if (L.special === 'casino') {casinoDist = Math.min(casinoDist, constrain(Math.abs((L.z0 + L.z1) / 2 - z) / 45, 0, 1));}}}
  // How built-up is the street around you? 0 = all forest, 1 = all buildings.
  let builtN = 0, lotN = 0;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (Math.abs((L.z0 + L.z1) / 2 - z) < 60) { lotN++; builtN += Math.min(1, typeof lotRise === 'function' ? lotRise(L) : riseOf(L.born)); } } }
  sound.devK = lotN ? builtN / lotN : 0;
  sound.update({ dt: paused ? 0 : dt, tier, casino: casinoDist, night, moving: Math.abs(stepSpeed) > 0.1 });

  push(); translate(width / 2, height / 2); rotate(swing * 0.005 * bobAmp); translate(-width / 2, -height / 2);
  // Drawing is wrapped so one bad shape (say, mid-turn) can never freeze the sketch.
  try { drawSky(); drawSkyline(); drawGround(z); drawSideStreet(); drawWorld(z); if (typeof drawStreetLife === 'function') { drawStreetLife(); } } catch (err) { if (!window.plotlineWarned) { window.plotlineWarned = true; console.warn(err); } }
  pop();
  drawOverlays();
}

// How far a building has risen: 0 = still a plot, 1 = built (with a little overshoot).
function riseOf(born) {
  if (born === undefined) {return 0;}
  const x = constrain((clockT - born) / RISE_T, 0, 1), c1 = 1.5, c3 = c1 + 1;
  return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
function birthDelay(seedish, ahead) {
  // A little randomness, and at the very start the street builds outward from where you stand.
  return (modN(seedish, 50) / 100) + (clockT - streetT < 2 ? Math.max(0, ahead) / 30 : 0);
}
function updateLandmarks(z) {
  for (const ch of chunks.values()) {
    for (const b of ch.back) {if (b.born === undefined && b.z0 - z < APPEAR_Z + 10 && !(typeof waitsForHand === 'function' && ch.lots.some(L => L.side === b.side && L.born === undefined && waitsForHand(L)))) {b.born = clockT + 0.4 + birthDelay(ch.c * 13, b.z0 - z);}}
    for (const p of ch.props) {if (p.born === undefined && p.z - z < APPEAR_Z - 8 && !(typeof propWaits === 'function' && propWaits(ch, p))) {p.born = clockT + birthDelay(Math.floor(p.z * 7), p.z - z);}}
  }
  for (const ch of chunks.values()) {for (const L of ch.lots) {
    const mid = (L.z0 + L.z1) / 2;
    if (L.born === undefined && L.z0 - z < APPEAR_Z && !(typeof waitsForHand === 'function' && waitsForHand(L))) {L.born = clockT + birthDelay(L.seed, L.z0 - z);}
    if (L.born !== undefined && !L.thud && clockT >= L.born) { L.thud = true; if (L.z1 > z) {sound.rise(L.tier, L.side, Math.max(0, L.z0 - z));} }
    // Buildings far ahead follow the economy; once you are close they keep what they became.
    if (mid - z > 40) {L.econ = economy;}
    L.econNow = lerp(L.econNow, L.econ, 0.04);
    if (L.special === 'casino' && Math.abs(mid - z) < 7 && !firedCasinos.has(L.seed)) { firedCasinos.add(L.seed); drawChance(L.seed); }
    if (L.special === 'jail' && Math.abs(mid - z) < 8 && !visitedJails.has(L.seed)) { visitedJails.add(L.seed); sound.jail(); showCard('jail'); }
  }}
}
function drawChance(s) {
  const kinds = ['boom', 'crash', 'night'], kind = kinds[modN(s, 3)];
  if (kind === 'boom') { economyTarget = 1.55; crashTarget = 0; nightTarget = baseNight; }
  if (kind === 'crash') { economyTarget = 0.6; crashTarget = 1; nightTarget = baseNight; }
  if (kind === 'night') { economyTarget = 1; crashTarget = 0; nightTarget = 1; }
  economyUntil = clockT + 45; sound.chance(kind); showCard(kind); onChance(kind);
}
function showCard(kind) {
  const cardText = {
    boom: ['CHANCE', 'Market boom!', 'The street ahead grows taller.'],
    crash: ['CHANCE', 'Market crash!', 'The street ahead shrinks and fades.'],
    night: ['CHANCE', 'Night on the town', 'The lights come on early.'],
    jail: ['JAIL', 'Just visiting', 'Wave to the guard and keep walking.'],
    go: ['GO', 'Another year', 'Pay day. Rent day. Birthday.']
  }[kind];
  card = { kind, text: cardText, t: clockT };
}

/* ---------- Sky and skyline ---------- */
function skyColors() {
  const dayCols = ['#c9a46e', '#d9c194', '#e8dcbc', '#8a96a6'], dusk = ['#5a3a7a', '#c86a7a', '#ffb070', '#1d2a55'];
  return dayCols.map((c, i) => mixHex(mixHex(c, dusk[i], night * 0.85), '#9a9aa0', crash * 0.45));
}
function drawSky() {
  const [low, mid, glow, top] = skyColors(), hy = cam.hy;
  let g = ctx.createLinearGradient(0, -height * 0.2, 0, hy + 10);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(0.9, low); g.addColorStop(1, glow);
  ctx.fillStyle = g; ctx.fillRect(-80, -height * 0.3, width + 160, hy + height * 0.3 + 12);
  const sx = cam.cx - Math.tan(cam.yaw) * cam.f, sy = hy - height * 0.06;
  // Sun behind the landmark tower and soft volumetric rays.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, height * 0.55);
  sg.addColorStop(0, `rgba(255,240,200,${0.5 * (1 - night)})`); sg.addColorStop(0.25, `rgba(255,200,140,${0.16 * (1 - night)})`); sg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sg; ctx.fillRect(-80, -height * 0.3, width + 160, height * 1.3);
  for (let i = 0; i < 0; i++) {   // the stylised sun rays are off: a softer, more real sky
    const a = -Math.PI / 2 + (i - 4) * 0.28 + Math.sin(clockT * 0.05 + i) * 0.04, len = height * 1.4, w = 0.05 + (i % 3) * 0.02;
    const rg = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    rg.addColorStop(0, `rgba(255,220,150,${0.1 * (1 - night)})`); rg.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len); ctx.lineTo(sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len); ctx.fill();
  }
  ctx.restore();
  // Puffy clouds drifting.
  const r = rngN(seed + 5);
  for (let i = 0; i < 9; i++) {
    const cx = modN(r() * width * 1.6 + clockT * (4 + i) - cam.yaw * cam.f * 0.3, width * 1.6) - width * 0.3, cy = hy * mixN(0.08, 0.6, r()), s = mixN(40, 120, r()) * height / 800;
    // Wide, flat-bottomed cumulus: many overlapping soft puffs, brighter on top.
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1.9, 0.62);
    for (let k = 0; k < 11; k++) {
      const u = k / 10, px = (u - 0.5) * s * 1.6, py = -Math.sin(u * PI) * s * 0.45 + Math.sin(k * 2.3 + i) * s * 0.06, rad = s * (0.32 + Math.sin(u * PI) * 0.25);
      const cg = ctx.createRadialGradient(px, py - rad * 0.45, rad * 0.05, px, py, rad);
      cg.addColorStop(0, rgbaN(mixHex('#fff6e2', '#d8b0d0', night), 0.85)); cg.addColorStop(0.6, rgbaN(mixHex('#ffcf98', '#8a6a9a', night), 0.45)); cg.addColorStop(1, rgbaN('#ffb070', 0));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(px, py, rad, 0, TWO_PI); ctx.fill();
    }
    ctx.restore();
  }
  if (night > 0.3) { noStroke(); for (let i = 0; i < 80; i++) { fill(255, 250, 220, night * (100 + 80 * Math.sin(clockT * 2 + i))); circle(modN(r() * width * 1.4 - cam.yaw * cam.f * 0.2, width * 1.4) - width * 0.2, r() * hy * 0.7, r() * 1.8 + 0.5); } }
}
function drawSkyline() {
  // Distant city at the end of the street, always out of reach, with the landmark tower in the middle.
  const hy = cam.hy, H = height, haze = skyColors()[0];
  // Urban sprawl: the further out the town, the smaller and further away the city you work in.
  const ck = typeof zone === 'number' ? [1.15, 1.1, 1.3, 1, 0.55, 0.3][zone] : 1;
  for (const b of skyline) {
    const x = cam.cx + Math.tan(b.a * Math.min(1, ck + 0.2) - cam.yaw) * cam.f, w = b.w * H * ck, h = b.h * H * ck;
    const g = ctx.createLinearGradient(0, hy - h, 0, hy);
    g.addColorStop(0, mixHex(mixHex('#e8b27a', '#3a3060', night), haze, 0.3 + b.tone * 0.3)); g.addColorStop(1, mixHex('#f6c88a', '#2a2448', night));
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, hy - h, w, h + 2);
    if (b.spire) { ctx.beginPath(); ctx.moveTo(x - w * 0.2, hy - h); ctx.lineTo(x, hy - h - w * 1.2); ctx.lineTo(x + w * 0.2, hy - h); ctx.fill(); }
    ctx.fillStyle = `rgba(255,236,170,${0.25 + night * 0.5})`;
    for (let y = hy - h + 4; y < hy - 3; y += 5) {if ((y * 7 + b.a * 1000) % 3 < 1.2) {ctx.fillRect(x - w * 0.35, y, w * 0.7, 1);}}
  }
  // The landmark: a stepped art-deco tower with a glowing crown.
  const x = cam.cx - Math.tan(cam.yaw) * cam.f, s = H / 800 * 0.55 * ck;
  const tiers = [[60, 120], [46, 200], [34, 270], [22, 320], [12, 350]];
  ctx.save();
  for (const [w, h] of tiers) {
    const g = ctx.createLinearGradient(x - w * s, 0, x + w * s, 0);
    g.addColorStop(0, mixHex(mixHex('#c88a50', '#3a3366', night), haze, 0.45)); g.addColorStop(0.5, mixHex(mixHex('#f0dcb0', '#8a7ac8', night), haze, 0.45)); g.addColorStop(1, mixHex(mixHex('#b07a48', '#2e2a55', night), haze, 0.45));
    ctx.fillStyle = g; ctx.fillRect(x - w * s, hy - h * s, w * 2 * s, h * s - (tiers[0] === undefined ? 0 : 0) + 2);
  }
  ctx.fillStyle = mixHex('#fff4c8', '#c8b8ff', night); ctx.beginPath(); ctx.moveTo(x - 5 * s, hy - 350 * s); ctx.lineTo(x, hy - 440 * s); ctx.lineTo(x + 5 * s, hy - 350 * s); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(x, hy - 330 * s, 0, x, hy - 330 * s, 90 * s); cg.addColorStop(0, 'rgba(255,240,180,0.15)'); cg.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = cg; ctx.fillRect(x - 90 * s, hy - 420 * s, 180 * s, 180 * s);
  ctx.restore();
  // Golden haze over the horizon.
  const g = ctx.createLinearGradient(0, hy - H * 0.18, 0, hy + 4);
  g.addColorStop(0, rgbaN(haze, 0)); g.addColorStop(1, rgbaN(mixHex('#ffd79a', '#7a5a8a', night), 0.75));
  ctx.fillStyle = g; ctx.fillRect(-80, hy - H * 0.18, width + 160, H * 0.18 + 4);
}

/* ---------- Ground: road, pavements, crossings ---------- */
// side: drawing the side street you are turning into, which starts at its crossing (fromZ).
function drawGround(z, side) {
  const hy = cam.hy;
  if (!side) { ctx.fillStyle = mixHex('#b89a78', '#3a3448', night); ctx.fillRect(-80, hy, width + 160, height - hy + 80); }
  const steps = 90;
  for (let i = steps; i > 0; i--) {
    const d0 = NEAR_Z + Math.pow((i - 1) / steps, 2.2) * FAR_Z, d1 = NEAR_Z + Math.pow(i / steps, 2.2) * FAR_Z;
    const za = z + d0, zb = z + d1; if (side && za < side.fromZ) { continue; }
    const ch = chunkAt(Math.floor(za / CHUNK_LEN)), local = za - ch.z0, crossing = local < CROSS_W;
    const fog = easeN(d0 / FAR_Z), fogC = mixHex('#ffd79a', '#5a4a70', night);
    const f = (hex) => mixHex(mixHex(hex, '#2a2440', night * 0.55), fogC, fog * 0.8);
    // Road.
    polyN([P(-ROAD_W, 0, za), P(ROAD_W, 0, za), P(ROAD_W, 0, zb), P(-ROAD_W, 0, zb)], f(crossing ? '#5a5a62' : mixHex('#4a4a52', '#7a7a80', crash * 0.4)));
    for (const side of [-1, 1]) {
      if (crossing) {
        // Cross street running off to the sides.
        polyN([P(side * ROAD_W, 0, za), P(side * 90, 0, za), P(side * 90, 0, zb), P(side * ROAD_W, 0, zb)], f('#55555d'));
      } else {
        const tile = Math.floor(za / 1.6) % 2, stripe = DISTRICTS[ch.tier].stripe;
        polyN([P(side * ROAD_W, 0.12, za), P(side * EDGE_X, 0.12, za), P(side * EDGE_X, 0.12, zb), P(side * ROAD_W, 0.12, zb)], f(tile ? '#d6d0c4' : '#cdc6b8'));
        // Board-colour band along the kerb.
        polyN([P(side * ROAD_W, 0.13, za), P(side * (ROAD_W + 0.3), 0.13, za), P(side * (ROAD_W + 0.3), 0.13, zb), P(side * ROAD_W, 0.13, zb)], f('#b4ada2'));
        polyN([P(side * (ROAD_W + 0.3), 0.13, za), P(side * (ROAD_W + 0.42), 0.13, za), P(side * (ROAD_W + 0.42), 0.13, zb), P(side * (ROAD_W + 0.3), 0.13, zb)], f(mixHex(stripe[0], '#b4ada2', 0.35)));
        polyN([P(side * EDGE_X, 0.05, za), P(side * (EDGE_X + 40), 0.05, za), P(side * (EDGE_X + 40), 0.05, zb), P(side * EDGE_X, 0.05, zb)], f(ch.tier === 2 || ch.park || ch.green ? '#6f9a52' : ch.style === 'caravan' ? '#b8a27a' : '#a89478'));
      }
    }
    // Centre line and zebra crossings.
    if (!crossing && Math.floor(za / 3) % 2 === 0) {polyN([P(-0.08, 0.01, za), P(0.08, 0.01, za), P(0.08, 0.01, zb), P(-0.08, 0.01, zb)], f('#f4e6b0'));}
    if (local > 1 && local < 4) {for (let x = -ROAD_W + 0.3; x < ROAD_W; x += 0.9) {polyN([P(x, 0.01, za), P(x + 0.5, 0.01, za), P(x + 0.5, 0.01, zb), P(x, 0.01, zb)], f('#f2efe6'));}}
  }
  // Painted street names and the GO arrow.
  for (const ch of chunks.values()) {
    if (side && ch.z0 < side.fromZ) { continue; }
    continue;   // no painted street names: nothing here is a board game
    paintText(ch.park ? 'PARK' : ch.slot === 0 ? 'GO  ➜' : 'PLOTLINE', 0, ch.z0 + CROSS_W + 3, ch.slot === 0 ? 4.5 : 2.2, ch.slot === 0 ? '#e23b3b' : '#f4ead0');
  }
}
function paintText(label, x, zz, size, col, maxW) {
  const p = P(x, 0, zz); if (p.rz < 1.5 || p.rz > 120) {return;}
  const k = p.k, squash = cam.eye / p.rz;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, squash); ctx.font = `bold ${size * k * 0.5}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgbaN(col, 0.95 * (1 - easeN((p.rz - 60) / 60))); if (maxW) { ctx.fillText(label, 0, 0, maxW * k); } else { ctx.fillText(label, 0, 0); } ctx.restore();
}

/* ---------- Buildings and everything on the street ---------- */
function drawWorld(z, side) {
  const all = [...chunks.values()], minZ = side ? side.fromZ : -Infinity, minLot = side ? side.minLot : -Infinity;
  // Back row first, then buildings far to near, then pavement life far to near.
  const backs = all.flatMap(ch => ch.back).filter(b => b.z1 > z + NEAR_Z && b.z0 >= minLot).sort((a, b) => b.z0 - a.z0);
  for (const b of backs) {
    const g = riseOf(b.born) * (b.sinkK === undefined ? 1 : b.sinkK), fk = 1 - Math.min(1, riseOf(b.born) * 1.4);
    if (fk > 0.02 && b.sinkK === undefined) { drawForest({ seed: Math.floor(b.z0 * 13) + b.side, z0: b.z0, z1: b.z1, side: b.side, depth: 14, setback: 0, special: null }, fk * 1.0, b.x - EDGE_X - 4); }
    if (g > 0.01) { riseK = g; drawBack(b); riseK = 1; }
  }
  const lots = all.flatMap(ch => ch.lots).filter(L => L.z1 > z + NEAR_Z && L.z0 < z + FAR_Z && L.z0 >= minLot - (side && side.turning ? 30 : 0)).sort((a, b) => b.z0 - a.z0);
  for (const L of lots) {
    const rise = typeof lotRise === 'function' ? lotRise(L) : riseOf(L.born);
    const g = rise * (L.sinkK === undefined ? 1 : L.sinkK) * (L.piece ? pieceSink(L) : 1);
    if (L.piece) { drawBoardSquare(L); }
    // Before it is built, every lot is forest; as the building rises, the trees go down
    // (or, with your hands, they fall when you chop them and stumps are left).
    const cut = L.cutT !== undefined, forestK = L.piece ? 0 : cut ? 1 - Math.min(1, rise * 2) : 1 - Math.min(1, rise * 1.4), fall = cut ? easeN((clockT - L.cutT) / 0.7) : 0;
    if (g <= 0.01 && !L.piece) { drawPlot(L); drawForest(L, forestK, 0, fall, cut); if (L.forSale && !L.owned) {drawForSale(L);} continue; }
    if (forestK > 0.02) { drawForest(L, forestK, 0, fall, cut); }
    if (g > 0.01) { riseK = g; drawLot(L); riseK = 1; }
    if (L.piece) { drawToyPiece(L); }
    if (L.owned) { drawYours(L); } else if (L.forSale && g > 0.01) { drawForSale(L); }
    const age = L.born === undefined ? clockT - L.cutT : clockT - L.born; if (age < RISE_T + 0.8 && !L.piece && age === age) {drawDust(L, Math.min(age, RISE_T));}
  }
  const items = [];
  for (const ch of all) {
    for (const p of ch.props) { if (p.z < minZ) {continue;} if(p.kind === "person" && p.residentRank > ch.residentShare){continue;} const g = riseOf(p.born); if (g <= 0.01) {continue;} const q = P(p.x, 0, p.z); if (q.rz > 0.8 && q.rz < FAR_Z * 0.7) {items.push({ q, p, kind: p.kind, g });} }
    for (const L of ch.lots) {if (L.tier === 2 && !L.special) { const g = riseOf(L.born); if (g <= 0.01) {continue;} const q = P(L.side * (EDGE_X + 0.3), 0, (L.z0 + L.z1) / 2); if (q.rz > 0.8) {items.push({ q, p: L, kind: 'yard', g });} }}
  }
  items.sort((a, b) => b.q.rz - a.q.rz);
  for (const it of items) {
    // Props pop up from their base point; yards rise with their mansion.
    if (it.kind === 'yard') { riseK = it.g; drawYard(it.p); riseK = 1; continue; }
    ctx.save(); ctx.translate(it.q.x, it.q.y); ctx.scale(Math.min(1, 0.4 + it.g * 0.6), it.g); ctx.translate(-it.q.x, -it.q.y);
    if (it.kind === 'lamp') {drawLamp(it.q, it.p);} else if (it.kind === 'tree') {drawTree(it.q, it.p);} else if (it.kind === 'bin') {drawBin(it.q, it.p);}
    else if (it.kind === 'banner') {drawBanner(it.q, it.p);} else if (it.kind === 'person') {drawPerson(it.q, it.p);} else if (it.kind === 'openhome') {drawOpenHome(it.q, it.p);} else if (it.kind === 'flowers') {drawFlowers(it.q, it.p);} else if (it.kind === 'turnsign') {drawTurnSign(it.q, it.p);} else if (it.kind === 'junk') {drawJunk(it.q, it.p);}
    ctx.restore();
  }
  if (!side) {drawTargetMarker();}
}
// An unbuilt lot: its plot outlined on the ground in the district's board colour.
function drawPlot(L) {
  // Land nobody has built on yet: forest floor.
  const z0 = clipZ(L.z0); if (L.z1 <= z0) {return;}
  const xa = L.side * (EDGE_X + 0.2), xb = L.side * (EDGE_X + L.setback + L.depth + 2), mz = (z0 + L.z1) / 2;
  polyN([P(xa, 0.03, z0), P(xb, 0.03, z0), P(xb, 0.03, L.z1), P(xa, 0.03, L.z1)], toneN('#3f5a32', mz));
}
// One tree of the wild forest: painted broadleaf trees, dark pines, tall pale gums and low bushes.
function drawWildTree(q, t) {
  const k = q.k, h = t.h, z = t.z, fog = fogFor(z);
  if (typeof drawBrushTree === 'function' && drawBrushTree(q, t.kind === 'sprite' ? 'broad' : t.kind, t.tone, t.h, z)) { return; }
  if (t.kind === 'sprite' || t.kind === 'poplar') { drawTree(q, { h: t.h, tone: t.tone, z, x: t.x }); return; }
  ctx.save(); ctx.globalAlpha = 1 - fog * 0.6;
  if (t.kind === 'pine') {
    // A conifer: a dark trunk and four stacked tiers of needles, lit on one side.
    const greens = ['#24452e', '#2f5a36', '#1f3d2c', '#365e3a'], g = greens[Math.floor(t.tone * 4)];
    ctx.fillStyle = toneN('#4a3426', z); ctx.fillRect(q.x - 0.12 * k, q.y - h * 0.25 * k, 0.24 * k, h * 0.25 * k);
    for (let i = 0; i < 4; i++) {
      const yb = q.y - (h * 0.18 + i * h * 0.2) * k, wt = (1.6 - i * 0.32) * k * (h / 11), ht = h * 0.32 * k;
      ctx.fillStyle = toneN(g, z, 1 - i * 0.04); ctx.beginPath(); ctx.moveTo(q.x - wt, yb); ctx.lineTo(q.x, yb - ht); ctx.lineTo(q.x + wt, yb); ctx.closePath(); ctx.fill();
      ctx.fillStyle = toneN(g, z, 1.25); ctx.beginPath(); ctx.moveTo(q.x - wt * 0.2, yb); ctx.lineTo(q.x, yb - ht); ctx.lineTo(q.x - wt * 0.75, yb); ctx.closePath(); ctx.fill();
    }
  } else if (t.kind === 'gum') {
    // A gum tree: a tall, pale, leaning trunk and loose clumps of olive leaves high up.
    const lean = (t.tone - 0.5) * 0.35 * k * h / 10;
    ctx.strokeStyle = toneN(t.tone < 0.5 ? '#e8e0d0' : '#cfc4b0', z); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, 0.28 * k);
    ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.quadraticCurveTo(q.x + lean, q.y - h * 0.5 * k, q.x + lean * 1.6, q.y - h * 0.82 * k); ctx.stroke();
    ctx.lineWidth = Math.max(1, 0.12 * k); ctx.beginPath(); ctx.moveTo(q.x + lean * 0.9, q.y - h * 0.55 * k); ctx.lineTo(q.x + lean * 0.9 + 1.4 * k, q.y - h * 0.75 * k); ctx.moveTo(q.x + lean * 1.2, q.y - h * 0.65 * k); ctx.lineTo(q.x + lean - 1.3 * k, q.y - h * 0.85 * k); ctx.stroke();
    const leaf = ['#6f7f4a', '#7a8a56', '#5f7046'][Math.floor(t.tone * 3)], r = rngN(Math.floor(z * 31));
    for (let i = 0; i < 6; i++) { ctx.fillStyle = toneN(leaf, z, 0.85 + r() * 0.3); ctx.beginPath(); ctx.ellipse(q.x + lean * 1.4 + (r() - 0.5) * 3 * k, q.y - (h * 0.72 + r() * h * 0.28) * k, (0.8 + r() * 0.7) * k, (0.5 + r() * 0.4) * k, 0, 0, TWO_PI); ctx.fill(); }
  } else {
    // A bush: a few overlapping round shapes, low to the ground.
    const r = rngN(Math.floor(z * 17)), g = ['#3f6a3a', '#4a7a40', '#5a7a3a'][Math.floor(t.tone * 3)];
    for (let i = 0; i < 4; i++) { ctx.fillStyle = toneN(g, z, 0.85 + r() * 0.35); ctx.beginPath(); ctx.ellipse(q.x + (r() - 0.5) * h * 1.2 * k, q.y - h * (0.35 + r() * 0.3) * k, h * (0.45 + r() * 0.25) * k, h * (0.35 + r() * 0.2) * k, 0, 0, TWO_PI); ctx.fill(); }
  }
  ctx.restore();
}
// The forest that stood here before the street was built: a stand of trees on every lot,
// sinking into the ground as the building rises (k = how much forest is left, 1 to 0).
function drawForest(L, k, back = 0, fall = 0, cut = false) {
  if (k <= 0.02 || L.special) { return; }
  const r = rngN(L.seed + 77), len = L.z1 - L.z0, n = Math.max(2, Math.round(len / 2.4)), rows = 3, list = [];
  for (let row = rows - 1; row >= 0; row--) {
    for (let i = 0; i < n; i++) {
      const z = L.z0 + (i + 0.2 + r() * 0.6) * len / n, x = L.side * (EDGE_X + back + 1.4 + row * 4.5 + r() * 2);
      const kr = r(), kind = kr < 0.3 ? 'broad' : kr < 0.52 ? 'pine' : kr < 0.67 ? 'poplar' : kr < 0.84 ? 'gum' : 'bush';
      list.push({ x, z, kind, h: kind === 'bush' ? mixN(1.5, 3, r()) : kind === 'pine' ? mixN(8, 17, r()) : kind === 'poplar' ? mixN(10, 16, r()) : kind === 'gum' ? mixN(11, 19, r()) : mixN(6, 12, r()), tone: r() });
    }
  }
  list.sort((a, b) => b.z - a.z);
  for (const t of list) {
    if (t.z < cam.z + NEAR_Z + 1) { continue; }
    const q = P(t.x, 0, t.z); if (q.rz < 1.5 || q.rz > FAR_Z) { continue; }
    if (cut) {
      // Chopped: the tree falls away from the road and fades; a stump is left until the building comes.
      const gone = easeN((clockT - L.cutT - 0.7) / 0.5);
      if (k > 0.05) { ctx.fillStyle = toneN('#7a5a3a', t.z); ctx.fillRect(q.x - 0.25 * q.k, q.y - 0.5 * q.k * k, 0.5 * q.k, 0.5 * q.k * k); ctx.fillStyle = toneN('#d8c09a', t.z); ctx.beginPath(); ctx.ellipse(q.x, q.y - 0.5 * q.k * k, 0.25 * q.k, 0.08 * q.k, 0, 0, TWO_PI); ctx.fill(); }
      if (gone >= 1) { continue; }
      ctx.save(); ctx.globalAlpha = 1 - gone; ctx.translate(q.x, q.y); ctx.rotate(L.side * fall * 1.45); ctx.translate(-q.x, -q.y);
      drawWildTree(q, t); ctx.restore(); continue;
    }
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(Math.min(1, 0.5 + k * 0.5), k); ctx.translate(-q.x, -q.y);
    drawWildTree(q, t); ctx.restore();
  }
}
// Dust kicked up while a building rises.
function drawDust(L, age) {
  const a = 1 - constrain(age / (RISE_T + 0.8), 0, 1), x = L.side * (EDGE_X + L.setback), r = rngN(L.seed + 7);
  for (let i = 0; i < 10; i++) {
    const zz = mixN(L.z0, L.z1, r()); if (zz < cam.z + 1) {continue;}
    const p = P(x - L.side * (0.3 + r() * 1.2), 0.2 + age * 0.4 * r(), zz); if (p.rz < 6) {continue;}
    const rad = Math.min(height * 0.12, p.k * (0.4 + age * 0.9) * (0.6 + r() * 0.6));
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
    g.addColorStop(0, rgbaN(mixHex('#e8d4b0', '#8a7a9a', night), 0.45 * a)); g.addColorStop(1, rgbaN('#e8d4b0', 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TWO_PI); ctx.fill();
  }
}
function fogFor(zz) { return easeN((zz - cam.z - 40) / (FAR_Z - 40)) * 0.85; }
function toneN(hexCol, zz, k = 1) {
  let c = mixHex(shadeN(hexCol, k), '#8a8a90', crash * 0.5);
  c = mixHex(c, '#2a2a48', night * 0.5);
  return mixHex(c, mixHex('#ffd79a', '#5a4a70', night), fogFor(zz));
}
function drawBack(b) {
  const z0 = clipZ(b.z0), x = b.side * b.x;
  if (b.isGreen === undefined) { const c = color(b.color); b.isGreen = green(c) > red(c) + 15; }
  if (b.isGreen) { polyN(wallQuad(x, z0, x, b.z1, 0, b.h), toneN(b.color, (z0 + b.z1) / 2, 0.85)); }
  else {
    // The back row is several buildings of different heights and shades, each with its own windows.
    const r = rngN(Math.floor(b.z0 * 7) + b.side * 13); let za = b.z0;
    while (za < b.z1 - 0.5) {
      const zb = Math.min(b.z1, za + mixN(7, 13, r())), h = b.h * mixN(0.8, 1.15, r()), shade = mixN(0.72, 0.95, r()), wz = (za + zb) / 2;
      if (zb > z0) {
        const zs = Math.max(za, z0);
        polyN(wallQuad(x, zs, x, zb, 0, h), toneN(b.color, wz, shade));
        polyN(wallQuad(x - b.side * 0.1, zs, x - b.side * 0.1, zb, h - 0.4, h), toneN(b.color, wz, shade * 1.15));
        const nearP = P(x, 0, zs);
        if (nearP.rz > 1 && nearP.k * 1.2 > 5) {
          const rows = Math.min(12, Math.floor((h - 1.5) / 3)), cols = Math.max(1, Math.floor((zb - za) / 2.4));
          for (let j = 0; j < rows; j++) { for (let i = 0; i < cols; i++) {
            const wa = za + (zb - za) * (i + 0.3) / cols, wb = za + (zb - za) * (i + 0.7) / cols; if (wb < z0) { continue; }
            const lit = ((i * 7 + j * 13 + Math.floor(b.z0)) % 9) < 1 + night * 5;
            polyN(wallQuad(x - b.side * 0.05, Math.max(wa, z0), x - b.side * 0.05, wb, 1.5 + j * 3, 2.9 + j * 3), toneN(lit ? '#f0c878' : '#4a5260', wz, lit ? 1 : 0.9));
          } }
        }
      }
      za = zb;
    }
  }
  if (b.z0 > cam.z + NEAR_Z) {polyN(wallQuad(x, b.z0, x + b.side * 20, b.z0, 0, b.h), toneN(b.color, b.z0, 0.6));}
}
function drawLot(L) {
  // Your own home stays the real house it was; a YOUR HOME sign (drawYours) marks it.
  const H = L.H * (L.special ? 1 : L.econNow), x = L.side * (EDGE_X + L.setback), xo = L.side * (EDGE_X + L.setback + L.depth);
  const z0 = clipZ(L.z0), z1 = L.z1, mid = (z0 + z1) / 2;
  if (z1 <= z0) {return;}
  // Street facade: lit from the low sun at the far end of the street.
  const fq = wallQuad(x, z0, x, z1, 0, H);
  const g = ctx.createLinearGradient(fq[0].x, 0, fq[1].x, 0);
  g.addColorStop(0, toneN(L.color, z0, 0.78)); g.addColorStop(1, toneN(L.color, z1, 1.08));
  polyN(fq, g);
  // Near end, facing you: back-lit, so darker, with a warm rim on its top edge.
  if (L.z0 > cam.z + NEAR_Z) {
    const nq = wallQuad(x, L.z0, xo, L.z0, 0, H); polyN(nq, toneN(L.color, L.z0, 0.55));
    ctx.strokeStyle = rgbaN('#ffd9a0', 0.55 * (1 - night)); ctx.lineWidth = 1.2; ctx.beginPath(); segN(nq[3], nq[2]); ctx.stroke();
  }
  const near = P(x, 0, z0); if (near.rz > FAR_Z) {return;}
  if (L.special === 'jail') {return drawJail(L, x, z0, z1, H);}
  if (L.special === 'casino') {return drawCasino(L, x, z0, z1, H);}
  drawMaterial(L, x, z0, z1, H);
  if (L.style) { drawStyled(L, x, z0, z1, H); } else { [drawShack, drawTownhouse, drawMansion, drawBrick, drawTower][L.tier](L, x, z0, z1, H); }
  drawWeathering(L, x, z0, z1, H);
  // The artwork's slogan, painted on the wall.
  if (typeof paintSlogan === 'function') { paintSlogan(L, x, z0, H); }
  if(L.vacant){facadeSign(L,x,z0,L.z0+.2,L.z1-.2,1.2,2.3,"#eee4d0","#413c39","FORMERLY " + L.formerName,null);}
}
// Windows on the street facade: a grid in (along street, height) coordinates.
function facadeWindows(L, x, z0, z1, rows, cols, opt) {
  const len = L.z1 - L.z0, r = rngN(L.seed);
  for (let i = 0; i < cols; i++) {for (let j = 0; j < rows.length; j++) {
    const za = L.z0 + len * (i + opt.padU) / cols, zb = L.z0 + len * (i + 1 - opt.padU) / cols, [ya, yb] = rows[j];
    const lit = r() < (L.vacant ? 0 : opt.lit + night * 0.6);
    if (zb < z0) {continue;}
    const q = wallQuad(x, Math.max(za, z0), x, zb, ya, yb); if (Math.abs(q[2].y - q[1].y) < 1.2) {continue;}
    const glass = lit ? mixHex('#ffd98a', '#ffe9b0', r()) : opt.glass;
    if (opt.frame && ya > 0.3) { windowSill(L, x, z0, za, zb, ya, opt.frame); }
    polyN(q, glassFill(q, glass, lit, (za + zb) / 2), opt.frame ? toneN(opt.frame, za) : null, opt.frameW || 1);
    if (opt.frame) { windowBars(q, opt.frame, za); }
    if (opt.boarded && r() < opt.boarded) { ctx.strokeStyle = toneN('#7a5a3a', za); ctx.lineWidth = Math.min(5, Math.max(1, Math.abs(q[1].y - q[2].y) * 0.08)); ctx.beginPath(); segN(q[0], q[2]); segN(q[1], q[3]); ctx.stroke(); }
    if (opt.box && j > 0) {polyN(wallQuad(x - L.side * 0.15, Math.max(za, z0), x - L.side * 0.15, zb, ya - 0.35, ya), toneN(opt.box, za));}
  }}
}
// A sign mounted flat on the facade; text is placed with an affine map of the projected corners.
function facadeSign(L, x, z0, za, zb, ya, yb, bg, fg, text, glow, font) {
  if (zb < z0) {return;} za = Math.max(za, z0);
  const q = wallQuad(x - L.side * 0.1, za, x - L.side * 0.1, zb, ya, yb);
  if (q.some(p => p.rz < CLIP_Z) || Math.abs(q[1].x - q[0].x) < 6) {return;}
  polyN(q, bg, glow ? rgbaN(glow, 0.9) : 'rgba(40,24,16,0.6)', glow ? 2 : 1);
  const w = 100, h = 22; ctx.save();
  // Text always reads left to right: on the right-hand side the far end is on the left of the screen.
  const o = L.side < 0 ? q[3] : q[2], ex = L.side < 0 ? q[2] : q[3], ey = L.side < 0 ? q[0] : q[1];
  ctx.transform((ex.x - o.x) / w, (ex.y - o.y) / w, (ey.x - o.x) / h, (ey.y - o.y) / h, o.x, o.y);
  ctx.fillStyle = fg; ctx.font = font || 'bold 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 8; }
  ctx.fillText(text, w / 2, h / 2 + 1, w - 8); ctx.restore();
}
function drawShack(L, x, z0, z1, H) {
  const r = rngN(L.seed + 1), len = L.z1 - L.z0;
  // Patched boards and peeling paint.
  for (let i = 0; i < 6; i++) { const za = L.z0 + r() * len, zb = za + mixN(0.6, 1.6, r()), ya = r() * (H - 1); if (zb > z0) {polyN(wallQuad(x - L.side * 0.05, Math.max(za, z0), x - L.side * 0.05, zb, ya, ya + mixN(0.4, 1, r())), toneN(shadeN(L.color, r() < 0.5 ? 0.78 : 1.18), za));} }
  facadeWindows(L, x, z0, z1, [[1.2, 2.4]], Math.max(1, Math.round(len / 3)), { padU: 0.22, lit: 0.15, glass: '#3a4048', frame: '#5a4636', boarded: 0.35 });
  // Door.
  const dz = L.z0 + len * 0.15; if (dz + 0.9 > z0) {polyN(wallQuad(x - L.side * 0.04, Math.max(dz, z0), x - L.side * 0.04, dz + 0.9, 0, 2.1), toneN('#4a3626', dz));}
  // Crooked roof: an overhang band on the facade and a leaning gable on the near end.
  const tilt = L.crooked;
  polyN([P(x - L.side * 0.5, H - 0.1, z0), P(x - L.side * 0.5, H - 0.1 + tilt * 0.3, z1), P(x, H + 0.5 + tilt * 0.4, z1), P(x, H + 0.5, z0)], toneN(shadeN('#6a4a3a', 0.9), midN(z0, z1)));
  if (L.z0 > cam.z + NEAR_Z) { const xo = L.side * (EDGE_X + L.depth); polyN([P(x - L.side * 0.5, H, L.z0), P(xo + L.side * 0.4, H, L.z0), P((x + xo) / 2 + L.side * tilt, H + 2 + tilt, L.z0)], toneN('#5a3e30', L.z0, 0.8)); }
  if (L.sign) { const flick = Math.sin(clockT * 23 + L.seed) > -0.85 || night < 0.3; facadeSign(L, x, z0, L.z0 + len * 0.3, L.z0 + len * 0.9, H - 1.3, H - 0.3, toneN('#e8d8b0', L.z0), flick ? '#3a2a1a' : '#8a7a6a', L.name, null); }
}
function midN(a, b) { return (a + b) / 2; }
function drawTownhouse(L, x, z0, z1, H) {
  const len = L.z1 - L.z0, cols = Math.max(2, Math.round(len / 2.6)), floors = H > 8 ? 3 : 2, fh = (H - 0.8) / floors;
  const rows = []; for (let f = 1; f < floors; f++) {rows.push([f * fh + 0.5, f * fh + fh - 0.4]);}
  facadeWindows(L, x, z0, z1, rows, cols, { padU: 0.24, lit: 0.25, glass: '#4a5a6a', frame: '#fbf6ee', frameW: 1.5, box: '#5fa35b' });
  // Ground floor shop window, door and a striped awning sticking out over the pavement.
  facadeWindows(L, x, z0, z1, [[0.6, 2.3]], 2, { padU: 0.12, lit: 0.6, glass: '#5a6a72', frame: '#fbf6ee', frameW: 2 });
  const stripes = 8;
  for (let s = 0; s < stripes; s++) {
    const za = L.z0 + len * s / stripes, zb = L.z0 + len * (s + 1) / stripes; if (zb < z0) {continue;}
    polyN([P(x, 3.1, Math.max(za, z0)), P(x, 3.1, zb), P(x - L.side * 1.2, 2.5, zb), P(x - L.side * 1.2, 2.5, Math.max(za, z0))], toneN(s % 2 ? '#fbf6ee' : L.awning, za));
  }
  // Cornice.
  polyN(wallQuad(x - L.side * 0.2, z0, x - L.side * 0.2, z1, H - 0.5, H), toneN('#fbf6ee', midN(z0, z1)));
  if (L.sign) {facadeSign(L, x, z0, L.z0 + len * 0.2, L.z0 + len * 0.8, 3.3, 4.1, toneN('#2f4a5a', L.z0), '#fff6dc', L.name, null);}
}
function drawMansion(L, x, z0, z1, H) {
  const len = L.z1 - L.z0, cols = Math.max(4, Math.round(len / 2.4));
  facadeWindows(L, x, z0, z1, [[1, 3.4], [4.6, 7.2]], cols, { padU: 0.28, lit: 0.3, glass: '#4f6070', frame: '#fffaf0', frameW: 2 });
  // Columns at the entrance and a slate mansard roof.
  for (let i = 0; i < 4; i++) { const zc = L.z0 + len * (0.38 + i * 0.08); if (zc > z0) {polyN(wallQuad(x - L.side * 1.2, zc, x - L.side * 1.2, zc + 0.45, 0, 7.6), toneN('#fffaf0', zc, 1.05));} }
  const zp = Math.max(L.z0 + len * 0.36, z0), zq = L.z0 + len * 0.66;
  if (zq > z0) {polyN([P(x - L.side * 1.3, 7.6, zp), P(x - L.side * 1.3, 7.6, zq), P(x - L.side * 1.3, 9.2, (zp + zq) / 2)], toneN('#fffaf0', zp));}
  polyN([P(x, H, z0), P(x, H, z1), P(x + L.side * 1.4, H + 2.2, z1), P(x + L.side * 1.4, H + 2.2, z0)], toneN(L.accent, midN(z0, z1)));
}
function drawYard(L) {
  // Hedge and wrought-iron fence along the pavement, a fountain in some yards.
  const z0 = clipZ(L.z0), xh = L.side * (EDGE_X + 0.4); if (L.z1 < z0) {return;}
  polyN(wallQuad(xh, z0, xh, L.z1, 0, 1.0), toneN('#3f6f3a', midN(z0, L.z1)));
  polyN([P(xh, 1.0, z0), P(xh, 1.0, L.z1), P(xh + L.side * 0.6, 1.1, L.z1), P(xh + L.side * 0.6, 1.1, z0)], toneN('#5a8f4a', midN(z0, L.z1)));
  ctx.strokeStyle = toneN('#2a2a30', L.z0); ctx.lineWidth = 1;
  for (let zz = Math.ceil(z0 / 0.5) * 0.5; zz < L.z1; zz += 0.5) { if ((zz - L.z0) / (L.z1 - L.z0) > 0.42 && (zz - L.z0) / (L.z1 - L.z0) < 0.58) {continue;} const a = P(xh - L.side * 0.1, 1.0, zz), b = P(xh - L.side * 0.1, 1.7, zz); if (a.rz > 0.5) { ctx.beginPath(); segN(a, b); ctx.stroke(); } }
  if (L.fountain) {
    const fz = midN(L.z0, L.z1), fx = L.side * (EDGE_X + L.setback * 0.55), c = P(fx, 0, fz); if (c.rz < 1.5) {return;}
    const k = c.k; ctx.fillStyle = toneN('#e8e0d0', fz); ctx.beginPath(); ctx.ellipse(c.x, c.y - 0.3 * k, 1.4 * k, 1.4 * k * cam.eye / c.rz + 0.3 * k * 0.3, 0, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = toneN('#7fc0d8', fz); ctx.beginPath(); ctx.ellipse(c.x, c.y - 0.45 * k, 1.2 * k, 1.2 * k * cam.eye / c.rz, 0, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,255,0.7)'; ctx.lineWidth = Math.max(1, 0.05 * k);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TWO_PI + clockT, ex = c.x + Math.cos(a) * 0.9 * k; ctx.beginPath(); ctx.moveTo(c.x, c.y - 1.6 * k); ctx.quadraticCurveTo((c.x + ex) / 2, c.y - 2.1 * k, ex, c.y - 0.5 * k); ctx.stroke(); }
    ctx.fillStyle = toneN('#e8e0d0', fz); ctx.fillRect(c.x - 0.12 * k, c.y - 1.6 * k, 0.24 * k, 1.2 * k);
  }
}
function drawBrick(L, x, z0, z1, H) {
  const len = L.z1 - L.z0, cols = Math.max(3, Math.round(len / 2.2)), rows = [];
  for (let y = 5; y < H - 1.5; y += 3.2) {rows.push([y, y + 2]);}
  facadeWindows(L, x, z0, z1, rows, cols, { padU: L.glass ? 0.06 : 0.22, lit: 0.3, glass: L.glass ? '#9fc4d8' : '#3e4c5c', frame: L.glass ? null : '#e8d8c0' });
  // A glowing storefront along the ground floor.
  polyN(wallQuad(x - L.side * 0.05, z0, x - L.side * 0.05, z1, 0.4, 3.4), toneN('#ffcf80', midN(z0, z1), 1.05), toneN('#2a2a2a', z0), 2);
  polyN(wallQuad(x - L.side * 0.2, z0, x - L.side * 0.2, z1, H - 0.6, H), toneN('#e8d8c0', midN(z0, z1)));
  if (L.sign) {facadeSign(L, x, z0, L.z0 + len * 0.15, L.z0 + len * 0.75, 3.6, 4.6, toneN('#1a1a24', L.z0), '#ffe08a', L.name, '#ff9a3c');}
}
function drawTower(L, x, z0, z1, H) {
  // Glass curtain wall: mullions and floor lines, with a gold reflection gradient.
  const len = L.z1 - L.z0, fq = wallQuad(x, z0, x, z1, 0, H);
  const g = ctx.createLinearGradient(0, fq[2].y, 0, fq[1].y);
  g.addColorStop(0, rgbaN('#fff0c0', 0.5 * (1 - night))); g.addColorStop(0.5, rgbaN('#ffffff', 0.08)); g.addColorStop(1, rgbaN('#3a5a7a', 0.25));
  polyN(fq, g);
  ctx.strokeStyle = toneN('#3a4a5a', midN(z0, z1)); ctx.lineWidth = 1;
  const floors = Math.floor(H / 3.6), floorStep = Math.max(1, Math.floor(floors / Math.max(4, Math.abs(fq[1].y - fq[2].y) / 6)));
  for (let f = 1; f < floors; f += floorStep) { const a = P(x, f * 3.6, z0), b = P(x, f * 3.6, z1); ctx.beginPath(); segN(a, b); ctx.stroke(); }
  for (let zz = Math.ceil(L.z0 / 2) * 2; zz < z1; zz += 2) { if (zz < z0) {continue;} const a = P(x, 0, zz), b = P(x, H, zz); ctx.beginPath(); segN(a, b); ctx.stroke(); }
  if (night > 0.2 && !L.vacant) { const r = rngN(L.seed); ctx.fillStyle = `rgba(255,220,140,${night * 0.8})`; for (let i = 0; i < 40; i++) { const zz = L.z0 + r() * len, y = r() * H; if (zz > z0) { const p = P(x - L.side * 0.05, y, zz); ctx.fillRect(p.x - 1, p.y - 1, Math.max(2, p.k * 1.2), Math.max(1.5, p.k * 0.8)); } } }
  polyN(wallQuad(x, z0, x, z1, 0, 4), toneN('#2a3440', midN(z0, z1)));
  facadeWindows(L, x, z0, z1, [[0.3, 3.6]], Math.max(2, Math.round(len / 4)), { padU: 0.05, lit: 0.9, glass: '#ffd98a' });
  // Set-back crown and spire.
  if (L.crown) {
    const xc = x + L.side * 3, za = Math.max(L.z0 + 3, z0), zb = L.z1 - 3, Hc = H * 0.18;
    if (zb > za) { polyN(wallQuad(xc, za, xc, zb, H, H + Hc), toneN(L.color, midN(za, zb), 1.1)); if (L.spire) { const s = P(xc + L.side * 4, H + Hc + 26, midN(za, zb)), a = P(xc, H + Hc, midN(za, zb) - 1), b = P(xc, H + Hc, midN(za, zb) + 1); polyN([a, b, s], toneN('#fff0c0', L.z0, 1.1)); } }
  }
}
/* ---------- Building types that only some towns have: castles, villas, bungalows, caravans ---------- */
function styleLot(L, style, r) {
  const st = STYLES_LOT[style];
  Object.assign(L, { style, setback: st.setback, sign: false, name: '', crooked: 0 });
  if (style === 'castle') { Object.assign(L, { H: mixN(8, 10, r()), depth: 26, color: pickN(r, ['#e8dcc8', '#d8cfc0', '#ecd4dc', '#d4dce8', '#e8e0f0']), roof: pickN(r, ['#3a5aa8', '#c84a6a', '#5a3a8a', '#2f7a6a']), flag: pickN(r, ['#e23b3b', '#f2d13a', '#3f8fd6', '#d94f9a']), fountain: false }); }
  else if (style === 'villa') { Object.assign(L, { H: mixN(6.6, 7.6, r()), depth: 14, color: pickN(r, ['#f4ead8', '#f8e4c8', '#fff4e0', '#f0e0d8']), roof: pickN(r, ['#c8643a', '#b8583a', '#d07a4a']), fountain: r() < 0.6 }); }
  else if (style === 'bungalow') { Object.assign(L, { H: mixN(3.2, 3.7, r()), depth: 12, color: pickN(r, ['#f2d8b0', '#d8e8f0', '#f0d0d0', '#e0ecd0', '#fff0c8', '#d8d0e8']), roof: pickN(r, ['#8a5a4a', '#5a6a7a', '#a0583a', '#6a7a5a']), door: pickN(r, ['#c8322a', '#2f6a9a', '#2e7a47', '#f2b23a']), tree: r() < 0.6 }); if (r() < 0.45) { L.brick = true; L.color = pickN(r, ['#b8684a', '#a85a40', '#c47e5a', '#9a5a48', '#c89a78']); } }
  else if (style === 'caravan') { Object.assign(L, { H: mixN(2.4, 2.7, r()), depth: 3.2, color: pickN(r, ['#f2eee2', '#e8e4d6', '#dfe6ea', '#efe2c8']), band: pickN(r, ['#4a8ab8', '#c86a3a', '#6a9a5a', '#b84a4a']), rust: r(), awn: r() < 0.6 ? pickN(r, ['#3f8fd6', '#e8a030', '#5fa35b', '#c84a4a']) : null, wash: r() < 0.4 }); }
}
function drawStyled(L, x, z0, z1, H) {
  if (L.style === 'castle') { drawCastle(L, x, z0, z1, H); }
  else if (L.style === 'villa') { drawVilla(L, x, z0, z1, H); }
  else if (L.style === 'bungalow') { drawBungalow(L, x, z0, z1, H); }
  else if (L.style === 'caravan') { drawCaravan(L, x, z0, z1, H); }
}
// One window on a facade at x, between za..zb along the street and ya..yb up.
function winN(L, x, z0, za, zb, ya, yb, glass, frame, lit) {
  if (zb <= z0) { return; }
  const q = wallQuad(x - L.side * 0.04, Math.max(za, z0), x - L.side * 0.04, zb, ya, yb);
  if (frame) { windowSill(L, x, z0, za, zb, ya, frame); }
  polyN(q, glassFill(q, lit ? '#ffd98a' : glass, lit, za), frame ? toneN(frame, za) : null, 1.5);
  if (frame) { windowBars(q, frame, za); }
}
/* ---------- Making the houses look real: materials, glass, shadows ---------- */
// A line segment, skipped when either end is behind the camera.
function segN(a, b) {
  const Z = 0.6; if (a.rz < Z && b.rz < Z) { return; }
  const cut = (p, q) => { const t = (Z - p.rz) / (q.rz - p.rz), rx = p.rx + (q.rx - p.rx) * t, ry = p.ry + (q.ry - p.ry) * t; return { x: cam.cx + rx * cam.f / Z, y: cam.hy + ry * cam.f / Z }; };
  const A = a.rz < Z ? cut(a, b) : a, B = b.rz < Z ? cut(b, a) : b;
  ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
}
// Glass reflects the bright sky at the top and goes dark towards the bottom.
function glassFill(q, glass, lit, z) {
  const top = Math.min(q[2].y, q[3].y), bot = Math.max(q[0].y, q[1].y);
  if (bot - top < 5) { return toneN(glass, z); }
  const g = ctx.createLinearGradient(q[3].x, top, q[0].x, bot);
  if (lit) { g.addColorStop(0, toneN('#fff0c8', z)); g.addColorStop(1, toneN('#f0b860', z)); return g; }
  g.addColorStop(0, toneN(mixHex(glass, '#e4eef2', 0.6), z)); g.addColorStop(0.42, toneN(glass, z)); g.addColorStop(1, toneN(glass, z, 0.62));
  return g;
}
// A cross of glazing bars, only when the window is big enough to see them.
function windowBars(q, frame, z) {
  if (q.some(p => p.rz < 0.6) || Math.abs(q[0].y - q[3].y) < 14) { return; }
  const m = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const t1 = m(q[3], q[2], 0.5), b1 = m(q[0], q[1], 0.5), l1 = m(q[0], q[3], 0.62), r1 = m(q[1], q[2], 0.62);
  ctx.strokeStyle = toneN(frame, z); ctx.lineWidth = Math.min(4, Math.max(1, Math.abs(q[0].y - q[3].y) * 0.04));
  ctx.beginPath(); segN(t1, b1); segN(l1, r1); ctx.stroke();
}
// A sill that sticks out under the window and catches the light.
function windowSill(L, x, z0, za, zb, ya, frame) {
  if (zb + 0.1 <= z0) { return; }
  const zs = Math.max(za - 0.1, z0), s = L.side;
  polyN([P(x - s * 0.04, ya, zs), P(x - s * 0.04, ya, zb + 0.1), P(x - s * 0.18, ya - 0.04, zb + 0.1), P(x - s * 0.18, ya - 0.04, zs)], toneN(frame, za, 1.05));
  polyN(wallQuad(x - s * 0.04, zs, x - s * 0.04, zb + 0.1, ya - 0.14, ya - 0.04), toneN(frame, za, 0.7));
}
// What the wall is made of: weatherboards, brick or render.
function wallMaterial(L) {
  if (L.style === 'bungalow') { return L.brick ? 'brick' : 'board'; }
  if (L.style === 'caravan' || L.style === 'castle') { return null; }
  if (L.style === 'villa') { return 'render'; }
  if (L.tier === 0) { return 'board'; }
  if (L.tier === 1 || L.tier === 3 && !L.glass) { return 'brick'; }
  return 'render';
}
function drawMaterial(L, x, z0, z1, H) {
  const mat = wallMaterial(L); if (!mat || L.vacant && L.glass) { return; }
  const s = L.side, xm = x - s * 0.02, near = P(xm, 0, Math.max(z0, cam.z + 2)), far = P(xm, 0, z1);
  const course = mat === 'board' ? 0.22 : mat === 'brick' ? 0.3 : 0;
  if (course && near.k * course > 3.2) {
    ctx.strokeStyle = mat === 'board' ? 'rgba(40,24,12,0.16)' : 'rgba(250,240,225,0.28)'; ctx.lineWidth = mat === 'board' ? Math.min(2.5, Math.max(1, near.k * 0.02)) : Math.min(1.8, Math.max(0.6, near.k * 0.012));
    ctx.beginPath();
    for (let y = course; y < H - 0.05; y += course) { const a = P(xm, y, z0), b = P(xm, y, z1); segN(a, b); }
    ctx.stroke();
    // Brick joints, staggered every other course, only up close.
    if (mat === 'brick' && near.k * 0.6 > 14) {
      ctx.beginPath(); const zEnd = Math.min(z1, z0 + 9);
      for (let y = 0, row = 0; y < H - course; y += course, row++) {
        for (let zz = Math.ceil(z0 / 0.6) * 0.6 + (row % 2) * 0.3; zz < zEnd; zz += 0.6) { segN(P(xm, y, zz), P(xm, y + course, zz)); }
      }
      ctx.stroke();
    }
  }
  // Render gets soft, uneven patches of weather.
  if (mat === 'render' && near.k > 6) {
    const r = rngN(L.seed + 77);
    for (let i = 0; i < 5; i++) { const za = L.z0 + r() * (L.z1 - L.z0), zb = za + mixN(1, 3, r()), ya = r() * H * 0.8; if (zb > z0) { polyN(wallQuad(xm, Math.max(za, z0), xm, zb, ya, ya + mixN(0.6, 1.8, r())), 'rgba(90,70,50,0.05)'); } }
  }
}
// Shadows that sit a house on the ground: damp and dark at the foot of the wall, shade under the eaves,
// and a soft shadow on the grass in front.
function drawWeathering(L, x, z0, z1, H) {
  const s = L.side, mid = midN(z0, z1), base = P(x, 0, mid), up = P(x, 0.8, mid);
  if (base.rz < 1) { return; }
  let g = ctx.createLinearGradient(base.x, base.y, up.x, up.y); g.addColorStop(0, 'rgba(20,12,6,0.32)'); g.addColorStop(1, 'rgba(20,12,6,0)');
  polyN(wallQuad(x - s * 0.2, z0, x - s * 0.2, z1, 0, 0.8), g);
  if (L.style !== 'castle' && L.style !== 'caravan' && !(L.tier === 4 && !L.style)) {
    const e0 = P(x, H, mid), e1 = P(x, H - 1, mid);
    g = ctx.createLinearGradient(e0.x, e0.y, e1.x, e1.y); g.addColorStop(0, 'rgba(20,12,6,0.34)'); g.addColorStop(1, 'rgba(20,12,6,0)');
    polyN(wallQuad(x - s * 0.21, z0, x - s * 0.21, z1, H - 1, H), g);
  }
  const sh = P(x - s * 1.2, 0, mid);
  g = ctx.createLinearGradient(base.x, base.y, sh.x, sh.y); g.addColorStop(0, 'rgba(20,12,6,0.22)'); g.addColorStop(1, 'rgba(20,12,6,0)');
  polyN([P(x, 0.02, z0), P(x, 0.02, z1), P(x - s * 1.2, 0.02, z1), P(x - s * 1.2, 0.02, z0)], g);
}
// Rows of roof tiles and a gutter, on a roof plane from the eave (e) up to the ridge (r).
function roofCourses(ex, ey, ez0, ez1, rx, ry, rz0, rz1, col, z, n = 9) {
  const a = P(ex, ey, ez0); if (a.rz < 1 || a.k * (ry - ey) / n < 2.5) { return; }
  ctx.strokeStyle = toneN(col, z, 0.72); ctx.lineWidth = Math.min(2.5, Math.max(1, a.k * 0.025)); ctx.beginPath();
  for (let i = 1; i < n; i++) { const t = i / n, p0 = P(lerp(ex, rx, t), lerp(ey, ry, t), lerp(ez0, rz0, t)), p1 = P(lerp(ex, rx, t), lerp(ey, ry, t), lerp(ez1, rz1, t)); segN(p0, p1); }
  ctx.stroke();
  const g0 = P(ex, ey - 0.05, ez0), g1 = P(ex, ey - 0.05, ez1); ctx.strokeStyle = toneN('#e8e4dc', z, 0.9); ctx.lineWidth = Math.min(5, Math.max(1.5, P(ex, ey, (ez0 + ez1) / 2).k * 0.1)); ctx.beginPath(); segN(g0, g1); ctx.stroke();
}
function drawCastle(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, stone = L.color, gz = L.z0 + len / 2, r = rngN(L.seed + 3);
  // The keep, behind the curtain wall: only its upper part shows above it.
  const xk = x + s * 7, ka = L.z0 + len * 0.28, kb = L.z1 - len * 0.28, KH = H + 10;
  if (kb > z0) {
    polyN(wallQuad(xk, Math.max(ka, z0), xk, kb, H - 0.5, KH), toneN(stone, midN(ka, kb), 0.9));
    for (let zz = ka; zz < kb - 0.6; zz += 1.4) { if (zz + 0.7 > z0) { polyN(wallQuad(xk, Math.max(zz, z0), xk, zz + 0.7, KH, KH + 0.9), toneN(stone, zz, 0.95)); } }
    for (let i = 0; i < 4; i++) { const wa = ka + (kb - ka) * (0.12 + i * 0.22); winN(L, xk, z0, wa, wa + 0.7, H + 3.5, H + 5.6, '#3a3048', null, r() < 0.3 + night * 0.6); }
  }
  // Stone courses and battlements along the wall.
  ctx.strokeStyle = toneN(shadeN(stone, 0.82), midN(z0, z1)); ctx.lineWidth = 1;
  for (let y = 1.1; y < H; y += 1.1) { const a = P(x - s * 0.02, y, z0), b = P(x - s * 0.02, y, z1); ctx.beginPath(); segN(a, b); ctx.stroke(); }
  for (let zz = L.z0; zz < L.z1 - 0.6; zz += 1.4) { if (zz + 0.7 > z0) { polyN(wallQuad(x, Math.max(zz, z0), x, zz + 0.7, H, H + 0.9), toneN(stone, zz, 1.02)); } }
  // Arrow-slit windows.
  for (let zz = L.z0 + 3; zz < L.z1 - 2; zz += 3.2) { if (Math.abs(zz - gz) > 4) { winN(L, x, z0, zz, zz + 0.35, H * 0.45, H * 0.72, '#2a2430', null, false); } }
  // The gate: an arch with a portcullis, and a moat with a drawbridge in front.
  if (gz + 1.8 > z0) {
    const pts = []; for (let i = 0; i <= 10; i++) { const a = Math.PI * i / 10; pts.push(P(x - s * 0.05, 3.2 + Math.sin(a) * 1.8, gz - Math.cos(a) * 1.8)); }
    if (gz - 1.8 > z0) { polyN([P(x - s * 0.05, 0, gz - 1.8), ...pts, P(x - s * 0.05, 0, gz + 1.8)], toneN('#2a2018', gz)); }
    ctx.strokeStyle = toneN('#c8a040', gz); ctx.lineWidth = 1.2;
    for (let zz = gz - 1.5; zz <= gz + 1.5; zz += 0.5) { if (zz > z0) { const a = P(x - s * 0.06, 0.4, zz), b = P(x - s * 0.06, 3.6 + Math.cos((zz - gz) / 1.8 * HALF_PI) * 1.2, zz); ctx.beginPath(); segN(a, b); ctx.stroke(); } }
  }
  const ma = x - s * 0.4, mb = x - s * 2.8;
  polyN([P(ma, 0.06, z0), P(mb, 0.06, z0), P(mb, 0.06, z1), P(ma, 0.06, z1)], toneN('#5aa0c8', midN(z0, z1)));
  if (gz + 1.6 > z0) { polyN([P(ma, 0.1, Math.max(gz - 1.6, z0)), P(mb - s * 0.3, 0.1, Math.max(gz - 1.6, z0)), P(mb - s * 0.3, 0.1, gz + 1.6), P(ma, 0.1, gz + 1.6)], toneN('#8a6040', gz)); }
  // Round towers with pointed roofs and flags, far ones first.
  const towers = [L.z0 + 1.8, gz - 4, gz + 4, L.z1 - 1.8].sort((a, b) => b - a);
  for (const zt of towers) {
    const ta = zt - 1.6, tb = zt + 1.6, xt = x - s * 1.4, TH = H + 5 + (Math.abs(zt - gz) < 5 ? 1.5 : 0);
    if (tb < z0) { continue; }
    if (ta > cam.z + NEAR_Z) { polyN(wallQuad(xt, ta, x + s * 1.6, ta, 0, TH), toneN(stone, ta, 0.62)); }
    const fq = wallQuad(xt, Math.max(ta, z0), xt, tb, 0, TH), g = ctx.createLinearGradient(fq[0].x, 0, fq[1].x, 0);
    g.addColorStop(0, toneN(stone, zt, 0.8)); g.addColorStop(0.5, toneN(stone, zt, 1.12)); g.addColorStop(1, toneN(stone, zt, 0.86));
    polyN(fq, g);
    winN(L, xt, z0, zt - 0.3, zt + 0.3, TH - 3.2, TH - 1.6, '#2a2430', '#f4ead0', r() < night);
    if (zt > cam.z + NEAR_Z + 1) {
      const a1 = P(xt - s * 0.5, TH, Math.max(ta - 0.5, cam.z + NEAR_Z)), a2 = P(xt - s * 0.5, TH, tb + 0.5), apex = P(xt + s * 1.4, TH + 5.5, zt);
      polyN([a1, a2, apex], toneN(L.roof, zt));
      polyN([a1, P(xt + s * 1.4, TH, zt), apex], toneN(L.roof, zt, 0.75));
      // A flag on a pole, rippling.
      const top = P(xt + s * 1.4, TH + 8, zt); ctx.strokeStyle = toneN('#4a4048', zt); ctx.lineWidth = Math.min(5, Math.max(1, apex.k * 0.06)); ctx.beginPath(); segN(apex, top); ctx.stroke();
      const fl = []; for (let i = 0; i <= 6; i++) { const u = i / 6, wv = Math.sin(clockT * 4 + u * 5 + L.seed) * 0.25 * u; fl.push(P(xt + s * 1.4, TH + 7.9 + wv, zt + u * 2)); }
      for (let i = 6; i >= 0; i--) { const u = i / 6, wv = Math.sin(clockT * 4 + u * 5 + L.seed) * 0.25 * u; fl.push(P(xt + s * 1.4, TH + 6.9 + wv, zt + u * 2)); }
      polyN(fl, toneN(L.flag, zt));
    }
  }
}
function drawVilla(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, cols = Math.max(4, Math.round(len / 2.6)), r = rngN(L.seed + 4);
  for (let i = 0; i < cols; i++) {
    const za = L.z0 + len * (i + 0.3) / cols, zb = L.z0 + len * (i + 0.7) / cols;
    winN(L, x, z0, za, zb, 0.8, 2.9, '#4f6070', '#ffffff', r() < 0.3 + night * 0.6); winN(L, x, z0, za, zb, 4, 6, '#4f6070', '#ffffff', r() < 0.25 + night * 0.6);
  }
  // A long balcony with a white railing.
  polyN(wallQuad(x - s * 0.9, z0, x - s * 0.9, z1, 3.3, 3.55), toneN('#ffffff', midN(z0, z1)));
  ctx.strokeStyle = toneN('#ffffff', midN(z0, z1)); ctx.lineWidth = 1;
  for (let zz = Math.ceil(z0 / 0.4) * 0.4; zz < z1; zz += 0.4) { const a = P(x - s * 0.9, 3.55, zz), b = P(x - s * 0.9, 4.4, zz); if (a.rz > 0.6) { ctx.beginPath(); segN(a, b); ctx.stroke(); } }
  const ra = P(x - s * 0.9, 4.4, z0), rb = P(x - s * 0.9, 4.4, z1); ctx.beginPath(); segN(ra, rb); ctx.stroke();
  // Columns and a pediment at the front door.
  const dz = L.z0 + len * 0.5;
  for (const u of [-1.6, -0.6, 0.6, 1.6]) { const zc = dz + u; if (zc > z0) { polyN(wallQuad(x - s * 1.4, zc - 0.2, x - s * 1.4, zc + 0.2, 0, 6.6), toneN('#fffaf0', zc, 1.05)); } }
  if (dz - 2.2 > z0) { polyN([P(x - s * 1.5, 6.6, dz - 2.2), P(x - s * 1.5, 6.6, dz + 2.2), P(x - s * 1.5, 8.2, dz)], toneN('#fffaf0', dz)); }
  // A terracotta hip roof.
  const ridge = x + s * L.depth * 0.5;
  polyN([P(x - s * 0.6, H, z0), P(x - s * 0.6, H, z1), P(ridge, H + 3.4, Math.max(L.z1 - 4, z0)), P(ridge, H + 3.4, Math.max(L.z0 + 4, z0))], toneN(L.roof, midN(z0, z1)));
  roofCourses(x - s * 0.6, H, z0, z1, ridge, H + 3.4, Math.max(L.z0 + 4, z0), Math.max(L.z1 - 4, z0), L.roof, midN(z0, z1), 12);
  if (L.z0 > cam.z + NEAR_Z) { polyN([P(x - s * 0.6, H, L.z0), P(x + s * (L.depth + 0.6), H, L.z0), P(ridge, H + 3.4, L.z0 + 4)], toneN(L.roof, L.z0, 0.72)); }
}
function drawBungalow(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, r = rngN(L.seed + 5), mid = midN(z0, z1);
  // Two windows with shutters, a coloured front door, and a garage at the far end.
  for (const u of [0.08, 0.5]) {
    const za = L.z0 + len * u, zb = za + len * 0.18;
    winN(L, x, z0, za, zb, 1, 2.4, '#5a7080', '#ffffff', r() < 0.3 + night * 0.6);
    if (za - 0.35 > z0) { polyN(wallQuad(x - s * 0.06, za - 0.35, x - s * 0.06, za, 1, 2.4), toneN(L.door, za, 0.9)); }
    if (zb > z0) { polyN(wallQuad(x - s * 0.06, Math.max(zb, z0), x - s * 0.06, zb + 0.35, 1, 2.4), toneN(L.door, zb, 0.9)); }
  }
  const dz = L.z0 + len * 0.33;
  if (dz + 1 > z0) {
    polyN(wallQuad(x - s * 0.05, Math.max(dz, z0), x - s * 0.05, dz + 1, 0.18, 2.2), toneN(L.door, dz));
    polyN(wallQuad(x - s * 0.07, Math.max(dz + 0.12, z0), x - s * 0.07, dz + 0.88, 1.3, 2.05), toneN(L.door, dz, 0.85));
    polyN([P(x - s * 0.02, 0.18, Math.max(dz - 0.3, z0)), P(x - s * 0.02, 0.18, dz + 1.3), P(x - s * 0.8, 0.18, dz + 1.3), P(x - s * 0.8, 0.18, Math.max(dz - 0.3, z0))], toneN('#d8d0c4', dz));
    polyN(wallQuad(x - s * 0.8, Math.max(dz - 0.3, z0), x - s * 0.8, dz + 1.3, 0, 0.18), toneN('#b8b0a4', dz));
    const kn = P(x - s * 0.1, 1.05, dz + 0.82); if (kn.rz > 1) { ctx.fillStyle = toneN('#e8c860', dz); ctx.beginPath(); ctx.arc(kn.x, kn.y, Math.max(1, kn.k * 0.05), 0, TWO_PI); ctx.fill(); }
    const lp = P(x - s * 0.1, 2.45, dz + 1.25); if (lp.rz > 1) { ctx.fillStyle = night > 0.3 ? '#ffe8a0' : toneN('#3a3a3a', dz); ctx.fillRect(lp.x - lp.k * 0.07, lp.y - lp.k * 0.12, lp.k * 0.14, lp.k * 0.22); }
  }
  const ga = L.z1 - len * 0.26, gb = L.z1 - 0.4;
  if (gb > z0) { polyN(wallQuad(x - s * 0.05, Math.max(ga, z0), x - s * 0.05, gb, 0, 2.4), toneN('#ecebe6', ga)); ctx.strokeStyle = toneN('#b8b4a8', ga); ctx.lineWidth = 1; for (let y = 0.5; y < 2.4; y += 0.45) { const a = P(x - s * 0.06, y, Math.max(ga, z0)), b = P(x - s * 0.06, y, gb); ctx.beginPath(); segN(a, b); ctx.stroke(); } }
  // A driveway, a hip roof and a chimney.
  if (gb > z0) { polyN([P(x - s * 0.1, 0.07, Math.max(ga, z0)), P(s * EDGE_X, 0.07, Math.max(ga, z0)), P(s * EDGE_X, 0.07, gb), P(x - s * 0.1, 0.07, gb)], toneN('#c8c0b0', ga)); }
  const ridge = x + s * L.depth * 0.5, rz0 = Math.max(L.z0 + 3, z0), rz1 = Math.max(L.z1 - 3, z0);
  const cz = L.z0 + len * 0.7; if (cz > z0) { polyN(wallQuad(ridge - s * 2, cz, ridge - s * 2, cz + 0.7, H, H + 3), toneN('#a0583a', cz, 0.9)); }
  polyN([P(x - s * 0.7, H, z0), P(x - s * 0.7, H, z1 + 0.4), P(ridge, H + 2.4, rz1), P(ridge, H + 2.4, rz0)], toneN(L.roof, mid));
  roofCourses(x - s * 0.7, H, z0, z1 + 0.4, ridge, H + 2.4, rz0, rz1, L.roof, mid);
  if (L.z0 > cam.z + NEAR_Z) { polyN([P(x - s * 0.7, H, L.z0 - 0.4), P(x + s * (L.depth + 0.7), H, L.z0 - 0.4), P(ridge, H + 2.4, L.z0 + 3)], toneN(L.roof, L.z0, 0.7)); }
  // A white picket fence along the pavement, with a gap at the path and a letterbox.
  const xf = s * (EDGE_X + 0.3);
  ctx.strokeStyle = toneN('#ffffff', mid); ctx.lineWidth = 1.4;
  for (let zz = Math.ceil(Math.max(L.z0 - 0.6, z0) / 0.35) * 0.35; zz < L.z1 + 0.6; zz += 0.35) {
    if (Math.abs(zz - dz - 0.5) < 0.7 || zz > ga - 0.2) { continue; }
    const a = P(xf, 0, zz), b = P(xf, 0.95, zz); if (a.rz > 0.6) { ctx.beginPath(); segN(a, b); ctx.stroke(); }
  }
  const fa = P(xf, 0.7, Math.max(L.z0 - 0.6, z0)), fb = P(xf, 0.7, Math.max(dz - 0.2, z0)); ctx.beginPath(); segN(fa, fb); ctx.stroke();
  const lb = P(xf, 1.15, dz - 0.4); if (lb.rz > 1) { const k = lb.k; ctx.fillStyle = toneN('#6a5040', dz); ctx.fillRect(lb.x - 0.04 * k, lb.y, 0.08 * k, 1.15 * k); ctx.fillStyle = toneN(L.door, dz); ctx.fillRect(lb.x - 0.25 * k, lb.y - 0.3 * k, 0.5 * k, 0.32 * k); }
}
function drawCaravan(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), r = rngN(L.seed + 6);
  // A dark skirt underneath, a pale roof cap and a coloured band along the side.
  polyN(wallQuad(x - s * 0.02, z0, x - s * 0.02, z1, 0, 0.35), toneN('#3a3a3a', mid));
  polyN(wallQuad(x - s * 0.02, z0, x - s * 0.02, z1, H - 0.25, H), toneN(L.color, mid, 1.12));
  polyN(wallQuad(x - s * 0.03, z0, x - s * 0.03, z1, 1.15, 1.45), toneN(L.band, mid));
  // Rust where the paint has gone.
  if (L.rust > 0.4) { for (let i = 0; i < 4; i++) { const za = L.z0 + r() * (len - 1), zb = za + 0.4 + r() * 0.8, ya = 0.4 + r() * 1.5; if (zb > z0) { polyN(wallQuad(x - s * 0.04, Math.max(za, z0), x - s * 0.04, zb, ya, ya + 0.3 + r() * 0.4), toneN('#a0603a', za, 0.9)); } } }
  winN(L, x, z0, L.z0 + len * 0.1, L.z0 + len * 0.38, 1.6, 2.15, '#4a5a6a', '#d8d8d0', r() < 0.2 + night * 0.7);
  winN(L, x, z0, L.z0 + len * 0.78, L.z0 + len * 0.92, 1.6, 2.15, '#4a5a6a', '#d8d8d0', false);
  const dz = L.z0 + len * 0.52; if (dz + 0.7 > z0) { polyN(wallQuad(x - s * 0.05, Math.max(dz, z0), x - s * 0.05, dz + 0.7, 0.35, 2.15), toneN(shadeN(L.color, 0.85), dz), toneN('#8a8a80', dz), 1); }
  // Wheels.
  const w = P(x - s * 0.1, 0.32, L.z0 + len * 0.45); if (w.rz > 1 && L.z0 + len * 0.45 > z0) { ctx.fillStyle = toneN('#1e1e22', mid); ctx.beginPath(); ctx.ellipse(w.x, w.y, 0.34 * w.k * 0.6, 0.34 * w.k, 0, 0, TWO_PI); ctx.fill(); }
  // A tarp awning on poles, and a washing line.
  if (L.awn) {
    const za = Math.max(L.z0 + len * 0.15, z0), zb = L.z0 + len * 0.9;
    if (zb > z0) {
      polyN([P(x, H - 0.3, za), P(x, H - 0.3, zb), P(x - s * 2.6, 2.0, zb), P(x - s * 2.6, 2.0, za)], rgbaN(toneN(L.awn, mid), 0.85));
      ctx.strokeStyle = toneN('#6a6a6a', mid); ctx.lineWidth = 1.2; for (const zz of [za, zb]) { const a = P(x - s * 2.6, 0, zz), b = P(x - s * 2.6, 2.0, zz); if (a.rz > 0.6) { ctx.beginPath(); segN(a, b); ctx.stroke(); } }
    }
  }
  if (L.wash && L.z1 > z0 + 1) {
    const xa = x - s * 3.1, a = P(xa, 1.9, Math.max(L.z0 + 0.5, z0 + 0.5)), b = P(xa, 1.9, L.z1 - 0.3);
    if (a.rz > 1) {
      ctx.strokeStyle = toneN('#d8d8d8', mid); ctx.lineWidth = 1; ctx.beginPath(); segN(a, b); ctx.stroke();
      const cols = ['#e86a6a', '#ffffff', '#6a9ae8', '#f2d13a', '#8ac88a'];
      for (let i = 0; i < 5; i++) { const zz = mixN(Math.max(L.z0 + 0.8, z0 + 0.8), L.z1 - 0.6, (i + 0.5) / 5), c = P(xa, 1.9, zz); if (c.rz > 1) { ctx.fillStyle = toneN(cols[(i + L.seed) % 5 < 0 ? 0 : (i + L.seed) % 5], zz); ctx.fillRect(c.x - 0.18 * c.k, c.y, 0.36 * c.k, 0.5 * c.k); } }
    }
  }
}
function drawJail(L, x, z0, z1, H) {
  const len = L.z1 - L.z0;
  // Stone blocks.
  ctx.strokeStyle = toneN('#55565e', midN(z0, z1)); ctx.lineWidth = 1;
  for (let y = 0.6; y < H; y += 0.6) { const a = P(x - L.side * 0.02, y, z0), b = P(x - L.side * 0.02, y, z1); ctx.beginPath(); segN(a, b); ctx.stroke(); }
  // Barred windows in orange and blue stripes.
  const r = rngN(L.seed);
  for (let i = 0; i < 5; i++) {for (const [ya, yb] of [[2.2, 3.8], [5.2, 6.8]]) {
    const za = L.z0 + len * (0.12 + i * 0.17), zb = za + 1.3; if (zb < z0) {continue;}
    polyN(wallQuad(x - L.side * 0.05, Math.max(za, z0), x - L.side * 0.05, zb, ya, yb), toneN('#1e2a40', za));
    for (let b = 0; b < 5; b++) { const zz = za + 0.1 + b * 0.27; if (zz < z0) {continue;} polyN(wallQuad(x - L.side * 0.1, zz, x - L.side * 0.1, zz + 0.1, ya, yb), toneN(b % 2 ? BOARD_COL.orange : '#3f6fd6', zz)); }
  }}
  // Arched gate and a guard tower on the near corner.
  const gz = L.z0 + len * 0.45; if (gz + 2.4 > z0) {polyN(wallQuad(x - L.side * 0.06, Math.max(gz, z0), x - L.side * 0.06, gz + 2.4, 0, 3.4), toneN('#3a2a20', gz));}
  polyN(wallQuad(x - L.side * 0.2, z0, x - L.side * 0.2, z1, H - 0.7, H), toneN(BOARD_COL.orange, midN(z0, z1)));
  if (L.z0 + 4 > z0) {
    const tz0 = Math.max(L.z0, z0), tz1 = L.z0 + 4; polyN(wallQuad(x - L.side * 0.3, tz0, x - L.side * 0.3, tz1, H, H + 5), toneN('#6a6c76', tz0, 1.05));
    polyN([P(x - L.side * 1, H + 5, tz0), P(x - L.side * 1, H + 5, tz1), P(x + L.side * 1.5, H + 7.5, (tz0 + tz1) / 2)], toneN('#3f6fd6', tz0));
  }
  facadeSign(L, x, z0, L.z0 + len * 0.3, L.z0 + len * 0.75, 4.2, 5.0, toneN('#2a2a30', L.z0), '#f2e6c0', 'JAIL · JUST VISITING', null);
}
function drawCasino(L, x, z0, z1, H) {
  const len = L.z1 - L.z0, t = clockT;
  // Chase lights along the top and around the entrance.
  for (let i = 0; i < 40; i++) {
    const zz = L.z0 + len * i / 40; if (zz < z0) {continue;}
    const on = (Math.floor(t * 8) + i) % 3 === 0, p = P(x - L.side * 0.1, H - 0.4, zz);
    ctx.fillStyle = on ? '#fff4b0' : '#c8902a'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.k * 0.12), 0, TWO_PI); ctx.fill();
  }
  polyN(wallQuad(x - L.side * 0.05, z0, x - L.side * 0.05, z1, 0.3, 3.6), toneN('#ffb04a', midN(z0, z1), 1.1), '#ff4a3a', 2);
  facadeSign(L, x, z0, L.z0 + len * 0.15, L.z0 + len * 0.85, 4.2, 5.6, '#2a0a20', '#ffe08a', 'CHANCE CASINO', '#ff5a3a');
  // A big marquee facing down the street: question mark, bulbs and a spinning wheel.
  const mz = L.z0 + 3; if (mz < cam.z + NEAR_Z) {return;}
  const xa = x - L.side * 4.5, xb = x - L.side * 0.2, a = P(xa, 5.5, mz), b = P(xb, 5.5, mz), c = P(xb, 15, mz), d = P(xa, 15, mz);
  if ([a, b, c, d].some(q => q.rz < 1)) {return;}
  polyN([a, b, c, d], '#3a0a2a', '#ffcf3a', Math.max(1, a.k * 0.08));
  const cx = (a.x + b.x) / 2, w = Math.abs(b.x - a.x), top = c.y, hgt = a.y - c.y;
  ctx.save(); ctx.font = `bold ${hgt * 0.62}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff3a3a'; ctx.shadowBlur = 18; ctx.fillStyle = Math.sin(t * 6) > -0.7 ? '#ffe36a' : '#ff8a3a'; ctx.fillText('?', cx, top + hgt * 0.42);
  ctx.font = `bold ${hgt * 0.1}px Georgia, serif`; ctx.fillStyle = '#fff'; ctx.shadowColor = '#ff8a3a'; ctx.fillText('CHANCE', cx, top + hgt * 0.86, w * 0.9); ctx.restore();
  for (let i = 0; i < 28; i++) { const u = i / 28, per = u < 0.25 ? [mixN(a.x, b.x, u * 4), a.y] : u < 0.5 ? [b.x, mixN(b.y, c.y, (u - 0.25) * 4)] : u < 0.75 ? [mixN(c.x, d.x, (u - 0.5) * 4), c.y] : [d.x, mixN(d.y, a.y, (u - 0.75) * 4)]; ctx.fillStyle = (Math.floor(t * 10) + i) % 2 ? '#fff6c0' : '#ff7a3a'; ctx.beginPath(); ctx.arc(per[0], per[1], Math.max(1.2, a.k * 0.1), 0, TWO_PI); ctx.fill(); }
  const wc = P((xa + xb) / 2, 17.5, mz), wr = a.k * 2.2;
  for (let s = 0; s < 8; s++) { ctx.fillStyle = s % 2 ? '#e23b3b' : '#ffcf3a'; ctx.beginPath(); ctx.moveTo(wc.x, wc.y); ctx.arc(wc.x, wc.y, wr, t * 1.5 + s * PI / 4, t * 1.5 + (s + 1) * PI / 4); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(wc.x, wc.y, wr * 0.18, 0, TWO_PI); ctx.fill();
}

/* ---------- Pavement life ---------- */
function drawLamp(q, p) {
  const k = q.k, h = 4.2, glow = night > 0.2 || p.flick < 0.3;
  ctx.fillStyle = toneN('#26332e', p.z); ctx.fillRect(q.x - 0.06 * k, q.y - h * k, 0.12 * k, h * k);
  const lx = q.x, ly = q.y - h * k;
  ctx.fillStyle = toneN('#26332e', p.z); ctx.fillRect(lx - 0.18 * k, ly - 0.55 * k, 0.36 * k, 0.12 * k);
  let lit = 0.35 + night * 0.65; if (lastTier === 0 && Math.sin(clockT * 17 + p.flick * 40) < -0.6) {lit *= 0.3;}
  ctx.fillStyle = `rgba(255,224,150,${0.6 + lit * 0.4})`; ctx.fillRect(lx - 0.14 * k, ly - 0.43 * k, 0.28 * k, 0.4 * k);
  if (glow || night > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(lx, ly - 0.2 * k, 0, lx, ly - 0.2 * k, 1.4 * k); g.addColorStop(0, `rgba(255,210,130,${0.35 * lit})`); g.addColorStop(1, 'rgba(255,210,130,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 1.4 * k, ly - 1.6 * k, 2.8 * k, 2.8 * k); ctx.restore(); }
}
function drawBanner(q, p) { const k = q.k; ctx.fillStyle = toneN(p.color, p.z); ctx.fillRect(q.x + (p.x > 0 ? -0.75 : 0.07) * k, q.y - 3.6 * k, 0.68 * k, 1.3 * k); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(q.x + (p.x > 0 ? -0.6 : 0.2) * k, q.y - 3.2 * k, 0.4 * k, 0.08 * k); }
// A haze-coloured silhouette of a painted tree sprite, laid over it in the distance.
const hazeCache = new Map();
function hazeSprite(img) {
  if (hazeCache.has(img)) { return hazeCache.get(img); }
  const src = img.canvas || img.elt, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#ffd79a'; c.fillRect(0, 0, cv.width, cv.height);
  hazeCache.set(img, cv); return cv;
}
function drawTree(q, p) {
  if (typeof drawBrushTree === 'function' && drawBrushTree(q, 'broad', p.tone || 0, p.h * 1.2, p.z)) { return; }
  // Painted trees (trees.js): grown once from a seed, drawn as sprites with a shadow and the street's haze.
  if (typeof brushTrees !== 'undefined' && brushTrees && brushTrees.length) {
    const img = brushTrees[Math.floor(p.tone * 997) % brushTrees.length], hpx = p.h * 1.35 * q.k, wpx = hpx * BT_W / BT_H, fog = fogFor(p.z);
    ctx.save(); ctx.fillStyle = `rgba(60,40,30,${0.14 * (1 - fog)})`; ctx.beginPath(); ctx.ellipse(q.x, q.y + 0.2 * q.k, wpx * 0.2, 0.35 * q.k, 0, 0, TWO_PI); ctx.fill();
    ctx.drawImage(img.canvas || img.elt, q.x - wpx / 2, q.y - hpx, wpx, hpx); ctx.restore();
    if (fog > 0.02) { ctx.save(); ctx.globalAlpha = fog * 0.85; ctx.drawImage(hazeSprite(img), q.x - wpx / 2, q.y - hpx, wpx, hpx); ctx.restore(); }
    return;
  }
  const k = q.k, h = p.h;
  ctx.fillStyle = toneN('#6a4a32', p.z); ctx.fillRect(q.x - 0.12 * k, q.y - h * 0.5 * k, 0.24 * k, h * 0.5 * k);
  const r = rngN(Math.floor(p.z * 10));
  for (let i = 0; i < 7; i++) {
    const cx = q.x + (r() - 0.5) * 1.8 * k, cy = q.y - (h * 0.62 + r() * h * 0.35) * k, rad = mixN(0.9, 1.5, r()) * k;
    const g = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.4, rad * 0.1, cx, cy, rad);
    g.addColorStop(0, toneN(p.tone < 0.5 ? '#8fc860' : '#a8c850', p.z, 1.15)); g.addColorStop(1, toneN('#3f7a3a', p.z));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TWO_PI); ctx.fill();
  }
}
function drawBin(q, p) {
  const k = q.k; ctx.fillStyle = toneN('#5a6a5a', p.z); ctx.fillRect(q.x - 0.3 * k, q.y - 0.9 * k, 0.6 * k, 0.9 * k);
  ctx.fillStyle = toneN('#d8c8a0', p.z); for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(q.x + (i - 1.5) * 0.15 * k, q.y - 0.95 * k - (i % 2) * 0.08 * k, 0.12 * k, 0, TWO_PI); ctx.fill(); }
  ctx.fillStyle = toneN('#4a5a4a', p.z); ctx.beginPath(); ctx.ellipse(q.x + 0.5 * k, q.y - 0.05 * k, 0.25 * k, 0.08 * k, 0, 0, TWO_PI); ctx.fill();
}

/* ---------- Overlays: district deed card and Chance card ---------- */
function drawOverlays() {
  // Vignette and grain.
  const vg = ctx.createRadialGradient(width / 2, height * 0.5, Math.min(width, height) * 0.4, width / 2, height * 0.5, Math.max(width, height) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,14,6,0.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, width, height);
  image(grain, 0, 0, width, height);
  if (districtCard && false) {   // the NEXT bar sits here now
    const age = clockT - districtCard.t, a = easeN(age / 0.5) * (1 - easeN((age - 4) / 0.8));
    if (a > 0) { const d = DISTRICTS[districtCard.tier]; deedCard(width / 2, 30, a, d.stripe[0], d.name.toUpperCase(), d.tag, `Age ${lifeAge}`); }
  }
  if (card) {
    const age = clockT - card.t, a = easeN(age / 0.4) * (1 - easeN((age - 4.2) / 0.6));
    if (a > 0) {
      const col = card.kind === 'jail' ? BOARD_COL.orange : card.kind === 'go' ? BOARD_COL.red : '#f28c28';
      push(); const w = Math.min(340, width - 32), h = 150, x = width / 2 - w / 2, y = height * 0.5 - h / 2 + (1 - a) * 30;
      drawingContext.globalAlpha = a; noStroke(); fill(255, 248, 232); rect(x, y, w, h, 10); fill(col); rect(x, y, w, 38, 10, 10, 0, 0);
      fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(18); text(card.text[0], width / 2, y + 20);
      fill(40, 30, 24); textSize(22); text(card.text[1], width / 2, y + 70); textStyle(NORMAL); textSize(14); fill(90, 70, 60); text(card.text[2], width / 2, y + 104);
      pop();
    }
  }
  drawBoardHud();

}
function deedCard(cx, y, a, col, title, tag, foot) {
  push(); const w = Math.min(280, width - 32), x = cx - w / 2; drawingContext.globalAlpha = a; noStroke();
  fill(0, 60); rect(x + 3, y + 4, w, 92, 8); fill(255, 250, 238); rect(x, y, w, 92, 8); fill(col); rect(x + 8, y + 8, w - 16, 36, 4);
  fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(15); text(title, cx, y + 26);
  textStyle(NORMAL); fill(60, 50, 44); textSize(13); text(tag, cx, y + 60); fill(130, 110, 100); textSize(11); text(foot, cx, y + 79); pop();
}
/* ---------- Input ---------- */
async function beginSound() { if (audioStarted) {return;} audioStarted = true; try { await sound.start(); } catch (e) { console.warn(e); } }
function mousePressed(e) { if (e.target !== canvasNode) {return;} if (boardClick(e.clientX - canvasNode.getBoundingClientRect().left, e.clientY - canvasNode.getBoundingClientRect().top)) { beginSound(); return false; } canvasNode.focus({ preventScroll: true }); pointerHeld = true; beginSound(); return false; }
function mouseReleased() { pointerHeld = false; }
function keyPressed(e) {
  if (e.target !== canvasNode) {return;} const k = String(key).toLowerCase();
  if (e.repeat && ['m', 'p', 'r', ' ', 'enter', 'e', 'a', 'd'].includes(k)) {return false;}
  beginSound();
  if (!paused && boardKey(e)) {return false;}
  if (e.key === 'Enter') { autoWalk = !autoWalk; return false; }
  if (k === 'm') { sound.toggle(); return false; }
  if (k === 'p') { paused = !paused; return false; }
  if (k === 'r') { seed += 97; chunks.clear(); firedCasinos.clear(); visitedJails.clear(); distanceWalked = 0; streetT = clockT; ownedFromC = Infinity; lastTier = -1; lastChunk = -1; economyTarget = 1; nightTarget = 0; crashTarget = 0; buildSkyline(); return false; }
  if (['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'].includes(e.code)) {return false;}
}
function touchStarted() { canvasNode.focus(); pointerHeld = true; beginSound(); return false; }
function touchEnded() { pointerHeld = false; return false; }
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

/* Plotline — We Build Our World.
 * The street starts as forest: wind, leaves and birds, and nothing built. With your hands (camera,
 * press H) or the keys you cut the forest down beside you and raise buildings on the cleared land,
 * floor by floor: an open hand builds homes, a fist builds towers. The more you build, the more the
 * street turns into a city: traffic instead of birds, music instead of wind. Build enough and the
 * last bird stops singing, and the card counts what it cost.
 */
const START_AGE = 24, OWN_GOAL = 3;
const RENT_WEEK = 380;     // the base weekly rent that town rents are scaled from
const BASE_PRICE = [520000, 780000, 1600000, 2400000, 4800000];  // by district tier, inner city
const ZONE_PRICE = 0.8, DEPOSIT = 0.1;                     // prices fall 20% per town out
const GROWTH = [8, 3];                                      // % price rise per year (a year = half a lap walked), by rule
const RENT_YIELD = [0.09, 0.05];   // tenants pay this share of a home's value a year
const MOVED = [4, 3, 2, 2, 1];                              // households living in a lot, by tier
// Six towns, one for each class. ← turns to a poorer town, → to a richer one. You start in the middle.
// Each block of a town is a building type: a number is a district tier (0 shacks, 1 shops and
// terraces, 2 mansions, 3 brick and glass, 4 towers); a word is a town's own type.
const TOWNS = [
  { name: 'Castle Hill', cls: 'Royalty', price: 9.5e6, rent: 4200, green: true, slots: ['villa', 'castle', 'castle', 'villa', 'castle', 'villa', 'castle', 'castle', 'villa', 'castle'] },
  { name: 'Mansion Row', cls: 'The rich', price: 3.4e6, rent: 1900, green: true, slots: [2, 2, 'villa', 2, 2, 'villa', 2, 'villa', 2, 2] },
  { name: 'The City', cls: 'Upper middle class', price: 1.4e6, rent: 820, slots: [1, 3, 3, 4, 4, 3, 1, 4, 4, 3] },
  { name: 'Leafy Suburbs', cls: 'Middle class', price: 760000, rent: 520, green: true, slots: ['bungalow', 'bungalow', 1, 'bungalow', 'bungalow', 'bungalow', 1, 'bungalow', 'bungalow', 'bungalow'] },
  { name: 'Working Town', cls: 'Working class', price: 430000, rent: 360, slots: [0, 1, 0, 0, 1, 0, 1, 0, 0, 1] },
  { name: 'The Fringe', cls: 'The poorest', price: 175000, rent: 190, slots: ['caravan', 0, 'caravan', 'caravan', 0, 'caravan', 'caravan', 0, 'caravan', 'caravan'] }
];
const ZONE_NAMES = TOWNS.map(t => t.name), START_ZONE = 3;
// The building types that only some towns have: their district (for colours and the ground), lot size and title-deed name.
const STYLES_LOT = {
  castle: { tier: 2, len: [28, 33], setback: 8, name: 'A castle', moved: 1, priceK: 1.6, col: ['#8a4a9a', '#d8b0e8'] },
  villa: { tier: 2, len: [20, 26], setback: 6, name: 'Grand villa', moved: 1, priceK: 0.8, col: ['#c8322a', '#f2d13a'] },
  bungalow: { tier: 1, len: [11, 14], setback: 4.5, name: 'Family bungalow', moved: 1, priceK: 1, col: ['#3f8fd6', '#a9d8f0'] },
  caravan: { tier: 0, len: [6, 7.5], setback: 1.2, name: 'Caravan park', moved: 2, priceK: 0.7, col: ['#8b5a2b', '#d8c0a0'] }
};
function townSlot(slot) { return TOWNS[zone].slots[slot]; }
function chunkStyle(slot) { const v = townSlot(slot); return typeof v === 'string' ? v : null; }
function deedName(L) { return L.style ? STYLES_LOT[L.style].name : DISTRICTS[L.tier].name; }
function deedCol(L) { return L.style ? STYLES_LOT[L.style].col[0] : DISTRICTS[L.tier].stripe[0]; }
function movedFrom(L) { return L.style ? STYLES_LOT[L.style].moved : MOVED[L.tier]; }
const OWNER_COL = '#d4a017', HOUSE_COL = '#2e9e47', SHARE_COL = '#3f9e6a';

let lifeAge = START_AGE, zone = START_ZONE, market = 1, rentPaid = 0, rentWeek = TOWNS[START_ZONE].rent, rentBase = RENT_WEEK;
let turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, queuedTurn = 0, nameBox = null;
let ownedFromC = Infinity, home = null, ending = null, intro = true, landlordMode = false, lapStartT = 0;
let rules = 1, firstRun = null, startSeed = null, emptyK = 1;
let owned = [], rentIn = 0, movedOut = 0, walkedTotal = 0;
const toasts = [];
let soldBeat = null;   // the moment after you buy: who had to leave
let evicted = [], lastBuyZ = 0, rentedAt = 0;   // Round 1's families, for Round 2
const RENT_BUDGET = 230;   // what the evicted family can pay a week
function meName() { return (firstRun && firstRun.me) || 'The Nguyens'; }
function rentAsk(L) { return Math.round(TOWNS[zone].rent * (L.style ? STYLES_LOT[L.style].priceK : 0.85 + L.tier * 0.1) * L.priceK / 5) * 5; }
function familyOf(L) { return FAMILIES[Math.abs(L.seed) % FAMILIES.length]; }
const FAMILIES = ['The Nguyens', 'The Kellys', 'Mrs Brown', 'The Patels', 'The Wongs', 'The Okafors', 'Tom and Ana', 'The Russos', 'Old Mr Lee', 'The Haddads', 'Jess and her mum', 'The Murphys'];
const LEAVING = ['We’ve lived here eleven years.', 'Where do we go now?', 'The kids’ school is just there.', 'We couldn’t match the price.', 'Two hours from work, now.', 'My mum is next door.', 'The landlord sold it.'];
const ARRIVING = ['We can finally stay!', 'Hello, neighbour!', 'The kids can walk to school.', 'Ten minutes from work.'];
// How alive the street still is: 1 = full of people, falling as families are moved out (Rule 1).
function streetLife() { return rules === 2 ? 1 : Math.max(0.12, 1 - movedOut / 14) * emptyK; }
const streetMemory = new Map();

const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const moneyK = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M' : '$' + Math.round(v / 1000) + 'k';
const COMMUTE = [15, 20, 10, 35, 55, 95];   // minutes to work in the city, by town
function commuteMin(zn = zone) { return COMMUTE[zn]; }
function commuteShort(zn) { const m = COMMUTE[zn]; return m < 60 ? `${m} min to work` : `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''} to work`; }
function commuteText() { const m = commuteMin(); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; }
function sayToast(text) { toasts.push({ text, t: clockT }); }
// Under her rules the land tax keeps land prices down (Henry George), so homes cost less.
function priceOf(L) { return TOWNS[zone].price * (L.style ? STYLES_LOT[L.style].priceK : 0.85 + L.tier * 0.1) * market * L.priceK; }
function chunkTier(slot) { const v = townSlot(slot); return typeof v === 'string' ? STYLES_LOT[v].tier : v; }
function rentFor(zn) { return Math.round(TOWNS[zn].rent * rentBase / RENT_WEEK); }
// What a home you own is worth now, and what the bank will still lend you against them all.
function valueOf(o) { return o.price * (market / o.mBuy) * o.lift; }
function totalValue() { return owned.reduce((s, o) => s + valueOf(o), 0); }
function rentOf(o) { return valueOf(o) * RENT_YIELD[rules - 1]; }
function paydayIn() { const half = CHUNK_LEN * LAP_LEN / 2; return Math.round(half - modN(distanceWalked, half)); }

/* ---------- Generated billboards ---------- */
// The artwork's own slogans, in red bars of white type, on billboards and across the buildings.
const ART = ['FORMERLY: FOREST', 'NATURE, NOW WITH PARKING', 'WE KEPT ONE TREE. FOR THE BROCHURE.', 'THE VIEW USED TO BE TREES', 'PROGRESS', 'BIRDS NOT INCLUDED', 'GREEN LIVING (THE PAINT IS GREEN)', 'WE BUILT THIS. WHAT WAS HERE BEFORE?'];
const VOID_NAMES = ['FOREST VIEW APARTMENTS', 'GREENWOOD TOWER (NO WOOD)', 'THE CANOPY RESIDENCES', 'OAK HEIGHTS · NO OAKS', 'NATURE’S EDGE · 300 UNITS'];


/* ---------- Called from chunkAt() ---------- */
function plotsForChunk(ch, r) {
  // Every lot is forest until you cut it down and build on it. People, lamps and gardens only come
  // once there are buildings near them (see propWaits).
  for (const L of ch.lots) {
    const mid = (L.z0 + L.z1) / 2;
    if (L.style === 'bungalow' && L.tree) { ch.props.push({ kind: 'tree', x: L.side * (EDGE_X + 2.2), z: L.z0 + (L.z1 - L.z0) * 0.2, h: mixN(4, 5.5, r()), tone: r() }); }
    if (L.style === 'caravan' && r() < 0.5) { ch.props.push({ kind: 'bin', x: L.side * (EDGE_X - 0.6), z: mid, tone: r() }); }
  }
  for (const b of ch.back) {
    if (ch.style === 'bungalow') { b.h = mixN(5, 7.5, r()); b.color = pickN(r, ['#c8a890', '#b8a898', '#a8b0a0']); }
  }
  // A slogan painted on one wall a side, once that wall exists.
  for (const side of [-1, 1]) { const walls = ch.lots.filter(L => L.side === side && !L.special && L.H > 3 && L.z1 - L.z0 > 6); if (walls.length && r() < 0.7) { pickN(r, walls).art = ART[(ch.slot * 2 + (side > 0 ? 1 : 0)) % ART.length]; } }
}
// Street life waits for buildings: nobody lives in the forest.
function propWaits(ch, p) {
  if (p.kind === 'turnsign') { return true; }
  const side = p.x < 0 ? -1 : 1;
  return !ch.lots.some(L => L.side === side && L.born !== undefined && Math.abs((L.z0 + L.z1) / 2 - p.z) < 16);
}

/* ---------- The sound of the homes ---------- */
// Every lived-in home has its own sound: kids, a dog, a piano, the TV. Walk past and you hear it
// through the wall; stand still and it comes through clearly. Buy it and it goes quiet for good.
function lifeKind(L) {
  const pool = L.style === 'caravan' || L.tier === 0 ? ['dog', 'radio', 'baby', 'tv', 'kids'] : L.tier >= 3 ? ['tv', 'piano', 'baby', 'talk'] : L.tier === 2 ? ['piano', 'dog', 'kids', 'talk'] : ['kids', 'dog', 'piano', 'cook', 'tv', 'baby'];
  return pool[Math.abs(L.seed >> 3) % pool.length];
}
function lived(L) { return !L.special && !L.vacant && !L.owned && !L.piece && !L.sold && riseOf(L.born) > 0.9 && (L.sinkK === undefined || L.sinkK > 0.5); }
function houseLife() {
  if (!sound || !sound.life) { return; }
  const listen = intro || ending || turnAnim ? 0 : easeN((stillT - 0.6) / 1.2);
  sound.listenK = listen;
  if (intro || paused || turnAnim) { return; }
  const near = [];
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      const mid = (L.z0 + L.z1) / 2, d = Math.hypot(mid - distanceWalked, EDGE_X + L.setback + 2); if (d > 24) { continue; }
      if (L.lifeAt === undefined) { L.lifeAt = clockT + Math.random() * 2.5; }
      // Round 2: your old home. For a moment you hear it as it was.
      if (rules === 2 && L.home && L.owned && !L.memDone && Math.abs(mid - distanceWalked) < 10) { L.memDone = true; const q = P(L.side * (EDGE_X + L.setback + 2), 1.5, mid); sound.life(lifeKind(L), 1.2, q.rx / (Math.abs(q.rz) + 4), true); }
      if (!ending && lived(L)) { near.push({ L, d, mid }); }
    }
  }
  near.sort((a, b) => a.d - b.d);
  for (const { L, d, mid } of near.slice(0, 3)) {
    if (clockT < L.lifeAt) { continue; }
    const q = P(L.side * (EDGE_X + L.setback + 2), 1.5, mid), g = Math.pow(1 - d / 24, 2) * (0.7 + listen * 0.5) * 1.6;
    const len = sound.life(lifeKind(L), g, q.rx / (Math.abs(q.rz) + 4));
    L.lifeAt = clockT + len + mixN(1.2, 3.5, Math.random()) * (1 - listen * 0.6);
  }
}

/* ---------- Every frame ---------- */
function boardUpdate(z) {
  updateTurn(); houseLife(); handUpdate(Math.min(deltaTime / 1000, 0.05));
  const dt = Math.min(deltaTime / 1000, 0.05);
  // Prices rise with time, and time is the walk: standing still, nothing changes.
  const walked = distanceWalked - lastWalkZ; lastWalkZ = distanceWalked;
  if (!paused && !intro && !ending && walked > 0 && walked < 5) { walkedTotal += walked; lifeAge = START_AGE + Math.floor(walkedTotal / 120); market *= 1 + GROWTH[rules - 1] / 100 * walked / YEAR_M; }
  if (ending && ending.kind === 'rule1') { emptyK = Math.max(0.06, 1 - (clockT - ending.t) / 3); }
  for (const ch of chunks.values()) {
    evolveStreet(ch);
    // People carrying their boxes away, and new neighbours walking in.
    for (let i = ch.props.length - 1; i >= 0; i--) {
      const p = ch.props[i];
      if (p.mover) { p.z += 1.25 * dt; p.ph += dt * 4; if (clockT > p.until) { ch.props.splice(i, 1); } }
      else if (p.arrive) { if (p.z > p.tz) { p.z = Math.max(p.tz, p.z - 1.3 * dt); p.ph += dt * 4; } else { p.arrive = false; } }
    }
  }
  // Rule 1: investors buy plots out from under you, and leave them empty.
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (L.forSale && L.investorAt > 0 && (L.z0 + L.z1) / 2 - z < L.investorAt) {
        const tower = makeLot(null, Math.min(4, L.tier + 2), L.side, L.z0, L.z1 - L.z0, rngN(L.seed));
        Object.assign(L, { style: null, forSale: false, investorAt: -1, sold: true, vacant: true, changedYear: lifeAge, born: clockT + 0.2, H: tower.H, depth: tower.depth, color: tower.color, tier: tower.tier, crown: tower.crown, spire: tower.spire, glass: tower.glass, name: VOID_NAMES[Math.abs(L.seed) % VOID_NAMES.length], sign: true });
        preserveLot(L); ch.props = ch.props.filter(p => p.lotRef !== L);
        sound.jail(); if (!toasts.some(t => t.text.startsWith('An investor') && clockT - t.t < 3)) { sayToast('An investor got there first: luxury apartments, 0 affordable.'); }
      }
    }
  }
  if (!ending && rules === 1 && owned.length >= OWN_GOAL && clockT - owned[owned.length - 1].t > 4) { endWalk('rule1'); }
  if (builtCount >= nextThought) { sayToast(THOUGHTS[Math.floor(nextThought / 10 - 1) % THOUGHTS.length]); nextThought += 10; }
  // Round 2: nothing here is affordable, so at the next corner you are turned further out.
  // On the old street that happens only after you have walked past every home you bought.
  if (rules === 2 && !ending && !intro && !turnAnim && !sideSt && !rentedAt && zone < ZONE_NAMES.length - 1) {
    const c = Math.floor(distanceWalked / CHUNK_LEN) + 1, zc = c * CHUNK_LEN + CROSS_W / 2, passZ = firstRun && zone === firstRun.zone ? firstRun.passZ : -Infinity;
    if (zc - distanceWalked < 26 && zc > passZ) { queuedTurn = -1; makeSide(-1, c); sayToast(`Nothing you can pay for here. Further out: ${ZONE_NAMES[zone + 1]}.`); }
  }
}
// Pay day: twice a lap, a year each time.
function onPassGo() { }   // no pay days: the walk is about who lives where, not about money
function onChance(kind) {
  if (kind === 'boom') { market *= 1.08; sayToast('Interest rates cut! Everything for sale just went up 8%.'); }
  if (kind === 'crash') { rentWeek += 40; sayToast(`Rates rise. Your landlord passes it on: rent ${money(rentWeek)}/wk.`); }
}

/* ---------- The plot beside you ---------- */
function plotHere(z) {
  if (turnAnim || intro || ending) { return null; }
  let best = null;
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (!L.forSale) { continue; }
      const d = Math.abs((L.z0 + L.z1) / 2 - z);
      if (d < 10 && (!best || d < best.d)) { best = { L, d }; }
    }
  }
  return best ? best.L : null;
}
function actionFor(L) {
  if (!L) { return null; }
  if (rules === 1) { return { label: 'E  ·  Buy it', ok: true }; }
  if (rules === 2) { const a = rentAsk(L); return { label: `${money(a)} a week`, ok: a <= RENT_BUDGET }; }
  return null;
}
function useHere() { if (intro) { intro = false; } }
function buyLot(L) {
  const price = priceOf(L);
  const first = !home, ch = chunks.get(Math.floor(L.z0 / CHUNK_LEN)), mid = (L.z0 + L.z1) / 2, n = movedFrom(L);
  const o = { key: L.memoryKey, price, mBuy: market, lift: 1, tier: L.tier, zone, home: first, t: clockT };
  owned.push(o);
  if (first) { home = { price, t: clockT, commute: commuteText(), zone, lifeAge }; }
  Object.assign(L, { forSale: false, owned: true, home: first, investorAt: -1, thud: false });
  // Your own home stays a real house and rises again as yours. Under Rule 1 every other home you buy
  // stops being a home: it sinks, and a plastic board-game piece drops onto the lot.
  if (rules === 1 && !first) { L.piece = { t0: clockT + 0.5, t: clockT + 1.25, kind: owned.length >= OWN_GOAL ? 'hotel' : 'house', loud: true }; }
  else { L.born = clockT + 0.3; }
  if (ch && rules === 1) { ch.props = ch.props.filter(p => p.lotRef !== L); }
  if (rules === 1) {
    if (!first) { L.color = mixHex(L.color, OWNER_COL, 0.5); }
    // The people who lived here pack up and walk away down the street.
    movedOut += n;
    if (ch) {
      const r = rngN(L.seed + 11);
      const say = pickN(r, LEAVING);
      for (let k = 0; k < n + 1; k++) { ch.props.push({ kind: 'person', mover: true, box: k % 3 !== 2, x: L.side * (EDGE_X - 0.9 - (k % 2) * 0.45), z: mid - 1.5 + k * 0.9, tone: r(), h: mixN(1.5, 1.85, r()), ph: r() * 6, residentRank: 0, born: clockT - 5, until: clockT + 25, say: k === 0 ? say : null, sayT: clockT + 0.6 }); }
      // Everything else for sale on this block jumps in price, and the homes you own here are worth more.
      for (const M of ch.lots) { if (M.forSale) { M.priceK *= 1.15; } }
      // ...including the homes you own here, the one you just bought too: the bank will lend you more against them.
      for (const q of owned) { if (q.key && q.key.split(':')[1] === String(ch.slot) && q.zone === zone) { q.lift *= 1.07; } }
    }
    landlordMode = owned.length >= 2;
    evicted.push(familyOf(L)); lastBuyZ = Math.max(lastBuyZ, L.z1);
    soldBeat = { t: clockT, stamp: 'SOLD', col: [200, 50, 40], l1: 'You won a home. A family lost theirs.', l2: 'The city congratulates you.' };
    if (sound.evict) { setTimeout(() => sound.evict(), 350); }
  }
  preserveLot(L);
}
function endWalk(kind) {
  if (ending) { return; }
  ending = { kind, t: clockT }; sound.go(); baseNight = 0.25; nightTarget = baseNight;
}
function endWalkNow(kind) { ending = { kind, t: clockT }; sound.go(); baseNight = kind === 'rule1' ? 0.6 : 0.15; nightTarget = baseNight; }
function resetLife() {
  streetMemory.clear(); nameBox = null; sideSt = null; queuedTurn = 0; turnAnim = null; turnYaw = 0;
  lifeAge = START_AGE; zone = START_ZONE; market = 1; rentPaid = 0; rentBase = RENT_WEEK; rentWeek = rentFor(START_ZONE); home = null; ending = null; landlordMode = false;
  owned = []; rentIn = 0; movedOut = 0; walkedTotal = 0; emptyK = 1; evicted = []; lastBuyZ = 0; rentedAt = 0; boardT0 = clockT; treesCut = 0; builtCount = 0; homesBuilt = 0; towersBuilt = 0; shopsBuilt = 0; nextThought = 10;
  baseNight = 0; nightTarget = 0; ownedFromC = Infinity; intro = true; toasts.length = 0; soldBeat = null;
  chunks.clear(); firedCasinos.clear(); visitedJails.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
}
function restartWalk() { rules = 1; firstRun = null; seed += 97; startSeed = seed; resetLife(); }
// Her other rules, on the very same street.
function startRule2() {
  // The homes you bought, and the investors' towers, are still there in Round 2.
  const keep = [...streetMemory.entries()].filter(([, v]) => v.owned || v.sold);
  // Round 2 starts in the town of the first home you bought, and walks you past every home you bought there.
  const z0 = owned.length && owned[0].zone < ZONE_NAMES.length - 2 ? owned[0].zone : START_ZONE, slots = owned.filter(o => o.zone === z0 && o.key).map(o => Number(o.key.split(':')[1]));
  firstRun = { owned: owned.length, moved: movedOut, evicted: evicted.slice(), me: evicted[0] || 'The Nguyens', zone: z0, passZ: slots.length ? (Math.max(...slots) + 1) * CHUNK_LEN - 20 : -Infinity };
  rules = 2; if (startSeed !== null) { seed = startSeed; } resetLife(); night = 0; nightTarget = 0;
  zone = z0; rentWeek = rentFor(zone); buildSkyline();
  for (const [k, v] of keep) { streetMemory.set(k, v); }
}

/* ---------- Turning: left to a cheaper town further out, right to a richer one closer in ---------- */
function nextCrossing(z) { const local = modN(z, CHUNK_LEN); return local < CROSS_W - 1 ? 0 : CHUNK_LEN - local + 2; }
function atCrossing(z) { const local = modN(z, CHUNK_LEN); return local > 0.5 && local < CROSS_W - 0.5; }
// Pressing ← or → picks the next corner. From then on the town you are turning into is
// already there down the cross street. At the corner you turn on the spot, with no cut: the
// old town's corner buildings sink away while the new town's rise, and you walk on.
let sideSt = null;   // the side street: { chunks, zone, dir, zc (its crossing in this street), s0 (that crossing in its own street), c }
function tryTurn(dir) {
  if (turnAnim || intro || ending || nameBox) { return; }
  if (dir > 0 && zone === 0) { sayToast('Nowhere richer than this.'); return; }
  if (dir < 0 && zone === ZONE_NAMES.length - 1) { sayToast('Nowhere poorer than this.'); return; }
  const c = Math.floor(distanceWalked / CHUNK_LEN) + (modN(distanceWalked, CHUNK_LEN) < CROSS_W / 2 + 1 ? 0 : 1);
  queuedTurn = dir; makeSide(dir, c);
  const ahead = Math.max(0, c * CHUNK_LEN + CROSS_W / 2 - distanceWalked);
  sayToast(`${dir < 0 ? '←' : '→'} ${ZONE_NAMES[zone - dir]}`);
}
function makeSide(dir, c) {
  const zc = c * CHUNK_LEN + CROSS_W / 2;
  if (sideSt && sideSt.dir === dir && sideSt.c === c) { return; }
  sideSt = { chunks: new Map(), zone: zone - dir, dir, zc, s0: zc, c, t: clockT, turning: false, fromZ: zc + CROSS_W / 2 - 0.5, minLot: zc + 34 };
}
// The camera, seen from inside the side street's own coordinates.
function camInSide(w) {
  const dz = cam.z - w.zc;
  return { x: -dz * w.dir, z: w.s0 + cam.x * w.dir, yaw: cam.yaw - w.dir * HALF_PI };
}
// Draw (or update) the side street by swapping it in as the street for a moment.
function withSide(w, fn) {
  const keepChunks = [...chunks.entries()], keepZone = zone, keepCam = { x: cam.x, z: cam.z, yaw: cam.yaw };
  chunks.clear(); for (const [k, v] of w.chunks) { chunks.set(k, v); } zone = w.zone;
  const v = camInSide(w); cam.x = v.x; cam.z = v.z; cam.yaw = v.yaw;
  try { fn(v.z); }
  finally {
    w.chunks.clear(); for (const [k, ch] of chunks) { w.chunks.set(k, ch); }
    chunks.clear(); for (const [k, ch] of keepChunks) { chunks.set(k, ch); } zone = keepZone; Object.assign(cam, keepCam);
  }
}
function drawSideStreet() {
  if (!sideSt) { return; }
  withSide(sideSt, z2 => {
    for (let c = sideSt.c; c <= sideSt.c + 5; c++) {
      const fresh = !chunks.has(c), ch = chunkAt(c);
      // Most of the new town stands already; its first block waits for the turn and then rises.
      if (fresh) {
        for (const L of ch.lots) { if (L.z0 >= sideSt.minLot && !L.forSale) { L.born = clockT - 10; L.thud = true; } }
        for (const b of ch.back) { if (b.z0 >= sideSt.minLot) { b.born = clockT - 10; } }
        for (const p of ch.props) { if (p.z >= sideSt.minLot) { p.born = clockT - 10; } }
      }
    }
    drawGround(z2, sideSt); drawWorld(z2, sideSt);
  });
}
// Corner buildings of this street on the turning side make way for the side street.
function sinkCorner(k) {
  if (!sideSt) { return; }
  for (const ch of chunks.values()) {
    for (const L of ch.lots) { if (L.side === sideSt.dir && Math.abs((L.z0 + L.z1) / 2 - sideSt.zc) < 34) { L.sinkK = Math.min(L.sinkK === undefined ? 1 : L.sinkK, k); } }
    for (const b of ch.back) { if (b.side === sideSt.dir && b.z0 < sideSt.zc + 40 && b.z1 > sideSt.zc - 40) { b.sinkK = Math.min(b.sinkK === undefined ? 1 : b.sinkK, Math.max(0, 1 - (clockT - sideSt.t) / 1.2)); } }
  }
}
function updateTurn() {
  if (!turnAnim) {
    turnYaw = 0; fadeA = 0;
    if (sideSt) {
      sinkCorner(1);
      // Walk past the corner without turning, or back away from it, and the turn is called off.
      if (distanceWalked > sideSt.zc + CROSS_W || distanceWalked < sideSt.zc - 120) { cancelSide(); }
      else if (queuedTurn && Math.abs(distanceWalked - sideSt.zc) < 3.5) { turnAnim = { dir: sideSt.dir, t: clockT, z0: distanceWalked }; queuedTurn = 0; sound.turn(sideSt.dir); startCornerRise(); }
    }
    return;
  }
  // Turning on the spot: step to the middle of the crossing and swing round 90 degrees.
  const u = Math.min(1, (clockT - turnAnim.t) / 1.4), e = easeN(u);
  turnYaw = turnAnim.dir * HALF_PI * e; fadeA = 0;
  distanceWalked = mixN(turnAnim.z0, sideSt.zc, easeN(u * 1.6));
  sinkCorner(1 - easeN(u * 1.3));
  if (u >= 1) { finishTurn(); }
}
function startCornerRise() {
  sideSt.turning = true;
  withSide(sideSt, () => { for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.z0 < sideSt.minLot && !L.forSale) { L.born = clockT + 0.15 + (L.z0 - sideSt.zc) / 60; L.thud = false; } } for (const p of ch.props) { if (p.z < sideSt.minLot) { p.born = clockT + 0.4 + (p.z - sideSt.zc) / 60; } } for (const b of ch.back) { if (b.z0 < sideSt.minLot) { b.born = clockT + 0.5; } } } });
}
function cancelSide() {
  for (const ch of chunks.values()) { for (const L of ch.lots) { delete L.sinkK; } for (const b of ch.back) { delete b.sinkK; } }
  sideSt = null; queuedTurn = 0;
}
// The side street becomes the street: same view, new coordinates.
function finishTurn() {
  const w = sideSt, v = camInSide(w), dir = w.dir;
  turnAnim = null; turnYaw = 0; sideSt = null; queuedTurn = 0;
  chunks.clear(); for (const [k, ch] of w.chunks) { chunks.set(k, ch); }
  zone = w.zone; rentWeek = rentFor(zone);
  distanceWalked = v.z; cam.x = v.x;
  firedCasinos.clear(); visitedJails.clear();
  lastChunk = Math.floor(distanceWalked / CHUNK_LEN); lastTier = -1; ownedFromC = lastChunk + 1;
  stepSpeed = 0; dashTarget = null; streetT = clockT - 5; buildSkyline();
  sayToast(`${ZONE_NAMES[zone]} · ${TOWNS[zone].cls} · ${commuteShort(zone)}`);
}
function newStreet() {
  const c = Math.floor(distanceWalked / CHUNK_LEN);
  chunks.clear(); firedCasinos.clear(); visitedJails.clear(); sideSt = null;
  distanceWalked = c * CHUNK_LEN + 3; lastChunk = c; lastTier = -1; ownedFromC = c + 1;
  stepSpeed = 0; dashTarget = null; streetT = clockT; buildSkyline();
}

/* ---------- Drawing on the street ---------- */
function drawForSale(L) {
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + 1.4), base = P(x, 0, mid);
  if (base.rz < 1.5 || base.rz > FAR_Z * 0.8) { return; }
  const k = base.k, w = 3.4 * k, h = 1.9 * k, top = base.y - 3 * k;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(mid) * 0.8;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(base.x - 0.07 * k, top, 0.14 * k, 3 * k);
  ctx.fillStyle = '#fffaee'; ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = Math.max(1, 0.06 * k);
  ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  ctx.fillStyle = rules === 2 && rentAsk(L) <= RENT_BUDGET ? '#3f6fa8' : '#c8322a'; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h * 0.34);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const r2 = rules === 2;
    ctx.font = `bold ${h * 0.2}px Georgia, serif`; ctx.fillStyle = '#fff'; ctx.fillText(r2 ? 'FOR RENT' : 'FOR SALE', base.x, top - h * 0.2 + h * 0.17);
    ctx.font = `bold ${h * 0.27}px Georgia, serif`; ctx.fillStyle = '#2a1e18'; ctx.fillText(r2 ? `${money(rentAsk(L))}/wk` : moneyK(priceOf(L)), base.x, top - h * 0.2 + h * 0.52);
    ctx.font = `${h * 0.15}px Georgia, serif`; ctx.fillStyle = '#7a5a4a'; ctx.fillText(r2 ? (L.applicants ? `${L.applicants} applied` : 'apply now') : 'a lovely family home', base.x, top - h * 0.2 + h * 0.8);
  }
  ctx.restore();
}
// A street sign at each crossing: left to a cheaper town, right to a richer one.
function drawTurnSign(q, p) {
  const k = q.k; if (k < 3) { return; }
  const w = 3.4 * k, h = 0.55 * k, top = q.y - 3.4 * k, out = zone < ZONE_NAMES.length - 1 ? ZONE_NAMES[zone + 1] : null, inn = zone > 0 ? ZONE_NAMES[zone - 1] : null;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = '#3a4a3a'; ctx.fillRect(q.x - 0.06 * k, top - 0.2 * k, 0.12 * k, 3.6 * k);
  const plate = (y, text, col, left) => {
    ctx.fillStyle = col; ctx.beginPath(); const x0 = left ? q.x - w : q.x, tip = left ? x0 : x0 + w;
    ctx.moveTo(left ? x0 + h * 0.5 : x0, y); ctx.lineTo(left ? x0 + w : x0 + w - h * 0.5, y); ctx.lineTo(left ? x0 + w : tip, y + h / 2); ctx.lineTo(left ? x0 + w : x0 + w - h * 0.5, y + h); ctx.lineTo(left ? x0 + h * 0.5 : x0, y + h); ctx.lineTo(left ? tip : x0, y + h / 2); ctx.closePath(); ctx.fill();
    if (k > 8) { ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.42}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, left ? q.x - w / 2 + h * 0.2 : q.x + w / 2 - h * 0.2, y + h / 2 + 1, w * 0.85); }
  };
  if (out) { plate(top, `${out} · ${commuteShort(zone + 1)}`, '#3f8fd6', true); }
  if (inn) { plate(top + h * 1.2, `${inn} · ${commuteShort(zone - 1)}`, '#c8322a', false); }
  ctx.restore();
}
// The satire drawn onto the buildings themselves (called from drawLot, inside the rise scope).
// Empty investor towers get a red neon sign: 0 AFFORDABLE.
function satireOnLot(L, x, z0, z1, H) {
  if (L.special || L.piece || intro) { return; }
  if (L.vacant) {
    const on = Math.sin(clockT * 3 + L.seed) > -0.6;
    facadeSign(L, x, z0, L.z0 + (L.z1 - L.z0) * 0.25, L.z1 - (L.z1 - L.z0) * 0.25, H * 0.3, H * 0.3 + 1.6, on ? '#2a0a0a' : '#1a1414', on ? '#ff4a3a' : '#5a2a2a', 'FORMERLY: FOREST', on ? '#ff3020' : null);
    return;
  }
  // (Homes no longer wear price tags: the street had too much on it.)
}
// People queueing for an open home.
function drawOpenHome(q, p) {
  const k = q.k; if (k < 2 || emptyK < 0.7 || (rules === 1 && movedOut >= 6)) { return; }
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(q.x - 0.05 * k, q.y - 2.6 * k, 0.1 * k, 2.6 * k);
  ctx.fillStyle = '#c8322a'; ctx.fillRect(q.x - 1 * k, q.y - 2.6 * k, 2 * k, 0.8 * k);
  if (k > 14) { ctx.fillStyle = '#fff'; ctx.font = `bold ${0.32 * k}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OPEN HOME', q.x, q.y - 2.32 * k); ctx.font = `${0.2 * k}px Georgia, serif`; ctx.fillText(`${p.n * 4} registered`, q.x, q.y - 2.02 * k); }
  ctx.restore();
}
// A slogan painted straight onto a wall by hand, in red, with drips: the artwork talking.
function paintSlogan(L, x, z0, H) {
  if (!L.art || L.owned || L.vacant || L.piece) { return; }
  const za = Math.max(L.z0 + 0.4, z0), zb = L.z1 - 0.4; if (zb <= za + 1.5) { return; }
  const ya = Math.max(0.6, H * 0.28), yb = Math.min(H * 0.92, ya + Math.max(1.5, Math.min(4, (zb - za) * 0.3)));
  const q = wallQuad(x - L.side * 0.06, za, x - L.side * 0.06, zb, ya, yb);
  if (q.some(p => p.rz < CLIP_Z) || Math.abs(q[1].x - q[0].x) < 10) { return; }
  const h = 60, w = h * (zb - za) / (yb - ya);
  ctx.save(); ctx.globalAlpha = 1 - fogFor((za + zb) / 2) * 0.75;
  const o = L.side < 0 ? q[3] : q[2], ex = L.side < 0 ? q[2] : q[3], ey = L.side < 0 ? q[0] : q[1];
  ctx.transform((ex.x - o.x) / w, (ex.y - o.y) / w, (ey.x - o.x) / h, (ey.y - o.y) / h, o.x, o.y);
  // Fit the words into one or two painted lines.
  let size = 30, lines = [];
  for (let tries = 0; tries < 8; tries++) {
    ctx.font = `bold ${size}px "Marker Felt", "Permanent Marker", Impact, sans-serif`; lines = []; let line = '';
    for (const wd of L.art.split(' ')) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w * 0.9 && line) { lines.push(line); line = wd; } else { line = t; } }
    lines.push(line); if (lines.length <= 2) { break; } size *= 0.85;
  }
  const r = rngN(L.seed + 41), lh = size * 1.05, y0 = h / 2 - (lines.length - 1) * lh / 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  lines.forEach((ln, i) => {
    const ly = y0 + i * lh, tw = ctx.measureText(ln).width;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = size * 0.16; ctx.strokeText(ln, w / 2, ly);
    ctx.fillStyle = '#d81e1e'; ctx.fillText(ln, w / 2, ly);
    // Paint running down from the letters.
    for (let d = 0; d < 6; d++) { const dx = w / 2 - tw / 2 + r() * tw, dl = size * (0.15 + r() * 0.5); ctx.fillRect(dx, ly + size * 0.32, size * 0.05, dl); }
  });
  ctx.restore();
}
// Monopoly's view of a home: a plastic piece on a coloured square. The real house sinks first.
const PIECE_COL = { house: '#1fb04a', hotel: '#e0302a', grey: '#a29d94' };
function toyTone(col, z, k) { return mixHex(toneN(col, z, k), shadeN(col, k), 0.6); }   // plastic keeps its colour through the haze
function pieceSink(L) { const pc = L.piece; return pc ? 1 - easeN((clockT - pc.t0) / 0.7) : 1; }
function drawBoardSquare(L) {
  const pc = L.piece, a = easeN((clockT - pc.t0) / 0.5); if (a <= 0) { return; }
  const z0 = clipZ(L.z0 + 0.3), z1 = L.z1 - 0.3; if (z1 <= z0) { return; }
  const xa = L.side * (EDGE_X + 0.2), xb = L.side * (EDGE_X + Math.max(6, L.setback + L.depth * 0.95)), xs = L.side * (EDGE_X + 1.6), mz = midN(z0, z1);
  polyN([P(xa, 0.06, z0), P(xb, 0.06, z0), P(xb, 0.06, z1), P(xa, 0.06, z1)], rgbaN(mixHex('#e9efe0', '#3a3448', night * 0.5), a * (1 - fogFor(mz) * 0.7)), rgbaN('#2a2420', 0.6 * a), 1.5);
  polyN([P(xa, 0.07, z0), P(xs, 0.07, z0), P(xs, 0.07, z1), P(xa, 0.07, z1)], rgbaN(pc.kind === 'grey' ? '#8a857e' : deedCol(L), a * (1 - fogFor(mz) * 0.7)), rgbaN('#2a2420', 0.6 * a), 1.5);
}
function drawToyPiece(L) {
  const pc = L.piece; if (clockT < pc.t - 0.55 || (L.sinkK !== undefined && L.sinkK < 0.5)) { return; }
  const u = constrain((clockT - pc.t + 0.55) / 0.55, 0, 1), land = clockT - pc.t;
  if (land >= 0 && !pc.hit) { pc.hit = true; if (pc.loud && sound.clack) { sound.clack(pc.kind); } }
  const squash = land > 0 && land < 0.3 ? 1 - Math.sin(land / 0.3 * PI) * 0.16 : 1, y0 = (1 - u * u) * 24;
  const hotel = pc.kind === 'hotel', len = L.z1 - L.z0;
  const pl = Math.min(len * 0.85, hotel ? 18 : 10), d = hotel ? 9 : 8.5, mid = (L.z0 + L.z1) / 2, za = mid - pl / 2, zb = mid + pl / 2;
  const x = L.side * (EDGE_X + 2.4), xo = x + L.side * d, xm = (x + xo) / 2;
  const hb = (hotel ? 9 : 7) * squash, apex = hb + (hotel ? 3 : 5) * squash, z0 = clipZ(za); if (zb <= z0) { return; }
  const col = PIECE_COL[pc.kind], edge = 'rgba(20,14,10,0.45)', mz = midN(z0, zb);
  if (u > 0.2) { const sh = 0.4 * u; polyN([P(x, 0.08, z0), P(xo + L.side * 1.2, 0.08, z0), P(xo + L.side * 1.2, 0.08, zb + 1), P(x, 0.08, zb + 1)], `rgba(20,14,10,${sh * (1 - fogFor(mz))})`); }
  polyN(wallQuad(x, z0, x, zb, y0, y0 + hb), toyTone(col, mz, 0.95), edge, 1.2);
  polyN(wallQuad(x - L.side * 0.03, z0, x - L.side * 0.03, zb, y0, y0 + hb * 0.12), 'rgba(0,0,0,0.18)');
  polyN(wallQuad(x - L.side * 0.03, z0, x - L.side * 0.03, zb, y0 + hb * 0.74, y0 + hb * 0.84), 'rgba(255,255,255,0.3)');
  if (za > cam.z + NEAR_Z) { polyN([P(x, y0, za), P(xo, y0, za), P(xo, y0 + hb, za), P(xm, y0 + apex, za), P(x, y0 + hb, za)], toyTone(col, za, 0.62), edge, 1.2); }
  polyN([P(x, y0 + hb, z0), P(x, y0 + hb, zb), P(xm, y0 + apex, zb), P(xm, y0 + apex, z0)], toyTone(col, mz, 1.2), edge, 1.2);
  const ra = 0.5, rb = 0.68, hx = (t) => mixN(x, xm, t), hy = (t) => y0 + mixN(hb, apex, t);
  polyN([P(hx(ra), hy(ra), z0), P(hx(ra), hy(ra), zb), P(hx(rb), hy(rb), zb), P(hx(rb), hy(rb), z0)], 'rgba(255,255,255,0.32)');
}


// People on the pavement: residents, queues, people moving out with their boxes, new neighbours.
// People on the street notice you. What they say depends on whose home it is, the rules,
// and how many homes you already own.
let talkT = -9;
const SAY = {
  family1: ['Are you buying our house?', 'We could never afford to buy it.', 'Please… we’ve got nowhere else.', 'The kids grew up here.'],
  family2: ['Come and have a look!', 'Buy it, we’re staying either way.', 'You’ll like the neighbours.'],
  renter: ['Looking for a place too?', 'Rent went up again.', 'Good luck. Everything’s so dear.', 'Forty people at the last inspection.'],
  wary: ['You’re the one buying everything.', 'Are you our new landlord?', 'My landlord sold up last week.', 'We’re next, aren’t we?'],
  cold: ['Landlord.', 'Don’t buy ours too.', 'Happy now?', 'There used to be kids on this street.'],
  moving: ['Priced out too?', 'Forty people at the last inspection.', 'Our landlord sold up as well.', 'Try further out. That’s what we did.', 'Need a hand with that box?'],
  shared: ['Morning, neighbour!', 'The kids play outside again.', 'Nice to have you here.', 'The land tax fixed the park.']
};
function moodN() { return rules === 2 ? 'moving' : owned.length === 0 ? 'renter' : owned.length < 3 ? 'wary' : 'cold'; }
function noticeYou(q, p) {
  if (p.mover || p.arrive || p.talked || intro || ending || turnAnim) { return; }
  const dz = p.z - distanceWalked; if (dz < 1.5 || dz > 8 || q.k < 3 || q.x < 40 || q.x > width - 40) { return; }
  if (clockT - talkT < 3.2) { return; }
  p.talked = true; if (!p.lotRef) { return; }
  const pool = p.lotRef ? SAY.family1 : SAY[moodN()];
  p.say = pool[Math.floor(Math.random() * pool.length)]; p.sayT = clockT; p.mood = p.lotRef ? (rules === 1 ? 'sad' : 'warm') : moodN(); talkT = clockT;
  if (sound && sound.enabled && sound.context && sound._note) { const t = sound.context.currentTime, warm = p.mood === 'shared' || p.mood === 'renter' || p.mood === 'warm' || p.mood === 'moving'; sound._note(warm ? 620 : 300, t, 0.12, 'triangle', 0.03); sound._note(warm ? 780 : 260, t + 0.1, 0.16, 'triangle', 0.03); }
}
function drawPerson(q, p) {
  const k = q.k; if (k < 1.5) { return; }
  noticeYou(q, p);
  const looking = p.say && !p.mover && clockT > p.sayT && clockT < p.sayT + 6;
  const h = p.h, walking = p.mover || p.arrive, sway = Math.sin(clockT * 1.5 + p.ph) * 0.03 * k, step = walking ? Math.sin(p.ph * 2) * 0.12 * k : 0;
  const coats = ['#3f5a7a', '#7a3f4a', '#4a6a4a', '#8a6a3a', '#5a4a6a', '#2a3a4a', '#9a5a3a'], skin = ['#e8c4a0', '#c8946a', '#8a5a3a', '#f0d0b0'];
  ctx.save(); ctx.globalAlpha = (1 - fogFor(p.z) * 0.8) * (p.mover ? Math.min(1, (p.until - clockT) / 3) : 1);
  ctx.fillStyle = 'rgba(30,20,10,0.22)'; ctx.beginPath(); ctx.ellipse(q.x + 0.15 * k, q.y, 0.42 * k, 0.1 * k, 0, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = toneN('#2a2a30', p.z); ctx.fillRect(q.x - 0.14 * k + step, q.y - 0.8 * k, 0.11 * k, 0.8 * k); ctx.fillRect(q.x + 0.03 * k - step, q.y - 0.8 * k, 0.11 * k, 0.8 * k);
  ctx.fillStyle = toneN(coats[Math.floor(p.tone * coats.length)], p.z);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(q.x - 0.24 * k + sway, q.y - (h - 0.25) * k, 0.48 * k, (h - 1.05) * k, 0.12 * k) : ctx.rect(q.x - 0.24 * k + sway, q.y - (h - 0.25) * k, 0.48 * k, (h - 1.05) * k); ctx.fill();
  ctx.fillStyle = toneN(skin[Math.floor(p.tone * 7) % skin.length], p.z); ctx.beginPath(); ctx.arc(q.x + sway, q.y - (h - 0.12) * k, 0.13 * k, 0, TWO_PI); ctx.fill();
  if (looking && k > 6) {
    // They turn to look at you: eyes, and a wave if they are friendly, arms folded if not.
    const hx = q.x + sway, hy2 = q.y - (h - 0.1) * k, cold = p.mood === 'wary' || p.mood === 'cold';
    ctx.fillStyle = '#2a1e18';
    if (cold) { ctx.fillRect(hx - 0.07 * k, hy2 - 0.01 * k, 0.05 * k, 0.015 * k + 1); ctx.fillRect(hx + 0.02 * k, hy2 - 0.01 * k, 0.05 * k, 0.015 * k + 1); }
    else { ctx.beginPath(); ctx.arc(hx - 0.045 * k, hy2, 0.018 * k + 0.5, 0, TWO_PI); ctx.arc(hx + 0.045 * k, hy2, 0.018 * k + 0.5, 0, TWO_PI); ctx.fill(); }
    ctx.strokeStyle = toneN(coats[Math.floor(p.tone * coats.length)], p.z); ctx.lineCap = 'round'; ctx.lineWidth = Math.min(8, 0.12 * k);
    ctx.beginPath();
    if (p.mood === 'shared' || p.mood === 'renter' || p.mood === 'warm' || p.mood === 'moving') { const wv = Math.sin(clockT * 9) * 0.12 * k; ctx.moveTo(hx + 0.22 * k, q.y - (h - 0.35) * k); ctx.lineTo(hx + 0.42 * k + wv, q.y - (h + 0.2) * k); }
    else { ctx.moveTo(hx - 0.22 * k, q.y - (h - 0.6) * k); ctx.lineTo(hx + 0.22 * k, q.y - (h - 0.7) * k); }
    ctx.stroke(); ctx.lineCap = 'butt';
  }
  if (p.box) {
    // A moving box held in front, taped across the top.
    const bw = 0.62 * k, bh = 0.46 * k, by = q.y - (h - 0.55) * k;
    ctx.fillStyle = toneN('#c09060', p.z); ctx.fillRect(q.x - bw / 2 + sway, by, bw, bh);
    ctx.fillStyle = toneN('#e8d8b0', p.z); ctx.fillRect(q.x - bw / 2 + sway, by + bh * 0.08, bw, bh * 0.14);
    ctx.strokeStyle = toneN('#7a5a3a', p.z); ctx.lineWidth = Math.max(1, 0.03 * k); ctx.strokeRect(q.x - bw / 2 + sway, by, bw, bh);
  } else if (p.tone > 0.6 && !walking) { ctx.fillStyle = '#e8e8f0'; ctx.fillRect(q.x + 0.15 * k + sway, q.y - (h - 0.55) * k, 0.12 * k, 0.2 * k); }   // a phone, checking listings
  ctx.restore();
  if (p.say && clockT > p.sayT && clockT < p.sayT + 6 && k > 2.5) { speechBubble(q.x + sway, q.y - (h + 0.25) * k, p.say, Math.min(1, (clockT - p.sayT) / 0.3, (p.sayT + 6 - clockT) / 0.5), p.mover || p.mood === 'sad' || p.mood === 'wary' || p.mood === 'cold' ? '#c8322a' : SHARE_COL); }
}
// What a person says, in a white bubble above their head.
function speechBubble(x, y, txt, a, col) {
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.font = 'italic 15px Georgia, serif';
  const w = ctx.measureText(txt).width + 24, h = 30, bx = Math.max(8, Math.min(width - w - 8, x - w / 2)), by = y - h - 10;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx + 3, by + 4, w, h);
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, w, h, 12) : ctx.rect(bx, by, w, h); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 7, by + h - 1); ctx.lineTo(x, by + h + 9); ctx.lineTo(x + 7, by + h - 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a1e18'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx + w / 2, by + h / 2 + 1);
  ctx.restore();
}
// Rule 1: the street loses its colour as its families are moved out.
function drawStreetLife() {
  const a = 0.3 + (1 - streetLife()) * 0.8;
  ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = a; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, width, height); ctx.restore();
}
// Small icons for the HUD and the opening card.
function houseIcon(x, y, sz, col, filled) {
  push(); stroke(col); strokeWeight(Math.max(1.5, sz * 0.09)); if (filled) { fill(col); } else { noFill(); }
  beginShape(); vertex(x, y + sz); vertex(x, y + sz * 0.45); vertex(x + sz * 0.5, y); vertex(x + sz, y + sz * 0.45); vertex(x + sz, y + sz); endShape(CLOSE);
  if (filled) { noStroke(); fill(255, 250, 238); rect(x + sz * 0.38, y + sz * 0.62, sz * 0.24, sz * 0.38); }
  pop();
}
function personIcon(x, y, sz, col, box) {
  push(); noStroke(); fill(col); circle(x + sz * 0.5, y + sz * 0.18, sz * 0.36); rect(x + sz * 0.22, y + sz * 0.4, sz * 0.56, sz * 0.6, sz * 0.15);
  if (box) { fill('#c09060'); rect(x + sz * 0.05, y + sz * 0.5, sz * 0.9, sz * 0.4); }
  pop();
}
function iconRow(x, y, n, max, sz, drawOne) { let i = 0; for (; i < Math.min(n, max); i++) { drawOne(x + i * (sz + 4), y); } if (n > max) { fill(200, 50, 40); textSize(12); textAlign(LEFT, CENTER); text(`+${n - max}`, x + i * (sz + 4) + 2, y + sz / 2); } }
// A bed of flowers in front of a shared-street home.
function drawFlowers(q, p) {
  const k = q.k; if (k < 2) { return; }
  const r = rngN(p.seed), cols = ['#ff7aa8', '#ffd23f', '#ff9a4a', '#c88aff', '#ffffff', '#ff5a6a'];
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = toneN('#5a8a3a', p.z); ctx.beginPath(); ctx.ellipse(q.x, q.y, 1.6 * k, 0.35 * k, 0, 0, TWO_PI); ctx.fill();
  for (let i = 0; i < 18; i++) {
    const fx = q.x + (r() - 0.5) * 2.8 * k, hh = (0.25 + r() * 0.45) * k, fy = q.y - hh + (r() - 0.5) * 0.3 * k;
    ctx.strokeStyle = toneN('#3f7a3a', p.z); ctx.lineWidth = Math.max(1, 0.04 * k); ctx.beginPath(); ctx.moveTo(fx, q.y); ctx.lineTo(fx, fy); ctx.stroke();
    ctx.fillStyle = toneN(cols[Math.floor(r() * cols.length)], p.z); ctx.beginPath(); ctx.arc(fx, fy, Math.max(1.5, 0.12 * k), 0, TWO_PI); ctx.fill();
  }
  ctx.restore();
}
// The sign outside a home you own and rent out.
function drawYours(L) {
  if (!L.owned) { return; }
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + 1.4), base = P(x, 0, mid);
  if (base.rz < 1.5 || base.rz > FAR_Z * 0.8) { return; }
  const k = base.k, w = 3.4 * k, h = 1.6 * k, top = base.y - 3 * k, o = owned.find(q => q.key === L.memoryKey);
  ctx.save(); ctx.globalAlpha = 1 - fogFor(mid) * 0.8;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(base.x - 0.07 * k, top, 0.14 * k, 3 * k);
  ctx.fillStyle = '#2a1e18'; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h);
  ctx.strokeStyle = rules === 1 ? OWNER_COL : '#c8322a'; ctx.lineWidth = Math.max(1, 0.08 * k); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${h * 0.26}px Georgia, serif`; ctx.fillStyle = rules === 1 ? '#ffe9a8' : '#ffc8c0'; ctx.fillText(rules === 2 ? 'OWNED BY YOU' : L.home ? 'YOUR HOME' : 'YOURS · LET', base.x, top - h * 0.2 + h * 0.3);
    if (o && !L.home && rules === 1) { ctx.font = `${h * 0.2}px Georgia, serif`; ctx.fillStyle = '#e8dcc8'; ctx.fillText(`tenant pays ${money(rentOf(o) / 52)}/wk`, base.x, top - h * 0.2 + h * 0.66, w * 0.9); }
  }
  ctx.restore();
}

/* ---------- HUD ---------- */
function drawBoardHud() {
  const z = distanceWalked;
  push(); textFont('Georgia');
  if (!intro && !ending) {
    // The scoreboard, top left: what the forest has lost, and what you have built.
    const x = 16, y = 16, w = Math.min(400, width * 0.5), h = 112;
    noStroke(); fill(0, 55); rect(x + 3, y + 4, w, h, 10); fill(255, 250, 238); rect(x, y, w, h, 10);
    fill('#2f6a3a'); rect(x, y, w, 26, 10, 10, 0, 0);
    fill(255); textStyle(BOLD); textSize(12); textAlign(LEFT, CENTER); text('WE BUILD OUR WORLD', x + 14, y + 13);
    const half = (w - 28) / 2, ax = x + 14, bx = x + 14 + half + 8;
    textAlign(LEFT, TOP); textStyle(BOLD); textSize(34); fill('#2f6a3a'); text(treesCut, ax, y + 32); const aw = textWidth(String(treesCut)) + 8;
    textSize(11); fill(60, 45, 36); text('TREES YOU CUT DOWN', ax + aw, y + 38, half - aw);
    textSize(34); fill(60, 60, 70); text(builtCount, bx, y + 32); const bw = (textSize(34), textWidth(String(builtCount))) + 8;
    textSize(11); fill(60, 45, 36); text('BUILDINGS YOU BUILT', bx + bw, y + 38, half - bw);
    stroke(220, 205, 190); strokeWeight(1); line(x + 14 + half + 2, y + 34, x + 14 + half + 2, y + 74); noStroke();
    // Nature to city, as a bar: how built-up the street around you is.
    const dev = sound && sound.devSmooth !== undefined ? sound.devSmooth : 0, by = y + 86, bw2 = w - 28;
    fill('#3f7a3a'); rect(x + 14, by, bw2, 8, 4); fill(90, 90, 100); rect(x + 14 + bw2 * (1 - dev), by, bw2 * dev, 8, 0, 4, 4, 0);
    textSize(9); textStyle(BOLD); fill(63, 122, 58); text('NATURE', x + 14, by + 11); textAlign(RIGHT, TOP); fill(90, 90, 100); text('CITY', x + 14 + bw2, by + 11); textStyle(NORMAL);
    const beat = soldBeat && clockT - soldBeat.t < 2.4;
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i], a2 = clockT - t.t; if (a2 > 4.2) { toasts.splice(i, 1); continue; }
      drawingContext.globalAlpha = easeN(a2 / 0.3) * (1 - easeN((a2 - 3.6) / 0.6));
      textStyle(ITALIC); textSize(16); fill(255); stroke(0, 140); strokeWeight(3); textAlign(CENTER, CENTER); text(t.text, width / 2, height - 146 - (toasts.length - 1 - i) * 26);
      noStroke(); drawingContext.globalAlpha = 1; textStyle(NORMAL);
    }
    if (!beat) { drawNextBar(); }
    // What the street sounds like, bottom left.
    if (sound && sound.style && typeof MUSIC_NAME !== 'undefined') {
      const on = sound.enabled && sound.context && sound.context.state === 'running', label = on ? `♪  ${MUSIC_NAME[sound.style]}` : '♪  Click for sound';
      textStyle(BOLD); textSize(12); const lw = textWidth(label) + 24; noStroke(); fill(0, 60); rect(16 + 2, height - 46 + 3, lw, 26, 13); fill(sound.style === 'rich' ? color(212, 160, 23) : sound.style === 'poor' ? color(110, 100, 96) : sound.style === 'city' ? color(200, 40, 120) : color(63, 143, 214)); rect(16, height - 46, lw, 26, 13);
      fill(255); textAlign(LEFT, CENTER); text(label, 28, height - 33); textStyle(NORMAL);
    }
  }
  if (!intro && !ending) { drawSoldBeat(); }
  if (!intro) { drawHandPanel(); }
  if (intro) { drawOpening(); }
  if (ending && ending.kind === 'built') {
    const lines = [`You cut down ${treesCut} trees.`, `You built ${homesBuilt} homes, ${shopsBuilt} shops and ${towersBuilt} towers.`, 'Listen: the birds have stopped.', '', 'Every city was a forest once.', 'We build our world the way we want it.', 'Nobody asks the forest.'];
    storyCard('THE WORLD WE WANTED', lines, clockT - ending.t > 4 ? 'F: keep building   ·   R: start again' : '', easeN((clockT - ending.t - 2) / 1.2), '#2f6a3a');
  }
  pop();
  if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,236,200,${fadeA * 0.85})`; ctx.fillRect(0, 0, width, height); }
}
// The first thing anyone sees: what this is, what to do, and what it costs, in three lines.
function drawOpening() {
  const col = '#2f6a3a', pulse = 0.5 + 0.5 * Math.sin(clockT * 4);
  push(); noStroke(); fill(10, 20, 12, 130); rect(0, 0, width, height);
  const w = Math.min(600, width - 32), h = 340, x = width / 2 - w / 2, y = Math.max(12, height / 2 - h / 2), cx = width / 2;
  fill(0, 60); rect(x + 4, y + 6, w, h, 12); fill(250, 252, 244); rect(x, y, w, h, 12); fill(col); rect(x, y, w, 34, 12, 12, 0, 0);
  fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(12); text('AN INTERACTIVE ARTWORK · A GENERATIVE LANDSCAPE', cx, y + 17);
  fill(30, 40, 30); textSize(36); text('WE BUILD OUR WORLD', cx, y + 70);
  textStyle(ITALIC); textSize(16); fill(90, 100, 85); const tag = 'Everything here is forest. Make it the world you want.'; textSize(Math.min(16, 16 * (w - 40) / textWidth(tag))); text(tag, cx, y + 102); textStyle(BOLD);
  // The three moves.
  const rows = [['L  R', 'Swing your left / right hand: cut the forest on that side'], ['✋ ↑', 'Lift an open hand: homes'], ['☝ ↑', 'Lift a pointing finger: shops'], ['✊ ↑', 'Lift a fist: towers']];
  rows.forEach(([k, label], i) => { const ry = y + 126 + i * 32; textSize(15); const kw = 62; fill(255); stroke(90, 100, 85); strokeWeight(1.5); rect(x + 40, ry, kw, 28, 6); noStroke(); fill(30, 40, 30); textAlign(CENTER, CENTER); text(k, x + 40 + kw / 2, ry + 14); textAlign(LEFT, CENTER); textStyle(NORMAL); textSize(16); text(label, x + 40 + kw + 16, ry + 14); textStyle(BOLD); });
  textAlign(CENTER, CENTER); textStyle(ITALIC); textSize(12); fill(110, 120, 105); text('Press H to use your hands with the camera.   ↑ walks, as far as you like.', cx, y + 268); text('F when you are finished.   No camera: Z / X cut, hold B homes · V shops · N towers.', cx, y + 286);
  textStyle(BOLD); textSize(16); fill(col); drawingContext.globalAlpha = 0.55 + 0.45 * pulse; text('Click or press E to start', cx, y + h - 26); drawingContext.globalAlpha = 1;
  pop();
}
// Round 2: you carry your things in a moving box, in front of you as you walk.
function drawCarryBox() {
  const w = Math.min(340, width * 0.38), h = w * 0.55, walk = Math.min(1, Math.abs(stepSpeed));
  const bob = Math.abs(Math.sin(stepPhase)) * 7 * walk, x = width / 2 - w / 2 + Math.sin(stepPhase * 0.5) * 4 * walk, y = height - h * 0.8 + bob;
  push(); noStroke();
  fill(0, 45); rect(x + 10, y + 12, w, h, 4);
  fill('#c39565'); rect(x, y, w, h, 4);
  fill('#a8784a'); rect(x, y, w, h * 0.14, 4, 4, 0, 0);
  fill('#e8d8b0'); rect(x, y + h * 0.14, w, h * 0.08);
  // Written on the box in marker: whose things these are.
  fill(70, 45, 30); textFont('Georgia'); textStyle(BOLD); textAlign(CENTER, CENTER);
  const label = 'EVERYTHING WE OWN'; textSize(w * 0.08); textSize(Math.min(w * 0.08, w * 0.08 * (w * 0.78) / textWidth(label))); text(label, x + w / 2, y + h * 0.36);
  textStyle(NORMAL); textSize(w * 0.05); text('this side up', x + w / 2, y + h * 0.5);
  fill('#d9a882'); ellipse(x + w * 0.03, y + h * 0.4, w * 0.12, w * 0.19); ellipse(x + w * 0.97, y + h * 0.4, w * 0.12, w * 0.19);
  pop();
}
// Just after you buy: a stamp, and the name of who had to leave (or who moved in).
// Your homes go up in value every second, so the bank will lend you more: coins fly from each
// home you own to your money, and the number ticks up while you stand there.
const YEAR_M = 240; let lastWalkZ = 0;   // half a lap (48 m x 10 / 2) is a year
function drawSoldBeat() {
  if (!soldBeat) { return; }
  const dur = soldBeat.dur || 4, age = clockT - soldBeat.t; if (age > dur) { soldBeat = null; return; }
  const a = Math.min(1, age / 0.15, (dur - age) / 0.6), pop0 = 1 + Math.max(0, 0.4 - age) * 1.5, cx = width / 2, cy = height * 0.36;
  push(); drawingContext.globalAlpha = a; translate(cx, cy); rotate(-0.08); scale(pop0);
  const col = color(...soldBeat.col); textFont('Georgia'); textStyle(BOLD); textSize(46); const sw = textWidth(soldBeat.stamp) + 60;
  noFill(); stroke(col); strokeWeight(5); rect(-sw / 2, -36, sw, 72, 8);
  noStroke(); fill(col); textAlign(CENTER, CENTER); text(soldBeat.stamp, 0, 2);
  pop(); push(); drawingContext.globalAlpha = a; textFont('Georgia'); textAlign(CENTER, CENTER);
  textStyle(BOLD); textSize(20); const tw = Math.max(textWidth(soldBeat.l1), (textSize(14), textWidth(soldBeat.l2))) + 40; textSize(20);
  noStroke(); fill(30, 20, 16, 200); rect(cx - tw / 2, cy + 52, tw, 58, 10); fill(255); text(soldBeat.l1, cx, cy + 70); textStyle(ITALIC); textSize(14); fill(255, 220, 200); text(soldBeat.l2, cx, cy + 94);
  pop();
}
function storyCard(title, lines, foot, a = 1, col = '#c8322a') {
  if (a <= 0.001) { return; }
  push(); drawingContext.globalAlpha = a; noStroke();
  fill(20, 14, 10, 120); rect(0, 0, width, height);
  const w = Math.min(580, width - 32), h = 110 + lines.length * 26, x = width / 2 - w / 2, y = height / 2 - h / 2;
  fill(255, 250, 238); rect(x, y, w, h, 10); fill(col); rect(x, y, w, 46, 10, 10, 0, 0);
  fill(255); textStyle(BOLD); textSize(18); textAlign(CENTER, CENTER); text(title, width / 2, y + 23);
  textStyle(NORMAL); textSize(15); fill(40, 30, 24); textAlign(CENTER, TOP);
  const story = lines.indexOf('');
  lines.forEach((ln, i) => { if (story >= 0 && i > story) { textStyle(ITALIC); fill(110, 90, 80); } text(ln, x + 20, y + 62 + i * 26, w - 40); });
  textAlign(CENTER, CENTER);
  textStyle(BOLD); fill(col); textSize(14); text(foot, width / 2, y + h - 24);
  pop();
}


/* ---------- The board: the opening dive, and the city seen from above at the end ---------- */
// A board of 40 squares in the order of the towns, cheap to dear from GO. The opening starts
// above it and dives into the Leafy Suburbs square, which becomes the street. At the end the
// camera rises out of the street and the whole city is a board again.
const BOARD_ZONE_COL = ['#8a4a9a', '#2e9e47', '#d4a017', '#3f8fd6', '#e06a9a', '#8b5a2b'];
const BOARD_CELLS = [
  'GO', 5, 5, 'RENT UP', 5, 5, 'LEASE ENDS', 4, 4, 4,
  'PUSHED OUT', 4, 'INSPECTION', 3, 3, 'RENT UP', 3, 3, 3, 'NO KIDS',
  'WAITING LIST', 2, 2, 'RENT UP', 2, 2, 1, 1, 'BIDDING WAR', 1,
  'EVICTED', 0, 0, 'INVESTOR', 0, 'VACANT', 'VACANT', 'INVESTOR', 'VACANT', 'VACANT'
];
let boardT0 = 0;   // when the opening dive started
function cellXY(i) {
  // Board units: the board is 1100 x 1100, each square 100. GO is the bottom-right corner, play runs clockwise.
  if (i <= 10) { return [1000 - i * 100, 1000]; }
  if (i <= 20) { return [0, 1000 - (i - 10) * 100]; }
  if (i <= 30) { return [(i - 20) * 100, 0]; }
  return [1000, (i - 30) * 100];
}
function firstCell(zn) { return BOARD_CELLS.indexOf(zn); }
function boardIntroOn() { return false; }
// mode: 'intro' (colourful, homes on every square), 'won' (grey, sold, only your pieces), 'out' (your path out to The Fringe)
function drawBoardScene(mode, zoomK, alpha) {
  if (alpha <= 0.001) { return; }
  const target = mode === 'won' && owned.length ? firstCell(owned[0].zone) : mode === 'out' ? firstCell(5) : firstCell(START_ZONE);
  const [tx0, ty0] = cellXY(target), tx = tx0 + 50, ty = ty0 + 50;
  const full = Math.min(width, height) * 0.86 / 1100, close = Math.max(width, height) * 1.25 / 100;
  const e = zoomK, sc = Math.exp(mixN(Math.log(full), Math.log(close), e));
  const keep = full * (1 - e) / sc, cx = tx - (tx - 550) * keep, cy = ty - (ty - 550) * keep, tilt = mixN(0.62, 1, e), rot = mixN(-0.32, 0, e);
  const grey = mode === 'won';
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = grey ? '#2a2a2c' : '#2f3a34'; ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2); ctx.scale(sc, sc * tilt); ctx.rotate(rot); ctx.translate(-cx, -cy);
  // The board itself, with a shadow under it.
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(18, 26, 1100, 1100);
  ctx.fillStyle = grey ? '#c9c7c2' : '#d8ead2'; ctx.fillRect(0, 0, 1100, 1100);
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, 1100, 1100); ctx.strokeRect(100, 100, 900, 900);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const mine = owned.map(o => o.zone); let placed = 0;
  for (let i = 0; i < 40; i++) {
    const [x, y] = cellXY(i), v = BOARD_CELLS[i], corner = i % 10 === 0;
    ctx.fillStyle = grey ? '#d6d3cc' : '#f2f6ea'; ctx.fillRect(x, y, 100, 100); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 100, 100);
    if (typeof v === 'number') {
      // A town's square: its colour bar on the inner edge, its name and price.
      const col = grey ? '#8a8680' : BOARD_ZONE_COL[v], side = i < 10 ? 0 : i < 20 ? 1 : i < 30 ? 2 : 3;
      ctx.fillStyle = col;
      if (side === 0) { ctx.fillRect(x, y, 100, 24); } else if (side === 1) { ctx.fillRect(x + 76, y, 24, 100); } else if (side === 2) { ctx.fillRect(x, y + 76, 100, 24); } else { ctx.fillRect(x, y, 24, 100); }
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 11px Georgia, serif'; ctx.fillText(ZONE_NAMES[v].toUpperCase(), x + 50, y + 46, 70);
      ctx.font = '11px Georgia, serif'; ctx.fillText(moneyK(TOWNS[v].price), x + 50, y + 62, 70);
      const k = mine.indexOf(v);
      if (mode === 'won' && k >= 0) {
        // Your pieces: the only colour left on the board.
        mine.splice(k, 1); placed++; ctx.fillStyle = placed >= 3 ? '#e0302a' : '#1fb04a';
        ctx.beginPath(); ctx.moveTo(x + 36, y + 96); ctx.lineTo(x + 36, y + 84); ctx.lineTo(x + 50, y + 73); ctx.lineTo(x + 64, y + 84); ctx.lineTo(x + 64, y + 96); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (mode === 'won') {
        ctx.save(); ctx.translate(x + 50, y + 82); ctx.rotate(-0.25); ctx.strokeStyle = '#c8322a'; ctx.lineWidth = 2; ctx.strokeRect(-26, -9, 52, 18); ctx.fillStyle = '#c8322a'; ctx.font = 'bold 12px Georgia, serif'; ctx.fillText('SOLD', 0, 1); ctx.restore();
      } else {
        // Somebody's home on every square.
        ctx.fillStyle = '#3f9e5a'; for (let h = 0; h < 2; h++) { const hx = x + 30 + h * 24, hy = y + 80; ctx.beginPath(); ctx.moveTo(hx - 8, hy + 10); ctx.lineTo(hx - 8, hy); ctx.lineTo(hx, hy - 7); ctx.lineTo(hx + 8, hy); ctx.lineTo(hx + 8, hy + 10); ctx.closePath(); ctx.fill(); }
      }
    } else {
      ctx.fillStyle = v === 'VACANT' || v === 'INVESTOR' ? (grey ? '#3a3a3a' : '#2a2a2a') : '#1a1a1a';
      if (v === 'VACANT' || v === 'INVESTOR') { ctx.fillRect(x + 6, y + 6, 88, 88); ctx.fillStyle = v === 'VACANT' ? '#ff4a3a' : '#d4a017'; }
      ctx.font = `bold ${corner ? 15 : 12}px Georgia, serif`; ctx.fillText(v, x + 50, y + 50, 88);
      if (v === 'GO') { ctx.fillStyle = '#c8322a'; ctx.font = 'bold 30px Georgia, serif'; ctx.fillText('←', x + 50, y + 76); }
    }
  }
  // The middle of the board.
  ctx.save(); ctx.translate(550, 550); ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = grey ? '#5a5652' : '#c8322a'; ctx.fillRect(-330, -50, 660, 100);
  ctx.fillStyle = '#fff'; ctx.font = 'italic 900 50px "Helvetica Neue", Arial, sans-serif'; ctx.fillText(grey ? 'POPULATION: YOU' : mode === 'out' ? 'FURTHER OUT' : 'THE LANDLORD’S WALK', 0, 3, 620);
  ctx.restore();
  // Round 2: the way you were pushed, from the suburbs to The Fringe.
  if (mode === 'out') {
    const pts = []; for (let i = firstCell(START_ZONE); i >= firstCell(5); i--) { const [x, y] = cellXY(i); pts.push([x + 50, y + 50]); }
    ctx.strokeStyle = '#c8322a'; ctx.lineWidth = 12; ctx.setLineDash([22, 14]); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
    const [ex, ey] = pts[pts.length - 1]; ctx.fillStyle = '#c39565'; ctx.fillRect(ex - 30, ey - 22, 60, 44); ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 3; ctx.strokeRect(ex - 30, ey - 22, 60, 44); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(ex - 30, ey - 16, 60, 6);
  }
  ctx.restore();
}
// Round 2: the family's things, left out on the kerb in front of the home you bought from them.
function addKerbside(ch, L) {
  if (L.kerbDone) { return; } L.kerbDone = true;
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X - 0.7);
  ['mattress', 'bike', 'frame', 'box', 'teddy', 'free'].forEach((item, i) => ch.props.push({ kind: 'junk', item, x: x + L.side * (i % 2) * 0.35, z: mid - 3 + i * 1.1, side: L.side }));
}
function drawJunk(q, p) {
  const k = q.k; if (k < 3) { return; }
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.85; ctx.lineCap = 'round';
  const x = q.x, y = q.y;
  if (p.item === 'mattress') {
    ctx.translate(x, y); ctx.rotate(p.side * 0.12); ctx.fillStyle = toneN('#e8e4dc', p.z); ctx.fillRect(-0.45 * k, -1.9 * k, 0.9 * k, 1.9 * k);
    ctx.fillStyle = toneN('#8aa0c0', p.z); for (let i = 0; i < 6; i++) { ctx.fillRect(-0.45 * k, (-1.8 + i * 0.32) * k, 0.9 * k, 0.08 * k); }
    ctx.fillStyle = 'rgba(120,90,40,0.35)'; ctx.beginPath(); ctx.ellipse(0.1 * k, -0.7 * k, 0.22 * k, 0.15 * k, 0, 0, TWO_PI); ctx.fill();
  } else if (p.item === 'bike') {
    ctx.strokeStyle = toneN('#d03a3a', p.z); ctx.lineWidth = Math.max(1, 0.05 * k);
    ctx.beginPath(); ctx.arc(x - 0.3 * k, y - 0.22 * k, 0.22 * k, 0, TWO_PI); ctx.arc(x + 0.3 * k, y - 0.22 * k, 0.22 * k, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 0.3 * k, y - 0.22 * k); ctx.lineTo(x - 0.05 * k, y - 0.55 * k); ctx.lineTo(x + 0.3 * k, y - 0.22 * k); ctx.lineTo(x + 0.2 * k, y - 0.6 * k); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 0.12 * k, y - 0.66 * k, 0.18 * k, 0.05 * k);
  } else if (p.item === 'frame') {
    // A family photo, face up to the sky.
    ctx.translate(x, y); ctx.rotate(-0.25); ctx.fillStyle = toneN('#b8902a', p.z); ctx.fillRect(-0.28 * k, -0.62 * k, 0.56 * k, 0.62 * k);
    ctx.fillStyle = toneN('#e8dcc0', p.z); ctx.fillRect(-0.22 * k, -0.56 * k, 0.44 * k, 0.5 * k);
    ctx.fillStyle = toneN('#6a5a4a', p.z); [-0.11, 0, 0.11].forEach((dx, i) => { const r = i === 1 ? 0.04 : 0.05; ctx.beginPath(); ctx.arc(dx * k, -0.38 * k, r * k, 0, TWO_PI); ctx.fill(); ctx.fillRect((dx - r) * k, -0.33 * k, r * 2 * k, 0.2 * k); });
  } else if (p.item === 'box') {
    ctx.fillStyle = toneN('#c39565', p.z); ctx.fillRect(x - 0.3 * k, y - 0.5 * k, 0.6 * k, 0.5 * k); ctx.fillStyle = toneN('#e8d8b0', p.z); ctx.fillRect(x - 0.3 * k, y - 0.46 * k, 0.6 * k, 0.07 * k);
    if (k > 20) { ctx.fillStyle = '#3a2a1a'; ctx.font = `bold ${0.1 * k}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KIDS’ TOYS', x, y - 0.2 * k); }
  } else if (p.item === 'teddy') {
    ctx.fillStyle = toneN('#a8743a', p.z); ctx.beginPath(); ctx.arc(x, y - 0.18 * k, 0.16 * k, 0, TWO_PI); ctx.arc(x, y - 0.42 * k, 0.11 * k, 0, TWO_PI); ctx.arc(x - 0.08 * k, y - 0.52 * k, 0.04 * k, 0, TWO_PI); ctx.arc(x + 0.08 * k, y - 0.52 * k, 0.04 * k, 0, TWO_PI); ctx.fill();
  } else if (p.item === 'free') {
    ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 0.03 * k, y - 0.9 * k, 0.06 * k, 0.9 * k); ctx.fillStyle = toneN('#b8915a', p.z); ctx.fillRect(x - 0.35 * k, y - 1.2 * k, 0.7 * k, 0.4 * k);
    if (k > 10) { ctx.fillStyle = '#2a1e18'; ctx.font = `bold ${0.24 * k}px "Marker Felt", "Comic Sans MS", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FREE', x, y - 1.0 * k); }
  }
  ctx.restore();
}


/* ---------- Your hands: chop the forest, raise the city (webcam + ml5 handPose) ---------- */
// Press H to use the camera. The hand moves are decided so each one carries the meaning:
//   swipe left / right  -> chop the forest on that side (as many times as you like)
//   open hand, lift up   -> build homes on the cleared land, floor by floor
//   fist, lift up        -> build luxury towers for investors (they stay empty: 0 AFFORDABLE)
// Only lifting builds; a hand held still does nothing, so you chop first and build after.
// Without a camera: ← / → chop... (X chops the right, Z the left), hold B for homes, N for towers.
// Only in Round 1: the tenant owns no land to build on.
let treesCut = 0, builtCount = 0, homesBuilt = 0, towersBuilt = 0, shopsBuilt = 0;
let nextThought = 10;
const THOUGHTS = ['Every city was a forest once.', 'Listen. Fewer birds now.', 'We build our world the way we want it.', 'Nobody asks the forest.', 'How much is enough?'];
let handMode = false, handVideo = null, handModel = null, handStatus = '', chopHintT = -9, buildHintT = -9, liftK = 0;
// Two hands, one for each side of the street. In the mirrored picture your left hand is on the left.
const newHand = () => ({ ok: false, x: 0.5, y: 0.6, fist: false, t: 0, seen: -9, chopT: -9, trail: [], lift: 0 });
const hands = { [-1]: newHand(), [1]: newHand() };
const handState = hands[1];   // kept for old callers
function startHands() {
  if (handMode) { handMode = false; handStatus = ''; return; }
  handMode = true; handStatus = 'Starting the camera…';
  if (handModel) { handStatus = 'Show your hand to the camera'; return; }
  const go = () => {
    try {
      handVideo = createCapture(VIDEO); handVideo.size(320, 240); handVideo.hide();
      handModel = ml5.handPose({ maxHands: 2 }, () => { handStatus = 'Show your hand to the camera'; handModel.detectStart(handVideo, gotHands); });
    } catch (e) { handStatus = 'No camera: Z / X chop, hold B (homes) or N (towers)'; }
  };
  if (window.ml5) { go(); return; }
  const sc = document.createElement('script'); sc.src = 'https://unpkg.com/ml5@1.0.1/dist/ml5.min.js';
  sc.onload = go; sc.onerror = () => { handStatus = 'Hand tracking could not load: Z / X chop, hold B or N'; };
  document.head.appendChild(sc);
}
function gotHands(results) {
  if (!results || !results.length || !handVideo) { return; }
  const seen = [];
  for (const h of results.slice(0, 2)) {
    const kp = h.keypoints || [], at = n => kp.find(k => k.name === n);
    const wrist = at('wrist'), mcp = at('middle_finger_mcp'), p = mcp || wrist || kp[0]; if (!p) { continue; }
    // A fist: the fingertips are close to the wrist compared with the size of the palm.
    // The shape of the hand: open (homes), pointing with one finger (shops) or a fist (towers).
    let shape = 'open';
    if (wrist && mcp) {
      const palm = Math.hypot(mcp.x - wrist.x, mcp.y - wrist.y) || 1, reach = n => { const tp = at(n); return tp ? Math.hypot(tp.x - wrist.x, tp.y - wrist.y) / palm : 2; };
      const idx = reach('index_finger_tip'), rest = (reach('middle_finger_tip') + reach('ring_finger_tip') + reach('pinky_finger_tip')) / 3;
      shape = idx < 1.3 && rest < 1.3 ? 'fist' : idx > 1.6 && rest < 1.3 ? 'point' : 'open';
    }
    seen.push({ x: 1 - p.x / (handVideo.width || 320), y: p.y / (handVideo.height || 240), fist: shape });
  }
  // Two hands: the one further left is your left hand. One hand: whichever half of the picture it is in.
  seen.sort((a, b) => a.x - b.x);
  if (seen.length === 2) { handFeedSide(-1, seen[0].x, seen[0].y, seen[0].fist); handFeedSide(1, seen[1].x, seen[1].y, seen[1].fist); }
  else if (seen.length === 1) { handFeedSide(seen[0].x < 0.5 ? -1 : 1, seen[0].x, seen[0].y, seen[0].fist); }
}
// One position of your hand (0..1, mirrored like a mirror) from the camera, or from a test.
function handFeed(nx, ny, fist = false) { handFeedSide(nx < 0.5 ? -1 : 1, nx, ny, fist); }
// One position of one hand (0..1, mirrored like a mirror). Left hand -> left side of the street, right -> right.
function handFeedSide(side, nx, ny, fist = false) {
  const shape = fist === true ? 'fist' : fist || 'open';
  const now = performance.now() / 1000, s = hands[side], fresh = s.ok && now - s.seen < 0.4;
  if (fresh) { const up = s.y - ny; if (up > 0.004) { s.lift += up; } }   // lifting this hand builds on its side
  s.x = nx; s.y = ny; s.shape = shape; s.fist = shape === 'fist'; s.t = now; s.ok = true; s.seen = now;
  s.trail.push({ x: nx, y: ny, t: now }); while (s.trail.length && now - s.trail[0].t > 0.3) { s.trail.shift(); }
  // A chop: a fast stroke of this hand, sideways or down (not up, which builds), cuts the forest on its side.
  const a = s.trail[0];
  if (a && now - s.chopT > 0.28) { const dx = nx - a.x, dy = ny - a.y; if (Math.hypot(dx, dy) > 0.25 && dy > -0.06) { s.chopT = now; s.trail.length = 0; chopForest(side); } }
}
function handsActive() { return !intro && !ending; }
// Land that waits for your hands instead of building itself.
function waitsForHand(L) { return !L.special && !L.owned && !L.piece; }
// How far a lot's building has risen: floor by floor under your hand once cleared, otherwise on its own.
function lotRise(L) {
  if (L.cutT === undefined || L.born !== undefined) { return riseOf(L.born); }
  const n = floorsOf(L), f = Math.floor((L.grow || 0) * n + 1e-6) / n, bump = L.floorT !== undefined ? Math.max(0, 1 - (clockT - L.floorT) / 0.18) : 0;
  return f + bump * 0.6 / n;
}
function floorsOf(L) { return Math.max(2, Math.min(16, Math.round(L.H / 3))); }
function treesOn(L) { return Math.max(2, Math.round((L.z1 - L.z0) / 2.4)) * 3; }
function chopForest(side) {
  if (!handsActive()) { return; }
  const z = distanceWalked, pick = s => { let best = null; for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side !== s || L.cutT !== undefined || L.born !== undefined || !waitsForHand(L)) { continue; } const d = L.z0 - z; if (d > -2 && d < 45 && (!best || d < best.d)) { best = { L, d }; } } } return best && best.L; };
  const L = pick(side); if (!L) { return; }
  L.cutT = clockT; L.grow = 0; treesCut += treesOn(L);
  const L2 = pick(side); if (L2) { L2.cutT = clockT + 0.12; L2.grow = 0; treesCut += treesOn(L2); }   // one swing clears a stretch of two lots
  if (sound.chop) { sound.chop(side); }
  if (clockT - chopHintT > 10) { chopHintT = clockT; sayToast('The forest is gone. Lift an open hand for homes, a fist for towers.'); }
}
// A cleared lot becomes an investor's tower when a fist builds it.
// What a cleared lot becomes. Each kind of hand builds a different family of buildings, picked at
// random so the street never repeats: homes (bungalows, terraces, cottages, caravans, villas,
// mansions), shops (corner shops, high-street shops, brick offices) or towers (brick and glass,
// skyscrapers that stand empty, and on a big lot a castle).
function makeBuilt(L, kind) {
  const r = rngN(L.seed + 5 + builtCount * 31), len = L.z1 - L.z0;
  let opts;
  if (kind === 'tower') { opts = [['tier', 3], ['tier', 4], ['tier', 4]]; if (len >= 26) { opts.push(['style', 'castle']); } }
  else if (kind === 'shop') { opts = [['tier', 1], ['tier', 1], ['tier', 0], ['tier', 3]]; }
  else { opts = [['style', 'bungalow'], ['style', 'bungalow'], ['tier', 1], ['tier', 0]]; if (len >= 10) { opts.push(['style', 'caravan']); } if (len >= 18) { opts.push(['style', 'villa'], ['tier', 2]); } }
  const [how, v] = pickN(r, opts), tier = how === 'tier' ? v : STYLES_LOT[v].tier, t = makeLot(null, tier, L.side, L.z0, len, r);
  Object.assign(L, { style: null, tier, H: t.H, depth: t.depth, setback: t.setback, color: t.color, accent: t.accent, awning: t.awning, name: t.name, sign: t.sign, crooked: t.crooked || 0, crown: t.crown, spire: t.spire, glass: t.glass, fountain: t.fountain, brick: false, tree: false, vacant: false });
  if (how === 'style') { styleLot(L, v, r); }
  if (kind === 'tower' && tier === 4) { Object.assign(L, { H: mixN(45, 95, r()), vacant: true, sign: true, name: VOID_NAMES[Math.abs(L.seed) % VOID_NAMES.length] }); }
}
function makeTower(L) { makeBuilt(L, 'tower'); }
function handUpdate(dt) {
  const now = performance.now() / 1000;
  for (const side of [-1, 1]) { const s = hands[side]; if (s.ok && now - s.seen > 0.6) { s.ok = false; } }
  // Keys stand in for the camera: B lifts homes and N towers, on both sides.
  const keyLift = keysHeld.has('KeyB') || keysHeld.has('KeyN') || keysHeld.has('KeyV') ? dt * 0.6 : 0, keyShape = keysHeld.has('KeyN') ? 'fist' : keysHeld.has('KeyV') ? 'point' : 'open';
  for (const side of [-1, 1]) {
    const s = hands[side], lift = s.lift + keyLift, shape = keyLift ? keyShape : s.ok ? s.shape || 'open' : 'open'; s.lift = 0;
    if (!handsActive() || lift <= 0) { continue; }
    // The lift raises the cleared lots on this hand's side, nearest first.
    const cleared = [];
    for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && clockT - L.cutT > 0.8 && Math.abs(L.z0 - distanceWalked) < 50) { cleared.push(L); } } }
    cleared.sort((a, b) => Math.abs(a.z0 - distanceWalked) - Math.abs(b.z0 - distanceWalked));
    if (!cleared.length) { if (clockT - buildHintT > 6 && !keyLift) { buildHintT = clockT; sayToast(`Nothing cleared on the ${side < 0 ? 'left' : 'right'}. Chop the forest there first.`); } continue; }
    for (const L of cleared.slice(0, 2)) {
      if (!L.buildKind) { L.buildKind = shape === 'fist' ? 'tower' : shape === 'point' ? 'shop' : 'home'; makeBuilt(L, L.buildKind); }
      const n = floorsOf(L), before = Math.floor(L.grow * n + 1e-6);
      L.grow = Math.min(1, L.grow + lift * (L.buildKind === 'tower' ? 1.6 : 2.4));
      const after = Math.floor(L.grow * n + 1e-6);
      if (after > before) { L.floorT = clockT; if (sound.floorUp) { sound.floorUp(after, n, L.side); } }
      if (L.grow >= 1) { L.born = clockT - RISE_T - 1; L.thud = true; builtCount++; if (L.buildKind === 'tower') { towersBuilt++; } else if (L.buildKind === 'shop') { shopsBuilt++; } else { homesBuilt++; } if (sound.built) { sound.built(L.buildKind === 'tower'); } }
    }
  }
}
// The camera picture and your hand, bottom right, while the hands are on.
function drawHandPanel() {
  if (!handMode) { return; }
  const w = 176, h = 132, x = width - w - 16, y = height - h - 16;
  push(); noStroke(); fill(0, 140); rect(x - 4, y - 44, w + 8, h + 48, 8);
  if (handVideo && handVideo.elt && handVideo.elt.readyState >= 2) { drawingContext.save(); drawingContext.translate(x + w, y); drawingContext.scale(-1, 1); drawingContext.globalAlpha = 0.85; drawingContext.drawImage(handVideo.elt, 0, 0, w, h); drawingContext.restore(); }
  else { fill(40); rect(x, y, w, h, 4); }
  stroke(255, 255, 255, 50); strokeWeight(1); line(x + w / 2, y, x + w / 2, y + h); noStroke();
  for (const side of [-1, 1]) {
    const s = hands[side]; if (!s.ok) { continue; }
    const col = side < 0 ? color(90, 200, 255) : color(255, 210, 60);
    stroke(col); strokeWeight(3); noFill(); beginShape(); for (const p of s.trail) { vertex(x + p.x * w, y + p.y * h); } endShape(); noStroke();
    fill(s.fist ? color(224, 48, 42) : col); circle(x + s.x * w, y + s.y * h, 16); fill(255); textSize(10); textAlign(CENTER, CENTER); text((side < 0 ? 'L ' : 'R ') + (s.shape === 'fist' ? '✊' : s.shape === 'point' ? '☝' : '✋'), x + s.x * w, y + s.y * h - 16);
  }
  const s = { ok: hands[-1].ok || hands[1].ok };
  fill(255); textFont('Georgia'); textStyle(BOLD); textSize(10); textAlign(LEFT, TOP);
  text(s.ok || !handStatus ? 'L hand → left · R hand → right · swing: cut\nlift ✋ homes · ☝ shops · ✊ towers' : handStatus, x, y - 38, w + 4);
  pop();
}

/* ---------- Keys ---------- */
function boardKey(e) {
  const code = e.code;
  if (code === 'KeyE' || code === 'Space' || code === 'Enter' && (intro || ending)) { useHere(); return true; }
  if (code === 'KeyR') { restartWalk(); return true; }
  if (code === 'KeyF') { if (ending) { ending = null; baseNight = 0; nightTarget = 0; } else if (!intro) { endWalk('built'); } return true; }
  if (code === 'KeyH') { startHands(); return true; }
  if (code === 'KeyX' || code === 'ArrowRight' || code === 'KeyD') { chopForest(1); return true; }
  if (code === 'KeyZ' || code === 'ArrowLeft' || code === 'KeyA') { chopForest(-1); return true; }
  if (code === 'KeyB' || code === 'KeyN' || code === 'KeyV') { return true; }
  return false;
}

/* ---------- What to do next: one line at the top, and a pink arrow in the street ---------- */
function nextForSale() {
  let best = null; const z = distanceWalked;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (!L.forSale) { continue; } const m = (L.z0 + L.z1) / 2; if (m - z > -6 && m - z < 90 && (!best || m < best.m)) { best = { L, m }; } } }
  return best;
}
function nextText() {
  const z = distanceWalked; let cleared = false, forest = false;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.special) { continue; } const d = L.z0 - z; if (L.cutT !== undefined && L.born === undefined && Math.abs(d) < 50) { cleared = true; } if (L.cutT === undefined && L.born === undefined && d > -2 && d < 45) { forest = true; } } }
  if (cleared) { return 'Lift a hand to build  (✋ homes · ☝ shops · ✊ towers)'; }
  if (forest) { return 'Swing your left or right hand to cut that side'; }
  return 'Walk on  ↑';
}
function drawNextBar() {
  const t = nextText(); push(); textFont('Georgia'); textStyle(BOLD); textSize(17);
  const w = textWidth(t) + 90, x = width / 2 - w / 2, crowded = x < 16 + Math.min(400, width * 0.5) + 8 || x + w > width - 16 - 190 - 8, y = crowded ? 142 : 16;
  noStroke(); fill(0, 60); rect(x + 3, y + 4, w, 40, 20); fill(42, 30, 24); rect(x, y, w, 40, 20);
  fill('#ffd23f'); rect(x + 10, y + 11, 52, 18, 9); fill(42, 30, 24); textSize(10); textAlign(CENTER, CENTER); text('NEXT', x + 36, y + 20.5);
  fill(255, 236, 190); textSize(17); textAlign(LEFT, CENTER); text(t, x + 72, y + 21);
  pop();
}
function drawTargetMarker() { }
function boardClick(mx, my) {
  if (intro) { intro = false; return true; }
  if (ending) { if (clockT - ending.t > 4) { ending = null; baseNight = 0; nightTarget = 0; } return true; }
  return false;
}

// Persistent plot identities are independent of the lap and absolute camera distance.
function preserveLot(L) {
  if (!L.memoryKey) { return; }
  streetMemory.set(L.memoryKey, { H: L.H, tier: L.tier, color: L.color, depth: L.depth, crown: L.crown, spire: L.spire, glass: L.glass, name: L.name, sign: L.sign, forSale: L.forSale, investorAt: L.investorAt, sold: L.sold, owned: L.owned, home: L.home, piece: L.piece, vacant: L.vacant, formerName: L.formerName, changedYear: L.changedYear });
}
function rememberStreet(ch) {
  ch.zoneId = zone;
  ch.lots.forEach((L, i) => {
    L.memoryKey = zone + ':' + ch.slot + ':' + i;
    L.formerName = L.name || 'NEIGHBOURHOOD HOMES';
    L.redevelopYear = L.seed % 3 === 0 ? Infinity : START_AGE + 2 + (Math.abs(L.seed) % 5);
    const saved = streetMemory.get(L.memoryKey);
    if (saved) { Object.assign(L, saved); }
    if (rules === 2 && L.owned && L.home) { addKerbside(ch, L); }
  });
  // Ordinary residents, rather than only open-home queues, make the loss visible.
  const rr = rngN(seed + ch.slot * 83 + zone * 761);
  for (let i = 0; i < 12; i++) { ch.props.push({ kind: 'person', x: (i % 2 ? 1 : -1) * (EDGE_X - 0.8), z: ch.z0 + CROSS_W + 2 + rr() * (CHUNK_LEN - CROSS_W - 4), tone: rr(), h: 1.55 + rr() * 0.3, ph: rr() * 6, residentRank: (i + 1) / 13 }); }
  ch.props.filter(p => p.kind === 'person').forEach((p, i) => { if (p.residentRank === undefined) { p.residentRank = (i % 12 + 1) / 13; } });
  evolveStreet(ch);
}
// Rule 1: as the years pass, homes become empty investments, and every home you let out
// means fewer of the old neighbours. Rule 2: nobody is pushed out.
function evolveStreet(ch) { ch.residentShare = 1; }
