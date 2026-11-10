// noprotect
// We Build Our World: combined file for the p5.js Web Editor (works with p5.js 1.x and 2.x).
// Paste this whole file into sketch.js. It is sound.js, forest.js, sketch.js and world.js in one.

/* Sound: everything you hear in We Build Our World, made live with the Web Audio API (no sound files).
 *   The forest: wind, rustling leaves and birdsong, with slow strings and a harp.
 *   As you build (devK = share of built lots near you), the wild sounds fade, traffic hum rises
 *   and the music changes at the end of a bar: strings and harp, then pop, then a house beat.
 *   Effects: footsteps, the axe and a falling tree (chop), birds taking off (flutter), a thud for
 *   every floor (floorUp), a chord when a building is finished (built), the life inside each home
 *   (life: kids, a dog, a piano, the TV ...) and a chime at the end (go).
 * start() from a click or key press (browsers only allow sound after one), then update() every frame.
 */
// The band's volume, well above the street hum so it is clearly heard.
const MUSIC_VOL = 6;
// The three kinds of music, from forest to city. Chords are MIDI note numbers, one chord per bar.
const STYLES = {
  forest: { name: 'Strings and harp - the forest', bpm: 72, swing: 0.5, chords: [[48, 55, 59, 64, 67], [45, 52, 57, 60, 64], [41, 48, 53, 57, 64], [43, 50, 55, 59, 62]], gain: 0.95 },
  town: { name: 'Pop - the new town', bpm: 108, swing: 0.5, chords: [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]], gain: 0.8 },
  city: { name: 'House beat - the city', bpm: 122, swing: 0.5, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]], gain: 0.75 }
};
const MIDI = n => 440 * Math.pow(2, (n - 69) / 12);

class WorldSound {
  constructor() {
    this.enabled = false; this.context = null;
    this.voices = 0;    // effect voices playing (footsteps, the end chime)
    this.mvoices = 0;   // music and effect voices playing (the band, the axe, the homes ...)
    this.style = null; this.nextStyle = 'forest'; this.step = 0; this.nextAt = 0;
    this.devK = 0; this.devSmooth = 0; this.listenK = 0;
    document.addEventListener('visibilitychange', () => this._sync());
  }

  /* ---------- Switching on and off ---------- */
  async start() { this.enabled = true; if (!this.context) {this._build();} await this._sync(); }
  async toggle() { this.enabled = !this.enabled; if (this.enabled && !this.context) {this._build();} await this._sync(); }
  async _sync() {
    const ctx = this.context; if (!ctx) {return;}
    if (this.enabled && !document.hidden) { await ctx.resume(); this.master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.4); }
    else { this.master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => { if (!this.enabled || document.hidden) {ctx.suspend();} }, 300); }
  }

  /* ---------- The sound graph ---------- */
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
    // The band: every note goes through styleGain (dipped when the style changes) into music.
    this.music = ctx.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    this.styleGain = ctx.createGain(); this.styleGain.gain.value = 1; this.styleGain.connect(this.music);
    this.music.gain.setTargetAtTime(MUSIC_VOL, ctx.currentTime, 1);
    // Life inside the houses, heard through the walls: muffled while you walk, clear when you stop to listen.
    this.lifeFilter = ctx.createBiquadFilter(); this.lifeFilter.type = 'lowpass'; this.lifeFilter.frequency.value = 1100;
    this.lifeGain = ctx.createGain(); this.lifeGain.gain.value = 1; this.lifeFilter.connect(this.lifeGain); this.lifeGain.connect(this.master);
    // The forest before the street: wind in the leaves (birds are added in update).
    this.wind = this._noiseBed(700, 'bandpass', 0); this.leaves = this._noiseBed(3500, 'highpass', 0);
  }
  // A looping bed of filtered noise (hum, air, wind, leaves); returns its volume control.
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

  /* ---------- Sounds of the street ---------- */
  // A footstep: a soft scuff and a low thud, brighter when you run.
  footstep(pace = 0.4) { if (!this._ok(3)) {return;} const t = this.context.currentTime; this._burst(t, 0.07, 1600 + pace * 900, 0.08 + pace * 0.05); this._burst(t, 0.09, 180, 0.06, 'lowpass'); }
  // The end: a rising chime.
  go() { if (!this._ok(12)) {return;} const t = this.context.currentTime; [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this._note(f, t + i * 0.09, 0.5, 'triangle', 0.07)); this._note(2093, t + 0.5, 0.8, 'sine', 0.05); }
  // One sound of somebody's home: kids, a dog, a piano, the TV... Returns how long it lasts.
  life(kind, gain, pan) {
    if (!this.enabled || !this.context || this.context.state !== 'running' || this.mvoices > 36) { return 0; }
    const ctx = this.context, t = ctx.currentTime + 0.02, out = ctx.createGain(), p = ctx.createStereoPanner(), made = [out, p];
    out.gain.value = gain; p.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(p);
    p.connect(this.lifeFilter);
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
  // Birds leaving: a quick flutter of wings and a few alarm calls.
  flutter(side) {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const ctx = this.context, t = ctx.currentTime + 0.08, p = ctx.createStereoPanner(), out = ctx.createGain(); p.pan.value = side * 0.6; out.gain.value = 0.9; p.connect(out); out.connect(this.master);
    for (let i = 0; i < 14; i++) {
      const when = t + i * 0.035 + Math.random() * 0.015, s2 = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s2.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 1400; f.Q.value = 2;
      g.gain.setValueAtTime(0.35 * (1 - i / 16), when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
      s2.connect(f); f.connect(g); g.connect(p); s2.start(when, Math.random()); s2.stop(when + 0.04);
    }
    for (let i = 0; i < 3; i++) { this._m(2600 + Math.random() * 1200, t + 0.1 + i * 0.12, 0.07, 'sine', 0.05, 9000, side * 0.6); }
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

  /* ---------- Every frame: the mix follows the street, and the band plays ---------- */
  update() {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const now = this.context.currentTime;
    // The music follows how built-up the street is: forest strings, then town pop, then the city's beat.
    const dv = this.devSmooth; this.nextStyle = dv < 0.3 ? 'forest' : dv < 0.65 ? 'town' : 'city';
    if (!this.style) { this.style = this.nextStyle; this.nextAt = now + 0.1; }
    const listen = this.listenK;
    // Forest to city: the less built-up the street around you, the more wind and birds; the more
    // built-up, the more traffic hum and the louder the band.
    this.devSmooth += (this.devK - this.devSmooth) * 0.03; const dev = this.devSmooth, wild = (1 - dev) * (ending ? (builtCount === 0 ? 1 : builtCount <= 5 ? 0.4 : 0) : 1);   // at the end: birds keep singing if you built nothing, a few if you built a little, none after a city
    this.wind.gain.setTargetAtTime(0.05 * wild, now, 0.8); this.leaves.gain.setTargetAtTime(0.012 * wild * (0.6 + 0.4 * Math.sin(now * 0.7)), now, 0.5);
    this.hum.gain.setTargetAtTime(0.03 * (0.15 + dev * 1.2), now, 1);
    if (Math.random() < 0.05 * wild * wild && this.mvoices < 30) {
      // A bird: two to five quick chirps, sliding up.
      const f0 = 2400 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 4), p = (Math.random() - 0.5) * 1.6, t0 = now + 0.02;
      for (let i = 0; i < n; i++) { const o = this.context.createOscillator(), g = this.context.createGain(), pn = this.context.createStereoPanner(); pn.pan.value = p; o.type = 'sine'; o.frequency.setValueAtTime(f0, t0 + i * 0.11); o.frequency.exponentialRampToValueAtTime(f0 * 1.35, t0 + i * 0.11 + 0.07); g.gain.setValueAtTime(0, t0 + i * 0.11); g.gain.linearRampToValueAtTime(0.025 * wild, t0 + i * 0.11 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.11 + 0.09); o.connect(g); g.connect(pn); pn.connect(this.master); o.start(t0 + i * 0.11); o.stop(t0 + i * 0.11 + 0.1); o.onended = () => { o.disconnect(); g.disconnect(); pn.disconnect(); }; }
    }
    // Stop and listen: the band and the street fade back, the homes beside you come through the wall.
    this.music.gain.setTargetAtTime(MUSIC_VOL * (1 - 0.8 * listen) * (0.35 + 0.65 * dev), now, 0.4);
    this.lifeFilter.frequency.setTargetAtTime(1100 + listen * 4500, now, 0.4); this.lifeGain.gain.setTargetAtTime(1 + listen * 0.9, now, 0.4);
    // Schedule the band a little ahead, an eighth note at a time.
    while (this.nextAt < now + 0.15) { this._play(this.nextAt); }
  }
  _play(t) {
    const S = STYLES[this.style], eighth = 60 / S.bpm / 2, step = this.step % 32, bar = Math.floor(step / 8), beat8 = step % 8;
    // Swing: the off-beat eighths land late.
    const len = beat8 % 2 === 0 ? eighth * 2 * S.swing : eighth * 2 * (1 - S.swing);
    const chord = S.chords[bar], pan = () => (Math.random() - 0.5) * 0.6;
    if (this.style === 'forest') {
      // The forest: a string section and a harp, slow and calm. Long bowed chords that swell in each bar...
      const barLen = eighth * 8;
      if (beat8 === 0) { chord.forEach((n, i) => { this._m(MIDI(n + 12), t, barLen * 1.1, 'sawtooth', 0.007, 1500, -0.4 + i * 0.2, barLen * 0.35); this._m(MIDI(n + 12) * 1.004, t, barLen * 1.1, 'sawtooth', 0.006, 1300, 0.4 - i * 0.2, barLen * 0.35); }); this._m(MIDI(chord[0] - 12), t, barLen, 'sawtooth', 0.03, 420, 0, 0.15); }
      // ...a harp rippling up the chord on every eighth...
      this._m(MIDI(chord[(beat8 % chord.length)] + 24), t, 0.9, 'triangle', 0.024, 5200, -0.3 + beat8 * 0.08);
      // ...and a celesta tune on top, with a high sparkle.
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
    } else {
      // The new town: pop. A plucked chord, broken over the bar.
      const n = chord[(beat8 + Math.floor(beat8 / 4)) % chord.length]; this._m(MIDI(n + 12), t, 0.35, 'triangle', 0.035, 3200, pan());
      if (beat8 === 0) { chord.forEach(c => this._m(MIDI(c + 12), t, 0.9, 'sine', 0.012, 2400)); }
      // Bouncing bass on the root and fifth.
      if (beat8 % 2 === 0) { this._m(MIDI(chord[0] - 12 + (beat8 === 4 ? 7 : 0)), t, 0.3, 'triangle', 0.08, 900); }
      this._hit(t, 0.04, 6500, 0.018);
      if (beat8 === 2 || beat8 === 6) { this._hit(t, 0.12, 1500, 0.03, 'bandpass', 1.2); }
      if (beat8 === 0 || beat8 === 5) { this._kick(t, 0.12); }
    }
    this.nextAt += len; this.step++;
    // Change style at the end of a bar: dip the band, swap, and bring it back.
    if (this.step % 8 === 0 && this.nextStyle !== this.style) {
      const g = this.styleGain.gain, at = this.nextAt; g.setTargetAtTime(0, at - 0.25, 0.1); g.setTargetAtTime(STYLES[this.nextStyle].gain, at + 0.05, 0.3);
      this.style = this.nextStyle; this.step = 0;
    }
  }
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
  } catch (e) { console.warn('the forest could not be painted', e && e.stack); forestSprites = null; }
}
// A haze-coloured silhouette of a tree sprite, laid over it in the distance so far trees fade into the air.
const hazeCache = new Map();
function hazeSprite(img) {
  if (hazeCache.has(img)) { return hazeCache.get(img); }
  const src = img.canvas || img.elt, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#ffd79a'; c.fillRect(0, 0, cv.width, cv.height);
  hazeCache.set(img, cv); return cv;
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

/* We Build Our World: the street engine.
 * A first-person, endless street drawn in p5.js on a flat Canvas 2D, with its own perspective
 * camera (P). The street is made of 48 m blocks grown from a seeded random generator (chunkAt).
 * Every lot starts as forest; world.js decides what happens to it (cut down, built on), and this
 * file draws it: sky, ground, forest, buildings, people and lamps, far to near.
 * Hooks into world.js: plotsForChunk, addResidents, propWaits, lotRise, worldUpdate,
 * drawScaffold, drawBirds, paintSlogan, drawHud, worldKey, worldClick.
 */

/* ---------- Settings: sizes in metres, speeds, colours ---------- */
const EYE_H = 1.6, ROAD_W = 4.2, PAVE_W = 3.4, EDGE_X = ROAD_W + PAVE_W;   // building line at 7.6 m
const CHUNK_LEN = 48, CROSS_W = 10, FAR_Z = 230;   // block length, crossing width, view distance (m)
const STROLL_SPD = 3, WALK_SPD = 4.5, RUN_SPD = 9;   // metres per second (STROLL_SPD = Enter, auto-walk)
const APPEAR_Z = 36, RISE_T = 2.4;   // lots build when you come this close; rise time in seconds
// Bright accent colours: the kerb band and shop awnings.
const PALETTE = { brown: '#8b5a2b', sky: '#a9d8f0', pink: '#d94f9a', orange: '#f28c28', red: '#e23b3b', yellow: '#f2d13a', green: '#1fa35b', navy: '#1f4fa8' };
// Shop names for the small shops (tier 0), the high street (tier 1) and the brick offices (tier 3).
const SHOP_NAMES = {
  0: ['Bargain Bin', 'Rusty Nails', 'Patch & Mend', 'Penny Pantry', 'Junk & Co.', 'Second Chance', 'Odd Socks'],
  1: ['Corner Cafe', 'Maple Bakery', 'Paper Moon Books', 'Petal Florist', 'Teapot', 'Little Deli'],
  3: ['Gallery 9', 'Black Door Boutique', 'City Diner', 'The Workshop', 'Velvet Lounge', 'Grand Hotel']
};

/* ---------- State ---------- */
let seed = 2718, distanceWalked = 0, clockT = 0, paused = false, stepSpeed = 0, autoWalk = false, pointerHeld = false;
let stillT = 0;   // how long you have stood still (lets you look further round)
let stepPhase = 0, bobAmp = 0, lookYaw = 0, lookPitch = 0, canvasNode, sound, audioStarted = false, grain;
let night = 0, nightTarget = 0;   // 0 = day, 1 = night (the ending dims the light a little)
const chunks = new Map();   // block index -> { lots, props, back } for every 48 m block in view
let cam = { x: 0, z: 0, yaw: 0, f: 700, cx: 0, hy: 0, eye: EYE_H }, ctx, skyline = [];
let riseK = 1, mouseMoved = false;   // riseK: vertical scale while a building rises (used by P)
window.addEventListener('pointermove', () => { mouseMoved = true; });   // the mouse only turns your head once it has moved
// Looking back (C, and at the end): you turn round on the spot to see the street behind you.
// backT runs 0 -> 1 over the turn; past halfway the world is drawn mirrored (drawMirrored).
let backT = 0, backS = 0, backWant = false, mirrorView = false;

/* ---------- Keys: held keys come straight from the browser, so walking works the same in p5.js 1.x and 2.x ---------- */
// Held keys are tracked directly from the browser, so walking works the same in p5.js 1.x and 2.x.
const keysHeld = new Set();
window.addEventListener('keydown', e => keysHeld.add(e.code));
window.addEventListener('keyup', e => keysHeld.delete(e.code));
window.addEventListener('blur', () => keysHeld.clear());
function held(keyName) { return keysHeld.has(keyName); }

/* ---------- Small helpers: seeded random numbers and easing ---------- */
function rngN(s) { let x = s | 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) | 0; return (x >>> 0) / 4294967296; }; }
function mixN(a, b, t) { return a + (b - a) * t; }
function easeN(a) { a = constrain(a, 0, 1); return a * a * (3 - 2 * a); }
function modN(a, n) { return ((a % n) + n) % n; }
function pickN(r, list) { return list[Math.floor(r() * list.length)]; }
function midN(a, b) { return (a + b) / 2; }

