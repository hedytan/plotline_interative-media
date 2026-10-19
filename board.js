/* Plotline — play the board like Monopoly.
 * You start with $1500 and collect $200 every time you pass GO. Some plots along the
 * street are for sale; each has a colour, a price and a title deed, as on the board.
 * Walk up to one and press E to buy it. Own both plots of a colour to complete the set:
 * then you can build houses on them (up to four), and a hotel after that. Your buildings
 * come back near the start of every street you walk into, and as you walk past them your
 * tenants pay you rent, which grows with every house. At a crossing, Left / Right turns
 * the corner into a new street at the same place on the board.
 */
// Colour groups, from the cheap side of the board to the expensive side.
const GROUPS = {
  brown: { col: BOARD_COL.brown, tier: 0, price: 60, house: 50 },
  sky: { col: BOARD_COL.sky, tier: 0, price: 100, house: 50 },
  pink: { col: BOARD_COL.pink, tier: 1, price: 140, house: 100 },
  orange: { col: BOARD_COL.orange, tier: 1, price: 180, house: 100 },
  red: { col: BOARD_COL.red, tier: 2, price: 220, house: 150 },
  yellow: { col: BOARD_COL.yellow, tier: 2, price: 260, house: 150 },
  green: { col: BOARD_COL.green, tier: 3, price: 300, house: 200 },
  mint: { col: '#7fd1a0', tier: 3, price: 320, house: 200 },
  navy: { col: BOARD_COL.navy, tier: 4, price: 350, house: 200 },
  blue: { col: '#6f93d8', tier: 4, price: 400, house: 200 }
};
const GROUP_OF_TIER = [['brown', 'sky'], ['pink', 'orange'], ['red', 'yellow'], ['green', 'mint'], ['navy', 'blue']];
const SET_SIZE = 2;                                   // plots needed to complete a colour set
const RENT_X = [1, 5, 15, 45, 67, 92];               // rent multiplier: bare, 1-4 houses, hotel
const START_MONEY = 1500, GO_SALARY = 200;
const OWNER_COL = '#d4a017', HOUSE_COL = '#2e9e47', HOTEL_COL = '#d8322a';

let wallet = START_MONEY, ownerName = '', portfolio = [], ownedFromC = Infinity, nameBox = null;
let turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, queuedTurn = 0, deedView = null;
const toasts = [], moneyPops = [];

function moneyText(v) { return (v < 0 ? '−$' : '+$') + Math.abs(v); }
function sayToast(text) { toasts.push({ text, t: clockT }); }
function addMoney(v, why) { wallet += v; moneyPops.push({ text: moneyText(v), t: clockT, up: v > 0 }); sound.cash(v > 0); if (why) { sayToast(why); } }
function chunkTier(slot) { return TIER_OF[slot]; }
function ownsSet(group) { return portfolio.filter(p => p.group === group).length >= SET_SIZE; }
function baseRent(group) { return Math.max(2, Math.round(GROUPS[group].price / 10)); }
function rentOf(prop) { const b = baseRent(prop.group); return prop.houses === 0 && ownsSet(prop.group) ? b * 2 : b * RENT_X[prop.houses]; }

/* ---------- Called from chunkAt() ---------- */
function plotsForChunk(ch, r) {
  // Your properties come back near the start of every new street.
  const idx = ch.c - ownedFromC;
  if (idx >= 0 && idx < portfolio.length) {
    const prop = portfolio[idx], cand = ch.lots.filter(L => !L.special);
    if (cand.length) {
      const old = cand[Math.min(cand.length - 1, 1)];
      Object.assign(old, { owned: true, prop, rentDue: true, sign: false, setback: 0 });
    }
  }
  // Each block is one colour group, like a side of the board: one plot for sale on each
  // side of the street, so a colour set can be bought in a single block.
  const group = GROUP_OF_TIER[ch.tier][ch.slot % 2];
  for (const side of [-1, 1]) {
    if (side === 1 && r() < 0.25) { continue; }
    const cand = ch.lots.filter(L => !L.special && !L.owned && L.side === side && L.z0 > ch.z0 + CROSS_W + 4);
    if (cand.length) { const L = cand[Math.floor(r() * cand.length)]; Object.assign(L, { forSale: true, group, price: GROUPS[group].price, setback: 0 }); }
  }
}

