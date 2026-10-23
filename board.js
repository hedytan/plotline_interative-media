/* Plotline — You Plan the Street.
 * A playful city-planning walk. You're the new planner of an endless board-game street.
 * Every empty plot you walk up to is your call: affordable homes, a developer's tower, a
 * little shop or a park. Each choice rises out of the ground in front of you and changes
 * the street: who comes out to walk on it, what it sounds like, what the land is worth, and
 * how much the next homes will cost. Skip a plot and the market decides for you.
 * Developers pay well for towers; people need homes; parks and shops make a street feel
 * alive. You can't max everything, so the street you walk down ends up being a picture of
 * what you chose. Monopoly asks "how much can you own?"; Plotline asks "who is it for?".
 */
const CHOICES = {
  homes: { key: '1', name: 'Homes', note: 'affordable, for families', col: '#ff9eb5' },
  tower: { key: '2', name: 'Tower', note: 'developers pay big', col: '#7fb2ff' },
  shop: { key: '3', name: 'Shop', note: 'café, bakery, books', col: '#ffc46b' },
  park: { key: '4', name: 'Park', note: 'trees and benches', col: '#7fd18b' }
};
const ORDER = ['homes', 'tower', 'shop', 'park'];
const START_BUDGET = 2000000, PLOTS_PER_WALK = 16;
const SHOP_NAMES_CUTE = ['Bean There', 'Loaf & Co.', 'Paper Moon', 'Petal Shop', 'Little Deli', 'Corner Café', 'Noodle Bar', 'Book Nook', 'Ice Cream', 'Plant Club'];
const PASTEL_HOMES = ['#ffb3c7', '#ffd59e', '#b8e6d0', '#c9b8f0', '#a8d8ff', '#ffe08a', '#f7b2a0'];
const PASTEL_SHOPS = ['#ffd1dc', '#fff0b3', '#c8f0d8', '#d8ccff', '#ffd9b3'];

let budget = START_BUDGET, housed = 0, vibe = 40, landValue = 1, built = [], plotTarget = null;
let turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, queuedTurn = 0, nameBox = null;
let ending = null, intro = true, ownedFromC = Infinity;
const toasts = [], moneyPops = [];
const HIDE_DISTRICT_CARD = true;

const money = v => (v < 0 ? '−' : '') + '$' + (Math.abs(v) >= 1e6 ? (Math.abs(v) / 1e6).toFixed(2) + 'M' : Math.round(Math.abs(v) / 1000) + 'k');
function sayToast(text) { toasts.push({ text, t: clockT }); }
function popMoney(v) { moneyPops.push({ text: (v >= 0 ? '+' : '') + money(v), t: clockT, up: v >= 0 }); }
// What a choice costs or earns right now: homes get dearer as land value rises; towers earn more.
function effectOf(kind) {
  if (kind === 'homes') { return { money: -Math.round(400000 * landValue), housed: 60, vibe: 6, land: 0 }; }
  if (kind === 'tower') { return { money: Math.round(900000 * landValue), housed: 8, vibe: -10, land: 0.12 }; }
  if (kind === 'shop') { return { money: 150000, housed: 0, vibe: 10, land: 0.03 }; }
  return { money: -300000, housed: 0, vibe: 14, land: 0.05 };
}
function canAfford(kind) { return budget + effectOf(kind).money >= 0; }
function chunkTier() { return 1; }   // every block starts as the same cosy board; you decide the rest
function soundTier() {
  const n = built.length || 1, towers = built.filter(k => k === 'tower').length / n;
  if (towers > 0.45) { return 4; } if (vibe > 70) { return 2; } if (vibe > 40) { return 1; } return 0;
}