/* ---------- Colours: parsed once and mixed as numbers (twice as fast as p5 color objects) ---------- */
// Colours. The street mixes thousands of colours a frame (fog, night, smog), so each colour string
// is parsed once into [r, g, b] and blended with plain arithmetic instead of p5's color() objects.
// The results are the same as p5's lerpColor in RGB mode, about twice as fast for the whole frame.
const rgbCache = new Map();
function rgbOf(col) {
  let v = rgbCache.get(col);
  if (!v) { if (rgbCache.size > 4000) { rgbCache.clear(); } const c = color(col); v = [red(c), green(c), blue(c)]; rgbCache.set(col, v); }
  return v;
}
function shadeN(hexCol, k) { const [r, g, b] = rgbOf(hexCol); return `rgb(${constrain(r * k, 0, 255) | 0},${constrain(g * k, 0, 255) | 0},${constrain(b * k, 0, 255) | 0})`; }
function mixHex(a, b, t) {
  const A = rgbOf(a), B = rgbOf(b); t = t < 0 ? 0 : t > 1 ? 1 : t;
  return `rgb(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0})`;
}
function rgbaN(hexCol, a) { const [r, g, b] = rgbOf(hexCol); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function smogNow() { return Math.min(1, smogK); }   // smogK lives in world.js
// The colour of the haze far down the street. It is asked for hundreds of times a frame but only
// changes with night and smog, so it is worked out once per change.
let hazeKey = '', hazeVal = '';
function hazeHex() { const hk = night.toFixed(3) + smogNow().toFixed(3); if (hk !== hazeKey) { hazeKey = hk; hazeVal = mixHex(mixHex('#ffd79a', '#5a4a70', night), '#a8a49e', smogNow() * 0.65); } return hazeVal; }
function fogFor(zz) { return easeN((zz - cam.z - 40) / (FAR_Z - 40)) * 0.85; }
function toneN(hexCol, zz, k = 1) {
  let c = shadeN(hexCol, k);
  c = mixHex(c, '#2a2a48', night * 0.5);
  return mixHex(c, hazeHex(), fogFor(zz));
}

/* ---------- Setup ---------- */
function setup() {
  const c = createCanvas(windowWidth, windowHeight); pixelDensity(min(1.5, window.devicePixelRatio || 1));
  canvasNode = c.elt; canvasNode.tabIndex = 0; ctx = drawingContext; setTimeout(() => canvasNode.focus({ preventScroll: true }), 100);
  canvasNode.setAttribute('aria-label', 'We Build Our World, a first-person street that starts as forest. Press C to use your hands with the camera: one finger builds homes, an open hand shops, a fist towers. Or use the keys: Z and X cut the forest on the left or right; hold H, S or B to build homes, shops or towers (hold for bigger). T turns round, F ends, M sound.');
  sound = new WorldSound(); textFont('Georgia');   // sound.js: wind and birds that give way to traffic and a band
  grain = createGraphics(320, 320); grain.pixelDensity(1); grain.loadPixels();
  for (let i = 0; i < grain.pixels.length; i += 4) { const v = random() < 0.5 ? 255 : 0; grain.pixels[i] = grain.pixels[i + 1] = grain.pixels[i + 2] = v; grain.pixels[i + 3] = random(10); }
  grain.updatePixels(); buildSkyline();
  makeForest();   // forest.js: paint the 12 tree sprites once
}
function buildSkyline() {
  const r = rngN(seed + 99); skyline = [];
  for (let i = 0; i < 46; i++) { const a = (r() - 0.5) * 1.5; skyline.push({ a, w: mixN(0.012, 0.04, r()), h: mixN(0.05, 0.2, r()) * (1 - Math.abs(a) * 0.6), spire: r() < 0.3, tone: r() }); }
  skyline.sort((p, q) => q.h - p.h);
}

/* ---------- Camera: the perspective projection and clipping ---------- */
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
// A line segment, skipped when either end is behind the camera.
function segN(a, b) {
  const Z = 0.6; if (a.rz < Z && b.rz < Z) { return; }
  const cut = (p, q) => { const t = (Z - p.rz) / (q.rz - p.rz), rx = p.rx + (q.rx - p.rx) * t, ry = p.ry + (q.ry - p.ry) * t; return { x: cam.cx + rx * cam.f / Z, y: cam.hy + ry * cam.f / Z }; };
  const A = a.rz < Z ? cut(a, b) : a, B = b.rz < Z ? cut(b, a) : b;
  ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
}
const NEAR_Z = 0.45;
function clipZ(z) { return Math.max(z, cam.z + NEAR_Z); }

/* ---------- The street: 48 m blocks, grown from a seed ---------- */
function chunkAt(c) {
  if (chunks.has(c)) {return chunks.get(c);}
  const slot = modN(c, STREET_PLAN.length), tier = chunkTier(slot), z0 = c * CHUNK_LEN;
  const r = rngN(seed + slot * 7919 + STREET_SEED * 104729);   // the same seed always grows the same street
  const style = chunkStyle(slot), sty = style ? STYLES_LOT[style] : null;
  const ch = { c, slot, tier, z0, lots: [], props: [], back: [], style };
  for (const side of [-1, 1]) {
    let z = z0 + CROSS_W + 0.5;
    while (z < z0 + CHUNK_LEN - 3) {
      const len = sty ? mixN(sty.len[0], sty.len[1], r()) : lotLength(tier, r); if (z + len > z0 + CHUNK_LEN - 1) {break;}
      const L = makeLot(tier, side, z, len, r); if (sty) {styleLot(L, style, r);}
      ch.lots.push(L); z += len + (style === 'bungalow' ? 1.6 : r() < 0.3 ? 1 : 0.15);   // the gap to the next lot
    }
    // A taller back row seen through the cross streets.
    ch.back.push({ side, z0: z0 + CROSS_W - 2, z1: z0 + CHUNK_LEN, x: EDGE_X + 26, h: [9, 14, 20, 40, 80][tier] * mixN(0.8, 1.3, r()), color: pickN(r, ['#c99a7a', '#b78a8a', '#9fa8b8', '#c2b090']) });
  }
  // Street furniture.
  for (let z = z0 + CROSS_W + 2; z < z0 + CHUNK_LEN; z += 12) {for (const side of [-1, 1]) {ch.props.push({ kind: 'lamp', x: side * (ROAD_W + 0.55), z: z + (side > 0 ? 6 : 0), side, flick: r() });}}
  // Street trees along the kerb (they wait for buildings, see propWaits).
  {for (let z = z0 + CROSS_W + 5; z < z0 + CHUNK_LEN - 2; z += 9) {for (const side of [-1, 1]) {if (r() < 0.8) {ch.props.push({ kind: 'tree', x: side * (ROAD_W + 2.3), z: z + r() * 2, h: mixN(4, 6.5, r()), tone: r() });}}}}
  plotsForChunk(ch, r);
  addResidents(ch);
  chunks.set(c, ch); return ch;
}
function lotLength(tier, r) { return [mixN(5, 7.5, r()), mixN(6, 8.5, r()), mixN(14, 18, r()), mixN(10, 15, r()), mixN(16, 24, r())][tier]; }
// One lot: its size, colours and details by district tier (0 small shops .. 4 skyscrapers).
// Building styles from world.js (cabin, cinema, factory ...) are applied on top by styleLot.
function makeLot(tier, side, z, len, r) {
  const L = { tier, side, z0: z, z1: z + len, seed: Math.floor(r() * 1e9), setback: 0 };
  if (tier === 0) {Object.assign(L, { H: mixN(3.4, 5.4, r()), depth: mixN(6, 9, r()), color: pickN(r, ['#7d8f8a', '#9b7b5a', '#8a6a4a', '#6f8399', '#a08060', '#7a6a5e', '#8f9a7a']), accent: pickN(r, ['#c9b48a', '#b3c4c0', '#c78f6a']), crooked: (r() - 0.5) * 0.5, name: pickN(r, SHOP_NAMES[0]), sign: r() < 0.75 });}
  else if (tier === 1) {Object.assign(L, { H: mixN(6.8, 9.2, r()), depth: mixN(8, 11, r()), color: pickN(r, ['#e8a0a8', '#f2c28a', '#a8d0c8', '#c8b8e0', '#f0d890', '#9cc0e0', '#e6b8a2']), accent: '#fbf6ee', awning: pickN(r, [PALETTE.pink, PALETTE.orange, '#3f8fd6', '#5fb36b']), name: pickN(r, SHOP_NAMES[1]), sign: r() < 0.6 });}
  else if (tier === 2) {Object.assign(L, { H: mixN(9, 12, r()), depth: mixN(12, 15, r()), setback: mixN(5, 7, r()), color: pickN(r, ['#f2ead8', '#e8dcc0', '#f0e4d0', '#efe2c4']), accent: '#5a6b7e', fountain: r() < 0.45 });}
  else if (tier === 3) {Object.assign(L, { H: mixN(15, 34, r()), depth: mixN(12, 16, r()), color: r() < 0.65 ? pickN(r, ['#a8483a', '#b85a40', '#8c3e34', '#9a5038']) : pickN(r, ['#5e8fa8', '#6aa0b8', '#4f7f98']), glass: false, name: pickN(r, SHOP_NAMES[3]), sign: r() < 0.7 });}
  else {Object.assign(L, { H: mixN(45, 120, r()), depth: mixN(16, 22, r()), color: pickN(r, ['#7fa8c8', '#8fb6d0', '#a7bcd0', '#6f98bc']), crown: r() < 0.7, spire: r() < 0.5 });}
  if (tier === 3) {L.glass = L.color.startsWith('#5') || L.color.startsWith('#6') || L.color.startsWith('#4');}
  return L;
}

/* ---------- Every frame ---------- */
function draw() {
  const dt = Math.min(deltaTime / 1000, 0.05); if (!paused) {clockT += dt;}
  // Input.
  const focus = document.activeElement === canvasNode, back = held('ArrowDown');
  const fwd = held('KeyW') || held('ArrowUp') || pointerHeld, hurry = held('ShiftLeft') || held('ShiftRight');
  let target = 0;
  const busy = intro || ending || backT > 0.01;   // a card is up, or you are turning round: stand still
  if (busy) { target = 0; }
  else if (!paused && focus) { if (back) {target = -WALK_SPD * 0.7;} else if (fwd) {target = hurry ? RUN_SPD : WALK_SPD;} else if (autoWalk) {target = hurry ? RUN_SPD : STROLL_SPD;} }
  // With the camera on, walking or running on the spot moves you down the street at that pace.
  if (target === 0 && !paused && !busy) { target = bodySpeed(); }
  stepSpeed = paused ? 0 : lerp(stepSpeed, target, 1 - Math.exp(-dt * 4.5));
  distanceWalked = Math.max(0, distanceWalked + stepSpeed * dt);
  // Footsteps drive the head bob.
  const ratio = Math.min(1.5, Math.abs(stepSpeed) / WALK_SPD);
  if (!paused && Math.abs(stepSpeed) > 0.08) { const b = Math.floor(stepPhase); stepPhase += dt * (1.6 + Math.min(Math.abs(stepSpeed), 7) * 0.3); if (Math.floor(stepPhase) !== b) {sound.footstep(Math.abs(stepSpeed) / RUN_SPD);} }
  bobAmp = lerp(bobAmp, ratio, 1 - Math.exp(-dt * 4));
  const mx = mouseMoved ? mouseX / width - 0.5 : 0, my = mouseMoved ? mouseY / height - 0.5 : 0;
  // Stop walking and you can stop and look: the mouse turns your head much further, and if you
  // stand still beside a home for sale, you turn to face it.
  stillT = Math.abs(stepSpeed) < 0.15 && !intro ? stillT + dt : 0;
  const lookRange = mixN(0.3, 1.2, easeN((stillT - 0.3) / 0.8));
  const yawAim = constrain(mx, -0.5, 0.5) * 2 * lookRange;
  lookYaw = lerp(lookYaw, yawAim, 0.05);
  lookPitch = lerp(lookPitch, constrain(my, -0.5, 0.5) * 0.2, 0.05);
  backT = constrain(backT + (backWant ? 1 : -1) * dt / 1.1, 0, 1); backS = backT * backT * (3 - 2 * backT);
  const z = distanceWalked, swing = Math.sin(PI * stepPhase), dip = Math.abs(Math.sin(PI * stepPhase));
  cam.f = Math.max(height * 0.85, width * 0.55); cam.z = z; cam.x = swing * 0.05 * bobAmp; cam.yaw = lookYaw + (backS < 0.5 ? backS * PI : 0); cam.cx = width / 2;
  cam.eye = EYE_H + (0.045 * dip - 0.03) * bobAmp; cam.hy = height * 0.52 - lookPitch * cam.f + Math.cos(TWO_PI * stepPhase) * 0.005 * bobAmp * cam.f;
  // World state: blocks in view, what is due to appear, your hands and the sound.
  const c0 = Math.floor((z - 6) / CHUNK_LEN), c1 = Math.floor((z + FAR_Z) / CHUNK_LEN);
  for (let c = c0; c <= c1; c++) {chunkAt(c);}
  // The street behind you is kept (with everything you cut and built) so you can look back at it.
  const cb = Math.floor((z - FAR_Z * 0.7) / CHUNK_LEN);
  if (backT > 0) { for (let c = cb; c < c0; c++) {chunkAt(c);} }
  for (const [c] of chunks) {if (c < cb - 1 || c > c1 + 1) {chunks.delete(c);}}
  updateLandmarks(z); worldUpdate(z);
  night = lerp(night, nightTarget, 1 - Math.exp(-dt * 0.5));
  // How built-up is the street around you? 0 = all forest, 1 = all buildings.
  let builtN = 0, lotN = 0;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (Math.abs((L.z0 + L.z1) / 2 - z) < 60) { lotN++; builtN += Math.min(1, lotRise(L)); } } }
  sound.devK = lotN ? builtN / lotN : 0;
  sound.update();
  push(); translate(width / 2, height / 2); rotate(swing * 0.005 * bobAmp); translate(-width / 2, -height / 2);
  // Drawing is wrapped so one bad shape (say, mid-turn) can never freeze the sketch.
  try { mirrorView = backS >= 0.5; drawSky(); if (mirrorView) { drawMirrored(z); } else { drawSkyline(); drawGround(z); drawWorld(z); } drawStreetLife(); } catch (err) { if (!window.plotlineWarned) { window.plotlineWarned = true; console.warn(err); } }
  pop();
  // A quick blink hides the moment the view swaps to the street behind you.
  const blink = backT > 0 && backT < 1 ? Math.max(0, 1 - Math.abs(backS - 0.5) / 0.14) : 0;
  if (blink > 0) { ctx.fillStyle = `rgba(20,16,12,${0.75 * blink})`; ctx.fillRect(0, 0, width, height); }
  drawOverlays();
}
// The street behind you, drawn by mirroring it so it lies ahead: z' = 2A - z, x' = -x (a half turn).
// A is a chunk boundary, so mirrored chunks still line up with the 48 m grid. Objects are wrapped
// with Object.create, so everything else about them (born, cut, grow...) reads through unchanged.
function drawMirrored(z) {
  const A = Math.ceil(z / CHUNK_LEN) * CHUNK_LEN, nA = A / CHUNK_LEN;
  const mz = v => 2 * A - v;
  const keep = [...chunks.entries()], keepCam = { x: cam.x, z: cam.z, yaw: cam.yaw };
  chunks.clear();
  for (const [c, ch] of keep) {
    const m = Object.create(ch); m.z0 = mz(ch.z0 + CHUNK_LEN); m.mir = true;
    m.lots = ch.lots.map(L => { const o = Object.create(L); o.z0 = mz(L.z1); o.z1 = mz(L.z0); o.side = -L.side; return o; });
    m.back = ch.back.map(b => { const o = Object.create(b); o.z0 = mz(b.z1); o.z1 = mz(b.z0); o.side = -b.side; return o; });
    m.props = ch.props.map(p => { const o = Object.create(p); o.z = mz(p.z); o.x = -p.x; if (p.side) { o.side = -p.side; } return o; });
    chunks.set(2 * nA - c - 1, m);
  }
  cam.z = mz(z); cam.x = -cam.x; cam.yaw = lookYaw + (backS - 1) * PI;
  try { drawGround(cam.z); drawWorld(cam.z); }
  finally { chunks.clear(); for (const [k, v] of keep) { chunks.set(k, v); } Object.assign(cam, keepCam); }
}

/* ---------- Things appearing: buildings rising, back rows and street furniture ---------- */
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
// Back rows and street furniture appear as you come near. A back row waits until every lot in
// front of it is built; lamps, trees and people wait for buildings near them (propWaits).
function updateLandmarks(z) {
  for (const ch of chunks.values()) {
    for (const b of ch.back) {if (b.born === undefined && b.z0 - z < APPEAR_Z + 10 && !ch.lots.some(L => L.side === b.side && L.born === undefined)) {b.born = clockT + 0.4 + birthDelay(ch.c * 13, b.z0 - z);}}
    for (const p of ch.props) {if (p.born === undefined && p.z - z < APPEAR_Z - 8 && !propWaits(ch, p)) {p.born = clockT + birthDelay(Math.floor(p.z * 7), p.z - z);}}
  }
}

/* ---------- Sky and skyline ---------- */
function skyColors() {
  const dayCols = ['#c9a46e', '#d9c194', '#e8dcbc', '#8a96a6'], dusk = ['#5a3a7a', '#c86a7a', '#ffb070', '#1d2a55'];
  // Smog: the more you have built, the greyer the sky (smogK, from world.js).
  const smog = ['#8e8a84', '#a19d95', '#b7b0a3', '#5e6168'], sm = smogNow() * 0.8;
  return dayCols.map((c, i) => mixHex(mixHex(c, dusk[i], night * 0.85), smog[i], sm));
}
function drawSky() {
  const [low, mid, glow, top] = skyColors(), hy = cam.hy;
  let g = ctx.createLinearGradient(0, -height * 0.2, 0, hy + 10);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(0.9, low); g.addColorStop(1, glow);
  ctx.fillStyle = g; ctx.fillRect(-80, -height * 0.3, width + 160, hy + height * 0.3 + 12);
  const sx = cam.cx - Math.tan(cam.yaw) * cam.f, sy = hy - height * 0.06;
  // The sun behind the landmark tower: a soft glow, dimmer as the smog thickens.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, height * 0.55), sunA = (1 - night) * (mirrorView ? 0.15 : 1) * (1 - 0.65 * smogNow());
  sg.addColorStop(0, `rgba(255,240,200,${0.5 * sunA})`); sg.addColorStop(0.25, `rgba(255,200,140,${0.16 * sunA})`); sg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sg; ctx.fillRect(-80, -height * 0.3, width + 160, height * 1.3);
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
      cg.addColorStop(0, rgbaN(mixHex(mixHex('#fff6e2', '#d8b0d0', night), '#b4b1aa', smogNow() * 0.7), 0.85)); cg.addColorStop(0.6, rgbaN(mixHex(mixHex('#ffcf98', '#8a6a9a', night), '#8f8c86', smogNow() * 0.7), 0.45)); cg.addColorStop(1, rgbaN('#ffb070', 0));
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(px, py, rad, 0, TWO_PI); ctx.fill();
    }
    ctx.restore();
  }
}
function drawSkyline() {
  // Distant city at the end of the street, always out of reach, with the landmark tower in the middle.
  const hy = cam.hy, H = height, haze = skyColors()[0];
  for (const b of skyline) {
    const x = cam.cx + Math.tan(b.a - cam.yaw) * cam.f, w = b.w * H, h = b.h * H;
    const g = ctx.createLinearGradient(0, hy - h, 0, hy);
    g.addColorStop(0, mixHex(mixHex('#e8b27a', '#3a3060', night), haze, 0.3 + b.tone * 0.3)); g.addColorStop(1, mixHex('#f6c88a', '#2a2448', night));
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, hy - h, w, h + 2);
    if (b.spire) { ctx.beginPath(); ctx.moveTo(x - w * 0.2, hy - h); ctx.lineTo(x, hy - h - w * 1.2); ctx.lineTo(x + w * 0.2, hy - h); ctx.fill(); }
    ctx.fillStyle = `rgba(255,236,170,${0.25 + night * 0.5})`;
    for (let y = hy - h + 4; y < hy - 3; y += 5) {if ((y * 7 + b.a * 1000) % 3 < 1.2) {ctx.fillRect(x - w * 0.35, y, w * 0.7, 1);}}
  }
  // The landmark: a stepped art-deco tower with a glowing crown.
  const x = cam.cx - Math.tan(cam.yaw) * cam.f, s = H / 800 * 0.55;
  const tiers = [[60, 120], [46, 200], [34, 270], [22, 320], [12, 350]];
  ctx.save();
  for (const [w, h] of tiers) {
    const g = ctx.createLinearGradient(x - w * s, 0, x + w * s, 0);
    g.addColorStop(0, mixHex(mixHex('#c88a50', '#3a3366', night), haze, 0.45)); g.addColorStop(0.5, mixHex(mixHex('#f0dcb0', '#8a7ac8', night), haze, 0.45)); g.addColorStop(1, mixHex(mixHex('#b07a48', '#2e2a55', night), haze, 0.45));
    ctx.fillStyle = g; ctx.fillRect(x - w * s, hy - h * s, w * 2 * s, h * s + 2);
  }
  ctx.fillStyle = mixHex('#fff4c8', '#c8b8ff', night); ctx.beginPath(); ctx.moveTo(x - 5 * s, hy - 350 * s); ctx.lineTo(x, hy - 440 * s); ctx.lineTo(x + 5 * s, hy - 350 * s); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(x, hy - 330 * s, 0, x, hy - 330 * s, 90 * s); cg.addColorStop(0, 'rgba(255,240,180,0.15)'); cg.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = cg; ctx.fillRect(x - 90 * s, hy - 420 * s, 180 * s, 180 * s);
  ctx.restore();
  // Golden haze over the horizon.
  const g = ctx.createLinearGradient(0, hy - H * 0.18, 0, hy + 4);
  g.addColorStop(0, rgbaN(haze, 0)); g.addColorStop(1, rgbaN(mixHex(mixHex('#ffd79a', '#7a5a8a', night), '#a8a49e', smogNow() * 0.65), 0.75));
  ctx.fillStyle = g; ctx.fillRect(-80, hy - H * 0.18, width + 160, H * 0.18 + 4);
}