/* ---------- Every frame ---------- */
function boardUpdate(z) {
  if (queuedTurn && atCrossing(z)) { const d = queuedTurn; queuedTurn = 0; tryTurn(d); }
  updateTurn();
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (L.owned && L.rentDue && (L.z0 + L.z1) / 2 < z) { L.rentDue = false; addMoney(rentOf(L.prop), `Tenants at ${L.prop.name} pay rent: +$${rentOf(L.prop)}`); }
    }
  }
}
function onPassGo() { addMoney(GO_SALARY, `Passed GO. Collect $${GO_SALARY}.`); }
function onChance(kind) {
  if (kind === 'boom') { addMoney(100, 'Bank error in your favour: +$100'); }
  if (kind === 'crash') { const cost = 25 * portfolio.reduce((n, p) => n + p.houses, 0) + 50; addMoney(-cost, `Street repairs: −$${cost}`); }
}

/* ---------- What is next to you ---------- */
// The for-sale or owned plot beside you, if any.
function plotHere(z) {
  if (turnAnim || nameBox) { return null; }
  let best = null;
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (!L.forSale && !L.owned) { continue; }
      const d = Math.abs((L.z0 + L.z1) / 2 - z);
      if (d < 10 && (!best || d < best.d)) { best = { L, d }; }
    }
  }
  return best ? best.L : null;
}
function actionFor(L) {
  if (!L) { return null; }
  if (L.forSale) { return wallet >= L.price ? { label: `E  ·  Buy this plot  −$${L.price}`, ok: true } : { label: `For sale $${L.price}  ·  you need $${L.price - wallet} more`, ok: false }; }
  const p = L.prop, g = GROUPS[p.group];
  if (p.houses >= 5) { return { label: `${p.name} has a hotel. Rent $${rentOf(p)}`, ok: false }; }
  if (!ownsSet(p.group)) { return { label: `Own both ${p.group} plots to build here`, ok: false }; }
  const what = p.houses === 4 ? 'a hotel' : 'a house';
  return wallet >= g.house ? { label: `E  ·  Build ${what}  −$${g.house}`, ok: true } : { label: `Building ${what} costs $${g.house}`, ok: false };
}
function useHere() {
  const L = plotHere(distanceWalked); if (!L) { return; }
  const act = actionFor(L); if (!act.ok) { sayToast(act.label.replace('E  ·  ', '')); return; }
  if (L.forSale) { buyPlot(L); } else { buildOn(L); }
}
function buyPlot(L) {
  addMoney(-L.price);
  const prop = { name: ownerName || 'My Place', group: L.group, houses: 0, n: portfolio.length + 1 };
  portfolio.push(prop);
  Object.assign(L, { forSale: false, owned: true, prop, rentDue: false, born: clockT + 0.2 });
  deedView = { prop, t: clockT };
  if (!ownerName) { askName(prop); } else { sayToast(ownsSet(L.group) ? `Colour set complete! You can build houses on ${L.group}.` : `You bought a ${L.group} plot.`); }
}
function buildOn(L) {
  const p = L.prop; addMoney(-GROUPS[p.group].house);
  p.houses++; L.born = clockT;                       // the new building rises again
  sayToast(p.houses === 5 ? `A hotel! Rent is now $${rentOf(p)}.` : `House ${p.houses} built. Rent is now $${rentOf(p)}.`);
}
// First purchase: name your place. A small text box over the canvas.
function askName(prop) {
  stepSpeed = 0;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:50%;top:36%;transform:translate(-50%,-50%);background:#fffaee;border-radius:10px;padding:18px 20px;box-shadow:0 6px 24px rgba(0,0,0,.3);font:16px Georgia,serif;color:#2a1e18;text-align:center;z-index:10;width:min(320px,86vw)';
  box.innerHTML = '<div style="font-weight:bold;font-size:18px;margin-bottom:6px">Your first property! Name it</div><div style="font-size:13px;color:#6a5a50;margin-bottom:10px">It goes on all your signs. Press Enter.</div>';
  const input = document.createElement('input');
  input.maxLength = 16; input.placeholder = 'e.g. Hedy’s';
  input.style.cssText = 'width:100%;box-sizing:border-box;font:18px Georgia,serif;padding:8px 10px;border:2px solid #d4a017;border-radius:6px;outline:none;text-align:center';
  box.appendChild(input); document.body.appendChild(box); nameBox = box;
  setTimeout(() => input.focus(), 30);
  const done = () => {
    ownerName = (input.value.trim() || 'My Place').slice(0, 16);
    for (const p of portfolio) { p.name = ownerName; }
    box.remove(); nameBox = null; canvasNode.focus({ preventScroll: true });
    sayToast(`${ownerName} is yours. Buy the other ${prop.group} plot to build houses.`);
  };
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { done(); } });
}

