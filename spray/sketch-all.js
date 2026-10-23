// noprotect
// Plotline: Talk Back — combined file for the p5.js Web Editor (p5.js 1.x and 2.x).
// Paste this whole file into sketch.js. It is street-sound.js and spray/sketch.js in one.

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

// noprotect
/* Plotline: Talk Back — a spray-paint protest walk (p5.js WEBGL).
 * You walk down a street that grows in front of you. The developers got here first: every new
 * block goes up with a billboard telling you what to want ("Luxury living from $2.4M",
 * "Invest in your future"). You have a spray can. Aim with the mouse and hold to spray.
 * Cover enough of a billboard and your rewrite appears in your paint ("Homes, not assets"),
 * and that block answers: its buildings take on colour, windows light up, flowers grow and
 * people come out. Walk past and the ad stays, and the block stays cold and empty.
 * At the end you see how much of the street you rewrote.
 * Who it's for: young renters in a city that keeps selling homes as investments.
 * Everything is generated in code: low-poly buildings, trees and people, a painterly
 * post-process (ink outlines from depth, haze, painted sky, paper grain), Web Audio sound.
 * Controls: W / Up walk, Shift hurry, S / Down back, Enter stroll, mouse aim, hold mouse or Space
 * to spray, 1-4 paint colour, Left / Right (or the screen edges) to look, M sound, R restart.
 */
const CH = 48, CROSS = 10, ROAD = 4, PAVE = 3.5, EDGE = ROAD + PAVE, EYE = 1.65, NEAR = 0.3, FAR = 360, FOV = Math.PI / 3.1;
const WALK = 4.5, RUN = 9, STROLL = 2.4, SLOW = 2.0, RISE = 1.1, GROW = 42, ADS_PER_WALK = 14, REACH = 30;
const PAL = {
  ink: '#3d3553', road: '#a19ea9', roadX: '#aeabb6', pave: '#ece0cd', kerb: '#e7d8c2', grass: '#a9d48f',
  houses: ['#f4b6c2', '#f7c59f', '#f4d58d', '#b8d8be', '#b8c8ec', '#d6c4ec', '#f2a7a0'], roofs: ['#c96f7e', '#5b7fb8', '#e08f5f', '#6d9f84', '#8f78b8'],
  corp: ['#f4b6c2', '#b8d8be', '#f7c59f', '#b8c8ec', '#f4d58d'],
  coats: ['#f28b82', '#6fa8dc', '#f7b267', '#7cc48a', '#b48cdc', '#f4d35e', '#ff8fb3'], skin: ['#f3d2b8', '#d8a27c', '#a8704a', '#ffe1c9']
};
const PAINTS = [{ name: 'Pink', col: '#ff4f9a' }, { name: 'Yellow', col: '#ffd23f' }, { name: 'Mint', col: '#2fd3a0' }, { name: 'Blue', col: '#3d8bff' }];
// What the developers say, and what the street says back.
const SLOGANS = [
  ['LUXURY LIVING FROM $2.4M', 'HOMES, NOT ASSETS'],
  ['INVEST IN YOUR FUTURE', 'WE CAN’T EVEN RENT'],
  ['NOW LEASING · 1 BED $950/WK', 'WHO CAN PAY THIS?'],
  ['SOLD OUT TO INVESTORS', 'SOLD OUT. STILL EMPTY.'],
  ['EXCLUSIVE · PRIVATE · YOURS', 'SHARED · OPEN · OURS'],
  ['BUY NOW BEFORE PRICES RISE', 'BUY WITH WHAT?'],
  ['YOUR DREAM HOME AWAITS', 'STILL DREAMING AT 35'],
  ['PRIME DEVELOPMENT SITE', 'THIS WAS A PARK'],
  ['LIVE ABOVE IT ALL', 'WE LIVE DOWN HERE'],
  ['RENT INCREASE FROM MONDAY', 'WE’RE NOT LEAVING'],
  ['PRIVATE PROPERTY · KEEP OUT', 'PUBLIC LAND · COME IN'],
  ['A ONCE-IN-A-LIFETIME OPPORTUNITY', 'A HOME SHOULDN’T BE LUCK'],
  ['300 APARTMENTS · ALL SOLD', '300 APARTMENTS · LIGHTS OFF'],
  ['WHERE YOUR MONEY GROWS', 'WHERE WOULD WE GROW?']
];
const BRANDS = ['PRIME ESTATES', 'CAPITAL HOMES', 'SKYLINE GROUP', 'APEX LIVING', 'GOLDLEAF PROPERTY'];

let fb, post, sound, audioStarted = false, hiss = null, ui = {};
let walkZ = 0, speed = 0, yaw = 0, yawTarget = 0, phase = 0, lastStep = 0, autoWalk = false, seedN = 11, clockT = 0;
let mx = 0, my = 0, spraying = false, paint = 0, aim = null, intro = true, ending = false, sloganNext = 0, rewritten = [], passed = 0, skipped = 0;
const keysHeld = new Set(), chunks = new Map(), texCache = new Map();

/* ---------- helpers ---------- */
function rngN(s) { let x = s | 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) | 0; return (x >>> 0) / 4294967296; }; }
const mixN = (a, b, t) => a + (b - a) * t, pickN = (r, l) => l[Math.floor(r() * l.length)], clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOutBack = t => { t = clampN(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const easeN = t => { t = clampN(t, 0, 1); return t * t * (3 - 2 * t); };
const riseOf = born => born === undefined ? 0 : easeOutBack((clockT - born) / RISE);
function hexN(h) { const c = color(h); return [red(c), green(c), blue(c)].map(v => v / 255); }
const V3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };
// Cold, washed-out version of a colour; w = 1 gives the full colour back.
function warmN(hex, w) { const c = color(hex), g = 0.3 * red(c) + 0.59 * green(c) + 0.11 * blue(c); return lerpColor(color(g * 0.85 + 26, g * 0.85 + 28, g * 0.85 + 38), c, clampN(w, 0, 1)); }

/* ---------- setup ---------- */
function setup() {
  const c = createCanvas(windowWidth, windowHeight, WEBGL); pixelDensity(Math.min(2, displayDensity()));
  c.elt.setAttribute('aria-label', 'Plotline: Talk Back. Walk down a street of developer billboards and spray-paint your own messages over them. Hold W to walk, aim with the mouse, hold the mouse to spray.');
  textureWrap(REPEAT);   // once, before any texture exists: window decals tile
  fb = createFramebuffer({ antialias: false });
  post = createShader(POST_VERT, POST_FRAG);
  sound = typeof StreetSound !== 'undefined' ? new StreetSound() : null;
  buildUI(); resetGame();
  if (document.fonts) { document.fonts.load('80px "Permanent Marker"').then(() => { for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.ad) { L.ad.adG = null; L.ad.dirty = true; } } } }).catch(() => {}); }
  window.addEventListener('keydown', e => { keysHeld.add(e.code); onKey(e); });
  window.addEventListener('keyup', e => { keysHeld.delete(e.code); });
  window.addEventListener('blur', () => { keysHeld.clear(); spraying = false; });
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); fb.resize(width, height); }
function resetGame() {
  walkZ = 0; speed = 0; yaw = yawTarget = 0; seedN += 97; clockT = 0; rewritten = []; passed = 0; skipped = 0; ending = false; sloganNext = Math.floor(Math.random() * SLOGANS.length);
  for (const k of [...chunks.keys()]) { dropChunk(k); }
  ui.end.classList.remove('show'); ui.intro.classList.add('show'); intro = true; updateHud();
}
function dropChunk(k) {
  const ch = chunks.get(k); if (!ch) { return; }
  if (ch.geom && typeof freeGeometry === 'function') { freeGeometry(ch.geom); }
  for (const L of ch.lots) { if (L.ad) { for (const g of [L.ad.g, L.ad.adG, L.ad.paintG]) { if (g) { try { const t = _renderer && _renderer.textures; if (t && t.delete) { t.delete(g); } } catch (e) { /* p5 internals differ by version */ } g.remove(); } } } }
  chunks.delete(k);
}

