/* Plotline: Talk Back (2D street) — the spray-paint game on top of the original 2D board street.
 * The street grows as you walk, district by district (shacks, townhouses, mansions, brick and
 * glass, towers). Developers have put a billboard on every block, and the blocks are grey and
 * empty. Aim with the mouse and hold to spray. Cover enough of a billboard and your rewrite goes
 * up in your paint; that block fills with colour and people come out. Walk past and the ad stays.
 * This file plugs into sketch.js through the same hooks board.js used.
 */
const PAINTS = [{ name: 'Pink', col: '#ff4f9a' }, { name: 'Yellow', col: '#ffd23f' }, { name: 'Mint', col: '#2fd3a0' }, { name: 'Blue', col: '#3d8bff' }];
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
const ADS_PER_WALK = 14, TILT = 1.0, AD_W = 8, AD_H = 4, AD_BOTTOM = 2.6, TAG_AT = 0.42;

// Hooks sketch.js expects.
let plotTarget = null, turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, nameBox = null, ending = false, intro = true, ownedFromC = Infinity;
const HIDE_DISTRICT_CARD = true;
// The game.
let paint = 0, spraying = false, aim = null, rewritten = [], passed = 0, skipped = 0, sloganNext = Math.floor(Math.random() * SLOGANS.length), lookAim = 0, hiss = null, ui = {}, mouseXY = [0, 0];

function chunkTier(slot) { return TIER_OF[slot]; }
function soundTier() { const ch = chunks.get(Math.floor(distanceWalked / CHUNK_LEN)); return ch ? ch.tier : 0; }
function canRise() { return true; }
function onPassGo() {} function onChance() {} function updateTurn() { turnYaw = 0; }
function drawForSale() {} function drawTargetMarker() {}
function isCustomLot(L) { return !!L.devSite; }
// A development site: a hoarding along the street and bare gravel, until you rewrite its billboard. Then it becomes a garden.
function drawOwnedLot(L) {
  const z0 = clipZ(L.z0); if (L.z1 <= z0) { return; }
  const s = L.side, xa = s * (EDGE_X + 0.1), xb = s * (EDGE_X + 14), mz = (z0 + L.z1) / 2, done = L.ad && L.ad.tagT !== null, k = done ? easeN((clockT - L.ad.tagT) / 1.5) : 0;
  polyN([P(xa, 0.04, z0), P(xb, 0.04, z0), P(xb, 0.04, L.z1), P(xa, 0.04, L.z1)], toneN(mixHex('#b9afa2', '#8fdc8a', k), mz));
  if (k > 0.01) {
    const pa = s * (EDGE_X + 4), pb = s * (EDGE_X + 5.4);
    polyN([P(pa, 0.06, z0), P(pb, 0.06, z0), P(pb, 0.06, L.z1), P(pa, 0.06, L.z1)], toneN('#f3e3c3', mz));
  }
  // The hoarding sinks away once the site is yours.
  const hh = 2.2 * (1 - k); if (hh < 0.05) { return; }
  const hx = s * (EDGE_X + 0.25);
  polyN(wallQuad(hx, z0, hx, L.z1, 0, hh), toneN('#3a4060', mz));
  polyN(wallQuad(hx - s * 0.01, z0, hx - s * 0.01, L.z1, hh * 0.72, hh * 0.8), toneN('#d9b779', mz));
}