/* ---------- Called from chunkAt(): every block is a row of empty plots ---------- */
function plotsForChunk(ch, r) {
  // Each side of a block: two plots. One is waiting for you; the other is already a cosy neighbour.
  ch.lots = [];
  for (const side of [-1, 1]) {
    const open = r() < 0.5 ? 0 : 1, span = CHUNK_LEN - CROSS_W - 1.6, len = span / 2 - 0.4;
    for (let i = 0; i < 2; i++) {
      const z = ch.z0 + CROSS_W + 0.6 + i * (len + 0.8), L = makeLot(null, 1, side, z, len, r);
      if (i === open) { Object.assign(L, { pending: true, sign: false, setback: 0, depth: 12 }); }
      else { Object.assign(L, { color: pickN(r, PASTEL_HOMES), awning: pickN(r, ['#ff7aa2', '#5fb3ff', '#ffb347', '#6cc58a']), H: mixN(6, 9, r()), setback: 0 }); }
      ch.lots.push(L);
    }
  }
  ch.back = ch.back.map(b => Object.assign(b, { color: pickN(r, ['#d9cff5', '#cfe6ff', '#ffd9e4', '#d6f0e0']), h: b.h * 0.8 }));
}
function canRise(L) { return !L.pending; }

/* ---------- Deciding a plot ---------- */
function decide(L, kind, byMarket) {
  const fx = effectOf(kind), r = rngN(L.seed + 3);
  budget += fx.money; housed += fx.housed; vibe = constrain(vibe + fx.vibe, 0, 100); landValue += fx.land;
  if (fx.money) { popMoney(fx.money); sound.cash(fx.money > 0); }
  const tier = kind === 'tower' ? 4 : kind === 'shop' ? 3 : 1;
  const b = makeLot(null, tier, L.side, L.z0, L.z1 - L.z0, r);
  Object.assign(L, { pending: false, kind, byMarket: !!byMarket, tier, H: b.H, depth: b.depth, color: b.color, accent: b.accent, awning: b.awning, crown: b.crown, spire: b.spire, glass: b.glass, setback: 0, born: clockT + 0.05 });
  if (kind === 'homes') { Object.assign(L, { color: pickN(r, PASTEL_HOMES), awning: pickN(r, ['#ff7aa2', '#5fb3ff', '#ffb347', '#6cc58a']), name: 'HOMES FOR ALL', sign: false }); }
  if (kind === 'shop') { Object.assign(L, { color: pickN(r, PASTEL_SHOPS), glass: false, H: mixN(7, 10, r()), name: pickN(r, SHOP_NAMES_CUTE), sign: true }); }
  if (kind === 'tower') { Object.assign(L, { color: pickN(r, ['#9cc4ff', '#b4d0ff', '#a6e0f5']), H: b.H * 0.75 }); }
  built.push(kind);
  // People come out onto the pavement in front of homes, shops and parks.
  const ch = [...chunks.values()].find(c => c.lots.includes(L));
  const n = { homes: 5, shop: 4, park: 6, tower: 0 }[kind];
  for (let i = 0; i < n && ch; i++) {
    ch.props.push({ kind: 'person', x: L.side * mixN(ROAD_W + 1, EDGE_X - 0.7, r()), z: mixN(L.z0, L.z1, r()), z0: L.z0 - 6, z1: L.z1 + 6, v: (r() < 0.5 ? -1 : 1) * mixN(0.5, 1.2, r()), tone: r(), h: kind === 'park' && r() < 0.4 ? 1.1 : mixN(1.5, 1.8, r()), ph: r() * 6, dog: r() < 0.2, born: clockT + 0.6 + r() * 0.8 });
  }
  if (kind === 'park') { for (let i = 0; i < 7 && ch; i++) { ch.props.push({ kind: 'tree', x: L.side * mixN(EDGE_X + 1.5, EDGE_X + 11, r()), z: mixN(L.z0 + 1, L.z1 - 1, r()), h: mixN(4, 7, r()), tone: r(), born: clockT + r() * 0.6 }); } }
  const msg = byMarket
    ? (kind === 'tower' ? 'Nobody decided, so the market did: another tower.' : 'Nobody decided, so the market did: a shop.')
    : { homes: `Homes for 60 people. Land is pricier now, so the next homes cost ${money(effectOf('homes').money)}.`, tower: 'A developer pays well. Most flats will be bought as investments.', shop: 'Somewhere to get a coffee. The street wakes up.', park: 'Trees, benches, a dog park. People come out.' }[kind];
  sayToast(msg);
  if (built.length >= PLOTS_PER_WALK && !ending) { setTimeout(() => { if (!ending) { ending = { t: clockT }; sound.go(); } }, 2500); }
}
function useChoice(kind) {
  if (intro) { intro = false; return; }
  if (!plotTarget || ending) { return; }
  if (!canAfford(kind)) { sayToast(`Not enough budget for ${CHOICES[kind].name.toLowerCase()}. A tower or a shop would bring money in.`); return; }
  decide(plotTarget, kind, false); plotTarget = null;
}

