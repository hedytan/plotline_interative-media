/* Plotline: Monopoly, lived.
 * Monopoly began in 1904 as Lizzie Magie's "The Landlord's Game", made to show where owning
 * everything leads. Here you play to win: you're the investor, the top hat. Walk the board and
 * press E at FOR SALE signs to buy. Every lap past GO your properties grow in value and the bank
 * lends you more. The goal is Monopoly's goal: own the street.
 * Every time you buy, the people who lived there carry their boxes away, the windows go dark and
 * the building turns grey, and the signs on the street congratulate you. You win, and the street
 * you own is empty.
 */
const GOAL = 8, START_CASH = 3000000, PRICE = [450000, 700000, 1300000, 2000000, 3500000], LAP_TIERS = [0, 0, 1, 1, 2, 2, 3, 4];
const SIGNS_BEFORE = ['Every great fortune starts with one property.', 'Buy land. They’re not making it anymore.', 'Why work when your house can?', 'Rent is someone else’s mortgage. Make it yours.', 'Your portfolio starts here.'];
const SIGNS_AFTER = ['Landlord of the Year: YOU.', 'Congratulations. Rent goes up Monday.', 'Empty homes: worth more empty.', 'Your tenants are 24 and saving for a deposit. Sound familiar?', 'Thank you for your investment. Lights off to save costs.', 'Fewer neighbours. More equity.', 'You’re doing great. They’re moving further out.'];
const WALLS_ALL = ['RENT +12% FROM MONDAY', '57 PEOPLE AT THE OPEN HOME', 'NO PETS · NO KIDS · NO LEASE', 'NEGATIVELY GEARED, POSITIVELY GREAT', 'INVEST NOW · 7% YIELD'];
const BANDS = [['#c0392b', '#ffffff'], ['#1f2a44', '#f4d58d'], ['#f4d58d', '#2a2440'], ['#ffffff', '#c0392b']];

// Hooks sketch.js expects.
let plotTarget = null, turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, nameBox = null, ending = false, intro = true, ownedFromC = Infinity, lookAim = 0;
const HIDE_DISTRICT_CARD = true;
// The game.
let lap = 0, cash = START_CASH, market = 1, owned = new Map(), movedOut = 0, opening = { t0: null, built: false, sparkle: false, done: false }, ui = {}, hintedE = false;
const texCache = new Map();
const money = v => (v < 0 ? '−$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-AU');
const moneyK = v => (Math.abs(v) >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + Math.round(v / 1000) + 'k');

/* ---------- a fixed Monopoly board: 8 blocks, cheap to dear, then GO ---------- */
function boardSlot(c) { const L = Math.floor(c / 8), s = ((c % 8) + 8) % 8; return { lap: Math.max(0, L), slot: s, tier: LAP_TIERS[s], estate: false, estateLap: -1 }; }
function chunkTier() { return 0; }
function streetLabel(ch) { return ch.slot === 0 ? 'GO  ➜' : DISTRICTS[ch.tier].name.toUpperCase(); }
const lotKey = (ch, L) => `${ch.slot}:${L.side}:${Math.round(L.z0 - ch.z0)}`;
function priceOf(L) { return PRICE[L.tier] * L.priceK * market; }
function valueOf(o) { return o.price * Math.pow(1.15, lap - o.lap); }
function netWorth() { let v = cash; for (const o of owned.values()) { v += valueOf(o); } return v; }
function soundTier() { if (owned.size >= GOAL * 0.6) { return 0; } const ch = chunks.get(Math.floor(distanceWalked / CHUNK_LEN)); return ch ? ch.tier : 0; }
function canRise() { return opening.built; }
function landmarkScale() { return 1; }
function updateTurn() { turnYaw = 0; }
function isCustomLot() { return false; }
function drawOwnedLot() {} function drawOpenHome() {} function onChance() {}
function lotCold(L) { return L.mine ? Math.min(1, (clockT - (L.mineT || 0)) / 2.5) : 0; }