/* ---------- Ground: road, pavements, crossings ---------- */
// The road is drawn in 90 strips from far to near, longer strips further away.
function drawGround(z) {
  const hy = cam.hy;
  ctx.fillStyle = mixHex('#b89a78', '#3a3448', night); ctx.fillRect(-80, hy, width + 160, height - hy + 80);
  const steps = 90;
  for (let i = steps; i > 0; i--) {
    const d0 = NEAR_Z + Math.pow((i - 1) / steps, 2.2) * FAR_Z, d1 = NEAR_Z + Math.pow(i / steps, 2.2) * FAR_Z;
    const za = z + d0, zb = z + d1;
    const ch = chunkAt(Math.floor(za / CHUNK_LEN)), local = ch.mir ? ch.z0 + CHUNK_LEN - za : za - ch.z0, crossing = local < CROSS_W;
    const fog = easeN(d0 / FAR_Z), fogC = hazeHex();
    const f = (hex) => mixHex(mixHex(hex, '#2a2440', night * 0.55), fogC, fog * 0.8);
    // Road.
    polyN([P(-ROAD_W, 0, za), P(ROAD_W, 0, za), P(ROAD_W, 0, zb), P(-ROAD_W, 0, zb)], f(crossing ? '#5a5a62' : '#4a4a52'));
    for (const side of [-1, 1]) {
      if (crossing) {
        // Cross street running off to the sides.
        polyN([P(side * ROAD_W, 0, za), P(side * 90, 0, za), P(side * 90, 0, zb), P(side * ROAD_W, 0, zb)], f('#55555d'));
      } else {
        const tile = Math.floor(za / 1.6) % 2;
        polyN([P(side * ROAD_W, 0.12, za), P(side * EDGE_X, 0.12, za), P(side * EDGE_X, 0.12, zb), P(side * ROAD_W, 0.12, zb)], f(tile ? '#d6d0c4' : '#cdc6b8'));
        // The kerb: a grey edge and a thin coloured band.
        polyN([P(side * ROAD_W, 0.13, za), P(side * (ROAD_W + 0.3), 0.13, za), P(side * (ROAD_W + 0.3), 0.13, zb), P(side * ROAD_W, 0.13, zb)], f('#b4ada2'));
        polyN([P(side * (ROAD_W + 0.3), 0.13, za), P(side * (ROAD_W + 0.42), 0.13, za), P(side * (ROAD_W + 0.42), 0.13, zb), P(side * (ROAD_W + 0.3), 0.13, zb)], f(mixHex(PALETTE.pink, '#b4ada2', 0.35)));
        polyN([P(side * EDGE_X, 0.05, za), P(side * (EDGE_X + 40), 0.05, za), P(side * (EDGE_X + 40), 0.05, zb), P(side * EDGE_X, 0.05, zb)], f('#6f9a52'));
      }
    }
    // Centre line and zebra crossings.
    if (!crossing && Math.floor(za / 3) % 2 === 0) {polyN([P(-0.08, 0.01, za), P(0.08, 0.01, za), P(0.08, 0.01, zb), P(-0.08, 0.01, zb)], f('#f4e6b0'));}
    if (local > 1 && local < 4) {for (let x = -ROAD_W + 0.3; x < ROAD_W; x += 0.9) {polyN([P(x, 0.01, za), P(x + 0.5, 0.01, za), P(x + 0.5, 0.01, zb), P(x, 0.01, zb)], f('#f2efe6'));}}
  }
}

/* ---------- The street, far to near: back rows, forest, buildings, people ---------- */
function drawWorld(z) {
  const all = [...chunks.values()];
  // Back row first, then buildings far to near, then pavement life far to near.
  const backs = all.flatMap(ch => ch.back).filter(b => b.z1 > z + NEAR_Z).sort((a, b) => b.z0 - a.z0);
  for (const b of backs) {
    const g = riseOf(b.born), fk = 1 - Math.min(1, g * 1.4);   // the back row is forest until it rises
    if (fk > 0.02) { drawForest({ seed: Math.floor(b.z0 * 13) + b.side, z0: b.z0, z1: b.z1, side: b.side, depth: 14, setback: 0 }, fk, b.x - EDGE_X - 4); }
    if (g > 0.01) { riseK = g; drawBack(b); riseK = 1; }
  }
  const lots = all.flatMap(ch => ch.lots).filter(L => L.z1 > z + NEAR_Z && L.z0 < z + FAR_Z).sort((a, b) => b.z0 - a.z0);
  for (const L of lots) {
    const rise = lotRise(L), g = rise;   // 0 = forest .. 1 = built (world.js: floor by floor under your hand)
    // Before it is built, every lot is forest; as the building rises, the trees go down
    // (or, with your hands, they fall when you chop them and stumps are left).
    const cut = L.cutT !== undefined, forestK = cut ? 1 - Math.min(1, rise * 2) : 1 - Math.min(1, rise * 1.4), fall = cut ? easeN((clockT - L.cutT) / 0.7) : 0;
    if (g <= 0.01) { drawPlot(L); drawForest(L, forestK, 0, fall, cut); continue; }
    if (forestK > 0.02) { drawForest(L, forestK, 0, fall, cut); }
    if (g > 0.01) { riseK = g; drawLot(L); riseK = 1; if (L.born === undefined && L.grow > 0) { drawScaffold(L, g); } }
    const age = L.born === undefined ? clockT - L.cutT : clockT - L.born; if (age < RISE_T + 0.8) {drawDust(L, Math.min(age, RISE_T));}
  }
  const items = [];
  for (const ch of all) {
    for (const p of ch.props) { const g = riseOf(p.born); if (g <= 0.01) {continue;} const q = P(p.x, 0, p.z); if (q.rz > 0.8 && q.rz < FAR_Z * 0.7) {items.push({ q, p, kind: p.kind, g });} }
    for (const L of ch.lots) {if (L.tier === 2) { const g = riseOf(L.born); if (g <= 0.01) {continue;} const q = P(L.side * (EDGE_X + 0.3), 0, (L.z0 + L.z1) / 2); if (q.rz > 0.8) {items.push({ q, p: L, kind: 'yard', g });} }}
  }
  items.sort((a, b) => b.q.rz - a.q.rz);
  for (const it of items) {
    // Props pop up from their base point; yards rise with their mansion.
    if (it.kind === 'yard') { riseK = it.g; drawYard(it.p); riseK = 1; continue; }
    ctx.save(); ctx.translate(it.q.x, it.q.y); ctx.scale(Math.min(1, 0.4 + it.g * 0.6), it.g); ctx.translate(-it.q.x, -it.q.y);
    if (it.kind === 'lamp') {drawLamp(it.q, it.p);} else if (it.kind === 'tree') {drawTree(it.q, it.p);} else {drawPerson(it.q, it.p);}
    ctx.restore();
  }
  drawBirds();
}
// Land nobody has built on yet: forest floor.
function drawPlot(L) {
  const z0 = clipZ(L.z0); if (L.z1 <= z0) {return;}
  const xa = L.side * (EDGE_X + 0.2), xb = L.side * (EDGE_X + L.setback + L.depth + 2), mz = (z0 + L.z1) / 2;
  polyN([P(xa, 0.03, z0), P(xb, 0.03, z0), P(xb, 0.03, L.z1), P(xa, 0.03, L.z1)], toneN('#3f5a32', mz));
}
// The forest that stood here before the street was built: a stand of trees on every lot,
// sinking into the ground as the building rises (k = how much forest is left, 1 to 0).
function drawForest(L, k, back = 0, fall = 0, cut = false) {
  if (k <= 0.02) { return; }
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
      drawBrushTree(q, t.kind, t.tone, t.h, t.z); ctx.restore(); continue;
    }
    ctx.save(); ctx.translate(q.x, q.y); ctx.scale(Math.min(1, 0.5 + k * 0.5), k); ctx.translate(-q.x, -q.y);
    drawBrushTree(q, t.kind, t.tone, t.h, t.z); ctx.restore();
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