/* ---------- every block gets billboards, and starts cold ---------- */
function plotsForChunk(ch, r) {
  ch.ads = 0; ch.tagged = 0; ch.warm = 1; ch.warmNow = 1;
  if (ch.c < 1) { return; }
  ch.warm = ch.warmNow = 0.15;
  for (const side of [-1, 1]) {
    const lots = ch.lots.filter(L => L.side === side && !L.special);
    if (!lots.length) { continue; }
    const L = lots.reduce((a, b) => (b.z1 - b.z0 > a.z1 - a.z0 ? b : a));
    const [say, back] = SLOGANS[sloganNext % SLOGANS.length]; sloganNext++;
    const ad = { say, back, brand: pickN(r, BRANDS), style: Math.floor(r() * 3), cells: new Set(), progress: 0, tagT: null, col: null, dirty: true, g: null, adG: null, paintG: null, scr: null, lot: L };
    L.ad = ad; L.devSite = true; ch.ads++;
    // Keep the pavement in front clear of street trees so the board can be read.
    const mid = (L.z0 + L.z1) / 2;
    ch.props = ch.props.filter(p => !(p.kind === 'tree' && Math.sign(p.x) === side && Math.abs(p.z - mid) < 7));
    ch.props.push({ kind: 'billboard', x: side * (EDGE_X + 0.8 + AD_W * Math.sin(TILT) / 2), z: mid, side, ad });
  }
}

