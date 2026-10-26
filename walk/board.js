/* Plotline — The Landlord's Walk.
 * Monopoly began in 1904 as Lizzie Magie's "The Landlord's Game", a warning about how
 * landlords get richer while tenants pay. Plotline walks you back into that warning.
 *
 * You are 24, you rent a room, and you are saving for a deposit. Walk forward and the street
 * grows grander. Every lap past GO is a year: pay day, rent day, and you get a year older.
 * Billboards along the street are generated from the prices around you. FOR SALE plots tick
 * up while you look at them, and investors sometimes buy them before you get there.
 * Each year at GO, your rent goes up and you choose: stay and pay, or move further out (cheaper,
 * but a longer commute). A NEXT line and a pink arrow always show what to do. Buy a home if you
 * can; the walk ends when you do, or at 30.
 */
const START_AGE = 24, END_AGE = 30, START_SAVINGS = 22000;
const WAGES = 52000, LIVING = 24000, RENT_WEEK = 380;     // take-home pay, living costs, rent
const BASE_PRICE = [520000, 780000, 1600000, 2400000, 4800000];  // by district tier, inner city
const ZONE_PRICE = 0.8, DEPOSIT = 0.1, GROWTH = 0.07;          // prices fall 20% per zone out; 7% a year
const ZONE_NAMES = ['Inner city', 'Inner ring', 'Middle ring', 'Outer suburbs', 'New estates', 'Paddock estates'];
const OWNER_COL = '#d4a017', HOUSE_COL = '#2e9e47';

let wallet = START_SAVINGS, lifeAge = START_AGE, zone = 0, market = 1, rentPaid = 0, rentWeek = RENT_WEEK;
let turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, queuedTurn = 0, nameBox = null;
let ownedFromC = Infinity, home = null, ending = null, intro = true, landlordMode = false, lapStartT = 0;
const toasts = [], moneyPops = [];

const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const moneyK = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M' : '$' + Math.round(v / 1000) + 'k';
function commuteMin() { return 15 + zone * 25; }
function commuteText() { const m = commuteMin(); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; }
function sayToast(text) { toasts.push({ text, t: clockT }); }
function popMoney(v, label) { moneyPops.push({ text: (v < 0 ? '−' : '+') + money(Math.abs(v)) + (label ? '  ' + label : ''), t: clockT + moneyPops.length * 0.35, up: v > 0 }); }
function addMoney(v, label) { wallet += v; popMoney(v, label); sound.cash(v > 0); }
function priceOf(L) { return BASE_PRICE[L.tier] * Math.pow(ZONE_PRICE, zone) * market * L.priceK; }
function chunkTier(slot) { return Math.max(0, TIER_OF[slot] - zone); }

/* ---------- Generated billboards ---------- */
// Sentence templates; {tokens} are filled with live numbers from the street around you.
const SIGNS = {
  0: ['Charming fixer-upper. Roof sold separately.', 'Rent {rent}/wk. Mould included at no extra cost.', 'Cosy! (It means small.)', 'Room in share house. 6 housemates, 1 bathroom, endless vibes.', 'Walk to everything you can’t afford.'],
  1: ['{people} people at today’s inspection. Bring a CV.', 'Must love stairs, no parking and your landlord.', 'Renovated: we painted it grey.', 'Just {deposit} deposit. Just 6 years of saving.', 'Light-filled! (One window.)'],
  2: ['Gated for your safety. (From you.)', 'Your dream home. Someone else’s investment.', 'Heritage charm from {price}. Heritage wages not included.', 'Live where your barista can’t.', 'Second home? Third home? Why stop?'],
  3: ['Luxury apartments. 80% empty. 100% sold.', 'Off the plan from {price}. Off your budget forever.', 'Rooftop pool for owners. Rooftop view of it for renters.', 'Prices up {growth}% this year. Wages up 3%.', 'Invest in bricks. Live in a shoebox.'],
  4: ['Penthouse {price}. Studio from your dreams.', 'Sky homes for people who already have homes.', 'Exclusive: nobody you know lives here.', 'Your rent paid for this view.', 'Buy now. Prices only go up. (For us.)'],
  out: ['New estate! Commute just {commute}.', 'Paddock to palace. Shops coming 2041.', 'Room to breathe. Nothing to do.', 'Only {commute} to the city. Each way.'],
  landlord: ['Welcome, landlord. Rent goes up Monday.', 'Your tenant is 24 and saving for a deposit. Sound familiar?', 'Raise the rent? Everyone else is.', 'Congratulations. You are the market now.']
};
function fillSign(text, tier) {
  const L = { tier, priceK: 1 };
  return text.replace('{rent}', money(rentWeek * (1 + tier * 0.6))).replace('{people}', 25 + tier * 12 + Math.floor(Math.random() * 15))
    .replace('{price}', moneyK(priceOf(L))).replace('{deposit}', moneyK(priceOf(L) * DEPOSIT))
    .replace('{growth}', Math.round(GROWTH * 100 + 4)).replace(/{commute}/g, commuteText());
}
function pickSign(tier, r) {
  const pool = landlordMode ? SIGNS.landlord : zone >= 3 && r() < 0.5 ? SIGNS.out : SIGNS[tier];
  return fillSign(pool[Math.floor(r() * pool.length)], tier);
}