/* ---------- the street, in 48 m blocks ---------- */
function chunkAtN(c) {
  if (chunks.has(c)) { return chunks.get(c); }
  const r = rngN(c * 7919 + seedN * 104729), z0 = c * CH, ch = { c, z0, lots: [], props: [], people: [], back: [], warm: 0.12, warmNow: 0.12, ads: 0, tagged: 0 };
  for (const side of [-1, 1]) {
    const adAt = r() < 0.5 ? 0 : 1, len = (CH - CROSS - 1.6) / 2 - 0.4;
    for (let i = 0; i < 2; i++) {
      const z = z0 + CROSS + 0.6 + i * (len + 0.8), L = { side, z0: z, z1: z + len, seed: Math.floor(r() * 1e9) };
      if (i === adAt && c >= 1) { makeAdLot(L, r); ch.ads++; } else { makeHouses(L, r); }
      ch.lots.push(L);
    }
    const adLot = ch.lots.find(L => L.ad && L.side === side);
    for (let z = z0 + CROSS + 3; z < z0 + CH - 2; z += 12) {
      const tz = z + (side > 0 ? 6 : 0);
      if (!(adLot && tz > adLot.z0 - 4 && tz < adLot.z1)) { ch.props.push({ kind: 'tree', x: side * (ROAD + 0.9), z: z + (side > 0 ? 6 : 0), h: mixN(4.5, 6.5, r()), r: mixN(1.4, 2.1, r()), tone: r(), cone: r() < 0.25 }); }
      ch.props.push({ kind: 'lamp', x: side * (ROAD + 0.45), z: z + (side > 0 ? 0 : 6) });
    }
    for (let z = z0 + CROSS; z < z0 + CH - 0.1; z += 4) { ch.props.push({ kind: 'pave', side, z: z + 2, len: Math.min(4, z0 + CH - z) }); }
    for (let z = z0 + CROSS + 1.5; z < z0 + CH - 1; z += mixN(2.5, 5, r())) { ch.props.push({ kind: r() < 0.6 ? 'bush' : 'flower', x: side * (EDGE + mixN(0.25, 0.6, r())), z, r: mixN(0.35, 0.6, r()), col: pickN(r, ['#ff8fb3', '#f7b267', '#fff0a0', '#b48cdc', '#ffffff']) }); }
    ch.back.push({ x: side * mixN(36, 48, r()), z: z0 + mixN(8, 40, r()), w: mixN(10, 18, r()), h: mixN(10, 26, r()), d: mixN(10, 16, r()), col: pickN(r, ['#d9cff5', '#cfe0f5', '#f7d3de', '#d4ecdc']) });
  }
  chunks.set(c, ch); return ch;
}
function makeHouses(L, r) {
  const n = r() < 0.5 ? 2 : 3; L.kind = 'houses'; L.parts = [];
  for (let i = 0; i < n; i++) { L.parts.push({ w: (L.z1 - L.z0) / n - 0.5, h: mixN(5.5, 8, r()), d: mixN(8, 10, r()), col: pickN(r, PAL.houses), roof: pickN(r, PAL.roofs), rh: mixN(2, 3.2, r()) }); }
}
// A developer block with a big billboard out front, tilted toward people walking up the street.
function makeAdLot(L, r) {
  const [say, back] = SLOGANS[sloganNext % SLOGANS.length]; sloganNext++;
  L.kind = 'corp'; L.h = mixN(16, 30, r()); L.col = pickN(r, PAL.corp); L.crown = r() < 0.5;
  const s = L.side, tilt = 0.5, w = Math.min(L.z1 - L.z0 - 3, 11.5), h = 5.2;
  const N = V3.norm([-s * Math.cos(tilt), 0, -Math.sin(tilt)]), U = V3.norm(V3.cross([0, -1, 0], V3.mul(N, -1)));
  L.ad = { say, back, brand: pickN(r, BRANDS), style: Math.floor(r() * 3), C: [s * (EDGE + 3.6), -(3.0 + h / 2), (L.z0 + L.z1) / 2], N, U, V: [0, 1, 0], w, h,
    cells: new Set(), progress: 0, tagT: null, col: null, dirty: true, g: null, adG: null, paintG: null };
}
function forEachLot(fn) { for (const ch of chunks.values()) { for (const L of ch.lots) { fn(L, ch); } } }