/* ---------- A building: its walls, then what its style draws on them ---------- */
function drawLot(L) {
  const H = L.H, x = L.side * (EDGE_X + L.setback), xo = L.side * (EDGE_X + L.setback + L.depth);
  const z0 = clipZ(L.z0), z1 = L.z1, mid = (z0 + z1) / 2;
  if (z1 <= z0) {return;}
  // Car parks and petrol stations are open lots: no building box, only what stands on them.
  const open = L.style === 'carpark' || L.style === 'petrol' || L.style === 'substation';
  if (open) { const nq = P(x, 0, z0); if (nq.rz < FAR_Z) { drawStyled(L, x, z0, z1, H); } return; }
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
  drawMaterial(L, x, z0, z1, H);
  if (L.style) { drawStyled(L, x, z0, z1, H); } else { [drawShack, drawTownhouse, drawMansion, drawBrick, drawTower][L.tier](L, x, z0, z1, H); }
  drawWeathering(L, x, z0, z1, H);
  // The artwork's slogan, painted on the wall.
  paintSlogan(L, x, z0, H);
  // An empty tower remembers what stood here.
  if (L.vacant) { facadeSign(L, x, z0, L.z0 + 0.2, L.z1 - 0.2, 1.2, 2.3, '#eee4d0', '#413c39', 'FORMERLY ' + L.formerName, null); }
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
// One window on a facade at x, between za..zb along the street and ya..yb up.
function winN(L, x, z0, za, zb, ya, yb, glass, frame, lit) {
  if (zb <= z0) { return; }
  const q = wallQuad(x - L.side * 0.04, Math.max(za, z0), x - L.side * 0.04, zb, ya, yb);
  if (frame) { windowSill(L, x, z0, za, zb, ya, frame); }
  polyN(q, glassFill(q, lit ? '#ffd98a' : glass, lit, za), frame ? toneN(frame, za) : null, 1.5);
  if (frame) { windowBars(q, frame, za); }
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
// Rows of roof tiles and a gutter, on a roof plane from the eave (e) up to the ridge (r).
function roofCourses(ex, ey, ez0, ez1, rx, ry, rz0, rz1, col, z, n = 9) {
  const a = P(ex, ey, ez0); if (a.rz < 1 || a.k * (ry - ey) / n < 2.5) { return; }
  ctx.strokeStyle = toneN(col, z, 0.72); ctx.lineWidth = Math.min(2.5, Math.max(1, a.k * 0.025)); ctx.beginPath();
  for (let i = 1; i < n; i++) { const t = i / n, p0 = P(lerp(ex, rx, t), lerp(ey, ry, t), lerp(ez0, rz0, t)), p1 = P(lerp(ex, rx, t), lerp(ey, ry, t), lerp(ez1, rz1, t)); segN(p0, p1); }
  ctx.stroke();
  const g0 = P(ex, ey - 0.05, ez0), g1 = P(ex, ey - 0.05, ez1); ctx.strokeStyle = toneN('#e8e4dc', z, 0.9); ctx.lineWidth = Math.min(5, Math.max(1.5, P(ex, ey, (ez0 + ez1) / 2).k * 0.1)); ctx.beginPath(); segN(g0, g1); ctx.stroke();
}
// What the wall is made of: weatherboards, brick or render.
function wallMaterial(L) {
  if (L.style === 'bungalow') { return L.brick ? 'brick' : 'board'; }
  if (L.style === 'caravan' || L.style === 'factory' || L.style === 'carpark' || L.style === 'petrol') { return null; }
  if (L.style === 'apartment') { return 'render'; }
  if (L.style === 'cabin') { return 'board'; }
  if (L.style === 'canal' || L.style === 'cinema') { return 'brick'; }
  if (L.style === 'greencondo' || L.style === 'supermarket' || L.style === 'mall' || L.style === 'datacentre') { return 'render'; }
  if (L.style === 'modern' || L.style === 'diner' || L.style === 'substation' || L.style === 'powerplant' || L.style === 'slanttop') { return null; }
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
  if (L.style !== 'caravan' && L.style !== 'slanttop' && L.style !== 'diner' && !(L.tier === 4 && !L.style)) {
    const e0 = P(x, H, mid), e1 = P(x, H - 1, mid);
    g = ctx.createLinearGradient(e0.x, e0.y, e1.x, e1.y); g.addColorStop(0, 'rgba(20,12,6,0.34)'); g.addColorStop(1, 'rgba(20,12,6,0)');
    polyN(wallQuad(x - s * 0.21, z0, x - s * 0.21, z1, H - 1, H), g);
  }
  const sh = P(x - s * 1.2, 0, mid);
  g = ctx.createLinearGradient(base.x, base.y, sh.x, sh.y); g.addColorStop(0, 'rgba(20,12,6,0.22)'); g.addColorStop(1, 'rgba(20,12,6,0)');
  polyN([P(x, 0.02, z0), P(x, 0.02, z1), P(x - s * 1.2, 0.02, z1), P(x - s * 1.2, 0.02, z0)], g);
}

/* ---------- Buildings by tier: small shop, terrace, mansion, brick offices, glass tower ---------- */
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

/* ---------- Buildings by style (world.js STYLES_LOT): size and colours, and the function that draws each ---------- */
function styleLot(L, style, r) {
  const st = STYLES_LOT[style];
  Object.assign(L, { style, setback: st.setback, sign: false, name: '', crooked: 0 });
  if (style === 'villa') { Object.assign(L, { H: mixN(6.6, 7.6, r()), depth: 14, color: pickN(r, ['#f4ead8', '#f8e4c8', '#fff4e0', '#f0e0d8']), roof: pickN(r, ['#c8643a', '#b8583a', '#d07a4a']), fountain: r() < 0.6 }); }
  else if (style === 'bungalow') { Object.assign(L, { H: mixN(3.2, 3.7, r()), depth: 12, color: pickN(r, ['#f2d8b0', '#d8e8f0', '#f0d0d0', '#e0ecd0', '#fff0c8', '#d8d0e8']), roof: pickN(r, ['#8a5a4a', '#5a6a7a', '#a0583a', '#6a7a5a']), door: pickN(r, ['#c8322a', '#2f6a9a', '#2e7a47', '#f2b23a']), tree: r() < 0.6 }); if (r() < 0.45) { L.brick = true; L.color = pickN(r, ['#b8684a', '#a85a40', '#c47e5a', '#9a5a48', '#c89a78']); } }
  else if (style === 'apartment') { Object.assign(L, { H: mixN(16, 28, r()), depth: 12, color: pickN(r, ['#e8e0d0', '#d8d4cc', '#e8d0b8', '#c8d0d8', '#f0e4c8']) }); }
  else if (style === 'factory') { Object.assign(L, { H: mixN(7.5, 10, r()), depth: 20, color: pickN(r, ['#9aa2a8', '#a8a49a', '#8c969c', '#b0a08a']), chimneys: r() < 0.5 ? 2 : 1, name: pickN(r, ['TIMBERLAND MILL', 'FOREST PRODUCTS CO.', 'GREENWOOD PULP & PAPER', 'PROGRESS PLASTICS']) }); }
  else if (style === 'carpark') { Object.assign(L, { H: 0.6, depth: 16, color: '#3c3c42', name: pickN(r, ['CITY PARKING', 'PARK & SHOP', 'EASY PARK']) }); }
  else if (style === 'petrol') { Object.assign(L, { H: 5.4, depth: 14, color: '#d8d4cc', name: pickN(r, ['FUEL & GO', 'GREENWAY PETROL', 'OCTANE']), brand: pickN(r, ['#d8322a', '#2a8a4a', '#e8a01a', '#2a5ab8']) }); }
  else if (style === 'cabin') { Object.assign(L, { H: mixN(2.6, 3, r()), depth: 8, color: pickN(r, ['#8a5a3a', '#9a6a42', '#7a4e32']), roof: pickN(r, ['#3a4a3a', '#4a3a32', '#2f3a44']), door: pickN(r, ['#c8322a', '#2e7a47', '#f2b23a']) }); }
  else if (style === 'canal') { Object.assign(L, { H: mixN(8.5, 10, r()), depth: 10, color: '#d8c8b0' }); }
  else if (style === 'modern') { Object.assign(L, { H: mixN(6.2, 7, r()), depth: 12, color: pickN(r, ['#a8744a', '#8a5a3a', '#3a3e44', '#c8b49a']) }); }
  else if (style === 'greencondo') { Object.assign(L, { H: mixN(30, 48, r()), depth: 14, color: pickN(r, ['#d8d4cc', '#e0dcd2']), name: pickN(r, ['THE TREE RESIDENCES', 'CANOPY LIVING', 'FOREST TOWER']) }); }
  else if (style === 'diner') { Object.assign(L, { H: 3.6, depth: 12, color: '#d8dce0', brand: pickN(r, ['#d8322a', '#2a9a9a', '#e86a2a']), name: pickN(r, ['DINER', 'MOONLIGHT DINER', 'STAR DINER']) }); }
  else if (style === 'supermarket') { Object.assign(L, { H: 6.5, depth: 24, color: pickN(r, ['#e8e4dc', '#d8d4cc']), brand: pickN(r, ['#d8322a', '#2a8a4a', '#e8a01a']), name: pickN(r, ['MEGA MART', 'VALUE WORLD', 'FRESH CO.', 'BIG SAVE']) }); }
  else if (style === 'cinema') { Object.assign(L, { H: 10, depth: 18, color: pickN(r, ['#a8483a', '#8c3e34', '#9a5038']), name: pickN(r, ['ROYAL', 'PALACE', 'REGAL', 'STAR']), film: pickN(r, ['NOW SHOWING: THE LAST TREE', 'NOW SHOWING: CONCRETE JUNGLE', 'NOW SHOWING: GONE WITH THE WOOD']) }); }
  else if (style === 'mall') { Object.assign(L, { H: mixN(14, 18, r()), depth: 30, color: pickN(r, ['#e0d8c8', '#d0ccc4']), name: pickN(r, ['FOREST PLAZA', 'GREENFIELD MALL', 'THE GROVE CENTRE']) }); }
  else if (style === 'substation') { Object.assign(L, { H: 0.5, depth: 14, color: '#9a968e' }); }
  else if (style === 'powerplant') { Object.assign(L, { H: mixN(10, 12, r()), depth: 16, color: pickN(r, ['#a8a49a', '#9aa2a8']), name: pickN(r, ['GREENPOWER STATION', 'CLEAN ENERGY CO.']) }); }
  else if (style === 'datacentre') { Object.assign(L, { H: mixN(8, 10, r()), depth: 22, color: pickN(r, ['#c8ccd2', '#b8bcc4']), name: pickN(r, ['THE CLOUD', 'CLOUD CAMPUS', 'DATA FOREST']) }); }
  else if (style === 'slanttop') { Object.assign(L, { depth: 20, color: pickN(r, ['#7fa8c8', '#8fb6d0', '#6f98bc']), crown: false, spire: false, glass: true }); }
  else if (style === 'caravan') { Object.assign(L, { H: mixN(2.4, 2.7, r()), depth: 3.2, color: pickN(r, ['#f2eee2', '#e8e4d6', '#dfe6ea', '#efe2c8']), band: pickN(r, ['#4a8ab8', '#c86a3a', '#6a9a5a', '#b84a4a']), rust: r(), awn: r() < 0.6 ? pickN(r, ['#3f8fd6', '#e8a030', '#5fa35b', '#c84a4a']) : null, wash: r() < 0.4 }); }
}
function drawStyled(L, x, z0, z1, H) {
  if (L.style === 'villa') { drawVilla(L, x, z0, z1, H); }
  else if (L.style === 'bungalow') { drawBungalow(L, x, z0, z1, H); }
  else if (L.style === 'caravan') { drawCaravan(L, x, z0, z1, H); }
  else if (L.style === 'apartment') { drawApartment(L, x, z0, z1, H); }
  else if (L.style === 'factory') { drawFactory(L, x, z0, z1, H); }
  else if (L.style === 'carpark') { drawCarpark(L, x, z0, z1, H); }
  else if (L.style === 'petrol') { drawPetrol(L, x, z0, z1, H); }
  else {
    const fn = { cabin: drawCabin, canal: drawCanal, modern: drawModern, greencondo: drawGreenCondo, diner: drawDiner, supermarket: drawSupermarket, cinema: drawCinema, mall: drawMall, substation: drawSubstation, powerplant: drawPowerPlant, datacentre: drawDataCentre, slanttop: drawSlantTop }[L.style];
    if (fn) { fn(L, x, z0, z1, H); }
  }
}

/* ---------- Homes ---------- */
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
// A log cabin: a deck, small windows and a steep A-frame roof that reaches almost to the ground.
function drawCabin(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), r = rngN(L.seed + 21), d = L.depth, ridge = x + s * d / 2, RH = H + d * 0.85;
  const lit = [r(), r()];
  polyN([P(x, 0.45, z0), P(x, 0.45, z1), P(x - s * 1.6, 0.45, z1), P(x - s * 1.6, 0.45, z0)], toneN('#a07850', mid));
  polyN(wallQuad(x - s * 1.6, z0, x - s * 1.6, z1, 0, 0.45), toneN('#6a4a30', mid));
  const dz = L.z0 + len * 0.45;
  if (dz + 1 > z0) { polyN(wallQuad(x - s * 0.05, Math.max(dz, z0), x - s * 0.05, dz + 1, 0.45, 2.3), toneN(L.door, dz)); }
  [0.12, 0.68].forEach((u, i) => { const za = L.z0 + len * u; winN(L, x, z0, za, za + len * 0.16, 1.1, 2.1, '#4a5a60', '#e8d8b0', lit[i] < 0.4 + night * 0.6); });
  polyN([P(x - s * 0.8, H - 0.3, z0), P(x - s * 0.8, H - 0.3, z1 + 0.3), P(ridge, RH, z1 + 0.3), P(ridge, RH, z0)], toneN(L.roof, mid));
  roofCourses(x - s * 0.8, H - 0.3, z0, z1 + 0.3, ridge, RH, z0, z1 + 0.3, L.roof, mid, 7);
  if (L.z0 > cam.z + NEAR_Z) {
    const xo = x + s * (d + 0.8), zg = L.z0 - 0.3;
    polyN([P(x - s * 0.8, H - 0.3, zg), P(xo, H - 0.3, zg), P(ridge, RH, zg)], toneN(L.color, L.z0, 0.8));
    polyN([P(x + s * 1.4, H + 0.2, zg - 0.02), P(xo - s * 2.2, H + 0.2, zg - 0.02), P(ridge, RH - 1.8, zg - 0.02)], toneN(night > 0.3 ? '#ffd98a' : '#7a98a8', L.z0));
  }
  // A stove pipe with a thread of smoke.
  const pz = L.z0 + len * 0.75; if (pz > z0) {
    polyN(wallQuad(ridge - s * 1.2, pz, ridge - s * 1.2, pz + 0.3, RH - 2.4, RH + 0.8), toneN('#3a3a3a', pz));
    for (let i = 0; i < 5; i++) { const t = modN(clockT * 0.2 + i / 5, 1), p = P(ridge - s * 1.2, RH + 1 + t * 5, pz - t * 3); if (p.rz > 1) { ctx.fillStyle = rgbaN('#e8e4dc', 0.45 * (1 - t)); ctx.beginPath(); ctx.arc(p.x, p.y, (0.3 + t * 1.2) * p.k, 0, TWO_PI); ctx.fill(); } }
  }
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
// Canal row houses: narrow, tall houses side by side, each its own colour, with stepped or pointed gables.
function drawCanal(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, n = Math.max(2, Math.round(len / 3.4)), w = len / n, r = rngN(L.seed + 22), xf = x - s * 0.03;
  const COLS = ['#c8584a', '#e8b04a', '#4a7ab8', '#5a9a6a', '#efe6cf', '#b86a8a', '#2f5a6a', '#d8784a', '#8a5a9a'];
  for (let i = 0; i < n; i++) {
    const za = L.z0 + w * i, zb = za + w, col = COLS[Math.floor(r() * COLS.length)], h = H + r() * 1.4, stepped = r() < 0.5, lit = [r(), r(), r(), r(), r(), r()];
    if (zb < z0) { continue; }
    const Z = zz => Math.max(zz, z0);
    polyN(wallQuad(xf, Z(za), xf, zb, 0, h), toneN(col, za));
    // The gable on top.
    const g = stepped
      ? [[0, 0], [0.1, 0], [0.1, 0.7], [0.25, 0.7], [0.25, 1.4], [0.4, 1.4], [0.4, 2.1], [0.6, 2.1], [0.6, 1.4], [0.75, 1.4], [0.75, 0.7], [0.9, 0.7], [0.9, 0], [1, 0]]
      : [[0, 0], [0.5, 2.2], [1, 0]];
    polyN(g.map(([u, dy]) => P(xf, h + dy, Z(za + w * u))), toneN(col, za, 1.04), toneN('#fbf6ee', za), 1.5);
    polyN(wallQuad(xf - s * 0.05, Z(za), xf - s * 0.05, zb, h - 0.25, h), toneN('#fbf6ee', za));
    // Three floors of tall windows, white frames, and a door on the ground floor.
    const fh = (h - 1) / 3;
    for (let f = 0; f < 3; f++) {
      for (let k = 0; k < 2; k++) {
        const ua = 0.16 + k * 0.42; if (f === 0 && k === 0) { continue; }
        winN(L, x, z0, za + w * ua, za + w * (ua + 0.26), 0.8 + f * fh, 0.8 + f * fh + fh * 0.62, '#3a4a5a', '#ffffff', lit[f * 2 + k] < 0.25 + night * 0.6);
      }
    }
    if (za + w * 0.42 > z0) { polyN(wallQuad(xf - s * 0.02, Z(za + w * 0.16), xf - s * 0.02, za + w * 0.42, 0, 2.2), toneN(['#2f4a3a', '#5a2a2a', '#2a3a5a'][i % 3], za)); }
  }
}
// A modern house: flat roof, a glass ground floor, and a timber-clad upper floor that juts out.
function drawModern(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), xc = x - s * 1.5, ua = Math.max(L.z0 + len * 0.22, z0), lit = rngN(L.seed + 23)() < 0.5 + night * 0.5;
  const gq = wallQuad(x - s * 0.05, z0, x - s * 0.05, L.z0 + len * 0.8, 0.15, 2.9);
  polyN(gq, glassFill(gq, '#6a8494', lit, mid), toneN('#2a2a2a', mid), 2);
  if (L.z0 + len * 0.8 > z0) { ctx.strokeStyle = toneN('#2a2a2a', mid); ctx.lineWidth = 2; ctx.beginPath(); for (let u = 0.2; u < 0.8; u += 0.2) { const zz = L.z0 + len * u; if (zz > z0) { segN(P(x - s * 0.06, 0.15, zz), P(x - s * 0.06, 2.9, zz)); } } ctx.stroke(); }
  if (L.z1 > ua) {
    polyN([P(x, 3.1, ua), P(x, 3.1, L.z1), P(xc, 3.1, L.z1), P(xc, 3.1, ua)], toneN('#3a3a3a', mid, 0.7));
    polyN(wallQuad(xc, ua, xc, L.z1, 3.1, H), toneN(L.color, mid));
    ctx.strokeStyle = toneN(shadeN(L.color, 0.75), mid); ctx.lineWidth = 1; ctx.beginPath();
    for (let zz = Math.ceil(ua / 0.18) * 0.18; zz < L.z1; zz += 0.18) { segN(P(xc - s * 0.01, 3.1, zz), P(xc - s * 0.01, H, zz)); }
    ctx.stroke();
    const sq = wallQuad(xc - s * 0.03, Math.max(ua + 0.6, z0), xc - s * 0.03, L.z1 - len * 0.12, 3.9, H - 0.7);
    polyN(sq, glassFill(sq, '#5a7484', lit, mid), toneN('#1e1e1e', mid), 2);
    if (ua > cam.z + NEAR_Z) { polyN(wallQuad(x, ua, xc, ua, 3.1, H), toneN(L.color, ua, 0.6)); }
    polyN(wallQuad(xc - s * 0.04, ua, xc - s * 0.04, L.z1, H - 0.25, H), toneN('#1e1e1e', mid));
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
// A block of flats: rows of windows, a balcony on every other bay, washing and air conditioners.
function drawApartment(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), r = rngN(L.seed + 9);
  const floors = Math.max(3, Math.floor(H / 3)), bays = Math.max(2, Math.round(len / 3.6)), rows = [];
  for (let f = 1; f < floors; f++) { rows.push([f * 3 + 0.5, f * 3 + 2.3]); }
  facadeWindows(L, x, z0, z1, rows, bays, { padU: 0.2, lit: 0.35, glass: '#56687a', frame: '#e8e4dc' });
  polyN(wallQuad(x - s * 0.03, z0, x - s * 0.03, z1, 0, 3), toneN('#4a4f56', mid));
  facadeWindows(L, x, z0, z1, [[0.3, 2.7]], Math.max(1, Math.round(len / 6)), { padU: 0.1, lit: 0.8, glass: '#ffd98a' });
  for (let f = 1; f < floors; f++) {
    const y = f * 3;
    for (let i = 0; i < bays; i++) {
      const rv = r(), cv = r(), za = L.z0 + len * (i + 0.08) / bays, zb = L.z0 + len * (i + 0.92) / bays;
      if ((i + f) % 2 || zb < z0) { continue; }
      const zA = Math.max(za, z0), d = 1.3;
      polyN([P(x, y, zA), P(x, y, zb), P(x - s * d, y, zb), P(x - s * d, y, zA)], toneN('#d8d4cc', za, 0.95));
      polyN(wallQuad(x - s * d, zA, x - s * d, zb, y - 0.25, y), toneN('#bcb8b0', za));
      if (rv < 0.28) { polyN(wallQuad(x - s * (d - 0.25), zA, x - s * (d - 0.25), Math.min(zb, zA + 1.3), y + 0.95, y + 1.7), toneN(['#e86a6a', '#6aa8e8', '#f2d13a', '#ffffff'][Math.floor(cv * 4)], za)); }
      else if (rv < 0.55) { polyN(wallQuad(x - s * 0.75, zA, x - s * 0.75, Math.min(zb, zA + 0.8), y + 0.1, y + 0.7), toneN('#ecebe6', za), toneN('#9a9a96', za), 1); }
      polyN(wallQuad(x - s * d, zA, x - s * d, zb, y, y + 1.05), rgbaN(toneN('#a8c8d8', za), 0.4), toneN('#e8e8e8', za), 1);
    }
  }
  polyN(wallQuad(x - s * 0.1, z0, x - s * 0.1, z1, H - 0.5, H), toneN('#cfcac0', mid));
}
// A "vertical forest" condo: a tall concrete block with trees planted on every balcony.
function drawGreenCondo(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), floors = Math.max(4, Math.floor(H / 3.4)), bays = Math.max(2, Math.round(len / 3.4)), r = rngN(L.seed + 24);
  const rows = []; for (let f = 1; f < floors; f++) { rows.push([f * 3.4 + 0.4, f * 3.4 + 2.6]); }
  facadeWindows(L, x, z0, z1, rows, bays, { padU: 0.12, lit: 0.3, glass: '#5a7080' });
  polyN(wallQuad(x - s * 0.03, z0, x - s * 0.03, z1, 0, 3.2), toneN('#3a3e44', mid));
  facadeWindows(L, x, z0, z1, [[0.3, 2.9]], Math.max(1, Math.round(len / 5)), { padU: 0.08, lit: 0.8, glass: '#ffd98a' });
  const greens = ['#4f8a3a', '#6aa04a', '#3f7a4a', '#8ab04a', '#5a9a5a'];
  for (let f = 1; f < floors; f++) {
    const y = f * 3.4;
    polyN([P(x, y, z0), P(x, y, z1), P(x - s * 1.4, y, z1), P(x - s * 1.4, y, z0)], toneN('#d8d4cc', mid, 0.9));
    polyN(wallQuad(x - s * 1.4, z0, x - s * 1.4, z1, y - 0.3, y + 0.5), toneN('#c8c4bc', mid));
    for (let i = 0; i < bays * 2; i++) {
      const zc = L.z0 + len * (i + 0.5) / (bays * 2), sz = 0.6 + r() * 0.7, gc = greens[Math.floor(r() * greens.length)];
      if (zc < z0 + 0.4) { continue; }
      const p = P(x - s * 1.1, y + 0.6 + sz * 0.6, zc); if (p.rz < 1 || p.k * sz < 1.2) { continue; }
      ctx.fillStyle = toneN(gc, zc, 0.8); ctx.beginPath(); ctx.arc(p.x, p.y + p.k * sz * 0.2, sz * p.k, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = toneN(gc, zc, 1.1); ctx.beginPath(); ctx.arc(p.x - p.k * sz * 0.25, p.y - p.k * sz * 0.2, sz * p.k * 0.65, 0, TWO_PI); ctx.fill();
    }
  }
  facadeSign(L, x, z0, L.z0 + len * 0.15, L.z0 + len * 0.85, 2.4, 3.1, toneN('#2f5a3a', mid), '#e8f0d8', L.name);
}

/* ---------- Shops ---------- */
// A retro diner: chrome walls, a red stripe, a long window, a chequered skirt and a neon sign on the roof.
function drawDiner(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), xf = x - s * 0.04, flick = Math.sin(clockT * 19 + L.seed) > -0.92;
  const wq = wallQuad(xf, z0, xf, z1, 1.1, 2.9); polyN(wq, glassFill(wq, '#ffe4a8', true, mid), toneN('#b8bcc0', mid), 2);
  polyN(wallQuad(xf - s * 0.02, z0, xf - s * 0.02, z1, 3.0, 3.45), toneN(L.brand, mid));
  for (let zz = Math.floor(L.z0 / 0.5) * 0.5, i = 0; zz < L.z1; zz += 0.5, i++) { if (zz + 0.5 < z0) { continue; } polyN(wallQuad(xf - s * 0.02, Math.max(zz, z0), xf - s * 0.02, Math.min(zz + 0.5, L.z1), i % 2 ? 0 : 0.5, i % 2 ? 0.5 : 1), toneN('#1e1e1e', zz)); }
  polyN(wallQuad(xf - s * 0.02, z0, xf - s * 0.02, z1, 0, 1), rgbaN('#ffffff', 0.0), toneN('#1e1e1e', mid), 1);
  const dz = L.z0 + len * 0.82; if (dz + 1 > z0) { polyN(wallQuad(xf - s * 0.02, Math.max(dz, z0), xf - s * 0.02, dz + 1, 0, 2.9), toneN('#c8ccd0', dz), toneN('#7a7e82', dz), 1); }
  facadeSign(L, x, z0, L.z0 + len * 0.15, L.z0 + len * 0.75, H + 0.3, H + 1.7, '#1e1e24', flick ? '#ff6a9a' : '#5a3040', L.name, flick ? '#ff3a7a' : null, 'bold 15px Georgia, serif');
  facadeSign(L, x, z0, L.z0 + len * 0.76, L.z0 + len * 0.96, H + 0.4, H + 1.1, '#1e1e24', '#7affd8', 'OPEN 24H', '#3affc8', 'bold 11px Georgia, serif');
}
// A petrol station: forecourt, pumps under a lit canopy, a little shop at the back, a price board.
function drawPetrol(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), d = L.depth, xc = x + s * (d - 5);
  polyN([P(x, 0.03, z0), P(x, 0.03, z1), P(x + s * d, 0.03, z1), P(x + s * d, 0.03, z0)], toneN('#8e8e92', mid));
  const za = Math.max(L.z0 + len * 0.12, z0), zb = L.z1 - len * 0.1;
  if (zb > za) {
    const xs = x + s * (d - 3);
    polyN(wallQuad(xs, za, xs, zb, 0, 3.8), toneN('#f2efe6', mid));
    polyN(wallQuad(xs - s * 0.03, za, xs - s * 0.03, zb, 0.4, 2.7), toneN('#ffd98a', mid, 1.05));
    for (let i = 0; i < 2; i++) {
      const zc = L.z0 + len * (0.32 + 0.36 * i); if (zc - 0.5 < z0) { continue; }
      polyN(wallQuad(x + s * 3, zc - 0.45, x + s * 3, zc + 0.45, 0, 1.7), toneN('#ecebe6', zc));
      polyN(wallQuad(x + s * 2.98, zc - 0.45, x + s * 2.98, zc + 0.45, 1.4, 1.7), toneN(L.brand, zc));
    }
    ctx.strokeStyle = toneN('#d8d8d8', mid); ctx.lineWidth = Math.max(1, P(x, 0, za).k * 0.18); ctx.beginPath();
    for (const zz of [za + 0.6, zb - 0.6]) { if (zz > z0) { segN(P(x + s * 1.2, 0, zz), P(x + s * 1.2, 4.6, zz)); segN(P(xc, 0, zz), P(xc, 4.6, zz)); } }
    ctx.stroke();
    polyN([P(x + s * 0.5, 4.6, za), P(x + s * 0.5, 4.6, zb), P(xc + s * 0.5, 4.6, zb), P(xc + s * 0.5, 4.6, za)], toneN('#fff4d8', mid, 1.05));
    polyN(wallQuad(x + s * 0.5, za, x + s * 0.5, zb, 4.6, 5.4), toneN(L.brand, mid));
    facadeSign(L, x + s * 0.45, z0, za + 0.6, zb - 0.6, 4.65, 5.35, toneN(L.brand, mid), '#ffffff', L.name);
  }
  const zp = L.z0 + 0.8;
  if (zp > z0) {
    ctx.strokeStyle = toneN('#4a4a50', zp); ctx.lineWidth = Math.max(1, P(x, 0, zp).k * 0.12); ctx.beginPath(); segN(P(x - s * 0.5, 0, zp), P(x - s * 0.5, 3.4, zp)); ctx.stroke();
    facadeSign(L, x - s * 0.4, z0, zp - 1.1, zp + 1.1, 3.4, 5.4, '#1e1e22', '#ffd040', 'UNLEADED 2.39');
  }
}
// A supermarket: a long low box, a huge brand band, sliding glass doors and trolleys out the front.
function drawSupermarket(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), xf = x - s * 0.04;
  polyN(wallQuad(xf, z0, xf, z1, H - 2, H), toneN(L.brand, mid));
  facadeSign(L, x - s * 0.02, z0, L.z0 + len * 0.1, L.z0 + len * 0.9, H - 1.8, H - 0.2, toneN(L.brand, mid), '#ffffff', L.name, null, 'bold 15px Georgia, serif');
  const ea = L.z0 + len * 0.38, eb = L.z0 + len * 0.62;
  if (eb > z0) { const q = wallQuad(xf - s * 0.02, Math.max(ea, z0), xf - s * 0.02, eb, 0, 3.2); polyN(q, glassFill(q, '#8aa4b4', true, ea), toneN('#e8e8e8', ea), 2); }
  const posters = ['SALE', '2 FOR 1', 'BIG DEALS', 'BUY MORE'];
  for (const [u, i] of [[0.08, 0], [0.22, 1], [0.7, 2], [0.84, 3]]) { const za = L.z0 + len * u; if (za + len * 0.1 > z0) { facadeSign(L, x, z0, za, za + len * 0.1, 0.9, 2.4, toneN(i % 2 ? '#f2d13a' : '#e8322a', za), '#1e1e1e', posters[i], null, 'bold 14px Georgia, serif'); } }
  // A row of trolleys.
  ctx.strokeStyle = toneN('#a8acb0', mid); ctx.lineWidth = 1.2; ctx.beginPath();
  for (let i = 0; i < 6; i++) { const zz = L.z0 + len * 0.66 + i * 0.35; if (zz < z0 || zz > L.z1) { continue; } const xb = x - s * 1.4; segN(P(xb, 0.2, zz), P(xb, 1.0, zz)); segN(P(xb, 1.0, zz), P(xb - s * 0.9, 1.0, zz)); segN(P(xb - s * 0.9, 1.0, zz), P(xb - s * 0.9, 0.3, zz)); segN(P(xb, 0.3, zz), P(xb - s * 0.9, 0.3, zz)); }
  ctx.stroke();
}
// A cinema: brick front, a lit marquee full of bulbs, and a tall blade sign with the name down it.
function drawCinema(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), za = Math.max(L.z0 + len * 0.1, z0), zb = L.z1 - len * 0.1;
  if (zb > za) {
    polyN([P(x, 3.6, za), P(x, 3.6, zb), P(x - s * 2, 3.6, zb), P(x - s * 2, 3.6, za)], toneN('#2a1e1a', mid, 0.8));
    polyN(wallQuad(x - s * 2, za, x - s * 2, zb, 3.6, 5.2), toneN('#f4ecd8', mid));
    facadeSign({ side: s, z0: za, z1: zb }, x - s * 2, z0, za + 0.2, zb - 0.2, 3.8, 5.0, '#f4ecd8', '#c8322a', L.film, null, 'bold 12px Georgia, serif');
    for (let zz = za + 0.2, i = 0; zz < zb; zz += 0.45, i++) { for (const y of [3.65, 5.15]) { const p = P(x - s * 2.02, y, zz); if (p.rz > 1) { ctx.fillStyle = (i + Math.floor(clockT * 6)) % 3 ? '#fff2b0' : '#ffb040'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.k * 0.07), 0, TWO_PI); ctx.fill(); } } }
  }
  for (const u of [0.25, 0.6]) { const pa = L.z0 + len * u; if (pa + len * 0.14 > z0) { facadeSign(L, x, z0, pa, pa + len * 0.14, 0.8, 3.0, toneN('#1e1e24', pa), '#f2d13a', 'COMING SOON', null, 'bold 10px Georgia, serif'); } }
  // The blade sign: a tall panel sticking out from the wall, the name in stacked letters.
  const zc = L.z0 + len * 0.5, ya = 5.6, yb = Math.min(H + 2.5, ya + L.name.length * 1.2 + 0.8);
  if (zc > cam.z + 1) {
    polyN([P(x - s * 0.1, ya, zc), P(x - s * 1.7, ya, zc), P(x - s * 1.7, yb, zc), P(x - s * 0.1, yb, zc)], toneN('#c8322a', zc), '#ffd860', 2);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [...L.name].forEach((ch, i) => { const p = P(x - s * 0.9, yb - 0.9 - i * 1.2, zc); if (p.rz < 1) { return; } ctx.font = `bold ${Math.max(6, p.k * 0.95)}px Georgia, serif`; ctx.fillStyle = '#fff2b0'; ctx.shadowColor = '#ffb040'; ctx.shadowBlur = 6; ctx.fillText(ch, p.x, p.y); });
    ctx.restore();
  }
}
// A shopping mall: a big blank box with brand panels, a glass atrium entrance and the mall's name.
function drawMall(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), xf = x - s * 0.04;
  const brands = [['BUY MORE', '#e8322a'], ['SHOP & CO', '#2a5ab8'], ['NEED IT', '#f2a01a'], ['MEGA', '#2a8a4a'], ['MORE & MORE', '#8a3a9a']];
  const n = Math.max(2, Math.round(len / 5));
  for (let i = 0; i < n; i++) { const za = L.z0 + len * (i + 0.12) / n, zb = L.z0 + len * (i + 0.88) / n, [nm, col] = brands[(i + Math.abs(L.seed)) % brands.length]; if (zb > z0) { facadeSign(L, x, z0, za, zb, H * 0.55, H * 0.55 + 2.2, toneN(col, za), '#ffffff', nm, null, 'bold 14px Georgia, serif'); } }
  const ea = L.z0 + len * 0.35, eb = L.z0 + len * 0.65;
  if (eb > z0) {
    const q = wallQuad(xf - s * 0.4, Math.max(ea, z0), xf - s * 0.4, eb, 0, H * 0.45); polyN(q, glassFill(q, '#9ab8c8', night > 0.3, mid), toneN('#e8e8e8', mid), 2);
    polyN([P(xf - s * 0.4, H * 0.45, Math.max(ea, z0)), P(xf - s * 0.4, H * 0.45, eb), P(xf + s * 2, H * 0.45 + 3, midN(ea, eb))], rgbaN('#b8d0dc', 0.85), toneN('#e8e8e8', mid), 2);
  }
  facadeSign(L, x, z0, L.z0 + len * 0.2, L.z0 + len * 0.8, H - 2.4, H - 0.6, toneN('#f4ecd8', mid), '#2a2a2a', L.name, null, 'bold 15px Georgia, serif');
  polyN(wallQuad(xf, z0, xf, z1, 0, 0.6), toneN('#5a5a60', mid));
}

