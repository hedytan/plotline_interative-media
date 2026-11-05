/* Plotline — We Build Our World.
 * The street starts as forest: wind, leaves and birds, and nothing built. With your hands (camera,
 * press H) or the keys you cut the forest down beside you and raise buildings on the cleared land,
 * floor by floor: an open hand builds homes, a fist builds towers. The more you build, the more the
 * street turns into a city: traffic instead of birds, music instead of wind. Build enough and the
 * last bird stops singing, and the card counts what it cost.
 */
const START_AGE = 24;
const RENT_WEEK = 380;     // the base weekly rent that town rents are scaled from
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
const SHARE_COL = '#3f9e6a';

let lifeAge = START_AGE, zone = START_ZONE, market = 1, rentWeek = TOWNS[START_ZONE].rent, rentBase = RENT_WEEK;
let turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, queuedTurn = 0, nameBox = null;
let ownedFromC = Infinity, home = null, ending = null, intro = true;
let rules = 1;   // always 1 in this world (the old two-round game is gone)
let owned = [], walkedTotal = 0;
const toasts = [];
// How alive the street is (1 = full of people); nothing empties it in this world.
function streetLife() { return 1; }
const streetMemory = new Map();

const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const COMMUTE = [15, 20, 10, 35, 55, 95];   // minutes to work in the city, by town
function commuteShort(zn) { const m = COMMUTE[zn]; return m < 60 ? `${m} min to work` : `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''} to work`; }
function sayToast(text) { toasts.push({ text, t: clockT }); }
function chunkTier(slot) { const v = townSlot(slot); return typeof v === 'string' ? STYLES_LOT[v].tier : v; }
function rentFor(zn) { return Math.round(TOWNS[zn].rent * rentBase / RENT_WEEK); }

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
  updateTurn(); houseLife(); handUpdate(Math.min(deltaTime / 1000, 0.05));
  const dt = Math.min(deltaTime / 1000, 0.05);
  const devNow = sound && sound.devK ? sound.devK : 0; devBar += (devNow - devBar) * (1 - Math.exp(-dt * 1.5));
  smogK += (Math.min(1, builtCount / 30) - smogK) * (1 - Math.exp(-dt * 0.6));
  if (!lookHint && builtCount >= 6 && !ending) { lookHint = true; sayToast('Press C to look back at what you have done.'); }
  // Time is the walk: standing still, nothing changes.
  const walked = distanceWalked - lastWalkZ; lastWalkZ = distanceWalked;
  if (!paused && !intro && !ending && walked > 0 && walked < 5) { walkedTotal += walked; lifeAge = START_AGE + Math.floor(walkedTotal / 120); }
  for (const ch of chunks.values()) {
    evolveStreet(ch);
    // People carrying their boxes away, and new neighbours walking in.
    for (let i = ch.props.length - 1; i >= 0; i--) {
      const p = ch.props[i];
      if (p.mover) { p.z += 1.25 * dt; p.ph += dt * 4; if (clockT > p.until) { ch.props.splice(i, 1); } }
      else if (p.arrive) { if (p.z > p.tz) { p.z = Math.max(p.tz, p.z - 1.3 * dt); p.ph += dt * 4; } else { p.arrive = false; } }
    }
  }
  if (builtCount >= nextThought) { sayToast(THOUGHTS[Math.floor(nextThought / 10 - 1) % THOUGHTS.length]); nextThought += 10; }
}
// Hooks the sketch calls on GO and Chance squares: nothing happens on them in this world.
function onPassGo() { }
function onChance(kind) { }

/* ---------- The plot beside you ---------- */
function plotHere(z) { return null; }   // no plots for sale: nothing to turn and face
function useHere() { if (intro) { intro = false; } }
function endWalk(kind) {
  if (ending) { return; }
  ending = { kind, t: clockT }; sound.go(); baseNight = 0.25; nightTarget = baseNight;
  backWant = true;   // turn round and see the street you made, then the card
}
function resetLife() {
  streetMemory.clear(); nameBox = null; sideSt = null; queuedTurn = 0; turnAnim = null; turnYaw = 0;
  lifeAge = START_AGE; zone = START_ZONE; market = 1; rentBase = RENT_WEEK; rentWeek = rentFor(START_ZONE); home = null; ending = null;
  owned = []; walkedTotal = 0; smogK = 0; lookHint = false; backWant = false; backT = 0; treesCut = 0; builtCount = 0; homesBuilt = 0; towersBuilt = 0; shopsBuilt = 0; nextThought = 10;
  baseNight = 0; nightTarget = 0; ownedFromC = Infinity; intro = true; toasts.length = 0;
  chunks.clear(); firedCasinos.clear(); visitedJails.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
}
function restartWalk() { seed += 97; resetLife(); }