/* ---------- Turning at a crossing ---------- */
function nextCrossing(z) { const local = modN(z, CHUNK_LEN); return local < CROSS_W - 1 ? 0 : CHUNK_LEN - local + 2; }
function atCrossing(z) { const local = modN(z, CHUNK_LEN); return local > 0.5 && local < CROSS_W - 0.5; }
function tryTurn(dir) {
  if (turnAnim || nameBox) { return; }
  if (!atCrossing(distanceWalked)) {
    const ahead = nextCrossing(distanceWalked);
    if (ahead < 30) { queuedTurn = dir; sayToast(`Turning ${dir < 0 ? 'left' : 'right'} at the crossing ahead.`); }
    else { sayToast(`No corner here. The next crossing is ${Math.round(ahead)} m ahead.`); }
    return;
  }
  queuedTurn = 0; turnAnim = { dir, t: clockT }; sound.turn(dir);
}
function updateTurn() {
  if (!turnAnim) { turnYaw = 0; fadeA = Math.max(0, fadeA - 0.05); return; }
  const u = (clockT - turnAnim.t) / 0.85;
  turnYaw = turnAnim.dir * HALF_PI * easeN(Math.min(1, u));
  fadeA = easeN((u - 0.45) / 0.55);
  if (u >= 1) { turnAnim = null; turnYaw = 0; fadeA = 1; newStreet(); }
}
// A fresh street at the same place on the board: new seed, and it builds around you.
function newStreet() {
  const c = Math.floor(distanceWalked / CHUNK_LEN);
  seed += 131; chunks.clear(); firedCasinos.clear(); visitedJails.clear();
  distanceWalked = c * CHUNK_LEN + 3; lastChunk = c; lastTier = -1; ownedFromC = c + 1;
  stepSpeed = 0; dashTarget = null; streetT = clockT; buildSkyline();
}