/* ---------- Industry and towers ---------- */
// One parked car, nose to the road: a box with a glass cabin on top.
function drawCarN(xa, xb, zc, col, mid) {
  const w = 0.9, top = 1.15, cab = 1.7, k = (xb - xa) > 0 ? 1 : -1;
  const ca = xa + k * 1.0, cb = xb - k * 0.9;
  if (zc - w > cam.z + 1) { polyN([P(xa, 0.3, zc - w), P(xb, 0.3, zc - w), P(xb, top, zc - w), P(xa, top, zc - w)], toneN(col, zc, 0.75)); }
  polyN([P(xa, top, zc - w), P(xa, top, zc + w), P(xb, top, zc + w), P(xb, top, zc - w)], toneN(col, zc, 1.05));
  polyN(wallQuad(xa, zc - w, xa, zc + w, 0.3, top), toneN(col, zc, 0.9));
  polyN([P(ca, top, zc - w * 0.85), P(ca, top, zc + w * 0.85), P(ca + k * 0.3, cab, zc + w * 0.8), P(ca + k * 0.3, cab, zc - w * 0.8)], toneN('#7a98b0', zc));
  polyN([P(ca + k * 0.3, cab, zc - w * 0.8), P(ca + k * 0.3, cab, zc + w * 0.8), P(cb, cab, zc + w * 0.8), P(cb, cab, zc - w * 0.8)], toneN(col, zc, 0.95));
}
// A car park: asphalt, white bays, parked cars and a price sign.
function drawCarpark(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), xf = x + s * L.depth, r = rngN(L.seed + 4);
  polyN([P(x, 0.03, z0), P(x, 0.03, z1), P(xf, 0.03, z1), P(xf, 0.03, z0)], toneN('#3c3c42', mid));
  ctx.strokeStyle = toneN('#eeeae0', mid); ctx.lineWidth = Math.max(1, Math.min(3, P(x, 0, z0).k * 0.06)); ctx.beginPath();
  for (let zz = L.z0 + 0.4; zz < L.z1; zz += 2.6) { if (zz < z0) { continue; } segN(P(x + s * 0.8, 0.04, zz), P(x + s * 5.6, 0.04, zz)); segN(P(xf - s * 0.8, 0.04, zz), P(xf - s * 5.6, 0.04, zz)); }
  ctx.stroke();
  const cars = [];
  for (let zz = L.z0 + 0.4; zz + 2.6 <= L.z1; zz += 2.6) { for (const row of [0, 1]) { const rv = r(), cv = r(); if (rv < 0.62 && zz > z0) { cars.push({ zc: zz + 1.3, row, col: ['#c83a3a', '#e8e8e8', '#2a2a30', '#3a6ab8', '#a8a8b0', '#d8b040'][Math.floor(cv * 6)] }); } } }
  cars.sort((a, b) => b.zc - a.zc || b.row - a.row);
  for (const c of cars) { if (c.row === 0) { drawCarN(x + s * 1.0, x + s * 5.4, c.zc, c.col, mid); } else { drawCarN(xf - s * 1.0, xf - s * 5.4, c.zc, c.col, mid); } }
  const zp = L.z0 + 1.2;
  if (zp > z0) {
    ctx.strokeStyle = toneN('#4a4a50', zp); ctx.lineWidth = Math.max(1, P(x, 0, zp).k * 0.12); ctx.beginPath(); segN(P(x - s * 0.4, 0, zp), P(x - s * 0.4, 5.6, zp)); ctx.stroke();
    facadeSign(L, x - s * 0.3, z0, zp - 1.6, zp + 1.6, 4.4, 5.6, '#2a5ab8', '#ffffff', 'P  ' + L.name);
    facadeSign(L, x - s * 0.3, z0, zp - 1.2, zp + 1.2, 3.5, 4.3, '#f4ecd8', '#2a2a2a', '$18 / HOUR');
  }
}
// An electrical substation: gravel behind a wire fence, humming transformers, insulators and a pylon.
function drawSubstation(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), d = L.depth, xf = x + s * d;
  polyN([P(x, 0.03, z0), P(x, 0.03, z1), P(xf, 0.03, z1), P(xf, 0.03, z0)], toneN('#9a968e', mid));
  // Transformers: grey boxes with ribbed fins.
  for (const u of [0.25, 0.65]) {
    const zc = L.z0 + len * u, xb = x + s * d * 0.45; if (zc - 1.2 < z0) { continue; }
    polyN(wallQuad(xb - s * 1.4, zc - 1.2, xb - s * 1.4, zc + 1.2, 0, 2.6), toneN('#8a9094', zc));
    if (zc - 1.2 > cam.z + 1) { polyN(wallQuad(xb - s * 1.4, zc - 1.2, xb + s * 1.4, zc - 1.2, 0, 2.6), toneN('#6a7074', zc)); }
    ctx.strokeStyle = toneN('#5a6064', zc); ctx.lineWidth = 1; ctx.beginPath(); for (let zz = zc - 1.1; zz < zc + 1.2; zz += 0.25) { segN(P(xb - s * 1.42, 0.2, zz), P(xb - s * 1.42, 2.4, zz)); } ctx.stroke();
    ctx.strokeStyle = toneN('#c8b090', zc); ctx.lineWidth = Math.max(1, P(xb, 0, zc).k * 0.1); ctx.beginPath(); for (const dz of [-0.6, 0, 0.6]) { segN(P(xb, 2.6, zc + dz), P(xb, 4, zc + dz)); } ctx.stroke();
  }
  // A lattice pylon at the back, carrying the wires away down the street.
  const pz = L.z0 + len * 0.5, px = x + s * d * 0.85, PH = 20;
  if (pz > cam.z + 2) {
    ctx.strokeStyle = toneN('#6a6e72', pz); ctx.lineWidth = Math.max(1, P(px, 0, pz).k * 0.08); ctx.beginPath();
    segN(P(px, 0, pz - 2.2), P(px, PH, pz - 0.3)); segN(P(px, 0, pz + 2.2), P(px, PH, pz + 0.3));
    for (let y = 2; y < PH; y += 2.5) { const w0 = 2.2 * (1 - y / PH) + 0.3, w1 = 2.2 * (1 - (y + 2.5) / PH) + 0.3; segN(P(px, y, pz - w0), P(px, y + 2.5, pz + w1)); segN(P(px, y, pz + w0), P(px, y + 2.5, pz - w1)); }
    for (const [y, a] of [[PH * 0.7, 3.5], [PH * 0.9, 2.5]]) { segN(P(px, y, pz - a), P(px, y, pz + a)); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(30,30,30,0.6)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const [y, a] of [[PH * 0.7, 3.5], [PH * 0.9, 2.5]]) { for (const sg of [-1, 1]) { const a0 = P(px, y, pz + sg * a), a1 = P(px, y - 3, pz + sg * a + 25); if (a0.rz > 1 && a1.rz > 1) { ctx.moveTo(a0.x, a0.y); ctx.quadraticCurveTo((a0.x + a1.x) / 2, Math.max(a0.y, a1.y) + 8, a1.x, a1.y); } } }
    ctx.stroke();
  }
  // Chain-link fence along the pavement and a warning sign.
  const xe = x - s * 0.1; ctx.strokeStyle = toneN('#8a8e92', mid); ctx.lineWidth = 1; ctx.beginPath();
  for (let zz = Math.ceil(z0 / 0.3) * 0.3; zz < L.z1; zz += 0.3) { segN(P(xe, 0, zz), P(xe, 2.2, zz + 0.3)); segN(P(xe, 2.2, zz), P(xe, 0, zz + 0.3)); }
  segN(P(xe, 2.2, z0), P(xe, 2.2, L.z1)); ctx.stroke();
  const wz = L.z0 + len * 0.45; if (wz > z0) { facadeSign(L, xe + s * 0.1, z0, wz, wz + 1.6, 1.0, 1.9, '#f2d13a', '#1e1e1e', 'DANGER', null, 'bold 14px Georgia, serif'); }
}
// A factory: corrugated shed, sawtooth roof, roller doors, and chimneys pouring smoke into the sky.
function drawFactory(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1);
  ctx.strokeStyle = 'rgba(30,30,30,0.16)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let zz = Math.ceil(L.z0 / 0.8) * 0.8; zz < z1; zz += 0.8) { if (zz >= z0) { segN(P(x - s * 0.02, 0, zz), P(x - s * 0.02, H, zz)); } }
  ctx.stroke();
  const teeth = Math.max(2, Math.round(len / 4));
  for (let i = 0; i < teeth; i++) {
    const za = L.z0 + len * i / teeth, zb = L.z0 + len * (i + 1) / teeth; if (zb < z0) { continue; }
    const zA = Math.max(za, z0); polyN([P(x, H, zA), P(x, H + 2.6, zA), P(x, H, zb)], toneN('#8a8e94', za, 0.9));
  }
  facadeWindows(L, x, z0, z1, [[H - 2.4, H - 1.3]], Math.max(2, Math.round(len / 2.5)), { padU: 0.08, lit: 0.2, glass: '#6a7a86' });
  const doors = Math.max(1, Math.round(len / 9));
  for (let i = 0; i < doors; i++) {
    const zc = L.z0 + len * (i + 0.5) / doors, za = zc - 1.8, zb = zc + 1.8; if (zb < z0) { continue; }
    polyN(wallQuad(x - s * 0.04, Math.max(za, z0), x - s * 0.04, zb, 0, 4.2), toneN('#9aa0a6', zc, 0.85), toneN('#4a4e52', zc), 1.5);
    ctx.strokeStyle = 'rgba(20,20,20,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); for (let y = 0.35; y < 4.2; y += 0.35) { segN(P(x - s * 0.05, y, Math.max(za, z0)), P(x - s * 0.05, y, zb)); } ctx.stroke();
  }
  facadeSign(L, x, z0, L.z0 + len * 0.12, L.z0 + len * 0.88, 4.7, 5.7, toneN('#f4ecd8', mid), '#2a2a2a', L.name);
  for (let c = 0; c < (L.chimneys || 1); c++) {
    const zc = L.z0 + len * (0.3 + c * 0.4), xc = x + s * (L.depth * 0.6), top = H + 16 + c * 4, rw = 0.9;
    if (zc < cam.z + 2) { continue; }
    polyN(wallQuad(xc, zc - rw, xc, zc + rw, H, top), toneN('#a85a48', zc));
    polyN(wallQuad(xc - s * 0.02, zc - rw, xc - s * 0.02, zc + rw, top - 2.4, top - 1.5), toneN('#f2efe6', zc));
    polyN(wallQuad(xc - s * 0.02, zc - rw, xc - s * 0.02, zc + rw, top - 0.9, top), toneN('#c8322a', zc));
    for (let i = 0; i < 8; i++) {
      const t = modN(clockT * 0.16 + i / 8 + c * 0.37, 1), p = P(xc + s * t * 3, top + 0.8 + t * 24, zc - t * 16); if (p.rz < 1) { continue; }
      ctx.fillStyle = rgbaN(mixHex('#dcd8d0', '#6a6660', t), 0.6 * (1 - t) * Math.min(1, t / 0.06));
      ctx.beginPath(); ctx.arc(p.x, p.y, (1.3 + t * 6) * p.k, 0, TWO_PI); ctx.fill();
    }
  }
}
// A power station: a turbine hall, and cooling towers behind it pouring out white steam.
function drawPowerPlant(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1);
  facadeWindows(L, x, z0, z1, [[H - 3, H - 1]], Math.max(3, Math.round(len / 2)), { padU: 0.1, lit: 0.2, glass: '#6a7a86' });
  facadeSign(L, x, z0, L.z0 + len * 0.1, L.z0 + len * 0.9, 2.6, 3.8, toneN('#2a5a3a', mid), '#e8f0d8', L.name, null, 'bold 14px Georgia, serif');
  for (let c = 0; c < 2; c++) {
    const zc = L.z0 + len * (0.3 + c * 0.42), xc = x + s * (L.depth + 6 + c * 3), T = 26 + c * 4, R = 6;
    if (zc < cam.z + 4) { continue; }
    const base = P(xc, 0, zc); if (base.rz < 2) { continue; }
    // A hyperboloid silhouette: narrow waist two thirds up, flaring at the top.
    const left = [], right = [];
    for (let i = 0; i <= 12; i++) { const y = T * i / 12, t = i / 12, rad = R * (0.62 + 0.38 * Math.pow((t - 0.72) / 0.72, 2)) + (t > 0.72 ? (t - 0.72) * 2.2 : 0), p = P(xc, y, zc); left.push({ x: p.x - rad * p.k, y: p.y }); right.unshift({ x: p.x + rad * p.k, y: p.y }); }
    const g = ctx.createLinearGradient(left[0].x, 0, right[right.length - 1].x, 0); g.addColorStop(0, toneN('#b8b4ac', zc, 0.8)); g.addColorStop(0.6, toneN('#e0dcd4', zc)); g.addColorStop(1, toneN('#a8a49c', zc, 0.85));
    ctx.fillStyle = g; ctx.beginPath(); [...left, ...right].forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 9; i++) {
      const t = modN(clockT * 0.08 + i / 9 + c * 0.3, 1), p = P(xc + s * t * 4, T + 2 + t * 22, zc - t * 10); if (p.rz < 1) { continue; }
      ctx.fillStyle = rgbaN('#f4f2ee', 0.75 * (1 - t) * Math.min(1, t / 0.05)); ctx.beginPath(); ctx.arc(p.x, p.y, (R * 0.9 + t * 7) * p.k, 0, TWO_PI); ctx.fill();
    }
  }
}
// A data centre: a windowless box of grey panels, rows of fans, blinking lights and a friendly name.
function drawDataCentre(L, x, z0, z1, H) {
  const s = L.side, len = L.z1 - L.z0, mid = midN(z0, z1), xf = x - s * 0.03;
  ctx.strokeStyle = 'rgba(30,30,40,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let y = 1.5; y < H; y += 1.5) { segN(P(xf, y, z0), P(xf, y, z1)); }
  for (let zz = Math.ceil(L.z0 / 3) * 3; zz < z1; zz += 3) { if (zz > z0) { segN(P(xf, 0, zz), P(xf, H, zz)); } }
  ctx.stroke();
  for (let zz = L.z0 + 1.2; zz < L.z1 - 0.8; zz += 2.4) {
    if (zz < z0) { continue; }
    const p = P(xf - s * 0.02, H - 1.6, zz); if (p.rz < 1) { continue; }
    const rad = 0.75 * p.k; ctx.fillStyle = toneN('#3a3e46', zz); ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, TWO_PI); ctx.fill();
    ctx.strokeStyle = toneN('#8a909a', zz); ctx.lineWidth = Math.max(1, rad * 0.12); const a = clockT * 6 + zz;
    ctx.beginPath(); for (let k = 0; k < 3; k++) { const b = a + k * TWO_PI / 3; ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(b) * rad * 0.85, p.y + Math.sin(b) * rad * 0.85); } ctx.stroke();
  }
  const r = rngN(L.seed + 31);
  for (let i = 0; i < 24; i++) { const zz = L.z0 + r() * len, y = 1 + r() * (H - 4), on = Math.sin(clockT * (3 + r() * 6) + i) > 0; if (zz < z0 || !on) { continue; } const p = P(xf - s * 0.02, y, zz); if (p.rz > 1) { ctx.fillStyle = i % 3 ? '#4affb0' : '#4ab0ff'; ctx.fillRect(p.x - 1, p.y - 1, Math.max(2, p.k * 0.12), Math.max(2, p.k * 0.12)); } }
  facadeSign(L, x, z0, L.z0 + len * 0.2, L.z0 + len * 0.8, 1.2, 2.6, toneN('#e8eef4', mid), '#2a5ab8', L.name, null, 'bold 15px Georgia, serif');
}
// A glass tower with its top cut off at a slant: the glass roof rises away from the street, so you
// see it from below, with a wedge on the near end, and a red light blinking for aircraft.
function drawSlantTop(L, x, z0, z1, H) {
  drawTower(L, x, z0, z1, H);
  const s = L.side, xo = x + s * L.depth, H2 = H + L.depth * 1.3, mid = midN(z0, z1);
  const q = [P(x, H, z0), P(x, H, z1), P(xo, H2, z1), P(xo, H2, z0)];
  const g = ctx.createLinearGradient(0, Math.min(q[2].y, q[3].y), 0, Math.max(q[0].y, q[1].y));
  g.addColorStop(0, toneN('#d8e8f2', mid, 1.05)); g.addColorStop(1, toneN(L.color, mid, 0.9));
  polyN(q, g, toneN('#3a4a5a', mid), 1);
  ctx.strokeStyle = toneN('#3a4a5a', mid); ctx.lineWidth = 1; ctx.beginPath();
  for (let zz = Math.ceil(L.z0 / 2) * 2; zz < L.z1; zz += 2) { if (zz > z0) { segN(P(x, H, zz), P(xo, H2, zz)); } }
  for (let t = 0.2; t < 1; t += 0.2) { segN(P(x + s * L.depth * t, H + (H2 - H) * t, z0), P(x + s * L.depth * t, H + (H2 - H) * t, z1)); }
  ctx.stroke();
  if (L.z0 > cam.z + NEAR_Z) { polyN([P(x, H, L.z0), P(xo, H, L.z0), P(xo, H2, L.z0)], toneN(L.color, L.z0, 0.62), toneN('#3a4a5a', L.z0), 1); }
  const lp = P(xo, H2 + 0.8, mid);
  if (lp.rz > 1 && Math.sin(clockT * 3) > 0.3) { ctx.save(); ctx.fillStyle = '#ff3030'; ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(lp.x, lp.y, Math.max(2, lp.k * 0.5), 0, TWO_PI); ctx.fill(); ctx.restore(); }
}

