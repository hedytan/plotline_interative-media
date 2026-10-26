/* Plotline: The Landlord's Game, lived.
 * Monopoly began in 1904 as Lizzie Magie's "The Landlord's Game", a warning about how landlords
 * get richer while tenants pay. This walks you onto that board as a 24-year-old renter.
 *  - The street is the board. Every lap past GO is a year: salary in, rent and living costs out.
 *  - The signs are satire, written from the live numbers around you (rent, prices, your savings).
 *  - Press E at a FOR SALE plot to make an offer. In the city an investor's token always outbids
 *    you, and the plot becomes an empty tower with a hotel on top.
 *  - Every lap the board grows: investors upgrade the inner streets and two new estates are added
 *    at the far end. The only homes you can afford are on the newest, furthest streets.
 *  - You can't outbid them, but you can talk back: hold the mouse on a sign to spray your own words
 *    over it. Every sign you rewrite slows rent rises and brings people out; enough of them and the
 *    rules change: a community land trust starts selling homes at cost, in the city.
 * The walk ends when you buy, or at 30.
 */
const START_AGE = 24, END_AGE = 30, START_SAVINGS = 22000, WAGES = 52000, LIVING = 24000, RENT_START = 380;
const BASE_TIER = [0, 1, 2, 3, 4, 4], BASE_PRICE = [520000, 780000, 1600000, 2400000, 4800000], EST_PRICE = 470000, GROWTH = 0.07, DEPOSIT = 0.1;
const INVESTORS = ['SKYLINE GROUP', 'CAPITAL HOMES', 'APEX LIVING', 'GOLDLEAF PROPERTY', 'PRIME ESTATES'];
const SIGNS = {
  0: ['Charming fixer-upper. Roof sold separately.', 'Rent {rent}/wk. Mould included at no extra cost.', 'Cosy! (It means small.)', 'Walk to everything you can’t afford.'],
  1: ['{people} people at today’s inspection. Bring a CV.', 'Renovated: we painted it grey.', 'Just {deposit} deposit. Just {years} years of saving.', 'Light-filled! (One window.)'],
  2: ['Gated for your safety. (From you.)', 'Your dream home. Someone else’s investment.', 'Live where your barista can’t.', 'Second home? Third home? Why stop?'],
  3: ['Luxury apartments. 80% empty. 100% sold.', 'Off the plan from {price}. Off your budget forever.', 'Prices up 11% this year. Wages up 3%.', 'Invest in bricks. Live in a shoebox.'],
  4: ['Penthouse {price}. That’s {rentyears} years of your rent.', 'Sky homes for people who already have homes.', 'Exclusive: nobody you know lives here.', 'Your rent paid for this view.'],
  estate: ['New estate! Commute just {commute}.', 'Paddock to palace. Shops coming 2041.', 'Room to breathe. Nothing to do.', 'Only {commute} to the city. Each way.', 'Train line coming soon™.']
};
const WALLS = {
  0: ['RENT +12% FROM MONDAY', 'NO PETS · NO KIDS · NO LEASE'], 1: ['57 PEOPLE AT THE OPEN HOME', 'YOUR RENT PAYS MY MORTGAGE'],
  2: ['PRIVATE. GATED. YOURS?', 'SOLD · ABOVE RESERVE'], 3: ['INVEST NOW · 7% YIELD', 'NEGATIVELY GEARED, POSITIVELY GREAT'],
  4: ['82% SOLD TO INVESTORS', 'LIVE ABOVE IT ALL'], estate: ['AFFORDABLE* (*2H COMMUTE)', 'NEW ESTATE · NO TRAIN YET']
};
const CHANCE = [
  ['CHANCE', 'Interest rates rise.', 'Your landlord passes it on. Rent +$40 a week.', s => { rentWeek += 40; }],
  ['COMMUNITY CHEST', 'Bank error in your landlord’s favour.', 'Collect nothing.', () => {}],
  ['CHANCE', 'Your lease is not renewed.', 'Moving costs: pay $2,400.', () => { savings -= 2400; }],
  ['COMMUNITY CHEST', 'The community can’t afford a chest.', 'It rents one instead.', () => {}],
  ['CHANCE', 'Advance to the nearest open home.', '64 people are ahead of you.', () => {}],
  ['CHANCE', 'Interest rates cut!', 'Everything for sale just went up 8%.', () => { market *= 1.08; }]
];
const BANDS = [['#c0392b', '#ffffff'], ['#1f2a44', '#f4d58d'], ['#f4d58d', '#2a2440'], ['#ffffff', '#c0392b']];

// Hooks sketch.js expects.
let plotTarget = null, turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, nameBox = null, ending = false, intro = true, ownedFromC = Infinity;
const HIDE_DISTRICT_CARD = true;
// The game.
let lap = 0, rentRise = 0.06, rewrites = [], paint = 0, spraying = false, aimSign = null, lookAim = 0, mouseXY = [0, 0], hiss = null, hinted = {}, holdUntil = 0, savings = START_SAVINGS, rentWeek = RENT_START, rentPaid = 0, market = 1, outbid = 0, soldAhead = 0, home = null, tokens = [], offer = null;
let opening = { t0: null, built: false, sparkle: false, done: false }, ui = {};
const texCache = new Map();