/* ---------- Called from chunkAt() ---------- */
function plotsForChunk(ch, r) {
  // Your home appears near the start of every new street once you own it.
  if (home && ch.c === ownedFromC) {
    const cand = ch.lots.filter(L => !L.special);
    if (cand.length) { Object.assign(cand[Math.min(1, cand.length - 1)], { owned: true, sign: false, setback: 0 }); }
  }
  // One or two plots for sale per block; some will be bought by investors before you get there.
  for (const side of [-1, 1]) {
    if (r() < 0.35) { continue; }
    const cand = ch.lots.filter(L => !L.special && !L.owned && L.side === side && L.z0 > ch.z0 + CROSS_W + 4);
    if (cand.length) {
      const L = cand[Math.floor(r() * cand.length)];
      Object.assign(L, { forSale: true, priceK: mixN(0.85, 1.2, r()), setback: 0, investorAt: r() < 0.35 ? mixN(22, 45, r()) : -1 });
    }
  }
  // Billboards on the pavement, written from the prices on this block.
  for (let i = 0; i < 2; i++) {
    if (r() < 0.25) { continue; }
    const side = i === 0 ? -1 : 1, z = ch.z0 + CROSS_W + 6 + r() * (CHUNK_LEN - CROSS_W - 12);
    ch.props.push({ kind: 'billboard', x: side * (ROAD_W + 1.4), z, side, text: pickSign(ch.tier, r), col: DISTRICTS[ch.tier].stripe[0] });
  }
  // An open home with a queue down the pavement, in the cheaper districts.
  if (ch.tier <= 2 && r() < 0.55) {
    const L = ch.lots.find(l => !l.special && !l.forSale && !l.owned && l.tier <= 2);
    if (L) {
      const n = 8 + Math.floor(r() * 10), zz = L.z0 + 1;
      ch.props.push({ kind: 'openhome', x: L.side * (EDGE_X - 0.4), z: zz, side: L.side, n });
      for (let k = 0; k < n; k++) { ch.props.push({ kind: 'person', x: L.side * (EDGE_X - 1.2 - (k % 2) * 0.5), z: zz - 1.2 - k * 0.75, tone: r(), h: mixN(1.55, 1.85, r()), ph: r() * 6 }); }
    }
  }
}

