// noprotect
// Plotline 3D — combined file for the p5.js Web Editor (p5.js 1.x and 2.x).
// Paste this whole file into sketch.js. It is street-sound.js and 3d/sketch.js in one.

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
/* Plotline 3D — You Plan the Street (p5.js WEBGL).
 * A first-person walk down an endless toy-town street. Every empty plot you walk up to is
 * your call: homes, a tower, a shop or a park. Your choice rises out of the ground in front
 * of you; people, signs, sound and land value follow it. Skip a plot and the market decides.
 * Everything is generated in code: low-poly buildings, trees and people, with a painterly
 * post-process (ink outlines from the depth buffer, soft haze, paper grain, a painted sky).
 * The HUD is plain HTML so text stays crisp in WEBGL.
 * Controls: hold W / Up / mouse to walk, Shift hurry, S / Down back, 1-4 choose (or click a
 * card), Enter stroll, move the mouse to look, M sound, R plan a new street.
 */
const CH = 48, CROSS = 10, ROAD = 4, PAVE = 3.5, EDGE = ROAD + PAVE, EYE = 1.65, NEAR = 0.3, FAR = 360;
const WALK = 4.5, RUN = 9, STROLL = 2.6, SLOW = 1.4, RISE = 1.1, GROW = 40, PLOTS = 16;   // nothing is built further ahead than GROW m: the street grows as you walk
const PAL = {
  ink: '#3d3553', road: '#a19ea9', roadX: '#aeabb6', pave: '#ece0cd', kerb: '#e7d8c2', grass: '#a9d48f', grass2: '#97c97f',
  houses: ['#f4b6c2', '#f7c59f', '#f4d58d', '#b8d8be', '#b8c8ec', '#d6c4ec', '#f2a7a0'], roofs: ['#c96f7e', '#5b7fb8', '#e08f5f', '#6d9f84', '#8f78b8'],
  towers: ['#9fb7d4', '#a9c3dc', '#b5c4e2', '#8fb0cc'], shops: ['#ffd7a8', '#ffe7a3', '#cfeedd', '#ffd1dc', '#dcd2ff'],
  coats: ['#f28b82', '#6fa8dc', '#f7b267', '#7cc48a', '#b48cdc', '#f4d35e', '#ff8fb3'], skin: ['#f3d2b8', '#d8a27c', '#a8704a', '#ffe1c9']
};
const CHOICES = {
  homes: { key: '1', name: 'Homes', note: 'affordable, for families', col: '#f28b9f' },
  tower: { key: '2', name: 'Tower', note: 'developers pay big', col: '#6f9ee0' },
  shop: { key: '3', name: 'Shop', note: 'café, bakery, books', col: '#f2a64a' },
  park: { key: '4', name: 'Park', note: 'trees, benches, dogs', col: '#5fb874' }
};
const ORDER = ['homes', 'tower', 'shop', 'park'];
const SHOP_NAMES = ['Bean There', 'Loaf & Co.', 'Paper Moon', 'Petal Shop', 'Little Deli', 'Corner Café', 'Noodle Bar', 'Book Nook', 'Ice Cream', 'Plant Club'];
const SIGNS = {
  tower: ['SOLD OUT to investors', 'Luxury living from $2.4M', '1 bed · $950 a week', 'Lights on in 1 of 5 flats', 'Your future. Our yield.'],
  market: ['The market decided', 'Nobody asked. It sold.', 'Highest bidder wins'],
  homes: ['Homes for 60 people', 'Rent you can actually pay', 'Families welcome'],
  park: ['Free for everyone', 'Dogs welcome', 'Sit as long as you like']
};

let fb, post, sound, audioStarted = false, ui = {};
let walkZ = 0, speed = 0, yaw = 0, yawTarget = 0, phase = 0, lastStep = 0, autoWalk = false, pointerHeld = false, seedN = 7;
let budget, housed, vibe, landValue, built, plotTarget = null, intro = true, ending = false, clockT = 0;
const keysHeld = new Set(), chunks = new Map(), texCache = new Map();