/* ---------- each frame ---------- */
function boardUpdate(z) {
  const dt = Math.min(deltaTime / 1000, 0.05);
  // Look with the arrow keys or by pushing the mouse to the screen edges.
  if (!intro && !ending) {
    const ex = mouseXY[0] / Math.max(1, width);
    if (held('ArrowLeft') || held('KeyA') || ex < 0.05) { lookAim -= dt * 0.9; }
    if (held('ArrowRight') || held('KeyD') || ex > 0.95) { lookAim += dt * 0.9; }
    lookAim = constrain(lookAim, -0.85, 0.85);
  }
  let near = null;
  for (const ch of chunks.values()) {
    ch.warm = ch.ads ? 0.15 + 0.85 * ch.tagged / ch.ads : 1; ch.warmNow = lerp(ch.warmNow, ch.warm, 1 - Math.exp(-dt * 1.5));
    for (const p of ch.props) {
      if (p.kind === 'person' && p.v) { p.z += p.v * dt; if (p.z > p.z1 || p.z < p.z0) { p.v = -p.v; } }
      if (p.kind !== 'billboard') { continue; }
      const a = p.ad, d = p.z - z;
      if (a.tagT === null && d > 3 && d < 26 && (!near || d < near.d)) { near = { L: a.lot, d }; }
      if (!a.passedBy && d < -4 && passed < ADS_PER_WALK && !intro) { a.passedBy = true; passed++; if (a.tagT === null) { skipped++; toast('You walked past. The ad stays up.'); } updateHud(); if (passed >= ADS_PER_WALK) { setTimeout(showEnding, 1500); } }
      if (a.dirty || (a.tagT !== null && clockT - a.tagT < 1.6)) { composeAd(a); }
    }
  }
  plotTarget = intro || ending ? null : near ? near.L : null;
  aim = intro || ending ? null : pickBillboard(mouseXY[0], mouseXY[1]);
  if (spraying && aim && aim.a.tagT === null) { sprayAt(aim); }
  sprayHiss(spraying && !intro && !ending);
  moveHud();
}
// Which billboard is under the mouse, using the corners it was drawn with last frame.
function pickBillboard(x, y) {
  let best = null;
  for (const ch of chunks.values()) {
    for (const p of ch.props) {
      if (p.kind !== 'billboard' || !p.ad.scr) { continue; }
      const [tl, tr, br, bl, rz] = p.ad.scr;
      for (const [A, B, C, uv] of [[tl, tr, br, [[0, 0], [1, 0], [1, 1]]], [tl, br, bl, [[0, 0], [1, 1], [0, 1]]]]) {
        const den = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y); if (Math.abs(den) < 1e-6) { continue; }
        const w1 = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / den, w2 = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / den, w3 = 1 - w1 - w2;
        if (w1 >= 0 && w2 >= 0 && w3 >= 0 && (!best || rz < best.rz)) {
          best = { a: p.ad, u: w1 * uv[0][0] + w2 * uv[1][0] + w3 * uv[2][0], v: w1 * uv[0][1] + w2 * uv[1][1] + w3 * uv[2][1], rz, hpx: Math.abs(bl.y - tl.y) };
        }
      }
    }
  }
  return best;
}
function sprayAt(hit) {
  const a = hit.a, g = a.paintG || (a.paintG = makeG(512, 256)), col = color(PAINTS[paint].col), rad = constrain(34 * 256 / Math.max(20, hit.hpx), 12, 70);
  if (!a.col) { a.col = PAINTS[paint].col; }
  const px = hit.u * 512, py = hit.v * 256;
  g.noStroke(); col.setAlpha(28); g.fill(col); g.circle(px, py, rad * 2.2);
  col.setAlpha(210); g.fill(col);
  for (let i = 0; i < 26; i++) { const ang = Math.random() * TWO_PI, d = Math.pow(Math.random(), 0.7) * rad; g.circle(px + Math.cos(ang) * d, py + Math.sin(ang) * d, Math.random() * 3.2 + 0.8); }
  if (Math.random() < 0.08) { col.setAlpha(170); g.fill(col); g.rect(px + (Math.random() - 0.5) * rad, py, 2.2, 12 + Math.random() * 30, 2); }
  const ru = rad / 512, rv = rad / 256;
  for (let gx = Math.floor((hit.u - ru) * 16); gx <= Math.floor((hit.u + ru) * 16); gx++) {
    for (let gy = Math.floor((hit.v - rv) * 8); gy <= Math.floor((hit.v + rv) * 8); gy++) { if (gx >= 0 && gx < 16 && gy >= 0 && gy < 8) { a.cells.add(gx + gy * 16); } }
  }
  a.progress = a.cells.size / 128; a.dirty = true;
  if (a.progress >= TAG_AT) { tagWall(a); }
}
// Enough paint: the rewrite goes up and the block comes back to life.
function tagWall(a) {
  const L = a.lot, ch = [...chunks.values()].find(c => c.lots.includes(L)), r = rngN(L.seed + 5);
  a.tagT = clockT; rewritten.push({ say: a.say, back: a.back, col: a.col }); if (ch) { ch.tagged++; }
  toast(`“${a.say}” → “${a.back}”`);
  sound.cash(true); setTimeout(() => sound.go(), 250);
  if (ch) {
    for (let i = 0; i < 9; i++) {
      ch.props.push({ kind: 'person', x: L.side * mixN(ROAD_W + 1, EDGE_X - 0.7, r()), z: mixN(ch.z0 + CROSS_W, ch.z0 + CHUNK_LEN, r()), z0: ch.z0 + CROSS_W, z1: ch.z0 + CHUNK_LEN, v: (r() < 0.5 ? -1 : 1) * mixN(0.5, 1.2, r()), tone: r(), h: r() < 0.25 ? 1.1 : mixN(1.5, 1.8, r()), ph: r() * 6, dog: r() < 0.2, born: clockT + 0.4 + r() * 1.2 });
    }
    for (let i = 0; i < 14; i++) { ch.props.push({ kind: 'openhome', x: L.side * mixN(EDGE_X - 0.25, EDGE_X - 0.05, r()), z: mixN(ch.z0 + CROSS_W + 1, ch.z0 + CHUNK_LEN - 1, r()), col: pickN(r, ['#ff4f9a', '#ffd23f', '#ffffff', '#b48cff', a.col]), born: clockT + 0.3 + r() * 1.4 }); }
  }
  updateHud();
}
function sprayHiss(on) {
  if (!sound || !sound.context || !sound.master) { return; }
  if (!hiss) {
    const ac = sound.context, buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { d[i] = Math.random() * 2 - 1; }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.7; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sound.master); src.start(); hiss = { g, ac };
  }
  hiss.g.gain.setTargetAtTime(on ? 0.16 : 0, hiss.ac.currentTime, on ? 0.02 : 0.05);
}