/* ---------- each block: people who live there, FOR SALE signs, billboards ---------- */
function plotsForChunk(ch, r) {
  ch.lots = ch.lots.filter(L => !L.special);
  for (const L of ch.lots) {
    L.key = lotKey(ch, L); L.priceK = mixN(0.85, 1.2, r()); L.households = 2 + Math.floor(r() * (L.tier >= 3 ? 14 : 4));
    if (owned.has(L.key)) { L.mine = true; L.mineT = -10; continue; }
    if (r() < 0.4) { L.wall = pickN(r, WALLS_ALL); L.band = pickN(r, BANDS); }
    // The people who live here, out on the pavement in front of their homes.
    const n = Math.min(4, L.households);
    for (let i = 0; i < n; i++) { ch.props.push({ kind: 'person', home: L.key, x: L.side * mixN(ROAD_W + 1.2, EDGE_X - 0.6, r()), z: mixN(L.z0, L.z1, r()), z0: L.z0 - 2, z1: L.z1 + 2, v: (r() < 0.5 ? -1 : 1) * mixN(0.3, 0.9, r()), tone: r(), h: r() < 0.2 ? 1.15 : mixN(1.55, 1.85, r()), ph: r() * 6 }); }
  }
  for (const side of [-1, 1]) {
    const cand = ch.lots.filter(L => L.side === side && !L.mine && L.z0 > ch.z0 + CROSS_W + 2);
    if (cand.length && ch.slot !== 0) { pickN(r, cand).forSale = true; }
  }
  for (let i = 0; i < 2; i++) {
    if (r() < 0.25) { continue; }
    const side = i === 0 ? -1 : 1, z = ch.z0 + CROSS_W + 5 + r() * (CHUNK_LEN - CROSS_W - 10), pool = owned.size ? SIGNS_AFTER : SIGNS_BEFORE;
    ch.props.push({ kind: 'billboard', x: side * (ROAD_W + 1.4), z, side, text: pickN(r, pool), col: DISTRICTS[ch.tier].stripe[0] });
  }
}

/* ---------- opening, painted walls, billboards (shared with lived/) ---------- */
function introCam() {
  if (opening.t0 === null) { return { lift: 42, tilt: 0.55 }; }
  if (opening.done) { return { lift: 0, tilt: 0 }; }
  const t = (performance.now() - opening.t0) / 1000, u = easeN((t - 1.6) / 4.2);
  return { lift: 42 * (1 - u), tilt: 0.55 * (1 - u) };
}
function runOpening() {
  if (opening.t0 === null) { opening.t0 = performance.now(); return; }
  const t = (performance.now() - opening.t0) / 1000;
  if (!opening.built && t > 1.7) { opening.built = true; streetT = clockT; ui.black.classList.add('gone'); }
  if (!opening.sparkle && t > 4.6) { opening.sparkle = true; sound.go(); }
  if (!opening.done && t > 6.0) { opening.done = true; ui.intro.classList.add('show'); }
}
function skipOpening() { if (!opening.t0 || opening.done) { return; } opening.t0 = performance.now() - 6100; opening.built = true; ui.black.classList.add('gone'); }
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
function wallTex(text, band) {
  const key = text + band[0]; if (texCache.has(key)) { return texCache.get(key); }
  const g = createGraphics(640, 160); g.pixelDensity(1); g.clear(); g.noStroke();
  g.fill(band[0]); g.rect(0, 10, 640, 140, 6); g.fill(band[1]); g.rect(0, 10, 640, 6); g.rect(0, 144, 640, 6);
  g.textFont('Anton'); g.textAlign(CENTER, CENTER); g.fill(band[1]);
  let s = 96; g.textSize(s); while (g.textWidth(text) > 600 && s > 30) { s -= 3; g.textSize(s); }
  g.text(text, 320, 84); texCache.set(key, g); return g;
}
// Roadside billboards: satire written from the street's own numbers.
function drawBillboard(q, p) {
  const k = q.k; if (k < 2) { return; }
  const w = 4.6 * k, h = 2.3 * k, top = q.y - 4.6 * k, x = q.x;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.85;
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(x - w * 0.36, top, 0.12 * k, 4.6 * k); ctx.fillRect(x + w * 0.36 - 0.12 * k, top, 0.12 * k, 4.6 * k);
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(x - w / 2, top - h, w, h);
  ctx.fillStyle = p.col; ctx.fillRect(x - w / 2, top - h, w, h * 0.12); ctx.fillRect(x - w / 2, top - h * 0.12, w, h * 0.12);
  ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = Math.max(1, 0.05 * k); ctx.strokeRect(x - w / 2, top - h, w, h);
  if (w > 50) {
    ctx.fillStyle = '#2a1e18'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const size = Math.max(7, h * 0.16); ctx.font = `bold ${size}px Fraunces, Georgia, serif`;
    const words = p.text.split(' '), lines = []; let line = '';
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w * 0.86 && line) { lines.push(line); line = wd; } else { line = t; } }
    lines.push(line);
    const lh = size * 1.15, y0 = top - h / 2 - (lines.length - 1) * lh / 2;
    lines.slice(0, 4).forEach((ln, i) => ctx.fillText(ln, x, y0 + i * lh));
  }
  ctx.restore();
}