/* ---------- small helpers (N suffix so nothing clashes with p5) ---------- */
function rngN(s) { let x = s | 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) | 0; return (x >>> 0) / 4294967296; }; }
const mixN = (a, b, t) => a + (b - a) * t, pickN = (r, l) => l[Math.floor(r() * l.length)], clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOutBack = t => { t = clampN(t, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const riseOf = born => born === undefined ? 0 : easeOutBack((clockT - born) / RISE);
const money = v => (v < 0 ? '−' : '') + '$' + (Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(2) + 'M' : Math.round(Math.abs(v) / 1000) + 'k');
function hexN(h) { const c = color(h); return [red(c), green(c), blue(c)].map(v => v / 255); }

/* ---------- setup ---------- */
function setup() {
  const c = createCanvas(windowWidth, windowHeight, WEBGL); pixelDensity(Math.min(2, displayDensity()));
  c.elt.setAttribute('aria-label', 'Plotline 3D. Walk down a toy-town street and decide what each empty plot becomes: press 1 homes, 2 tower, 3 shop, 4 park.');
  textureWrap(REPEAT);   // once, before any texture exists: window decals tile
  fb = createFramebuffer({ antialias: false });
  post = createShader(POST_VERT, POST_FRAG);
  sound = typeof StreetSound !== 'undefined' ? new StreetSound() : null;
  buildUI(); resetGame();
  window.addEventListener('keydown', e => { keysHeld.add(e.code); onKey(e); });
  window.addEventListener('keyup', e => keysHeld.delete(e.code));
  window.addEventListener('blur', () => keysHeld.clear());
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); fb.resize(width, height); }
function resetGame() {
  budget = 2000000; housed = 0; vibe = 40; landValue = 1; built = []; plotTarget = null; ending = false;
  walkZ = 0; speed = 0; seedN += 97; for (const ch of chunks.values()) { if (ch.geom && typeof freeGeometry === 'function') { freeGeometry(ch.geom); } } chunks.clear(); clockT = 0;
  ui.post.classList.remove('show'); ui.intro.classList.add('show'); intro = true; updateHud();
}

/* ---------- the street, in 48 m blocks ---------- */
function chunkAtN(c) {
  if (chunks.has(c)) { return chunks.get(c); }
  const r = rngN(c * 7919 + seedN * 104729), z0 = c * CH, ch = { c, z0, lots: [], props: [], people: [], back: [] };
  for (const side of [-1, 1]) {
    const open = r() < 0.5 ? 0 : 1, len = (CH - CROSS - 1.6) / 2 - 0.4;
    for (let i = 0; i < 2; i++) {
      const z = z0 + CROSS + 0.6 + i * (len + 0.8);
      const L = { side, z0: z, z1: z + len, seed: Math.floor(r() * 1e9), kind: i === open && c >= 0 ? 'pending' : 'neighbour' };
      dressLot(L, L.kind === 'pending' ? 'pending' : 'neighbour');
      ch.lots.push(L);
    }
    for (let z = z0 + CROSS + 3; z < z0 + CH - 2; z += 12) {
      ch.props.push({ kind: 'tree', x: side * (ROAD + 0.9), z: z + (side > 0 ? 6 : 0), h: mixN(4.5, 6.5, r()), r: mixN(1.4, 2.1, r()), tone: r(), cone: r() < 0.25 });
      ch.props.push({ kind: 'lamp', x: side * (ROAD + 0.45), z: z + (side > 0 ? 0 : 6) });
    }
    // Pavement tiles, hedges and flowers: they sprout as you walk up to them.
    for (let z = z0 + CROSS; z < z0 + CH - 0.1; z += 4) { ch.props.push({ kind: 'pave', side, z: z + 2, len: Math.min(4, z0 + CH - z) }); }
    for (let z = z0 + CROSS + 1.5; z < z0 + CH - 1; z += mixN(2.5, 5, r())) { ch.props.push({ kind: r() < 0.55 ? 'bush' : 'flower', x: side * (EDGE + mixN(0.25, 0.6, r())), z, r: mixN(0.35, 0.6, r()), col: pickN(r, ['#ff8fb3', '#f7b267', '#fff0a0', '#b48cdc', '#ffffff']) }); }
    // Soft hills and a far row of pastel blocks behind the plots.
    ch.back.push({ x: side * mixN(34, 46, r()), z: z0 + mixN(8, 40, r()), w: mixN(10, 18, r()), h: mixN(8, 22, r()), d: mixN(10, 16, r()), col: pickN(r, ['#d9cff5', '#cfe0f5', '#f7d3de', '#d4ecdc']) });
  }
  chunks.set(c, ch); return ch;
}
// What a plot looks like for each kind.
function dressLot(L, kind) {
  const r = rngN(L.seed + (kind === 'pending' ? 1 : 17));
  L.kind = kind; L.sign = null;
  if (kind === 'neighbour') {
    const n = r() < 0.5 ? 2 : 3; L.parts = [];
    for (let i = 0; i < n; i++) { L.parts.push({ w: (L.z1 - L.z0) / n - 0.5, h: mixN(5.5, 8, r()), d: mixN(8, 10, r()), col: pickN(r, PAL.houses), roof: pickN(r, PAL.roofs), rh: mixN(2, 3.2, r()) }); }
  } else if (kind === 'homes') {
    L.parts = []; for (let i = 0; i < 3; i++) { L.parts.push({ w: (L.z1 - L.z0) / 3 - 0.4, h: mixN(9, 11, r()), d: 10, col: pickN(r, PAL.houses), roof: pickN(r, PAL.roofs), rh: mixN(2.4, 3.4, r()), balcony: true }); }
    L.sign = pickN(r, SIGNS.homes);
  } else if (kind === 'tower') {
    L.h = mixN(38, 60, r()) * landValue; L.col = pickN(r, PAL.towers); L.crown = r() < 0.6;
    L.sign = pickN(r, L.byMarket ? SIGNS.market : SIGNS.tower);
  } else if (kind === 'shop') {
    L.h = mixN(6.5, 8.5, r()); L.col = pickN(r, PAL.shops); L.awning = pickN(r, ['#f28b82', '#6fa8dc', '#7cc48a', '#f7b267']); L.name = pickN(r, SHOP_NAMES); L.sign = null;
  } else if (kind === 'park') {
    L.trees = []; for (let i = 0; i < 6; i++) { L.trees.push({ x: mixN(3, 13, r()), z: mixN(2, L.z1 - L.z0 - 2, r()), h: mixN(4, 7, r()), r: mixN(1.5, 2.6, r()), tone: r(), cone: r() < 0.3 }); }
    L.sign = pickN(r, SIGNS.park);
  }
}
function forEachLot(fn) { for (const ch of chunks.values()) { for (const L of ch.lots) { fn(L, ch); } } }

/* ---------- the game ---------- */
function effectOf(kind) {
  if (kind === 'homes') { return { money: -Math.round(400000 * landValue), housed: 60, vibe: 6, land: 0 }; }
  if (kind === 'tower') { return { money: Math.round(900000 * landValue), housed: 8, vibe: -10, land: 0.12 }; }
  if (kind === 'shop') { return { money: 150000, housed: 0, vibe: 10, land: 0.03 }; }
  return { money: -300000, housed: 0, vibe: 14, land: 0.05 };
}
const canAfford = kind => budget + effectOf(kind).money >= 0;
function decide(L, ch, kind, byMarket) {
  const fx = effectOf(kind), r = rngN(L.seed + 3);
  budget += fx.money; housed += fx.housed; vibe = clampN(vibe + fx.vibe, 0, 100); landValue += fx.land;
  L.byMarket = !!byMarket; dressLot(L, kind); L.born = clockT + 0.05; built.push(kind);
  if (sound && fx.money) { sound.cash(fx.money > 0); }
  if (fx.money) { flashMoney(fx.money); }
  const n = { homes: 6, shop: 4, park: 7, tower: 1 }[kind];
  for (let i = 0; i < n; i++) {
    ch.people.push({ x: L.side * mixN(ROAD + 1.4, EDGE - 0.6, r()), z: mixN(L.z0, L.z1, r()), lo: L.z0 - 8, hi: L.z1 + 8, v: (r() < 0.5 ? -1 : 1) * mixN(0.6, 1.3, r()), coat: pickN(r, PAL.coats), skin: pickN(r, PAL.skin), h: kind === 'park' && r() < 0.35 ? 1.15 : mixN(1.55, 1.85, r()), ph: r() * 6, dog: r() < 0.25, born: clockT + 0.7 + r() * 0.8 });
  }
  toast(byMarket ? (kind === 'tower' ? 'Nobody decided, so the market did: another tower.' : 'Nobody decided, so the market did: a shop.')
    : { homes: `Homes for 60 people. Land is pricier now, so the next homes cost ${money(-effectOf('homes').money)}.`, tower: 'A developer pays well. Most flats will be bought as investments.', shop: 'Somewhere to get a coffee. The street wakes up.', park: 'Trees, benches, a dog park. People come out.' }[kind]);
  updateHud();
  if (built.length >= PLOTS && !ending) { setTimeout(showPostcard, 2600); }
}
function choose(kind) {
  if (intro) { startWalk(); return; }
  if (!plotTarget || ending) { return; }
  if (!canAfford(kind)) { toast(`Not enough budget for ${CHOICES[kind].name.toLowerCase()}. A tower or a shop would bring money in.`); return; }
  const ch = [...chunks.values()].find(c => c.lots.includes(plotTarget));
  decide(plotTarget, ch, kind, false); plotTarget = null;
}
function soundTier() { const n = built.length || 1, towers = built.filter(k => k === 'tower').length / n; return towers > 0.45 ? 4 : vibe > 70 ? 2 : vibe > 40 ? 1 : 0; }
function startWalk() { intro = false; ui.intro.classList.remove('show'); beginSound(); }
async function beginSound() { if (audioStarted || !sound) { return; } audioStarted = true; try { await sound.start(); } catch (e) { console.warn(e); } }

/* ---------- every frame ---------- */
function draw() {
  const dt = Math.min(deltaTime / 1000, 0.05); clockT += dt;
  try { stepWorld(dt); renderScene(); } catch (e) { console.error(e); }
  shader(post);
  post.setUniform('uCol', fb.color); post.setUniform('uDepth', fb.depth);
  post.setUniform('uRes', [width, height]); post.setUniform('uTime', clockT); post.setUniform('uNear', NEAR); post.setUniform('uFar', FAR);
  post.setUniform('uYaw', yaw);
  post.setUniform('uInk', hexN(PAL.ink)); post.setUniform('uHaze', hexN('#eef1fb')); post.setUniform('uSkyTop', hexN('#8fb8ea')); post.setUniform('uSkyLow', hexN('#fbe3ea'));
  clear(); noStroke(); plane(1, 1); resetShader();
}
function stepWorld(dt) {
  const c = Math.floor(walkZ / CH);
  for (let i = c - 1; i <= c + 7; i++) { chunkAtN(i); }
  for (const k of [...chunks.keys()]) { if (k < c - 2 || k > c + 9) { const g = chunks.get(k).geom; if (g && typeof freeGeometry === 'function') { freeGeometry(g); } chunks.delete(k); } }
  // Walking.
  const fwd = keysHeld.has('KeyW') || keysHeld.has('ArrowUp') || pointerHeld, back = keysHeld.has('KeyS') || keysHeld.has('ArrowDown'), hurry = keysHeld.has('ShiftLeft') || keysHeld.has('ShiftRight');
  let want = 0;
  if (!intro && !ending) { if (back) { want = -WALK * 0.6; } else if (fwd) { want = hurry ? RUN : WALK; } else if (autoWalk) { want = hurry ? RUN : STROLL; } }
  if (plotTarget && !hurry && want > SLOW && (plotTarget.z0 + plotTarget.z1) / 2 - walkZ < 15) { want = SLOW; }
  speed = lerp(speed, want, 1 - Math.exp(-dt * 4.5)); walkZ += speed * dt;
  phase += Math.abs(speed) * dt * 1.9;
  if (Math.floor(phase / PI) !== lastStep) { lastStep = Math.floor(phase / PI); if (sound && Math.abs(speed) > 0.5) { sound.footstep(Math.min(1, Math.abs(speed) / RUN)); } }
  yaw = lerp(yaw, yawTarget, 1 - Math.exp(-dt * 5));
  // Plots: rise when near; the one ahead is yours to decide; passed ones go to the market.
  let best = null;
  forEachLot((L, ch) => {
    const mid = (L.z0 + L.z1) / 2, d = mid - walkZ;
    if (L.kind === 'neighbour' && L.born === undefined && L.z0 - walkZ < GROW) {
      L.born = clockT + (clockT < 1 ? 0.4 + Math.max(0, d) * 0.03 : rngN(L.seed)() * 0.25);
      if (sound && clockT > 1 && clockT - (stepWorld.lastRise || 0) > 0.15) { stepWorld.lastRise = clockT; sound.rise(1, -L.side, d); }
    }
    if (L.kind !== 'pending') { return; }
    if (mid < walkZ - 25 || ((intro || ending) && mid < walkZ + 3)) { dressLot(L, 'neighbour'); L.born = clockT; return; }
    if (mid < walkZ + 3) { decide(L, ch, landValue > 1.25 ? 'tower' : 'shop', true); return; }
    if (d > 5 && d < 45 && (!best || d < best.d)) { best = { L, d }; }
  });
  const was = plotTarget; plotTarget = intro || ending ? null : best ? best.L : null;
  if (was !== plotTarget) { updateHud(); }
  for (const ch of chunks.values()) {
    for (const p of ch.props) { if (p.born === undefined && p.z - walkZ < GROW) { p.born = clockT + (clockT < 1 ? 0.2 + Math.max(0, p.z - walkZ) * 0.025 : Math.random() * 0.35); } }
  }
  for (const ch of chunks.values()) { for (const p of ch.people) { p.z += p.v * dt; if (p.z > p.hi || p.z < p.lo) { p.v = -p.v; } } }
  if (sound) { sound.update({ dt, tier: soundTier(), casino: 1, night: 0, moving: Math.abs(speed) > 0.1 }); }
  // Passing GO at the start of every tenth block: council rates.
  const here = Math.floor(walkZ / CH);
  if (here !== stepWorld.last) { if (stepWorld.last !== undefined && here > stepWorld.last && here % 10 === 0 && !intro && !ending) { const rates = housed * 2000; budget += rates; if (rates) { flashMoney(rates); } toast(rates ? `GO! Council rates from your residents: +${money(rates)}` : 'GO! No residents, no rates.'); if (sound) { sound.go(); } updateHud(); } stepWorld.last = here; }
  if (frameCount % 10 === 0) { updateHud(); }
}

/* ---------- drawing the 3D street into the framebuffer ---------- */
function renderScene() {
  fb.begin();
  background(250, 240, 245); noStroke();
  perspective(PI / 3.1, width / height, NEAR, FAR);
  const bob = Math.sin(phase * 2) * 0.035 * Math.min(1, Math.abs(speed) / 3), ey = -(EYE + bob);
  camera(0, ey, walkZ, Math.sin(yaw) * 10, ey + 0.35, walkZ + Math.cos(yaw) * 10, 0, 1, 0);
  ambientLight(132, 128, 140);
  directionalLight(235, 220, 200, -0.5, 0.75, 0.3);
  directionalLight(170, 165, 185, 0.55, 0.7, 0.2);
  // Grass everywhere, then the road and pavements block by block.
  push(); translate(0, 0.05, walkZ + 120); fill(PAL.grass); box(600, 0.1, 520); pop();
  const all = [...chunks.values()];
  // Ground, back blocks, street trees and lamps never change, so each block is baked into one model.
  for (const ch of all) { if (!ch.geom) { ch.geom = buildGeometry(() => bakeChunk(ch)); } model(ch.geom); }
  for (const ch of all) {
    for (const L of ch.lots) { if (L.z1 > walkZ - 6 && L.z0 < walkZ + FAR) { drawLot(L); } }
    for (const p of ch.props) { if (p.z > walkZ - 6) { drawProp(p); } }
    for (const p of ch.people) { if (p.z > walkZ - 3) { drawPersonN(p); } }
  }
  if (plotTarget) { drawMarker(plotTarget); }
  fb.end();
}
function bakeChunk(ch) {
  drawGround(ch);
  for (const b of ch.back) { blockN(b.x, 0, b.z, b.d, b.h, b.w, b.col); }
}
// Trees, lamps, pavement tiles, hedges and flowers pop up out of the ground with a little overshoot.
function drawProp(p) {
  const g = riseOf(p.born); if (g <= 0.005) { return; }
  if (p.kind === 'pave') {
    const k = Math.min(1, g);
    push(); translate(p.side * (ROAD + PAVE / 2), -0.12 * g, p.z); scale(k, Math.max(0.01, g), k); fill(PAL.pave); box(PAVE - 0.05, 0.24, p.len - 0.08); pop();
    push(); translate(p.side * (ROAD + 0.12), -0.14 * g, p.z); scale(1, Math.max(0.01, g), k); fill(PAL.kerb); box(0.24, 0.28, p.len); pop();
    return;
  }
  push(); translate(p.x || 0, 0, p.z); scale(Math.max(0.01, g)); translate(-(p.x || 0), 0, -p.z);
  if (p.kind === 'tree') { drawTreeN(p.x, p.z, p.h, p.r, p.tone, p.cone, 1); }
  else if (p.kind === 'lamp') { drawLamp(p.x, p.z); }
  else if (p.kind === 'bush') { fill('#7cbf6a'); push(); translate(p.x, -p.r * 0.7, p.z); sphere(p.r, 7, 5); pop(); }
  else { fill('#7cbf6a'); push(); translate(p.x, -0.2, p.z); cylinder(0.03, 0.4, 4, 1); pop(); fill(p.col); push(); translate(p.x, -0.45, p.z); sphere(0.16, 6, 4); pop(); }
  pop();
}
// A puff of little clouds while something rises.
function drawPuff(x, z, w, born, seed) {
  const a = clockT - born; if (a < 0 || a > 0.9) { return; }
  const r = rngN(seed), u = a / 0.9; fill('#fffaf4');
  for (let i = 0; i < 9; i++) {
    const ang = r() * TWO_PI, dist = (0.6 + r() * 0.8) * w * (0.3 + u * 0.7);
    push(); translate(x + Math.cos(ang) * dist, -0.3 - u * 1.2 * r(), z + Math.sin(ang) * dist); sphere((0.5 + r() * 0.5) * (1 - u) * 1.4, 6, 4); pop();
  }
}
function blockN(x, y, z, w, h, d, col) { push(); translate(x, -(y + h / 2), z); fill(col); box(w, h, d); pop(); }
function drawGround(ch) {
  const z0 = ch.z0, zc = z0 + CROSS / 2;
  push(); translate(0, 0, z0 + CH / 2); fill(PAL.road); box(ROAD * 2, 0.12, CH); pop();
  // Cross street with zebra stripes.
  push(); translate(0, -0.005, zc); fill(PAL.roadX); box(400, 0.12, CROSS); pop();
  for (let x = -ROAD + 0.4; x < ROAD; x += 1.1) { push(); translate(x + 0.3, -0.07, z0 + CROSS - 2.2); fill('#fbf6ee'); box(0.6, 0.02, 2.6); pop(); }
  for (let z = z0 + CROSS + 1; z < z0 + CH - 1; z += 4) { push(); translate(0, -0.07, z + 1); fill('#f6e7b0'); box(0.18, 0.02, 2); pop(); }
  for (const s of [-1, 1]) {
    push(); translate(s * (ROAD + PAVE / 2), -0.02, z0 + CROSS + (CH - CROSS) / 2); fill('#c9dfb4'); box(PAVE, 0.04, CH - CROSS); pop();   // bare earth until the tiles grow
  }
}
// Buildings face the street; x grows away from it on each side.
function drawLot(L) {
  const g = L.kind === 'pending' ? 0 : riseOf(L.born), s = L.side, len = L.z1 - L.z0;
  if (L.kind === 'pending') { if (L.z0 - walkZ < GROW + 15) { drawPlotOutline(L); } else { drawFuturePlot(L); } return; }
  if (L.born !== undefined) { drawPuff(s * (EDGE + 6), (L.z0 + L.z1) / 2, 5, L.born, L.seed); }
  if (g <= 0.005) { if (L.born === undefined) { drawFuturePlot(L); } return; }
  push(); translate(0, 0, L.z0); scale(1, Math.max(0.01, g), 1);
  if (L.kind === 'neighbour' || L.kind === 'homes') {
    let z = 0.3;
    for (const p of L.parts) {
      const x = s * (EDGE + 1 + p.d / 2);
      blockN(x, 0, z + p.w / 2, p.d, p.h, p.w, p.col);
      roofN(x, p.h, z + p.w / 2, p.d + 0.6, p.w + 0.5, p.rh, p.roof);
      facadeN(s, EDGE + 1, z, z + p.w, 0.8, p.h - 0.3, 'house', p.col);
      blockN(s * (EDGE + 0.95), 0, z + p.w / 2, 0.15, 2.2, 1.1, '#6b5a7a');   // door
      if (p.balcony) { for (let f = 1; f < 3; f++) { blockN(s * (EDGE + 0.75), f * 3.2, z + p.w / 2, 0.6, 0.15, p.w * 0.7, '#fbf6ee'); blockN(s * (EDGE + 0.5), f * 3.2 + 0.15, z + p.w / 2, 0.06, 0.9, p.w * 0.7, '#fbf6ee'); } }
      z += p.w + 0.5;
    }
  } else if (L.kind === 'tower') {
    const d = 16, x = s * (EDGE + 1.5 + d / 2), w = len - 2;
    blockN(x, 0, len / 2, d, 6, w + 1, '#e9e4f2');                     // podium
    blockN(x + s * 1.5, 6, len / 2, d - 3, L.h - 6, w - 2, L.col);
    facadeN(s, EDGE + 3, len / 2 - (w - 2) / 2, len / 2 + (w - 2) / 2, 6.5, L.h - 1, 'tower', L.col);
    if (L.crown) { blockN(x + s * 1.5, L.h, len / 2, d - 6, 3, w - 6, '#f4d58d'); blockN(x + s * 1.5, L.h + 3, len / 2, 0.4, 6, 0.4, PAL.ink); }
    facadeN(s, EDGE + 1.5, 1, len - 1, 0.5, 5, 'lobby', '#e9e4f2');
  } else if (L.kind === 'shop') {
    const d = 10, x = s * (EDGE + 1 + d / 2);
    blockN(x, 0, len / 2, d, L.h, len - 2, L.col);
    blockN(x, L.h, len / 2, d + 0.4, 0.5, len - 1.6, '#fbf6ee');
    facadeN(s, EDGE + 1, 1.2, len - 1.2, 0.3, 3.3, 'shop', L.col);
    facadeN(s, EDGE + 1, 1.2, len - 1.2, 4.4, L.h - 0.3, 'house', L.col);
    awningN(s, EDGE + 1, 1.5, len - 1.5, 3.4, L.awning);
    signBoardN(s * (EDGE + 0.9), 3.55, len / 2, len * 0.5, 0.9, L.name, L.awning, 'side');
    for (let i = 0; i < 2; i++) { blockN(s * (EDGE - 0.6), 0, 3 + i * (len - 6), 0.6, 0.75, 0.6, '#fbf6ee'); }   // café tables
  } else if (L.kind === 'park') {
    push(); translate(s * (EDGE + 8), -0.08, len / 2); fill(PAL.grass2); box(15, 0.16, len - 0.6); pop();
    push(); translate(s * (EDGE + 4), -0.18, len / 2); fill('#f3e6c8'); box(1.6, 0.06, len - 0.6); pop();
    push(); translate(s * (EDGE + 10), -0.2, len * 0.6); fill('#9ccbe8'); cylinder(2.6, 0.08, 16, 1); pop();
    for (const tr of L.trees) { drawTreeN(s * (EDGE + tr.x), L.z0 + tr.z, tr.h, tr.r, tr.tone, tr.cone, 0, true); }
    for (const u of [0.25, 0.7]) { blockN(s * (EDGE + 2.6), 0.45, len * u, 0.5, 0.12, 1.8, '#c98a5c'); blockN(s * (EDGE + 2.85), 0.55, len * u, 0.1, 0.5, 1.8, '#c98a5c'); }
  }
  pop();
  if (L.sign) { signBoardN(s * (EDGE + 2.6), 1.4, L.z0 + 1.2, 4.2, 1.6, L.sign, L.kind === 'tower' ? '#3d3553' : L.kind === 'homes' ? '#f28b9f' : '#5fb874', 'face', g); }
}
// A pitched roof with its ridge running back from the street (gable faces the street).
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
// Window decals: one textured quad on the street face, tiled by size.
function facadeN(s, xEdge, za, zb, y0, y1, kind, wall) {
  const tex = windowTex(kind, wall), tile = kind === 'tower' ? 3.2 : kind === 'shop' ? (zb - za) : kind === 'lobby' ? (zb - za) : 3.2;
  const x = s * (xEdge - 0.04), u1 = (zb - za) / tile, v1 = kind === 'shop' || kind === 'lobby' ? 1 : (y1 - y0) / (kind === 'tower' ? 3.4 : 3.2);
  push(); textureMode(NORMAL); texture(tex);
  beginShape(); normal(-s, 0, 0);
  vertex(x, -y0, za, 0, v1); vertex(x, -y0, zb, u1, v1); vertex(x, -y1, zb, u1, 0); vertex(x, -y1, za, 0, 0);
  endShape(CLOSE); pop();
}
function awningN(s, xEdge, za, zb, y, col) {
  push(); textureMode(NORMAL); texture(stripeTex(col));
  const x0 = s * (xEdge - 0.05), x1 = s * (xEdge - 1.8), u = (zb - za) / 1.2;
  beginShape(); normal(-s * 0.5, -0.86, 0);
  vertex(x0, -y - 0.9, za, 0, 0); vertex(x0, -y - 0.9, zb, u, 0); vertex(x1, -y, zb, u, 1); vertex(x1, -y, za, 0, 1);
  endShape(CLOSE); pop();
}
// Signs: 'face' boards stand on two posts facing people walking up the street; 'side' boards sit on a shop front.
function signBoardN(x, y, z, w, h, text, col, mode, g = 1) {
  const tex = signTex(text, col);
  push(); translate(x, 0, z); scale(1, Math.max(0.01, g), 1); textureMode(NORMAL); texture(tex);
  if (mode === 'face') {
    beginShape(); normal(0, 0, -1);
    vertex(w / 2, -y, 0, 0, 1); vertex(-w / 2, -y, 0, 1, 1); vertex(-w / 2, -y - h, 0, 1, 0); vertex(w / 2, -y - h, 0, 0, 0);
    endShape(CLOSE);
    fill('#fbf6ee'); push(); translate(0, -y - h / 2, 0.06); box(w + 0.2, h + 0.2, 0.08); pop();
    fill(PAL.ink); for (const px of [-w / 2 + 0.3, w / 2 - 0.3]) { push(); translate(px, -y / 2, 0.1); box(0.12, y, 0.12); pop(); }
  } else {
    const s = Math.sign(x), z0 = -w / 2, z1 = w / 2;
    beginShape(); normal(-s, 0, 0);
    if (s < 0) { vertex(0, -y, z1, 0, 1); vertex(0, -y, z0, 1, 1); vertex(0, -y - h, z0, 1, 0); vertex(0, -y - h, z1, 0, 0); }
    else { vertex(0, -y, z0, 0, 1); vertex(0, -y, z1, 1, 1); vertex(0, -y - h, z1, 1, 0); vertex(0, -y - h, z0, 0, 0); }
    endShape(CLOSE);
  }
  pop();
}
function drawTreeN(x, z, h, r, tone, isCone, gNear, inPark) {
  const g = inPark ? 1 : 1;
  push(); translate(x, 0, z);
  fill('#8a6248'); push(); translate(0, -h * 0.25 * g, 0); cylinder(0.16, h * 0.5 * g, 6, 1); pop();
  fill(tone < 0.33 ? '#7cbf6a' : tone < 0.66 ? '#8fcf72' : '#6aae6e');
  if (isCone) { push(); translate(0, -h * 0.68, 0); rotateX(PI); cone(r * 0.8, h * 0.7, 7, 1); pop(); }
  else { push(); translate(0, -h * 0.7, 0); sphere(r, 7, 5); pop(); push(); translate(r * 0.45, -h * 0.82, r * 0.2); sphere(r * 0.7, 7, 5); pop(); }
  pop();
}
function drawLamp(x, z) {
  push(); translate(x, 0, z); fill(PAL.ink); push(); translate(0, -2, 0); cylinder(0.06, 4, 6, 1); pop();
  fill('#ffe8a8'); push(); translate(0, -4.1, 0); sphere(0.24, 8, 6); pop(); pop();
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
// The plot waiting for you: a pink outline on the ground and a bobbing marker.
function drawPlotOutline(L) {
  const s = L.side, xa = EDGE + 0.6, xb = EDGE + 15, len = L.z1 - L.z0, isT = L === plotTarget, pulse = isT ? 0.5 + 0.5 * Math.sin(clockT * 5) : 0;
  fill(isT ? lerpColor(color('#ff8fb3'), color('#fff0f5'), pulse * 0.5) : '#f3bfd0');
  push(); translate(s * (xa + xb) / 2, -0.11, L.z0 + len / 2); box(xb - xa, 0.04, len - 1); pop();
  fill(PAL.grass); push(); translate(s * (xa + xb) / 2, -0.12, L.z0 + len / 2); box(xb - xa - 0.8, 0.04, len - 1.8); pop();
  // A little stake with a FOR SALE board.
  signBoardN(s * (EDGE + 2.6), 0.9, L.z0 + 1.2, 2.8, 1.1, 'Empty plot · your call', '#ff6fa0', 'face', 1);
}
// Land nobody has built on yet: just a faint stake-and-string outline in the grass.
function drawFuturePlot(L) {
  const s = L.side, xa = EDGE + 0.8, xb = EDGE + 12, len = L.z1 - L.z0; fill('#f6efe2');
  for (const [x, z, w, d] of [[(xa + xb) / 2, L.z0 + 0.5, xb - xa, 0.12], [(xa + xb) / 2, L.z1 - 0.5, xb - xa, 0.12], [xa, L.z0 + len / 2, 0.12, len - 1], [xb, L.z0 + len / 2, 0.12, len - 1]]) {
    push(); translate(s * x, -0.06, z); box(w, 0.06, d); pop();
  }
  for (const [x, z] of [[xa, L.z0 + 0.5], [xb, L.z0 + 0.5], [xa, L.z1 - 0.5], [xb, L.z1 - 0.5]]) { push(); translate(s * x, -0.4, z); box(0.12, 0.8, 0.12); pop(); }
}
function drawMarker(L) {
  const s = L.side, y = 6 + Math.sin(clockT * 3) * 0.35;
  push(); translate(s * (EDGE + 8), -y, (L.z0 + L.z1) / 2); rotateY(clockT * 1.5); fill('#ff6fa0'); sphere(1.1, 4, 2); pop();
}

/* ---------- generated textures ---------- */
function windowTex(kind, wall) {
  const key = 'w' + kind + wall; if (texCache.has(key)) { return texCache.get(key); }
  const g = createGraphics(128, 128); g.pixelDensity(1); g.clear(); g.noStroke();
  if (kind === 'house') {
    g.fill('#fbf6ee'); g.rect(34, 26, 60, 72, 8); g.fill('#9bb8dc'); g.rect(42, 34, 44, 56, 4);
    g.fill('#fbf6ee'); g.rect(62, 34, 4, 56); g.rect(42, 58, 44, 4); g.fill(255, 255, 255, 120); g.triangle(46, 38, 60, 38, 46, 54);
    g.fill('#7cbf6a'); g.rect(36, 98, 56, 10, 4); g.fill('#ff8fb3'); for (let i = 0; i < 5; i++) { g.circle(42 + i * 11, 98, 8); }
  } else if (kind === 'tower') {
    g.fill(255, 255, 255, 60); g.rect(0, 0, 128, 128);
    for (let i = 0; i < 2; i++) { g.fill(i ? '#c9dcf2' : '#b3cbe8'); g.rect(8 + i * 62, 16, 52, 92, 3); }
    g.fill(255, 255, 255, 140); g.quad(14, 20, 34, 20, 18, 60, 14, 60); g.fill('#fbf6ee'); g.rect(0, 118, 128, 10);
    g.fill('#ffe39a'); if (Math.random() < 1) { g.rect(72, 70, 38, 34, 2); }
  } else if (kind === 'shop') {
    g.fill('#fbf6ee'); g.rect(4, 40, 120, 86, 6); g.fill('#a7c4e6'); g.rect(10, 48, 70, 72, 4); g.fill('#6b5a7a'); g.rect(88, 52, 30, 74, 4);
    g.fill(255, 255, 255, 140); g.triangle(14, 52, 40, 52, 14, 90); g.fill('#f4d58d'); g.circle(30, 100, 14); g.circle(52, 104, 12);
  } else {
    g.fill('#bcd2ee'); g.rect(4, 20, 120, 106, 4); g.fill('#fbf6ee'); for (let i = 1; i < 6; i++) { g.rect(i * 21, 20, 3, 106); }
  }
  const tex = g; texCache.set(key, tex); return tex;
}
function stripeTex(col) {
  const key = 's' + col; if (texCache.has(key)) { return texCache.get(key); }
  const g = createGraphics(64, 64); g.pixelDensity(1); g.noStroke(); g.background('#fbf6ee'); g.fill(col); g.rect(0, 0, 32, 64);
  g.fill(255, 255, 255, 60); g.rect(0, 54, 64, 10); texCache.set(key, g); return g;
}
function signTex(text, col) {
  const key = 'g' + text + col; if (texCache.has(key)) { return texCache.get(key); }
  const g = createGraphics(512, 160); g.pixelDensity(1); g.background('#fffaf0'); g.noStroke();
  g.fill(col); g.rect(0, 0, 512, 16); g.rect(0, 144, 512, 16);
  g.fill(PAL.ink); g.textAlign(CENTER, CENTER); g.textFont('Fraunces, Georgia, serif'); g.textStyle(BOLD);
  let size = 64; g.textSize(size); while (g.textWidth(text) > 470 && size > 20) { size -= 2; g.textSize(size); }
  g.text(text, 256, 82); texCache.set(key, g); return g;
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

/* ---------- HTML HUD ---------- */
function buildUI() {
  const css = document.createElement('style');
  css.textContent = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Nunito:wght@500;700;800&display=swap');
  .pl{position:fixed;font-family:Nunito,system-ui,sans-serif;color:#3d3553;z-index:5;user-select:none}
  .pl-panel{top:16px;left:16px;background:#fffaf2;border-radius:18px;padding:14px 18px;box-shadow:0 6px 0 rgba(61,53,83,.12),0 10px 30px rgba(61,53,83,.12);width:240px;border:2px solid #3d3553}
  .pl-panel h4{margin:0 0 6px;font:800 11px Nunito;letter-spacing:.14em;color:#9a86b8}
  .pl-row{display:flex;justify-content:space-between;font-weight:700;font-size:14px;margin:3px 0}
  .pl-bar{height:9px;background:#eee6f5;border-radius:6px;overflow:hidden;margin:2px 0 6px}.pl-bar i{display:block;height:100%;border-radius:6px;transition:width .5s}
  .pl-small{font-size:11px;color:#9a86b8;font-weight:700}
  .pl-cards{left:50%;bottom:26px;transform:translateX(-50%);display:flex;gap:12px;transition:opacity .3s,transform .3s}
  .pl-cards.hide{opacity:0;pointer-events:none;transform:translate(-50%,20px)}
  .pl-q{position:absolute;bottom:100%;left:0;right:0;text-align:center;margin-bottom:10px;font:800 20px Fraunces,Georgia,serif;text-shadow:0 2px 0 #fff,0 0 12px #fff}
  .pl-card{width:142px;background:#fffaf2;border:2px solid #3d3553;border-radius:18px;padding:10px 8px 12px;text-align:center;cursor:pointer;box-shadow:0 5px 0 #3d3553;transition:transform .15s}
  .pl-card:hover{transform:translateY(-6px) rotate(-1deg)}.pl-card.off{opacity:.45;cursor:not-allowed}
  .pl-card b{display:block;font:800 17px Fraunces,Georgia,serif;margin-top:2px}.pl-card span{display:block;font-size:11px;color:#8a7a9a}
  .pl-card em{display:block;font-style:normal;font-weight:800;font-size:13px;margin-top:5px}
  .pl-toast{left:50%;transform:translateX(-50%);bottom:250px;font:700 16px Nunito;background:#3d3553;color:#fffaf2;padding:8px 16px;border-radius:30px;opacity:0;transition:opacity .4s;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis}
  .pl-money{top:22px;left:276px;font:800 24px Fraunces,Georgia,serif;opacity:0}
  .pl-help{top:16px;right:16px;font-size:12px;font-weight:700;color:#5d5277;background:rgba(255,250,242,.8);padding:6px 12px;border-radius:20px}
  .pl-over{inset:0;display:flex;align-items:center;justify-content:center;background:rgba(61,53,83,.35);opacity:0;pointer-events:none;transition:opacity .5s}
  .pl-over.show{opacity:1;pointer-events:auto}
  .pl-sheet{background:#fffaf2;border:2px solid #3d3553;border-radius:22px;box-shadow:0 8px 0 #3d3553;padding:26px 30px;max-width:560px;width:calc(100vw - 48px);text-align:center}
  .pl-sheet h1{font:800 30px Fraunces,Georgia,serif;margin:0 0 4px}.pl-sheet h2{font:700 14px Nunito;color:#9a86b8;margin:0 0 14px;letter-spacing:.1em}
  .pl-sheet p{font-size:16px;line-height:1.5;margin:6px 0}.pl-sheet button{margin-top:14px;font:800 16px Nunito;background:#ff6fa0;color:#fff;border:2px solid #3d3553;border-radius:30px;padding:10px 22px;box-shadow:0 4px 0 #3d3553;cursor:pointer}
  .pl-sheet .tip{font-style:italic;color:#5d5277}.pl-sheet svg{width:100%;height:auto;border-radius:14px;margin-bottom:10px}`;
  document.head.appendChild(css);
  const el = (cls, html, parent = document.body) => { const d = document.createElement('div'); d.className = 'pl ' + cls; d.innerHTML = html; parent.appendChild(d); return d; };
  ui.panel = el('pl-panel', '');
  ui.money = el('pl-money', '');
  ui.help = el('pl-help', '↑ walk · Shift hurry · 1–4 choose · mouse to look · M sound · R restart');
  ui.cards = el('pl-cards hide', '<div class="pl-q">What goes on this plot?</div>');
  ui.card = {};
  for (const k of ORDER) {
    const c = CHOICES[k], b = document.createElement('div'); b.className = 'pl-card'; b.style.borderTop = `8px solid ${c.col}`;
    b.addEventListener('pointerdown', e => { e.stopPropagation(); choose(k); });
    ui.cards.appendChild(b); ui.card[k] = b;
  }
  ui.toast = el('pl-toast', '');
  ui.intro = el('pl-over show', `<div class="pl-sheet"><h2>PLOTLINE</h2><h1>You plan the street</h1>
    <p>You’re the new planner of this street. Every empty plot you walk up to is yours to decide: <b>homes</b>, a <b>tower</b>, a <b>shop</b> or a <b>park</b>.</p>
    <p>Developers pay well for towers. People need homes. Parks and shops bring the street to life.</p>
    <p class="tip">Walk past a plot without choosing, and the market decides for you.</p>
    <button>Start walking</button><p class="pl-small">hold ↑ or the mouse to walk · press 1–4 to choose</p></div>`);
  ui.intro.querySelector('button').addEventListener('click', e => { e.stopPropagation(); startWalk(); });
  ui.post = el('pl-over', '');
  document.addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS' && !intro && !ending) { pointerHeld = true; beginSound(); } });
  document.addEventListener('pointerup', () => { pointerHeld = false; });
  document.addEventListener('mousemove', e => { yawTarget = (0.5 - e.clientX / window.innerWidth) * 1.1; });
}
const ICONS = {
  homes: '<svg width="42" height="34" viewBox="0 0 42 34"><path d="M5 16 L21 4 L37 16 Z" fill="#c96f7e" stroke="#3d3553" stroke-width="2" stroke-linejoin="round"/><rect x="9" y="15" width="24" height="16" rx="2" fill="#f4b6c2" stroke="#3d3553" stroke-width="2"/><rect x="18" y="21" width="6" height="10" fill="#6b5a7a"/></svg>',
  tower: '<svg width="42" height="34" viewBox="0 0 42 34"><rect x="13" y="2" width="16" height="30" rx="2" fill="#9fb7d4" stroke="#3d3553" stroke-width="2"/><g fill="#fffaf2"><rect x="16" y="6" width="4" height="3"/><rect x="22" y="6" width="4" height="3"/><rect x="16" y="12" width="4" height="3"/><rect x="22" y="12" width="4" height="3"/><rect x="16" y="18" width="4" height="3"/><rect x="22" y="18" width="4" height="3"/></g></svg>',
  shop: '<svg width="42" height="34" viewBox="0 0 42 34"><rect x="7" y="14" width="28" height="17" rx="2" fill="#ffd7a8" stroke="#3d3553" stroke-width="2"/><path d="M5 9 h32 v6 h-32 z" fill="#f28b82" stroke="#3d3553" stroke-width="2"/><rect x="12" y="19" width="10" height="8" fill="#a7c4e6"/><rect x="25" y="19" width="6" height="12" fill="#6b5a7a"/></svg>',
  park: '<svg width="42" height="34" viewBox="0 0 42 34"><rect x="19" y="20" width="4" height="12" fill="#8a6248"/><circle cx="21" cy="14" r="10" fill="#7cbf6a" stroke="#3d3553" stroke-width="2"/><circle cx="17" cy="11" r="3" fill="#a6dc8c"/></svg>'
};
function updateHud() {
  if (!ui.panel) { return; }
  ui.panel.innerHTML = `<h4>YOUR STREET</h4>
    <div class="pl-row"><span>Budget</span><span>${money(budget)}</span></div>
    <div class="pl-row"><span>People housed</span><span>${housed}</span></div>
    <div class="pl-small">Street life</div><div class="pl-bar"><i style="width:${vibe}%;background:#ff8fb3"></i></div>
    <div class="pl-small">Land value</div><div class="pl-bar"><i style="width:${clampN((landValue - 0.8) / 1.6, 0, 1) * 100}%;background:#6f9ee0"></i></div>
    <div class="pl-small">${built.length} / ${PLOTS} plots planned</div>`;
  ui.cards.classList.toggle('hide', !plotTarget);
  for (const k of ORDER) {
    const c = CHOICES[k], fx = effectOf(k), ok = canAfford(k);
    ui.card[k].classList.toggle('off', !ok);
    ui.card[k].innerHTML = `${ICONS[k]}<b>${c.key} · ${c.name}</b><span>${c.note}</span><em style="color:${fx.money >= 0 ? '#2f9a5a' : '#e0457a'}">${fx.money >= 0 ? '+' : ''}${money(fx.money)}</em><span>${fx.housed ? `+${fx.housed} people` : `${fx.vibe > 0 ? '+' : ''}${fx.vibe} street life`}</span>`;
  }
}
let toastTimer = null, moneyTimer = null;
function toast(text) { ui.toast.textContent = text; ui.toast.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.style.opacity = 0; }, 3400); }
function flashMoney(v) {
  ui.money.textContent = (v >= 0 ? '+' : '') + money(v); ui.money.style.color = v >= 0 ? '#2f9a5a' : '#e0457a';
  ui.money.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }, { opacity: 1, offset: 0.7 }, { opacity: 0, transform: 'translateY(-16px)' }], { duration: 2000 });
}
function showPostcard() {
  ending = true; plotTarget = null; updateHud();
  const n = built.length || 1, count = k => built.filter(b => b === k).length, towers = count('tower'), homes = count('homes'), parks = count('park'), shops = count('shop');
  const title = towers / n > 0.5 ? 'A city of empty towers' : homes / n >= 0.35 ? 'A street people can live on' : parks / n >= 0.3 ? 'A garden street' : shops / n >= 0.35 ? 'A lively high street' : 'A bit of everything';
  const tip = towers > homes ? 'The towers paid for everything, but most of their flats sit empty.' : homes > 0 && budget < 200000 ? 'You housed people, and it cost almost everything you had.' : 'Every plot was a choice between profit and people.';
  const W = 520, step = (W - 40) / n;
  let art = `<svg viewBox="0 0 ${W} 190"><rect width="${W}" height="190" fill="#cfe0f5"/><circle cx="${W * 0.8}" cy="50" r="26" fill="#fff4d6"/><rect y="160" width="${W}" height="30" fill="#a9d48f"/>`;
  built.forEach((k, i) => {
    const x = 20 + i * step + step / 2, s = Math.min(step * 0.9, 34), gy = 160, st = 'stroke="#3d3553" stroke-width="1.5"';
    if (k === 'tower') { art += `<rect x="${x - s * 0.3}" y="${gy - s * 3.6}" width="${s * 0.6}" height="${s * 3.6}" fill="#9fb7d4" ${st}/>`; }
    else if (k === 'homes') { art += `<rect x="${x - s * 0.4}" y="${gy - s}" width="${s * 0.8}" height="${s}" fill="${PAL.houses[i % 7]}" ${st}/><path d="M${x - s * 0.5} ${gy - s} L${x} ${gy - s * 1.5} L${x + s * 0.5} ${gy - s} Z" fill="#c96f7e" ${st}/>`; }
    else if (k === 'shop') { art += `<rect x="${x - s * 0.42}" y="${gy - s * 0.8}" width="${s * 0.84}" height="${s * 0.8}" fill="#ffd7a8" ${st}/><rect x="${x - s * 0.48}" y="${gy - s * 0.9}" width="${s * 0.96}" height="${s * 0.2}" fill="#f28b82" ${st}/>`; }
    else { art += `<rect x="${x - 2}" y="${gy - s * 0.4}" width="4" height="${s * 0.4}" fill="#8a6248"/><circle cx="${x}" cy="${gy - s * 0.7}" r="${s * 0.42}" fill="#7cbf6a" ${st}/>`; }
  });
  art += '</svg>';
  ui.post.innerHTML = `<div class="pl-sheet">${art}<h2>YOUR STREET</h2><h1>${title}</h1>
    <p>${homes} homes · ${towers} towers · ${shops} shops · ${parks} parks</p>
    <p>${housed} people housed · budget ${money(budget)} · street life ${Math.round(vibe)}/100</p>
    <p class="tip">${tip}</p><p class="pl-small">Monopoly asks how much you can own. Plotline asks who the street is for.</p>
    <button>Plan another street</button></div>`;
  ui.post.querySelector('button').addEventListener('click', e => { e.stopPropagation(); resetGame(); startWalk(); });
  ui.post.classList.add('show'); if (sound) { sound.go(); }
}

/* ---------- keys ---------- */
function onKey(e) {
  const pick = { Digit1: 'homes', Digit2: 'tower', Digit3: 'shop', Digit4: 'park', Numpad1: 'homes', Numpad2: 'tower', Numpad3: 'shop', Numpad4: 'park' }[e.code];
  if (pick) { choose(pick); beginSound(); return; }
  if (intro && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW')) { startWalk(); return; }
  if (e.code === 'Enter') { autoWalk = !autoWalk; }
  if (e.code === 'KeyM' && sound) { sound.toggle(); }
  if (e.code === 'KeyR') { resetGame(); }
  if (e.code.startsWith('Arrow') || e.code === 'Space') { e.preventDefault(); }
}