/* ---------- every frame ---------- */
function draw() {
  const dt = Math.min(deltaTime / 1000, 0.05); clockT += dt;
  try { stepWorld(dt); renderScene(); } catch (e) { console.error(e); }
  shader(post);
  post.setUniform('uCol', fb.color); post.setUniform('uDepth', fb.depth);
  post.setUniform('uRes', [width, height]); post.setUniform('uTime', clockT); post.setUniform('uNear', NEAR); post.setUniform('uFar', FAR); post.setUniform('uYaw', yaw);
  post.setUniform('uInk', hexN(PAL.ink)); post.setUniform('uHaze', hexN('#eef1fb')); post.setUniform('uSkyTop', hexN('#8fb8ea')); post.setUniform('uSkyLow', hexN('#fbe3ea'));
  clear(); noStroke(); plane(1, 1); resetShader();
}
function stepWorld(dt) {
  const c = Math.floor(walkZ / CH);
  for (let i = c - 1; i <= c + 7; i++) { chunkAtN(i); }
  for (const k of [...chunks.keys()]) { if (k < c - 2 || k > c + 9) { dropChunk(k); } }
  // Walking, and looking with the arrow keys or by pushing the mouse to the screen edges.
  const fwd = keysHeld.has('KeyW') || keysHeld.has('ArrowUp'), back = keysHeld.has('KeyS') || keysHeld.has('ArrowDown'), hurry = keysHeld.has('ShiftLeft') || keysHeld.has('ShiftRight');
  let want = 0;
  if (!intro && !ending) { if (back) { want = -WALK * 0.6; } else if (fwd) { want = hurry ? RUN : WALK; } else if (autoWalk) { want = hurry ? RUN : STROLL; } }
  if (spraying && want > SLOW) { want = SLOW; }
  speed = lerp(speed, want, 1 - Math.exp(-dt * 4.5)); walkZ += speed * dt;
  phase += Math.abs(speed) * dt * 1.9;
  if (Math.floor(phase / PI) !== lastStep) { lastStep = Math.floor(phase / PI); if (sound && Math.abs(speed) > 0.5) { sound.footstep(Math.min(1, Math.abs(speed) / RUN)); } }
  const ex = mx / Math.max(1, width);
  if (!intro && !ending) {
    if (keysHeld.has('ArrowLeft') || keysHeld.has('KeyA') || ex < 0.06) { yawTarget += dt * 1.3; }
    if (keysHeld.has('ArrowRight') || keysHeld.has('KeyD') || ex > 0.94) { yawTarget -= dt * 1.3; }
  }
  yawTarget = clampN(yawTarget, -1.25, 1.25); yaw = lerp(yaw, yawTarget, 1 - Math.exp(-dt * 6));
  // The street grows as you walk up to it.
  forEachLot((L, ch) => {
    const mid = (L.z0 + L.z1) / 2;
    if (L.born === undefined && L.z0 - walkZ < GROW) {
      L.born = clockT + (clockT < 1 ? 0.4 + Math.max(0, mid - walkZ) * 0.03 : rngN(L.seed)() * 0.25);
      if (sound && clockT > 1 && clockT - (stepWorld.lastRise || 0) > 0.15) { stepWorld.lastRise = clockT; sound.rise(L.kind === 'corp' ? 3 : 1, -L.side, mid - walkZ); }
    }
    if (L.ad && !L.passedBy && mid < walkZ - 4 && passed < ADS_PER_WALK) { L.passedBy = true; passed++; if (L.ad.tagT === null) { skipped++; toast('You walked past. The ad stays up.'); } updateHud(); if (passed >= ADS_PER_WALK && !ending) { setTimeout(showEnding, 1500); } }
  });
  for (const ch of chunks.values()) {
    for (const p of ch.props) { if (p.born === undefined && p.z - walkZ < GROW) { p.born = clockT + (clockT < 1 ? 0.2 + Math.max(0, p.z - walkZ) * 0.025 : Math.random() * 0.35); } }
    ch.warm = 0.12 + 0.88 * (ch.ads ? ch.tagged / ch.ads : 0); ch.warmNow = lerp(ch.warmNow, ch.warm, 1 - Math.exp(-dt * 1.5));
    for (const p of ch.people) { p.z += p.v * dt; if (p.z > p.hi || p.z < p.lo) { p.v = -p.v; } }
  }
  // Aim: the billboard under the mouse, and spray it.
  aim = intro || ending ? null : pickBillboard();
  const canSpray = spraying && aim && aim.dist < REACH && aim.L.ad.tagT === null;
  if (canSpray) { sprayAt(aim, dt); }
  sprayHiss(spraying && !intro && !ending);
  for (const L of visibleAds()) { if (L.ad.dirty || (L.ad.tagT !== null && clockT - L.ad.tagT < 1.6)) { composeAd(L.ad); } }
  if (sound) { sound.update({ dt, tier: Math.min(4, Math.round(rewritten.length / 3)), casino: 1, night: 0, moving: Math.abs(speed) > 0.1 }); }
  moveHud();
}
function visibleAds() { const out = []; forEachLot(L => { if (L.ad && L.born !== undefined && L.z1 > walkZ - 8) { out.push(L); } }); return out; }
// A ray from the eye through the mouse, tested against every billboard close enough to read.
function pickBillboard() {
  const ey = -EYE, O = [0, ey, walkZ], F = V3.norm([Math.sin(yaw) * 10, 0.35, Math.cos(yaw) * 10]);
  const R = V3.norm(V3.cross([0, -1, 0], F)), Up = V3.cross(F, R), th = Math.tan(FOV / 2), asp = width / height;
  const nx = (mx / width) * 2 - 1, ny = 1 - (my / height) * 2;
  const D = V3.norm(V3.add(F, V3.add(V3.mul(R, nx * th * asp), V3.mul(Up, ny * th))));
  let best = null;
  for (const L of visibleAds()) {
    const a = L.ad; if (riseOf(L.born) < 0.95) { continue; }
    const den = V3.dot(D, a.N); if (den > -0.05) { continue; }
    const t = V3.dot(V3.sub(a.C, O), a.N) / den; if (t <= 0) { continue; }
    const P = V3.add(O, V3.mul(D, t)), q = V3.sub(P, a.C), u = V3.dot(q, a.U) / a.w + 0.5, v = V3.dot(q, a.V) / a.h + 0.5;
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1 && (!best || t < best.dist)) { best = { L, u, v, dist: t }; }
  }
  return best;
}
function sprayAt(hit, dt) {
  const a = hit.L.ad, g = a.paintG || (a.paintG = makeG(512, 256)), col = color(PAINTS[paint].col), rad = 16 + hit.dist * 0.9;
  if (!a.col) { a.col = PAINTS[paint].col; }
  const px = hit.u * 512, py = hit.v * 256;
  g.noStroke(); col.setAlpha(28); g.fill(col); g.circle(px, py, rad * 2.2);
  col.setAlpha(210); g.fill(col);
  for (let i = 0; i < 26; i++) { const ang = Math.random() * TWO_PI, d = Math.pow(Math.random(), 0.7) * rad; g.circle(px + Math.cos(ang) * d, py + Math.sin(ang) * d, Math.random() * 3.2 + 0.8); }
  if (Math.random() < 0.08) { col.setAlpha(170); g.fill(col); const dx = px + (Math.random() - 0.5) * rad; g.rect(dx, py, 2.2, 12 + Math.random() * 30, 2); }   // drips
  const ru = rad / 512, rv = rad / 256;
  for (let gx = Math.floor((hit.u - ru) * 16); gx <= Math.floor((hit.u + ru) * 16); gx++) {
    for (let gy = Math.floor((hit.v - rv) * 8); gy <= Math.floor((hit.v + rv) * 8); gy++) { if (gx >= 0 && gx < 16 && gy >= 0 && gy < 8) { a.cells.add(gx + gy * 16); } }
  }
  a.progress = a.cells.size / 128; a.dirty = true;
  if (a.progress >= 0.42) { tagWall(hit.L); }
}
// Enough paint: your rewrite appears, and the block comes to life.
function tagWall(L) {
  const a = L.ad, ch = [...chunks.values()].find(c => c.lots.includes(L)), r = rngN(L.seed + 5);
  a.tagT = clockT; a.col = a.col || PAINTS[paint].col; rewritten.push({ say: a.say, back: a.back, col: a.col }); if (ch) { ch.tagged++; }
  toast(`“${a.say}” → “${a.back}”`);
  if (sound) { sound.cash(true); setTimeout(() => sound && sound.go(), 250); }
  if (ch) {
    for (let i = 0; i < 8; i++) {
      ch.people.push({ x: L.side * mixN(ROAD + 1.4, EDGE - 0.6, r()), z: mixN(L.z0 - 6, L.z1 + 6, r()), lo: L.z0 - 14, hi: L.z1 + 14, v: (r() < 0.5 ? -1 : 1) * mixN(0.6, 1.3, r()), coat: pickN(r, PAL.coats), skin: pickN(r, PAL.skin), h: r() < 0.25 ? 1.15 : mixN(1.55, 1.85, r()), ph: r() * 6, dog: r() < 0.25, born: clockT + 0.4 + r() * 1.2 });
    }
    for (let i = 0; i < 10; i++) { ch.props.push({ kind: 'flower', x: L.side * (EDGE + mixN(1.2, 5.8, r())), z: mixN(L.z0 + 0.5, L.z1 - 0.5, r()), col: pickN(r, ['#ff4f9a', '#ffd23f', '#ffffff', '#b48cdc', a.col]), born: clockT + 0.3 + r() * 1.2 }); }
  }
  updateHud();
}
function sprayHiss(on) {
  if (!sound || !sound.context || !sound.master) { return; }
  if (!hiss) {
    const ctx = sound.context, buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { d[i] = Math.random() * 2 - 1; }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.7; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sound.master); src.start(); hiss = { g, ctx };
  }
  hiss.g.gain.setTargetAtTime(on ? 0.16 : 0, hiss.ctx.currentTime, on ? 0.02 : 0.05);
}

