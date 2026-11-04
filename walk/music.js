/* WalkSound — the Landlord's Walk soundscape: StreetSound's footsteps, street hum and effects,
 * with music that sounds like the money on the street you are walking down.
 *   Rich (inner city, the dear blocks): a lounge-jazz trio. Electric piano on maj9 chords,
 *     walking upright bass, brushed swing drums, and now and then a clink of glasses.
 *   Middle: bright pop. Plucked chords, a bouncing bass, shaker and soft claps.
 *   Poor (out on the estates, the cheap blocks): a slow minor tune on an out-of-tune piano,
 *     warped like an old cassette, with record crackle and a cheap drum machine.
 * Wealth comes from the town (zone) and the district of the block you are on. When it
 * changes, the music fades over to the new style at the next bar. Native Web Audio, no files.
 */
// The band's volume, well above the street hum so it is clearly heard.
const MUSIC_VOL = 6;
const MUSIC_NAME = { rich: 'Jazz · a rich street', mid: 'Pop · a middle street', poor: 'Old tape · a poor street' };
const MIDI = n => 440 * Math.pow(2, (n - 69) / 12);
const STYLES = {
  // chords as MIDI notes, one bar each; bass walks through the chord tones
  rich: { bpm: 92, swing: 0.62, chords: [[48, 52, 55, 59, 62], [45, 48, 52, 55, 59], [50, 53, 57, 60, 64], [43, 47, 50, 53, 57]], gain: 0.9 },
  mid: { bpm: 108, swing: 0.5, chords: [[48, 55, 60, 64], [43, 50, 55, 59], [45, 52, 57, 60], [41, 48, 53, 57]], gain: 0.8 },
  poor: { bpm: 72, swing: 0.5, chords: [[45, 52, 57, 60], [40, 47, 52, 55], [41, 48, 53, 57], [40, 47, 52, 56]], gain: 0.85 }
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
    // Keep the street hum and the casino bells from StreetSound, without its district arpeggio.
    this.hum.gain.setTargetAtTime(0.03 + (tier >= 3 ? 0.02 : 0), now, 1);
    // How rich is this street? The town counts most, then the block's district.
    const z = typeof zone === 'number' ? zone : 0;
    this.wealth = constrain((5 - z) / 5 * 0.8 + tier * 0.05, 0, 1);   // Castle Hill ~0.9, the suburbs ~0.37, the Fringe ~0
    this.nextStyle = this.wealth > 0.62 ? 'rich' : this.wealth < 0.3 ? 'poor' : 'mid';
    if (!this.style) { this.style = this.nextStyle; this.nextAt = now + 0.1; }
    const life = typeof streetLife === 'function' ? streetLife() : 1;
    const listen = this.listenK || 0;
    this.muffle.frequency.setTargetAtTime(350 + life * life * 15000, now, 0.8);
    // Stop and listen: the band and the street fade back, the homes beside you come through the wall.
    this.music.gain.setTargetAtTime(MUSIC_VOL * (1 - 0.8 * listen), now, 0.4);
    if (this.lifeFilter) { this.lifeFilter.frequency.setTargetAtTime(1100 + listen * 4500, now, 0.4); this.lifeGain.gain.setTargetAtTime(1 + listen * 0.9, now, 0.4); }
    // The poor tape crackles all the time it plays.
    if (this.style === 'poor' && Math.random() < 0.5) { this._hit(now + Math.random() * 0.05, 0.012, 3000 + Math.random() * 4000, 0.02 + Math.random() * 0.03, 'bandpass', 4); }
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
      // Electric piano comping on 1 and the and-of-2, soft and warm, with a little tremolo shimmer.
      if (beat8 === 0 || beat8 === 3) { chord.slice(1).forEach((n, i) => { this._m(MIDI(n + 12), t + i * 0.012, 1.8, 'sine', 0.022, 2600, -0.3 + i * 0.15); this._m(MIDI(n + 24), t + i * 0.012, 0.5, 'triangle', 0.004, 4000); }); }
      // Walking bass on every beat.
      if (beat8 % 2 === 0) { const walk = [chord[0], chord[0] + 4, chord[0] + 7, chord[0] + 9 - (bar % 2) * 2]; this._m(MIDI(walk[beat8 / 2] - 12), t, 0.5, 'sine', 0.11, 600, 0, 0.005); }
      // Brushes: a ride tick on every eighth, a swish on 2 and 4.
      this._hit(t, 0.05, 7000, beat8 % 2 ? 0.012 : 0.02);
      if (beat8 === 2 || beat8 === 6) { this._hit(t, 0.22, 2500, 0.03, 'bandpass', 0.6); }
      // A clink of champagne glasses now and then.
      if (step === 0 && Math.random() < 0.5) { const f = 2093 + Math.random() * 300; this._m(f, t + 0.6, 1.2, 'sine', 0.012, 9000, pan()); this._m(f * 1.5, t + 0.63, 0.9, 'sine', 0.008, 9000, pan()); }
      // A harp run up at the end of the turnaround.
      if (step === 28 && Math.random() < 0.6) { chord.forEach((n, i) => this._m(MIDI(n + 24), t + i * 0.06, 0.8, 'triangle', 0.012, 6000, -0.5 + i * 0.25)); }
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
      // Cheap drum machine: kick on 1 and 3, a thin rimshot on 2 and 4.
      if (beat8 === 0 || beat8 === 4) { this._kick(t, 0.1); }
      if (beat8 === 2 || beat8 === 6) { this._hit(t, 0.05, 1800, 0.025, 'bandpass', 3); }
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