/* ---------- Every frame ---------- */
function boardUpdate(z) {
  if (queuedTurn && atCrossing(z)) { const d = queuedTurn; queuedTurn = 0; tryTurn(d); }
  updateTurn();
  // The plot you're walking up to is the one you decide.
  let best = null;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (!L.pending) { continue; } const d = (L.z0 + L.z1) / 2 - z; if (d > 5 && d < 42 && (!best || d < best.d)) { best = { L, d }; } } }
  plotTarget = intro || ending ? null : best ? best.L : null;
  // Plots you walk past without deciding go to the market.
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (!L.pending) { continue; } const mid = (L.z0 + L.z1) / 2;
      if (mid < z - 25 || ((intro || ending) && mid < z + 3)) { L.pending = false; }   // behind you before you arrived: just a neighbour
      else if (mid < z + 3) { decide(L, landValue > 1.25 ? 'tower' : 'shop', true); }
    }
  }
  // People stroll up and down in front of where they live.
  const dt = Math.min(deltaTime / 1000, 0.05);
  for (const ch of chunks.values()) { for (const p of ch.props) { if (p.kind === 'person' && p.v) { p.z += p.v * dt; if (p.z > p.z1 || p.z < p.z0) { p.v = -p.v; } } } }
}
function onPassGo() {
  if (intro || ending) { return; }
  const rates = housed * 2000; budget += rates; if (rates) { popMoney(rates); sound.cash(true); }
  sayToast(rates ? `Council rates from your residents: +${money(rates)}` : 'Pass GO. No residents, no rates.');
}
function onChance() {}

/* ---------- Turning ---------- */
function nextCrossing(z) { const local = modN(z, CHUNK_LEN); return local < CROSS_W - 1 ? 0 : CHUNK_LEN - local + 2; }
function atCrossing(z) { const local = modN(z, CHUNK_LEN); return local > 0.5 && local < CROSS_W - 0.5; }
function tryTurn(dir) {
  if (turnAnim || intro || ending) { return; }
  if (!atCrossing(distanceWalked)) {
    const ahead = nextCrossing(distanceWalked);
    if (ahead < 30) { queuedTurn = dir; sayToast(`Turning ${dir < 0 ? 'left' : 'right'} at the next corner.`); } else { sayToast(`The next corner is ${Math.round(ahead)} m ahead.`); }
    return;
  }
  queuedTurn = 0; turnAnim = { dir, t: clockT }; sound.turn(dir);
}
function updateTurn() {
  if (!turnAnim) { turnYaw = 0; fadeA = Math.max(0, fadeA - 0.05); return; }
  const u = (clockT - turnAnim.t) / 0.85;
  turnYaw = turnAnim.dir * HALF_PI * easeN(Math.min(1, u)); fadeA = easeN((u - 0.45) / 0.55);
  if (u >= 1) { turnAnim = null; turnYaw = 0; fadeA = 1; newStreet(); sayToast('A new street, waiting for you to plan it.'); }
}
function newStreet() {
  const c = Math.floor(distanceWalked / CHUNK_LEN);
  seed += 131; chunks.clear(); firedCasinos.clear(); visitedJails.clear();
  distanceWalked = c * CHUNK_LEN + 3; lastChunk = c; lastTier = -1;
  stepSpeed = 0; dashTarget = null; streetT = clockT; buildSkyline();
}
function restartWalk() {
  budget = START_BUDGET; housed = 0; vibe = 40; landValue = 1; built = []; ending = null; intro = true; plotTarget = null;
  seed += 97; chunks.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
}

