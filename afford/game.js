/* Plotline: The House at the End of the Street.
 * You're 24 and renting. At the end of the street there is a little house with its light on: a
 * first home. Walk toward it and it moves away, because every block you walk is half a year, and
 * prices rise faster than you can save. The buildings shout at you in paint: "1 BED $950/WK",
 * "82% SOLD TO INVESTORS". Click any building to see who lives there: often nobody.
 * Turn left at a corner to move further out, where homes are cheaper and the commute is longer.
 * Far enough out, the house stops running away. The walk ends when you reach it, or at 35.
 * Plugs into sketch.js through the same hooks board.js used.
 */
const START_AGE = 24, END_AGE = 35, YEARS_PER_BLOCK = 0.5, START_SAVINGS = 22000, SAVE_PER_BLOCK = 7000, RENT_START = 480, GROWTH = 0.035, DEPOSIT = 0.1, DREAM_D = 110;
const ZONES = [
  { name: 'Inner city', price: 1250000, commute: 15 },
  { name: 'Inner ring', price: 980000, commute: 35 },
  { name: 'Middle ring', price: 760000, commute: 60 },
  { name: 'Outer suburbs', price: 590000, commute: 95 },
  { name: 'New estates', price: 460000, commute: 130 }
];
const SLOGANS = {
  0: ['RENT +12% FROM MONDAY', 'ROOM $420/WK · SHARED BATH', 'NO PETS · NO KIDS · NO LEASE', 'APPLY NOW · 60 APPLICANTS'],
  1: ['2 BED · $780/WK', '57 PEOPLE AT THE OPEN HOME', 'YOUR RENT PAYS MY MORTGAGE', 'OFFERS ABOVE $1.3M'],
  2: ['SOLD · ABOVE RESERVE', 'PRIVATE. GATED. YOURS?', 'SECOND HOME · SEA VIEWS', 'BUY BEFORE IT’S GONE'],
  3: ['INVEST NOW · 7% YIELD', 'NEGATIVELY GEARED, POSITIVELY GREAT', 'CAPITAL GROWTH STARTS HERE', 'WHY RENT WHEN YOU CAN LET?'],
  4: ['LUXURY LIVING FROM $2.4M', '82% SOLD TO INVESTORS', 'LIVE ABOVE IT ALL', 'YOUR FUTURE. OUR YIELD.'],
  out: ['ONLY 90 MIN TO THE CITY!', 'AFFORDABLE* (*2H COMMUTE)', 'NEW ESTATE · NO TRAIN YET', 'ROOM TO GROW (NOTHING ELSE)', 'SCHOOLS COMING 2035']
};
const BANDS = [['#c0392b', '#ffffff'], ['#1f2a44', '#f4d58d'], ['#f4d58d', '#2a2440'], ['#ffffff', '#c0392b'], ['#2f6d5a', '#ffffff']];

// Hooks sketch.js expects.
let plotTarget = null, turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, nameBox = null, ending = false, intro = true, ownedFromC = Infinity;
const HIDE_DISTRICT_CARD = true;
// The game.
let zone = 0, walkedM = 0, savings = START_SAVINGS, rentPaid = 0, emptyFound = 0, peopleMet = 0, queuedTurn = 0, dreamZ = null, affordable = false;
let opening = { t0: null, built: false, sparkle: false, done: false }, ui = {}, hover = null, mouseXY = [0, 0];
const texCache = new Map();

