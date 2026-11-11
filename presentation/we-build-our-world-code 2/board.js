/* Plotline — We Build Our World.
 * The street starts as forest: wind, leaves and birds, and nothing built. With your hands (camera,
 * press H) or the keys you cut the forest down beside you and raise buildings on the cleared land,
 * floor by floor: an open hand builds homes, a fist builds towers. The more you build, the more the
 * street turns into a city: traffic instead of birds, music instead of wind. Build enough and the
 * last bird stops singing, and the card counts what it cost.
 */
// The street plan for one run of 10 blocks. A number is a district tier (0 small shops, 1 terraces
// and shops, ...); a word is a building style from STYLES_LOT. Every lot starts as forest: the plan
// only sets how the land is divided (lot sizes, back rows), and your hands decide what is built.
const STREET_PLAN = ['bungalow', 'bungalow', 1, 'bungalow', 'bungalow', 'bungalow', 1, 'bungalow', 'bungalow', 'bungalow'];
const zone = 3;   // seeds the street, its people and the music (the same number always gives the same street)
// Building styles: their district tier (colours, ground) and lot sizes and setbacks in metres.
const STYLES_LOT = {
  villa: { tier: 2, len: [20, 26], setback: 6 },
  bungalow: { tier: 1, len: [11, 14], setback: 4.5 },
  apartment: { tier: 3, len: [12, 20], setback: 3 },
  factory: { tier: 3, len: [16, 24], setback: 2 },
  carpark: { tier: 1, len: [12, 20], setback: 0.6 },
  petrol: { tier: 1, len: [12, 18], setback: 0.8 },
  caravan: { tier: 0, len: [6, 7.5], setback: 1.2 }
};
function chunkStyle(slot) { const v = STREET_PLAN[slot]; return typeof v === 'string' ? v : null; }
function chunkTier(slot) { const v = STREET_PLAN[slot]; return typeof v === 'string' ? STYLES_LOT[v].tier : v; }

let streetT = 0, baseNight = 0, ending = null, intro = true;   // streetT: when this street began
const toasts = [];   // short messages near the bottom of the screen
function sayToast(text) { toasts.push({ text, t: clockT }); }

/* ---------- The artwork's words ---------- */
// Slogans painted by hand on one wall per block side (paintSlogan), and the names of empty towers.
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
  for (const side of [-1, 1]) { const walls = ch.lots.filter(L => L.side === side && L.H > 3 && L.z1 - L.z0 > 6); if (walls.length && r() < 0.7) { pickN(r, walls).art = ART[(ch.slot * 2 + (side > 0 ? 1 : 0)) % ART.length]; } }
}
// Street life waits for buildings: nobody lives in the forest.
function propWaits(ch, p) {
  const side = p.x < 0 ? -1 : 1;
  return !ch.lots.some(L => L.side === side && L.born !== undefined && Math.abs((L.z0 + L.z1) / 2 - p.z) < 16);
}