/* ---------- Street furniture: lamps and trees ---------- */
function drawLamp(q, p) {
  const k = q.k, h = 4.2, glow = night > 0.2 || p.flick < 0.3;
  ctx.fillStyle = toneN('#26332e', p.z); ctx.fillRect(q.x - 0.06 * k, q.y - h * k, 0.12 * k, h * k);
  const lx = q.x, ly = q.y - h * k;
  ctx.fillStyle = toneN('#26332e', p.z); ctx.fillRect(lx - 0.18 * k, ly - 0.55 * k, 0.36 * k, 0.12 * k);
  const lit = 0.35 + night * 0.65;
  ctx.fillStyle = `rgba(255,224,150,${0.6 + lit * 0.4})`; ctx.fillRect(lx - 0.14 * k, ly - 0.43 * k, 0.28 * k, 0.4 * k);
  if (glow || night > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(lx, ly - 0.2 * k, 0, lx, ly - 0.2 * k, 1.4 * k); g.addColorStop(0, `rgba(255,210,130,${0.35 * lit})`); g.addColorStop(1, 'rgba(255,210,130,0)'); ctx.fillStyle = g; ctx.fillRect(lx - 1.4 * k, ly - 1.6 * k, 2.8 * k, 2.8 * k); ctx.restore(); }
}
// A street tree: one of the painted broadleaf sprites, a little bigger than its height says.
function drawTree(q, p) { drawBrushTree(q, 'broad', p.tone, p.h * 1.2, p.z); }

/* ---------- Overlays: vignette, film grain, then the HUD (world.js) ---------- */
function drawOverlays() {
  // Vignette and grain.
  const vg = ctx.createRadialGradient(width / 2, height * 0.5, Math.min(width, height) * 0.4, width / 2, height * 0.5, Math.max(width, height) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(30,14,6,0.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, width, height);
  image(grain, 0, 0, width, height);
  drawHud();
}

/* ---------- Input ---------- */
async function beginSound() { if (audioStarted) {return;} audioStarted = true; try { await sound.start(); } catch (e) { console.warn(e); } }
function mousePressed(e) { if (e.target !== canvasNode) {return;} if (worldClick(e.clientX - canvasNode.getBoundingClientRect().left, e.clientY - canvasNode.getBoundingClientRect().top)) { beginSound(); return false; } canvasNode.focus({ preventScroll: true }); pointerHeld = true; beginSound(); return false; }
function mouseReleased() { pointerHeld = false; }
function keyPressed(e) {
  if (e.target !== canvasNode) {return;} const k = String(key).toLowerCase();
  if (e.repeat && ['m', 'p', 'r', ' ', 'enter', 'e', 'a', 'd', 'c', 't', 'f'].includes(k)) {return false;}
  beginSound();
  if (!paused && worldKey(e)) {return false;}
  if (e.key === 'Enter') { autoWalk = !autoWalk; return false; }
  if (k === 'm') { sound.toggle(); return false; }
  if (k === 'p') { paused = !paused; return false; }
  if (['KeyW', 'ArrowUp', 'ArrowDown'].includes(e.code)) {return false;}
}
function touchStarted() { canvasNode.focus(); pointerHeld = true; beginSound(); return false; }
function touchEnded() { pointerHeld = false; return false; }
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

/* We Build Our World: the artwork's rules.
 * The street starts as forest: wind, leaves and birds, and nothing built. You cut the forest down
 * with a swing of your hand (or Z / X) and raise buildings on the cleared land by lifting a hand
 * (or holding H / S / B), floor by floor. The shape of your hand picks what is built (one finger =
 * homes, open hand = shops, fist = industry and towers) and its height picks the size. Walking or running
 * on the spot moves you down the street. As the street fills, smog greys the sky, birds and wind
 * give way to traffic and music, and when you press F the card counts what it cost.
 * sketch.js draws the street and calls the hooks defined here.
 */

/* ---------- The street plan and the building styles ---------- */
// The street plan: 10 blocks that repeat. A word is a building style from STYLES_LOT, a number is a
// tier (1 = narrow high-street lots). Every lot starts as forest: the plan only sets how the land is
// divided (lot sizes and back rows). Your hands decide what is built.
const STREET_PLAN = ['bungalow', 'bungalow', 1, 'bungalow', 'bungalow', 'bungalow', 1, 'bungalow', 'bungalow', 'bungalow'];
const STREET_SEED = 3;   // seeds the street and its people: the same number always gives the same street
// Building styles: their tier (colours and the sound of the home), lot length range and setback from the pavement, in metres.
const STYLES_LOT = {
  villa: { tier: 2, len: [20, 26], setback: 6 },
  bungalow: { tier: 1, len: [11, 14], setback: 4.5 },
  apartment: { tier: 3, len: [12, 20], setback: 3 },
  factory: { tier: 3, len: [16, 24], setback: 2 },
  carpark: { tier: 1, len: [12, 20], setback: 0.6 },
  petrol: { tier: 1, len: [12, 18], setback: 0.8 },
  caravan: { tier: 0, len: [6, 7.5], setback: 1.2 },
  cabin: { tier: 0, len: [8, 12], setback: 3 },
  canal: { tier: 1, len: [8, 14], setback: 0.4 },
  modern: { tier: 2, len: [10, 14], setback: 4 },
  greencondo: { tier: 3, len: [12, 20], setback: 3 },
  diner: { tier: 0, len: [8, 12], setback: 1.5 },
  supermarket: { tier: 1, len: [12, 20], setback: 3 },
  cinema: { tier: 1, len: [10, 16], setback: 0.6 },
  mall: { tier: 3, len: [14, 24], setback: 4 },
  substation: { tier: 1, len: [8, 14], setback: 0.6 },
  powerplant: { tier: 3, len: [12, 20], setback: 2 },
  datacentre: { tier: 3, len: [12, 20], setback: 2 },
  slanttop: { tier: 4, len: [12, 20], setback: 2 }
};
function chunkStyle(slot) { const v = STREET_PLAN[slot]; return typeof v === 'string' ? v : null; }
function chunkTier(slot) { const v = STREET_PLAN[slot]; return typeof v === 'string' ? STYLES_LOT[v].tier : v; }

/* ---------- State: the walk, the counts, the messages ---------- */
let streetT = 0, ending = null, intro = true;   // streetT: when this street began; ending: { t } once you press F
let treesCut = 0, builtCount = 0, homesBuilt = 0, towersBuilt = 0, shopsBuilt = 0, factoriesBuilt = 0, keyHoldT = 0;
let nextThought = 10;
const toasts = [];   // short messages near the bottom of the screen
function sayToast(text) { toasts.push({ text, t: clockT }); }
const THOUGHTS = ['Every city was a forest once.', 'Listen. Fewer birds now.', 'We build our world the way we want it.', 'Nobody asks the forest.', 'How much is enough?'];

/* ---------- The artwork's words ---------- */
// Slogans painted by hand on one wall per block side (paintSlogan), and the names of empty towers.
const ART = ['FORMERLY: FOREST', 'NATURE, NOW WITH PARKING', 'WE KEPT ONE TREE. FOR THE BROCHURE.', 'THE VIEW USED TO BE TREES', 'PROGRESS', 'BIRDS NOT INCLUDED', 'GREEN LIVING (THE PAINT IS GREEN)', 'WE BUILT THIS. WHAT WAS HERE BEFORE?'];
const VOID_NAMES = ['FOREST VIEW APARTMENTS', 'GREENWOOD TOWER (NO WOOD)', 'THE CANOPY RESIDENCES', 'OAK HEIGHTS - NO OAKS', 'NATURE\'S EDGE - 300 UNITS'];

/* ---------- A new block of street (called from chunkAt in sketch.js) ---------- */
function plotsForChunk(ch, r) {
  // Every lot is forest until you cut it down and build on it. A front-garden tree for some lots,
  // lower back rows behind the low lots, and a slogan to paint on one wall a side.
  for (const L of ch.lots) {
    if (L.style === 'bungalow' && L.tree) { ch.props.push({ kind: 'tree', x: L.side * (EDGE_X + 2.2), z: L.z0 + (L.z1 - L.z0) * 0.2, h: mixN(4, 5.5, r()), tone: r() }); }
  }
  for (const b of ch.back) {
    if (ch.style === 'bungalow') { b.h = mixN(5, 7.5, r()); b.color = pickN(r, ['#c8a890', '#b8a898', '#a8b0a0']); }
  }
  // A slogan painted on one wall a side, once that wall exists.
  for (const side of [-1, 1]) { const walls = ch.lots.filter(L => L.side === side && L.H > 3 && L.z1 - L.z0 > 6); if (walls.length && r() < 0.7) { pickN(r, walls).art = ART[(ch.slot * 2 + (side > 0 ? 1 : 0)) % ART.length]; } }
}
// A dozen people per block on the pavements. They wait (propWaits) until there are buildings near them.
function addResidents(ch) {
  const rr = rngN(seed + ch.slot * 83 + STREET_SEED * 761);
  for (let i = 0; i < 12; i++) { ch.props.push({ kind: 'person', x: (i % 2 ? 1 : -1) * (EDGE_X - 0.8), z: ch.z0 + CROSS_W + 2 + rr() * (CHUNK_LEN - CROSS_W - 4), tone: rr(), h: 1.55 + rr() * 0.3, ph: rr() * 6 }); }
}
// Street life waits for buildings: nobody lives in the forest.
function propWaits(ch, p) {
  const side = p.x < 0 ? -1 : 1;
  return !ch.lots.some(L => L.side === side && L.born !== undefined && Math.abs((L.z0 + L.z1) / 2 - p.z) < 16);
}

/* ---------- Every frame ---------- */
// How built-up the street around you is, smoothed for the NATURE -> CITY bar (works with the sound off too).
let devBar = 0;
// Smog: every building you put up greys the sky a little, wherever you are (0 = clean, 1 = after ~30).
let smogK = 0, lookHint = false;
// Called from draw() every frame: the hands, the homes' sounds, the NATURE -> CITY bar, smog and hints.
function worldUpdate(z) {
  const dt = Math.min(deltaTime / 1000, 0.05);
  houseLife(); handUpdate(dt);
  devBar += (sound.devK - devBar) * (1 - Math.exp(-dt * 1.5));
  smogK += (Math.min(1, (builtCount + factoriesBuilt * 3) / 30) - smogK) * (1 - Math.exp(-dt * 0.6));
  if (!lookHint && builtCount >= 6 && !ending) { lookHint = true; sayToast('Press T to turn round and look at what you have done.'); }
  if (builtCount >= nextThought) { sayToast(THOUGHTS[Math.floor(nextThought / 10 - 1) % THOUGHTS.length]); nextThought += 10; }
}

/* ---------- Cutting the forest ---------- */
// How many trees stand on a lot (3 rows, one tree every 2.4 m): what the scoreboard counts.
function treesOn(L) { return Math.max(2, Math.round((L.z1 - L.z0) / 2.4)) * 3; }
// Cut down the next two forest lots on one side (within 45 m ahead): the trees fall, birds flee.
function chopForest(side) {
  if (!handsActive()) { return; }
  const z = distanceWalked, pick = s => { let best = null; for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side !== s || L.cutT !== undefined || L.born !== undefined) { continue; } const d = L.z0 - z; if (d > -2 && d < 45 && (!best || d < best.d)) { best = { L, d }; } } } return best && best.L; };
  const L = pick(side);
  if (!L) { if (clockT - chopHintT > 4) { chopHintT = clockT; sayToast(`No forest left on the ${side < 0 ? 'left' : 'right'} here. Walk on to find more.`); } return; }
  L.cutT = clockT; L.grow = 0; treesCut += treesOn(L);
  const L2 = pick(side); if (L2) { L2.cutT = clockT + 0.12; L2.grow = 0; treesCut += treesOn(L2); }   // one swing clears a stretch of two lots
  spawnBirds(L, side); if (L2) { spawnBirds(L2, side); }
  sound.chop(side); sound.flutter(side);
  if (clockT - chopHintT > 10) { chopHintT = clockT; sayToast('The forest is gone. Lift your hand to build: the higher, the taller.'); }
}
// Birds that flee the forest when you chop it: they burst out of the cut lots and fly up and away.
const birds = [], BIRD_MAX = 40;
function spawnBirds(L, side) {
  const n = 6 + Math.floor(Math.random() * 7);
  for (let i = 0; i < n && birds.length < BIRD_MAX; i++) {
    birds.push({ x: side * (EDGE_X + 2 + Math.random() * 8), y: 3 + Math.random() * 4, z: mixN(L.z0, L.z1, Math.random()),
      vx: side * (2 + Math.random() * 3), vy: 2.5 + Math.random() * 2.5, vz: -1 + Math.random() * 5, t0: clockT + Math.random() * 0.25, ph: Math.random() * 6.28 });
  }
}
function drawBirds() {
  if (!birds.length || mirrorView) { return; }
  const dt = Math.min(deltaTime / 1000, 0.05), LIFE = 2.2;
  push(); strokeCap(ROUND); noFill();
  for (let i = birds.length - 1; i >= 0; i--) {
    const b = birds[i], age = clockT - b.t0;
    if (age > LIFE) { birds.splice(i, 1); continue; }
    if (age < 0) { continue; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vy += 1.2 * dt;
    const q = P(b.x, b.y, b.z); if (q.rz < 0.5) { continue; }
    const span = Math.max(5, 0.75 * q.k), flap = Math.sin(age * 22 + b.ph) * 0.9, fade = Math.min(1, (LIFE - age) / 0.5);
    stroke(30, 26, 24, 240 * fade); strokeWeight(Math.max(2.2, span * 0.2));
    line(q.x - span, q.y - span * flap * 0.6, q.x, q.y); line(q.x, q.y, q.x + span, q.y - span * flap * 0.6);
  }
  pop();
}

/* ---------- Building, floor by floor ---------- */
// What a cleared lot becomes. Each hand shape builds a different family of buildings, picked at
// random so the street never repeats: homes (one finger), shops (open hand) or industry and towers (fist).
function makeBuilt(L, kind, level = 0) {
  // How high you lift decides how big it gets: level 0 low, 1 middle, 2 high (see handUpdate).
  //   one finger (homes): bungalows, cottages, caravans, log cabins -> terraces, canal row houses, modern
  //              houses, villas, mansions -> apartment blocks, "vertical forest" condos
  //   open hand (shops): petrol stations, corner shops, diners -> high-street shops, supermarkets, cinemas -> offices, malls
  //   fist:      car parks, substations -> factories, power stations, data centres -> empty skyscrapers, slant-topped towers
  const r = rngN(L.seed + 5 + builtCount * 31 + level * 7), len = L.z1 - L.z0;
  let opts;
  const big = len >= 10;
  if (kind === 'tower') { opts = level === 0 ? [['style', 'carpark'], ['style', 'substation']] : level === 1 ? [['style', 'datacentre']].concat(len >= 9 ? [['style', 'factory'], ['tier', 3]] : [['tier', 3]], big ? [['style', 'powerplant']] : []) : [['tier', 4], ['style', 'slanttop'], ['tier', 3]]; }
  else if (kind === 'shop') { opts = level === 0 ? [['tier', 0], ['style', 'diner']].concat(len >= 11 ? [['style', 'petrol']] : []) : level === 1 ? [['tier', 1]].concat(big ? [['style', 'supermarket'], ['style', 'cinema']] : [['style', 'cinema']]) : [['tier', 3]].concat(big ? [['style', 'mall']] : []); }
  else { opts = level === 0 ? [['style', 'bungalow'], ['tier', 0], ['style', 'cabin']].concat(big ? [['style', 'caravan']] : []) : level === 1 ? [['tier', 1], ['style', 'canal'], ['style', 'modern']].concat(len >= 18 ? [['style', 'villa'], ['tier', 2]] : []) : [['style', 'apartment'], ['style', 'greencondo']]; }
  const [how, v] = pickN(r, opts), tier = how === 'tier' ? v : STYLES_LOT[v].tier, t = makeLot(tier, L.side, L.z0, len, r);
  Object.assign(L, { style: null, tier, H: t.H, depth: t.depth, setback: t.setback, color: t.color, accent: t.accent, awning: t.awning, name: t.name, sign: t.sign, crooked: t.crooked || 0, crown: t.crown, spire: t.spire, glass: t.glass, fountain: t.fountain, brick: false, tree: false, vacant: false });
  if (how === 'style') { styleLot(L, v, r); }
  if (kind === 'tower' && tier === 4) { Object.assign(L, { H: mixN(45, 95, r()), vacant: true, sign: true, formerName: 'FOREST', name: VOID_NAMES[Math.abs(L.seed) % VOID_NAMES.length] }); }
}
// The height of your hand picks the size: low (0), chest to face (1), above your head (2).
// With the keys, holding longer goes bigger.
function handLevel(s) { const h = 1 - s.y; return h < 0.5 ? 0 : h < 0.72 ? 1 : 2; }
// What each hand shape builds: one finger = homes, open hand = shops, fist = industry and towers.
// An unclear shape builds nothing (see handFeedSide), so a half-open hand never builds the wrong thing.
function kindOf(shape) { return shape === 'point' ? 'home' : shape === 'open' ? 'shop' : shape === 'fist' ? 'tower' : null; }
// Every frame: turn the lifting of each hand (or a held key) into floors on the nearest cleared lots.
function handUpdate(dt) {
  const now = performance.now() / 1000; sampleMotion();
  for (const side of [-1, 1]) { const s = hands[side]; if (s.ok && now - s.seen > 0.6) { s.ok = false; } }
  // Keys stand in for the camera: H lifts homes, S shops, B big buildings (industry and towers). A key
  // builds only on the side(s) you have cut (left / right arrow, Z / X): cut one side, only that side builds.
  const keyKind = keysHeld.has('KeyB') ? 'tower' : keysHeld.has('KeyS') ? 'shop' : keysHeld.has('KeyH') ? 'home' : null, keyLift = keyKind ? dt : 0;
  keyHoldT = keyLift ? keyHoldT + dt : 0;
  const keyLevel = keyHoldT < 0.6 ? 0 : keyHoldT < 1.4 ? 1 : 2;   // hold longer: bigger
  let keyNoLand = 0;
  // Pressing a build key again and again makes it taller at once: every press adds floors to the two
  // nearest cleared lots on each side you have cut; the 2nd press makes it a bigger building, the 3rd
  // the biggest, and every press after that adds another floor or two.
  const tap = keyTap; keyTap = null;
  if (tap && handsActive()) {
    for (const side of [-1, 1]) {
      const near = [];
      for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && Math.abs(L.z0 - distanceWalked) < 50) { near.push(L); } } }
      if (!near.length) { keyNoLand++; continue; }
      near.sort((a, b) => Math.abs(a.z0 - distanceWalked) - Math.abs(b.z0 - distanceWalked));
      for (const L of near.slice(0, 2)) { tapBuild(L, tap.kind, tap.n); }
    }
  }
  for (const side of [-1, 1]) {
    const s = hands[side], handKind = s.ok ? kindOf(s.shape) : null, handLift = handKind ? s.lift : 0, lift = handLift + keyLift, kind = keyKind || handKind; s.lift = 0;
    if (!handsActive() || lift <= 0 || !kind) { continue; }
    // The lift raises the cleared lots on this hand's side, nearest first.
    const cleared = [];
    for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && clockT - L.cutT > 0.45 && Math.abs(L.z0 - distanceWalked) < 50) { cleared.push(L); } } }
    cleared.sort((a, b) => Math.abs(a.z0 - distanceWalked) - Math.abs(b.z0 - distanceWalked));
    // Nothing cleared on this side yet. If the trees are still falling, remember what to build there.
    // A hand lift on uncut forest clears it itself (so a gesture is never wasted); a key does not:
    // with the keys you choose the side by cutting it first.
    if (!cleared.length) {
      let falling = false;
      for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && clockT - L.cutT <= 0.45) { falling = true; } } }
      if (falling) {
        const level = keyLift ? keyLevel : s.ok ? handLevel(s) : 0;
        for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && !L.buildKind && clockT - L.cutT <= 0.45) { L.buildKind = kind; L.level = level; makeBuilt(L, kind, level); L.grow = 0.02; L.liftT = clockT; } } }
      } else if (handLift <= 0) { keyNoLand++; }
      else {
        chopForest(side);
        // Remember what this press or lift asked for, so even a quick tap builds once the trees are down.
        const level = keyLift ? keyLevel : s.ok ? handLevel(s) : 0;
        for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && !L.buildKind && clockT - L.cutT <= 0.45) { L.buildKind = kind; L.level = level; makeBuilt(L, kind, level); L.grow = 0.02; L.liftT = clockT; } } }
      }
      continue;
    }
    const level = keyLift ? keyLevel : s.ok ? handLevel(s) : 0;
    for (const L of cleared.slice(0, 2)) {
      if (!L.buildKind) { L.buildKind = kind; L.level = -1; L.grow = 0; }
      // Reaching higher turns it into a bigger building; what is built so far keeps its height.
      if (level > L.level) { const builtM = (L.grow || 0) * (L.H || 0); L.level = level; makeBuilt(L, L.buildKind, level); L.grow = Math.min(0.98, builtM / L.H); }
      // While your hand is still rising it keeps going (it can still get bigger); it tops out
      // when you stop. Taller buildings need a little more lifting, but not much.
      L.liftT = clockT;
      growLot(L, lift * 3 * Math.pow(8 / Math.max(8, L.H), 0.3), 0.97);
    }
  }
  // A build key with no cut land on either side: say how to choose a side (at most every 3 s).
  if ((keyLift || tap) && keyNoLand === 2 && handsActive() && clockT - keyHintT > 3) { keyHintT = clockT; sayToast('Cut the forest first: left or right arrow (or Z / X)'); }
  // Once you stop lifting, the building tops out at the size your hand reached: the last floors go
  // up on their own in about half a second, and the scaffolding comes down.
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.buildKind && L.born === undefined && L.grow > 0 && clockT - (L.liftT || 0) > (L.taps ? 0.7 : 0.25) && clockT - L.cutT > 0.45) { growLot(L, dt * 2.2, 1); } } }
}
// One press of a build key on one lot. Presses 1, 2, 3 pick a small, middle and big building (what is
// built so far keeps its height); after that each press adds about a floor (up to 1.6 times as tall).
// Open lots (car parks, petrol stations, substations) don't get taller. It tops out 0.7 s after the
// last press, so you have time to press again.
function tapBuild(L, kind, n) {
  if (!L.buildKind) { L.buildKind = kind; L.level = -1; L.grow = L.grow || 0; }
  L.taps = (L.taps || 0) + n; L.liftT = clockT;
  const level = Math.min(2, L.taps - 1), builtM = (L.grow || 0) * (L.H || 0);
  if (level > L.level) { L.level = level; makeBuilt(L, L.buildKind, level); L.baseH = L.H; L.grow = Math.min(0.98, builtM / L.H); }
  else if (L.taps > 3 && L.H > 3 && !['carpark', 'petrol', 'substation'].includes(L.style)) { L.H = Math.min((L.baseH || L.H) * 1.6, L.H + 3.2 * n); L.grow = Math.min(0.98, builtM / L.H); }
  if (clockT - L.cutT > 0.45) { growLot(L, 0.34 * n, 0.97); } else { L.grow = Math.max(L.grow || 0, 0.02); }
}
// Add to a building's height. A sound for every new floor; at the top it is finished and counted.
function growLot(L, add, cap) {
  const n = floorsOf(L), before = Math.floor(L.grow * n + 1e-6);
  L.grow = Math.min(cap, L.grow + add);
  const after = Math.floor(L.grow * n + 1e-6);
  if (after > before) { L.floorT = clockT; sound.floorUp(after, n, L.side); }
  if (L.grow >= 1) {
    L.born = clockT - RISE_T - 1; builtCount++;
    if (L.buildKind === 'tower') { towersBuilt++; } else if (L.buildKind === 'shop') { shopsBuilt++; } else { homesBuilt++; }
    if (L.style === 'factory' || L.style === 'powerplant') { factoriesBuilt++; }
    sound.built(L.buildKind === 'tower');
  }
}
// How many floors a building has, 2 to 16 (one every 3 m).
function floorsOf(L) { return Math.max(2, Math.min(16, Math.round(L.H / 3))); }
// How far a lot's building has risen (0 = forest, 1 = built): it steps up a floor at a time, with a little bump.
function lotRise(L) {
  if (L.cutT === undefined || L.born !== undefined) { return riseOf(L.born); }
  const n = floorsOf(L), f = Math.floor((L.grow || 0) * n + 1e-6) / n, bump = L.floorT !== undefined ? Math.max(0, 1 - (clockT - L.floorT) / 0.18) : 0;
  return f + bump * 0.6 / n;
}
// While a building goes up: no scaffolding (the floors simply rise), only a tower crane beside the
// tall ones. It goes when the building is finished.
function drawScaffold(L, g) {
  if (L.H <= 18) { return; }
  const x = L.side * (EDGE_X + L.setback), top = Math.min(L.H + 1, L.H * g + 2.2);
  if (P(x, 0, clipZ(L.z0)).rz > FAR_Z) { return; }
  drawCrane(L, x, top);
}
function drawCrane(L, x, top) {
  const s = L.side, mz = L.z1 - 2, mx = x + s * Math.min(L.depth * 0.7, 10), H = Math.max(L.H, top) + 9;
  if (mz < cam.z + 3) { return; }
  const base = P(mx, 0, mz); if (base.rz > FAR_Z) { return; }
  const lw = Math.max(1, Math.min(5, base.k * 0.12)), w = 0.8;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(mz) * 0.8; ctx.strokeStyle = toneN('#f2b81a', mz); ctx.lineWidth = lw; ctx.beginPath();
  segN(P(mx, 0, mz - w), P(mx, H, mz - w)); segN(P(mx, 0, mz + w), P(mx, H, mz + w));
  for (let y = 0; y < H; y += 2) { segN(P(mx, y, mz - w), P(mx, y + 2, mz + w)); }
  const a = clockT * 0.25 + (Math.abs(L.seed) % 100) * 0.06, len = 22, cx = Math.cos(a), cz = Math.sin(a);
  const jx = mx + cx * len, jz = mz + cz * len, bx = mx - cx * 8, bz = mz - cz * 8;
  segN(P(bx, H, bz), P(jx, H, jz)); segN(P(mx, H + 4, mz), P(jx, H, jz)); segN(P(mx, H + 4, mz), P(bx, H, bz)); segN(P(mx, H, mz), P(mx, H + 4, mz));
  ctx.stroke();
  const tr = 0.55 + 0.25 * Math.sin(clockT * 0.7), hx = mx + cx * len * tr, hz = mz + cz * len * tr, hy = Math.max(top + 1, H - 6 - 6 * Math.pow(Math.sin(clockT * 0.5), 2));
  ctx.strokeStyle = toneN('#2a2a2a', mz); ctx.lineWidth = Math.max(1, lw * 0.4); ctx.beginPath(); segN(P(hx, H, hz), P(hx, hy, hz)); ctx.stroke();
  polyN(wallQuad(hx, hz - 1.5, hx, hz + 1.5, hy - 0.5, hy), toneN('#8a5a3a', hz));
  polyN(wallQuad(bx, bz - 0.8, bx, bz + 0.8, H - 1.8, H), toneN('#6a6a6a', bz));
  ctx.restore();
}