/* ---------- Drawing on the street ---------- */
// A FOR SALE board in the plot's colour, standing on the empty plot by the pavement.
function drawForSale(L) {
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + 1.4), base = P(x, 0, mid);
  if (base.rz < 1.5 || base.rz > FAR_Z * 0.8) { return; }
  const k = base.k, col = GROUPS[L.group].col, w = 3.2 * k, h = 1.7 * k, top = base.y - 3 * k;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(mid) * 0.8;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(base.x - 0.07 * k, top, 0.14 * k, 3 * k);
  ctx.fillStyle = '#fffaee'; ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = Math.max(1, 0.06 * k);
  ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  ctx.fillStyle = col; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h * 0.38);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${h * 0.24}px Georgia, serif`; ctx.fillStyle = '#fff'; ctx.fillText('FOR SALE', base.x, top - h * 0.2 + h * 0.19);
    ctx.font = `bold ${h * 0.32}px Georgia, serif`; ctx.fillStyle = '#2a1e18'; ctx.fillText(`$${L.price}`, base.x, top - h * 0.2 + h * 0.68);
  }
  ctx.restore();
}
// A box with a pitched roof standing on the plot: one Monopoly house or the hotel.
function drawPiece(L, za, zb, d, h, col) {
  const x = L.side * (EDGE_X + 0.1), xo = x + L.side * d, xm = (x + xo) / 2, z0 = clipZ(za); if (zb <= z0) { return; }
  polyN(wallQuad(x, z0, x, zb, 0, h), toneN(col, midN(z0, zb), 1.05), 'rgba(0,0,0,0.25)', 1);
  if (za > cam.z + NEAR_Z) { polyN(wallQuad(x, za, xo, za, 0, h), toneN(col, za, 0.7)); polyN([P(x, h, za), P(xo, h, za), P(xm, h + d * 0.45, za)], toneN(col, za, 0.62)); }
  polyN([P(x, h, z0), P(x, h, zb), P(xm, h + d * 0.45, zb), P(xm, h + d * 0.45, z0)], toneN(col, midN(z0, zb), 0.82), 'rgba(0,0,0,0.25)', 1);
  // Two windows and a door on the street side.
  const len = zb - za;
  for (const u of [0.18, 0.62]) { const wa = za + len * u, wb = wa + len * 0.2; if (wb > z0) { polyN(wallQuad(x - L.side * 0.05, Math.max(wa, z0), x - L.side * 0.05, wb, h * 0.45, h * 0.75), toneN('#fff2c0', wa)); } }
  const da = za + len * 0.42; if (da + len * 0.16 > z0) { polyN(wallQuad(x - L.side * 0.05, Math.max(da, z0), x - L.side * 0.05, da + len * 0.16, 0, h * 0.42), toneN('#3a2a20', da)); }
}
function drawOwnedLot(L) {
  const p = L.prop, col = GROUPS[p.group].col, len = L.z1 - L.z0, z0 = clipZ(L.z0);
  if (L.z1 <= z0) { return; }
  // The plot, paved in its colour.
  const xa = L.side * (EDGE_X + 0.3), xb = L.side * (EDGE_X + L.depth);
  polyN([P(xa, 0.04, z0), P(xb, 0.04, z0), P(xb, 0.04, L.z1), P(xa, 0.04, L.z1)], rgbaN(col, 0.55), rgbaN(col, 0.9), 2);
  // Giant board pieces, bigger in richer districts so they stand out among the towers.
  const hh = 6 + L.tier * 3;
  if (p.houses === 5) { drawPiece(L, L.z0 + len * 0.06, L.z1 - len * 0.06, Math.max(8, L.depth), hh * 2, HOTEL_COL); }
  else {
    const n = p.houses, slot = len / 4;
    for (let i = n - 1; i >= 0; i--) { drawPiece(L, L.z0 + slot * i + slot * 0.1, L.z0 + slot * (i + 1) - slot * 0.1, Math.max(5, L.depth * 0.7), hh, HOUSE_COL); }
  }
  // A sign by the pavement with your name and a flag.
  const sx = L.side * (EDGE_X + 0.5), sz = Math.max(L.z0 + 0.6, z0 + 0.1), b = P(sx, 0, sz); if (b.rz < 1.2) { return; }
  const k = b.k, w = 2.6 * k, h = 1 * k, top = b.y - 2.6 * k;
  ctx.save(); ctx.fillStyle = '#3a2a20'; ctx.fillRect(b.x - 0.05 * k, top, 0.1 * k, 2.6 * k);
  ctx.fillStyle = '#2a1e18'; ctx.fillRect(b.x - w / 2, top - h, w, h); ctx.strokeStyle = OWNER_COL; ctx.lineWidth = Math.max(1, 0.08 * k); ctx.strokeRect(b.x - w / 2, top - h, w, h);
  if (w > 30) { ctx.fillStyle = '#ffe9a8'; ctx.font = `bold ${h * 0.5}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.name.toUpperCase(), b.x, top - h / 2, w * 0.92); }
  ctx.fillStyle = col; ctx.fillRect(b.x - w / 2, top - h - 0.18 * k, w, 0.18 * k);
  ctx.restore();
}