/* ---------- Side streets ---------- */
// The sketch draws a side street when one exists. In this world you never turn (← / → chop), so
// sideSt stays null and these return early; they are kept because the sketch calls them.
let sideSt = null;   // the side street: { chunks, zone, dir, zc (its crossing in this street), s0 (that crossing in its own street), c }
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

/* ---------- Drawing on the street ---------- */
function drawForSale(L) { }
function drawTurnSign(q, p) { }
function drawOpenHome(q, p) { }
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
// Hooks the sketch calls for game pieces and kerbside things: none in this world.
function pieceSink(L) { return 1; }
function drawBoardSquare(L) { }
function drawToyPiece(L) { }


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
function moodN() { return owned.length === 0 ? 'renter' : owned.length < 3 ? 'wary' : 'cold'; }
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
// A light grey wash over the street (streetLife() is always 1 here).
function drawStreetLife() {
  const a = 0.3 + (1 - streetLife()) * 0.8;
  ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = a; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, width, height); ctx.restore();
}
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
function drawYours(L) { }

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
  textAlign(CENTER, CENTER); textStyle(ITALIC); textSize(12); fill(110, 120, 105); text('Press H for the camera: walk or run on the spot to move.   C: look back.', cx, y + 268); text('F when you are finished.   No camera: Z / X cut, hold B homes · V shops · N towers.', cx, y + 286);
  textStyle(BOLD); textSize(16); fill(col); drawingContext.globalAlpha = 0.55 + 0.45 * pulse; text('Click or press E to start', cx, y + h - 26); drawingContext.globalAlpha = 1;
  pop();
}
let lastWalkZ = 0;   // distance at the last frame: time passes only as you walk
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


function drawJunk(q, p) { }


