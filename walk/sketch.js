/* Plotline — walk the board.
 * A first-person, endless board-game main street in p5.js (Canvas 2D). Every building,
 * person, sign and sound is generated in code.
 *
 * The street is a loop of ten blocks. Property value rises the further you walk:
 *   Rusty Row (shacks) -> Maple Terrace (townhouses) -> Gilded Gardens (mansions)
 *   -> Brick & Glass Quarter -> Pinnacle Heights (skyscrapers) -> pass GO -> Rusty Row
 * Each district keeps its layout; redevelopment leaves persistent traces.
 * Chance casinos reshape the street ahead when you walk past them (boom, crash or
 * nightfall). A stone jail sits in Rusty Row: just visiting.
 * The street is not built until you walk toward it: beyond about 55 m each lot is only an
 * outlined plot on the ground. As you approach, its building springs up out of the ground
 * with a puff of dust and a thud, and the lamps, trees and banners pop up with it.
 *
 * The Landlord's Walk (board.js): you are 24, renting, saving for a deposit. Every lap past
 * GO is a year. Generated billboards, rising prices, investors and open-home queues line the
 * street. Turn left to move further out, right to move back in. Buy a home before 30.
 *
 * Controls: hold W / Up / mouse to walk, Shift to hurry, S / Down to step back,
 *   E or Space to buy the plot beside you, Left (further out) / Right (toward the city) to turn,
 *   Enter to stroll on its own, move the mouse to look around,
 *   M sound, P pause, R new town.
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
let stepPhase = 0, bobAmp = 0, lookYaw = 0, lookPitch = 0, canvasNode, sound, audioStarted = false, grain;
let dashTarget = null, card = null, districtCard = null, lastTier = -1, lastChunk = -1;
let economy = 1, economyTarget = 1, economyUntil = 0, night = 0, nightTarget = 0, crash = 0, crashTarget = 0;
const chunks = new Map(), firedCasinos = new Set(), visitedJails = new Set();
let cam = { x: 0, z: 0, yaw: 0, f: 700, cx: 0, hy: 0, eye: EYE_H }, ctx, skyline = [];
const APPEAR_Z = 55, RISE_T = 1.8;   // lots build when you come this close; rise time in seconds
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
  sound = new StreetSound(); textFont('Georgia');
  grain = createGraphics(320, 320); grain.pixelDensity(1); grain.loadPixels();
  for (let i = 0; i < grain.pixels.length; i += 4) { const v = random() < 0.5 ? 255 : 0; grain.pixels[i] = grain.pixels[i + 1] = grain.pixels[i + 2] = v; grain.pixels[i + 3] = random(10); }
  grain.updatePixels(); buildSkyline();
  if (typeof makeBrushTrees === 'function') { makeBrushTrees(); }
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
  const ch = { c, slot, tier, z0, lots: [], props: [], back: [] };
  for (const side of [-1, 1]) {
    let z = z0 + CROSS_W + 0.5;
    const special = null;   // no casinos or jail: the walk is about rent, not luck
    let specialAt = special ? z0 + CROSS_W + 6 + r() * 6 : Infinity;
    while (z < z0 + CHUNK_LEN - 3) {
      if (z >= specialAt - 0.5) { const len = special === 'jail' ? 20 : 18; ch.lots.push(makeLot(special, tier, side, z, len, r)); z += len + 0.6; specialAt = Infinity; continue; }
      const len = lotLength(tier, r); if (z + len > z0 + CHUNK_LEN - 1) {break;}
      ch.lots.push(makeLot(null, tier, side, z, len, r)); z += len + (tier === 2 ? 2.5 : tier >= 3 ? 1.2 : r() < 0.3 ? 1 : 0.15);
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
  lookYaw = lerp(lookYaw, constrain(mx, -0.5, 0.5) * 0.6, 0.05);
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
  if (here.c !== lastChunk) { if (here.slot === 0 && lastChunk >= 0 && here.c > lastChunk) { sound.go(); onPassGo(); } lastChunk = here.c; }
  if (tier !== lastTier) { districtCard = { tier, t: clockT, lap: Math.floor(here.c / LAP_LEN) + 1 }; lastTier = tier; }
  updateLandmarks(z); boardUpdate(z);
  if (economyUntil && clockT > economyUntil) { economyTarget = 1; nightTarget = baseNight; crashTarget = 0; economyUntil = 0; }
  economy = lerp(economy, economyTarget, 1 - Math.exp(-dt * 0.8)); night = lerp(night, nightTarget, 1 - Math.exp(-dt * 0.5)); crash = lerp(crash, crashTarget, 1 - Math.exp(-dt * 0.8));
  let casinoDist = 1; for (const ch of chunks.values()) {for (const L of ch.lots) {if (L.special === 'casino') {casinoDist = Math.min(casinoDist, constrain(Math.abs((L.z0 + L.z1) / 2 - z) / 45, 0, 1));}}}
  sound.update({ dt: paused ? 0 : dt, tier, casino: casinoDist, night, moving: Math.abs(stepSpeed) > 0.1 });

  push(); translate(width / 2, height / 2); rotate(swing * 0.005 * bobAmp); translate(-width / 2, -height / 2);
  // Drawing is wrapped so one bad shape (say, mid-turn) can never freeze the sketch.
  try { drawSky(); drawSkyline(); drawGround(z); drawWorld(z); } catch (err) { if (!window.plotlineWarned) { window.plotlineWarned = true; console.warn(err); } }
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
    for (const b of ch.back) {if (b.born === undefined && b.z0 - z < APPEAR_Z + 10) {b.born = clockT + 0.4 + birthDelay(ch.c * 13, b.z0 - z);}}
    for (const p of ch.props) {if (p.born === undefined && p.z - z < APPEAR_Z - 8) {p.born = clockT + birthDelay(Math.floor(p.z * 7), p.z - z);}}
  }
  for (const ch of chunks.values()) {for (const L of ch.lots) {
    const mid = (L.z0 + L.z1) / 2;
    if (L.born === undefined && L.z0 - z < APPEAR_Z && !(L.forSale && !L.owned)) {L.born = clockT + birthDelay(L.seed, L.z0 - z);}
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
  const dayCols = ['#ffb36b', '#ffd79a', '#fff0c4', '#7aa7d8'], dusk = ['#5a3a7a', '#c86a7a', '#ffb070', '#1d2a55'];
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
  sg.addColorStop(0, `rgba(255,236,170,${0.75 * (1 - night)})`); sg.addColorStop(0.25, `rgba(255,190,110,${0.3 * (1 - night)})`); sg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = sg; ctx.fillRect(-80, -height * 0.3, width + 160, height * 1.3);
  for (let i = 0; i < 9; i++) {
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
  const x = cam.cx - Math.tan(cam.yaw) * cam.f, s = H / 800;
  const tiers = [[60, 120], [46, 200], [34, 270], [22, 320], [12, 350]];
  ctx.save();
  for (const [w, h] of tiers) {
    const g = ctx.createLinearGradient(x - w * s, 0, x + w * s, 0);
    g.addColorStop(0, mixHex('#c88a50', '#3a3366', night)); g.addColorStop(0.5, mixHex('#fff0c0', '#8a7ac8', night)); g.addColorStop(1, mixHex('#b07a48', '#2e2a55', night));
    ctx.fillStyle = g; ctx.fillRect(x - w * s, hy - h * s, w * 2 * s, h * s - (tiers[0] === undefined ? 0 : 0) + 2);
  }
  ctx.fillStyle = mixHex('#fff4c8', '#c8b8ff', night); ctx.beginPath(); ctx.moveTo(x - 5 * s, hy - 350 * s); ctx.lineTo(x, hy - 440 * s); ctx.lineTo(x + 5 * s, hy - 350 * s); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const cg = ctx.createRadialGradient(x, hy - 330 * s, 0, x, hy - 330 * s, 90 * s); cg.addColorStop(0, 'rgba(255,240,180,0.6)'); cg.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = cg; ctx.fillRect(x - 90 * s, hy - 420 * s, 180 * s, 180 * s);
  ctx.restore();
  // Golden haze over the horizon.
  const g = ctx.createLinearGradient(0, hy - H * 0.18, 0, hy + 4);
  g.addColorStop(0, rgbaN(haze, 0)); g.addColorStop(1, rgbaN(mixHex('#ffd79a', '#7a5a8a', night), 0.75));
  ctx.fillStyle = g; ctx.fillRect(-80, hy - H * 0.18, width + 160, H * 0.18 + 4);
}

/* ---------- Ground: road, pavements, crossings ---------- */
function drawGround(z) {
  const hy = cam.hy;
  ctx.fillStyle = mixHex('#b89a78', '#3a3448', night); ctx.fillRect(-80, hy, width + 160, height - hy + 80);
  const steps = 90;
  for (let i = steps; i > 0; i--) {
    const d0 = NEAR_Z + Math.pow((i - 1) / steps, 2.2) * FAR_Z, d1 = NEAR_Z + Math.pow(i / steps, 2.2) * FAR_Z;
    const za = z + d0, zb = z + d1, ch = chunkAt(Math.floor(za / CHUNK_LEN)), local = za - ch.z0, crossing = local < CROSS_W;
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
        polyN([P(side * ROAD_W, 0.12, za), P(side * EDGE_X, 0.12, za), P(side * EDGE_X, 0.12, zb), P(side * ROAD_W, 0.12, zb)], f(tile ? '#e8dcc4' : '#d8cab0'));
        // Board-colour band along the kerb.
        polyN([P(side * (ROAD_W + 0.15), 0.13, za), P(side * (ROAD_W + 0.75), 0.13, za), P(side * (ROAD_W + 0.75), 0.13, zb), P(side * (ROAD_W + 0.15), 0.13, zb)], f(stripe[tile]));
        polyN([P(side * EDGE_X, 0.05, za), P(side * (EDGE_X + 40), 0.05, za), P(side * (EDGE_X + 40), 0.05, zb), P(side * EDGE_X, 0.05, zb)], f(ch.tier === 2 || ch.park ? '#6f9a52' : '#a89478'));
      }
    }
    // Centre line and zebra crossings.
    if (!crossing && Math.floor(za / 3) % 2 === 0) {polyN([P(-0.08, 0.01, za), P(0.08, 0.01, za), P(0.08, 0.01, zb), P(-0.08, 0.01, zb)], f('#f4e6b0'));}
    if (local > 1 && local < 4) {for (let x = -ROAD_W + 0.3; x < ROAD_W; x += 0.9) {polyN([P(x, 0.01, za), P(x + 0.5, 0.01, za), P(x + 0.5, 0.01, zb), P(x, 0.01, zb)], f('#f2efe6'));}}
  }
  // Painted street names and the GO arrow.
  for (const ch of chunks.values()) {
    paintText(ch.park ? 'PARK' : ch.slot === 0 ? 'GO  ➜' : 'PLOTLINE', 0, ch.z0 + CROSS_W + 3, ch.slot === 0 ? 4.5 : 2.2, ch.slot === 0 ? '#e23b3b' : '#f4ead0');
  }
}
function paintText(label, x, zz, size, col) {
  const p = P(x, 0, zz); if (p.rz < 1.5 || p.rz > 120) {return;}
  const k = p.k, squash = cam.eye / p.rz;
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, squash); ctx.font = `bold ${size * k * 0.5}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = rgbaN(col, 0.85 * (1 - easeN((p.rz - 60) / 60))); ctx.fillText(label, 0, 0); ctx.restore();
}

/* ---------- Buildings and everything on the street ---------- */
function drawWorld(z) {
  const all = [...chunks.values()];
  // Back row first, then buildings far to near, then pavement life far to near.
  const backs = all.flatMap(ch => ch.back).filter(b => b.z1 > z + NEAR_Z).sort((a, b) => b.z0 - a.z0);
  for (const b of backs) { const g = riseOf(b.born); if (g > 0.01) { riseK = g; drawBack(b); riseK = 1; } }
  const lots = all.flatMap(ch => ch.lots).filter(L => L.z1 > z + NEAR_Z && L.z0 < z + FAR_Z).sort((a, b) => b.z0 - a.z0);
  for (const L of lots) {
    const g = riseOf(L.born);
    if (g <= 0.01) { drawPlot(L); if (L.forSale && !L.owned) {drawForSale(L);} continue; }
    riseK = g; drawLot(L); riseK = 1;
    const age = clockT - L.born; if (age < RISE_T + 0.8) {drawDust(L, age);}
  }
  const items = [];
  for (const ch of all) {
    for (const p of ch.props) { if(p.kind === "person" && p.residentRank > ch.residentShare){continue;} const g = riseOf(p.born); if (g <= 0.01) {continue;} const q = P(p.x, 0, p.z); if (q.rz > 0.8 && q.rz < FAR_Z * 0.7) {items.push({ q, p, kind: p.kind, g });} }
    for (const L of ch.lots) {if (L.tier === 2 && !L.special) { const g = riseOf(L.born); if (g <= 0.01) {continue;} const q = P(L.side * (EDGE_X + 0.3), 0, (L.z0 + L.z1) / 2); if (q.rz > 0.8) {items.push({ q, p: L, kind: 'yard', g });} }}
  }
  items.sort((a, b) => b.q.rz - a.q.rz);
  for (const it of items) {
    // Props pop up from their base point; yards rise with their mansion.
    if (it.kind === 'yard') { riseK = it.g; drawYard(it.p); riseK = 1; continue; }
    ctx.save(); ctx.translate(it.q.x, it.q.y); ctx.scale(Math.min(1, 0.4 + it.g * 0.6), it.g); ctx.translate(-it.q.x, -it.q.y);
    if (it.kind === 'lamp') {drawLamp(it.q, it.p);} else if (it.kind === 'tree') {drawTree(it.q, it.p);} else if (it.kind === 'bin') {drawBin(it.q, it.p);}
    else if (it.kind === 'banner') {drawBanner(it.q, it.p);} else if (it.kind === 'billboard') {drawBillboard(it.q, it.p);} else if (it.kind === 'person') {drawPerson(it.q, it.p);} else if (it.kind === 'openhome') {drawOpenHome(it.q, it.p);}
    ctx.restore();
  }
  drawTargetMarker();
}
// An unbuilt lot: its plot outlined on the ground in the district's board colour.
function drawPlot(L) {
  const z0 = clipZ(L.z0); if (L.z1 <= z0) {return;}
  const xa = L.side * (EDGE_X + L.setback + 0.3), xb = L.side * (EDGE_X + L.setback + L.depth), col = DISTRICTS[L.tier].stripe[0], mz = (z0 + L.z1) / 2;
  const q = [P(xa, 0.03, z0), P(xb, 0.03, z0), P(xb, 0.03, L.z1), P(xa, 0.03, L.z1)];
  ctx.save(); ctx.setLineDash([6, 5]); polyN(q, rgbaN(col, 0.18 * (1 - fogFor(mz))), rgbaN(col, 0.6 * (1 - fogFor(mz))), 1.5); ctx.restore();
  // A small corner stake, so the plot reads as land waiting to be built on.
  const s0 = P(xa, 0, L.z0 + 0.3); if (s0.rz > 1) { ctx.fillStyle = rgbaN(col, 0.8 * (1 - fogFor(mz))); ctx.fillRect(s0.x - 0.04 * s0.k, s0.y - 0.7 * s0.k, Math.max(1, 0.08 * s0.k), 0.7 * s0.k); }
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
  polyN(wallQuad(x, z0, x, b.z1, 0, b.h), toneN(b.color, (z0 + b.z1) / 2, 0.85));
  if (b.z0 > cam.z + NEAR_Z) {polyN(wallQuad(x, b.z0, x + b.side * 20, b.z0, 0, b.h), toneN(b.color, b.z0, 0.6));}
}
function drawLot(L) {
  if (L.owned) { drawOwnedLot(L); return; }
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
    ctx.strokeStyle = rgbaN('#ffd9a0', 0.55 * (1 - night)); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(nq[3].x, nq[3].y); ctx.lineTo(nq[2].x, nq[2].y); ctx.stroke();
  }
  const near = P(x, 0, z0); if (near.rz > FAR_Z) {return;}
  if (L.special === 'jail') {return drawJail(L, x, z0, z1, H);}
  if (L.special === 'casino') {return drawCasino(L, x, z0, z1, H);}
  [drawShack, drawTownhouse, drawMansion, drawBrick, drawTower][L.tier](L, x, z0, z1, H);
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
    polyN(q, toneN(glass, (za + zb) / 2, lit ? 1 : 1), opt.frame ? toneN(opt.frame, za) : null, opt.frameW || 1);
    if (opt.boarded && r() < opt.boarded) { ctx.strokeStyle = toneN('#7a5a3a', za); ctx.lineWidth = Math.max(1, (q[1].y - q[2].y) * 0.08); ctx.beginPath(); ctx.moveTo(q[0].x, q[0].y); ctx.lineTo(q[2].x, q[2].y); ctx.moveTo(q[1].x, q[1].y); ctx.lineTo(q[3].x, q[3].y); ctx.stroke(); }
    if (opt.box && j > 0) {polyN(wallQuad(x - L.side * 0.15, Math.max(za, z0), x - L.side * 0.15, zb, ya - 0.35, ya), toneN(opt.box, za));}
  }}
}
// A sign mounted flat on the facade; text is placed with an affine map of the projected corners.
function facadeSign(L, x, z0, za, zb, ya, yb, bg, fg, text, glow) {
  if (zb < z0) {return;} za = Math.max(za, z0);
  const q = wallQuad(x - L.side * 0.1, za, x - L.side * 0.1, zb, ya, yb);
  if (q.some(p => p.rz < CLIP_Z) || Math.abs(q[1].x - q[0].x) < 6) {return;}
  polyN(q, bg, glow ? rgbaN(glow, 0.9) : 'rgba(40,24,16,0.6)', glow ? 2 : 1);
  const w = 100, h = 22; ctx.save();
  // Text always reads left to right: on the right-hand side the far end is on the left of the screen.
  const o = L.side < 0 ? q[3] : q[2], ex = L.side < 0 ? q[2] : q[3], ey = L.side < 0 ? q[0] : q[1];
  ctx.transform((ex.x - o.x) / w, (ex.y - o.y) / w, (ey.x - o.x) / h, (ey.y - o.y) / h, o.x, o.y);
  ctx.fillStyle = fg; ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
  for (let zz = Math.ceil(z0 / 0.5) * 0.5; zz < L.z1; zz += 0.5) { if ((zz - L.z0) / (L.z1 - L.z0) > 0.42 && (zz - L.z0) / (L.z1 - L.z0) < 0.58) {continue;} const a = P(xh - L.side * 0.1, 1.0, zz), b = P(xh - L.side * 0.1, 1.7, zz); if (a.rz > 0.5) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
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
  for (let f = 1; f < floors; f += floorStep) { const a = P(x, f * 3.6, z0), b = P(x, f * 3.6, z1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  for (let zz = Math.ceil(L.z0 / 2) * 2; zz < z1; zz += 2) { if (zz < z0) {continue;} const a = P(x, 0, zz), b = P(x, H, zz); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  if (night > 0.2 && !L.vacant) { const r = rngN(L.seed); ctx.fillStyle = `rgba(255,220,140,${night * 0.8})`; for (let i = 0; i < 40; i++) { const zz = L.z0 + r() * len, y = r() * H; if (zz > z0) { const p = P(x - L.side * 0.05, y, zz); ctx.fillRect(p.x - 1, p.y - 1, Math.max(2, p.k * 1.2), Math.max(1.5, p.k * 0.8)); } } }
  polyN(wallQuad(x, z0, x, z1, 0, 4), toneN('#2a3440', midN(z0, z1)));
  facadeWindows(L, x, z0, z1, [[0.3, 3.6]], Math.max(2, Math.round(len / 4)), { padU: 0.05, lit: 0.9, glass: '#ffd98a' });
  // Set-back crown and spire.
  if (L.crown) {
    const xc = x + L.side * 3, za = Math.max(L.z0 + 3, z0), zb = L.z1 - 3, Hc = H * 0.18;
    if (zb > za) { polyN(wallQuad(xc, za, xc, zb, H, H + Hc), toneN(L.color, midN(za, zb), 1.1)); if (L.spire) { const s = P(xc + L.side * 4, H + Hc + 26, midN(za, zb)), a = P(xc, H + Hc, midN(za, zb) - 1), b = P(xc, H + Hc, midN(za, zb) + 1); polyN([a, b, s], toneN('#fff0c0', L.z0, 1.1)); } }
  }
}
function drawJail(L, x, z0, z1, H) {
  const len = L.z1 - L.z0;
  // Stone blocks.
  ctx.strokeStyle = toneN('#55565e', midN(z0, z1)); ctx.lineWidth = 1;
  for (let y = 0.6; y < H; y += 0.6) { const a = P(x - L.side * 0.02, y, z0), b = P(x - L.side * 0.02, y, z1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
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