const blocks = () => walkedM / CHUNK_LEN;
const ageNow = () => START_AGE + blocks() * YEARS_PER_BLOCK;
const growth = () => Math.pow(1 + GROWTH, blocks());
const priceNow = () => Math.round(ZONES[zone].price * growth() / 1000) * 1000;
const depositNow = () => Math.round(priceNow() * DEPOSIT);
const rentNow = () => Math.round(RENT_START * Math.pow(1.03, blocks()));
const money = v => '$' + (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.round(v / 1000) + 'k');
const commuteText = m => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`);

function chunkTier(slot) { return Math.max(0, TIER_OF[slot] - zone); }
function soundTier() { const ch = chunks.get(Math.floor(distanceWalked / CHUNK_LEN)); return ch ? ch.tier : 0; }
function canRise() { return opening.built; }
function onPassGo() {} function onChance() {}
function drawForSale() {} function drawTargetMarker() {} function drawOwnedLot() {} function isCustomLot() { return false; }
function drawBillboard() {}
function landmarkScale() { return 1 / (1 + zone * 0.45); }

/* ---------- every block: slogans, who lives where, people sleeping rough ---------- */
function plotsForChunk(ch, r) {
  // Further out the street thins into paddocks.
  if (zone >= 2) { ch.lots = ch.lots.filter(() => r() > (zone - 1) * 0.18); }
  for (const L of ch.lots) {
    const t = L.tier, x = r();
    L.occ = t >= 3 ? (x < 0.55 ? 'empty' : x < 0.75 ? 'shortstay' : 'renters') : t === 2 ? (x < 0.45 ? 'second' : 'owners') : (x < 0.12 ? 'empty' : 'renters');
    L.people = 2 + Math.floor(r() * 5); L.rentWk = Math.round(([420, 780, 1500, 950, 1100][t] * (0.85 + r() * 0.3) * (1 - zone * 0.12)) / 10) * 10;
    if (r() < 0.6) { L.slogan = pickN(r, zone >= 2 && r() < 0.6 ? SLOGANS.out : SLOGANS[t]); L.band = pickN(r, BANDS); }
  }
  // Someone sleeping in a doorway under the expensive buildings.
  for (const L of ch.lots) { if (L.tier >= 3 && r() < 0.45) { ch.props.push({ kind: 'openhome', sleeper: true, x: L.side * (EDGE_X - 0.6), z: mixN(L.z0 + 1, L.z1 - 1, r()), tone: r() }); } }
}

/* ---------- the opening: a crane shot down onto a street that builds itself ---------- */
function introCam() {
  if (opening.done || opening.t0 === null) { return opening.t0 === null ? { lift: 42, tilt: 0.55 } : { lift: 0, tilt: 0 }; }
  const t = (performance.now() - opening.t0) / 1000, u = easeN((t - 1.6) / 4.2);
  return { lift: 42 * (1 - u), tilt: 0.55 * (1 - u) };
}
function runOpening() {
  const t = opening.t0 === null ? 0 : (performance.now() - opening.t0) / 1000;
  if (opening.t0 === null) { opening.t0 = performance.now(); return; }
  if (!opening.built && t > 1.7) { opening.built = true; streetT = clockT; ui.black.classList.add('gone'); }
  if (!opening.sparkle && t > 5.0) { opening.sparkle = true; sound.go(); }
  if (!opening.done && t > 6.0) { opening.done = true; ui.intro.classList.add('show'); }
}
function skipOpening() { if (!opening.t0) { return; } opening.t0 = performance.now() - 6100; opening.built = true; ui.black.classList.add('gone'); }

/* ---------- each frame ---------- */
function boardUpdate(z) {
  if (!ui.panel) { buildUI(); }
  runOpening();
  const dt = Math.min(deltaTime / 1000, 0.05);
  if (!intro && !ending) {
    const step = Math.max(0, stepSpeed * dt), before = Math.floor(blocks());
    walkedM += step; savings += SAVE_PER_BLOCK * step / CHUNK_LEN; rentPaid += rentNow() * 26 * step / CHUNK_LEN;
    if (Math.floor(blocks()) !== before) { if (Math.floor(blocks()) % 2 === 0) { toast(`You’re ${Math.floor(ageNow())}. Rent is now $${rentNow()} a week.`); } }
    if (!affordable && savings >= depositNow()) { affordable = true; dreamZ = z + DREAM_D; sound.go(); toast('You can finally afford the deposit. Walk to it.'); }
    if (affordable && dreamZ !== null && dreamZ - z < 9) { showEnding(true); }
    else if (ageNow() >= END_AGE) { showEnding(false); }
  }
  if (queuedTurn && atCrossing(z)) { const d = queuedTurn; queuedTurn = 0; tryTurn(d); }
  updateTurnAnim();
  for (const ch of chunks.values()) { for (const p of ch.props) { if (p.kind === 'person' && p.v) { p.z += p.v * dt; if (p.z > p.z1 || p.z < p.z0) { p.v = -p.v; } } } }
  hover = pickBuilding(mouseXY[0], mouseXY[1]);
  canvasNode.style.cursor = hover && !intro && !ending ? 'pointer' : 'default';
  if (frameCount % 6 === 0) { updateHud(); }
}

/* ---------- turning at a corner: left = further out ---------- */
function nextCrossing(z) { const local = modN(z, CHUNK_LEN); return local < CROSS_W - 1 ? 0 : CHUNK_LEN - local + 2; }
function atCrossing(z) { const local = modN(z, CHUNK_LEN); return local > 0.5 && local < CROSS_W - 0.5; }
function tryTurn(dir) {
  if (turnAnim || intro || ending) { return; }
  if (dir < 0 && zone >= ZONES.length - 1) { toast('This is as far out as the city goes.'); return; }
  if (dir > 0 && zone === 0) { toast('You’re already in the inner city.'); return; }
  if (!atCrossing(distanceWalked)) {
    const ahead = nextCrossing(distanceWalked);
    if (ahead < 30) { queuedTurn = dir; toast(`Turning ${dir < 0 ? 'left, further out,' : 'right, back toward the city,'} at the next corner.`); } else { toast(`The next corner is ${Math.round(ahead)} m ahead.`); }
    return;
  }
  queuedTurn = 0; turnAnim = { dir, t: clockT }; sound.turn(dir);
}
function updateTurn() {} // the sketch calls this; the animation runs from boardUpdate
function updateTurnAnim() {
  if (!turnAnim) { turnYaw = 0; fadeA = Math.max(0, fadeA - 0.05); return; }
  const u = (clockT - turnAnim.t) / 0.85;
  turnYaw = turnAnim.dir * HALF_PI * easeN(Math.min(1, u)); fadeA = easeN((u - 0.45) / 0.55);
  if (u >= 1) {
    const dir = turnAnim.dir; turnAnim = null; turnYaw = 0; fadeA = 1;
    zone = constrain(zone - dir, 0, ZONES.length - 1);
    const c = Math.floor(distanceWalked / CHUNK_LEN);
    seed += 131; chunks.clear(); distanceWalked = c * CHUNK_LEN + 3; lastChunk = c; lastTier = -1; stepSpeed = 0; streetT = clockT; buildSkyline();
    if (affordable) { dreamZ = distanceWalked + DREAM_D; }
    if (!affordable && savings >= depositNow()) { affordable = true; dreamZ = distanceWalked + DREAM_D; toast(`${ZONES[zone].name}: you can afford a deposit here. Walk to it.`); sound.go(); }
    else { toast(`${ZONES[zone].name}. Homes from ${money(priceNow())}. Commute ${commuteText(ZONES[zone].commute)}.`); }
  }
}

/* ---------- clicking buildings: who lives here? ---------- */
// Called right after each building is drawn: remember its street facade, and paint its slogan.
function afterLot(L) {
  const H = L.H * L.econNow, x = L.side * (EDGE_X + L.setback), z0 = clipZ(L.z0);
  L.hit = null; if (L.z1 <= z0 + 0.5) { return; }
  const a = P(x, 0, z0), b = P(x, 0, L.z1), c = P(x, H, L.z1), d = P(x, H, z0);
  if (a.rz < 1 || b.rz < 1 || a.rz > 120) { return; }
  L.hit = { q: [a, b, c, d], rz: a.rz, f: frameCount };
  if (L.slogan) { paintOnFacade(L, x, z0, sloganTex(L.slogan, L.band), H * (L.tier === 0 ? 0.55 : 0.6), H * (L.tier === 0 ? 0.92 : 0.82), 0.35); }
  if (L.revealed && (L.occ === 'empty' || L.occ === 'second')) { paintOnFacade(L, x, z0, stampTex(), H * 0.12, H * 0.4, 1.2); }
}
// Map a texture onto part of the street facade (two affine triangles).
function paintOnFacade(L, x, z0, tex, y0, y1, inset) {
  const za = Math.max(z0, L.z0 + inset), zb = L.z1 - inset; if (zb - za < 1.5) { return; }
  const pa = P(x, y0, za), pb = P(x, y0, zb); if (pa.rz < 1 || pb.rz < 1) { return; }
  const [zl, zr] = pa.x < pb.x ? [za, zb] : [zb, za];
  const tl = P(x, y1, zl), tr = P(x, y1, zr), br = P(x, y0, zr), bl = P(x, y0, zl), img = tex.elt || tex.canvas, w = tex.width, h = tex.height;
  ctx.save(); ctx.globalAlpha = 1 - fogFor((za + zb) / 2) * 0.85;
  imageTri(img, tl.x, tl.y, tr.x, tr.y, br.x, br.y, 0, 0, w, 0, w, h);
  imageTri(img, tl.x, tl.y, br.x, br.y, bl.x, bl.y, 0, 0, w, h, 0, h);
  ctx.restore();
}
function imageTri(img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
  const d = u0 * v1 + v0 * u2 + u1 * v2 - v1 * u2 - v0 * u1 - u0 * v2; if (Math.abs(d) < 1e-9) { return; }
  ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.clip();
  const a = (x0 * v1 + v0 * x2 + x1 * v2 - v1 * x2 - v0 * x1 - x0 * v2) / d, b = (u0 * x1 + x0 * u2 + u1 * x2 - x1 * u2 - x0 * u1 - u0 * x2) / d;
  const c = (u0 * v1 * x2 + v0 * x1 * u2 + x0 * u1 * v2 - x0 * v1 * u2 - v0 * u1 * x2 - u0 * x1 * v2) / d;
  const e = (y0 * v1 + v0 * y2 + y1 * v2 - v1 * y2 - v0 * y1 - y0 * v2) / d, f = (u0 * y1 + y0 * u2 + u1 * y2 - y1 * u2 - y0 * u1 - u0 * y2) / d;
  const h = (u0 * v1 * y2 + v0 * y1 * u2 + y0 * u1 * v2 - y0 * v1 * u2 - v0 * u1 * y2 - u0 * y1 * v2) / d;
  ctx.transform(a, e, b, f, c, h); ctx.drawImage(img, 0, 0); ctx.restore();
}
function sloganTex(text, band) {
  const key = text + band[0]; if (texCache.has(key)) { return texCache.get(key); }
  const g = createGraphics(640, 160); g.pixelDensity(1); g.clear(); g.noStroke();
  g.fill(band[0]); g.rect(0, 10, 640, 140, 6); g.fill(band[1]); g.rect(0, 10, 640, 6); g.rect(0, 144, 640, 6);
  g.textFont('Anton'); g.textAlign(CENTER, CENTER); g.fill(band[1]);
  let s = 96; g.textSize(s); while (g.textWidth(text) > 600 && s > 30) { s -= 3; g.textSize(s); }
  g.text(text, 320, 84); texCache.set(key, g); return g;
}
function stampTex() {
  if (texCache.has('stamp')) { return texCache.get('stamp'); }
  const g = createGraphics(400, 160); g.pixelDensity(1); g.clear(); g.translate(200, 80); g.rotate(-0.08);
  g.noFill(); g.stroke('#e0283c'); g.strokeWeight(10); g.rect(-180, -60, 360, 120, 10);
  g.noStroke(); g.fill('#e0283c'); g.textFont('Anton'); g.textAlign(CENTER, CENTER); g.textSize(84); g.text('EMPTY', 0, 6);
  texCache.set('stamp', g); return g;
}
function pickBuilding(x, y) {
  if (intro || ending) { return null; }
  let best = null;
  for (const ch of chunks.values()) {
    for (const p of ch.props) { if (p.sleeper && p.hit && p.hit.f >= frameCount - 2 && Math.hypot(x - p.hit.x, y - p.hit.y) < p.hit.r && (!best || p.hit.rz < best.rz)) { best = { sleeper: p, rz: p.hit.rz }; } }
    for (const L of ch.lots) {
      if (!L.hit || L.hit.f < frameCount - 2) { continue; }
      const q = L.hit.q; let inside = true, sign = 0;
      for (let i = 0; i < 4; i++) { const A = q[i], B = q[(i + 1) % 4], cr = (B.x - A.x) * (y - A.y) - (B.y - A.y) * (x - A.x); if (cr !== 0) { if (sign === 0) { sign = Math.sign(cr); } else if (Math.sign(cr) !== sign) { inside = false; break; } } }
      if (inside && (!best || L.hit.rz < best.rz)) { best = { L, rz: L.hit.rz }; }
    }
  }
  return best;
}
function whoLivesHere(L) {
  const r = rngN(L.seed + 11), rent = L.rentWk;
  if (L.occ === 'empty') { return { head: 'Nobody lives here.', body: pickN(r, ['Bought off the plan by an investor. The lights have never been on.', 'Owned by a fund overseas. Waiting for the price to go up.', 'Empty for two years. Worth more empty than rented.']), empty: true }; }
  if (L.occ === 'second') { return { head: 'Nobody lives here (most of the year).', body: 'A second home. Used three weeks a year.', empty: true }; }
  if (L.occ === 'shortstay') { return { head: 'A holiday let.', body: `$${Math.round(rent * 0.5)} a night. Nobody stays longer than a week.`, empty: false }; }
  if (L.occ === 'owners') { return { head: 'A couple who bought in 1998.', body: `They paid $310k. It’s worth ${money(ZONES[zone].price * 2.6 * growth())} now.`, empty: false }; }
  const n = L.people;
  return { head: `${n} people live here.`, body: pickN(r, [`They share ${Math.max(1, n - 2)} bedrooms. $${rent * Math.max(1, n - 1)} a week between them.`, `Rent $${rent} a week. It went up ${8 + Math.floor(r() * 10)}% this year.`, `A family of ${n}. Rent takes ${44 + Math.floor(r() * 16)}% of their pay.`]), empty: false };
}
function clickBuilding(hit) {
  if (hit.sleeper) {
    const p = hit.sleeper; if (!p.met) { p.met = true; peopleMet++; }
    bubble('Sleeping here tonight.', `A few metres from ${30 + Math.floor(p.tone * 200)} empty flats.`, false); sound.door(); return;
  }
  const L = hit.L, info = whoLivesHere(L);
  if (!L.revealed) { L.revealed = true; if (info.empty) { emptyFound++; } }
  bubble(info.head, info.body, info.empty);
  if (info.empty) { sound.cash(false); } else { sound.door(); }
}

/* ---------- the house at the end of the street ---------- */
function drawDreamHouse(z) {
  if (turnAnim) { return; }
  const t = opening.t0 === null ? 0 : (performance.now() - opening.t0) / 1000, appear = easeN((t - 4.6) / 1.0);
  if (appear <= 0) { return; }
  const zz = affordable && dreamZ !== null ? dreamZ : z + DREAM_D, base = P(0, 0, zz); if (base.rz < 2) { return; }
  const k = base.k * 1.5 * (0.6 + 0.4 * appear), pulse = 0.5 + 0.5 * Math.sin(clockT * 2.4);
  ctx.save(); ctx.globalAlpha = appear;
  // Glow.
  const gr = ctx.createRadialGradient(base.x, base.y - 3 * k, 0, base.x, base.y - 3 * k, 12 * k);
  gr.addColorStop(0, `rgba(255,230,150,${0.55 + 0.2 * pulse})`); gr.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = gr; ctx.fillRect(base.x - 12 * k, base.y - 15 * k, 24 * k, 24 * k);
  // Little lawn, house, roof, door and a warm window.
  ctx.fillStyle = '#9fd98a'; ctx.beginPath(); ctx.ellipse(base.x, base.y, 6 * k, 1 * k, 0, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = '#fff3e0'; ctx.fillRect(base.x - 3 * k, base.y - 4 * k, 6 * k, 4 * k);
  ctx.fillStyle = '#e8606a'; ctx.beginPath(); ctx.moveTo(base.x - 3.6 * k, base.y - 4 * k); ctx.lineTo(base.x, base.y - 6.6 * k); ctx.lineTo(base.x + 3.6 * k, base.y - 4 * k); ctx.fill();
  ctx.fillStyle = '#6b4a5a'; ctx.fillRect(base.x - 0.6 * k, base.y - 2.2 * k, 1.2 * k, 2.2 * k);
  ctx.fillStyle = `rgb(255,${210 + 30 * pulse},120)`; ctx.fillRect(base.x + 1.2 * k, base.y - 3.2 * k, 1.2 * k, 1.1 * k); ctx.fillRect(base.x - 2.4 * k, base.y - 3.2 * k, 1.2 * k, 1.1 * k);
  ctx.fillStyle = '#fff3e0'; ctx.fillRect(base.x + 1.75 * k, base.y - 3.2 * k, 0.1 * k, 1.1 * k); ctx.fillRect(base.x - 1.85 * k, base.y - 3.2 * k, 0.1 * k, 1.1 * k);
  // Price tag on a stake.
  const tagY = base.y - 9.2 * k, tw = Math.max(9 * k, 190), th = Math.max(2.2 * k, 24);
  ctx.fillStyle = '#3d3553'; ctx.fillRect(base.x - 0.08 * k, tagY + th / 2, 0.16 * k, 2.6 * k);
  ctx.fillStyle = affordable ? '#2fd3a0' : '#fffaf2'; ctx.strokeStyle = '#3d3553'; ctx.lineWidth = Math.max(1, 0.12 * k);
  ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(base.x - tw / 2, tagY - th / 2, tw, th, 0.4 * k); } else { ctx.rect(base.x - tw / 2, tagY - th / 2, tw, th); } ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3d3553'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.max(12, 0.8 * k)}px Nunito, sans-serif`; ctx.fillText(affordable ? 'YOURS · WALK TO IT' : `YOUR FIRST HOME · ${money(priceNow())}`, base.x, tagY);
  // Sparkles during the opening.
  if (t < 7.5) { for (let i = 0; i < 10; i++) { const a = i / 10 * TWO_PI + t, rr = (6 + 3 * Math.sin(t * 3 + i)) * k; ctx.fillStyle = `rgba(255,250,220,${appear * (0.5 + 0.5 * Math.sin(t * 6 + i))})`; ctx.beginPath(); ctx.arc(base.x + Math.cos(a) * rr, base.y - 4 * k + Math.sin(a) * rr * 0.6, 0.25 * k, 0, TWO_PI); ctx.fill(); } }
  ctx.restore();
}