/* ---------- The sound of the homes ---------- */
// Every lived-in home has its own sound: kids, a dog, a piano, the TV. Walk past and you hear it
// through the wall; stand still and it comes through clearly. Empty towers, car parks and factories are silent.
function lifeKind(L) {
  const pool = L.style === 'caravan' || L.tier === 0 ? ['dog', 'radio', 'baby', 'tv', 'kids'] : L.tier >= 3 ? ['tv', 'piano', 'baby', 'talk'] : L.tier === 2 ? ['piano', 'dog', 'kids', 'talk'] : ['kids', 'dog', 'piano', 'cook', 'tv', 'baby'];
  return pool[Math.abs(L.seed >> 3) % pool.length];
}
function lived(L) { return !L.vacant && L.style !== 'carpark' && L.style !== 'petrol' && L.style !== 'factory' && riseOf(L.born) > 0.9; }
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
// People on the pavement, who only come once there are buildings (propWaits).
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
// A grey wash that mutes the colours, used only when the GPU pass (postfx.js) is off.
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
      const on = sound.enabled && sound.context && sound.context.state === 'running', label = on ? `♪  ${MUSIC_NAME[sound.style]}` : '♪  Click for sound';
      textStyle(BOLD); textSize(12); const lw = textWidth(label) + 24; noStroke(); fill(0, 60); rect(16 + 2, height - 46 + 3, lw, 26, 13); fill(sound.style === 'rich' ? color(212, 160, 23) : sound.style === 'poor' ? color(110, 100, 96) : sound.style === 'city' ? color(200, 40, 120) : color(63, 143, 214)); rect(16, height - 46, lw, 26, 13);
      fill(255); textAlign(LEFT, CENTER); text(label, 28, height - 33); textStyle(NORMAL);
    }
  }
  if (!intro) { drawHandPanel(); }
  if (intro) { drawOpening(); }
  if (ending && ending.kind === 'built') {
    const lines = [`You cut down ${treesCut} trees.`, `You built ${homesBuilt} homes, ${shopsBuilt} shops and ${towersBuilt} towers.`, 'Listen: the birds have stopped.', '', 'Every city was a forest once.', 'We build our world the way we want it.', 'Nobody asks the forest.'];
    storyCard('THE WORLD WE WANTED', lines, clockT - ending.t > 4.5 ? 'F: keep building   ·   R: start again' : '', easeN((clockT - ending.t - 2.6) / 1.2), '#2f6a3a');
  }
  pop();
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
  const rows = [['L  R', 'Swing a hand sideways: cut the forest on that side'], ['✋ ↑', 'Lift an open hand: homes (higher = bigger)'], ['☝ ↑', 'Lift a pointing finger: petrol, shops, offices'], ['✊ ↑', 'Lift a fist: car parks, factories, towers']];
  rows.forEach(([k, label], i) => { const ry = y + 126 + i * 32; textSize(15); const kw = 62; fill(255); stroke(90, 100, 85); strokeWeight(1.5); rect(x + 40, ry, kw, 28, 6); noStroke(); fill(30, 40, 30); textAlign(CENTER, CENTER); text(k, x + 40 + kw / 2, ry + 14); textAlign(LEFT, CENTER); textStyle(NORMAL); textSize(16); text(label, x + 40 + kw + 16, ry + 14); textStyle(BOLD); });
  textAlign(CENTER, CENTER); textStyle(ITALIC); textSize(12); fill(110, 120, 105); text('Press H for the camera: walk or run on the spot to move.   C: look back.', cx, y + 268); text('F when you are finished.   No camera: Z / X cut · B homes · V shops · N towers (hold = bigger).', cx, y + 286);
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
// Press H to use the camera. Each move carries the meaning:
//   swing a hand sideways      -> chop the forest on that hand's side of the street
//   lift an open hand  ✋       -> homes     (low: bungalow / cottage, mid: terrace / villa, high: apartments)
//   lift a pointing finger ☝   -> shops     (low: petrol / corner shop, mid: high street, high: offices)
//   lift a fist  ✊             -> industry  (low: car park, mid: factory, high: an empty skyscraper)
// One lift builds straight away; reaching higher in the same lift makes it bigger. If the land on that
// side is still forest, the lift clears it first. A hand held still does nothing.
// Keys: Z / X (or ← / →) chop; B homes, V shops, N towers (hold the key to build bigger).
let treesCut = 0, builtCount = 0, homesBuilt = 0, towersBuilt = 0, shopsBuilt = 0, factoriesBuilt = 0, keyHoldT = 0, keyWas = '';
let nextThought = 10;
const THOUGHTS = ['Every city was a forest once.', 'Listen. Fewer birds now.', 'We build our world the way we want it.', 'Nobody asks the forest.', 'How much is enough?'];
let handMode = false, handVideo = null, handModel = null, handStatus = '', chopHintT = -9, buildHintT = -9;
// Gesture thresholds, in shares of the camera picture (0..1).
const CHOP_DIST = 0.15, CHOP_WINDOW = 0.35;   // a swing: this far sideways within this many seconds
const LIFT_MIN = 0.09;                        // a lift: the hand rises this far from its lowest point
// Two hands, one for each side of the street. In the mirrored picture your left hand is on the left.
const newHand = () => ({ ok: false, x: 0.5, y: 0.6, shape: 'open', shapes: [], seen: -9, chopT: -9, buildT: -9, trail: [], flash: -9 });
const hands = { [-1]: newHand(), [1]: newHand() };
// The building each side's current lift started (reaching higher in the same lift makes it bigger).
const sideBuild = { [-1]: null, [1]: null };
function startHands() {
  if (handMode) { handMode = false; handStatus = ''; return; }
  handMode = true; handStatus = 'Starting the camera…'; calibState = 'wait'; motionBase = 0; motionPrev = null;
  if (handModel) { handStatus = 'Show your hand to the camera'; return; }
  const go = () => {
    try {
      handVideo = createCapture(VIDEO); handVideo.size(640, 480); handVideo.hide();
      handModel = ml5.handPose({ maxHands: 2, modelType: 'full' }, () => { handStatus = 'Show your hand to the camera'; handModel.detectStart(handVideo, gotHands); });
    } catch (e) { handStatus = 'No camera: Z / X chop, B / V / N build'; }
  };
  if (window.ml5) { go(); return; }
  const sc = document.createElement('script'); sc.src = 'https://unpkg.com/ml5@1.0.1/dist/ml5.min.js';
  sc.onload = go; sc.onerror = () => { handStatus = 'Hand tracking could not load: Z / X chop, B / V / N build'; };
  document.head.appendChild(sc);
}
// The shape of one hand from its 21 landmarks: a finger is straight when its tip is clearly further
// from the wrist than its middle joint. All four curled = fist, only the index straight = pointing,
// three or four straight = open. Anything in between returns null (not sure: keep the last shape).
function handShape(at) {
  const wrist = at('wrist'); if (!wrist) { return null; }
  const d = p => Math.hypot(p.x - wrist.x, p.y - wrist.y);
  const straight = f => { const tip = at(f + '_finger_tip'), pip = at(f + '_finger_pip'); return tip && pip ? d(tip) > d(pip) * 1.12 : false; };
  const idx = straight('index'), others = ['middle', 'ring', 'pinky'].filter(straight).length;
  if (!idx && others === 0) { return 'fist'; }
  if (idx && others === 0) { return 'point'; }
  if (others >= 2) { return 'open'; }
  return null;
}
function gotHands(results) {
  if (!results || !handVideo) { return; }
  const seen = [], vw = handVideo.width || 640, vh = handVideo.height || 480;
  for (const h of results.slice(0, 2)) {
    const kp = h.keypoints || [], at = n => kp.find(k => k.name === n);
    // The middle of the palm (wrist and the four knuckles) moves the same whatever the fingers do.
    const palm = ['wrist', 'index_finger_mcp', 'middle_finger_mcp', 'ring_finger_mcp', 'pinky_finger_mcp'].map(at).filter(Boolean);
    if (!palm.length) { continue; }
    const px = palm.reduce((a, p) => a + p.x, 0) / palm.length, py = palm.reduce((a, p) => a + p.y, 0) / palm.length;
    seen.push({ x: 1 - px / vw, y: py / vh, shape: handShape(at) });
  }
  // Which hand is which. Two hands: the one further left is your left. One hand: the track it was
  // already on, if that track is still live, so a hand swinging across the middle stays the same hand.
  const now = performance.now() / 1000, live = [-1, 1].filter(sd => hands[sd].ok && now - hands[sd].seen < 0.5);
  if (seen.length === 2) { seen.sort((a, b) => a.x - b.x); handFeedSide(-1, seen[0].x, seen[0].y, seen[0].shape); handFeedSide(1, seen[1].x, seen[1].y, seen[1].shape); }
  else if (seen.length === 1) {
    const p = seen[0]; let side = p.x < 0.5 ? -1 : 1;
    if (live.length === 1) { side = live[0]; }
    else if (live.length === 2) { side = Math.hypot(p.x - hands[-1].x, p.y - hands[-1].y) < Math.hypot(p.x - hands[1].x, p.y - hands[1].y) ? -1 : 1; }
    handFeedSide(side, p.x, p.y, p.shape);
  }
}
// One position of your hand (0..1, mirrored like a mirror) from a test, assigned by which half it is in.
function handFeed(nx, ny, shape = 'open') { handFeedSide(nx < 0.5 ? -1 : 1, nx, ny, shape); }
// One position of one hand. Left hand -> left side of the street, right hand -> right side.
function handFeedSide(side, nx, ny, shape = 'open') {
  if (shape === true) { shape = 'fist'; }
  const now = performance.now() / 1000, s = hands[side];
  if (!s.ok || now - s.seen > 0.5) { s.trail.length = 0; s.shapes.length = 0; sideBuild[side] = null; }
  s.x = nx; s.y = ny; s.ok = true; s.seen = now;
  // The shape is a vote over the last few frames, so one bad frame does not change what you build.
  if (shape) { s.shapes.push(shape); if (s.shapes.length > 5) { s.shapes.shift(); } }
  if (s.shapes.length) { const n = k => s.shapes.filter(v => v === k).length; s.shape = ['open', 'point', 'fist'].reduce((a, b) => n(b) > n(a) ? b : a, s.shape); }
  s.fist = s.shape === 'fist';
  s.trail.push({ x: nx, y: ny, t: now }); while (s.trail.length && now - s.trail[0].t > 0.6) { s.trail.shift(); }
  if (!handsActive()) { return; }
  // A swing: the hand travels far enough sideways, quickly, and more sideways than up or down.
  if (now - s.chopT > 0.45) {
    for (const a of s.trail) {
      if (now - a.t > CHOP_WINDOW) { continue; }
      const dx = nx - a.x, dy = ny - a.y;
      if (Math.abs(dx) > CHOP_DIST && Math.abs(dx) > Math.abs(dy) * 1.2) { s.chopT = now; s.flash = now; s.trail.length = 0; sideBuild[side] = null; chopForest(side); return; }
    }
  }
  // A lift: the hand rises far enough from its lowest point in the last 0.6 s, mostly straight up.
  // Lowering the hand again ends the lift; the next lift builds something new.
  const cur = sideBuild[side];
  if (cur && ny > cur.topY + 0.07) { sideBuild[side] = null; }
  if (now - s.chopT < 0.4) { return; }   // the arm coming back after a swing is not a lift
  let low = s.trail[0]; for (const p of s.trail) { if (p.y > low.y) { low = p; } }
  const rise = low.y - ny;
  if (rise > LIFT_MIN && Math.abs(nx - low.x) < rise * 1.3 && buildOn(side, s.shape, handLevel(s), ny)) { s.buildT = now; }
}
function handsActive() { return !intro && !ending; }
// Land that waits for your hands instead of building itself.
function waitsForHand(L) { return true; }   // in this world nothing builds itself
function treesOn(L) { return Math.max(2, Math.round((L.z1 - L.z0) / 2.4)) * 3; }
// Cut the forest on one side: the two nearest forest lots ahead of you. Returns the lots cut.
function chopForest(side) {
  if (!handsActive()) { return []; }
  const z = distanceWalked, pick = s => { let best = null; for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side !== s || L.cutT !== undefined || L.born !== undefined || !waitsForHand(L)) { continue; } const d = L.z0 - z; if (d > -2 && d < 60 && (!best || d < best.d)) { best = { L, d }; } } } return best && best.L; };
  const L = pick(side); if (!L) { return []; }
  L.cutT = clockT; treesCut += treesOn(L);
  const L2 = pick(side); if (L2) { L2.cutT = clockT + 0.12; treesCut += treesOn(L2); }   // one swing clears a stretch of two lots
  spawnBirds(L, side); if (L2) { spawnBirds(L2, side); }
  if (sound.chop) { sound.chop(side); } if (sound.flutter) { sound.flutter(side); }
  if (clockT - chopHintT > 10) { chopHintT = clockT; sayToast('The forest is gone. Lift your hand to build: the higher, the bigger.'); }
  return L2 ? [L, L2] : [L];
}
// Cleared lots on one side in front of you, nearest first.
function clearedNear(side) {
  const out = [];
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.side === side && L.cutT !== undefined && L.born === undefined && L.z1 - distanceWalked > 2 && L.z0 - distanceWalked < 60) { out.push(L); } } }
  return out.sort((a, b) => a.z0 - b.z0);
}
// A lift on one side. A new lift raises the nearest two cleared lots (clearing forest first if it
// has to); while the same lift keeps rising, reaching a higher level rebuilds them bigger.
// Returns true when something new was built or made bigger.
function buildOn(side, shape, level, handY = 0) {
  const kind = shape === 'fist' ? 'tower' : shape === 'point' ? 'shop' : 'home', cur = sideBuild[side];
  if (cur) {
    cur.topY = Math.min(cur.topY, handY);
    if (level > cur.level) { cur.level = level; for (const L of cur.lots) { raiseLot(L, cur.kind, level, true); } return true; }
    return false;
  }
  let lots = clearedNear(side).slice(0, 2);
  if (!lots.length) { lots = chopForest(side); }
  if (!lots.length) { if (clockT - buildHintT > 6) { buildHintT = clockT; sayToast(`No land left on the ${side < 0 ? 'left' : 'right'} here. Walk on.`); } return false; }
  for (const L of lots) { raiseLot(L, kind, level, false); }
  sideBuild[side] = { kind, level, lots, topY: handY };
  return true;
}
// Put a building on a cleared lot and let it rise out of the ground (riseOf). The trees fall first.
// upgrade: the lot is already rising; swap in the bigger building at the same height it has reached.
function raiseLot(L, kind, level, upgrade) {
  const wasFactory = L.style === 'factory', metres = upgrade ? Math.min(1, riseOf(L.born)) * L.H : 0;
  L.buildKind = kind; L.level = level; makeBuilt(L, kind, level);
  factoriesBuilt += (L.style === 'factory' ? 1 : 0) - (wasFactory ? 1 : 0);
  if (upgrade) { L.born = clockT - riseTimeFor(Math.min(0.9, metres / L.H)); if (sound.built) { sound.built(kind === 'tower'); } return; }
  L.born = Math.max(clockT, L.cutT + 0.55); L.thud = false; builtCount++;
  if (kind === 'tower') { towersBuilt++; } else if (kind === 'shop') { shopsBuilt++; } else { homesBuilt++; }
  if (sound.built) { sound.built(kind === 'tower'); }
}
// How long a building has been rising when it has reached share k of its height (riseOf, inverted).
function riseTimeFor(k) {
  let lo = 0, hi = 0.6;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (riseOf(clockT - mid * RISE_T) < k) { lo = mid; } else { hi = mid; } }
  return lo * RISE_T;
}
// What a cleared lot becomes. Each kind of hand builds a different family of buildings, picked at
// random so the street never repeats; how high you lift decides how big (level 0 low, 1 mid, 2 high).
//   open hand: bungalows, cottages, caravans -> terraces, villas, mansions -> apartment blocks
//   pointing:  petrol stations, corner shops -> high-street shops -> brick offices
//   fist:      car parks -> factories -> skyscrapers that stand empty
function makeBuilt(L, kind, level = 0) {
  const r = rngN(L.seed + 5 + builtCount * 31 + level * 7), len = L.z1 - L.z0;
  let opts;
  if (kind === 'tower') { opts = level === 0 ? [['style', 'carpark']] : level === 1 ? (len >= 9 ? [['style', 'factory'], ['style', 'factory'], ['tier', 3]] : [['tier', 3]]) : [['tier', 4], ['tier', 4], ['tier', 3]]; }
  else if (kind === 'shop') { opts = level === 0 ? (len >= 11 ? [['style', 'petrol'], ['tier', 0]] : [['tier', 0]]) : level === 1 ? [['tier', 1]] : [['tier', 3]]; }
  else { opts = level === 0 ? [['style', 'bungalow'], ['tier', 0]].concat(len >= 10 ? [['style', 'caravan']] : []) : level === 1 ? [['tier', 1]].concat(len >= 18 ? [['style', 'villa'], ['tier', 2]] : []) : [['style', 'apartment']]; }
  const [how, v] = pickN(r, opts), tier = how === 'tier' ? v : STYLES_LOT[v].tier, t = makeLot(tier, L.side, L.z0, len, r);
  Object.assign(L, { style: null, tier, H: t.H, depth: t.depth, setback: t.setback, color: t.color, accent: t.accent, awning: t.awning, name: t.name, sign: t.sign, crooked: t.crooked || 0, crown: t.crown, spire: t.spire, glass: t.glass, fountain: t.fountain, brick: false, tree: false, vacant: false });
  if (how === 'style') { styleLot(L, v, r); }
  if (kind === 'tower' && tier === 4) { Object.assign(L, { H: mixN(45, 95, r()), vacant: true, sign: true, formerName: 'FOREST', name: VOID_NAMES[Math.abs(L.seed) % VOID_NAMES.length] }); }
}
// The height of your hand picks the size: low (0), chest to face (1), above your head (2).
function handLevel(s) { const h = 1 - s.y; return h < 0.45 ? 0 : h < 0.68 ? 1 : 2; }
function handUpdate(dt) {
  const now = performance.now() / 1000; sampleMotion();
  for (const side of [-1, 1]) { const s = hands[side]; if (s.ok && now - s.seen > 0.6) { s.ok = false; sideBuild[side] = null; } }
  // Keys stand in for the camera: B homes, V shops, N industry, on both sides. Pressing builds at
  // once; keep holding and it grows to the middle size (0.7 s) and then the biggest (1.5 s).
  const key = keysHeld.has('KeyN') ? 'fist' : keysHeld.has('KeyV') ? 'point' : keysHeld.has('KeyB') ? 'open' : '';
  if (key !== keyWas) { sideBuild[-1] = sideBuild[1] = null; keyHoldT = 0; keyWas = key; }
  if (key && handsActive()) {
    keyHoldT += dt;
    const level = keyHoldT < 0.7 ? 0 : keyHoldT < 1.5 ? 1 : 2;
    for (const side of [-1, 1]) { buildOn(side, key, level, 0); }
  }
}
// The camera picture and your hands, bottom right, while the camera is on: where each hand is, what
// it will build (✋ homes, ☝ shops, ✊ towers), a CHOP flash on a swing and BUILD on a lift.
function drawHandPanel() {
  if (!handMode) { return; }
  const w = 260, h = 195, x = width - w - 16, y = height - h - 16, now = performance.now() / 1000;
  push(); noStroke(); fill(0, 150); rect(x - 4, y - 50, w + 8, h + 54, 8);
  if (handVideo && handVideo.elt && handVideo.elt.readyState >= 2) { drawingContext.save(); drawingContext.translate(x + w, y); drawingContext.scale(-1, 1); drawingContext.globalAlpha = 0.85; drawingContext.drawImage(handVideo.elt, 0, 0, w, h); drawingContext.restore(); }
  else { fill(40); rect(x, y, w, h, 4); }
  stroke(255, 255, 255, 60); strokeWeight(1); line(x + w / 2, y, x + w / 2, y + h); noStroke();
  // How high to lift: above the top line builds the biggest things.
  for (const [hk, lab] of [[0.68, 'BIG'], [0.45, 'MID']]) { const ly = y + (1 - hk) * h; stroke(255, 210, 60, 90); strokeWeight(1); drawingContext.setLineDash([4, 4]); line(x, ly, x + w, ly); drawingContext.setLineDash([]); noStroke(); fill(255, 210, 60, 200); textSize(9); textStyle(BOLD); textAlign(RIGHT, BOTTOM); text(lab, x + w - 4, ly - 1); }
  fill(255, 210, 60, 200); textAlign(RIGHT, BOTTOM); text('SMALL', x + w - 4, y + h - 18);
  // Your steps: how much your body is moving, and what the street does with it.
  const sp = bodySpeed(), mode = sp <= 0 ? 'standing' : sp < WALK_SPD * 1.05 ? 'walking' : 'running';
  fill(0, 120); rect(x, y + h - 16, w, 16); fill(mode === 'running' ? '#e0302a' : mode === 'walking' ? '#ffd23f' : '#888'); rect(x, y + h - 16, w * Math.min(1, motionK / 0.4), 16);
  fill(255); textSize(10); textStyle(BOLD); textAlign(LEFT, CENTER); text(`STEPS · ${mode}`, x + 6, y + h - 8);
  const WHAT = { open: 'HOMES', point: 'SHOPS', fist: 'TOWERS' }, ICON = { open: '✋', point: '☝', fist: '✊' };
  for (const side of [-1, 1]) {
    const s = hands[side], half = side < 0 ? x + 6 : x + w / 2 + 6;
    // A flash on that half of the picture when a swing chops or a lift builds.
    const chopA = Math.max(0, 1 - (now - s.flash) / 0.5), buildA = Math.max(0, 1 - (now - s.buildT) / 0.5);
    if (chopA > 0) { fill(224, 48, 42, 150 * chopA); rect(side < 0 ? x : x + w / 2, y, w / 2, h - 16); fill(255, 255 * chopA); textSize(20); textAlign(CENTER, CENTER); text('CHOP', side < 0 ? x + w / 4 : x + w * 3 / 4, y + 24); }
    if (buildA > 0) { fill(63, 160, 80, 140 * buildA); rect(side < 0 ? x : x + w / 2, y, w / 2, h - 16); fill(255, 255 * buildA); textSize(20); textAlign(CENTER, CENTER); text('BUILD ↑', side < 0 ? x + w / 4 : x + w * 3 / 4, y + 24); }
    if (!s.ok) { continue; }
    const col = side < 0 ? color(90, 200, 255) : color(255, 210, 60);
    stroke(col); strokeWeight(3); noFill(); beginShape(); for (const p of s.trail) { vertex(x + p.x * w, y + p.y * h); } endShape(); noStroke();
    fill(col); circle(x + s.x * w, y + s.y * h, 18);
    // What this hand will build, as a label on its half.
    fill(0, 170); rect(half, y + h - 44, w / 2 - 12, 24, 12); fill(255); textSize(12); textAlign(CENTER, CENTER); text(`${side < 0 ? 'L' : 'R'} ${ICON[s.shape]} ${WHAT[s.shape]}`, half + (w / 2 - 12) / 2, y + h - 32);
  }
  const anyHand = hands[-1].ok || hands[1].ok;
  fill(255); textFont('Georgia'); textStyle(BOLD); textSize(11); textAlign(LEFT, TOP);
  text(anyHand || !handStatus ? 'Swing a hand sideways: cut that side\nLift ✋ homes · ☝ shops · ✊ towers\nHigher = bigger · step on the spot to move' : handStatus, x, y - 46, w + 4);
  // Calibration message over the picture.
  const calibMsg = calibState === 'run' ? `Stand still for 2 seconds… ${Math.max(0, 2 - (now - calibT0)).toFixed(1)}` : calibState === 'done' && now - calibDoneT < 1.8 ? 'Calibrated ✓' : '';
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
// A fast swing blurs the hand and the hand tracker can lose it. So the outer thirds of the picture
// are watched too: a sudden burst of movement on one side, while the tracker has lost that hand or
// sees it moving sideways, counts as a swing on that side.
let sideBase = { [-1]: 0, [1]: 0 }, sideCalib = { [-1]: 0, [1]: 0 }, sideChopT = { [-1]: -9, [1]: -9 };
function sampleMotion() {
  if (!handMode || !handVideo || !handVideo.elt || handVideo.elt.readyState < 2) { motionK *= 0.9; return; }
  const now = performance.now(); if (now - motionT < 66) { return; } motionT = now;
  const W = 48, H = 36;
  if (!motionCanvas) { motionCanvas = document.createElement('canvas'); motionCanvas.width = W; motionCanvas.height = H; }
  const c = motionCanvas.getContext('2d', { willReadFrequently: true }); c.drawImage(handVideo.elt, 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H).data, cur = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { cur[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3; }
  // Share of changed pixels in the middle (your body) and in each outer third (your arms). The video
  // is not mirrored, so its left third is your right side.
  let changed = 0, n = 0; const sideCh = { [-1]: 0, [1]: 0 }, sideN = { [-1]: 0, [1]: 0 };
  if (motionPrev) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, hit = Math.abs(cur[i] - motionPrev[i]) > 20 ? 1 : 0;
        if (x >= 15 && x < 33) { n++; changed += hit; } else if (x < 12) { sideN[1]++; sideCh[1] += hit; } else if (x >= 36) { sideN[-1]++; sideCh[-1] += hit; }
      }
    }
  }
  motionPrev = cur;
  if (!n) { return; }
  const raw = changed / n, t = now / 1000, sideRaw = { [-1]: sideCh[-1] / sideN[-1], [1]: sideCh[1] / sideN[1] };
  if (calibState === 'wait') { calibState = 'run'; calibT0 = t; calibSum = 0; calibN = 0; sideCalib = { [-1]: 0, [1]: 0 }; }
  if (calibState === 'run') {
    calibSum += raw; calibN++; sideCalib[-1] += sideRaw[-1]; sideCalib[1] += sideRaw[1]; motionK = 0;
    if (t - calibT0 >= 2) { motionBase = calibSum / calibN; sideBase = { [-1]: sideCalib[-1] / calibN, [1]: sideCalib[1] / calibN }; calibState = 'done'; calibDoneT = t; }
    return;
  }
  motionK = mixN(motionK, Math.min(1, Math.max(0, raw - motionBase * 1.5) * motionGain), 0.35);
  for (const side of [-1, 1]) {
    const s = hands[side], burst = sideRaw[side] - sideBase[side] * 1.5;
    const lost = !s.ok || t - s.seen > 0.12, sideways = s.trail.length > 1 && Math.abs(s.x - s.trail[0].x) > 0.06;
    if (burst > 0.3 && sideRaw[side] > raw * 1.8 && (lost || sideways) && t - s.chopT > 0.6 && t - s.buildT > 0.6 && t - sideChopT[side] > 0.7 && handsActive()) {
      sideChopT[side] = t; s.chopT = t; s.flash = t; sideBuild[side] = null; chopForest(side);
    }
  }
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
  if (backWant && !ending) { return 'Looking back  ·  C to turn round'; }
  const z = distanceWalked; let cleared = false, forest = false;
  for (const ch of chunks.values()) { for (const L of ch.lots) { const d = L.z0 - z; if (L.cutT !== undefined && L.born === undefined && Math.abs(d) < 50) { cleared = true; } if (L.cutT === undefined && L.born === undefined && d > -2 && d < 60) { forest = true; } } }
  if (cleared) { return 'Lift a hand to build:  ✋ homes · ☝ shops · ✊ towers'; }
  if (forest) { return 'Swing a hand sideways to cut that side, or lift it to build'; }
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
