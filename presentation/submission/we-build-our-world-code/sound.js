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
  // The receipt printer: a fast, buzzing rattle of the print head for as long as it prints.
  printer(dur) {
    if (!this.enabled || !this.context || this.context.state !== 'running') { return; }
    const ctx = this.context, t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 1.5;
    lfo.type = 'square'; lfo.frequency.value = 24; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.05); g.gain.setValueAtTime(0.07, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.08);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.1); lfo.start(t); lfo.stop(t + dur + 0.1);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); lfo.disconnect(); lg.disconnect(); };
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