/* ---------- people on the street ---------- */
function drawPerson(q, p) {
  const k = q.k; if (k < 1.2) { return; }
  const h = p.h, bob = Math.abs(Math.sin(clockT * 6 + p.ph)) * 0.05 * k * (p.v ? 1 : 0);
  const coats = ['#ff7aa2', '#5fb3ff', '#ffb347', '#6cc58a', '#b48cff', '#ffd84d', '#ff8f6b'], skin = ['#f5d0b5', '#d9a07a', '#a8704a', '#ffe0c8'];
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.7;
  ctx.fillStyle = '#4a4a6a'; ctx.fillRect(q.x - 0.13 * k, q.y - 0.55 * h / 1.7 * k - bob, 0.1 * k, 0.55 * h / 1.7 * k); ctx.fillRect(q.x + 0.03 * k, q.y - 0.55 * h / 1.7 * k - bob, 0.1 * k, 0.55 * h / 1.7 * k);
  ctx.fillStyle = coats[Math.floor(p.tone * coats.length)];
  const bt = q.y - h * 0.82 * k - bob, bh = h * 0.5 * k;
  ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(q.x - 0.26 * k, bt, 0.52 * k, bh, 0.22 * k); } else { ctx.rect(q.x - 0.26 * k, bt, 0.52 * k, bh); } ctx.fill();
  ctx.fillStyle = skin[Math.floor(p.tone * 9) % skin.length]; ctx.beginPath(); ctx.arc(q.x, bt - 0.16 * k, 0.2 * k, 0, TWO_PI); ctx.fill();
  ctx.restore();
}
// Someone sleeping rough in a doorway: a sleeping bag, a head, a cardboard sign.
function drawOpenHome(q, p) {
  if (!p.sleeper) { return; }
  const k = q.k; if (k < 1) { p.hit = null; return; }
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = '#c9a77a'; ctx.fillRect(q.x - 0.9 * k, q.y - 0.08 * k, 1.8 * k, 0.08 * k);
  ctx.fillStyle = ['#4f6fa8', '#6a8f5a', '#8a5a7a'][Math.floor(p.tone * 3)];
  ctx.beginPath(); ctx.ellipse(q.x, q.y - 0.28 * k, 0.85 * k, 0.24 * k, 0, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = ['#f5d0b5', '#d9a07a', '#a8704a'][Math.floor(p.tone * 7) % 3]; ctx.beginPath(); ctx.arc(q.x + 0.85 * k, q.y - 0.32 * k, 0.17 * k, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = '#d8b884'; ctx.fillRect(q.x - 0.4 * k, q.y - 1.0 * k, 0.7 * k, 0.45 * k);
  ctx.restore();
  p.hit = { x: q.x, y: q.y - 0.4 * k, r: Math.max(14, 1.1 * k), rz: q.rz || 50, f: frameCount };
}

/* ---------- HUD (HTML) ---------- */
function drawBoardHud() { if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,248,240,${fadeA})`; ctx.fillRect(0, 0, width, height); } }
function buildUI() {
  const css = document.createElement('style');
  css.textContent = `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Nunito:wght@500;700;800&display=swap');
  .pl{position:fixed;font-family:Nunito,system-ui,sans-serif;color:#3d3553;z-index:5;user-select:none}
  .pl-panel{top:16px;left:16px;background:#fffaf2;border-radius:18px;padding:14px 18px;box-shadow:0 6px 0 rgba(61,53,83,.15);width:250px;border:2px solid #3d3553;transition:opacity .6s}
  .pl-panel h4{margin:0 0 6px;font:800 11px Nunito;letter-spacing:.14em;color:#9a86b8}
  .pl-row{display:flex;justify-content:space-between;font-weight:700;font-size:14px;margin:3px 0}
  .pl-age{font:800 30px Fraunces,Georgia,serif;line-height:1}
  .pl-bar{height:10px;background:#eee6f5;border-radius:6px;overflow:hidden;margin:4px 0 2px}.pl-bar i{display:block;height:100%;border-radius:6px;background:#ff8fb3;transition:width .3s}
  .pl-small{font-size:11px;color:#8a7a9a;font-weight:700}
  .pl-right{top:16px;right:16px;background:#fffaf2;border-radius:18px;padding:12px 16px;border:2px solid #3d3553;box-shadow:0 6px 0 rgba(61,53,83,.15);text-align:right;transition:opacity .6s}
  .pl-right b{font:400 30px Anton,Impact,sans-serif;color:#e0283c;display:block;line-height:1.1}
  .pl-help{left:50%;transform:translateX(-50%);bottom:14px;font-size:12px;font-weight:700;color:#5d5277;background:rgba(255,250,242,.85);padding:6px 14px;border-radius:20px;white-space:nowrap;transition:opacity .6s}
  .pl-hide{opacity:0;pointer-events:none}
  .pl-toast{left:50%;transform:translateX(-50%);bottom:56px;font:700 16px Nunito;background:#3d3553;color:#fffaf2;padding:9px 18px;border-radius:30px;opacity:0;transition:opacity .4s;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
  .pl-bubble{max-width:280px;background:#fffaf2;border:2px solid #3d3553;border-radius:16px;padding:10px 14px;box-shadow:0 5px 0 #3d3553;pointer-events:none;opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s}
  .pl-bubble.show{opacity:1;transform:none}.pl-bubble b{display:block;font:800 16px Fraunces,Georgia,serif}.pl-bubble.empty b{color:#e0283c}.pl-bubble span{font-size:13px}
  .pl-black{inset:0;background:#1d1830;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20;transition:opacity 1.1s;color:#fffaf2}
  .pl-black.gone{opacity:0;pointer-events:none}
  .pl-black h1{font:800 64px Fraunces,Georgia,serif;letter-spacing:.3em;margin:0;animation:plIn 1.4s ease-out both}
  .pl-black p{font:600 18px Nunito;opacity:.8;margin:10px 0 0;animation:plIn 1.4s .5s ease-out both}
  @keyframes plIn{from{opacity:0;letter-spacing:.6em;filter:blur(6px)}to{opacity:1;filter:none}}
  .pl-over{inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6vh;opacity:0;pointer-events:none;transition:opacity .6s;z-index:9}
  .pl-over.show{opacity:1;pointer-events:auto}.pl-over.mid{align-items:center;padding:0;background:rgba(29,24,48,.45)}
  .pl-sheet{background:#fffaf2;border:2px solid #3d3553;border-radius:22px;box-shadow:0 8px 0 #3d3553;padding:22px 28px;max-width:600px;width:calc(100vw - 48px);text-align:center;max-height:90vh;overflow:auto;animation:plUp .7s ease-out both}
  @keyframes plUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
  .pl-sheet h1{font:800 32px Fraunces,Georgia,serif;margin:0 0 6px}.pl-sheet h2{font:800 12px Nunito;color:#9a86b8;margin:0 0 10px;letter-spacing:.16em}
  .pl-sheet p{font-size:16px;line-height:1.5;margin:6px 0}.pl-sheet button{margin-top:12px;font:800 16px Nunito;background:#ff6fa0;color:#fff;border:2px solid #3d3553;border-radius:30px;padding:10px 22px;box-shadow:0 4px 0 #3d3553;cursor:pointer}
  .pl-sheet .tip{font-style:italic;color:#5d5277}.pl-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.pl-stats div{background:#f4eefa;border-radius:12px;padding:8px}.pl-stats b{display:block;font:800 22px Fraunces,Georgia,serif}`;
  document.head.appendChild(css);
  const el = (cls, html) => { const d = document.createElement('div'); d.className = 'pl ' + cls; d.innerHTML = html; document.body.appendChild(d); return d; };
  ui.panel = el('pl-panel pl-hide', ''); ui.right = el('pl-right pl-hide', '');
  ui.help = el('pl-help pl-hide', 'W / ↑ walk (every block is half a year) · click a building: who lives here? · ← further out / → back to the city, at a corner');
  ui.toast = el('pl-toast', ''); ui.bubble = el('pl-bubble', '');
  ui.black = el('pl-black', '<h1>PLOTLINE</h1><p>the house at the end of the street</p>');
  ui.intro = el('pl-over', `<div class="pl-sheet"><h2>YOU ARE 24 · RENTING A ROOM FOR $${RENT_START} A WEEK · $${START_SAVINGS / 1000}k SAVED</h2>
    <h1>There’s a home at the end of this street.</h1>
    <p>Walk to it. Every block you walk is half a year: you save, and prices rise.</p>
    <p><b>Click any building</b> to see who lives there. <b>Turn left</b> at a corner to move further out, where it’s cheaper and further from everything.</p>
    <button>Start walking</button></div>`);
  ui.intro.querySelector('button').addEventListener('click', e => { e.stopPropagation(); startWalk(); });
  ui.end = el('pl-over mid', '');
  ui.black.addEventListener('pointerdown', skipOpening);
  document.addEventListener('pointermove', e => { const r = canvasNode.getBoundingClientRect(); mouseXY = [e.clientX - r.left, e.clientY - r.top]; });
}
function startWalk() {
  intro = false; ui.intro.classList.remove('show');
  for (const k of ['panel', 'right', 'help']) { ui[k].classList.remove('pl-hide'); }
  beginSound(); canvasNode.focus({ preventScroll: true }); updateHud();
}
function updateHud() {
  if (!ui.panel) { return; }
  const dep = depositNow(), pct = Math.min(100, savings / dep * 100);
  ui.panel.innerHTML = `<h4>YOU</h4><div class="pl-age">${Math.floor(ageNow())} <span class="pl-small">years old · renting</span></div>
    <div class="pl-row"><span>Savings</span><span>${money(savings)}</span></div>
    <div class="pl-row"><span>Deposit needed</span><span>${money(dep)}</span></div>
    <div class="pl-bar"><i style="width:${pct}%;background:${affordable ? '#2fd3a0' : '#ff8fb3'}"></i></div>
    <div class="pl-small">${ZONES[zone].name} · homes ${money(priceNow())} · commute ${commuteText(ZONES[zone].commute)}</div>
    <div class="pl-small">Rent $${rentNow()}/wk · paid so far ${money(rentPaid)}</div>`;
  ui.right.innerHTML = `<span class="pl-small">EMPTY HOMES FOUND</span><b>${emptyFound}</b>`;
}
let toastTimer = null, bubbleTimer = null;
function toast(text) { if (!ui.toast) { return; } ui.toast.textContent = text; ui.toast.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.style.opacity = 0; }, 3800); }
function bubble(head, body, empty) {
  const r = canvasNode.getBoundingClientRect(), x = Math.min(window.innerWidth - 300, mouseXY[0] + r.left + 16), y = Math.max(10, mouseXY[1] + r.top - 90);
  ui.bubble.innerHTML = `<b>${head}</b><span>${body}</span>`; ui.bubble.className = 'pl pl-bubble show' + (empty ? ' empty' : '');
  ui.bubble.style.left = x + 'px'; ui.bubble.style.top = y + 'px';
  clearTimeout(bubbleTimer); bubbleTimer = setTimeout(() => { ui.bubble.classList.remove('show'); }, 3600);
}
function showEnding(bought) {
  if (ending) { return; }
  ending = true; plotTarget = null; updateHud(); sound.go();
  const age = Math.floor(ageNow()), hrs = Math.round(ZONES[zone].commute * 2 * 230 / 60);
  ui.end.innerHTML = bought
    ? `<div class="pl-sheet"><h2>AGE ${age} · ${ZONES[zone].name.toUpperCase()}</h2><h1>You bought a home.</h1>
       <p>It’s ${commuteText(ZONES[zone].commute)} from the city. That’s about <b>${hrs} hours a year</b> on the road, away from work, friends and family.</p>
       <div class="pl-stats"><div><b>${money(rentPaid)}</b>rent paid first</div><div><b>${emptyFound}</b>empty homes you found on the way</div></div>
       <p class="tip">The homes weren’t missing. Many of them were empty.</p>
       <p class="pl-small">On Census night 2021, about 1 in 10 Australian homes had nobody in them.</p><button>Walk again</button></div>`
    : `<div class="pl-sheet"><h2>AGE ${END_AGE} · STILL RENTING</h2><h1>The house is still ${DREAM_D} m away.</h1>
       <p>You saved ${money(savings)}. The deposit is now ${money(depositNow())}.</p>
       <div class="pl-stats"><div><b>${money(rentPaid)}</b>rent paid</div><div><b>${emptyFound}</b>empty homes you walked past</div></div>
       <p class="tip">The homes weren’t missing. Many of them were empty.</p>
       <p class="pl-small">On Census night 2021, about 1 in 10 Australian homes had nobody in them.</p><button>Walk again</button></div>`;
  ui.end.querySelector('button').addEventListener('click', e => { e.stopPropagation(); restartWalk(); });
  ui.end.classList.add('show');
}
function restartWalk() {
  zone = 0; walkedM = 0; savings = START_SAVINGS; rentPaid = 0; emptyFound = 0; peopleMet = 0; affordable = false; dreamZ = null; ending = false; queuedTurn = 0; turnAnim = null;
  seed += 97; chunks.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
  if (ui.end) { ui.end.classList.remove('show'); }
  intro = false; startWalk();
}

/* ---------- input ---------- */
function boardKey(e) {
  if (opening.t0 && !opening.done) { skipOpening(); return true; }
  if (intro && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW')) { startWalk(); return true; }
  if (e.code === 'KeyR') { restartWalk(); return true; }
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') { tryTurn(-1); return true; }
  if (e.code === 'KeyD' || e.code === 'ArrowRight') { tryTurn(1); return true; }
  return false;
}
function boardClick(x, y) {
  if (intro || ending) { return true; }
  const hit = pickBuilding(x, y); if (hit) { clickBuilding(hit); return true; }
  return false;
}