/* ---------- HUD ---------- */
function drawBoardHud() {
  const z = distanceWalked;
  push(); textFont('Georgia');
  // Title deeds you own, top left.
  const x = 16, y = 16, w = Math.min(250, width * 0.4), rowH = 26, rows = Math.max(1, portfolio.length), h = 44 + rows * rowH;
  noStroke(); fill(0, 50); rect(x + 3, y + 4, w, h, 8); fill(255, 250, 238); rect(x, y, w, h, 8);
  fill(120, 100, 90); textSize(11); textAlign(LEFT, TOP); text('YOUR TITLE DEEDS', x + 14, y + 12);
  if (!portfolio.length) { fill(90, 70, 60); textSize(13); text('None yet. Look for FOR SALE boards.', x + 14, y + 32, w - 24); }
  portfolio.forEach((p, i) => {
    const ry = y + 32 + i * rowH, g = GROUPS[p.group];
    fill(g.col); rect(x + 14, ry, 16, 16, 3);
    fill(40, 30, 24); textSize(13); textStyle(BOLD); text(p.group, x + 38, ry + 1); textStyle(NORMAL);
    for (let k = 0; k < (p.houses < 5 ? p.houses : 0); k++) { fill(HOUSE_COL); rect(x + 96 + k * 14, ry + 3, 10, 10, 2); }
    if (p.houses === 5) { fill(HOTEL_COL); rect(x + 96, ry + 3, 30, 10, 2); }
    fill(90, 70, 60); textAlign(RIGHT, TOP); text(`rent $${rentOf(p)}`, x + w - 12, ry + 1); textAlign(LEFT, TOP);
    if (ownsSet(p.group)) { fill(OWNER_COL); text('★', x + 80, ry); }
  });
  // Wallet, top right.
  const ww = 150, wx = width - ww - 16;
  fill(0, 50); rect(wx + 3, y + 4, ww, 64, 8); fill(255, 250, 238); rect(wx, y, ww, 64, 8);
  fill(120, 100, 90); textSize(11); textAlign(RIGHT, TOP); text('CASH', wx + ww - 14, y + 10);
  fill(40, 30, 24); textStyle(BOLD); textSize(26); text(`$${wallet}`, wx + ww - 14, y + 26); textStyle(NORMAL);
  for (let i = moneyPops.length - 1; i >= 0; i--) {
    const m = moneyPops[i], age = clockT - m.t; if (age > 2) { moneyPops.splice(i, 1); continue; }
    fill(m.up ? '#2f8a3a' : '#c8322a'); textStyle(BOLD); textSize(24); textAlign(RIGHT, TOP); drawingContext.globalAlpha = 1 - easeN((age - 1.2) / 0.8);
    text(m.text, wx + ww - 14, y + 70 + age * 18); drawingContext.globalAlpha = 1; textStyle(NORMAL);
  }
  // The plot beside you: its title deed and what you can do.
  const L = plotHere(z), act = actionFor(L);
  if (L) { drawDeed(L.forSale ? { name: 'For sale', group: L.group, houses: 0 } : L.prop, width - 16 - 190, y + 84, 1); }
  if (act) {
    textStyle(BOLD); textSize(18); const tw = textWidth(act.label) + 40, bx = width / 2 - tw / 2, by = height - 120;
    fill(0, 60); rect(bx + 3, by + 4, tw, 46, 23); fill(act.ok ? color(255, 250, 238) : color(240, 232, 220)); rect(bx, by, tw, 46, 23);
    fill(act.ok ? color(40, 30, 24) : color(110, 90, 80)); textAlign(CENTER, CENTER); text(act.label, width / 2, by + 24);
  }
  // A big deed when you have just bought.
  if (deedView) { const age = clockT - deedView.t; if (age > 4) { deedView = null; } else { const a = easeN(age / 0.3) * (1 - easeN((age - 3.4) / 0.6)); drawDeed(deedView.prop, width / 2 - 110, height * 0.24, a, 220); } }
  // Short messages.
  for (let i = toasts.length - 1; i >= 0; i--) {
    const t = toasts[i], age = clockT - t.t; if (age > 3.4) { toasts.splice(i, 1); continue; }
    drawingContext.globalAlpha = easeN(age / 0.3) * (1 - easeN((age - 2.8) / 0.6));
    textStyle(ITALIC); textSize(16); fill(255); stroke(0, 140); strokeWeight(3); textAlign(CENTER, CENTER); text(t.text, width / 2, height - 150 - (toasts.length - 1 - i) * 26);
    noStroke(); drawingContext.globalAlpha = 1; textStyle(NORMAL);
  }
  // Help line.
  fill(255, 230); textSize(12); textAlign(CENTER, BOTTOM); stroke(0, 100); strokeWeight(2);
  text('↑ walk  ·  Shift hurry  ·  ← → turn at a crossing  ·  E buy / build  ·  mouse look around', width / 2, height - 14);
  pop();
  if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,236,200,${fadeA * 0.85})`; ctx.fillRect(0, 0, width, height); }
}
// A Monopoly-style title deed: colour band, rent with 0-4 houses and a hotel, house cost.
function drawDeed(prop, x, y, a, w = 190) {
  const g = GROUPS[prop.group], b = baseRent(prop.group), s = w / 190;
  push(); drawingContext.globalAlpha = a; noStroke();
  fill(0, 50); rect(x + 3, y + 4, w, 200 * s, 6); fill(255, 252, 244); rect(x, y, w, 200 * s, 6);
  fill(g.col); rect(x + 8 * s, y + 8 * s, w - 16 * s, 38 * s, 3);
  fill(prop.group === 'yellow' || prop.group === 'sky' || prop.group === 'mint' ? 30 : 255); textAlign(CENTER, CENTER); textStyle(BOLD);
  textSize(9 * s); text('TITLE DEED', x + w / 2, y + 18 * s); textSize(14 * s); text(`${prop.group.toUpperCase()} · $${g.price}`, x + w / 2, y + 34 * s);
  textStyle(NORMAL); textSize(11 * s); fill(40, 30, 24);
  const lines = [['Rent', b], ['With 1 house', b * RENT_X[1]], ['With 2 houses', b * RENT_X[2]], ['With 3 houses', b * RENT_X[3]], ['With 4 houses', b * RENT_X[4]], ['With a hotel', b * RENT_X[5]]];
  lines.forEach(([t, v], i) => { const ly = y + (58 + i * 18) * s, here = prop.houses === i; fill(here ? color(200, 50, 40) : color(40, 30, 24)); textStyle(here ? BOLD : NORMAL); textAlign(LEFT, CENTER); text(t, x + 14 * s, ly); textAlign(RIGHT, CENTER); text(`$${v}`, x + w - 14 * s, ly); });
  textStyle(ITALIC); fill(110, 90, 80); textAlign(CENTER, TOP); textSize(10 * s); text(`Houses cost $${g.house} each.\nOwn both ${prop.group} plots to build.`, x + 8 * s, y + 166 * s, w - 16 * s);
  pop();
}

/* ---------- Keys ---------- */
function boardKey(e) {
  const code = e.code;
  if (code === 'KeyE' || code === 'Space') { useHere(); return true; }
  if (code === 'KeyA' || code === 'ArrowLeft') { tryTurn(-1); return true; }
  if (code === 'KeyD' || code === 'ArrowRight') { tryTurn(1); return true; }
  return false;
}