/* ---------- each frame ---------- */
function boardUpdate(z) {
  if (!ui.panel) { buildUI(); }
  runOpening();
  const dt = Math.min(deltaTime / 1000, 0.05);
  if (!paused && !intro && !ending) { market *= 1 + 0.1 * dt / 60; }
  for (const ch of chunks.values()) {
    for (let i = ch.props.length - 1; i >= 0; i--) {
      const p = ch.props[i]; if (p.kind !== 'person') { continue; }
      if (p.leaving) { p.z += 2.2 * dt; p.x += Math.sign(p.x) * 0.3 * dt; if (clockT - p.leaving > 9) { ch.props.splice(i, 1); } continue; }
      if (p.v) { p.z += p.v * dt; if (p.z > p.z1 || p.z < p.z0) { p.v = -p.v; } }
    }
  }
  plotTarget = plotHere(z);
  if (plotTarget && !hintedE && !intro && !ending) { hintedE = true; toast('Press E to buy it'); }
  if (frameCount % 6 === 0) { updateHud(); }
}
function plotHere(z) {
  if (intro || ending) { return null; }
  let best = null;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (!L.forSale) { continue; } const d = Math.abs((L.z0 + L.z1) / 2 - z); if (d < 11 && (!best || d < best.d)) { best = { L, d }; } } }
  return best ? best.L : null;
}
// E: buy the property beside you. The people who lived there pack up and leave.
function buyHere() {
  const L = plotHere(distanceWalked); if (!L) { toast('Nothing for sale here. Walk on.'); return; }
  if (owned.size >= GOAL) { return; }
  const price = priceOf(L); if (cash < price) { toast(`Not enough cash (${moneyK(cash)}). Pass GO: your properties will earn.`); sound.cash(false); return; }
  cash -= price; L.forSale = false; L.mine = true; L.mineT = clockT; owned.set(L.key, { price, lap, tier: L.tier }); movedOut += L.households;
  for (const ch of chunks.values()) { for (const p of ch.props) { if (p.kind === 'person' && p.home === L.key && !p.leaving) { p.leaving = clockT; p.box = true; } } }
  sound.cash(true); setTimeout(() => sound.jail(), 500);
  showMonoCard('SOLD — TO YOU', `${DISTRICTS[L.tier].name}, ${moneyK(price)}.`, `${L.households} household${L.households > 1 ? 's' : ''} moved out. Worth more empty.`, '#2f9a5a');
  if (owned.size >= GOAL) { setTimeout(showEnding, 3500); }
  updateHud();
}
// GO: a year. Your properties gain value and the bank lends you more against them.
function onPassGo() {
  if (ending || intro) { return; }
  let gain = 0; for (const o of owned.values()) { gain += valueOf(o) * 0.15; }
  lap++; const loan = Math.round(gain * 0.8 + 700000); cash += loan; market *= 1.08;
  showMonoCard('GO', `+${moneyK(loan)} from the bank.`, owned.size ? `Your ${owned.size} propert${owned.size > 1 ? 'ies' : 'y'} went up ${moneyK(gain)}. Prices +8%.` : 'Buy something. Property only goes up.', '#e23b3b');
  updateHud();
}

