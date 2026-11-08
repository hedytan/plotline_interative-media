/* Plotline — We Build Our World.
 * The street starts as forest: wind, leaves and birds, and nothing built. With your hands (camera,
 * press H) or the keys you cut the forest down beside you and raise buildings on the cleared land,
 * floor by floor: an open hand builds homes, a fist builds towers. The more you build, the more the
 * street turns into a city: traffic instead of birds, music instead of wind. Build enough and the
 * last bird stops singing, and the card counts what it cost.
 */
// The street plan for one run of 10 blocks. A number is a district tier (0 small shops, 1 terraces
// and shops, ...); a word is a building style from STYLES_LOT. Every lot starts as forest: the plan
// only sets how the land is divided (lot sizes and back rows). Your hands decide what is built.
const STREET_PLAN = ['bungalow', 'bungalow', 1, 'bungalow', 'bungalow', 'bungalow', 1, 'bungalow', 'bungalow', 'bungalow'];
const zone = 3;   // seeds the street, its people and the music: the same number always gives the same street
// Building styles: their district tier (colours, ground, sounds), lot length range and setback, in metres.
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

let streetT = 0, baseNight = 0, ending = null, intro = true;   // streetT: when this street began
const toasts = [];   // short messages near the bottom of the screen
function sayToast(text) { toasts.push({ text, t: clockT }); }

/* ---------- The artwork's words ---------- */
// Slogans painted by hand on one wall per block side (paintSlogan), and the names of empty towers.
const ART = ['FORMERLY: FOREST', 'NATURE, NOW WITH PARKING', 'WE KEPT ONE TREE. FOR THE BROCHURE.', 'THE VIEW USED TO BE TREES', 'PROGRESS', 'BIRDS NOT INCLUDED', 'GREEN LIVING (THE PAINT IS GREEN)', 'WE BUILT THIS. WHAT WAS HERE BEFORE?'];
const VOID_NAMES = ['FOREST VIEW APARTMENTS', 'GREENWOOD TOWER (NO WOOD)', 'THE CANOPY RESIDENCES', 'OAK HEIGHTS - NO OAKS', 'NATURE\'S EDGE - 300 UNITS'];


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
  for (const side of [-1, 1]) { const walls = ch.lots.filter(L => L.side === side && L.H > 3 && L.z1 - L.z0 > 6); if (walls.length && r() < 0.7) { pickN(r, walls).art = ART[(ch.slot * 2 + (side > 0 ? 1 : 0)) % ART.length]; } }
}
// Street life waits for buildings: nobody lives in the forest.
function propWaits(ch, p) {
  const side = p.x < 0 ? -1 : 1;
  return !ch.lots.some(L => L.side === side && L.born !== undefined && Math.abs((L.z0 + L.z1) / 2 - p.z) < 16);
}