/* ---------- Every frame ---------- */
function boardUpdate(z) {
  if (queuedTurn && atCrossing(z)) { const d = queuedTurn; queuedTurn = 0; tryTurn(d); }
  updateTurn();
  if (!paused && !intro && !ending) { market *= 1 + GROWTH * Math.min(deltaTime / 1000, 0.05) / 100; }   // ~7% for every 100 s walked
  // Investors buy plots out from under you.
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (L.forSale && L.investorAt > 0 && (L.z0 + L.z1) / 2 - z < L.investorAt) {
        const tower = makeLot(null, Math.min(4, L.tier + 2), L.side, L.z0, L.z1 - L.z0, rngN(L.seed));
        Object.assign(L, { forSale: false, investorAt: -1, sold: true, born: clockT + 0.2, H: tower.H, depth: tower.depth, color: tower.color, tier: tower.tier, crown: tower.crown, spire: tower.spire, glass: tower.glass, name: 'SOLD', sign: true });
        ch.props.push({ kind: 'billboard', x: L.side * (ROAD_W + 1.4), z: (L.z0 + L.z1) / 2, side: L.side, text: 'SOLD to an investor. Will sit empty.', col: '#c8322a', born: clockT });
        sound.jail(); sayToast('Sold, to an investor. Before you even got there.');
      }
    }
  }
  if (home && !ending && clockT - home.t > 6) { endWalk('owner'); }
}
// Every lap past GO is a year.
function onPassGo() {
  if (ending || intro) { return; }
  lifeAge++; const rentYear = rentWeek * 52; rentPaid += rentYear;
  addMoney(WAGES, 'wages'); setTimeout(() => addMoney(-rentYear, 'rent'), 500); setTimeout(() => addMoney(-LIVING, 'living costs'), 1000);
  if (home) { setTimeout(() => addMoney(rentWeek * 52 * 0.9, 'rent from your tenant'), 1500); }
  rentWeek = Math.round(rentWeek * 1.06);
  sayToast(`A year passes. You’re ${lifeAge}. Your rent goes up to ${money(rentWeek)}/wk.`);
  if (lifeAge >= END_AGE && !home) { setTimeout(() => endWalk('renter'), 2400); return; }
  // Every year, the same choice renters make: pay the new rent, or move further out.
  if (!home && zone < ZONE_NAMES.length - 1) { setTimeout(() => { if (!ending) { nameBox = { t: clockT, stay: rentWeek, move: Math.round(rentWeek * 0.8) }; } }, 1800); }
}
function chooseMove(move) {
  const c = nameBox; if (!c) { return; } nameBox = null;
  if (move) { rentWeek = c.move; turnAnim = { dir: -1, t: clockT }; sound.turn(-1); }
  else { sayToast(`You stay. Rent ${money(rentWeek)}/wk.`); }
}
function onChance(kind) {
  if (kind === 'boom') { market *= 1.08; sayToast('Interest rates cut! Everything for sale just went up 8%.'); }
  if (kind === 'crash') { rentWeek += 40; sayToast(`Rates rise. Your landlord passes it on: rent ${money(rentWeek)}/wk.`); }
}

/* ---------- The plot beside you ---------- */
function plotHere(z) {
  if (turnAnim || intro || ending) { return null; }
  let best = null;
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (!L.forSale) { continue; }
      const d = Math.abs((L.z0 + L.z1) / 2 - z);
      if (d < 10 && (!best || d < best.d)) { best = { L, d }; }
    }
  }
  return best ? best.L : null;
}
function actionFor(L) {
  if (!L) { return null; }
  if (home) { return { label: 'You already own a home.', ok: false }; }
  const dep = priceOf(L) * DEPOSIT;
  return wallet >= dep ? { label: `E  ·  Buy it  (deposit ${money(dep)})`, ok: true } : { label: `Deposit ${money(dep)}  ·  you have ${money(wallet)}`, ok: false };
}
function useHere() {
  if (intro) { intro = false; return; }
  if (ending || nameBox) { return; }
  const L = plotHere(distanceWalked), act = actionFor(L); if (!act) { sayToast('Walk to a FOR SALE sign first.'); return; }
  if (!act.ok) { sayToast(home ? act.label : `Not enough for the deposit yet.`); return; }
  const price = priceOf(L), dep = price * DEPOSIT;
  addMoney(-dep, 'deposit');
  home = { price, t: clockT, commute: commuteText(), zone, lifeAge };
  Object.assign(L, { forSale: false, owned: true, born: clockT + 0.2, rentDue: false });
  landlordMode = true;
  sayToast(`You bought a home! ${commuteText()} from the city.`);
}
function endWalk(kind) { if (ending) { return; } ending = { kind, t: clockT }; sound.go(); baseNight = 0.6; nightTarget = 0.6; }
function restartWalk() {
  nameBox = null; wallet = START_SAVINGS; lifeAge = START_AGE; zone = 0; market = 1; rentPaid = 0; rentWeek = RENT_WEEK; home = null; ending = null; landlordMode = false;
  baseNight = 0; nightTarget = 0; ownedFromC = Infinity; intro = true;
  seed += 97; chunks.clear(); firedCasinos.clear(); visitedJails.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
}