/* ---------- drawing on the street ---------- */
function drawForSale(L) {
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + 1.4), base = P(x, 0, mid);
  if (base.rz < 1.5 || base.rz > FAR_Z * 0.8) { return; }
  const k = base.k, w = 3.4 * k, h = 1.9 * k, top = base.y - 3 * k, near = L === plotTarget;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(mid) * 0.8;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(base.x - 0.07 * k, top, 0.14 * k, 3 * k);
  ctx.fillStyle = '#fffaee'; ctx.strokeStyle = near ? '#ff4f9a' : '#2a1e18'; ctx.lineWidth = Math.max(1, (near ? 0.14 : 0.06) * k);
  ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  ctx.fillStyle = '#c8322a'; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h * 0.34);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${h * 0.2}px Georgia, serif`; ctx.fillStyle = '#fff'; ctx.fillText('FOR SALE', base.x, top - h * 0.2 + h * 0.17);
    ctx.font = `bold ${h * 0.27}px Georgia, serif`; ctx.fillStyle = '#2a1e18'; ctx.fillText(moneyK(priceOf(L)), base.x, top - h * 0.2 + h * 0.52);
    ctx.font = `${h * 0.15}px Georgia, serif`; ctx.fillStyle = '#7a5a4a'; ctx.fillText(`${L.households} household${L.households > 1 ? 's' : ''} live here`, base.x, top - h * 0.2 + h * 0.8);
  }
  ctx.restore();
}
// Slogans on walls; on what you own, a red Monopoly hotel and a brass plaque.
function afterLot(L) {
  const H = L.H * L.econNow, x = L.side * (EDGE_X + L.setback), z0 = clipZ(L.z0);
  if (L.z1 <= z0 + 0.5) { return; }
  if (L.mine) {
    paintOnFacade(L, x, z0, wallTex('OWNED BY YOU · VACANT', ['#2a1e18', '#d4a017']), H * 0.25, H * 0.42, 0.4);
    const xh = L.side * (EDGE_X + L.setback + Math.min(4, L.depth / 2)), mid = (L.z0 + L.z1) / 2, za = Math.max(mid - 2.2, z0), zb = mid + 2.2, up = easeN((clockT - (L.mineT || 0)) / 0.8), hh = H + 2.6 * up;
    if (zb > za + 0.3 && up > 0.02) { polyN(wallQuad(xh, za, xh, zb, H, hh), toneN('#d62d2d', mid)); polyN([P(xh, hh, za), P(xh, hh, zb), P(xh, hh + 1.6 * up, (za + zb) / 2)], toneN('#a81f1f', mid)); }
    return;
  }
  if (L.wall) { paintOnFacade(L, x, z0, wallTex(L.wall, L.band), H * (L.tier === 0 ? 0.55 : 0.58), H * (L.tier === 0 ? 0.9 : 0.8), 0.35); }
}
function drawPerson(q, p) {
  const k = q.k; if (k < 1.5) { return; }
  const h = p.h, walk = p.leaving ? Math.sin(clockT * 7 + p.ph) * 0.06 * k : 0, sway = Math.sin(clockT * 1.5 + p.ph) * 0.03 * k;
  const coats = ['#ff7aa2', '#5fb3ff', '#ffb347', '#6cc58a', '#b48cff', '#ffd84d', '#ff8f6b'], skin = ['#f5d0b5', '#d9a07a', '#a8704a', '#ffe0c8'];
  const fade = p.leaving ? 1 - constrain((clockT - p.leaving - 5) / 4, 0, 1) : 1;
  ctx.save(); ctx.globalAlpha = (1 - fogFor(p.z) * 0.8) * fade;
  ctx.fillStyle = '#4a4a6a'; ctx.fillRect(q.x - 0.14 * k, q.y - 0.8 * k + walk, 0.11 * k, 0.8 * k); ctx.fillRect(q.x + 0.03 * k, q.y - 0.8 * k - walk, 0.11 * k, 0.8 * k);
  ctx.fillStyle = coats[Math.floor(p.tone * coats.length)];
  ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(q.x - 0.25 * k + sway, q.y - (h - 0.2) * k, 0.5 * k, (h - 1.0) * k, 0.2 * k); } else { ctx.rect(q.x - 0.25 * k + sway, q.y - (h - 0.2) * k, 0.5 * k, (h - 1.0) * k); } ctx.fill();
  ctx.fillStyle = skin[Math.floor(p.tone * 7) % skin.length]; ctx.beginPath(); ctx.arc(q.x + sway, q.y - (h - 0.05) * k, 0.17 * k, 0, TWO_PI); ctx.fill();
  if (p.box) { ctx.fillStyle = '#c9a26a'; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = Math.max(1, 0.03 * k); ctx.fillRect(q.x - 0.32 * k, q.y - (h - 0.45) * k, 0.64 * k, 0.45 * k); ctx.strokeRect(q.x - 0.32 * k, q.y - (h - 0.45) * k, 0.64 * k, 0.45 * k); }
  ctx.restore();
}
function drawTargetMarker() {
  if (intro || ending) { return; }
  let best = null, z = distanceWalked;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.forSale) { const mz = (L.z0 + L.z1) / 2; if (mz - z > 4 && mz - z < 70 && (!best || mz < best.z)) { best = { x: L.side * (EDGE_X + 1.4), z: mz }; } } } }
  if (!best || cash < 1) { return; }
  const q = P(best.x, 4.2 + Math.abs(Math.sin(clockT * 3)) * 0.8, best.z); if (q.rz < 2 || q.rz > 90) { return; }
  const s = Math.max(14, Math.min(40, q.k * 1.1));
  ctx.save(); ctx.fillStyle = '#ff4f9a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(q.x - s * 0.6, q.y - s * 1.3); ctx.lineTo(q.x + s * 0.6, q.y - s * 1.3); ctx.lineTo(q.x + s * 0.6, q.y - s * 0.6); ctx.lineTo(q.x + s, q.y - s * 0.6); ctx.lineTo(q.x, q.y + s * 0.3); ctx.lineTo(q.x - s, q.y - s * 0.6); ctx.lineTo(q.x - s * 0.6, q.y - s * 0.6); ctx.closePath();
  ctx.stroke(); ctx.fill(); ctx.restore();
}
function drawDreamHouse() {}

/* ---------- HUD (HTML) ---------- */
function drawBoardHud() { if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,248,240,${fadeA})`; ctx.fillRect(0, 0, width, height); } }
const HAT = '<svg width="34" height="30" viewBox="0 0 34 30"><ellipse cx="17" cy="25" rx="15" ry="4" fill="#9aa0b4" stroke="#2a1e18" stroke-width="2"/><rect x="8" y="4" width="18" height="21" rx="2" fill="#c9cdd9" stroke="#2a1e18" stroke-width="2"/><rect x="8" y="17" width="18" height="4" fill="#2a1e18"/></svg>';
function buildUI() {
  const css = document.createElement('style');
  css.textContent = `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Permanent+Marker&family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Nunito:wght@500;700;800&display=swap');
  .pl{position:fixed;font-family:Nunito,system-ui,sans-serif;color:#2a1e18;z-index:5;user-select:none}
  .pl-hide{opacity:0;pointer-events:none}
  .pl-goal{left:50%;top:14px;transform:translateX(-50%);background:#2a1e18;color:#fffaee;border-radius:14px;padding:10px 16px;max-width:min(620px,56vw);box-shadow:0 5px 0 rgba(42,30,24,.25);font-weight:800;font-size:15px;transition:opacity .6s;text-align:left}
  .pl-goal .k{display:inline-block;background:#ff4f9a;color:#fff;border-radius:6px;font:800 10px Nunito;letter-spacing:.12em;padding:2px 6px;margin-right:8px;vertical-align:2px}
  .pl-goal .nx{font-weight:800;font-size:18px;color:#ffe7b0}.pl-goal .nx .k{background:#ffd23f;color:#2a1e18}
  .pl-goal .yrs{font-size:11px;color:#c9b8a8;margin-top:3px;text-align:center}
  .pl-sheet.short{max-width:420px;padding:26px}.pl-sheet.short h1{font-size:38px;margin:4px 0 2px}.pl-sheet.short button{font-size:20px;padding:12px 40px}
  .pl-sheet h2.goal{font:800 12px Nunito;color:#e0457a;letter-spacing:.16em;margin:0 0 4px}
  .pl-board.flash{animation:plFlash 1.4s ease-out 2}@keyframes plFlash{0%{transform:scale(1)}30%{transform:scale(1.12);box-shadow:0 0 0 6px #ffd23f}100%{transform:scale(1)}}
  .pl-panel{top:16px;left:16px;background:#fffaee;border-radius:10px;padding:12px 16px;box-shadow:0 5px 0 rgba(42,30,24,.25);width:240px;border:2px solid #2a1e18;transition:opacity .6s}
  .pl-panel h4{margin:0 0 4px;font:800 11px Nunito;letter-spacing:.14em;color:#8a6a5a}
  .pl-row{display:flex;justify-content:space-between;font-weight:700;font-size:14px;margin:3px 0}
  .pl-big{font:800 28px Fraunces,Georgia,serif;line-height:1}
  .pl-small{font-size:11px;color:#8a6a5a;font-weight:700}
  .pl-board{top:16px;right:16px;background:#cfe6d0;border:2px solid #2a1e18;border-radius:10px;padding:8px;box-shadow:0 5px 0 rgba(42,30,24,.25);transition:opacity .6s}
  .pl-deed{right:16px;top:212px;width:210px;background:#fffdf6;border:2px solid #2a1e18;border-radius:8px;padding:8px;box-shadow:0 5px 0 rgba(42,30,24,.25);transition:opacity .3s,transform .3s}
  .pl-deed .hd{border-radius:4px;padding:6px;text-align:center;color:#fff;font:800 10px Nunito;letter-spacing:.12em}.pl-deed .hd b{display:block;font:800 15px Fraunces,Georgia,serif;letter-spacing:0}
  .pl-deed .r{display:flex;justify-content:space-between;font-size:12px;margin:5px 4px}.pl-deed .r.bad{color:#c0392b;font-weight:800}
  .pl-deed .act{margin-top:6px;text-align:center;font:800 13px Nunito;background:#2a1e18;color:#fffaee;border-radius:20px;padding:6px}
  .pl-help{left:50%;transform:translateX(-50%);bottom:14px;font-size:12px;font-weight:700;color:#5d4a40;background:rgba(255,250,238,.88);padding:6px 14px;border-radius:20px;white-space:nowrap;transition:opacity .6s}
  .pl-toast{left:50%;transform:translateX(-50%);bottom:54px;font:italic 700 16px Nunito;background:#2a1e18;color:#fffaee;padding:9px 18px;border-radius:30px;opacity:0;transition:opacity .4s;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
  .pl-card{left:50%;top:22%;transform:translateX(-50%) rotate(-1.5deg);width:330px;background:#fffaee;border:2px solid #2a1e18;border-radius:10px;box-shadow:0 8px 0 rgba(42,30,24,.3);text-align:center;opacity:0;transition:opacity .35s,transform .35s;pointer-events:none;overflow:hidden}
  .pl-card.show{opacity:1;transform:translateX(-50%) rotate(-1.5deg) translateY(0)}
  .pl-card .t{color:#fff;font:400 26px Anton,Impact,sans-serif;letter-spacing:.06em;padding:8px}.pl-card p{margin:10px 16px;font-size:15px}.pl-card p.s{font-size:13px;color:#6a5a50;margin-bottom:14px}
  .pl-black{inset:0;background:#1d1830;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:20;transition:opacity 1.1s;color:#fffaf2}
  .pl-black.gone{opacity:0;pointer-events:none}
  .pl-black h1{font:800 64px Fraunces,Georgia,serif;letter-spacing:.3em;margin:0;animation:plIn 1.4s ease-out both}
  .pl-black p{font:600 18px Nunito;opacity:.8;margin:10px 0 0;animation:plIn 1.4s .5s ease-out both}
  @keyframes plIn{from{opacity:0;letter-spacing:.6em;filter:blur(6px)}to{opacity:1;filter:none}}
  .pl-over{inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:6vh;opacity:0;pointer-events:none;transition:opacity .6s;z-index:9}
  .pl-over.show{opacity:1;pointer-events:auto}.pl-over.mid{align-items:center;padding:0;background:rgba(29,24,48,.45)}
  .pl-sheet{background:#fffaee;border:2px solid #2a1e18;border-radius:12px;box-shadow:0 8px 0 rgba(42,30,24,.35);padding:22px 28px;max-width:600px;width:calc(100vw - 48px);text-align:center;max-height:90vh;overflow:auto;animation:plUp .7s ease-out both}
  @keyframes plUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
  .pl-sheet .band{margin:-22px -28px 14px;background:#c8322a;color:#fff;font:400 22px Anton,Impact,sans-serif;letter-spacing:.08em;padding:10px;border-radius:10px 10px 0 0}
  .pl-sheet h1{font:800 30px Fraunces,Georgia,serif;margin:0 0 6px}
  .pl-sheet p{font-size:16px;line-height:1.5;margin:6px 0}.pl-sheet button{margin-top:12px;font:800 16px Nunito;background:#c8322a;color:#fff;border:2px solid #2a1e18;border-radius:30px;padding:10px 22px;box-shadow:0 4px 0 #2a1e18;cursor:pointer}
  .pl-sheet .tip{font-style:italic;color:#5d4a40}.pl-wall{display:flex;flex-direction:column;gap:5px;margin:8px 0;max-height:24vh;overflow:auto}.pl-wall div{font-size:12px;text-align:left;background:#1f2a44;color:#f4d58d;border-radius:6px;padding:5px 9px}.pl-wall b{display:block;font:400 17px 'Permanent Marker',Impact,sans-serif}.pl-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0}.pl-stats div{background:#f3ece0;border-radius:8px;padding:8px;font-size:12px}.pl-stats b{display:block;font:800 20px Fraunces,Georgia,serif}
  .pl-panel h4{display:flex;align-items:center;gap:6px}.pl-bar{height:10px;background:#eee6dc;border-radius:6px;overflow:hidden;margin:4px 0}.pl-bar i{display:block;height:100%;background:#d4a017}.pl-row.bad{color:#c0392b}`;
  document.head.appendChild(css);
  const el = (cls, html) => { const d = document.createElement('div'); d.className = 'pl ' + cls; d.innerHTML = html; document.body.appendChild(d); return d; };
  ui.panel = el('pl-panel pl-hide', ''); ui.goal = el('pl-goal pl-hide', '');
  ui.help = el('pl-help pl-hide', '↑ walk · E buy · mouse look');
  ui.toast = el('pl-toast', ''); ui.card = el('pl-card', '');
  ui.black = el('pl-black', '<h1>PLOTLINE</h1><p>Monopoly, lived</p>');
  ui.intro = el('pl-over', `<div class="pl-sheet short"><h2 class="goal">YOU’RE THE TOP HAT · $3M CASH</h2><h1>Own the street.</h1><button>Play</button></div>`);
  ui.intro.querySelector('button').addEventListener('click', e => { e.stopPropagation(); startWalk(); });
  ui.end = el('pl-over mid', '');
  ui.black.addEventListener('pointerdown', skipOpening);
}
function startWalk() {
  intro = false; ui.intro.classList.remove('show');
  for (const k of ['panel', 'help', 'goal']) { ui[k].classList.remove('pl-hide'); }
  beginSound(); canvasNode.focus({ preventScroll: true }); updateHud();
}
function updateHud() {
  if (!ui.panel) { return; }
  ui.panel.innerHTML = `<h4>${HAT} YOU · INVESTOR</h4>
    <div class="pl-row"><span>Cash</span><span>${moneyK(cash)}</span></div>
    <div class="pl-row"><span>Net worth</span><span>${moneyK(netWorth())}</span></div>
    <div class="pl-row"><span>Properties</span><span>${owned.size} / ${GOAL}</span></div>
    <div class="pl-bar"><i style="width:${owned.size / GOAL * 100}%"></i></div>
    <div class="pl-row bad"><span>Households moved out</span><span>${movedOut}</span></div>`;
  const st = owned.size >= GOAL ? 'You own the street.' : plotHere(distanceWalked) ? (cash >= priceOf(plotHere(distanceWalked)) ? 'Press E to buy' : 'Not enough cash · walk to GO') : cash < PRICE[0] ? 'Out of cash · walk to GO for the bank' : 'Follow the arrow to a FOR SALE sign';
  ui.goal.innerHTML = `<div class="nx"><span class="k">NEXT</span>${st}</div><div class="yrs">Goal: own ${GOAL} properties</div>`;
}
let toastTimer = null, cardTimer = null;
function toast(text) { if (!ui.toast) { return; } ui.toast.textContent = text; ui.toast.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.style.opacity = 0; }, 3000); }
function showMonoCard(title, line, small, col) {
  ui.card.innerHTML = `<div class="t" style="background:${col}">${title}</div><p>${line}</p><p class="s">${small}</p>`;
  ui.card.classList.add('show'); clearTimeout(cardTimer); cardTimer = setTimeout(() => ui.card.classList.remove('show'), 3200);
}
function showEnding() {
  if (ending) { return; }
  ending = true; plotTarget = null; updateHud(); sound.go(); baseNight = 0.55; nightTarget = 0.55;
  // With the street sold, everyone left is priced out too.
  for (const ch of chunks.values()) { for (const p of ch.props) { if (p.kind === 'person' && !p.leaving) { p.leaving = clockT + Math.random() * 1.5; p.box = true; } } }
  ui.end.innerHTML = `<div class="pl-sheet"><div class="band">YOU WIN</div><h1>You own the street.</h1>
    <div class="pl-stats"><div><b>${owned.size}</b>properties</div><div><b>${moneyK(netWorth())}</b>net worth</div><div><b>${movedOut}</b>households moved out</div></div>
    <p class="tip">You won. Nobody lives on your street now.</p>
    <p class="pl-small">Monopoly began in 1904 as The Landlord’s Game, made to show this ending.</p><button>Play again</button></div>`;
  ui.end.querySelector('button').addEventListener('click', e => { e.stopPropagation(); restartWalk(); });
  ui.end.classList.add('show');
}
function restartWalk() {
  lap = 0; cash = START_CASH; market = 1; owned = new Map(); movedOut = 0; ending = false; hintedE = false; baseNight = 0; nightTarget = 0;
  seed += 97; chunks.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
  if (ui.end) { ui.end.classList.remove('show'); }
  startWalk();
}

/* ---------- input ---------- */
function boardKey(e) {
  if (opening.t0 && !opening.done) { skipOpening(); return true; }
  if (intro && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW')) { startWalk(); return true; }
  if (e.code === 'KeyE' || e.code === 'Space') { if (!intro && !ending) { buyHere(); } return true; }
  if (e.code === 'KeyR') { restartWalk(); return true; }
  return false;
}
function boardClick() { if (opening.t0 && !opening.done) { skipOpening(); return true; } return intro || ending; }