/* ---------- The sound of the homes ---------- */
// Every lived-in home has its own sound: kids, a dog, a piano, the TV. Walk past and you hear it
// through the wall; stand still and it comes through clearly. Industry and empty towers are silent.
function lifeKind(L) {
  const pool = L.style === 'caravan' || L.tier === 0 ? ['dog', 'radio', 'baby', 'tv', 'kids'] : L.tier >= 3 ? ['tv', 'piano', 'baby', 'talk'] : L.tier === 2 ? ['piano', 'dog', 'kids', 'talk'] : ['kids', 'dog', 'piano', 'cook', 'tv', 'baby'];
  return pool[Math.abs(L.seed >> 3) % pool.length];
}
function lived(L) { return !L.vacant && !['carpark', 'petrol', 'factory', 'substation', 'powerplant', 'datacentre'].includes(L.style) && riseOf(L.born) > 0.9; }
function houseLife() {
  if (!sound || !sound.life) { return; }
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

/* ---------- Every frame ---------- */
// How built-up the street around you is, smoothed for the NATURE -> CITY bar (works with the sound off too).
let devBar = 0;
// Smog: every building you put up greys the sky a little, wherever you are (0 = clean, 1 = after ~30).
let smogK = 0, lookHint = false;
function boardUpdate(z) {
  const dt = Math.min(deltaTime / 1000, 0.05);
  houseLife(); handUpdate(dt);
  const devNow = sound && sound.devK ? sound.devK : 0; devBar += (devNow - devBar) * (1 - Math.exp(-dt * 1.5));
  smogK += (Math.min(1, (builtCount + factoriesBuilt * 3) / 30) - smogK) * (1 - Math.exp(-dt * 0.6));
  if (!lookHint && builtCount >= 6 && !ending) { lookHint = true; sayToast('Press C to look back at what you have done.'); }
  if (builtCount >= nextThought) { sayToast(THOUGHTS[Math.floor(nextThought / 10 - 1) % THOUGHTS.length]); nextThought += 10; }
}

/* ---------- Start, end, start again ---------- */
function useHere() { if (intro) { intro = false; } }
function endWalk(kind) {
  if (ending) { return; }
  ending = { kind, t: clockT }; sound.go(); baseNight = 0.25; nightTarget = baseNight;
  backWant = true;   // turn round and see the street you made, then the card
}
// A new street: a new seed, the forest back, every count back to zero, and the opening card.
function restartWalk() {
  seed += 97;
  ending = null; intro = true; backWant = false; backT = 0; baseNight = 0; nightTarget = 0; smogK = 0; lookHint = false; toasts.length = 0;
  treesCut = 0; builtCount = 0; homesBuilt = 0; towersBuilt = 0; shopsBuilt = 0; factoriesBuilt = 0; nextThought = 10;
  chunks.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; buildSkyline();
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
    if (sound && sound.style && typeof MUSIC_NAME !== 'undefined') {
      const on = sound.enabled && sound.context && sound.context.state === 'running', label = on ? `Music: ${MUSIC_NAME[sound.style]}` : 'Click for sound';
      textStyle(BOLD); textSize(12); const lw = textWidth(label) + 24; noStroke(); fill(0, 60); rect(16 + 2, height - 46 + 3, lw, 26, 13); fill(sound.style === 'rich' ? color(212, 160, 23) : sound.style === 'poor' ? color(110, 100, 96) : sound.style === 'city' ? color(200, 40, 120) : color(63, 143, 214)); rect(16, height - 46, lw, 26, 13);
      fill(255); textAlign(LEFT, CENTER); text(label, 28, height - 33); textStyle(NORMAL);
    }
  }
  if (!intro) { drawHandPanel(); }
  if (intro) { drawOpening(); }
  if (ending && ending.kind === 'built') {
    const lines = [`You cut down ${treesCut} trees.`, `You built ${homesBuilt} homes, ${shopsBuilt} shops and ${towersBuilt} towers.`, 'Listen: the birds have stopped.', '', 'Every city was a forest once.', 'We build our world the way we want it.', 'Nobody asks the forest.'];
    storyCard('THE WORLD WE WANTED', lines, clockT - ending.t > 4.5 ? 'F: keep building   -   R: start again' : '', easeN((clockT - ending.t - 2.6) / 1.2), '#2f6a3a');
  }
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
  const rows = [['L  R', 'Swing your left / right hand: cut the forest on that side'], ['OPEN', 'Lift an open hand: homes (higher = taller)'], ['POINT', 'Lift a pointing finger: shops, diners, malls'], ['FIST', 'Lift a fist: car parks, factories, towers']];
  rows.forEach(([k, label], i) => { const ry = y + 126 + i * 32; textSize(15); const kw = 62; fill(255); stroke(90, 100, 85); strokeWeight(1.5); rect(x + 40, ry, kw, 28, 6); noStroke(); fill(30, 40, 30); textAlign(CENTER, CENTER); text(k, x + 40 + kw / 2, ry + 14); textAlign(LEFT, CENTER); textStyle(NORMAL); textSize(16); text(label, x + 40 + kw + 16, ry + 14); textStyle(BOLD); });
  textAlign(CENTER, CENTER); textStyle(ITALIC); textSize(12); fill(110, 120, 105); text('Press H for the camera: walk or run on the spot to move.   C: look back.', cx, y + 268); text('F when you are finished.   No camera: Z / X cut, hold B homes, V shops, N towers.', cx, y + 286);
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


/* ---------- Your hands: chop the forest, raise the city (webcam + ml5 handPose) ---------- */
// Press H to use the camera. The hand moves are decided so each one carries the meaning:
//   swipe left / right  -> chop the forest on that side (as many times as you like)
//   open hand, lift up   -> build homes on the cleared land, floor by floor
//   fist, lift up        -> build luxury towers for investors (they stay empty: 0 AFFORDABLE)
// Only lifting builds; a hand held still does nothing, so you chop first and build after.
// Without a camera: ← / → chop... (X chops the right, Z the left), hold B for homes, N for towers.
let treesCut = 0, builtCount = 0, homesBuilt = 0, towersBuilt = 0, shopsBuilt = 0, factoriesBuilt = 0, keyHoldT = 0;
let nextThought = 10;
const THOUGHTS = ['Every city was a forest once.', 'Listen. Fewer birds now.', 'We build our world the way we want it.', 'Nobody asks the forest.', 'How much is enough?'];
let handMode = false, handVideo = null, handModel = null, handStatus = '', chopHintT = -9, buildHintT = -9;
// Two hands, one for each side of the street. In the mirrored picture your left hand is on the left.
const newHand = () => ({ ok: false, x: 0.5, y: 0.6, fist: false, t: 0, seen: -9, chopT: -9, trail: [], lift: 0 });
const hands = { [-1]: newHand(), [1]: newHand() };
function startHands() {
  if (handMode) { handMode = false; handStatus = ''; return; }
  handMode = true; handStatus = 'Starting the camera...'; calibState = 'wait'; motionBase = 0; motionPrev = null;
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
// One position of your hand (0..1, mirrored like a mirror) from the camera, or from a test.
function handFeed(nx, ny, fist = false) { handFeedSide(nx < 0.5 ? -1 : 1, nx, ny, fist); }
// One position of one hand (0..1, mirrored like a mirror). Left hand -> left side of the street, right -> right.
function handFeedSide(side, nx, ny, fist = false) {
  const shape = fist === true ? 'fist' : fist || 'open';
  const now = performance.now() / 1000, s = hands[side], fresh = s.ok && now - s.seen < 0.4;
  if (fresh) { const up = s.y - ny; if (up > 0.004) { s.lift += up; } }   // lifting this hand builds on its side
  s.x = nx; s.y = ny; s.shape = shape; s.fist = shape === 'fist'; s.t = now; s.ok = true; s.seen = now;
  s.trail.push({ x: nx, y: ny, t: now }); while (s.trail.length && now - s.trail[0].t > 0.4) { s.trail.shift(); }
  // A chop: a quick sideways stroke of this hand (more sideways than up or down, so lifting to build
  // never chops) of at least 18% of the picture within 0.4 s cuts the forest on its side.
  if (now - s.chopT > 0.35) {
    for (const a of s.trail) { const dx = nx - a.x, dy = ny - a.y; if (Math.abs(dx) > 0.18 && Math.abs(dx) > Math.abs(dy)) { s.chopT = now; s.trail.length = 0; chopForest(side); break; } }
  }
}
function handsActive() { return !intro && !ending; }
// Land that waits for your hands instead of building itself.
function waitsForHand(L) { return true; }   // in this world nothing builds itself
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
  const L = pick(side);
  if (!L) { if (clockT - chopHintT > 4) { chopHintT = clockT; sayToast(`No forest left on the ${side < 0 ? 'left' : 'right'} here. Walk on to find more.`); } return; }
  L.cutT = clockT; L.grow = 0; treesCut += treesOn(L);
  const L2 = pick(side); if (L2) { L2.cutT = clockT + 0.12; L2.grow = 0; treesCut += treesOn(L2); }   // one swing clears a stretch of two lots
  spawnBirds(L, side); if (L2) { spawnBirds(L2, side); }
  if (sound.chop) { sound.chop(side); } if (sound.flutter) { sound.flutter(side); }
  if (clockT - chopHintT > 10) { chopHintT = clockT; sayToast('The forest is gone. Lift your hand to build: the higher, the taller.'); }
}
// What a cleared lot becomes. Each kind of hand builds a different family of buildings, picked at
// random so the street never repeats: homes (bungalows, terraces, cottages, caravans, villas,
// mansions), shops (corner shops, high-street shops, brick offices) or towers (brick and glass,
// skyscrapers that stand empty, and on a big lot a castle).
function makeBuilt(L, kind, level = 0) {
  // How high you lift decides how big it gets: level 0 low, 1 middle, 2 high (see handUpdate).
  //   open hand: bungalows, cottages, caravans, log cabins -> terraces, canal row houses, modern houses,
  //              villas, mansions -> apartment blocks, "vertical forest" condos
  //   pointing:  petrol stations, corner shops, diners -> high-street shops, supermarkets, cinemas -> offices, malls
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
function handUpdate(dt) {
  const now = performance.now() / 1000; sampleMotion();
  for (const side of [-1, 1]) { const s = hands[side]; if (s.ok && now - s.seen > 0.6) { s.ok = false; } }
  // Keys stand in for the camera: B lifts homes, V shops, N industry, on both sides.
  const keyLift = keysHeld.has('KeyB') || keysHeld.has('KeyN') || keysHeld.has('KeyV') ? dt : 0, keyShape = keysHeld.has('KeyN') ? 'fist' : keysHeld.has('KeyV') ? 'point' : 'open';
  keyHoldT = keyLift ? keyHoldT + dt : 0;
  const keyLevel = keyHoldT < 0.6 ? 0 : keyHoldT < 1.4 ? 1 : 2;   // hold longer: bigger
  for (const side of [-1, 1]) {
    const s = hands[side], lift = s.lift + keyLift, shape = keyLift ? keyShape : s.ok ? s.shape || 'open' : 'open'; s.lift = 0;
    if (!handsActive() || lift <= 0) { continue; }
    // The lift raises the cleared lots on this hand's side, nearest first.
    const cleared = [];
    for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && clockT - L.cutT > 0.45 && Math.abs(L.z0 - distanceWalked) < 50) { cleared.push(L); } } }
    cleared.sort((a, b) => Math.abs(a.z0 - distanceWalked) - Math.abs(b.z0 - distanceWalked));
    // Nothing cleared on this side: the lift clears the nearest forest itself (the trees fall, and
    // the building starts as soon as they are down), so a press or a lift always builds.
    if (!cleared.length) {
      let falling = false;
      for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && clockT - L.cutT <= 0.45) { falling = true; } } }
      if (!falling) {
        chopForest(side);
        // Remember what this press or lift asked for, so even a quick tap builds once the trees are down.
        const kind = shape === 'fist' ? 'tower' : shape === 'point' ? 'shop' : 'home', level = keyLift ? keyLevel : s.ok ? handLevel(s) : 0;
        for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && !L.buildKind && clockT - L.cutT <= 0.45) { L.buildKind = kind; L.level = level; makeBuilt(L, kind, level); L.grow = 0.02; L.liftT = clockT; } } }
      }
      continue;
    }
    const level = keyLift ? keyLevel : s.ok ? handLevel(s) : 0;
    for (const L of cleared.slice(0, 2)) {
      if (!L.buildKind) { L.buildKind = shape === 'fist' ? 'tower' : shape === 'point' ? 'shop' : 'home'; L.level = -1; L.grow = 0; }
      // Reaching higher turns it into a bigger building; what is built so far keeps its height.
      if (level > L.level) { const builtM = (L.grow || 0) * (L.H || 0); L.level = level; makeBuilt(L, L.buildKind, level); L.grow = Math.min(0.98, builtM / L.H); }
      // While your hand is still rising it keeps going (it can still get bigger); it tops out
      // when you stop. Taller buildings need a little more lifting, but not much.
      L.liftT = clockT;
      growLot(L, lift * 3 * Math.pow(8 / Math.max(8, L.H), 0.3), 0.97);
    }
  }
  // Once you stop lifting, the building tops out at the size your hand reached: the last floors go
  // up on their own in about half a second, and the scaffolding comes down.
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.buildKind && L.born === undefined && L.grow > 0 && clockT - (L.liftT || 0) > 0.25 && clockT - L.cutT > 0.45) { growLot(L, dt * 2.2, 1); } } }
}
function growLot(L, add, cap) {
  const n = floorsOf(L), before = Math.floor(L.grow * n + 1e-6);
  L.grow = Math.min(cap, L.grow + add);
  const after = Math.floor(L.grow * n + 1e-6);
  if (after > before) { L.floorT = clockT; if (sound.floorUp) { sound.floorUp(after, n, L.side); } }
  if (L.grow >= 1) {
    L.born = clockT - RISE_T - 1; L.thud = true; builtCount++;
    if (L.buildKind === 'tower') { towersBuilt++; } else if (L.buildKind === 'shop') { shopsBuilt++; } else { homesBuilt++; }
    if (L.style === 'factory' || L.style === 'powerplant') { factoriesBuilt++; }
    if (sound.built) { sound.built(L.buildKind === 'tower'); }
  }
}
// Scaffolding while a building goes up: poles, ledgers, braces, planks and a green net on top,
// and a tower crane beside the tall ones. It comes down when the building is finished.
function drawScaffold(L, g) {
  if (L.style === 'carpark' || L.style === 'petrol') { return; }
  const s = L.side, x = s * (EDGE_X + L.setback), xs = x - s * 0.8, z0 = clipZ(L.z0), z1 = L.z1; if (z1 <= z0 + 0.2) { return; }
  const built = L.H * g, top = Math.min(L.H + 1, built + 2.2), near = P(xs, 0, z0); if (near.rz > FAR_Z) { return; }
  const lw = Math.max(1, Math.min(4, near.k * 0.05));
  ctx.save(); ctx.globalAlpha = 1 - fogFor(midN(z0, z1)) * 0.8;
  for (let y = 3; y <= top; y += 3) { polyN([P(xs, y, z0), P(xs, y, z1), P(x, y, z1), P(x, y, z0)], toneN('#a07a4a', z0, 0.9)); }
  polyN(wallQuad(xs, z0, xs, z1, Math.max(0, built - 3), top), rgbaN('#2f7a4a', 0.3));
  ctx.strokeStyle = toneN('#c89a3a', z0); ctx.lineWidth = lw; ctx.beginPath();
  for (let zz = Math.ceil(L.z0 / 2) * 2; zz <= z1; zz += 2) { if (zz < z0) { continue; } segN(P(xs, 0, zz), P(xs, top, zz)); }
  for (let y = 1.5; y <= top; y += 1.5) { segN(P(xs, y, z0), P(xs, y, z1)); }
  ctx.stroke();
  ctx.strokeStyle = toneN('#9a7a3a', z0); ctx.lineWidth = Math.max(1, lw * 0.7); ctx.beginPath();
  for (let zz = Math.ceil(L.z0 / 4) * 4; zz + 2 <= z1; zz += 4) { if (zz < z0) { continue; } for (let y = 0; y + 3 <= top; y += 3) { segN(P(xs, y, zz), P(xs, y + 3, zz + 2)); } }
  ctx.stroke();
  ctx.restore();
  if (L.H > 18) { drawCrane(L, x, top); }
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
    fill(s.fist ? color(224, 48, 42) : col); circle(x + s.x * w, y + s.y * h, 16); fill(255); textSize(10); textAlign(CENTER, CENTER); text((side < 0 ? 'L ' : 'R ') + (s.shape === 'fist' ? 'FIST' : s.shape === 'point' ? 'POINT' : 'OPEN'), x + s.x * w, y + s.y * h - 16);
  }
  const s = { ok: hands[-1].ok || hands[1].ok };
  fill(255); textFont('Georgia'); textStyle(BOLD); textSize(10); textAlign(LEFT, TOP);
  textSize(10); text(s.ok || !handStatus ? 'Swing L / R hand: cut that side\nLift open hand, point or fist: higher = taller\nStep or run on the spot to move' : handStatus, x, y - 46, w + 4);
  // Calibration message over the picture.
  const tNow = performance.now() / 1000, calibMsg = calibState === 'run' ? `Stand still for 2 seconds... ${Math.max(0, 2 - (tNow - calibT0)).toFixed(1)}` : calibState === 'done' && tNow - calibDoneT < 1.8 ? 'Calibrated' : '';
  if (calibMsg) { fill(0, 170); rect(x, y + h / 2 - 16, w, 32); fill(calibState === 'run' ? '#ffd23f' : '#7fdc8a'); textSize(15); textAlign(CENTER, CENTER); text(calibMsg, x + w / 2, y + h / 2); }
  pop();
}