/* ---------- Your hands: the webcam and ml5 handPose ---------- */
let keyHintT = -9, keyTap = null;   // keyTap: presses of H / S / B since the last frame
let handMode = false, handVideo = null, handModel = null, handStatus = '', chopHintT = -9;
// Two hands, one for each side of the street. In the mirrored picture your left hand is on the left.
const newHand = () => ({ ok: false, x: 0.5, y: 0.6, fist: false, shape: null, cand: null, candN: 0, t: 0, seen: -9, chopT: -9, trail: [], lift: 0 });
// Where the hands are in the camera picture (video pixels), so the walking detector can ignore them.
let handBoxes = [], handBoxT = -9;
const hands = { [-1]: newHand(), [1]: newHand() };
// C: start (or stop) the camera. ml5.js is loaded from the web the first time.
function startHands() {
  if (handMode) { handMode = false; handStatus = ''; return; }
  handMode = true; handStatus = 'Starting the camera...'; calibState = 'wait'; motionBase = 0; motionPrev = null; stepHist = [];
  if (handModel) { handStatus = 'Show your hand to the camera'; return; }
  const go = () => {
    try {
      handVideo = createCapture(VIDEO); handVideo.size(320, 240); handVideo.hide();
      handModel = ml5.handPose({ maxHands: 2 }, () => { handStatus = 'Show your hand to the camera'; handModel.detectStart(handVideo, gotHands); });
    } catch (e) { handStatus = 'No camera: Z / X cut, hold H homes, S shops, B towers'; }
  };
  if (window.ml5) { go(); return; }
  const sc = document.createElement('script'); sc.src = 'https://unpkg.com/ml5@1.0.1/dist/ml5.min.js';
  sc.onload = go; sc.onerror = () => { handStatus = 'Hand tracking could not load: Z / X cut, hold H, S or B'; };
  document.head.appendChild(sc);
}
// ml5 calls this with the hands it found (21 points each). Read each hand's shape and side.
function gotHands(results) {
  if (!results || !results.length || !handVideo) { return; }
  const seen = [], boxes = [];
  for (const h of results.slice(0, 2)) {
    if (h.confidence !== undefined && h.confidence < 0.6) { continue; }   // skip unsure detections
    const kp = h.keypoints || [], at = n => kp.find(k => k.name === n);
    const wrist = at('wrist'), mcp = at('middle_finger_mcp'), p = mcp || wrist || kp[0]; if (!p) { continue; }
    if (kp.length) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const k of kp) { x0 = Math.min(x0, k.x); y0 = Math.min(y0, k.y); x1 = Math.max(x1, k.x); y1 = Math.max(y1, k.y); } boxes.push({ x0, y0, x1, y1 }); }
    seen.push({ x: 1 - p.x / (handVideo.width || 320), y: p.y / (handVideo.height || 240), fist: wrist ? handShape(at, wrist) : null });
  }
  handBoxes = boxes; handBoxT = performance.now();
  // Two hands: the one further left is your left hand. One hand: the hand it already was, if that hand
  // was seen a moment ago (so a swing across the middle of the picture stays one swing); otherwise
  // whichever half of the picture it is in.
  seen.sort((a, b) => a.x - b.x);
  if (seen.length === 2) { handFeedSide(-1, seen[0].x, seen[0].y, seen[0].fist); handFeedSide(1, seen[1].x, seen[1].y, seen[1].fist); }
  else if (seen.length === 1) {
    const now = performance.now() / 1000, live = [-1, 1].filter(sd => hands[sd].ok && now - hands[sd].seen < 0.5);
    const side = live.length === 1 ? live[0] : seen[0].x < 0.5 ? -1 : 1;
    handFeedSide(side, seen[0].x, seen[0].y, seen[0].fist);
  }
}
// The shape of one hand from its 21 points. For each finger, compare how far its tip is from the
// wrist with how far its middle joint is: a straight finger's tip is well beyond the joint, a curled
// finger's tip folds back inside it. This works near or far from the camera.
//   one finger (index straight, the others curled) = 'point' -> homes
//   open hand (at least three fingers straight)    = 'open'  -> shops
//   fist (no finger straight, most curled)         = 'fist'  -> towers
// Anything in between is null: unclear, so the hand keeps the shape it had.
function handShape(at, wrist) {
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const state = f => { const tip = at(f + '_tip'), pip = at(f + '_pip'); if (!tip || !pip) { return '?'; } const k = d(tip, wrist) / (d(pip, wrist) || 1); return k > 1.18 ? 'up' : k < 1.02 ? 'down' : '?'; };
  const [i, m, r, p] = ['index_finger', 'middle_finger', 'ring_finger', 'pinky_finger'].map(state), rest = [m, r, p];
  const up = [i, m, r, p].filter(v => v === 'up').length, down = [i, m, r, p].filter(v => v === 'down').length;
  if (up === 0 && down >= 3) { return 'fist'; }
  if (i === 'up' && !rest.includes('up') && rest.filter(v => v === 'down').length >= 2) { return 'point'; }
  if (up >= 3) { return 'open'; }
  return null;
}
// One position of one hand (0..1, mirrored like a mirror). Left hand -> left side of the street, right -> right.
function handFeedSide(side, nx, ny, fist = false) {
  const raw = fist === true ? 'fist' : fist || null;
  const now = performance.now() / 1000, s = hands[side], fresh = s.ok && now - s.seen < 0.4;
  if (fresh) { const up = s.y - ny; if (up > 0.004) { s.lift += up; } }   // lifting this hand builds on its side
  // A new shape only counts once it is seen 3 times in a row (about a tenth of a second), so one
  // blurred frame in the middle of a lift can't switch homes to towers.
  if (raw && raw === s.cand) { s.candN++; } else { s.cand = raw; s.candN = raw ? 1 : 0; }
  if (raw && s.candN >= 3) { s.shape = raw; }
  s.x = nx; s.y = ny; s.fist = s.shape === 'fist'; s.t = now; s.ok = true; s.seen = now;
  s.trail.push({ x: nx, y: ny, t: now }); while (s.trail.length && now - s.trail[0].t > 0.4) { s.trail.shift(); }
  // A chop: a quick sideways stroke of this hand (more sideways than up or down, so lifting to build
  // never chops) of at least 18% of the picture within 0.4 s cuts the forest on its side.
  if (now - s.chopT > 0.35) {
    for (const a of s.trail) { const dx = nx - a.x, dy = ny - a.y; if (Math.abs(dx) > 0.18 && Math.abs(dx) > Math.abs(dy)) { s.chopT = now; s.trail.length = 0; chopForest(side); break; } }
  }
}
// Hands do nothing while a card is up.
function handsActive() { return !intro && !ending; }