/* ---------- Drawing on the street ---------- */
function drawForSale() {}
// The plot you're about to decide: a glowing outline and a bouncing marker.
function drawTargetMarker() {
  if (!plotTarget) { return; }
  const L = plotTarget, mid = (L.z0 + L.z1) / 2, xa = L.side * (EDGE_X + 0.3), xb = L.side * (EDGE_X + L.depth), z0 = clipZ(L.z0);
  if (L.z1 <= z0) { return; }
  const pulse = 0.5 + 0.5 * Math.sin(clockT * 5);
  ctx.save(); ctx.setLineDash([]);
  polyN([P(xa, 0.06, z0), P(xb, 0.06, z0), P(xb, 0.06, L.z1), P(xa, 0.06, L.z1)], `rgba(255,255,255,${0.25 + pulse * 0.2})`, `rgba(255,120,170,${0.7 + pulse * 0.3})`, 3);
  ctx.restore();
  const q = P((xa + xb) / 2, 4 + Math.sin(clockT * 3) * 0.4, mid); if (q.rz < 2) { return; }
  const s = Math.max(14, Math.min(36, q.k * 1.2));
  ctx.save(); ctx.fillStyle = '#ff6fa0'; ctx.beginPath(); ctx.arc(q.x, q.y, s, 0, TWO_PI); ctx.fill();
  ctx.beginPath(); ctx.moveTo(q.x - s * 0.5, q.y + s * 0.8); ctx.lineTo(q.x + s * 0.5, q.y + s * 0.8); ctx.lineTo(q.x, q.y + s * 1.5); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `bold ${s * 1.2}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', q.x, q.y + s * 0.05);
  ctx.restore();
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
function drawBillboard() {} function drawOpenHome() {}
// A park plot: soft grass, a path and a bench (trees are props so they sort with the street).
function drawOwnedLot(L) {
  const z0 = clipZ(L.z0); if (L.z1 <= z0) { return; }
  const xa = L.side * (EDGE_X + 0.2), xb = L.side * (EDGE_X + 14);
  polyN([P(xa, 0.05, z0), P(xb, 0.05, z0), P(xb, 0.05, L.z1), P(xa, 0.05, L.z1)], toneN('#8fdc8a', midN(z0, L.z1)));
  const pa = L.side * (EDGE_X + 3), pb = L.side * (EDGE_X + 4.4);
  polyN([P(pa, 0.07, z0), P(pb, 0.07, z0), P(pb, 0.07, L.z1), P(pa, 0.07, L.z1)], toneN('#f3e3c3', midN(z0, L.z1)));
  for (const u of [0.3, 0.7]) {
    const bz = L.z0 + (L.z1 - L.z0) * u; if (bz < z0) { continue; } const q = P(L.side * (EDGE_X + 2.4), 0, bz); if (q.rz < 1) { continue; }
    const k = q.k; ctx.fillStyle = toneN('#c27a4a', bz); ctx.fillRect(q.x - 0.7 * k, q.y - 0.5 * k, 1.4 * k, 0.14 * k); ctx.fillRect(q.x - 0.7 * k, q.y - 0.9 * k, 1.4 * k, 0.12 * k);
    ctx.fillStyle = toneN('#5a4a6a', bz); ctx.fillRect(q.x - 0.6 * k, q.y - 0.5 * k, 0.08 * k, 0.5 * k); ctx.fillRect(q.x + 0.52 * k, q.y - 0.5 * k, 0.08 * k, 0.5 * k);
  }
}
function isCustomLot(L) { return L.kind === 'park'; }

/* ---------- HUD ---------- */
function bar(x, y, w, v, col) { noStroke(); fill(235, 228, 245); rect(x, y, w, 8, 4); fill(col); rect(x, y, w * constrain(v, 0, 1), 8, 4); }
function drawIcon(kind, x, y, s) {
  push(); noStroke(); rectMode(CENTER);
  if (kind === 'homes') { fill('#ff7aa2'); rect(x, y + s * 0.15, s * 0.8, s * 0.6, 4); fill('#d9486f'); triangle(x - s * 0.5, y - s * 0.1, x + s * 0.5, y - s * 0.1, x, y - s * 0.5); fill('#fff6e0'); rect(x, y + s * 0.25, s * 0.2, s * 0.35, 2); }
  else if (kind === 'tower') { fill('#5f9dff'); rect(x, y, s * 0.45, s * 1.05, 3); fill('#d8e8ff'); for (let i = 0; i < 4; i++) { rect(x - s * 0.1, y - s * 0.35 + i * s * 0.22, s * 0.1, s * 0.1); rect(x + s * 0.1, y - s * 0.35 + i * s * 0.22, s * 0.1, s * 0.1); } }
  else if (kind === 'shop') { fill('#ffb347'); rect(x, y + s * 0.15, s * 0.85, s * 0.6, 4); fill('#ff7a7a'); for (let i = 0; i < 4; i++) { rect(x - s * 0.32 + i * s * 0.21, y - s * 0.2, s * 0.2, s * 0.18, 2); } fill('#fff6e0'); rect(x, y + s * 0.25, s * 0.5, s * 0.25, 2); }
  else { fill('#8a5a3a'); rect(x, y + s * 0.3, s * 0.12, s * 0.4); fill('#57c06a'); circle(x, y - s * 0.05, s * 0.75); fill('#7fd18b'); circle(x - s * 0.15, y - s * 0.15, s * 0.35); }
  pop();
}
function drawBoardHud() {
  push(); textFont('Georgia');
  if (!intro && !ending) {
    // Your street so far, top left.
    const x = 16, y = 16, w = Math.min(260, width * 0.4), h = 132;
    noStroke(); fill(80, 60, 120, 40); rect(x + 3, y + 5, w, h, 14); fill(255, 253, 248); rect(x, y, w, h, 14);
    fill(150, 120, 170); textSize(11); textAlign(LEFT, TOP); textStyle(BOLD); text('YOUR STREET', x + 16, y + 12); textStyle(NORMAL);
    fill(60, 50, 80); textSize(13);
    text(`Budget  ${money(budget)}`, x + 16, y + 32);
    text(`People housed  ${housed}`, x + 16, y + 52);
    fill(60, 50, 80); text('Street life', x + 16, y + 74); bar(x + 100, y + 79, w - 116, vibe / 100, '#ff8fb3');
    fill(60, 50, 80); text('Land value', x + 16, y + 96); bar(x + 100, y + 101, w - 116, (landValue - 0.8) / 1.6, '#7fb2ff');
    fill(150, 120, 170); textSize(11); text(`${built.length} / ${PLOTS_PER_WALK} plots planned`, x + 16, y + 114);
    for (let i = moneyPops.length - 1; i >= 0; i--) {
      const m = moneyPops[i], a = clockT - m.t; if (a > 2) { moneyPops.splice(i, 1); continue; }
      fill(m.up ? '#2f9a5a' : '#e0457a'); textStyle(BOLD); textSize(20); textAlign(LEFT, TOP); drawingContext.globalAlpha = 1 - easeN((a - 1.2) / 0.8);
      text(m.text, x + w + 12, y + 26 - a * 14); drawingContext.globalAlpha = 1; textStyle(NORMAL);
    }
    // Choice cards for the plot ahead.
    if (plotTarget) {
      const cw = Math.min(150, (width - 60) / 4), ch = 128, gap = 10, total = cw * 4 + gap * 3, bx = width / 2 - total / 2, by = height - ch - 40;
      fill(60, 50, 80); textAlign(CENTER, BOTTOM); textStyle(BOLD); textSize(16); stroke(255); strokeWeight(4); text('What goes on this plot?', width / 2, by - 10); noStroke();
      ORDER.forEach((kind, i) => {
        const c = CHOICES[kind], fx = effectOf(kind), ok = canAfford(kind), cx = bx + i * (cw + gap), lift = ok ? Math.sin(clockT * 3 + i) * 2 : 0;
        drawingContext.globalAlpha = ok ? 1 : 0.5;
        fill(80, 60, 120, 40); rect(cx + 3, by + 5 + lift, cw, ch, 14); fill(255, 253, 248); rect(cx, by + lift, cw, ch, 14);
        fill(c.col); rect(cx, by + lift, cw, 6, 14, 14, 0, 0);
        drawIcon(kind, cx + cw / 2, by + 34 + lift, 34);
        fill(60, 50, 80); textAlign(CENTER, TOP); textStyle(BOLD); textSize(15); text(`${c.key}  ${c.name}`, cx + cw / 2, by + 60 + lift); textStyle(NORMAL);
        textSize(11); fill(120, 100, 140); text(c.note, cx + cw / 2, by + 79 + lift);
        textSize(12); fill(fx.money >= 0 ? '#2f9a5a' : '#e0457a'); text(`${fx.money >= 0 ? '+' : ''}${money(fx.money)}`, cx + cw / 2, by + 97 + lift);
        fill(120, 100, 140); text(fx.housed ? `+${fx.housed} people` : fx.vibe > 0 ? `+${fx.vibe} life` : `${fx.vibe} life`, cx + cw / 2, by + 112 - 2 + lift);
        drawingContext.globalAlpha = 1;
      });
    }
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i], a = clockT - t.t; if (a > 3.6) { toasts.splice(i, 1); continue; }
      drawingContext.globalAlpha = easeN(a / 0.3) * (1 - easeN((a - 3) / 0.6));
      textStyle(BOLD); textSize(15); fill(60, 50, 80); stroke(255); strokeWeight(5); textAlign(CENTER, CENTER);
      text(t.text, width / 2, (plotTarget ? height - 230 : height - 90) - (toasts.length - 1 - i) * 26); noStroke(); drawingContext.globalAlpha = 1;
    }
    fill(90, 80, 120); textSize(12); textAlign(RIGHT, TOP); textStyle(NORMAL); stroke(255); strokeWeight(3);
    text('↑ walk · Shift hurry · 1–4 choose · ← → turn at a corner · mouse look', width - 16, 16); noStroke();
  }
  if (intro) {
    storyCard('PLOTLINE: YOU PLAN THE STREET', ['You’re the new planner of this street.', 'Every empty plot you walk up to is yours to decide:', 'homes, a tower, a shop or a park.', 'Developers pay well for towers. People need homes.', 'Parks and shops bring the street to life.', 'Skip a plot, and the market decides for you.'], 'Click, or press any number, to start walking');
  }
  if (ending) { drawPostcard(easeN((clockT - ending.t) / 1.2)); }
  pop();
  if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,248,240,${fadeA * 0.85})`; ctx.fillRect(0, 0, width, height); }
}
function storyCard(title, lines, foot, a = 1) {
  push(); drawingContext.globalAlpha = a; noStroke();
  fill(80, 60, 120, 70); rect(0, 0, width, height);
  const w = Math.min(560, width - 32), h = 120 + lines.length * 26, x = width / 2 - w / 2, y = height / 2 - h / 2;
  fill(255, 253, 248); rect(x, y, w, h, 18); fill('#ff8fb3'); rect(x, y, w, 50, 18, 18, 0, 0);
  fill(255); textStyle(BOLD); textSize(18); textAlign(CENTER, CENTER); text(title, width / 2, y + 25);
  textStyle(NORMAL); textSize(15); fill(60, 50, 80); textAlign(CENTER, TOP);
  lines.forEach((ln, i) => text(ln, x + 20, y + 68 + i * 26, w - 40));
  textStyle(BOLD); fill('#e0457a'); textSize(14); textAlign(CENTER, CENTER); text(foot, width / 2, y + h - 24);
  pop();
}
// The ending: a postcard of the street you planned, drawn as a little skyline.
function drawPostcard(a) {
  const n = built.length || 1, count = k => built.filter(b => b === k).length;
  const towers = count('tower'), homes = count('homes'), parks = count('park'), shops = count('shop'), market = built.length;
  const title = towers / n > 0.5 ? 'A city of empty towers' : homes / n >= 0.35 ? 'A street people can live on' : parks / n >= 0.3 ? 'A garden street' : shops / n >= 0.35 ? 'A lively high street' : 'A bit of everything';
  push(); drawingContext.globalAlpha = a; noStroke();
  fill(80, 60, 120, 80); rect(0, 0, width, height);
  const w = Math.min(640, width - 32), h = 380, x = width / 2 - w / 2, y = height / 2 - h / 2;
  fill(255, 253, 248); rect(x, y, w, h, 18);
  fill('#cfe8ff'); rect(x + 20, y + 20, w - 40, 150, 12);
  fill('#9fd98a'); rect(x + 20, y + 150, w - 40, 20, 0, 0, 12, 12);
  const step = (w - 60) / n;
  built.forEach((k, i) => {
    const bx = x + 30 + i * step + step / 2, gy = y + 150, s = Math.min(step * 0.9, 40);
    if (k === 'tower') { fill('#7fb2ff'); rect(bx - s * 0.3, gy - s * 2.6, s * 0.6, s * 2.6, 3); fill('#d8e8ff'); for (let j = 0; j < 6; j++) { rect(bx - s * 0.15, gy - s * 2.4 + j * s * 0.38, s * 0.3, s * 0.12); } }
    else if (k === 'homes') { fill(PASTEL_HOMES[i % PASTEL_HOMES.length]); rect(bx - s * 0.4, gy - s * 0.8, s * 0.8, s * 0.8, 3); fill('#e0457a'); triangle(bx - s * 0.48, gy - s * 0.8, bx + s * 0.48, gy - s * 0.8, bx, gy - s * 1.25); }
    else if (k === 'shop') { fill('#ffc46b'); rect(bx - s * 0.42, gy - s * 0.7, s * 0.84, s * 0.7, 3); fill('#ff7a7a'); rect(bx - s * 0.45, gy - s * 0.78, s * 0.9, s * 0.16, 3); }
    else { fill('#57c06a'); circle(bx, gy - s * 0.55, s * 0.8); fill('#8a5a3a'); rect(bx - s * 0.05, gy - s * 0.25, s * 0.1, s * 0.25); }
  });
  fill(60, 50, 80); textAlign(CENTER, TOP); textStyle(BOLD); textSize(22); text(title, width / 2, y + 186);
  textStyle(NORMAL); textSize(14); fill(90, 80, 120);
  text(`${homes} homes · ${towers} towers · ${shops} shops · ${parks} parks${built.some(Boolean) ? '' : ''}`, width / 2, y + 220);
  text(`${housed} people housed · budget ${money(budget)} · street life ${Math.round(vibe)}/100`, width / 2, y + 244);
  const tip = towers > homes ? 'The towers paid for everything, but most of their flats sit empty.' : homes > 0 && budget < 200000 ? 'You housed people, and it cost almost everything you had.' : 'Every plot was a choice between profit and people.';
  textStyle(ITALIC); text(tip, x + 30, y + 276, w - 60);
  textStyle(NORMAL); fill(150, 120, 170); textSize(12); text('Monopoly asks how much you can own. Plotline asks who the street is for.', x + 30, y + 318, w - 60);
  textStyle(BOLD); fill('#e0457a'); textSize(14); text('Press R to plan another street', width / 2, y + h - 30);
  pop();
}