/* ---------- Your body: walk or run on the spot, and the street moves with you ---------- */
// While the camera is on, the middle of the picture (your body, not your arms out to the sides) is
// compared frame to frame. Standing still stops; stepping on the spot walks; running on the spot runs.
// [ and ] make it less or more sensitive.
let motionCanvas = null, motionPrev = null, motionK = 0, motionT = 0, motionGain = 1;
// Calibration: when the camera starts you stand still for 2 seconds; the movement measured then
// (camera noise, flicker, a fan behind you) is the baseline, and only movement above it counts.
let calibState = 'wait', calibT0 = 0, calibSum = 0, calibN = 0, calibDoneT = -9, motionBase = 0;
function sampleMotion() {
  if (!handMode || !handVideo || !handVideo.elt || handVideo.elt.readyState < 2) { motionK *= 0.9; return; }
  const now = performance.now(); if (now - motionT < 66) { return; } motionT = now;
  const W = 48, H = 36;
  if (!motionCanvas) { motionCanvas = document.createElement('canvas'); motionCanvas.width = W; motionCanvas.height = H; }
  const c = motionCanvas.getContext('2d', { willReadFrequently: true }); c.drawImage(handVideo.elt, 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H).data, cur = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { cur[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3; }
  let changed = 0, n = 0;
  if (motionPrev) { for (let y = 0; y < H; y++) { for (let x = 15; x < 33; x++) { const i = y * W + x; n++; if (Math.abs(cur[i] - motionPrev[i]) > 20) { changed++; } } } }
  motionPrev = cur;
  if (!n) { return; }
  const raw = changed / n, t = now / 1000;
  if (calibState === 'wait') { calibState = 'run'; calibT0 = t; calibSum = 0; calibN = 0; }
  if (calibState === 'run') {
    calibSum += raw; calibN++; motionK = 0;
    if (t - calibT0 >= 2) { motionBase = calibSum / calibN; calibState = 'done'; calibDoneT = t; }
    return;
  }
  motionK = mixN(motionK, Math.min(1, Math.max(0, raw - motionBase * 1.5) * motionGain), 0.35);
}
// The walking speed your body asks for, in metres per second.
function bodySpeed() {
  if (!handMode || !handVideo) { return 0; }
  const m = motionK;
  if (m < 0.04) { return 0; }
  return m < 0.16 ? mixN(1.5, WALK_SPD, (m - 0.04) / 0.12) : mixN(WALK_SPD, RUN_SPD * 1.2, Math.min(1, (m - 0.16) / 0.22));
}

/* ---------- Keys ---------- */
function boardKey(e) {
  const code = e.code;
  if (code === 'KeyE' || code === 'Space' || code === 'Enter' && (intro || ending)) { useHere(); return true; }
  if (code === 'KeyR') { restartWalk(); return true; }
  if (code === 'KeyC') { if (!intro && !ending) { backWant = !backWant; } return true; }
  if (code === 'KeyF') { if (ending) { ending = null; baseNight = 0; nightTarget = 0; backWant = false; } else if (!intro) { endWalk('built'); } return true; }
  if (code === 'KeyH') { startHands(); return true; }
  if (code === 'KeyX' || code === 'ArrowRight' || code === 'KeyD') { chopForest(1); return true; }
  if (code === 'KeyZ' || code === 'ArrowLeft' || code === 'KeyA') { chopForest(-1); return true; }
  if (code === 'KeyB' || code === 'KeyN' || code === 'KeyV') { return true; }
  if (code === 'BracketLeft') { motionGain = Math.max(0.3, motionGain / 1.25); sayToast(`Step sensitivity ${Math.round(motionGain * 100)}%`); return true; }
  if (code === 'BracketRight') { motionGain = Math.min(4, motionGain * 1.25); sayToast(`Step sensitivity ${Math.round(motionGain * 100)}%`); return true; }
  return false;
}

/* ---------- What to do next: one line at the top, and a pink arrow in the street ---------- */
function nextText() {
  if (backWant && !ending) { return 'Looking back  -  C to turn round'; }
  const z = distanceWalked; let cleared = false, forest = false;
  for (const ch of chunks.values()) { for (const L of ch.lots) { const d = L.z0 - z; if (L.cutT !== undefined && L.born === undefined && Math.abs(d) < 50) { cleared = true; } if (L.cutT === undefined && L.born === undefined && d > -2 && d < 45) { forest = true; } } }
  if (cleared) { return 'Lift a hand to build: open = homes, point = shops, fist = towers'; }
  if (forest) { return 'Swing your left or right hand to cut that side'; }
  return 'Walk on';
}
function drawNextBar() {
  const t = nextText(); push(); textFont('Georgia'); textStyle(BOLD); textSize(17);
  const w = textWidth(t) + 90, x = width / 2 - w / 2, crowded = x < 16 + Math.min(400, width * 0.5) + 8 || x + w > width - 16 - 190 - 8, y = crowded ? 142 : 16;
  noStroke(); fill(0, 60); rect(x + 3, y + 4, w, 40, 20); fill(42, 30, 24); rect(x, y, w, 40, 20);
  fill('#ffd23f'); rect(x + 10, y + 11, 52, 18, 9); fill(42, 30, 24); textSize(10); textAlign(CENTER, CENTER); text('NEXT', x + 36, y + 20.5);
  fill(255, 236, 190); textSize(17); textAlign(LEFT, CENTER); text(t, x + 72, y + 21);
  pop();
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
function boardClick(mx, my) {
  if (intro) { intro = false; return true; }
  if (ending) { if (clockT - ending.t > 4.5) { ending = null; baseNight = 0; nightTarget = 0; backWant = false; } return true; }
  return false;
}

// A dozen people per block on the pavements. They wait (propWaits) until there are buildings near them.
function addResidents(ch) {
  const rr = rngN(seed + ch.slot * 83 + zone * 761);
  for (let i = 0; i < 12; i++) { ch.props.push({ kind: 'person', x: (i % 2 ? 1 : -1) * (EDGE_X - 0.8), z: ch.z0 + CROSS_W + 2 + rr() * (CHUNK_LEN - CROSS_W - 4), tone: rr(), h: 1.55 + rr() * 0.3, ph: rr() * 6 }); }
}