const money = v => (v < 0 ? '−$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-AU');
const moneyK = v => (v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M' : '$' + Math.round(v / 1000) + 'k');
const ageNow = () => START_AGE + lap;
const commuteText = m => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`);

/* ---------- the board grows every lap ---------- */
const lapLen = L => 6 + 2 * L;   // 6 city blocks, then the estates: two more every year
function boardSlot(c) {
  if (c < 0) { return { lap: 0, slot: 5, tier: 4, estate: false, estateLap: -1 }; }
  let L = 0, s = c; while (s >= lapLen(L)) { s -= lapLen(L); L++; }
  if (s < 6) { return { lap: L, slot: s, tier: Math.min(4, BASE_TIER[s] + L), estate: false, estateLap: -1 }; }
  const p = Math.floor((s - 6) / 2) + 1;   // the year this estate was added
  return { lap: L, slot: s, tier: Math.min(3, 1 + Math.max(0, L - p)), estate: true, estateLap: p };
}
function chunkTier(slot) { return 0; }
function streetLabel(ch) {
  if (ch.slot === 0) { return 'GO  ➜'; }
  if (ch.estate) { return ch.estateLap === ch.lap ? 'NEW ESTATE' : 'OLD ESTATE'; }
  return DISTRICTS[ch.tier].name.toUpperCase();
}
function estateCommute(p) { return 55 + 25 * Math.max(0, p - 1); }
function priceOf(L) {
  if (L.trust) { return 480000 * Math.pow(1.03, lap) * L.priceK; }
  if (L.estateLap !== undefined && L.estateLap >= 0) { return EST_PRICE * Math.pow(0.88, L.estateLap) * market * L.priceK; }
  return BASE_PRICE[L.tier] * market * L.priceK;
}
function soundTier() { const ch = chunks.get(Math.floor(distanceWalked / CHUNK_LEN)); return ch ? ch.tier : 0; }
function canRise() { return opening.built; }
function landmarkScale() { return 1; }
function updateTurn() { turnYaw = 0; }
function isCustomLot(L) { return !!L.mine; }

/* ---------- each block: plots for sale, signs, open homes, the jail ---------- */
function fillSign(text, ch) {
  const L = { tier: ch.tier, priceK: 1, estateLap: ch.estate ? ch.estateLap : -1 }, price = priceOf(L), dep = price * DEPOSIT;
  return text.replace('{rent}', money(rentWeek)).replace('{people}', 25 + ch.tier * 12 + Math.floor(Math.random() * 15)).replace('{price}', moneyK(price))
    .replace('{deposit}', moneyK(dep)).replace('{years}', Math.max(2, Math.round((dep - savings) / 8000))).replace('{rentyears}', Math.round(price / (rentWeek * 52)))
    .replace(/{commute}/g, commuteText(estateCommute(Math.max(0, ch.estateLap))));
}
function plotsForChunk(ch, r) {
  const pool = ch.estate ? SIGNS.estate : SIGNS[ch.tier], walls = ch.estate ? WALLS.estate : WALLS[ch.tier];
  if (ch.estate) {
    // Thin rows of identical project homes in the paddocks; most of them for sale.
    ch.lots = ch.lots.filter(() => r() > 0.3);
    for (const L of ch.lots) { Object.assign(L, { color: pickN(r, ['#d9cbb4', '#cfc6b8', '#e0d4c0', '#cbbfae']), estateLap: ch.estateLap, sign: false }); }
    for (const L of ch.lots) { if (r() < 0.45) { Object.assign(L, { forSale: true, priceK: mixN(0.92, 1.08, r()), setback: 0, investorAt: -1 }); } }
  } else {
    for (const side of [-1, 1]) {
      if (r() < 0.3) { continue; }
      const cand = ch.lots.filter(L => !L.special && L.side === side && L.z0 > ch.z0 + CROSS_W + 4);
      if (cand.length) { const L = cand[Math.floor(r() * cand.length)]; Object.assign(L, { forSale: true, priceK: mixN(0.85, 1.2, r()), setback: 0, investorAt: r() < 0.45 ? mixN(24, 45, r()) : -1 }); }
    }
    // Once enough of the street has talked back, a community land trust sells homes at cost.
    if (rewrites.length >= TRUST_AT && r() < 0.8) { const cand = ch.lots.filter(L => !L.special && !L.forSale); if (cand.length) { makeTrust(pickN(r, cand)); } }
    // Jail sits in the block after GO: just visiting.
    if (ch.slot === 1) { const i = ch.lots.findIndex(L => L.side === 1); if (i >= 0) { const o = ch.lots[i]; ch.lots[i] = makeLot('jail', ch.tier, 1, o.z0, Math.min(20, ch.z0 + CHUNK_LEN - 1 - o.z0), r); } }
  }
  for (const L of ch.lots) { if (!L.special && !L.forSale && r() < 0.45) { L.wall = pickN(r, walls); L.band = pickN(r, BANDS); } }
  for (let i = 0; i < 2; i++) {
    if (r() < 0.2) { continue; }
    const side = i === 0 ? -1 : 1, z = ch.z0 + CROSS_W + 6 + r() * (CHUNK_LEN - CROSS_W - 12);
    ch.props.push({ kind: 'billboard', x: side * (ROAD_W + 1.4), z, side, text: fillSign(pickN(r, pool), ch), col: ch.estate ? '#b9a27a' : DISTRICTS[ch.tier].stripe[0], splats: [], cells: new Set() });
  }
  if (ch.slot > 0 && r() < 0.35) { ch.props.push({ kind: 'billboard', x: (r() < 0.5 ? -1 : 1) * (ROAD_W + 1.4), z: ch.z0 + CROSS_W - 1, side: 1, text: 'FREE PARKING · $40/hr', col: '#e23b3b', splats: [], cells: new Set() }); }
  if (!ch.estate && ch.tier <= 2 && r() < 0.5) {
    const L = ch.lots.find(l => !l.special && !l.forSale);
    if (L) { const n = 8 + Math.floor(r() * 10), zz = L.z0 + 1; ch.props.push({ kind: 'openhome', x: L.side * (EDGE_X - 0.4), z: zz, side: L.side, n }); for (let k = 0; k < n; k++) { ch.props.push({ kind: 'person', x: L.side * (EDGE_X - 1.2 - (k % 2) * 0.5), z: zz - 1.2 - k * 0.75, tone: r(), h: mixN(1.55, 1.85, r()), ph: r() * 6 }); } }
  }
}

/* ---------- the opening: crane shot down onto a board that builds itself ---------- */
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
  if (!opening.sparkle && t > 4.6) { opening.sparkle = true; spawnToken(distanceWalked + 60, null); }
  if (!opening.done && t > 6.0) { opening.done = true; ui.intro.classList.add('show'); }
}
function skipOpening() { if (!opening.t0 || opening.done) { return; } opening.t0 = performance.now() - 6100; opening.built = true; ui.black.classList.add('gone'); }

/* ---------- each frame ---------- */
function boardUpdate(z) {
  if (!ui.panel) { buildUI(); }
  runOpening();
  if (!paused && !intro && !ending) { market *= 1 + GROWTH * Math.min(deltaTime / 1000, 0.05) / 120; }
  // Investors buy plots out from under you.
  for (const ch of chunks.values()) {
    for (const L of ch.lots) { if (L.forSale && L.investorAt > 0 && (L.z0 + L.z1) / 2 - z < L.investorAt && !intro) { L.investorAt = -1; spawnToken((L.z0 + L.z1) / 2 + 18, L); } }
  }
  for (let i = tokens.length - 1; i >= 0; i--) {
    const T = tokens[i], u = (clockT - T.t) / 1.1;
    if (T.L && !T.done && u >= 1) { T.done = true; sellToInvestor(T.L, T.name); }
    if (u > 2.2) { tokens.splice(i, 1); }
  }
  // Looking around: arrow keys or the screen edges (the mouse is busy aiming the can).
  if (!intro && !ending) {
    const dt = Math.min(deltaTime / 1000, 0.05), ex = mouseXY[0] / Math.max(1, width);
    if (held('ArrowLeft') || held('KeyA') || ex < 0.04) { lookAim -= dt * 0.9; }
    if (held('ArrowRight') || held('KeyD') || ex > 0.96) { lookAim += dt * 0.9; }
    lookAim = constrain(lookAim, -0.85, 0.85);
  }
  // Talking back: spray the sign under the mouse.
  aimSign = intro || ending ? null : pickSign(mouseXY[0], mouseXY[1]);
  if (spraying && aimSign && !aimSign.p.rewrite) { sprayOn(aimSign); }
  sprayHiss(spraying && !intro && !ending);
  for (const ch of chunks.values()) { for (const p of ch.props) { if (p.kind === 'person' && p.v) { p.z += p.v * Math.min(deltaTime / 1000, 0.05); if (p.z > p.z1 || p.z < p.z0) { p.v = -p.v; } } } }
  moveCan();
  // First-time hints, so the rules explain themselves.
  if (!intro && !ending) {
    if (!hinted.sign && outbid > 0) { for (const ch of chunks.values()) { for (const p of ch.props) { if (p.kind === 'billboard' && p.z - z > 8 && p.z - z < 22 && !hinted.sign) { hinted.sign = true; hint('Hold the mouse on a sign to spray it'); } } } }
    if (!hinted.offer && plotHere(z)) { hinted.offer = true; hint('Press E'); }
  }
  if (holdUntil && clockT > holdUntil) { holdUntil = 0; nameBox = null; }
  // The plot beside you, and the title deed for it.
  plotTarget = plotHere(z);
  if (frameCount % 6 === 0) { updateHud(); }
  if (home && !ending && clockT - home.t > 5) { showEnding(true); }
}
function plotHere(z) {
  if (turnAnim || intro || ending) { return null; }
  let best = null;
  for (const ch of chunks.values()) { for (const L of ch.lots) { if (!L.forSale) { continue; } const d = Math.abs((L.z0 + L.z1) / 2 - z); if (d < 11 && (!best || d < best.d)) { best = { L, d }; } } }
  return best ? best.L : null;
}
function spawnToken(zEnd, L) { tokens.push({ t: clockT, z0: zEnd + 22, z1: zEnd, L, name: pickN(Math.random, INVESTORS), side: L ? L.side : 0 }); sound.turn(1); }
function sellToInvestor(L, name) {
  const tower = makeLot(null, Math.min(4, L.tier + 2), L.side, L.z0, L.z1 - L.z0, rngN(L.seed));
  Object.assign(L, { forSale: false, sold: name, born: clockT + 0.1, H: tower.H, depth: tower.depth, color: tower.color, tier: tower.tier, crown: tower.crown, spire: tower.spire, glass: tower.glass, name: 'SOLD', sign: true, wall: 'SOLD · WILL SIT EMPTY', band: ['#c0392b', '#ffffff'] });
  const ch = [...chunks.values()].find(c => c.lots.includes(L));
  if (ch) { ch.props.push({ kind: 'billboard', x: L.side * (ROAD_W + 1.4), z: (L.z0 + L.z1) / 2, side: L.side, text: `SOLD to ${name}. Will sit empty.`, col: '#c0392b', born: clockT }); }
  sound.jail();
}
// E: make an offer on the plot beside you.
function makeOffer() {
  const L = plotHere(distanceWalked); if (!L) { toast('Nothing for sale here. Walk on.'); return; }
  const price = priceOf(L), dep = price * (L.trust ? 0.05 : DEPOSIT), estate = L.estateLap !== undefined && L.estateLap >= 0;
  if (L.trust) {
    if (savings < dep) { toast(`The trust asks a 5% deposit: ${moneyK(dep)}. You have ${moneyK(savings)}. One more year.`); return; }
    savings -= dep; home = { price, t: clockT, lap, commute: 15 + L.tier * 3, trust: true };
    Object.assign(L, { forSale: false, mine: true }); sound.cash(true); setTimeout(() => sound.go(), 300);
    showMonoCard('SOLD — AT COST', `A community land trust home in ${DISTRICTS[L.tier].name}, ${moneyK(price)}.`, 'Nobody can flip it. It stays affordable for whoever comes next.', '#2f9a5a');
    return;
  }
  if (estate && savings >= dep) {
    savings -= dep; home = { price, t: clockT, lap, commute: estateCommute(L.estateLap), estateLap: L.estateLap };
    Object.assign(L, { forSale: false, mine: true }); sound.cash(true); setTimeout(() => sound.go(), 300);
    showMonoCard('SOLD — TO YOU', `You bought a house-and-land package for ${moneyK(price)}.`, `It’s ${commuteText(home.commute)} from the city.`, '#2f9a5a');
    return;
  }
  if (estate) { toast(`Deposit ${moneyK(dep)}. You have ${moneyK(savings)}. Keep walking: another year might do it.`); sound.cash(false); return; }
  // In the city, the bid is always beaten.
  const name = pickN(Math.random, INVESTORS), beat = Math.round(price * mixN(1.08, 1.25, Math.random()));
  toast(`Offer ${moneyK(price)}…`); outbid++;
  if (outbid === 1) { nameBox = {}; holdUntil = clockT + 2.6; }   // the first time, stop and watch it happen
  L.investorAt = -1; L.forSale = false; L.pending = true;
  spawnToken((L.z0 + L.z1) / 2 + 4, null);
  setTimeout(() => { sellToInvestor(L, name); showMonoCard('OUTBID', `${name} paid ${moneyK(beat)} cash.`, 'It will sit empty.', '#c0392b'); }, 1200);
}

/* ---------- GO: a year passes, and the board grows ---------- */
function onPassGo() {
  if (ending || intro) { return; }
  lap++; const rentYear = rentWeek * 52; rentPaid += rentYear; savings += WAGES - rentYear - LIVING; market *= 1 + GROWTH;
  showMonoCard('GO · AGE ' + ageNow(), `+${moneyK(WAGES)} pay · −${moneyK(rentYear + LIVING)} rent & living`, `Rent +${Math.round(rentRise * 100)}% · board +2 streets`, '#e23b3b');
  rentWeek = Math.round(rentWeek * (1 + rentRise));
  if (ui.board) { ui.board.classList.remove('flash'); void ui.board.offsetWidth; ui.board.classList.add('flash'); }
  setTimeout(() => { if (ending) { return; } const c = pickN(Math.random, CHANCE); c[3](); showMonoCard(c[0], c[1], c[2], c[0] === 'CHANCE' ? '#f28c28' : '#3f8fd6'); updateHud(); }, 4200);
  if (ageNow() >= END_AGE && !home) { setTimeout(() => showEnding(false), 2600); }
  updateHud();
}
function onChance() {}

/* ---------- drawing on the street ---------- */
// The pink arrow: it always points at the thing your next step is about.
function drawTargetMarker() {
  if (intro || ending) { return; }
  const st = nextStep(); if (!st.target) { return; }
  const t = st.target, wx = t.x, wz = t.z, y = t.y + 1.2 + Math.abs(Math.sin(clockT * 3)) * 0.8, q = P(wx, y, wz);
  if (q.rz < 2 || q.rz > 90) { return; }
  const s = Math.max(14, Math.min(40, q.k * 1.1));
  ctx.save(); ctx.fillStyle = '#ff4f9a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(q.x - s * 0.6, q.y - s * 1.3); ctx.lineTo(q.x + s * 0.6, q.y - s * 1.3); ctx.lineTo(q.x + s * 0.6, q.y - s * 0.6); ctx.lineTo(q.x + s, q.y - s * 0.6); ctx.lineTo(q.x, q.y + s * 0.3); ctx.lineTo(q.x - s, q.y - s * 0.6); ctx.lineTo(q.x - s * 0.6, q.y - s * 0.6); ctx.closePath();
  ctx.stroke(); ctx.fill(); ctx.restore();
}
// What to do now, in one line, plus where it is.
function nextStep() {
  const z = distanceWalked, ahead = (ok) => { let best = null; for (const ch of chunks.values()) { for (const it of [...ch.lots, ...ch.props]) { const r = ok(it, ch); if (r && r.z - z > 4 && r.z - z < 80 && (!best || r.z < best.z)) { best = r; } } } return best; };
  const plotT = (L, ch) => ({ x: L.side * (EDGE_X + 1.4), y: 3, z: (L.z0 + L.z1) / 2 });
  const trust = rewrites.length >= TRUST_AT, trustDep = 480000 * Math.pow(1.03, lap) * 0.05;
  if (outbid === 0) { return { text: 'Walk to a FOR SALE sign · press E', target: ahead((L, ch) => L.forSale && !L.trust && !ch.estate && L.z0 !== undefined && plotT(L)) }; }
  if (!trust) { return { text: `Outbid. Spray ${TRUST_AT - rewrites.length} sign${TRUST_AT - rewrites.length > 1 ? 's' : ''} (hold mouse) to change the rules`, target: ahead(p => p.kind === 'billboard' && p.splats && !p.rewrite && { x: p.x, y: 6, z: p.z }) }; }
  if (savings < trustDep) { return { text: `Rules changed! Walk to GO for payday (need ${moneyK(trustDep)})`, target: null }; }
  return { text: 'Rules changed! Green sign · press E', target: ahead(L => L.trust && L.forSale && plotT(L)) };
}
function drawForSale(L) {
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + 1.4), base = P(x, 0, mid);
  if (base.rz < 1.5 || base.rz > FAR_Z * 0.8) { return; }
  const k = base.k, w = 3.4 * k, h = 1.9 * k, top = base.y - 3 * k, near = L === plotTarget;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(mid) * 0.8;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(base.x - 0.07 * k, top, 0.14 * k, 3 * k);
  ctx.fillStyle = '#fffaee'; ctx.strokeStyle = near ? '#ff4f9a' : '#2a1e18'; ctx.lineWidth = Math.max(1, (near ? 0.14 : 0.06) * k);
  ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  ctx.fillStyle = L.trust ? '#2f9a5a' : '#c8322a'; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h * 0.34);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${h * 0.2}px Georgia, serif`; ctx.fillStyle = '#fff'; ctx.fillText(L.trust ? 'LAND TRUST · AT COST' : 'FOR SALE', base.x, top - h * 0.2 + h * 0.17);
    ctx.font = `bold ${h * 0.27}px Georgia, serif`; ctx.fillStyle = '#2a1e18'; ctx.fillText(moneyK(priceOf(L)), base.x, top - h * 0.2 + h * 0.52);
    ctx.font = `${h * 0.15}px Georgia, serif`; ctx.fillStyle = '#7a5a4a'; ctx.fillText(`deposit ${moneyK(priceOf(L) * (L.trust ? 0.05 : DEPOSIT))}`, base.x, top - h * 0.2 + h * 0.8);
  }
  ctx.restore();
}
// Satire painted on the walls, and a red hotel on everything an investor bought.
function afterLot(L) {
  if (L.special || L.mine) { return; }
  const H = L.H * L.econNow, x = L.side * (EDGE_X + L.setback), z0 = clipZ(L.z0);
  if (L.z1 <= z0 + 0.5) { return; }
  if (L.wall) { paintOnFacade(L, x, z0, wallTex(L.wall, L.band), H * (L.tier === 0 ? 0.55 : 0.58), H * (L.tier === 0 ? 0.9 : 0.8), 0.35); }
  if (L.sold) {
    const xh = L.side * (EDGE_X + L.setback + Math.min(4, L.depth / 2)), mid = (L.z0 + L.z1) / 2, za = Math.max(mid - 2.2, z0), zb = mid + 2.2, hh = H + 2.6;
    if (zb > za + 0.3) {
      polyN(wallQuad(xh, za, xh, zb, H, hh), toneN('#d62d2d', mid));
      polyN([P(xh, hh, za), P(xh, hh, zb), P(xh, hh + 1.6, (za + zb) / 2)], toneN('#a81f1f', mid));
    }
  }
}
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
  p.hit = { x0: x - w / 2, y0: top - h, x1: x + w / 2, y1: top, rz: q.rz, f: frameCount };
  // Paint you have sprayed on it so far.
  if (p.splats && p.splats.length) {
    ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, top - h, w, h); ctx.clip();
    for (const sp of p.splats) { ctx.fillStyle = sp.col; ctx.globalAlpha = (1 - fogFor(p.z) * 0.85) * sp.a; ctx.beginPath(); ctx.arc(x - w / 2 + sp.u * w, top - h + sp.v * h, Math.max(0.6, sp.r * w), 0, TWO_PI); ctx.fill(); }
    ctx.restore();
  }
  if (p.rewrite) {
    const k2 = constrain((clockT - p.rewrite.t) / 0.9, 0, 1);
    ctx.save(); ctx.globalAlpha = (1 - fogFor(p.z) * 0.85) * 0.7 * k2; ctx.fillStyle = '#1d1830'; ctx.fillRect(x - w / 2, top - h, w, h); ctx.restore();
    if (w > 40) {
      ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.85; ctx.beginPath(); ctx.rect(x - w / 2, top - h - h, w * k2, h * 3); ctx.clip();
      ctx.translate(x, top - h / 2); ctx.rotate(-0.06); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let size = h * 0.32; ctx.font = `${size}px "Permanent Marker", Impact, sans-serif`;
      const words = p.rewrite.text.split(' '), lines = []; let line = '';
      for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w * 0.9 && line) { lines.push(line); line = wd; } else { line = t; } }
      lines.push(line);
      lines.forEach((ln, i) => { const yy = (i - (lines.length - 1) / 2) * size * 1.05; ctx.lineWidth = size * 0.14; ctx.strokeStyle = '#1d1830'; ctx.strokeText(ln, 0, yy); ctx.fillStyle = p.rewrite.col; ctx.fillText(ln, 0, yy); });
      ctx.restore();
    }
    ctx.restore(); return;
  }
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
function drawPerson(q, p) {
  const k = q.k; if (k < 1.5) { return; }
  const h = p.h, sway = Math.sin(clockT * 1.5 + p.ph) * 0.03 * k;
  const coats = ['#ff7aa2', '#5fb3ff', '#ffb347', '#6cc58a', '#b48cff', '#ffd84d', '#ff8f6b'], skin = ['#f5d0b5', '#d9a07a', '#a8704a', '#ffe0c8'];
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = '#4a4a6a'; ctx.fillRect(q.x - 0.14 * k, q.y - 0.8 * k, 0.11 * k, 0.8 * k); ctx.fillRect(q.x + 0.03 * k, q.y - 0.8 * k, 0.11 * k, 0.8 * k);
  ctx.fillStyle = coats[Math.floor(p.tone * coats.length)];
  ctx.beginPath(); if (ctx.roundRect) { ctx.roundRect(q.x - 0.25 * k + sway, q.y - (h - 0.2) * k, 0.5 * k, (h - 1.0) * k, 0.2 * k); } else { ctx.rect(q.x - 0.25 * k + sway, q.y - (h - 0.2) * k, 0.5 * k, (h - 1.0) * k); } ctx.fill();
  ctx.fillStyle = skin[Math.floor(p.tone * 7) % skin.length]; ctx.beginPath(); ctx.arc(q.x + sway, q.y - (h - 0.05) * k, 0.17 * k, 0, TWO_PI); ctx.fill();
  if (p.tone > 0.6) { ctx.fillStyle = '#e8e8f0'; ctx.fillRect(q.x + 0.15 * k + sway, q.y - (h - 0.55) * k, 0.12 * k, 0.2 * k); }
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
// Your house, once you buy one: a little green Monopoly house.
function drawOwnedLot(L) {
  const len = L.z1 - L.z0, z0 = clipZ(L.z0); if (L.z1 <= z0) { return; }
  const x = L.side * (EDGE_X + 1), d = 6, xo = x + L.side * d, xm = (x + xo) / 2, za = L.z0 + len * 0.2, zb = L.z1 - len * 0.2, h = 4.5, zc = Math.max(za, z0);
  if (zb <= zc) { return; }
  polyN(wallQuad(x, zc, x, zb, 0, h), toneN('#2e9e47', midN(zc, zb), 1.05), 'rgba(0,0,0,0.25)', 1);
  if (za > cam.z + NEAR_Z) { polyN(wallQuad(x, za, xo, za, 0, h), toneN('#2e9e47', za, 0.7)); polyN([P(x, h, za), P(xo, h, za), P(xm, h + 3, za)], toneN('#2e9e47', za, 0.6)); }
  polyN([P(x, h, zc), P(x, h, zb), P(xm, h + 3, zb), P(xm, h + 3, zc)], toneN('#24803a', midN(zc, zb), 0.85), 'rgba(0,0,0,0.25)', 1);
}
// Investor tokens: a giant silver top hat hopping down the road to the plot it is about to buy.
function drawDreamHouse(z) {
  for (const T of tokens) {
    const u = Math.min(1, (clockT - T.t) / 1.1), hop = Math.abs(Math.sin(u * PI * 3)) * 2.2 * (1 - u * 0.3), zz = mixN(T.z0, T.z1, easeN(u)), xx = T.side * (ROAD_W - 1.4) * easeN(u);
    const fade = 1 - constrain((clockT - T.t - 1.4) / 0.8, 0, 1), base = P(xx, hop, zz); if (base.rz < 2 || fade <= 0) { continue; }
    const k = base.k, s = 1.4;
    ctx.save(); ctx.globalAlpha = fade;
    const sh = P(xx, 0, zz); ctx.fillStyle = 'rgba(40,30,60,0.25)'; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, 1.4 * s * k, 0.3 * s * k, 0, 0, TWO_PI); ctx.fill();
    const g = ctx.createLinearGradient(base.x - s * k, 0, base.x + s * k, 0); g.addColorStop(0, '#8d93a6'); g.addColorStop(0.45, '#f4f6fb'); g.addColorStop(1, '#6d7286');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(base.x, base.y, 1.5 * s * k, 0.35 * s * k, 0, 0, TWO_PI); ctx.fill();
    ctx.fillRect(base.x - 0.85 * s * k, base.y - 2.1 * s * k, 1.7 * s * k, 2.1 * s * k);
    ctx.beginPath(); ctx.ellipse(base.x, base.y - 2.1 * s * k, 0.85 * s * k, 0.2 * s * k, 0, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = '#3d3553'; ctx.fillRect(base.x - 0.86 * s * k, base.y - 0.75 * s * k, 1.72 * s * k, 0.35 * s * k);
    ctx.fillStyle = '#3d3553'; ctx.font = `bold ${Math.max(10, 0.45 * k)}px Nunito, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(T.name, base.x, base.y - 2.7 * s * k);
    ctx.restore();
  }
}

/* ---------- talking back: spray over the signs ---------- */
const TRUST_AT = 4;
const PAINTS = ['#ff4f9a', '#ffd23f', '#2fd3a0', '#3d8bff'];
const REPLIES = ['HOMES, NOT ASSETS', 'WHO IS THIS CITY FOR?', 'WE’RE NOT LEAVING', 'HOUSING IS A RIGHT', 'TAX EMPTY HOMES', 'PUBLIC HOUSING NOT PENTHOUSES', 'THE BOARD IS RIGGED', 'RENT IS NOT A YIELD'];
function pickSign(x, y) {
  let best = null;
  for (const ch of chunks.values()) {
    for (const p of ch.props) {
      if (p.kind !== 'billboard' || !p.hit || p.hit.f < frameCount - 2 || !p.splats) { continue; }
      const h = p.hit; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1 && h.rz < 45 && (!best || h.rz < best.rz)) { best = { p, ch, u: (x - h.x0) / (h.x1 - h.x0), v: (y - h.y0) / (h.y1 - h.y0), rz: h.rz }; }
    }
  }
  return best;
}
function sprayOn(hit) {
  const p = hit.p, col = PAINTS[paint];
  for (let i = 0; i < 6; i++) { const a = Math.random() * TWO_PI, d = Math.pow(Math.random(), 0.7) * 0.09; p.splats.push({ u: hit.u + Math.cos(a) * d, v: hit.v + Math.sin(a) * d * 2, r: 0.004 + Math.random() * 0.012, col, a: 0.75 + Math.random() * 0.25 }); }
  if (p.splats.length > 900) { p.splats.splice(0, 6); }
  for (let gx = Math.floor((hit.u - 0.09) * 8); gx <= Math.floor((hit.u + 0.09) * 8); gx++) { for (let gy = Math.floor((hit.v - 0.18) * 4); gy <= Math.floor((hit.v + 0.18) * 4); gy++) { if (gx >= 0 && gx < 8 && gy >= 0 && gy < 4) { p.cells.add(gx + gy * 8); } } }
  p.progress = p.cells.size / 32;
  if (p.progress >= 0.55) { rewriteSign(hit); }
}
function rewriteSign(hit) {
  const p = hit.p, ch = hit.ch, r = rngN(Math.floor(p.z * 13));
  p.rewrite = { text: REPLIES[rewrites.length % REPLIES.length], col: PAINTS[paint], t: clockT };
  rewrites.push({ was: p.text, now: p.rewrite.text, col: p.rewrite.col });
  rentRise = Math.max(0.01, 0.06 - rewrites.length * 0.01);
  // Investors on this block back off, and people come out onto the street.
  for (const L of ch.lots) { if (L.investorAt > 0) { L.investorAt = -1; } }
  for (let i = 0; i < 7; i++) { ch.props.push({ kind: 'person', x: (r() < 0.5 ? -1 : 1) * mixN(ROAD_W + 1, EDGE_X - 0.8, r()), z: mixN(ch.z0 + CROSS_W, ch.z0 + CHUNK_LEN, r()), z0: ch.z0 + CROSS_W, z1: ch.z0 + CHUNK_LEN, v: (r() < 0.5 ? -1 : 1) * mixN(0.5, 1.2, r()), tone: r(), h: mixN(1.5, 1.85, r()), ph: r() * 6, born: clockT + 0.3 + r() }); }
  sound.cash(true); setTimeout(() => sound.go(), 200);
  if (rewrites.length === TRUST_AT) {
    showMonoCard('RULES CHANGED', 'Homes at cost, in the city.', 'Look for green signs.', '#2f9a5a');
    for (const c2 of chunks.values()) { if (c2.estate || c2.z0 < distanceWalked + 20) { continue; } const cand = c2.lots.filter(L => !L.special && !L.forSale && !L.born); if (cand.length) { makeTrust(cand[0]); break; } }
  } else {
    toast(`Rent rise ↓ ${Math.round(rentRise * 100)}% · ${TRUST_AT - rewrites.length} to go`);
  }
  updateHud();
}
function makeTrust(L) { Object.assign(L, { forSale: true, trust: true, priceK: mixN(0.95, 1.05, Math.random()), setback: 0, investorAt: -1 }); }
function sprayHiss(on) {
  if (!sound || !sound.context || !sound.master) { return; }
  if (!hiss) {
    const ac = sound.context, buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { d[i] = Math.random() * 2 - 1; }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 0.7; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sound.master); src.start(); hiss = { g, ac };
  }
  hiss.g.gain.setTargetAtTime(on ? 0.14 : 0, hiss.ac.currentTime, on ? 0.02 : 0.05);
}
function moveCan() {
  if (!ui.x) { return; }
  const r = canvasNode.getBoundingClientRect(), x = mouseXY[0] + r.left, y = mouseXY[1] + r.top, show = !intro && !ending, hot = aimSign && !aimSign.p.rewrite, col = PAINTS[paint];
  ui.x.style.display = ui.can.style.display = show ? 'block' : 'none';
  ui.x.style.left = x + 'px'; ui.x.style.top = y + 'px'; ui.x.classList.toggle('hot', !!hot); ui.x.style.borderColor = hot ? col : '#2a1e18';
  ui.x.querySelector('i').style.cssText = `--c:${col};--p:${hot ? Math.min(100, (aimSign.p.progress || 0) / 0.55 * 100) : 0}`;
  ui.mist.style.left = x + 'px'; ui.mist.style.top = y + 'px'; ui.mist.style.background = `radial-gradient(circle, ${col}cc 0%, ${col}55 35%, transparent 70%)`;
  ui.mist.style.opacity = spraying && show ? 0.5 + Math.random() * 0.3 : 0;
  ui.can.style.setProperty('--paint', col);
  ui.can.style.transform = `translate(${(x - window.innerWidth * 0.8) * 0.06 + (spraying ? (Math.random() - 0.5) * 3 : 0)}px, ${spraying ? -8 : 0}px) rotate(${constrain(Math.atan2(y - window.innerHeight, x - window.innerWidth * 0.9) + HALF_PI, -0.9, 0.5)}rad)`;
}
function hint(text) { toast(text); }

/* ---------- HUD (HTML) ---------- */
function drawBoardHud() { if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,248,240,${fadeA})`; ctx.fillRect(0, 0, width, height); } }
function buildUI() {
  const css = document.createElement('style');
  css.textContent = `@import url('https://fonts.googleapis.com/css2?family=Anton&family=Permanent+Marker&family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Nunito:wght@500;700;800&display=swap');
  .pl{position:fixed;font-family:Nunito,system-ui,sans-serif;color:#2a1e18;z-index:5;user-select:none}
  .pl-hide{opacity:0;pointer-events:none}
  canvas{cursor:none}
  .pl-goal{left:50%;top:14px;transform:translateX(-50%);background:#2a1e18;color:#fffaee;border-radius:14px;padding:10px 16px;max-width:min(620px,56vw);box-shadow:0 5px 0 rgba(42,30,24,.25);font-weight:800;font-size:15px;transition:opacity .6s;text-align:left}
  .pl-goal .k{display:inline-block;background:#ff4f9a;color:#fff;border-radius:6px;font:800 10px Nunito;letter-spacing:.12em;padding:2px 6px;margin-right:8px;vertical-align:2px}
  .pl-goal .nx{font-weight:800;font-size:18px;color:#ffe7b0}.pl-goal .nx .k{background:#ffd23f;color:#2a1e18}
  .pl-goal .yrs{font-size:11px;color:#c9b8a8;margin-top:3px;text-align:center}
  .pl-sheet.short{max-width:420px;padding:26px}.pl-sheet.short h1{font-size:38px;margin:4px 0 2px}.pl-sheet.short button{font-size:20px;padding:12px 40px}
  .pl-sheet h2.goal{font:800 12px Nunito;color:#e0457a;letter-spacing:.16em;margin:0 0 4px}
  .pl-x{width:44px;height:44px;margin:-22px 0 0 -22px;pointer-events:none;border-radius:50%;border:2.5px dashed #2a1e18;transition:border-color .15s,transform .15s;z-index:8}
  .pl-x.hot{border-style:solid;transform:scale(1.15)}.pl-x b{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#2a1e18}
  .pl-x i{position:absolute;inset:-9px;border-radius:50%;background:conic-gradient(var(--c) calc(var(--p)*1%),transparent 0);-webkit-mask:radial-gradient(circle,transparent 27px,#000 28px);mask:radial-gradient(circle,transparent 27px,#000 28px)}
  .pl-mist{width:110px;height:110px;margin:-55px 0 0 -55px;pointer-events:none;border-radius:50%;opacity:0;transition:opacity .08s;filter:blur(6px);z-index:7}
  .pl-can{right:3vw;bottom:-50px;width:120px;pointer-events:none;transform-origin:50% 100%;transition:transform .08s;z-index:6}
  .pl-board.flash{animation:plFlash 1.4s ease-out 2}@keyframes plFlash{0%{transform:scale(1)}30%{transform:scale(1.12);box-shadow:0 0 0 6px #ffd23f}100%{transform:scale(1)}}
  .pl-sw{display:flex;gap:6px;margin-top:8px}.pl-sw span{width:20px;height:20px;border-radius:50%;border:2px solid #2a1e18;cursor:pointer}.pl-sw span.on{box-shadow:0 0 0 2px #fffaee,0 0 0 4px #2a1e18}
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
  .pl-sheet .tip{font-style:italic;color:#5d4a40}.pl-wall{display:flex;flex-direction:column;gap:5px;margin:8px 0;max-height:24vh;overflow:auto}.pl-wall div{font-size:12px;text-align:left;background:#1f2a44;color:#f4d58d;border-radius:6px;padding:5px 9px}.pl-wall b{display:block;font:400 17px 'Permanent Marker',Impact,sans-serif}.pl-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0}.pl-stats div{background:#f3ece0;border-radius:8px;padding:8px;font-size:12px}.pl-stats b{display:block;font:800 20px Fraunces,Georgia,serif}`;
  document.head.appendChild(css);
  const el = (cls, html) => { const d = document.createElement('div'); d.className = 'pl ' + cls; d.innerHTML = html; document.body.appendChild(d); return d; };
  ui.panel = el('pl-panel pl-hide', ''); ui.board = el('pl-board pl-hide', ''); ui.deed = el('pl-deed pl-hide', '');
  ui.help = el('pl-help pl-hide', '↑ walk · E offer · hold mouse = spray');
  ui.toast = el('pl-toast', ''); ui.card = el('pl-card', '');
  ui.mist = el('pl-mist', ''); ui.x = el('pl-x', '<i></i><b></b>'); ui.x.style.display = 'none';
  ui.can = el('pl-can', `<svg viewBox="0 0 120 220" width="120"><g stroke="#2a1e18" stroke-width="4" stroke-linejoin="round"><rect x="50" y="8" width="20" height="16" rx="3" fill="#fffaee"/><rect x="44" y="22" width="32" height="18" rx="6" fill="#b9b4c8"/><rect x="22" y="38" width="76" height="176" rx="22" fill="var(--paint,#ff4f9a)"/><rect x="22" y="92" width="76" height="62" fill="#fffaee"/></g><rect x="30" y="50" width="10" height="150" rx="5" fill="#fff" opacity=".35"/></svg>`); ui.can.style.display = 'none';
  document.addEventListener('pointermove', e => { const r = canvasNode.getBoundingClientRect(); mouseXY = [e.clientX - r.left, e.clientY - r.top]; });
  document.addEventListener('pointerup', () => { spraying = false; });
  window.addEventListener('keyup', e => { if (e.code === 'Space') { spraying = false; } });
  window.addEventListener('blur', () => { spraying = false; });
  ui.black = el('pl-black', '<h1>PLOTLINE</h1><p>a walk through the Landlord’s Game</p>');
  ui.intro = el('pl-over', `<div class="pl-sheet short"><h2 class="goal">YOU’RE 24 · $22k SAVED</h2><h1>Buy a home before 30.</h1><button>Start</button></div>`);
  ui.intro.querySelector('button').addEventListener('click', e => { e.stopPropagation(); startWalk(); });
  ui.end = el('pl-over mid', '');
  ui.goal = el('pl-goal pl-hide', '');
  ui.black.addEventListener('pointerdown', skipOpening);
}
function startWalk() {
  intro = false; ui.intro.classList.remove('show');
  for (const k of ['panel', 'board', 'help', 'goal']) { ui[k].classList.remove('pl-hide'); }
  beginSound(); canvasNode.focus({ preventScroll: true }); updateHud();
}
// The board in the corner: a Monopoly loop that grows a few squares every year.
function boardSvg() {
  const n = lapLen(lap), here = boardSlot(Math.floor(distanceWalked / CHUNK_LEN)), S = 150, per = Math.ceil(n / 4), t = S / (per + 1);
  const spots = [];
  for (let i = 0; i < n; i++) {
    const side = Math.floor(i / per), j = i % per, pos = j * t;
    spots.push(side === 0 ? [S - t - pos, S - t] : side === 1 ? [0, S - t - pos] : side === 2 ? [pos, 0] : [S - t, pos]);
  }
  let svg = `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><rect x="${t}" y="${t}" width="${S - 2 * t}" height="${S - 2 * t}" fill="#bfe0c2"/>`;
  svg += `<text x="${S / 2}" y="${S / 2 - 4}" text-anchor="middle" font-family="Anton,Impact" font-size="14" fill="#c8322a">YEAR ${lap + 1}</text><text x="${S / 2}" y="${S / 2 + 12}" text-anchor="middle" font-family="Nunito" font-weight="800" font-size="9" fill="#2a1e18">${n} streets</text>`;
  spots.forEach(([x, y], i) => {
    const b = boardSlot(sumLaps(lap) + i), col = i === 0 ? '#e23b3b' : b.estate ? (b.estateLap === lap ? '#e8d9b8' : '#cdbb98') : DISTRICTS[b.tier].stripe[0];
    svg += `<rect x="${x + 1}" y="${y + 1}" width="${t - 2}" height="${t - 2}" rx="2" fill="${col}" stroke="#2a1e18" stroke-width="1"/>`;
    if (i === 0) { svg += `<text x="${x + t / 2}" y="${y + t / 2 + 3}" text-anchor="middle" font-family="Anton,Impact" font-size="${t * 0.42}" fill="#fff">GO</text>`; }
    if (i === here.slot && here.lap === lap) { svg += `<circle cx="${x + t / 2}" cy="${y + t / 2}" r="${t * 0.28}" fill="#2a1e18" stroke="#fff" stroke-width="1.5"/>`; }
  });
  return svg + '</svg>';
}
function sumLaps(L) { let s = 0; for (let i = 0; i < L; i++) { s += lapLen(i); } return s; }
function updateHud() {
  if (!ui.panel) { return; }
  if (ui.goal) { const st = nextStep(); ui.goal.innerHTML = `<div class="nx"><span class="k">NEXT</span>${st.text}</div><div class="yrs">${Math.max(0, END_AGE - ageNow())} years left to buy a home</div>`; }
  ui.panel.innerHTML = `<h4>YOU · RENTING</h4><div class="pl-big">${ageNow()} <span class="pl-small">years old</span></div>
    <div class="pl-row"><span>Savings</span><span>${money(savings)}</span></div>
    <div class="pl-row"><span>Rent</span><span>${money(rentWeek)}/wk</span></div>
    <div class="pl-small">Rent paid so far ${moneyK(rentPaid)} · outbid ${outbid}×</div>
    <div class="pl-row"><span>Signs rewritten</span><span>${rewrites.length}${rewrites.length < TRUST_AT ? ' / ' + TRUST_AT : ' ✓'}</span></div>
    <div class="pl-sw">${PAINTS.map((c, i) => `<span data-i="${i}" class="${i === paint ? 'on' : ''}" style="background:${c}"></span>`).join('')}</div>`;
  ui.panel.querySelectorAll('.pl-sw span').forEach(d => d.addEventListener('pointerdown', e => { e.stopPropagation(); paint = +d.dataset.i; updateHud(); }));
  ui.board.innerHTML = boardSvg();
  const L = plotTarget;
  if (L && !ending) {
    const price = priceOf(L), dep = price * (L.trust ? 0.05 : DEPOSIT), estate = L.estateLap !== undefined && L.estateLap >= 0, col = L.trust ? '#2f9a5a' : estate ? '#b9a27a' : DISTRICTS[L.tier].stripe[0];
    const name = L.trust ? 'Community Land Trust' : estate ? (L.estateLap === lap ? 'New Estate' : 'Old Estate') : DISTRICTS[L.tier].name, commute = estate ? estateCommute(L.estateLap) : 15 + L.tier * 3;
    ui.deed.innerHTML = `<div class="hd" style="background:${col}">TITLE DEED · FOR SALE<b>${name}</b></div>
      <div class="r"><span>Price</span><span>${moneyK(price)}</span></div><div class="r"><span>Deposit (${L.trust ? 5 : 10}%)</span><span>${moneyK(dep)}</span></div>
      <div class="r"><span>Commute</span><span>${commuteText(commute)}</span></div><div class="r ${savings < dep ? 'bad' : ''}"><span>Your savings</span><span>${moneyK(savings)}</span></div>
      <div class="act">E · make an offer</div>`;
    ui.deed.classList.remove('pl-hide');
  } else { ui.deed.classList.add('pl-hide'); }
}
let toastTimer = null, cardTimer = null;
function toast(text) { if (!ui.toast) { return; } ui.toast.textContent = text; ui.toast.style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => { ui.toast.style.opacity = 0; }, 3800); }
function showMonoCard(title, line, small, col) {
  ui.card.innerHTML = `<div class="t" style="background:${col}">${title}</div><p>${line}</p><p class="s">${small}</p>`;
  ui.card.classList.add('show'); clearTimeout(cardTimer); cardTimer = setTimeout(() => ui.card.classList.remove('show'), 3800);
}
function showEnding(bought) {
  if (ending) { return; }
  ending = true; plotTarget = null; updateHud(); sound.go();
  const stats = `<div class="pl-stats"><div><b>${moneyK(rentPaid)}</b>rent paid</div><div><b>${outbid}</b>times outbid</div><div><b>${rewrites.length}</b>signs you rewrote</div></div>`
    + (rewrites.length ? `<div class="pl-wall">${rewrites.map(w => `<div><s>${w.was}</s><b style="color:${w.col}">${w.now}</b></div>`).join('')}</div>` : '');
  ui.end.innerHTML = bought && home.trust
    ? `<div class="pl-sheet"><div class="band" style="background:#2f9a5a">YOU CHANGED THE RULES</div><h1>A home in the city, at cost.</h1>
       <p>You’re ${START_AGE + home.lap}. You couldn’t outbid them alone. But the street talked back, and a community land trust put a home where the investors wanted a tower.</p>${stats}
       <p class="tip">Monopoly has one rule: the richest player wins. Cities can choose other rules.</p><button>Walk again</button></div>`
    : bought
    ? `<div class="pl-sheet"><div class="band">YOU OWN A PROPERTY</div><h1>The last square on the board.</h1>
       <p>You’re ${START_AGE + home.lap}. It cost ${moneyK(home.price)}, on ${home.estateLap === lap ? 'the newest estate' : 'an older estate'}, ${commuteText(home.commute)} from the city. The city got there first; you got the edge.</p>${stats}
       <p class="tip">In Monopoly, the board never grows. In the city, it does: outward, onto the people who can’t afford the middle.</p><button>Walk again</button></div>`
    : `<div class="pl-sheet"><div class="band">STILL RENTING</div><h1>You’re ${END_AGE}. The board kept growing.</h1>
       <p>You saved ${moneyK(savings)}. The cheapest home is now on a street that didn’t exist when you started.</p>${stats}
       <p class="tip">Monopoly was invented to warn us about this. We kept the game and lost the warning.</p><button>Walk again</button></div>`;
  ui.end.querySelector('button').addEventListener('click', e => { e.stopPropagation(); restartWalk(); });
  ui.end.classList.add('show');
}
function restartWalk() {
  lap = 0; savings = START_SAVINGS; rentWeek = RENT_START; rentPaid = 0; market = 1; outbid = 0; home = null; tokens = []; ending = false; rewrites = []; rentRise = 0.06; lookAim = 0; hinted = {}; spraying = false;
  seed += 97; chunks.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
  if (ui.end) { ui.end.classList.remove('show'); }
  startWalk();
}

/* ---------- input ---------- */
function boardKey(e) {
  if (opening.t0 && !opening.done) { skipOpening(); return true; }
  if (intro && (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyW')) { startWalk(); return true; }
  const pi = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code]; if (pi !== undefined) { paint = pi; updateHud(); return true; }
  if (e.code === 'KeyE') { if (!intro && !ending) { makeOffer(); } return true; }
  if (e.code === 'Space') { if (!intro && !ending) { spraying = true; } return true; }
  if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) { return true; }
  if (e.code === 'KeyR') { restartWalk(); return true; }
  return false;
}
function boardClick() { if (opening.t0 && !opening.done) { skipOpening(); return true; } if (intro || ending) { return true; } spraying = true; return true; }