/* ---------- Turning: left moves you further out, right moves you back in ---------- */
function nextCrossing(z) { const local = modN(z, CHUNK_LEN); return local < CROSS_W - 1 ? 0 : CHUNK_LEN - local + 2; }
function atCrossing(z) { const local = modN(z, CHUNK_LEN); return local > 0.5 && local < CROSS_W - 0.5; }
function tryTurn(dir) {
  if (turnAnim || intro || ending) { return; }
  if (!atCrossing(distanceWalked)) {
    const ahead = nextCrossing(distanceWalked);
    if (ahead < 30) { queuedTurn = dir; sayToast(`Turning ${dir < 0 ? 'left (further out)' : 'right (toward the city)'} at the crossing ahead.`); }
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
  if (u >= 1) {
    const dir = turnAnim.dir; turnAnim = null; turnYaw = 0; fadeA = 1;
    zone = constrain(zone - dir, 0, ZONE_NAMES.length - 1);
    newStreet();
    sayToast(dir < 0 ? `Further out: ${ZONE_NAMES[zone]}. Prices −20%. Commute ${commuteText()}.` : `Back toward the city: ${ZONE_NAMES[zone]}. Commute ${commuteText()}.`);
  }
}
function newStreet() {
  const c = Math.floor(distanceWalked / CHUNK_LEN);
  seed += 131; chunks.clear(); firedCasinos.clear(); visitedJails.clear();
  distanceWalked = c * CHUNK_LEN + 3; lastChunk = c; lastTier = -1; ownedFromC = c + 1;
  stepSpeed = 0; dashTarget = null; streetT = clockT; buildSkyline();
}

/* ---------- Drawing on the street ---------- */
function drawForSale(L) {
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + 1.4), base = P(x, 0, mid);
  if (base.rz < 1.5 || base.rz > FAR_Z * 0.8) { return; }
  const k = base.k, w = 3.4 * k, h = 1.9 * k, top = base.y - 3 * k;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(mid) * 0.8;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(base.x - 0.07 * k, top, 0.14 * k, 3 * k);
  ctx.fillStyle = '#fffaee'; ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = Math.max(1, 0.06 * k);
  ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  ctx.fillStyle = '#c8322a'; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h * 0.34);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${h * 0.2}px Georgia, serif`; ctx.fillStyle = '#fff'; ctx.fillText('FOR SALE', base.x, top - h * 0.2 + h * 0.17);
    ctx.font = `bold ${h * 0.27}px Georgia, serif`; ctx.fillStyle = '#2a1e18'; ctx.fillText(moneyK(priceOf(L)), base.x, top - h * 0.2 + h * 0.52);
    ctx.font = `${h * 0.15}px Georgia, serif`; ctx.fillStyle = '#7a5a4a'; ctx.fillText(`deposit ${moneyK(priceOf(L) * DEPOSIT)}`, base.x, top - h * 0.2 + h * 0.8);
  }
  ctx.restore();
}
// A big roadside billboard; the text is generated from the street's own prices.
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
    const size = Math.max(7, h * 0.16); ctx.font = `bold ${size}px Georgia, serif`;
    const words = p.text.split(' '), lines = []; let line = '';
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w * 0.86 && line) { lines.push(line); line = wd; } else { line = t; } }
    lines.push(line);
    const lh = size * 1.15, y0 = top - h / 2 - (lines.length - 1) * lh / 2;
    lines.slice(0, 4).forEach((ln, i) => ctx.fillText(ln, x, y0 + i * lh));
  }
  ctx.restore();
}
// People queueing for an open home.
function drawPerson(q, p) {
  const k = q.k; if (k < 1.5) { return; }
  const h = p.h, sway = Math.sin(clockT * 1.5 + p.ph) * 0.03 * k;
  const coats = ['#3f5a7a', '#7a3f4a', '#4a6a4a', '#8a6a3a', '#5a4a6a', '#2a3a4a', '#9a5a3a'], skin = ['#e8c4a0', '#c8946a', '#8a5a3a', '#f0d0b0'];
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = toneN('#2a2a30', p.z); ctx.fillRect(q.x - 0.14 * k, q.y - 0.8 * k, 0.11 * k, 0.8 * k); ctx.fillRect(q.x + 0.03 * k, q.y - 0.8 * k, 0.11 * k, 0.8 * k);
  ctx.fillStyle = toneN(coats[Math.floor(p.tone * coats.length)], p.z);
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(q.x - 0.24 * k + sway, q.y - (h - 0.25) * k, 0.48 * k, (h - 1.05) * k, 0.12 * k) : ctx.rect(q.x - 0.24 * k + sway, q.y - (h - 0.25) * k, 0.48 * k, (h - 1.05) * k); ctx.fill();
  ctx.fillStyle = toneN(skin[Math.floor(p.tone * 7) % skin.length], p.z); ctx.beginPath(); ctx.arc(q.x + sway, q.y - (h - 0.12) * k, 0.13 * k, 0, TWO_PI); ctx.fill();
  if (p.tone > 0.6) { ctx.fillStyle = '#e8e8f0'; ctx.fillRect(q.x + 0.15 * k + sway, q.y - (h - 0.55) * k, 0.12 * k, 0.2 * k); }   // a phone, checking listings
  ctx.restore();
}
function drawOpenHome(q, p) {
  const k = q.k; if (k < 2) { return; }
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(q.x - 0.05 * k, q.y - 2.6 * k, 0.1 * k, 2.6 * k);
  ctx.fillStyle = '#c8322a'; ctx.fillRect(q.x - 1 * k, q.y - 2.6 * k, 2 * k, 0.8 * k);
  if (k > 14) { ctx.fillStyle = '#fff'; ctx.font = `bold ${0.32 * k}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OPEN HOME', q.x, q.y - 2.32 * k); ctx.font = `${0.2 * k}px Georgia, serif`; ctx.fillText(`${p.n * 4} registered`, q.x, q.y - 2.02 * k); }
  ctx.restore();
}
// A small box with a pitched roof: your home.
function drawPiece(L, za, zb, d, h, col) {
  const x = L.side * (EDGE_X + 0.1), xo = x + L.side * d, xm = (x + xo) / 2, z0 = clipZ(za); if (zb <= z0) { return; }
  polyN(wallQuad(x, z0, x, zb, 0, h), toneN(col, midN(z0, zb), 1.05), 'rgba(0,0,0,0.25)', 1);
  if (za > cam.z + NEAR_Z) { polyN(wallQuad(x, za, xo, za, 0, h), toneN(col, za, 0.7)); polyN([P(x, h, za), P(xo, h, za), P(xm, h + d * 0.45, za)], toneN(col, za, 0.62)); }
  polyN([P(x, h, z0), P(x, h, zb), P(xm, h + d * 0.45, zb), P(xm, h + d * 0.45, z0)], toneN(col, midN(z0, zb), 0.82), 'rgba(0,0,0,0.25)', 1);
  const len = zb - za;
  for (const u of [0.18, 0.62]) { const wa = za + len * u, wb = wa + len * 0.2; if (wb > z0) { polyN(wallQuad(x - L.side * 0.05, Math.max(wa, z0), x - L.side * 0.05, wb, h * 0.45, h * 0.75), toneN('#fff2c0', wa)); } }
  const da = za + len * 0.42; if (da + len * 0.16 > z0) { polyN(wallQuad(x - L.side * 0.05, Math.max(da, z0), x - L.side * 0.05, da + len * 0.16, 0, h * 0.42), toneN('#3a2a20', da)); }
}
function drawOwnedLot(L) {
  const len = L.z1 - L.z0, z0 = clipZ(L.z0); if (L.z1 <= z0) { return; }
  const xa = L.side * (EDGE_X + 0.3), xb = L.side * (EDGE_X + L.depth);
  polyN([P(xa, 0.04, z0), P(xb, 0.04, z0), P(xb, 0.04, L.z1), P(xa, 0.04, L.z1)], rgbaN('#6f9a52', 0.8));
  drawPiece(L, L.z0 + len * 0.2, L.z1 - len * 0.2, Math.max(5, L.depth * 0.7), 5, HOUSE_COL);
  const b = P(L.side * (EDGE_X + 0.5), 0, Math.max(L.z0 + 0.6, z0 + 0.1)); if (b.rz < 1.2) { return; }
  const k = b.k, w = 2.4 * k, h = 0.9 * k, top = b.y - 2.4 * k;
  ctx.save(); ctx.fillStyle = '#3a2a20'; ctx.fillRect(b.x - 0.05 * k, top, 0.1 * k, 2.4 * k);
  ctx.fillStyle = '#2a1e18'; ctx.fillRect(b.x - w / 2, top - h, w, h); ctx.strokeStyle = OWNER_COL; ctx.lineWidth = Math.max(1, 0.08 * k); ctx.strokeRect(b.x - w / 2, top - h, w, h);
  if (w > 30) { ctx.fillStyle = '#ffe9a8'; ctx.font = `bold ${h * 0.45}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('HOME', b.x, top - h / 2); }
  ctx.restore();
}

/* ---------- HUD ---------- */
function drawBoardHud() {
  const z = distanceWalked;
  push(); textFont('Georgia');
  if (!intro && !ending) {
    // Your life, top left.
    const x = 16, y = 16, w = Math.min(270, width * 0.42), h = 104;
    noStroke(); fill(0, 50); rect(x + 3, y + 4, w, h, 8); fill(255, 250, 238); rect(x, y, w, h, 8);
    fill(120, 100, 90); textSize(11); textAlign(LEFT, TOP); text(`AGE ${lifeAge}  ·  ${home ? 'HOME OWNER' : 'RENTING'}`, x + 14, y + 12);
    fill(40, 30, 24); textStyle(BOLD); textSize(17); text(ZONE_NAMES[zone], x + 14, y + 30); textStyle(NORMAL);
    fill(90, 70, 60); textSize(13);
    text(`Commute: ${commuteText()}`, x + 14, y + 56);
    text(home ? `Your tenant pays you ${money(rentWeek * 0.9)}/wk` : `Rent: ${money(rentWeek)}/wk  ·  paid so far ${moneyK(rentPaid)}`, x + 14, y + 76, w - 24);
    // Savings, top right.
    const ww = 170, wx = width - ww - 16;
    fill(0, 50); rect(wx + 3, y + 4, ww, 64, 8); fill(255, 250, 238); rect(wx, y, ww, 64, 8);
    fill(120, 100, 90); textSize(11); textAlign(RIGHT, TOP); text('SAVINGS', wx + ww - 14, y + 10);
    fill(40, 30, 24); textStyle(BOLD); textSize(24); text(money(wallet), wx + ww - 14, y + 26); textStyle(NORMAL);
    for (let i = moneyPops.length - 1; i >= 0; i--) {
      const m = moneyPops[i], age2 = clockT - m.t; if (age2 > 2.4) { moneyPops.splice(i, 1); continue; } if (age2 < 0) { continue; }
      fill(m.up ? '#2f8a3a' : '#c8322a'); textStyle(BOLD); textSize(16); textAlign(RIGHT, TOP); drawingContext.globalAlpha = 1 - easeN((age2 - 1.6) / 0.8);
      text(m.text, wx + ww - 14, y + 72 + age2 * 16); drawingContext.globalAlpha = 1; textStyle(NORMAL);
    }
    // The plot beside you.
    const L = plotHere(z), act = actionFor(L);
    if (L) { drawListing(L, width - 16 - 200, y + 84); }
    if (act) {
      textStyle(BOLD); textSize(17); const tw = textWidth(act.label) + 40, bx = width / 2 - tw / 2, by = height - 116;
      fill(0, 60); rect(bx + 3, by + 4, tw, 44, 22); fill(act.ok ? color(255, 250, 238) : color(240, 232, 220)); rect(bx, by, tw, 44, 22);
      fill(act.ok ? color(40, 30, 24) : color(110, 90, 80)); textAlign(CENTER, CENTER); text(act.label, width / 2, by + 23); textStyle(NORMAL);
    }
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i], a2 = clockT - t.t; if (a2 > 3.6) { toasts.splice(i, 1); continue; }
      drawingContext.globalAlpha = easeN(a2 / 0.3) * (1 - easeN((a2 - 3) / 0.6));
      textStyle(ITALIC); textSize(16); fill(255); stroke(0, 140); strokeWeight(3); textAlign(CENTER, CENTER); text(t.text, width / 2, height - 146 - (toasts.length - 1 - i) * 26);
      noStroke(); drawingContext.globalAlpha = 1; textStyle(NORMAL);
    }
    fill(255, 230); textSize(12); textAlign(CENTER, BOTTOM); stroke(0, 100); strokeWeight(2);
    text('↑ walk  ·  E buy  ·  mouse look', width / 2, height - 14); noStroke();
    drawNextBar();
  }
  if (intro) { storyCard('THE LANDLORD’S WALK', [`You’re 24, renting, $22k saved.`, 'Buy a home before you turn 30.'], 'Click or press E to start'); }
  if (ending) {
    const lines = ending.kind === 'owner'
      ? [`You bought a home at ${home.lifeAge}, ${home.commute} from the city.`, `It cost ${money(home.price)}. You’ll be paying it off until you’re ${home.lifeAge + 30}.`, `Along the way you paid ${money(rentPaid)} in rent.`, `Prices rose ${Math.round((market - 1) * 100)}% while you saved.`, 'You’re a landlord now, too. Someone your age rents from you.']
      : [`You’re ${lifeAge}, and you’re still renting.`, `You paid ${money(rentPaid)} in rent.`, `You saved ${money(wallet)}.`, `Prices rose ${Math.round((market - 1) * 100)}% while you saved.`, 'The street grew grander every year. None of it was yours.'];
    storyCard(ending.kind === 'owner' ? 'YOU OWN A HOME' : 'STILL RENTING', [...lines, '', 'Monopoly began in 1904 as The Landlord’s Game, a warning about landlords.'], 'Press R to walk again', easeN((clockT - ending.t) / 1.2));
  }
  if (nameBox && !ending) { drawMoveChoice();
  }
  pop();
  if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,236,200,${fadeA * 0.85})`; ctx.fillRect(0, 0, width, height); }
}
function storyCard(title, lines, foot, a = 1) {
  push(); drawingContext.globalAlpha = a; noStroke();
  fill(20, 14, 10, 120); rect(0, 0, width, height);
  const w = Math.min(560, width - 32), h = 120 + lines.length * 26, x = width / 2 - w / 2, y = height / 2 - h / 2;
  fill(255, 250, 238); rect(x, y, w, h, 10); fill('#c8322a'); rect(x, y, w, 46, 10, 10, 0, 0);
  fill(255); textStyle(BOLD); textSize(18); textAlign(CENTER, CENTER); text(title, width / 2, y + 23);
  textStyle(NORMAL); textSize(15); fill(40, 30, 24); textAlign(CENTER, TOP);
  lines.forEach((ln, i) => { if (i === lines.length - 1 && ln.startsWith('Monopoly')) { textStyle(ITALIC); fill(110, 90, 80); } text(ln, x + 20, y + 62 + i * 26, w - 40); });
  textAlign(CENTER, CENTER);
  textStyle(BOLD); fill('#c8322a'); textSize(14); text(foot, width / 2, y + h - 24);
  pop();
}
// A listing card in the style of a Monopoly title deed.
function drawListing(L, x, y) {
  const price = priceOf(L), dep = price * DEPOSIT, w = 200, weekly = price * 0.9 * 0.065 / 52;
  push(); noStroke(); fill(0, 50); rect(x + 3, y + 4, w, 168, 6); fill(255, 252, 244); rect(x, y, w, 168, 6);
  fill(DISTRICTS[L.tier].stripe[0]); rect(x + 8, y + 8, w - 16, 38, 3);
  fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(9); text('TITLE DEED · FOR SALE', x + w / 2, y + 18); textSize(13); text(DISTRICTS[L.tier].name.toUpperCase(), x + w / 2, y + 34);
  textStyle(NORMAL); textSize(12); fill(40, 30, 24);
  const rows = [['Price', moneyK(price)], ['Deposit (10%)', money(dep)], ['Repayments', money(weekly) + '/wk'], ['Commute', commuteText()], ['Your savings', money(wallet)]];
  rows.forEach(([a, b], i) => { const ly = y + 60 + i * 20, short = i === 4 && wallet < dep; fill(short ? color(200, 50, 40) : color(40, 30, 24)); textAlign(LEFT, CENTER); text(a, x + 14, ly); textAlign(RIGHT, CENTER); text(b, x + w - 14, ly); });
  textStyle(ITALIC); fill(110, 90, 80); textAlign(CENTER, CENTER); textSize(10); text('Price rises while you read this.', x + w / 2, y + 158);
  pop();
}