/* ---------- billboard textures: the ad, your paint, then your rewrite ---------- */
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
  g.textFont('Nunito'); g.textStyle(BOLD); g.textAlign(LEFT, TOP); g.textSize(15); g.text('◆ ' + a.brand, 22, 22);
  const { lines, s } = fitLines(g, a.say, 460, 54, 'Fraunces');
  g.fill(fg); g.textAlign(CENTER, CENTER); g.textStyle(BOLD);
  lines.forEach((ln, i) => g.text(ln, 256, 128 + (i - (lines.length - 1) / 2) * s * 1.05));
  g.textStyle(NORMAL); g.textSize(11); g.textAlign(CENTER, BOTTOM); g.text('Investment opportunity. Conditions apply. Register your interest today.', 256, 236);
}
function composeAd(a) {
  if (!a.adG) { drawAdDesign(a); }
  const g = a.g || (a.g = makeG(512, 256));
  g.clear(); g.image(a.adG, 0, 0);
  if (a.paintG) { g.image(a.paintG, 0, 0); }
  if (a.tagT !== null) {
    const k = constrain((clockT - a.tagT) / 1.1, 0, 1), { lines, s } = fitLines(g, a.back, 440, 76, 'Permanent Marker');
    g.noStroke(); g.fill(20, 16, 30, 150 * k); g.rect(0, 0, 512, 256);
    g.push(); g.drawingContext.save(); g.drawingContext.beginPath(); g.drawingContext.rect(0, 0, 512 * k + 2, 256); g.drawingContext.clip();
    g.translate(256, 132); g.rotate(-0.06); g.textAlign(CENTER, CENTER);
    lines.forEach((ln, i) => {
      const y = (i - (lines.length - 1) / 2) * s * 1.02;
      g.stroke(20, 16, 30); g.strokeWeight(9); g.strokeJoin(ROUND); g.fill(a.col); g.text(ln, 0, y);
      g.noStroke(); g.fill(a.col); g.text(ln, 0, y);
    });
    const r = rngN(a.say.length * 31);
    g.noStroke(); g.fill(a.col); for (let i = 0; i < 9; i++) { const dx = (r() - 0.5) * 380, len = 10 + r() * 40 * k, y0 = 20 + r() * 20; g.rect(dx, y0, 3, len, 2); g.circle(dx + 1.5, y0 + len, 6); }
    g.drawingContext.restore(); g.pop();
  }
  a.dirty = false;
}