/* ---------- billboard textures: the ad, your paint on top, then your rewrite ---------- */
function makeG(w, h) { const g = createGraphics(w, h); g.pixelDensity(1); g.clear(); return g; }
function fitLines(g, text, maxW, size, font) {
  g.textFont(font); const words = text.split(' ');
  for (let s = size; s >= 18; s -= 2) {
    g.textSize(s); const lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.textWidth(t) > maxW && cur) { lines.push(cur); cur = w; } else { cur = t; } }
    lines.push(cur);
    if (lines.length <= 2 && lines.every(l => g.textWidth(l) <= maxW)) { return { lines, s }; }
  }
  return { lines: [text], s: 18 };
}
function drawAdDesign(a) {
  const g = a.adG || (a.adG = makeG(512, 256)), styles = [['#2b2d42', '#d9b779', '#ffffff'], ['#f7f4ee', '#c0392b', '#1f1f2e'], ['#3a4a6b', '#9fd3ff', '#ffffff']], [bg, acc, fg] = styles[a.style];
  g.clear(); g.noStroke(); g.background(bg);
  g.fill(acc); g.rect(0, 0, 512, 10); g.rect(0, 246, 512, 10);
  g.fill(acc); g.textFont('Nunito'); g.textStyle(BOLD); g.textAlign(LEFT, TOP); g.textSize(15); g.text('◆ ' + a.brand, 22, 22);
  const { lines, s } = fitLines(g, a.say, 460, 54, 'Fraunces');
  g.fill(fg); g.textAlign(CENTER, CENTER); g.textStyle(BOLD);
  lines.forEach((ln, i) => g.text(ln, 256, 128 + (i - (lines.length - 1) / 2) * s * 1.05));
  g.textStyle(NORMAL); g.textSize(11); g.fill(fg); g.textAlign(CENTER, BOTTOM); g.text('Investment opportunity. Conditions apply. Register your interest today.', 256, 236);
}
function composeAd(a) {
  if (!a.adG) { drawAdDesign(a); }
  const g = a.g || (a.g = makeG(512, 256));
  g.clear(); g.image(a.adG, 0, 0);
  if (a.paintG) { g.image(a.paintG, 0, 0); }
  if (a.tagT !== null) {
    const k = clampN((clockT - a.tagT) / 1.1, 0, 1), { lines, s } = fitLines(g, a.back, 440, 76, 'Permanent Marker');
    g.noStroke(); g.fill(20, 16, 30, 150 * k); g.rect(0, 0, 512, 256);
    g.push(); g.drawingContext.save(); g.drawingContext.beginPath(); g.drawingContext.rect(0, 0, 512 * k + 2, 256); g.drawingContext.clip();
    g.translate(256, 132); g.rotate(-0.06); g.textAlign(CENTER, CENTER);
    lines.forEach((ln, i) => {
      const y = (i - (lines.length - 1) / 2) * s * 1.02;
      g.stroke(20, 16, 30); g.strokeWeight(9); g.strokeJoin(ROUND); g.fill(a.col); g.text(ln, 0, y);
      g.noStroke(); g.fill(a.col); g.text(ln, 0, y);
    });
    const r = rngN(a.say.length * 31);
    g.noStroke(); g.fill(a.col); for (let i = 0; i < 9; i++) { const dx = (r() - 0.5) * 380, len = 10 + r() * 40 * k; g.rect(dx, 20 + r() * 20, 3, len, 2); g.circle(dx + 1.5, 20 + r() * 20 + len, 6); }
    g.drawingContext.restore(); g.pop();
  }
  a.dirty = false;
}