/* ---------- Your hands: chop the forest, raise the city (webcam + ml5 handPose) ---------- */
// Press H to use the camera. The hand moves are decided so each one carries the meaning:
//   swipe left / right  -> chop the forest on that side (as many times as you like)
//   open hand, lift up   -> build homes on the cleared land, floor by floor
//   fist, lift up        -> build luxury towers for investors (they stay empty: 0 AFFORDABLE)
// Only lifting builds; a hand held still does nothing, so you chop first and build after.
// Without a camera: ← / → chop... (X chops the right, Z the left), hold B for homes, N for towers.
let treesCut = 0, builtCount = 0, homesBuilt = 0, towersBuilt = 0, shopsBuilt = 0;
let nextThought = 10;
const THOUGHTS = ['Every city was a forest once.', 'Listen. Fewer birds now.', 'We build our world the way we want it.', 'Nobody asks the forest.', 'How much is enough?'];
let handMode = false, handVideo = null, handModel = null, handStatus = '', chopHintT = -9, buildHintT = -9;
// Two hands, one for each side of the street. In the mirrored picture your left hand is on the left.
const newHand = () => ({ ok: false, x: 0.5, y: 0.6, fist: false, t: 0, seen: -9, chopT: -9, trail: [], lift: 0 });
const hands = { [-1]: newHand(), [1]: newHand() };
function startHands() {
  if (handMode) { handMode = false; handStatus = ''; return; }
  handMode = true; handStatus = 'Starting the camera…'; calibState = 'wait'; motionBase = 0; motionPrev = null;
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
  spawnBirds(L, side); if (L2) { spawnBirds(L2, side); }
  if (sound.chop) { sound.chop(side); } if (sound.flutter) { sound.flutter(side); }
  if (clockT - chopHintT > 10) { chopHintT = clockT; sayToast('The forest is gone. Lift an open hand for homes, a fist for towers.'); }
}
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
  if (kind === 'tower' && tier === 4) { Object.assign(L, { H: mixN(45, 95, r()), vacant: true, sign: true, formerName: 'FOREST', name: VOID_NAMES[Math.abs(L.seed) % VOID_NAMES.length] }); }
}
function handUpdate(dt) {
  const now = performance.now() / 1000; sampleMotion();
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
  const w = 230, h = 150, x = width - w - 16, y = height - h - 16;
  push(); noStroke(); fill(0, 140); rect(x - 4, y - 50, w + 8, h + 54, 8);
  if (handVideo && handVideo.elt && handVideo.elt.readyState >= 2) { drawingContext.save(); drawingContext.translate(x + w, y); drawingContext.scale(-1, 1); drawingContext.globalAlpha = 0.85; drawingContext.drawImage(handVideo.elt, 0, 0, w, h); drawingContext.restore(); }
  else { fill(40); rect(x, y, w, h, 4); }
  stroke(255, 255, 255, 50); strokeWeight(1); line(x + w / 2, y, x + w / 2, y + h); noStroke();
  // Your steps: how much your body is moving, and what the street does with it.
  const sp = bodySpeed(), mode = sp <= 0 ? 'standing' : sp < WALK_SPD * 1.05 ? 'walking' : 'running';
  fill(0, 120); rect(x, y + h - 16, w, 16); fill(mode === 'running' ? '#e0302a' : mode === 'walking' ? '#ffd23f' : '#888'); rect(x, y + h - 16, w * Math.min(1, motionK / 0.4), 16);
  fill(255); textSize(10); textStyle(BOLD); textAlign(LEFT, CENTER); text(`STEPS · ${mode}`, x + 6, y + h - 8);
  for (const side of [-1, 1]) {
    const s = hands[side]; if (!s.ok) { continue; }
    const col = side < 0 ? color(90, 200, 255) : color(255, 210, 60);
    stroke(col); strokeWeight(3); noFill(); beginShape(); for (const p of s.trail) { vertex(x + p.x * w, y + p.y * h); } endShape(); noStroke();
    fill(s.fist ? color(224, 48, 42) : col); circle(x + s.x * w, y + s.y * h, 16); fill(255); textSize(10); textAlign(CENTER, CENTER); text((side < 0 ? 'L ' : 'R ') + (s.shape === 'fist' ? '✊' : s.shape === 'point' ? '☝' : '✋'), x + s.x * w, y + s.y * h - 16);
  }
  const s = { ok: hands[-1].ok || hands[1].ok };
  fill(255); textFont('Georgia'); textStyle(BOLD); textSize(10); textAlign(LEFT, TOP);
  textSize(10); text(s.ok || !handStatus ? 'Swing L / R hand: cut that side\nLift ✋ homes · ☝ shops · ✊ towers\nStep or run on the spot to move' : handStatus, x, y - 46, w + 4);
  // Calibration message over the picture.
  const tNow = performance.now() / 1000, calibMsg = calibState === 'run' ? `Stand still for 2 seconds… ${Math.max(0, 2 - (tNow - calibT0)).toFixed(1)}` : calibState === 'done' && tNow - calibDoneT < 1.8 ? 'Calibrated ✓' : '';
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
  if (backWant && !ending) { return 'Looking back  ·  C to turn round'; }
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
// Birds that flee the forest when you chop it: they burst out of the cut lots and fly up and away.
const birds = [], BIRD_MAX = 40;
function spawnBirds(L, side) {
  const n = 6 + Math.floor(Math.random() * 7);
  for (let i = 0; i < n && birds.length < BIRD_MAX; i++) {
    birds.push({ x: side * (EDGE_X + 2 + Math.random() * 8), y: 3 + Math.random() * 4, z: mixN(L.z0, L.z1, Math.random()),
      vx: side * (2 + Math.random() * 3), vy: 2.5 + Math.random() * 2.5, vz: -1 + Math.random() * 5, t0: clockT + Math.random() * 0.25, ph: Math.random() * 6.28 });
  }
}
function drawTargetMarker() {
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

function rememberStreet(ch) {
  ch.zoneId = zone;
  ch.lots.forEach((L, i) => {
    L.memoryKey = zone + ':' + ch.slot + ':' + i;
    L.formerName = L.name || 'NEIGHBOURHOOD HOMES';
    L.redevelopYear = L.seed % 3 === 0 ? Infinity : START_AGE + 2 + (Math.abs(L.seed) % 5);
    const saved = streetMemory.get(L.memoryKey);
    if (saved) { Object.assign(L, saved); }
  });
  // Ordinary residents, rather than only open-home queues, make the loss visible.
  const rr = rngN(seed + ch.slot * 83 + zone * 761);
  for (let i = 0; i < 12; i++) { ch.props.push({ kind: 'person', x: (i % 2 ? 1 : -1) * (EDGE_X - 0.8), z: ch.z0 + CROSS_W + 2 + rr() * (CHUNK_LEN - CROSS_W - 4), tone: rr(), h: 1.55 + rr() * 0.3, ph: rr() * 6, residentRank: (i + 1) / 13 }); }
  ch.props.filter(p => p.kind === 'person').forEach((p, i) => { if (p.residentRank === undefined) { p.residentRank = (i % 12 + 1) / 13; } });
  evolveStreet(ch);
}
// Nothing is redeveloped on its own here: only your hands change the street.
function evolveStreet(ch) { ch.residentShare = 1; }