/* ---------- drawing on the street ---------- */
// One canvas triangle of an image, mapped with an affine transform.
function imageTri(img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
  const d = u0 * v1 + v0 * u2 + u1 * v2 - v1 * u2 - v0 * u1 - u0 * v2; if (Math.abs(d) < 1e-9) { return; }
  ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.clip();
  const a = (x0 * v1 + v0 * x2 + x1 * v2 - v1 * x2 - v0 * x1 - x0 * v2) / d, b = (u0 * x1 + x0 * u2 + u1 * x2 - x1 * u2 - x0 * u1 - u0 * x2) / d;
  const c = (u0 * v1 * x2 + v0 * x1 * u2 + x0 * u1 * v2 - x0 * v1 * u2 - v0 * u1 * x2 - u0 * x1 * v2) / d;
  const e = (y0 * v1 + v0 * y2 + y1 * v2 - v1 * y2 - v0 * y1 - y0 * v2) / d, f = (u0 * y1 + y0 * u2 + u1 * y2 - y1 * u2 - y0 * u1 - u0 * y2) / d;
  const h = (u0 * v1 * y2 + v0 * y1 * u2 + y0 * u1 * v2 - y0 * v1 * u2 - v0 * u1 * y2 - u0 * y1 * v2) / d;
  ctx.transform(a, e, b, f, c, h); ctx.drawImage(img, 0, 0); ctx.restore();
}
// A billboard on two posts at the back of the pavement, angled toward people walking up the street.
function drawBillboard(q, p) {
  const a = p.ad, s = p.side; a.scr = null;
  if (!a.g) { a.dirty = true; return; }
  const hx = (AD_W / 2) * Math.sin(TILT), hz = (AD_W / 2) * Math.cos(TILT), far = { x: p.x + s * hx, z: p.z + hz }, nearE = { x: p.x - s * hx, z: p.z - hz };
  const y0 = AD_BOTTOM, y1 = AD_BOTTOM + AD_H, pf = P(far.x, y0, far.z), pn = P(nearE.x, y0, nearE.z);
  if (pf.rz < 1 || pn.rz < 1) { return; }
  const [Lp, Rp] = pn.x < pf.x ? [nearE, far] : [far, nearE];
  const tl = P(Lp.x, y1, Lp.z), tr = P(Rp.x, y1, Rp.z), br = P(Rp.x, y0, Rp.z), bl = P(Lp.x, y0, Lp.z), zz = (p.z), fog = fogFor(zz);
  // Posts.
  for (const t of [0.22, 0.78]) {
    const px = mixN(nearE.x, far.x, t), pz = mixN(nearE.z, far.z, t);
    polyN([P(px - 0.12, 0, pz), P(px + 0.12, 0, pz), P(px + 0.12, y0, pz), P(px - 0.12, y0, pz)], toneN('#3d3553', pz));
  }
  // Frame, then the face (or the plain back once you have walked past).
  const ex = 0.25, fr = [P(Lp.x, y1 + ex, Lp.z), P(Rp.x, y1 + ex, Rp.z), P(Rp.x, y0 - ex, Rp.z), P(Lp.x, y0 - ex, Lp.z)];
  polyN(fr, toneN('#e9e4f2', zz), rgbaN('#3d3553', 1 - fog), 1.5);
  const facing = (tr.x - tl.x) * (bl.y - tl.y) - (tr.y - tl.y) * (bl.x - tl.x) > 0;
  if (!facing) { return; }
  ctx.save(); ctx.globalAlpha = 1 - fog * 0.8;
  const img = a.g.elt || a.g.canvas;
  imageTri(img, tl.x, tl.y, tr.x, tr.y, br.x, br.y, 0, 0, 512, 0, 512, 256);
  imageTri(img, tl.x, tl.y, br.x, br.y, bl.x, bl.y, 0, 0, 512, 256, 0, 256);
  ctx.restore();
  a.scr = [tl, tr, br, bl, Math.min(pf.rz, pn.rz)];
}
// Cute round people (and the odd dog) out on the pavement.
function drawPerson(q, p) {
  const k = q.k; if (k < 1.2) { return; }
  const h = p.h, bob = Math.abs(Math.sin(clockT * 6 + p.ph)) * 0.05 * k * (p.v ? 1 : 0);
  const coats = ['#ff7aa2', '#5fb3ff', '#ffb347', '#6cc58a', '#b48cff', '#ffd84d', '#ff8f6b'], skin = ['#f5d0b5', '#d9a07a', '#a8704a', '#ffe0c8'];
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.7;
  ctx.fillStyle = 'rgba(80,70,110,0.18)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, 0.35 * k, 0.1 * k, 0, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = '#4a4a6a'; ctx.fillRect(q.x - 0.13 * k, q.y - 0.55 * h / 1.7 * k - bob, 0.1 * k, 0.55 * h / 1.7 * k); ctx.fillRect(q.x + 0.03 * k, q.y - 0.55 * h / 1.7 * k - bob, 0.1 * k, 0.55 * h / 1.7 * k);
  ctx.fillStyle = coats[Math.floor(p.tone * coats.length)];
  const bt = q.y - h * 0.82 * k - bob, bh = h * 0.5 * k;
  ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(q.x - 0.26 * k, bt, 0.52 * k, bh, 0.22 * k); } else { ctx.rect(q.x - 0.26 * k, bt, 0.52 * k, bh); } ctx.fill();
  ctx.fillStyle = skin[Math.floor(p.tone * 9) % skin.length]; ctx.beginPath(); ctx.arc(q.x, bt - 0.16 * k, 0.2 * k, 0, TWO_PI); ctx.fill();
  if (k > 10) { ctx.fillStyle = '#3a3050'; ctx.beginPath(); ctx.arc(q.x - 0.07 * k, bt - 0.18 * k, 0.025 * k, 0, TWO_PI); ctx.arc(q.x + 0.07 * k, bt - 0.18 * k, 0.025 * k, 0, TWO_PI); ctx.fill(); }
  if (p.dog) { const dx = q.x + 0.55 * k * Math.sign(p.v || 1); ctx.fillStyle = '#c8956a'; ctx.beginPath(); ctx.ellipse(dx, q.y - 0.25 * k, 0.28 * k, 0.15 * k, 0, 0, TWO_PI); ctx.fill(); ctx.beginPath(); ctx.arc(dx + 0.25 * k * Math.sign(p.v || 1), q.y - 0.38 * k, 0.12 * k, 0, TWO_PI); ctx.fill(); }
  ctx.restore();
}
// Flowers that come up along the building line once a block has been rewritten.
function drawOpenHome(q, p) {
  const k = q.k; if (k < 1) { return; }
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = '#5fae5a'; ctx.fillRect(q.x - 0.03 * k, q.y - 0.45 * k, 0.06 * k, 0.45 * k);
  ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(q.x, q.y - 0.5 * k, 0.17 * k, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(q.x, q.y - 0.5 * k, 0.06 * k, 0, TWO_PI); ctx.fill();
  ctx.restore();
}

/* ---------- HUD (HTML on top of the canvas) ---------- */
function drawBoardHud() { if (!ui.panel) { buildUI(); } if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,248,240,${fadeA})`; ctx.fillRect(0, 0, width, height); } }
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
  .pl-toast{left:50%;transform:translateX(-50%);bottom:40px;font:400 22px 'Permanent Marker',Impact,sans-serif;background:#3d3553;color:#fffaf2;padding:10px 22px;border-radius:30px;opacity:0;transition:opacity .4s;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
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
    <p>This street was written by developers. Every block goes up with a billboard telling you what to want: <i>luxury</i>, <i>investment</i>, <i>your future</i>. And every block is grey and empty.</p>
    <p>You have a spray can. <b>Aim at a billboard and hold the mouse to spray.</b> Cover enough of it and your words go up instead, and the block comes back to life.</p>
    <p class="tip">Walk past, and the ad stays.</p>
    <button>Pick up the can</button><p class="pl-small">W / ↑ walk · mouse aim · hold click or Space to spray · 1–4 paint colour</p></div>`);
  ui.intro.querySelector('button').addEventListener('click', e => { e.stopPropagation(); startWalk(); });
  ui.end = el('pl-over', '');
  document.addEventListener('pointerup', () => { spraying = false; });
  document.addEventListener('pointermove', e => { const r = canvasNode.getBoundingClientRect(); mouseXY = [e.clientX - r.left, e.clientY - r.top]; });
  window.addEventListener('keyup', e => { if (e.code === 'Space') { spraying = false; } });
  window.addEventListener('blur', () => { spraying = false; });
  mouseXY = [width / 2, height * 0.42];
  if (document.fonts) { document.fonts.load('80px "Permanent Marker"').then(() => { for (const ch of chunks.values()) { for (const p of ch.props) { if (p.ad) { p.ad.adG = null; p.ad.dirty = true; } } } }).catch(() => {}); }
  updateHud();
}
function startWalk() { intro = false; ui.intro.classList.remove('show'); beginSound(); canvasNode.focus({ preventScroll: true }); updateHud(); }
function updateHud() {
  if (!ui.panel) { return; }
  ui.panel.innerHTML = `<h4>BILLBOARDS REWRITTEN</h4><div class="pl-big">${rewritten.length} <span class="pl-small">/ ${ADS_PER_WALK}</span></div>
    <div class="pl-small">${Math.max(0, ADS_PER_WALK - passed)} still ahead · walked past ${skipped}</div>
    <div class="pl-sw">${PAINTS.map((p, i) => `<div data-i="${i}" class="${i === paint ? 'on' : ''}" style="background:${p.col}">${i + 1}</div>`).join('')}</div>`;
  ui.panel.querySelectorAll('.pl-sw div').forEach(d => d.addEventListener('pointerdown', e => { e.stopPropagation(); paint = +d.dataset.i; updateHud(); }));
  ui.can.style.setProperty('--paint', PAINTS[paint].col);
}
function moveHud() {
  if (!ui.x) { return; }
  const r = canvasNode.getBoundingClientRect(), x = mouseXY[0] + r.left, y = mouseXY[1] + r.top;
  const hot = aim && aim.a.tagT === null, col = PAINTS[paint].col, show = !intro && !ending;
  ui.x.style.display = ui.can.style.display = show ? 'block' : 'none';
  ui.x.style.left = x + 'px'; ui.x.style.top = y + 'px'; ui.x.classList.toggle('hot', !!hot); ui.x.style.borderColor = hot ? col : '#3d3553';
  ui.x.querySelector('i').style.cssText = `--c:${col};--p:${hot ? Math.min(100, aim.a.progress / TAG_AT * 100) : 0}`;
  ui.mist.style.left = x + 'px'; ui.mist.style.top = y + 'px';
  ui.mist.style.background = `radial-gradient(circle, ${col}cc 0%, ${col}55 35%, transparent 70%)`;
  ui.mist.style.opacity = spraying && show ? (0.55 + Math.random() * 0.3) : 0;
  const ang = Math.atan2(y - window.innerHeight, x - window.innerWidth * 0.9) + HALF_PI, shake = spraying ? (Math.random() - 0.5) * 3 : 0;
  ui.can.style.transform = `translate(${(x - window.innerWidth * 0.8) * 0.08 + shake}px, ${spraying ? -8 : 0}px) rotate(${constrain(ang, -0.9, 0.5)}rad)`;
  if (frameCount % 20 === 0) { updateHud(); }
}
let toastTimer = null;
function toast(text) { if (!ui.toast) { return; } ui.toast.textContent = text; ui.toast.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.style.opacity = 0; }, 3600); }
function showEnding() {
  ending = true; spraying = false; updateHud();
  const n = rewritten.length, total = Math.max(passed, 1), share = n / total;
  const title = share >= 0.75 ? 'The street talks back' : share >= 0.4 ? 'Half the walls are yours' : n > 0 ? 'Most of the ads won' : 'The ads won';
  const tip = share >= 0.75 ? 'Every block you painted filled with people. The ones you passed are still selling.' : n > 0 ? 'Where you sprayed, people came out. Where you walked past, the street stayed grey.' : 'You walked the whole street and let the billboards do the talking.';
  ui.end.innerHTML = `<div class="pl-sheet"><h2>YOUR STREET</h2><h1>${title}</h1>
    <p>You rewrote <b>${n}</b> of <b>${total}</b> billboards.</p>
    <div class="pl-wall">${rewritten.map(w => `<div><s>${w.say}</s><b style="color:${w.col}">${w.back}</b></div>`).join('') || '<div>Nothing rewritten.</div>'}</div>
    <p class="tip">${tip}</p><p class="pl-small">A city is full of messages. Who gets to write them?</p>
    <button>Walk it again</button></div>`;
  ui.end.querySelector('button').addEventListener('click', e => { e.stopPropagation(); restartWalk(); startWalk(); });
  ui.end.classList.add('show'); sound.go();
}
function restartWalk() {
  rewritten = []; passed = 0; skipped = 0; ending = false; intro = true; spraying = false; lookAim = 0; plotTarget = null;
  seed += 97; chunks.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
  if (ui.end) { ui.end.classList.remove('show'); ui.intro.classList.add('show'); updateHud(); }
}

/* ---------- input ---------- */
function boardKey(e) {
  const pi = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
  if (pi !== undefined) { paint = pi; updateHud(); return true; }
  if (intro && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW')) { startWalk(); return true; }
  if (e.code === 'Space') { if (!ending) { spraying = true; } return true; }
  if (e.code === 'KeyR') { restartWalk(); return true; }
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) { return true; }
  return false;
}
function boardClick() { if (intro || ending) { return true; } spraying = true; return true; }