/* ---------- drawing the 3D street into the framebuffer ---------- */
function renderScene() {
  fb.begin();
  background(250, 240, 245); noStroke();
  perspective(FOV, width / height, NEAR, FAR);
  const bob = Math.sin(phase * 2) * 0.035 * Math.min(1, Math.abs(speed) / 3), ey = -(EYE + bob);
  camera(0, ey, walkZ, Math.sin(yaw) * 10, ey + 0.35, walkZ + Math.cos(yaw) * 10, 0, 1, 0);
  ambientLight(132, 128, 140);
  directionalLight(235, 220, 200, -0.5, 0.75, 0.3);
  directionalLight(170, 165, 185, 0.55, 0.7, 0.2);
  push(); translate(0, 0.05, walkZ + 120); fill(PAL.grass); box(600, 0.1, 520); pop();
  const all = [...chunks.values()];
  for (const ch of all) { if (!ch.geom) { ch.geom = buildGeometry(() => bakeChunk(ch)); } model(ch.geom); }
  for (const ch of all) {
    for (const L of ch.lots) { if (L.z1 > walkZ - 8 && L.z0 < walkZ + FAR) { drawLot(L, ch); } }
    for (const p of ch.props) { if (p.z > walkZ - 6) { drawProp(p, ch.warmNow); } }
    for (const p of ch.people) { if (p.z > walkZ - 3) { drawPersonN(p); } }
  }
  fb.end();
}
function bakeChunk(ch) {
  const z0 = ch.z0, zc = z0 + CROSS / 2;
  push(); translate(0, 0, z0 + CH / 2); fill(PAL.road); box(ROAD * 2, 0.12, CH); pop();
  push(); translate(0, -0.005, zc); fill(PAL.roadX); box(400, 0.12, CROSS); pop();
  for (let x = -ROAD + 0.4; x < ROAD; x += 1.1) { push(); translate(x + 0.3, -0.07, z0 + CROSS - 2.2); fill('#fbf6ee'); box(0.6, 0.02, 2.6); pop(); }
  for (let z = z0 + CROSS + 1; z < z0 + CH - 1; z += 4) { push(); translate(0, -0.07, z + 1); fill('#f6e7b0'); box(0.18, 0.02, 2); pop(); }
  for (const s of [-1, 1]) { push(); translate(s * (ROAD + PAVE / 2), -0.02, z0 + CROSS + (CH - CROSS) / 2); fill('#c9dfb4'); box(PAVE, 0.04, CH - CROSS); pop(); }
  for (const b of ch.back) { blockN(b.x, 0, b.z, b.d, b.h, b.w, b.col); }
}
function blockN(x, y, z, w, h, d, col) { push(); translate(x, -(y + h / 2), z); fill(col); box(w, h, d); pop(); }
function drawLot(L, ch) {
  const g = riseOf(L.born), s = L.side, len = L.z1 - L.z0;
  if (L.born !== undefined) { drawPuff(s * (EDGE + 6), (L.z0 + L.z1) / 2, 5, L.born, L.seed, '#fffaf4'); }
  if (L.ad && L.ad.tagT !== null) { drawPuff(s * (EDGE + 3.4), (L.z0 + L.z1) / 2, 6, L.ad.tagT, L.seed + 9, L.ad.col); }
  if (g <= 0.005) { if (L.born === undefined) { drawFuturePlot(L); } return; }
  const w = ch.warmNow;
  push(); translate(0, 0, L.z0); scale(1, Math.max(0.01, g), 1);
  if (L.kind === 'houses') {
    let z = 0.3;
    for (const p of L.parts) {
      const x = s * (EDGE + 1 + p.d / 2);
      blockN(x, 0, z + p.w / 2, p.d, p.h, p.w, warmN(p.col, w));
      roofN(x, p.h, z + p.w / 2, p.d + 0.6, p.w + 0.5, p.rh, warmN(p.roof, w));
      facadeN(s, EDGE + 1, z, z + p.w, 0.8, p.h - 0.3, w > 0.6 ? 'house' : 'houseDim');
      blockN(s * (EDGE + 0.95), 0, z + p.w / 2, 0.15, 2.2, 1.1, '#6b5a7a');
      z += p.w + 0.5;
    }
  } else {
    const a = L.ad, lit = a.tagT !== null ? easeN((clockT - a.tagT) / 2) : 0, d = 14, x = s * (EDGE + 6 + d / 2), bw = len - 1.5;
    const wall = warmN(L.col, Math.max(0.12, lit));
    blockN(x, 0, len / 2, d, L.h, bw, wall);
    facadeN(s, EDGE + 6, len / 2 - bw / 2, len / 2 + bw / 2, 1, L.h - 0.6, lit > 0.5 ? 'lit' : 'dark');
    blockN(x, L.h, len / 2, d + 0.4, 0.6, bw + 0.4, warmN('#fbf6ee', Math.max(0.3, lit)));
    if (lit > 0.01) { push(); translate(x, -L.h - 0.6, len / 2); scale(1, lit, 1); fill('#7cbf6a'); box(d - 2, 1.2, bw - 2); pop(); }   // a roof garden appears
    if (L.crown) { blockN(x, L.h + 0.6, len / 2, 3, 2.4, 3, warmN('#d9b779', lit)); }
  }
  pop();
  if (L.ad) { drawBillboard(L, g); }
}
function drawBillboard(L, g) {
  const a = L.ad, tex = a.g; if (!tex) { a.dirty = true; return; }
  const k = Math.max(0.01, g), C = [a.C[0], a.C[1] * k, a.C[2]], hw = V3.mul(a.U, a.w / 2), hh = V3.mul(a.V, (a.h / 2) * k);
  const tl = V3.sub(V3.sub(C, hw), hh), tr = V3.sub(V3.add(C, hw), hh), br = V3.add(V3.add(C, hw), hh), bl = V3.add(V3.sub(C, hw), hh);
  push(); textureMode(NORMAL); texture(tex);
  beginShape(); normal(a.N[0], a.N[1], a.N[2]);
  vertex(tl[0], tl[1], tl[2], 0, 0); vertex(tr[0], tr[1], tr[2], 1, 0); vertex(br[0], br[1], br[2], 1, 1); vertex(bl[0], bl[1], bl[2], 0, 1);
  endShape(CLOSE); pop();
  // Frame and posts.
  const back = V3.mul(a.N, -0.12);
  const fw = V3.mul(a.U, a.w / 2 + 0.18), fh = V3.mul(a.V, (a.h / 2) * k + 0.18), Cb = V3.add(C, back);
  fill('#e9e4f2'); beginShape(); normal(a.N[0], a.N[1], a.N[2]);
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = V3.add(Cb, V3.add(V3.mul(fw, su), V3.mul(fh, sv))); vertex(q[0], q[1], q[2]); }
  endShape(CLOSE);
  fill(PAL.ink);
  for (const sgn of [-0.32, 0.32]) {
    const p = V3.add([a.C[0], 0, a.C[2]], V3.mul(a.U, a.w * sgn)), top = -a.C[1] * k - (a.h / 2) * k;
    push(); translate(p[0] + back[0] * 2, -top / 2, p[2] + back[2] * 2); box(0.22, top, 0.22); pop();
  }
}
// Trees, lamps, pavement tiles, hedges and flowers pop up with a little overshoot.
function drawProp(p, w) {
  const g = riseOf(p.born); if (g <= 0.005) { return; }
  if (p.kind === 'pave') {
    const k = Math.min(1, g);
    push(); translate(p.side * (ROAD + PAVE / 2), -0.12 * g, p.z); scale(k, Math.max(0.01, g), k); fill(PAL.pave); box(PAVE - 0.05, 0.24, p.len - 0.08); pop();
    push(); translate(p.side * (ROAD + 0.12), -0.14 * g, p.z); scale(1, Math.max(0.01, g), k); fill(PAL.kerb); box(0.24, 0.28, p.len); pop();
    return;
  }
  push(); translate(p.x, 0, p.z); scale(Math.max(0.01, g)); translate(-p.x, 0, -p.z);
  if (p.kind === 'tree') { drawTreeN(p.x, p.z, p.h, p.r, p.tone, p.cone, w); }
  else if (p.kind === 'lamp') { drawLamp(p.x, p.z, w); }
  else if (p.kind === 'bush') { fill(warmN('#7cbf6a', 0.3 + w)); push(); translate(p.x, -p.r * 0.7, p.z); sphere(p.r, 7, 5); pop(); }
  else { fill('#7cbf6a'); push(); translate(p.x, -0.2, p.z); cylinder(0.03, 0.4, 4, 1); pop(); fill(warmN(p.col, 0.2 + w)); push(); translate(p.x, -0.45, p.z); sphere(0.16, 6, 4); pop(); }
  pop();
}
function drawPuff(x, z, w, born, seed, col) {
  const a = clockT - born; if (a < 0 || a > 0.9) { return; }
  const r = rngN(seed), u = a / 0.9; fill(col);
  for (let i = 0; i < 9; i++) {
    const ang = r() * TWO_PI, dist = (0.6 + r() * 0.8) * w * (0.3 + u * 0.7);
    push(); translate(x + Math.cos(ang) * dist, -0.3 - u * 1.5 * r() - (col === '#fffaf4' ? 0 : 3), z + Math.sin(ang) * dist); sphere((0.5 + r() * 0.5) * (1 - u) * 1.4, 6, 4); pop();
  }
}
function drawFuturePlot(L) {
  const s = L.side, xa = EDGE + 0.8, xb = EDGE + 12, len = L.z1 - L.z0; fill('#f6efe2');
  for (const [x, z, w, d] of [[(xa + xb) / 2, L.z0 + 0.5, xb - xa, 0.12], [(xa + xb) / 2, L.z1 - 0.5, xb - xa, 0.12], [xa, L.z0 + len / 2, 0.12, len - 1], [xb, L.z0 + len / 2, 0.12, len - 1]]) {
    push(); translate(s * x, -0.06, z); box(w, 0.06, d); pop();
  }
  for (const [x, z] of [[xa, L.z0 + 0.5], [xb, L.z0 + 0.5], [xa, L.z1 - 0.5], [xb, L.z1 - 0.5]]) { push(); translate(s * x, -0.4, z); box(0.12, 0.8, 0.12); pop(); }
}
function roofN(x, y0, zc, d, w, rh, col) {
  push(); translate(x, -y0, zc); fill(col);
  const hd = d / 2, hw = w / 2, k = Math.hypot(hw, rh);
  beginShape(TRIANGLES);
  normal(0, -hw / k, -rh / k); vertex(-hd, 0, -hw); vertex(hd, 0, -hw); vertex(hd, -rh, 0); vertex(-hd, 0, -hw); vertex(hd, -rh, 0); vertex(-hd, -rh, 0);
  normal(0, -hw / k, rh / k); vertex(-hd, 0, hw); vertex(-hd, -rh, 0); vertex(hd, -rh, 0); vertex(-hd, 0, hw); vertex(hd, -rh, 0); vertex(hd, 0, hw);
  endShape();
  fill(lerpColor(color(col), color('#fbf6ee'), 0.55));
  beginShape(TRIANGLES);
  normal(-1, 0, 0); vertex(-hd + 0.3, 0, -hw + 0.3); vertex(-hd + 0.3, 0, hw - 0.3); vertex(-hd + 0.3, -rh + 0.25, 0);
  normal(1, 0, 0); vertex(hd - 0.3, 0, -hw + 0.3); vertex(hd - 0.3, -rh + 0.25, 0); vertex(hd - 0.3, 0, hw - 0.3);
  endShape();
  pop();
}
function facadeN(s, xEdge, za, zb, y0, y1, kind) {
  const tex = windowTex(kind), x = s * (xEdge - 0.04), u1 = (zb - za) / 3.2, v1 = (y1 - y0) / 3.3;
  push(); textureMode(NORMAL); texture(tex);
  beginShape(); normal(-s, 0, 0);
  vertex(x, -y0, za, 0, v1); vertex(x, -y0, zb, u1, v1); vertex(x, -y1, zb, u1, 0); vertex(x, -y1, za, 0, 0);
  endShape(CLOSE); pop();
}
function drawTreeN(x, z, h, r, tone, isCone, w) {
  push(); translate(x, 0, z);
  fill(warmN('#8a6248', 0.4 + w)); push(); translate(0, -h * 0.25, 0); cylinder(0.16, h * 0.5, 6, 1); pop();
  fill(warmN(tone < 0.33 ? '#7cbf6a' : tone < 0.66 ? '#8fcf72' : '#6aae6e', 0.35 + w));
  if (isCone) { push(); translate(0, -h * 0.68, 0); rotateX(PI); cone(r * 0.8, h * 0.7, 7, 1); pop(); }
  else { push(); translate(0, -h * 0.7, 0); sphere(r, 7, 5); pop(); push(); translate(r * 0.45, -h * 0.82, r * 0.2); sphere(r * 0.7, 7, 5); pop(); }
  pop();
}
function drawLamp(x, z, w) {
  push(); translate(x, 0, z); fill(PAL.ink); push(); translate(0, -2, 0); cylinder(0.06, 4, 6, 1); pop();
  fill(warmN('#ffe8a8', w + 0.2)); push(); translate(0, -4.1, 0); sphere(0.24, 8, 6); pop(); pop();
}
function drawPersonN(p) {
  const g = riseOf(p.born); if (g <= 0.01) { return; }
  const bob = Math.abs(Math.sin(clockT * 6 + p.ph)) * 0.05, h = p.h;
  push(); translate(p.x, -bob, p.z); scale(Math.min(1, g));
  fill('#4a4566'); for (const lx of [-0.09, 0.09]) { push(); translate(lx, -h * 0.17, Math.sin(clockT * 6 + p.ph + (lx > 0 ? PI : 0)) * 0.08); box(0.11, h * 0.34, 0.11); pop(); }
  fill(p.coat); push(); translate(0, -h * 0.55, 0); cylinder(0.24, h * 0.42, 10, 1); pop(); push(); translate(0, -h * 0.76, 0); sphere(0.24, 10, 6); pop();
  fill(p.skin); push(); translate(0, -h * 0.94, 0); sphere(0.17, 10, 8); pop();
  if (p.dog) { const dz = 0.7 * Math.sign(p.v); fill('#c8956a'); push(); translate(0.4, -0.3, dz); box(0.28, 0.24, 0.55); translate(0, -0.18, 0.3 * Math.sign(p.v)); sphere(0.16, 8, 6); pop(); }
  pop();
}
function windowTex(kind) {
  if (texCache.has(kind)) { return texCache.get(kind); }
  const g = makeG(128, 128); g.noStroke();
  if (kind === 'house' || kind === 'houseDim') {
    const dim = kind === 'houseDim';
    g.fill(dim ? '#e4e2ea' : '#fbf6ee'); g.rect(34, 26, 60, 72, 8); g.fill(dim ? '#8c90a6' : '#ffe39a'); g.rect(42, 34, 44, 56, 4);
    g.fill(dim ? '#e4e2ea' : '#fbf6ee'); g.rect(62, 34, 4, 56); g.rect(42, 58, 44, 4);
    if (!dim) { g.fill('#7cbf6a'); g.rect(36, 98, 56, 10, 4); g.fill('#ff8fb3'); for (let i = 0; i < 5; i++) { g.circle(42 + i * 11, 98, 8); } }
  } else {
    const lit = kind === 'lit';
    for (let i = 0; i < 2; i++) { g.fill(lit ? (i ? '#ffe39a' : '#ffd27a') : (i ? '#7c8199' : '#6d7289')); g.rect(10 + i * 62, 18, 46, 84, 3); }
    g.fill(lit ? '#fbf6ee' : '#c7c5d2'); g.rect(0, 112, 128, 10);
    if (lit) { g.fill('#7cbf6a'); g.rect(8, 100, 50, 12, 4); g.fill('#ff4f9a'); for (let i = 0; i < 4; i++) { g.circle(16 + i * 12, 100, 8); } }
  }
  texCache.set(kind, g); return g;
}