/* ---------- Keys ---------- */
function boardKey(e) {
  const code = e.code;
  if (nameBox && (code === 'Digit1' || code === 'Numpad1')) { chooseMove(false); return true; }
  if (nameBox && (code === 'Digit2' || code === 'Numpad2')) { chooseMove(true); return true; }
  if (code === 'KeyE' || code === 'Space' || code === 'Enter' && intro) { useHere(); return true; }
  if (code === 'KeyR') { restartWalk(); return true; }
  return false;
}

/* ---------- What to do next: one line at the top, and a pink arrow in the street ---------- */
function nextForSale() {
  let best = null; const z = distanceWalked;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (!L.forSale) { continue; } const m = (L.z0 + L.z1) / 2; if (m - z > -6 && m - z < 90 && (!best || m < best.m)) { best = { L, m }; } } }
  return best;
}
function nextText() {
  if (home) { return 'You own a home.'; }
  const L = plotHere(distanceWalked);
  if (L) { const dep = priceOf(L) * DEPOSIT; return wallet >= dep ? 'Press E to buy it' : `Deposit ${moneyK(dep)} · you have ${moneyK(wallet)} · keep walking to GO`; }
  return 'Walk to the next FOR SALE sign';
}
function drawNextBar() {
  const t = nextText(); push(); textFont('Georgia'); textStyle(BOLD); textSize(17);
  const w = textWidth(t) + 90, x = width / 2 - w / 2, y = 16;
  noStroke(); fill(0, 60); rect(x + 3, y + 4, w, 40, 20); fill(42, 30, 24); rect(x, y, w, 40, 20);
  fill('#ffd23f'); rect(x + 10, y + 11, 52, 18, 9); fill(42, 30, 24); textSize(10); textAlign(CENTER, CENTER); text('NEXT', x + 36, y + 20.5);
  fill(255, 236, 190); textSize(17); textAlign(LEFT, CENTER); text(t, x + 72, y + 21);
  fill(220, 200, 180); textStyle(NORMAL); textSize(11); textAlign(CENTER, TOP); text(`Goal: buy a home before 30 · ${END_AGE - lifeAge} years left`, width / 2, y + 46);
  pop();
}
function drawTargetMarker() {
  if (intro || ending || home || nameBox) { return; }
  const n = nextForSale(); if (!n || n.m - distanceWalked < 3) { return; }
  const q = P(n.L.side * (EDGE_X + 1.4), 4.6 + Math.abs(Math.sin(clockT * 3)) * 0.8, n.m); if (q.rz < 2 || q.rz > 95) { return; }
  const s = Math.max(14, Math.min(40, q.k * 1.1));
  ctx.save(); ctx.fillStyle = '#ff4f9a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(q.x - s * 0.6, q.y - s * 1.3); ctx.lineTo(q.x + s * 0.6, q.y - s * 1.3); ctx.lineTo(q.x + s * 0.6, q.y - s * 0.6); ctx.lineTo(q.x + s, q.y - s * 0.6); ctx.lineTo(q.x, q.y + s * 0.3); ctx.lineTo(q.x - s, q.y - s * 0.6); ctx.lineTo(q.x - s * 0.6, q.y - s * 0.6); ctx.closePath();
  ctx.stroke(); ctx.fill(); ctx.restore();
}
// The yearly choice at GO: two big cards.
function moveCards() {
  const w = Math.min(260, (width - 60) / 2), h = 170, gap = 20, x0 = width / 2 - w - gap / 2, y = height / 2 - h / 2 + 20;
  return [{ x: x0, y, w, h, move: false }, { x: x0 + w + gap, y, w, h, move: true }];
}
function drawMoveChoice() {
  const c = nameBox, a = easeN((clockT - c.t) / 0.4), nz = Math.min(zone + 1, ZONE_NAMES.length - 1), commuteNext = 15 + nz * 25;
  push(); drawingContext.globalAlpha = a; noStroke(); fill(20, 14, 10, 130); rect(0, 0, width, height);
  fill(255); textFont('Georgia'); textStyle(BOLD); textSize(24); textAlign(CENTER, CENTER); text('Your rent went up. Stay or move?', width / 2, height / 2 - 90);
  const fmtC = m => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);
  const info = [
    ['1 · STAY', ZONE_NAMES[zone], `${money(c.stay)}/wk`, `Commute ${fmtC(commuteMin())}`, '#c8322a'],
    ['2 · MOVE FURTHER OUT', ZONE_NAMES[nz], `${money(c.move)}/wk`, `Commute ${fmtC(commuteNext)}`, '#3f8fd6']
  ];
  moveCards().forEach((b, i) => {
    const [t, place, rent, com, col] = info[i], hov = mouseX > b.x && mouseX < b.x + b.w && mouseY > b.y && mouseY < b.y + b.h;
    fill(0, 70); rect(b.x + 3, b.y + 5, b.w, b.h, 12); fill(hov ? color(255, 255, 248) : color(255, 250, 238)); rect(b.x, b.y - (hov ? 4 : 0), b.w, b.h, 12);
    fill(col); rect(b.x, b.y - (hov ? 4 : 0), b.w, 38, 12, 12, 0, 0);
    fill(255); textSize(14); text(t, b.x + b.w / 2, b.y + 19 - (hov ? 4 : 0));
    fill(40, 30, 24); textSize(18); text(place, b.x + b.w / 2, b.y + 64 - (hov ? 4 : 0));
    textSize(24); text(rent, b.x + b.w / 2, b.y + 100 - (hov ? 4 : 0));
    textStyle(NORMAL); textSize(14); fill(110, 90, 80); text(com, b.x + b.w / 2, b.y + 136 - (hov ? 4 : 0)); textStyle(BOLD);
  });
  pop();
}
function boardClick(mx, my) {
  if (nameBox) { for (const b of moveCards()) { if (mx > b.x && mx < b.x + b.w && my > b.y && my < b.y + b.h) { chooseMove(b.move); return true; } } return true; }
  if (intro) { intro = false; return true; }
  return false;
}