/* ---------- Keys ---------- */
function boardKey(e) {
  const code = e.code;
  const num = { Digit1: 'homes', Digit2: 'tower', Digit3: 'shop', Digit4: 'park', Numpad1: 'homes', Numpad2: 'tower', Numpad3: 'shop', Numpad4: 'park' }[code];
  if (num) { useChoice(num); return true; }
  if (intro && (code === 'Space' || code === 'Enter' || code === 'KeyE')) { intro = false; return true; }
  if (code === 'KeyR') { restartWalk(); return true; }
  if (code === 'KeyA' || code === 'ArrowLeft') { tryTurn(-1); return true; }
  if (code === 'KeyD' || code === 'ArrowRight') { tryTurn(1); return true; }
  return false;
}
// Clicking a choice card works too.
function boardClick(mx, my) {
  if (intro) { intro = false; return true; }
  if (!plotTarget || ending) { return false; }
  const cw = Math.min(150, (width - 60) / 4), ch = 128, gap = 10, total = cw * 4 + gap * 3, bx = width / 2 - total / 2, by = height - ch - 40;
  for (let i = 0; i < 4; i++) { const cx = bx + i * (cw + gap); if (mx > cx && mx < cx + cw && my > by && my < by + ch) { useChoice(ORDER[i]); return true; } }
  return false;
}