/* ---------- painterly post-process: sky, haze, ink outlines, paper ---------- */
const POST_VERT = `
attribute vec3 aPosition; attribute vec2 aTexCoord; varying vec2 vUv;
void main() { vUv = aTexCoord; gl_Position = vec4(aPosition.xy * 2.0, 0.0, 1.0); }`;
const POST_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uCol; uniform sampler2D uDepth; uniform vec2 uRes; uniform float uTime, uNear, uFar, uYaw;
uniform vec3 uInk, uHaze, uSkyTop, uSkyLow;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec2 uv = vUv, px = 1.0 / uRes, tuv = vec2(vUv.x, 1.0 - vUv.y);   // framebuffer rows run top-down
  float d = texture2D(uDepth, tuv).r, z = lin(d);
  vec3 col = texture2D(uCol, tuv).rgb;
  float aspect = uRes.x / uRes.y;
  // Painted sky: gradient, a soft sun at the end of the street, drifting watercolour clouds.
  float hy = 0.5 + 0.06;
  vec3 sky = mix(uSkyLow, uSkyTop, smoothstep(hy - 0.05, 1.05, uv.y));
  vec2 sp = vec2((uv.x - 0.5 + uYaw * 0.55) * aspect, uv.y - hy - 0.08);
  sky += vec3(1.0, 0.93, 0.8) * 0.35 * exp(-dot(sp, sp) * 18.0);
  vec2 cp = vec2(uv.x * aspect * 1.6 + uYaw * 1.2 + uTime * 0.01, uv.y * 5.0);
  float cl = smoothstep(0.52, 0.78, fbm(cp)) * smoothstep(hy, hy + 0.12, uv.y);
  sky = mix(sky, vec3(1.0, 0.99, 0.98), cl * 0.85);
  bool isSky = d > 0.99999;
  if (isSky) { col = sky; }
  else {
    float f = smoothstep(25.0, uFar * 0.85, z);
    col = mix(col, mix(uHaze, uSkyLow, 0.35), f * 0.9);
  }
  // Ink outlines where depth jumps (silhouettes, edges of buildings).
  float e = 0.0, zc = z;
  for (int i = 0; i < 4; i++) {
    vec2 o = i == 0 ? vec2(px.x, 0.0) : i == 1 ? vec2(-px.x, 0.0) : i == 2 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
    float zn = lin(texture2D(uDepth, tuv + o * 1.3).r); e = max(e, abs(zn - z) / max(min(zn, z), 0.001)); zc = min(zc, zn);
  }
  float edge = smoothstep(0.03, 0.09, e) * (1.0 - smoothstep(60.0, 180.0, zc));
  col = mix(col, uInk, edge * 0.85);
  // Paper: a soft blotchy wash and fine grain.
  col *= 0.965 + 0.07 * fbm(uv * uRes / 220.0);
  col += (hash(uv * uRes + fract(uTime)) - 0.5) * 0.03;
  float vig = smoothstep(1.25, 0.45, length((uv - 0.5) * vec2(aspect, 1.0)));
  col = mix(col * vec3(0.95, 0.93, 0.97), col, vig);
  gl_FragColor = vec4(col, 1.0);
}`;


/* ---------- HTML HUD: panel, crosshair, the spray can in your hand ---------- */
function buildUI() {
  const css = document.createElement('style');
  css.textContent = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Nunito:wght@500;700;800&family=Permanent+Marker&display=swap');
  canvas{cursor:none}
  .pl{position:fixed;font-family:Nunito,system-ui,sans-serif;color:#3d3553;z-index:5;user-select:none}
  .pl-panel{top:16px;left:16px;background:#fffaf2;border-radius:18px;padding:14px 18px;box-shadow:0 6px 0 rgba(61,53,83,.15);width:230px;border:2px solid #3d3553}
  .pl-panel h4{margin:0 0 4px;font:800 11px Nunito;letter-spacing:.14em;color:#9a86b8}
  .pl-big{font:400 30px 'Permanent Marker',Impact,sans-serif;line-height:1.1}
  .pl-small{font-size:12px;color:#8a7a9a;font-weight:700}
  .pl-sw{display:flex;gap:8px;margin-top:10px}.pl-sw div{width:30px;height:30px;border-radius:50%;border:2px solid #3d3553;display:flex;align-items:flex-end;justify-content:flex-end;font:800 10px Nunito;cursor:pointer}
  .pl-sw div.on{box-shadow:0 0 0 3px #fffaf2,0 0 0 5px #3d3553}
  .pl-help{top:16px;right:16px;font-size:12px;font-weight:700;color:#5d5277;background:rgba(255,250,242,.85);padding:6px 12px;border-radius:20px;text-align:right}
  .pl-x{width:44px;height:44px;margin:-22px 0 0 -22px;pointer-events:none;border-radius:50%;border:2.5px dashed #3d3553;transition:border-color .15s,transform .15s}
  .pl-x.hot{border-style:solid;transform:scale(1.15)}.pl-x b{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#3d3553}
  .pl-x i{position:absolute;inset:-9px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p)*1%),transparent 0);-webkit-mask:radial-gradient(circle,transparent 27px,#000 28px);mask:radial-gradient(circle,transparent 27px,#000 28px)}
  .pl-mist{width:120px;height:120px;margin:-60px 0 0 -60px;pointer-events:none;border-radius:50%;opacity:0;transition:opacity .08s;filter:blur(6px)}
  .pl-can{right:4vw;bottom:-40px;width:150px;pointer-events:none;transform-origin:50% 100%;transition:transform .08s}
  .pl-toast{left:50%;transform:translateX(-50%);bottom:40px;font:400 22px 'Permanent Marker',Impact,sans-serif;background:#3d3553;color:#fffaf2;padding:10px 22px;border-radius:30px;opacity:0;transition:opacity .4s;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
  .pl-over{inset:0;display:flex;align-items:center;justify-content:center;background:rgba(61,53,83,.4);opacity:0;pointer-events:none;transition:opacity .5s;z-index:9}
  .pl-over.show{opacity:1;pointer-events:auto;cursor:auto}
  .pl-sheet{background:#fffaf2;border:2px solid #3d3553;border-radius:22px;box-shadow:0 8px 0 #3d3553;padding:26px 30px;max-width:580px;width:calc(100vw - 48px);text-align:center;max-height:90vh;overflow:auto}
  .pl-sheet h1{font:400 40px 'Permanent Marker',Impact,sans-serif;margin:0 0 6px;color:#ff4f9a;text-shadow:2px 2px 0 #3d3553}.pl-sheet h2{font:800 13px Nunito;color:#9a86b8;margin:0 0 12px;letter-spacing:.14em}
  .pl-sheet p{font-size:16px;line-height:1.5;margin:6px 0}.pl-sheet button{margin-top:14px;font:800 16px Nunito;background:#ff4f9a;color:#fff;border:2px solid #3d3553;border-radius:30px;padding:10px 22px;box-shadow:0 4px 0 #3d3553;cursor:pointer}
  .pl-sheet .tip{font-style:italic;color:#5d5277}
  .pl-wall{display:flex;flex-direction:column;gap:6px;margin:12px 0}.pl-wall div{font-size:13px;text-align:left;background:#2b2d42;color:#d9b779;border-radius:8px;padding:6px 10px}
  .pl-wall b{display:block;font:400 19px 'Permanent Marker',Impact,sans-serif}`;
  document.head.appendChild(css);
  const el = (cls, html) => { const d = document.createElement('div'); d.className = 'pl ' + cls; d.innerHTML = html; document.body.appendChild(d); return d; };
  ui.panel = el('pl-panel', '');
  ui.help = el('pl-help', 'W / ↑ walk · Shift hurry<br>aim with the mouse · hold click or Space to spray<br>1–4 paint · ← → or screen edges to look · M sound · R restart');
  ui.mist = el('pl-mist', ''); ui.x = el('pl-x', '<i></i><b></b>');
  ui.can = el('pl-can', `<svg viewBox="0 0 120 220" width="150"><g stroke="#3d3553" stroke-width="4" stroke-linejoin="round">
    <rect x="50" y="8" width="20" height="16" rx="3" fill="#fffaf2"/><rect x="44" y="22" width="32" height="18" rx="6" fill="#b9b4c8"/>
    <rect x="22" y="38" width="76" height="176" rx="22" fill="var(--paint,#ff4f9a)"/><rect x="22" y="92" width="76" height="62" fill="#fffaf2"/>
    <path d="M36 104 q24 -10 48 0" fill="none"/><path d="M38 124 h44 M42 138 h36" stroke-width="3"/></g>
    <rect x="30" y="50" width="10" height="150" rx="5" fill="#fff" opacity=".35"/></svg>`);
  ui.toast = el('pl-toast', '');
  ui.intro = el('pl-over show', `<div class="pl-sheet"><h2>PLOTLINE</h2><h1>Talk back</h1>
    <p>This street was written by developers. Every new block goes up with a billboard telling you what to want: <i>luxury</i>, <i>investment</i>, <i>your future</i>.</p>
    <p>You have a spray can. <b>Aim at a billboard and hold the mouse to spray.</b> Cover enough of it and your words go up instead, and the block comes back to life.</p>
    <p class="tip">Walk past, and the ad stays.</p>
    <button>Pick up the can</button><p class="pl-small">W / ↑ walk · mouse aim · hold click or Space to spray · 1–4 paint colour</p></div>`);
  ui.intro.querySelector('button').addEventListener('click', e => { e.stopPropagation(); startWalk(); });
  ui.end = el('pl-over', '');
  document.addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS' && !intro && !ending) { spraying = true; beginSound(); } });
  document.addEventListener('pointerup', () => { spraying = false; });
  document.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
  mx = window.innerWidth / 2; my = window.innerHeight * 0.42;
}
function startWalk() { intro = false; ui.intro.classList.remove('show'); beginSound(); updateHud(); }
async function beginSound() { if (audioStarted || !sound) { return; } audioStarted = true; try { await sound.start(); } catch (e) { console.warn(e); } }
function updateHud() {
  if (!ui.panel) { return; }
  ui.panel.innerHTML = `<h4>BILLBOARDS REWRITTEN</h4><div class="pl-big">${rewritten.length} <span class="pl-small">/ ${ADS_PER_WALK}</span></div>
    <div class="pl-small">${Math.max(0, ADS_PER_WALK - passed)} still ahead · walked past ${skipped}</div>
    <div class="pl-sw">${PAINTS.map((p, i) => `<div data-i="${i}" class="${i === paint ? 'on' : ''}" style="background:${p.col}">${i + 1}</div>`).join('')}</div>`;
  ui.panel.querySelectorAll('.pl-sw div').forEach(d => d.addEventListener('pointerdown', e => { e.stopPropagation(); setPaint(+d.dataset.i); }));
  ui.can.style.setProperty('--paint', PAINTS[paint].col);
}
function setPaint(i) { paint = i; updateHud(); }
// Crosshair, mist and can follow the mouse every frame.
function moveHud() {
  if (!ui.x) { return; }
  const hot = aim && aim.dist < REACH && aim.L.ad.tagT === null, col = PAINTS[paint].col, show = !intro && !ending;
  ui.x.style.display = ui.can.style.display = show ? 'block' : 'none';
  ui.x.style.left = mx + 'px'; ui.x.style.top = my + 'px'; ui.x.classList.toggle('hot', !!hot);
  ui.x.style.borderColor = hot ? col : '#3d3553';
  ui.x.querySelector('i').style.cssText = `--c:${col};--p:${hot ? Math.min(100, aim.L.ad.progress / 0.42 * 100) : 0}`;
  ui.mist.style.left = mx + 'px'; ui.mist.style.top = my + 'px';
  ui.mist.style.background = `radial-gradient(circle, ${col}cc 0%, ${col}55 35%, transparent 70%)`;
  ui.mist.style.opacity = spraying && show ? (0.55 + Math.random() * 0.3) : 0;
  const ang = Math.atan2(my - window.innerHeight, mx - window.innerWidth * 0.9) + HALF_PI, shake = spraying ? (Math.random() - 0.5) * 3 : 0;
  ui.can.style.transform = `translate(${(mx - window.innerWidth * 0.8) * 0.08 + shake}px, ${spraying ? -8 : 0}px) rotate(${clampN(ang, -0.9, 0.5)}rad)`;
  if (frameCount % 20 === 0) { updateHud(); }
}
let toastTimer = null;
function toast(text) { ui.toast.textContent = text; ui.toast.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.style.opacity = 0; }, 3600); }
function showEnding() {
  ending = true; spraying = false; updateHud();
  const n = rewritten.length, total = Math.max(passed, 1), share = n / total;
  const title = share >= 0.75 ? 'The street talks back' : share >= 0.4 ? 'Half the walls are yours' : n > 0 ? 'Most of the ads won' : 'The ads won';
  const tip = share >= 0.75 ? 'Every block you painted filled with people. The ones you passed are still selling.' : n > 0 ? 'Where you sprayed, people came out. Where you walked past, the street stayed empty.' : 'You walked the whole street and let the billboards do the talking.';
  ui.end.innerHTML = `<div class="pl-sheet"><h2>YOUR STREET</h2><h1>${title}</h1>
    <p>You rewrote <b>${n}</b> of <b>${total}</b> billboards.</p>
    <div class="pl-wall">${rewritten.map(w => `<div><s>${w.say}</s><b style="color:${w.col}">${w.back}</b></div>`).join('') || '<div>Nothing rewritten.</div>'}</div>
    <p class="tip">${tip}</p><p class="pl-small">A city is full of messages. Who gets to write them?</p>
    <button>Walk it again</button></div>`;
  ui.end.querySelector('button').addEventListener('click', e => { e.stopPropagation(); resetGame(); startWalk(); });
  ui.end.classList.add('show'); if (sound) { sound.go(); }
}

/* ---------- keys ---------- */
function onKey(e) {
  const pi = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
  if (pi !== undefined) { setPaint(pi); return; }
  if (intro && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW')) { startWalk(); e.preventDefault(); return; }
  if (e.code === 'Space' && !ending) { spraying = true; beginSound(); }
  if (e.code === 'Enter') { autoWalk = !autoWalk; }
  if (e.code === 'KeyM' && sound) { sound.toggle(); }
  if (e.code === 'KeyR') { resetGame(); }
  if (e.code.startsWith('Arrow') || e.code === 'Space') { e.preventDefault(); }
}
window.addEventListener('keyup', e => { if (e.code === 'Space') { spraying = false; } });