/* ---------- Your body: walk or run on the spot, and the street moves with you ---------- */
// While the camera is on, the middle of the picture (your body, not your arms out to the sides) is
// compared frame to frame. Standing still stops; stepping on the spot walks; running on the spot runs.
// [ and ] make it less or more sensitive.
let motionCanvas = null, motionPrev = null, motionK = 0, motionT = 0, motionGain = 1;
// Calibration: when the camera starts you stand still for 2 seconds; the movement measured then
// (camera noise, flicker, a fan behind you) is the baseline, and only movement above it counts.
let calibState = 'wait', calibT0 = 0, calibSum = 0, calibN = 0, calibDoneT = -9, motionBase = 0;
// Only steps walk, but you can cut and build while you walk: the hands (and the arm below each hand)
// are cut out of the picture, so moving them neither starts nor stops walking, and the movement has to
// go on for a while (6 of the last 8 samples, about half a second), as stepping does.
let stepHist = [];
function sampleMotion() {
  if (!handMode || !handVideo || !handVideo.elt || handVideo.elt.readyState < 2) { motionK *= 0.9; return; }
  const now = performance.now(); if (now - motionT < 66) { return; } motionT = now;
  const W = 48, H = 36;
  if (!motionCanvas) { motionCanvas = document.createElement('canvas'); motionCanvas.width = W; motionCanvas.height = H; }
  const c = motionCanvas.getContext('2d', { willReadFrequently: true }); c.drawImage(handVideo.elt, 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H).data, cur = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { cur[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3; }
  // Cut out each hand seen in the last 0.3 s, with a margin, and everything below it (the arm).
  const mask = new Uint8Array(W * H);
  if (now - handBoxT < 300) {
    const sx = W / (handVideo.width || 320), sy = H / (handVideo.height || 240);
    for (const b of handBoxes) {
      const pad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.5, gx0 = Math.max(0, Math.floor((b.x0 - pad) * sx)), gx1 = Math.min(W - 1, Math.ceil((b.x1 + pad) * sx)), gy0 = Math.max(0, Math.floor((b.y0 - pad) * sy));
      for (let y = gy0; y < H; y++) { for (let x = gx0; x <= gx1; x++) { mask[y * W + x] = 1; } }
    }
  }
  let changed = 0, n = 0;
  if (motionPrev) { for (let y = 0; y < H; y++) { for (let x = 15; x < 33; x++) { const i = y * W + x; if (mask[i]) { continue; } n++; if (Math.abs(cur[i] - motionPrev[i]) > 20) { changed++; } } } }
  motionPrev = cur;
  if (n < 60 && calibState === 'done') { motionK *= 0.97; return; }   // the body is hidden behind the hands: keep your pace for now
  if (!n) { return; }
  const raw = changed / n, t = now / 1000;
  if (calibState === 'wait') { calibState = 'run'; calibT0 = t; calibSum = 0; calibN = 0; }
  if (calibState === 'run') {
    calibSum += raw; calibN++; motionK = 0;
    if (t - calibT0 >= 2) { motionBase = calibSum / calibN; calibState = 'done'; calibDoneT = t; }
    return;
  }
  const val = Math.min(1, Math.max(0, raw - motionBase * 1.5) * motionGain);
  stepHist.push(val > 0.04); if (stepHist.length > 8) { stepHist.shift(); }
  const stepping = stepHist.filter(Boolean).length >= 6;
  motionK = mixN(motionK, stepping ? val : 0, 0.35);
}
// The walking speed your body asks for, in metres per second.
function bodySpeed() {
  if (!handMode || !handVideo) { return 0; }
  const m = motionK;
  if (m < 0.04) { return 0; }
  return m < 0.16 ? mixN(1.5, WALK_SPD, (m - 0.04) / 0.12) : mixN(WALK_SPD, RUN_SPD * 1.2, Math.min(1, (m - 0.16) / 0.22));
}
// The camera picture and your hand, bottom right, while the hands are on.
function drawHandPanel() {
  if (!handMode) { return; }
  const w = 230, h = 150, x = width - w - 16, y = height - h - 16;
  push(); noStroke(); fill(0, 140); rect(x - 4, y - 50, w + 8, h + 54, 8);
  if (handVideo && handVideo.elt && handVideo.elt.readyState >= 2) { drawingContext.save(); drawingContext.translate(x + w, y); drawingContext.scale(-1, 1); drawingContext.globalAlpha = 0.85; drawingContext.drawImage(handVideo.elt, 0, 0, w, h); drawingContext.restore(); }
  else { fill(40); rect(x, y, w, h, 4); }
  stroke(255, 255, 255, 50); strokeWeight(1); line(x + w / 2, y, x + w / 2, y + h); noStroke();
  // How high to lift: above the top line builds the biggest things.
  for (const [hk, lab] of [[0.72, 'TALL'], [0.5, 'MID']]) { const ly = y + (1 - hk) * h; stroke(255, 210, 60, 90); strokeWeight(1); drawingContext.setLineDash([4, 4]); line(x, ly, x + w, ly); drawingContext.setLineDash([]); noStroke(); fill(255, 210, 60, 200); textSize(9); textStyle(BOLD); textAlign(RIGHT, BOTTOM); text(lab, x + w - 4, ly - 1); }
  fill(255, 210, 60, 200); textAlign(RIGHT, BOTTOM); text('LOW', x + w - 4, y + h - 18);
  // Your steps: how much your body is moving, and what the street does with it.
  const sp = bodySpeed(), mode = sp <= 0 ? 'standing' : sp < WALK_SPD * 1.05 ? 'walking' : 'running';
  fill(0, 120); rect(x, y + h - 16, w, 16); fill(mode === 'running' ? '#e0302a' : mode === 'walking' ? '#ffd23f' : '#888'); rect(x, y + h - 16, w * Math.min(1, motionK / 0.4), 16);
  fill(255); textSize(10); textStyle(BOLD); textAlign(LEFT, CENTER); text(`STEPS - ${mode}`, x + 6, y + h - 8);
  for (const side of [-1, 1]) {
    const s = hands[side]; if (!s.ok) { continue; }
    const col = side < 0 ? color(90, 200, 255) : color(255, 210, 60);
    stroke(col); strokeWeight(3); noFill(); beginShape(); for (const p of s.trail) { vertex(x + p.x * w, y + p.y * h); } endShape(); noStroke();
    fill(s.fist ? color(224, 48, 42) : col); circle(x + s.x * w, y + s.y * h, 16); fill(255); textSize(10); textAlign(CENTER, CENTER); text((side < 0 ? 'L ' : 'R ') + (s.shape === 'fist' ? 'FIST - TOWERS' : s.shape === 'point' ? 'ONE FINGER - HOMES' : s.shape === 'open' ? 'OPEN - SHOPS' : '?'), x + s.x * w, y + s.y * h - 16);
  }
  const s = { ok: hands[-1].ok || hands[1].ok };
  fill(255); textFont('Georgia'); textStyle(BOLD); textSize(10); textAlign(LEFT, TOP);
  textSize(10); text(s.ok || !handStatus ? 'Swing L / R hand: cut that side\nLift one finger: homes, open: shops, fist: towers\nStep or run on the spot to move' : handStatus, x, y - 46, w + 4);
  // Calibration message over the picture.
  const tNow = performance.now() / 1000, calibMsg = calibState === 'run' ? `Stand still for 2 seconds... ${Math.max(0, 2 - (tNow - calibT0)).toFixed(1)}` : calibState === 'done' && tNow - calibDoneT < 1.8 ? 'Calibrated' : '';
  if (calibMsg) { fill(0, 170); rect(x, y + h / 2 - 16, w, 32); fill(calibState === 'run' ? '#ffd23f' : '#7fdc8a'); textSize(15); textAlign(CENTER, CENTER); text(calibMsg, x + w / 2, y + h / 2); }
  pop();
}

/* ---------- The sound of the homes ---------- */
// Every lived-in home has its own sound: kids, a dog, a piano, the TV. Walk past and you hear it
// through the wall; stand still and it comes through clearly. Industry and empty towers are silent.
function lifeKind(L) {
  const pool = L.style === 'caravan' || L.tier === 0 ? ['dog', 'radio', 'baby', 'tv', 'kids'] : L.tier >= 3 ? ['tv', 'piano', 'baby', 'talk'] : L.tier === 2 ? ['piano', 'dog', 'kids', 'talk'] : ['kids', 'dog', 'piano', 'cook', 'tv', 'baby'];
  return pool[Math.abs(L.seed >> 3) % pool.length];
}
// Is someone living here? Not industry, car parks or empty towers, and only once it is built.
function lived(L) { return !L.vacant && !['carpark', 'petrol', 'factory', 'substation', 'powerplant', 'datacentre'].includes(L.style) && riseOf(L.born) > 0.9; }
// Every frame: the three nearest lived-in homes take turns to make a sound, panned to where they are.
function houseLife() {
  const listen = intro || ending ? 0 : easeN((stillT - 0.6) / 1.2);
  sound.listenK = listen;
  if (intro || paused) { return; }
  const near = [];
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      const mid = (L.z0 + L.z1) / 2, d = Math.hypot(mid - distanceWalked, EDGE_X + L.setback + 2); if (d > 24) { continue; }
      if (L.lifeAt === undefined) { L.lifeAt = clockT + Math.random() * 2.5; }
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

/* ---------- Drawing on the street ---------- */
// A slogan painted straight onto a wall by hand, in red, with drips: the artwork talking.
function paintSlogan(L, x, z0, H) {
  if (!L.art || L.vacant) { return; }
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
// People on the pavement. They only come once there are buildings near them (propWaits).
function drawPerson(q, p) {
  const k = q.k; if (k < 1.5) { return; }
  const h = p.h, sway = Math.sin(clockT * 1.5 + p.ph) * 0.03 * k;
  const coats = ['#3f5a7a', '#7a3f4a', '#4a6a4a', '#8a6a3a', '#5a4a6a', '#2a3a4a', '#9a5a3a'], skin = ['#e8c4a0', '#c8946a', '#8a5a3a', '#f0d0b0'];
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = 'rgba(30,20,10,0.22)'; ctx.beginPath(); ctx.ellipse(q.x + 0.15 * k, q.y, 0.42 * k, 0.1 * k, 0, 0, TWO_PI); ctx.fill();   // shadow
  ctx.fillStyle = toneN('#2a2a30', p.z); ctx.fillRect(q.x - 0.14 * k, q.y - 0.8 * k, 0.11 * k, 0.8 * k); ctx.fillRect(q.x + 0.03 * k, q.y - 0.8 * k, 0.11 * k, 0.8 * k);   // legs
  ctx.fillStyle = toneN(coats[Math.floor(p.tone * coats.length)], p.z);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(q.x - 0.24 * k + sway, q.y - (h - 0.25) * k, 0.48 * k, (h - 1.05) * k, 0.12 * k) : ctx.rect(q.x - 0.24 * k + sway, q.y - (h - 0.25) * k, 0.48 * k, (h - 1.05) * k); ctx.fill();
  ctx.fillStyle = toneN(skin[Math.floor(p.tone * 7) % skin.length], p.z); ctx.beginPath(); ctx.arc(q.x + sway, q.y - (h - 0.12) * k, 0.13 * k, 0, TWO_PI); ctx.fill();
  if (p.tone > 0.6) { ctx.fillStyle = '#e8e8f0'; ctx.fillRect(q.x + 0.15 * k + sway, q.y - (h - 0.55) * k, 0.12 * k, 0.2 * k); }   // looking at a phone
  ctx.restore();
}
// A grey wash that mutes the colours of the whole street a little (part of the look).
function drawStreetLife() {
  ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.3; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, width, height); ctx.restore();
}

/* ---------- The HUD and the cards ---------- */
// Everything drawn on top of the street: scoreboard, messages, NEXT bar, music label, camera panel, cards.
function drawHud() {
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
    const dev = Math.max(0, Math.min(1, devBar)), by = y + 86, bw2 = w - 28;
    fill('#3f7a3a'); rect(x + 14, by, bw2, 8, 4); fill(90, 90, 100); rect(x + 14 + bw2 * (1 - dev), by, bw2 * dev, 8, 0, 4, 4, 0);
    textSize(9); textStyle(BOLD); fill(63, 122, 58); text('NATURE', x + 14, by + 11); textAlign(RIGHT, TOP); fill(90, 90, 100); text('CITY', x + 14 + bw2, by + 11); textStyle(NORMAL);
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i], a2 = clockT - t.t; if (a2 > 4.2) { toasts.splice(i, 1); continue; }
      drawingContext.globalAlpha = easeN(a2 / 0.3) * (1 - easeN((a2 - 3.6) / 0.6));
      textStyle(ITALIC); textSize(16); fill(255); stroke(0, 140); strokeWeight(3); textAlign(CENTER, CENTER); text(t.text, width / 2, height - 146 - (toasts.length - 1 - i) * 26);
      noStroke(); drawingContext.globalAlpha = 1; textStyle(NORMAL);
    }
    drawNextBar();
    // What the street sounds like, bottom left.
    if (sound.style) {
      const on = sound.enabled && sound.context && sound.context.state === 'running', label = on ? `Music: ${STYLES[sound.style].name}` : 'Click for sound';
      textStyle(BOLD); textSize(12); const lw = textWidth(label) + 24; noStroke(); fill(0, 60); rect(16 + 2, height - 46 + 3, lw, 26, 13); fill(sound.style === 'forest' ? color(212, 160, 23) : sound.style === 'city' ? color(200, 40, 120) : color(63, 143, 214)); rect(16, height - 46, lw, 26, 13);
      fill(255); textAlign(LEFT, CENTER); text(label, 28, height - 33); textStyle(NORMAL);
    }
  }
  if (!intro) { drawHandPanel(); }
  if (intro) { drawOpening(); }
  if (ending) {
    const card = endingCard();
    storyCard(card.title, card.lines, clockT - ending.t > 4.5 ? 'F: keep building   -   R: start again' : '', easeN((clockT - ending.t - 2.6) / 1.2), card.col);
  }
  pop();
}
// What to do next, in one line: build if there is cleared land, cut if there is forest, else walk on.
function nextText() {
  if (backWant && !ending) { return 'Looking back  -  T to turn round'; }
  const z = distanceWalked; let cleared = false, forest = false;
  for (const ch of chunks.values()) { for (const L of ch.lots) { const d = L.z0 - z; if (L.cutT !== undefined && L.born === undefined && Math.abs(d) < 50) { cleared = true; } if (L.cutT === undefined && L.born === undefined && d > -2 && d < 45) { forest = true; } } }
  if (cleared) { return 'Lift a hand to build: one finger = homes, open = shops, fist = towers'; }
  if (forest) { return 'Swing your left or right hand to cut that side'; }
  return 'Walk on';
}
// The NEXT bar at the top of the screen (moved down when the screen is narrow).
function drawNextBar() {
  const t = nextText(); push(); textFont('Georgia'); textStyle(BOLD); textSize(17);
  const w = textWidth(t) + 90, x = width / 2 - w / 2, crowded = x < 16 + Math.min(400, width * 0.5) + 8 || x + w > width - 16 - 190 - 8, y = crowded ? 142 : 16;
  noStroke(); fill(0, 60); rect(x + 3, y + 4, w, 40, 20); fill(42, 30, 24); rect(x, y, w, 40, 20);
  fill('#ffd23f'); rect(x + 10, y + 11, 52, 18, 9); fill(42, 30, 24); textSize(10); textAlign(CENTER, CENTER); text('NEXT', x + 36, y + 20.5);
  fill(255, 236, 190); textSize(17); textAlign(LEFT, CENTER); text(t, x + 72, y + 21);
  pop();
}
// The first thing anyone sees: what this is, what to do, and what it costs, in three lines.
function drawOpening() {
  const col = '#2f6a3a', pulse = 0.5 + 0.5 * Math.sin(clockT * 4);
  push(); noStroke(); fill(10, 20, 12, 130); rect(0, 0, width, height);
  const w = Math.min(600, width - 32), h = 340, x = width / 2 - w / 2, y = Math.max(12, height / 2 - h / 2), cx = width / 2;
  fill(0, 60); rect(x + 4, y + 6, w, h, 12); fill(250, 252, 244); rect(x, y, w, h, 12); fill(col); rect(x, y, w, 34, 12, 12, 0, 0);
  fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(12); text('AN INTERACTIVE ARTWORK - A GENERATIVE LANDSCAPE', cx, y + 17);
  fill(30, 40, 30); textSize(36); text('WE BUILD OUR WORLD', cx, y + 70);
  textStyle(ITALIC); textSize(16); fill(90, 100, 85); const tag = 'Everything here is forest. Make it the world you want.'; textSize(Math.min(16, 16 * (w - 40) / textWidth(tag))); text(tag, cx, y + 102); textStyle(BOLD);
  // The three moves.
  const rows = [['L  R', 'Swing your left / right hand: cut the forest on that side'], ['1', 'Lift one finger: homes (higher = taller)'], ['OPEN', 'Lift an open hand: shops, diners, malls'], ['FIST', 'Lift a fist: car parks, factories, towers']];
  rows.forEach(([k, label], i) => { const ry = y + 126 + i * 32; textSize(15); const kw = 62; fill(255); stroke(90, 100, 85); strokeWeight(1.5); rect(x + 40, ry, kw, 28, 6); noStroke(); fill(30, 40, 30); textAlign(CENTER, CENTER); text(k, x + 40 + kw / 2, ry + 14); textAlign(LEFT, CENTER); textStyle(NORMAL); textSize(16); text(label, x + 40 + kw + 16, ry + 14); textStyle(BOLD); });
  textAlign(CENTER, CENTER); textStyle(ITALIC); textSize(12); fill(110, 120, 105); text('Press C for the camera: walk or run on the spot to move.   T: turn round.', cx, y + 268); text('F when you are finished.   M sound.   No camera: Z / X cut, hold H homes, S shops, B towers.', cx, y + 286);
  textStyle(BOLD); textSize(16); fill(col); drawingContext.globalAlpha = 0.55 + 0.45 * pulse; text('Click or press E to start', cx, y + h - 26); drawingContext.globalAlpha = 1;
  pop();
}
// A centred card: the opening and the ending.
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
// The end card answers what you actually did: leaving the forest standing, taking a little, or
// building a city each get their own words, so the ending never judges everyone the same way.
function endingCard() {
  const built = `You built ${homesBuilt} homes, ${shopsBuilt} shops and ${towersBuilt} towers.`;
  if (builtCount === 0) {
    return { title: 'THE FOREST STAYS', col: '#3f7a3a', lines: [treesCut ? `You cut down ${treesCut} trees, but built nothing on them.` : 'You walked through the forest and cut nothing down.', 'Listen: the birds are still singing.', '', 'Every city was a forest once.', 'This one still is.', 'You chose not to build. That is a choice too.'] };
  }
  if (builtCount <= 5) {
    return { title: 'A LITTLE OF THE WORLD WE WANTED', col: '#5a7a3a', lines: [`You cut down ${treesCut} trees.`, built, 'Listen: fewer birds now, but some are still here.', '', 'Every city was a forest once.', 'You took only a little.', 'How much would have been enough?'] };
  }
  return { title: 'THE WORLD WE WANTED', col: '#2f6a3a', lines: [`You cut down ${treesCut} trees.`, built, 'Listen: the birds have stopped.', '', 'Every city was a forest once.', 'We build our world the way we want it.', 'Nobody asks the forest.'] };
}

/* ---------- Ending and starting again ---------- */
// F: the end. You turn round to look at the street you made, then the card fades in.
function endWalk() {
  if (ending) { return; }
  ending = { t: clockT }; sound.go(); nightTarget = 0.25;   // the light dims a little
  backWant = true;   // turn round and see the street you made, then the card
}
// A new street: a new seed, the forest back, every count back to zero, and the opening card.
function restartWalk() {
  seed += 97;
  ending = null; intro = true; backWant = false; backT = 0; nightTarget = 0; smogK = 0; lookHint = false; toasts.length = 0;
  treesCut = 0; builtCount = 0; homesBuilt = 0; towersBuilt = 0; shopsBuilt = 0; factoriesBuilt = 0; nextThought = 10;
  chunks.clear(); distanceWalked = 0; streetT = clockT; buildSkyline();
}

/* ---------- Keys and clicks (called from sketch.js) ---------- */
// The artwork's keys. Returns true when it used the key.
function worldKey(e) {
  const code = e.code;
  if (code === 'KeyE' || code === 'Space' || code === 'Enter' && (intro || ending)) { intro = false; return true; }
  if (code === 'KeyR') { restartWalk(); return true; }
  if (code === 'KeyT') { if (!intro && !ending) { backWant = !backWant; } return true; }
  if (code === 'KeyC') { startHands(); return true; }
  if (code === 'KeyF') { if (ending) { ending = null; nightTarget = 0; backWant = false; } else if (!intro) { endWalk(); } return true; }
  if (code === 'KeyX' || code === 'ArrowRight' || code === 'KeyD') { chopForest(1); return true; }
  if (code === 'KeyZ' || code === 'ArrowLeft' || code === 'KeyA') { chopForest(-1); return true; }
  if (code === 'KeyH' || code === 'KeyS' || code === 'KeyB') {   // press again and again: taller (see tapBuild); hold: grows too
    if (!e.repeat) { const kind = code === 'KeyH' ? 'home' : code === 'KeyS' ? 'shop' : 'tower'; keyTap = keyTap && keyTap.kind === kind ? { kind, n: keyTap.n + 1 } : { kind, n: 1 }; }
    return true;
  }
  if (code === 'BracketLeft') { motionGain = Math.max(0.3, motionGain / 1.25); sayToast(`Step sensitivity ${Math.round(motionGain * 100)}%`); return true; }
  if (code === 'BracketRight') { motionGain = Math.min(4, motionGain * 1.25); sayToast(`Step sensitivity ${Math.round(motionGain * 100)}%`); return true; }
  return false;
}
// A click closes the opening card, or the end card once it has been read.
function worldClick(mx, my) {
  if (intro) { intro = false; return true; }
  if (ending) { if (clockT - ending.t > 4.5) { ending = null; nightTarget = 0; backWant = false; } return true; }
  return false;
}
