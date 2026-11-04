/* Plotline — The Landlord's Walk: two rules, one street.
 * Monopoly began in 1904 as Lizzie Magie's "The Landlord's Game". She wrote two sets of rules
 * to show the difference between them. This walk plays both, on the same street.
 *
 * Rule 1, the monopolist rules (the ones Monopoly kept): you are 24 with some savings. Pay day
 * comes twice a lap (a year each). Buy homes anywhere: cheap streets out of town or dear ones in
 * the city. Every home you buy pays you rent and lets the bank lend you more; the people who lived
 * there carry their boxes away, and the prices around it jump. Own 5 homes and you win. Then the
 * street empties, and a card tells you whose game this was.
 * Rule 2, her other rules (Prosperity): the same street, the same money. Land is taxed and the
 * tax is shared by everyone on the street. Holding homes to rent barely pays, nobody is moved out,
 * and every home you buy brings new neighbours, trees and flowers. The end card compares the two
 * streets and tells what happened in 1935.
 * At every crossing you can turn: left to a cheaper town further out, right to a richer one.
 */
const START_AGE = 24, END_AGES = [30, 26], START_SAVINGS = 60000, OWN_GOAL = 3;
const WAGES = 60000, LIVING = 22000, RENT_WEEK = 380;     // take-home pay, living costs, rent
const BASE_PRICE = [520000, 780000, 1600000, 2400000, 4800000];  // by district tier, inner city
const ZONE_PRICE = 0.8, DEPOSIT = 0.1;                     // prices fall 20% per town out
const GROWTH = [8, 3];                                      // % price rise per year (a year = half a lap walked), by rule
const RENT_YIELD = [0.09, 0.05], INTEREST = 0.05;           // tenants pay this share of the price a year; the bank charges 5%
const LAND_TAX = 0.035, STREET_SHARE = 9000;                // Rule 2: the tax on your land, and everyone's equal share of it
const MOVED = [4, 3, 2, 2, 1];                              // households living in a lot, by tier
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
function deedName(L) { return L.style ? STYLES_LOT[L.style].name : DISTRICTS[L.tier].name; }
function deedCol(L) { return L.style ? STYLES_LOT[L.style].col[0] : DISTRICTS[L.tier].stripe[0]; }
function movedFrom(L) { return L.style ? STYLES_LOT[L.style].moved : MOVED[L.tier]; }
const OWNER_COL = '#d4a017', HOUSE_COL = '#2e9e47', SHARE_COL = '#3f9e6a';

let wallet = START_SAVINGS, lifeAge = START_AGE, zone = START_ZONE, market = 1, rentPaid = 0, rentWeek = TOWNS[START_ZONE].rent, rentBase = RENT_WEEK;
let turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, queuedTurn = 0, nameBox = null;
let ownedFromC = Infinity, home = null, ending = null, intro = true, landlordMode = false, lapStartT = 0;
let rules = 1, firstRun = null, startSeed = null, emptyK = 1;
let owned = [], loans = 0, equityUsed = 0, rentIn = 0, movedOut = 0, newNeighbours = 0, taxShared = 0;
const toasts = [], moneyPops = [];
let soldBeat = null;   // the moment after you buy: who had to leave
function familyOf(L) { return FAMILIES[Math.abs(L.seed) % FAMILIES.length]; }
const FAMILIES = ['The Nguyens', 'The Kellys', 'Mrs Brown', 'The Patels', 'The Wongs', 'The Okafors', 'Tom and Ana', 'The Russos', 'Old Mr Lee', 'The Haddads', 'Jess and her mum', 'The Murphys'];
const LEAVING = ['We’ve lived here eleven years.', 'Where do we go now?', 'The kids’ school is just there.', 'We couldn’t match the price.', 'Two hours from work, now.', 'My mum is next door.', 'The landlord sold it.'];
const ARRIVING = ['We can finally stay!', 'Hello, neighbour!', 'The kids can walk to school.', 'Ten minutes from work.'];
// How alive the street still is: 1 = full of people, falling as families are moved out (Rule 1).
function streetLife() { return rules === 2 ? 1 : Math.max(0.12, 1 - movedOut / 14) * emptyK; }
const streetMemory = new Map();

const money = v => '$' + Math.round(v).toLocaleString('en-AU');
const moneyK = v => v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M' : '$' + Math.round(v / 1000) + 'k';
const COMMUTE = [15, 20, 10, 35, 55, 95];   // minutes to work in the city, by town
function commuteMin(zn = zone) { return COMMUTE[zn]; }
function commuteShort(zn) { const m = COMMUTE[zn]; return m < 60 ? `${m} min to work` : `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''} to work`; }
function commuteText() { const m = commuteMin(); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; }
function sayToast(text) { toasts.push({ text, t: clockT }); }
function popMoney(v, label) { moneyPops.push({ text: (v < 0 ? '−' : '+') + money(Math.abs(v)) + (label ? '  ' + label : ''), t: clockT + moneyPops.length * 0.35, up: v > 0 }); }
function addMoney(v, label) { if (Math.abs(v) < 1) { return; } wallet += v; popMoney(v, label); sound.cash(v > 0); }
// Under her rules the land tax keeps land prices down (Henry George), so homes cost less.
function priceOf(L) { return (rules === 2 ? 0.7 : 1) * TOWNS[zone].price * (L.style ? STYLES_LOT[L.style].priceK : 0.85 + L.tier * 0.1) * market * L.priceK; }
function chunkTier(slot) { const v = townSlot(slot); return typeof v === 'string' ? STYLES_LOT[v].tier : v; }
function rentFor(zn) { return Math.round(TOWNS[zn].rent * rentBase / RENT_WEEK); }
// What a home you own is worth now, and what the bank will still lend you against them all.
function valueOf(o) { return o.price * (market / o.mBuy) * o.lift; }
function totalValue() { return owned.reduce((s, o) => s + valueOf(o), 0); }
function usableEquity() { return Math.max(0, owned.reduce((s, o) => s + valueOf(o) - o.price, 0) * 0.8 - equityUsed); }
function buyingPower() { return wallet + usableEquity(); }
function rentOf(o) { return valueOf(o) * RENT_YIELD[rules - 1]; }
function paydayIn() { const half = CHUNK_LEN * LAP_LEN / 2; return Math.round(half - modN(distanceWalked, half)); }

/* ---------- Generated billboards ---------- */
// Sentence templates; {tokens} are filled with live numbers from the street around you.
const SIGNS = {
  0: ['Charming fixer-upper. Roof sold separately.', 'Rent {rent}/wk. Mould included at no extra cost.', 'Cosy! (It means small.)', 'Room in share house. 6 housemates, 1 bathroom, endless vibes.', 'Walk to everything you can’t afford.'],
  1: ['{people} people at today’s inspection. Bring a CV.', 'Must love stairs, no parking and your landlord.', 'Renovated: we painted it grey.', 'Just {deposit} deposit. Just 6 years of saving.', 'Light-filled! (One window.)'],
  2: ['Gated for your safety. (From you.)', 'Your dream home. Someone else’s investment.', 'Heritage charm from {price}. Heritage wages not included.', 'Live where your barista can’t.', 'Second home? Third home? Why stop?'],
  3: ['Luxury apartments. 80% empty. 100% sold.', 'Off the plan from {price}. Off your budget forever.', 'Rooftop pool for owners. Rooftop view of it for renters.', 'Prices up {growth}% this year. Wages up 3%.', 'Invest in bricks. Live in a shoebox.'],
  4: ['Penthouse {price}. Studio from your dreams.', 'Sky homes for people who already have homes.', 'Exclusive: nobody you know lives here.', 'Your rent paid for this view.', 'Buy now. Prices only go up. (For us.)'],
  out: ['New estate! Commute just {commute}.', 'Paddock to palace. Shops coming 2041.', 'Pushed out of the city? Welcome! Homes from {price}.', 'Only {commute} to the city. Each way.', 'The bus comes twice a day. Enjoy the space.'],
  // Once you own homes, the city starts talking to you instead.
  landlord: ['Landlord of the Year: YOU', 'Fewer neighbours. More equity.', 'Raise the rent? Everyone else is.', 'Your tenant is 24 and saving for a deposit. Sound familiar?', 'Congratulations. You are the market now.', 'Negative gearing: the tax office helps you buy their home.', 'Another family moved further out. Your commute: 0 min.'],
  // Luxury towers going up where homes were.
  luxury: ['Luxury apartments. 80% empty. 100% sold.', 'Affordable housing: coming soon.', 'From {price}. Bought by people who won’t live here.', 'Coming soon: 300 homes nobody here can afford.', 'Invest in bricks. Live in a shoebox.'],
  // A street that has been emptied.
  empty: ['Nobody lives here now. Great investment.', 'Ghost street. Prime location.', 'For lease. For lease. For lease.', 'Quiet neighbourhood. Very quiet.'],
  // Her other rules: the signs tell what the shared land tax pays for.
  shared: ['Land tax shared: {share} to everyone this year.', 'Homes are for living in.', 'Rent steady. Neighbours stayed.', 'The park is open. It’s yours too.', 'New school, paid for by the land.']
};
function fillSign(text, tier, n = 0) {
  const L = { tier, priceK: 1 };
  return text.replace('{rent}', money(rentWeek * (1 + tier * 0.6))).replace('{people}', 25 + tier * 12 + (n % 15))
    .replace('{price}', moneyK(priceOf(L))).replace('{deposit}', moneyK(priceOf(L) * DEPOSIT))
    .replace('{growth}', GROWTH[0]).replace('{share}', money(STREET_SHARE)).replace(/{commute}/g, commuteText());
}
// Which voice the city speaks in right now: it changes as you change the street.
function signPool(tier) {
  if (rules === 2) { return SIGNS.shared; }
  if (movedOut >= 8) { return SIGNS.empty; }
  if (owned.length) { return SIGNS.landlord; }
  if (zone >= 4) { return SIGNS.out; }
  if (tier >= 3) { return SIGNS.luxury; }
  return SIGNS[tier];
}
function signText(p) { if (p.fixed || p.idx === undefined) { return p.text || ""; } const pool = signPool(p.tier); return fillSign(pool[p.idx % pool.length], p.tier, p.idx); }
function pickSign(tier, r) { return fillSign(SIGNS[tier][Math.floor(r() * SIGNS[tier].length)], tier); }


/* ---------- Called from chunkAt() ---------- */
function plotsForChunk(ch, r) {
  // One or two plots for sale per block; under Rule 1 some are bought by investors before you get there.
  for (const side of [-1, 1]) {
    if (r() < 0.3) { continue; }
    const cand = ch.lots.filter(L => !L.special && L.side === side && L.z0 > ch.z0 + CROSS_W + 4);
    if (cand.length) {
      const L = cand[Math.floor(r() * cand.length)], inv = r() < 0.3 ? mixN(22, 45, r()) : -1;
      Object.assign(L, { forSale: true, priceK: mixN(0.85, 1.2, r()), investorAt: rules === 1 ? inv : -1 });
      // The family who live there, out the front of their home.
      const mid = (L.z0 + L.z1) / 2;
      for (let k = 0; k < 2; k++) { ch.props.push({ kind: 'person', x: side * (EDGE_X - 0.7 - k * 0.4), z: mid + (k ? 1.4 : -0.6), tone: r(), h: mixN(1.5, 1.85, r()), ph: r() * 6, residentRank: 0, lotRef: L }); }
    }
  }
  // The very first block: one home you can just afford, close ahead, so the story starts at once.
  if (ch.c === 0 && !owned.length) {
    const L = ch.lots.filter(l => !l.special && l.z0 > ch.z0 + CROSS_W + 4).sort((a, b) => a.z0 - b.z0)[0];
    if (L) {
      for (const M of ch.lots) { if (M !== L) { M.forSale = false; } }   // nothing dearer beside it to confuse you
      if (!L.forSale) { Object.assign(L, { forSale: true, priceK: 1 }); const mid = (L.z0 + L.z1) / 2; for (let k = 0; k < 2; k++) { ch.props.push({ kind: 'person', x: L.side * (EDGE_X - 0.7 - k * 0.4), z: mid + (k ? 1.4 : -0.6), tone: r(), h: mixN(1.5, 1.85, r()), ph: r() * 6, residentRank: 0, lotRef: L }); } }
      L.investorAt = -1; L.priceK = 1; L.priceK = START_SAVINGS * 0.93 / DEPOSIT / priceOf(L);
    }
  }
  // Front-yard trees in the suburbs, palms at the villas, bins and a fire drum at the caravan park.
  for (const L of ch.lots) {
    const mid = (L.z0 + L.z1) / 2;
    if (L.style === 'bungalow' && L.tree) { ch.props.push({ kind: 'tree', x: L.side * (EDGE_X + 2.2), z: L.z0 + (L.z1 - L.z0) * 0.2, h: mixN(4, 5.5, r()), tone: r() }); }
    if (L.style === 'villa' || L.style === 'castle') { ch.props.push({ kind: 'tree', x: L.side * (EDGE_X + 1.8), z: mid - 5, h: mixN(5, 7, r()), tone: r() }, { kind: 'tree', x: L.side * (EDGE_X + 1.8), z: mid + 5, h: mixN(5, 7, r()), tone: r() }); }
    if (L.style === 'caravan' && r() < 0.5) { ch.props.push({ kind: 'bin', x: L.side * (EDGE_X - 0.6), z: mid, tone: r() }); }
  }
  for (const b of ch.back) {
    if (ch.style === 'bungalow') { b.h = mixN(5, 7.5, r()); b.color = pickN(r, ['#c8a890', '#b8a898', '#a8b0a0']); }
    if (ch.style === 'caravan') { b.h = mixN(2.5, 4, r()); b.color = pickN(r, ['#9a9080', '#8a8a7a']); }
    if (ch.style === 'castle' || ch.style === 'villa') { b.h = mixN(12, 18, r()); b.color = pickN(r, ['#5a8a4a', '#4a7a42', '#6a9a52']); }
  }
  // A signpost at the crossing: which way is cheaper, which way is richer.
  ch.props.push({ kind: 'turnsign', x: ROAD_W + 0.9, z: ch.z0 - 0.8, side: 1 });
  // Billboards on the pavement, written from the prices on this block.
  for (let i = 0; i < 2; i++) {
    if (r() < 0.45) { continue; }
    const side = i === 0 ? -1 : 1, z = ch.z0 + CROSS_W + 6 + r() * (CHUNK_LEN - CROSS_W - 12);
    ch.props.push({ kind: 'billboard', x: side * (ROAD_W + 1.4), z, side, tier: ch.tier, idx: Math.floor(r() * 1000), col: DISTRICTS[ch.tier].stripe[0] });
  }
  // An open home with a queue down the pavement, in the cheaper districts.
  if (ch.tier <= 2 && zone >= 2 && r() < 0.55) {
    const L = ch.lots.find(l => !l.special && !l.forSale && l.tier <= 2);
    if (L) {
      const n = 8 + Math.floor(r() * 10), zz = L.z0 + 1;
      ch.props.push({ kind: 'openhome', x: L.side * (EDGE_X - 0.4), z: zz, side: L.side, n });
      for (let k = 0; k < n; k++) { ch.props.push({ kind: 'person', x: L.side * (EDGE_X - 1.2 - (k % 2) * 0.5), z: zz - 1.2 - k * 0.75, tone: r(), h: mixN(1.55, 1.85, r()), ph: r() * 6 }); }
    }
  }
}
// Rule 2: a home bought on the street brings a garden and neighbours with it.
function addGarden(ch, L, fresh) {
  const mid = (L.z0 + L.z1) / 2, r = rngN(L.seed + 5), b = fresh ? clockT + 0.3 : undefined;
  ch.props.push({ kind: 'tree', x: L.side * (ROAD_W + 2.3), z: mid - 2.5, h: mixN(4.5, 6.5, r()), tone: r(), born: b });
  ch.props.push({ kind: 'tree', x: L.side * (ROAD_W + 2.3), z: mid + 3, h: mixN(4.5, 6.5, r()), tone: r(), born: b && b + 0.3 });
  ch.props.push({ kind: 'flowers', x: L.side * (EDGE_X - 0.5), z: mid, side: L.side, seed: L.seed, born: b && b + 0.5 });
  for (let k = 0; k < 3; k++) {
    const tz = mid - 2 + k * 1.6, p = { kind: 'person', x: L.side * (EDGE_X - 1.1 - (k % 2) * 0.5), z: fresh ? tz + 14 + k * 2 : tz, tz, tone: r(), h: mixN(1.5, 1.85, r()), ph: r() * 6, residentRank: 0, born: b };
    if (fresh) { p.arrive = true; }
    ch.props.push(p);
  }
}

/* ---------- Every frame ---------- */
function boardUpdate(z) {
  updateTurn();
  const dt = Math.min(deltaTime / 1000, 0.05);
  // Prices rise with time, and time is the walk: standing still, nothing changes.
  const walked = distanceWalked - lastWalkZ; lastWalkZ = distanceWalked;
  if (!paused && !intro && !ending && walked > 0 && walked < 5) { market *= 1 + GROWTH[rules - 1] / 100 * walked / YEAR_M; }
  if (ending && ending.kind === 'rule1') { emptyK = Math.max(0.06, 1 - (clockT - ending.t) / 3); }
  for (const ch of chunks.values()) {
    evolveStreet(ch);
    // People carrying their boxes away, and new neighbours walking in.
    for (let i = ch.props.length - 1; i >= 0; i--) {
      const p = ch.props[i];
      if (p.mover) { p.z += 1.25 * dt; p.ph += dt * 4; if (clockT > p.until) { ch.props.splice(i, 1); } }
      else if (p.arrive) { if (p.z > p.tz) { p.z = Math.max(p.tz, p.z - 1.3 * dt); p.ph += dt * 4; } else { p.arrive = false; } }
    }
  }
  // Rule 1: investors buy plots out from under you, and leave them empty.
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (L.forSale && L.investorAt > 0 && (L.z0 + L.z1) / 2 - z < L.investorAt) {
        const tower = makeLot(null, Math.min(4, L.tier + 2), L.side, L.z0, L.z1 - L.z0, rngN(L.seed));
        Object.assign(L, { style: null, forSale: false, investorAt: -1, sold: true, vacant: true, changedYear: lifeAge, born: clockT + 0.2, H: tower.H, depth: tower.depth, color: tower.color, tier: tower.tier, crown: tower.crown, spire: tower.spire, glass: tower.glass, name: 'SOLD', sign: true });
        preserveLot(L); ch.props = ch.props.filter(p => p.lotRef !== L);
        ch.props.push({ kind: 'billboard', x: L.side * (ROAD_W + 1.4), z: (L.z0 + L.z1) / 2, side: L.side, text: 'SOLD to an investor. Will sit empty.', fixed: true, col: '#c8322a', born: clockT });
        sound.jail(); sayToast('An investor bought it first.');
      }
    }
  }
  if (!ending && rules === 1 && owned.length >= OWN_GOAL && clockT - owned[owned.length - 1].t > 3) { endWalk('rule1'); }
}
// Pay day: twice a lap, a year each time.
function onPassGo() {
  if (ending || intro) { return; }
  lifeAge++;
  // Two lines only: what your job left you (after rent, or the mortgage on your own home),
  // and what your other homes earned you (rent, less their interest, and in Round 2 the land tax).
  let job = WAGES - LIVING;
  if (!home) { rentWeek = rentFor(zone); const rentYear = rentWeek * 52; rentPaid += rentYear; job -= rentYear; }
  const mine = owned.find(o => o.home), tenants = owned.filter(o => !o.home);
  const homeLoan = mine ? Math.min(loans, mine.price * (1 - DEPOSIT)) : 0;
  job -= homeLoan * INTEREST;
  let homes = -(loans - homeLoan) * INTEREST;
  if (tenants.length) { const r = tenants.reduce((s, o) => s + rentOf(o), 0); rentIn += r; homes += r; tenants.forEach(o => { o.lift *= rules === 1 ? 1.03 : 1; }); }
  if (rules === 2) { homes -= tenants.reduce((s, o) => s + valueOf(o), 0) * LAND_TAX; homes += STREET_SHARE; taxShared += STREET_SHARE; }
  addMoney(job, home ? 'your job, after the mortgage' : 'your job, after rent');
  if (owned.length || rules === 2) { setTimeout(() => addMoney(homes, rules === 1 ? (tenants.length ? 'your tenants' : 'the bank') : (tenants.length ? 'tenants, less land tax, plus your share' : 'your share of the land tax')), 600); }
  rentBase = Math.round(rentBase * (rules === 1 ? 1.07 : 1.02)); rentWeek = rentFor(zone);
  sayToast(`A year passes. You’re ${lifeAge}.`);
  if (lifeAge >= endAge()) { setTimeout(() => endWalk(rules === 1 ? 'rule1' : 'rule2'), 2600); }
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
  const dep = priceOf(L) * DEPOSIT, pw = buyingPower();
  return pw >= dep ? { label: `E  ·  Buy it  (deposit ${money(dep)})`, ok: true } : { label: `Deposit ${money(dep)}  ·  you have ${money(pw)}`, ok: false };
}
function useHere() {
  if (intro) { intro = false; return; }
  if (ending) { if (ending.kind === 'rule1' && clockT - ending.t > 3.5) { startRule2(); } return; }
  const L = plotHere(distanceWalked), act = actionFor(L);
  if (!act) { sayToast('Find a FOR SALE sign first.'); return; }
  if (!act.ok) { sayToast('Not enough money yet.'); return; }
  buyLot(L);
}
function buyLot(L) {
  const price = priceOf(L), dep = price * DEPOSIT, cash = Math.min(wallet, dep), fromEquity = dep - cash;
  addMoney(-cash, 'deposit'); equityUsed += fromEquity; loans += price - dep + fromEquity;
  const first = !home, ch = chunks.get(Math.floor(L.z0 / CHUNK_LEN)), mid = (L.z0 + L.z1) / 2, n = movedFrom(L);
  const o = { key: L.memoryKey, price, mBuy: market, lift: 1, tier: L.tier, zone, home: first, t: clockT };
  owned.push(o);
  if (first) { home = { price, t: clockT, commute: commuteText(), zone, lifeAge }; }
  Object.assign(L, { forSale: false, owned: true, home: first, investorAt: -1, thud: false }); L.born = clockT + 0.3;   // it rises again, as yours
  if (ch && rules === 1) { ch.props = ch.props.filter(p => p.lotRef !== L); }
  if (rules === 1) {
    if (!first) { L.color = mixHex(L.color, OWNER_COL, 0.5); }
    // The people who lived here pack up and walk away down the street.
    movedOut += n;
    if (ch) {
      const r = rngN(L.seed + 11);
      const say = pickN(r, LEAVING);
      for (let k = 0; k < n + 1; k++) { ch.props.push({ kind: 'person', mover: true, box: k % 3 !== 2, x: L.side * (EDGE_X - 0.9 - (k % 2) * 0.45), z: mid - 1.5 + k * 0.9, tone: r(), h: mixN(1.5, 1.85, r()), ph: r() * 6, residentRank: 0, born: clockT - 5, until: clockT + 25, say: k === 0 ? say : null, sayT: clockT + 0.6 }); }
      // Everything else for sale on this block jumps in price, and the homes you own here are worth more.
      for (const M of ch.lots) { if (M.forSale) { M.priceK *= 1.15; } }
      // ...including the homes you own here, the one you just bought too: the bank will lend you more against them.
      for (const q of owned) { if (q.key && q.key.split(':')[1] === String(ch.slot) && q.zone === zone) { q.lift *= 1.07; } }
    }
    landlordMode = owned.length >= 2;
    soldBeat = { t: clockT, who: familyOf(L), n, ok: true };
    if (sound.evict) { setTimeout(() => sound.evict(), 350); }
  } else {
    newNeighbours += 3;
    if (ch) { addGarden(ch, L, true); const arr = ch.props.filter(p => p.arrive); if (arr.length) { arr[0].say = pickN(rngN(L.seed), ARRIVING); arr[0].sayT = clockT + 1; } }
    soldBeat = { t: clockT, who: 'New neighbours', n: 3, ok: false };
    if (sound.welcome) { setTimeout(() => sound.welcome(), 350); }
  }
  preserveLot(L);
}
function endWalk(kind) { if (ending) { return; } ending = { kind, t: clockT }; sound.go(); baseNight = kind === 'rule1' ? 0.6 : 0.15; nightTarget = baseNight; }
function resetLife() {
  streetMemory.clear(); nameBox = null; sideSt = null; queuedTurn = 0; turnAnim = null; turnYaw = 0;
  wallet = START_SAVINGS; lifeAge = START_AGE; zone = START_ZONE; market = 1; rentPaid = 0; rentBase = RENT_WEEK; rentWeek = rentFor(START_ZONE); home = null; ending = null; landlordMode = false;
  owned = []; loans = 0; equityUsed = 0; rentIn = 0; movedOut = 0; newNeighbours = 0; taxShared = 0; emptyK = 1;
  baseNight = 0; nightTarget = 0; ownedFromC = Infinity; intro = true; toasts.length = 0; moneyPops.length = 0; soldBeat = null;
  chunks.clear(); firedCasinos.clear(); visitedJails.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
}
function restartWalk() { rules = 1; firstRun = null; seed += 97; startSeed = seed; resetLife(); }
// Her other rules, on the very same street.
function startRule2() {
  firstRun = { owned: owned.length, value: totalValue(), moved: movedOut, rent: rentIn };
  rules = 2; if (startSeed !== null) { seed = startSeed; } resetLife();
}

/* ---------- Turning: left to a cheaper town further out, right to a richer one closer in ---------- */
function nextCrossing(z) { const local = modN(z, CHUNK_LEN); return local < CROSS_W - 1 ? 0 : CHUNK_LEN - local + 2; }
function atCrossing(z) { const local = modN(z, CHUNK_LEN); return local > 0.5 && local < CROSS_W - 0.5; }
// Pressing ← or → picks the next corner. From then on the town you are turning into is
// already there down the cross street. At the corner you turn on the spot, with no cut: the
// old town's corner buildings sink away while the new town's rise, and you walk on.
let sideSt = null;   // the side street: { chunks, zone, dir, zc (its crossing in this street), s0 (that crossing in its own street), c }
function tryTurn(dir) {
  if (turnAnim || intro || ending || nameBox) { return; }
  if (dir > 0 && zone === 0) { sayToast('Nowhere richer than this.'); return; }
  if (dir < 0 && zone === ZONE_NAMES.length - 1) { sayToast('Nowhere poorer than this.'); return; }
  const c = Math.floor(distanceWalked / CHUNK_LEN) + (modN(distanceWalked, CHUNK_LEN) < CROSS_W / 2 + 1 ? 0 : 1);
  queuedTurn = dir; makeSide(dir, c);
  const ahead = Math.max(0, c * CHUNK_LEN + CROSS_W / 2 - distanceWalked);
  sayToast(`${dir < 0 ? '←' : '→'} ${ZONE_NAMES[zone - dir]}`);
}
function makeSide(dir, c) {
  const zc = c * CHUNK_LEN + CROSS_W / 2;
  if (sideSt && sideSt.dir === dir && sideSt.c === c) { return; }
  sideSt = { chunks: new Map(), zone: zone - dir, dir, zc, s0: zc, c, t: clockT, turning: false, fromZ: zc + CROSS_W / 2 - 0.5, minLot: zc + 34 };
}
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
function newStreet() {
  const c = Math.floor(distanceWalked / CHUNK_LEN);
  chunks.clear(); firedCasinos.clear(); visitedJails.clear(); sideSt = null;
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
// A street sign at each crossing: left to a cheaper town, right to a richer one.
function drawTurnSign(q, p) {
  const k = q.k; if (k < 3) { return; }
  const w = 3.4 * k, h = 0.55 * k, top = q.y - 3.4 * k, out = zone < ZONE_NAMES.length - 1 ? ZONE_NAMES[zone + 1] : null, inn = zone > 0 ? ZONE_NAMES[zone - 1] : null;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = '#3a4a3a'; ctx.fillRect(q.x - 0.06 * k, top - 0.2 * k, 0.12 * k, 3.6 * k);
  const plate = (y, text, col, left) => {
    ctx.fillStyle = col; ctx.beginPath(); const x0 = left ? q.x - w : q.x, tip = left ? x0 : x0 + w;
    ctx.moveTo(left ? x0 + h * 0.5 : x0, y); ctx.lineTo(left ? x0 + w : x0 + w - h * 0.5, y); ctx.lineTo(left ? x0 + w : tip, y + h / 2); ctx.lineTo(left ? x0 + w : x0 + w - h * 0.5, y + h); ctx.lineTo(left ? x0 + h * 0.5 : x0, y + h); ctx.lineTo(left ? tip : x0, y + h / 2); ctx.closePath(); ctx.fill();
    if (k > 8) { ctx.fillStyle = '#fff'; ctx.font = `bold ${h * 0.42}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, left ? q.x - w / 2 + h * 0.2 : q.x + w / 2 - h * 0.2, y + h / 2 + 1, w * 0.85); }
  };
  if (out) { plate(top, `${out} · ${commuteShort(zone + 1)}`, '#3f8fd6', true); }
  if (inn) { plate(top + h * 1.2, `${inn} · ${commuteShort(zone - 1)}`, '#c8322a', false); }
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
    const words = signText(p).split(' '), lines = []; let line = '';
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w * 0.86 && line) { lines.push(line); line = wd; } else { line = t; } }
    lines.push(line);
    const lh = size * 1.15, y0 = top - h / 2 - (lines.length - 1) * lh / 2;
    lines.slice(0, 4).forEach((ln, i) => ctx.fillText(ln, x, y0 + i * lh));
  }
  ctx.restore();
}
// People queueing for an open home.
function drawOpenHome(q, p) {
  const k = q.k; if (k < 2 || emptyK < 0.7 || (rules === 1 && movedOut >= 6)) { return; }
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
  shared: ['Morning, neighbour!', 'The kids play outside again.', 'Nice to have you here.', 'The land tax fixed the park.']
};
function moodN() { return rules === 2 ? 'shared' : owned.length === 0 ? 'renter' : owned.length < 3 ? 'wary' : 'cold'; }
function noticeYou(q, p) {
  if (p.mover || p.arrive || p.talked || intro || ending || turnAnim) { return; }
  const dz = p.z - distanceWalked; if (dz < 1.5 || dz > 8 || q.k < 3 || q.x < 40 || q.x > width - 40) { return; }
  if (clockT - talkT < 3.2) { return; }
  p.talked = true; if (!p.lotRef && Math.random() < 0.35) { return; }
  const pool = p.lotRef ? SAY[rules === 1 ? 'family1' : 'family2'] : SAY[moodN()];
  p.say = pool[Math.floor(Math.random() * pool.length)]; p.sayT = clockT; p.mood = p.lotRef ? (rules === 1 ? 'sad' : 'warm') : moodN(); talkT = clockT;
  if (sound && sound.enabled && sound.context && sound._note) { const t = sound.context.currentTime, warm = p.mood === 'shared' || p.mood === 'renter' || p.mood === 'warm'; sound._note(warm ? 620 : 300, t, 0.12, 'triangle', 0.03); sound._note(warm ? 780 : 260, t + 0.1, 0.16, 'triangle', 0.03); }
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
    if (p.mood === 'shared' || p.mood === 'renter' || p.mood === 'warm') { const wv = Math.sin(clockT * 9) * 0.12 * k; ctx.moveTo(hx + 0.22 * k, q.y - (h - 0.35) * k); ctx.lineTo(hx + 0.42 * k + wv, q.y - (h + 0.2) * k); }
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
// Rule 1: the street loses its colour as its families are moved out.
function drawStreetLife() {
  const a = 0.12 + (1 - streetLife()) * 0.8;
  ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = a; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, width, height); ctx.restore();
}
// Small icons for the HUD and the opening card.
function houseIcon(x, y, sz, col, filled) {
  push(); stroke(col); strokeWeight(Math.max(1.5, sz * 0.09)); if (filled) { fill(col); } else { noFill(); }
  beginShape(); vertex(x, y + sz); vertex(x, y + sz * 0.45); vertex(x + sz * 0.5, y); vertex(x + sz, y + sz * 0.45); vertex(x + sz, y + sz); endShape(CLOSE);
  if (filled) { noStroke(); fill(255, 250, 238); rect(x + sz * 0.38, y + sz * 0.62, sz * 0.24, sz * 0.38); }
  pop();
}
function personIcon(x, y, sz, col, box) {
  push(); noStroke(); fill(col); circle(x + sz * 0.5, y + sz * 0.18, sz * 0.36); rect(x + sz * 0.22, y + sz * 0.4, sz * 0.56, sz * 0.6, sz * 0.15);
  if (box) { fill('#c09060'); rect(x + sz * 0.05, y + sz * 0.5, sz * 0.9, sz * 0.4); }
  pop();
}
function iconRow(x, y, n, max, sz, drawOne) { let i = 0; for (; i < Math.min(n, max); i++) { drawOne(x + i * (sz + 4), y); } if (n > max) { fill(200, 50, 40); textSize(12); textAlign(LEFT, CENTER); text(`+${n - max}`, x + i * (sz + 4) + 2, y + sz / 2); } }
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
// The sign outside a home you own and rent out.
function drawYours(L) {
  if (!L.owned) { return; }
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + 1.4), base = P(x, 0, mid);
  if (base.rz < 1.5 || base.rz > FAR_Z * 0.8) { return; }
  const k = base.k, w = 3.4 * k, h = 1.6 * k, top = base.y - 3 * k, o = owned.find(q => q.key === L.memoryKey);
  ctx.save(); ctx.globalAlpha = 1 - fogFor(mid) * 0.8;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(base.x - 0.07 * k, top, 0.14 * k, 3 * k);
  ctx.fillStyle = '#2a1e18'; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h);
  ctx.strokeStyle = rules === 1 ? OWNER_COL : SHARE_COL; ctx.lineWidth = Math.max(1, 0.08 * k); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${h * 0.26}px Georgia, serif`; ctx.fillStyle = rules === 1 ? '#ffe9a8' : '#c8f0d0'; ctx.fillText(L.home ? 'YOUR HOME' : rules === 1 ? 'YOURS · LET' : 'YOURS', base.x, top - h * 0.2 + h * 0.3);
    if (o && !L.home) { ctx.font = `${h * 0.2}px Georgia, serif`; ctx.fillStyle = '#e8dcc8'; ctx.fillText(`tenant pays ${money(rentOf(o) / 52)}/wk`, base.x, top - h * 0.2 + h * 0.66, w * 0.9); }
  }
  ctx.restore();
}

/* ---------- HUD ---------- */
function drawBoardHud() {
  const z = distanceWalked;
  push(); textFont('Georgia');
  if (!intro && !ending) {
    // The game so far, top left.
    const x = 16, y = 16, w = Math.min(270, width * 0.42), h = 96;
    noStroke(); fill(0, 50); rect(x + 3, y + 4, w, h, 8); fill(255, 250, 238); rect(x, y, w, h, 8);
    fill(rules === 1 ? '#c8322a' : SHARE_COL); rect(x, y, 6, h, 8, 0, 0, 8);
    fill(40, 30, 24); textStyle(BOLD); textSize(16); textAlign(LEFT, TOP); text(ZONE_NAMES[zone], x + 16, y + 10);
    textStyle(NORMAL); textSize(11); fill(150, 120, 100); textAlign(RIGHT, TOP); text(`AGE ${lifeAge} / ${endAge()}`, x + w - 12, y + 13); text(commuteShort(zone), x + w - 12, y + 27); textAlign(LEFT, TOP);
    for (let i = 0; i < Math.max(OWN_GOAL, owned.length); i++) { houseIcon(x + 16 + i * 22, y + 38, 17, i < owned.length ? color(OWNER_COL) : color(190, 175, 160), i < owned.length); }
    const pc = rules === 1 ? color(200, 50, 40) : color(SHARE_COL), np = rules === 1 ? movedOut : newNeighbours;
    if (np) { iconRow(x + 16, y + 68, np, Math.floor((w - 50) / 15), 12, (ix, iy) => personIcon(ix, iy, 12, pc, rules === 1)); }
    else { fill(150, 130, 120); textSize(11); text(rules === 1 ? 'Families moved out: none yet' : 'Nobody has to leave', x + 16, y + 68); }
    // Money, top right.
    const ww = 190, wx = width - ww - 16, perMin = homesPerYear(), wh = perMin > 1 ? 84 : 62, bump = Math.max(0, 1 - (clockT - coinHitT) / 0.25);
    fill(0, 50); rect(wx + 3, y + 4, ww, wh, 8); fill(255, 250, 238); rect(wx, y, ww, wh, 8);
    fill(120, 100, 90); textSize(10); textAlign(RIGHT, TOP); text('YOU CAN SPEND', wx + ww - 14, y + 10);
    fill(bump > 0 ? lerpColor(color(40, 30, 24), color(47, 138, 58), bump) : color(40, 30, 24)); textStyle(BOLD); textSize(24 + bump * 4); text(money(buyingPower()), wx + ww - 14, y + 26 - bump * 2); textStyle(NORMAL);
    if (perMin > 1) { fill(47, 138, 58); textStyle(BOLD); textSize(12); text(`▲ ${money(perMin)} a year`, wx + ww - 14, y + 58); textStyle(ITALIC); textSize(10); fill(120, 100, 90); text('you didn’t work for this', wx + ww - 14, y + 72); textStyle(NORMAL); }
    drawCoins(wx + ww - 60, y + 38);
    for (let i = moneyPops.length - 1; i >= 0; i--) {
      const m = moneyPops[i], age2 = clockT - m.t; if (age2 > 2.4) { moneyPops.splice(i, 1); continue; } if (age2 < 0) { continue; }
      fill(m.up ? '#2f8a3a' : '#c8322a'); textStyle(BOLD); textSize(16); textAlign(RIGHT, TOP); drawingContext.globalAlpha = 1 - easeN((age2 - 1.6) / 0.8);
      text(m.text, wx + ww - 14, y + wh + 8 + age2 * 16); drawingContext.globalAlpha = 1; textStyle(NORMAL);
    }
    // The plot beside you.
    const L = plotHere(z), act = actionFor(L);
    const beat = soldBeat && clockT - soldBeat.t < 2.4;
    if (L && !beat) { const nw = (textStyle(BOLD), textSize(17), textWidth(nextText()) + 90), low = width / 2 - nw / 2 < 16 + w + 8 || width / 2 + nw / 2 > wx - 8; textStyle(NORMAL); drawListing(L, width - 16 - 200, low ? 184 : y + wh + 20); }
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i], a2 = clockT - t.t; if (a2 > 4.2) { toasts.splice(i, 1); continue; }
      drawingContext.globalAlpha = easeN(a2 / 0.3) * (1 - easeN((a2 - 3.6) / 0.6));
      textStyle(ITALIC); textSize(16); fill(255); stroke(0, 140); strokeWeight(3); textAlign(CENTER, CENTER); text(t.text, width / 2, height - 146 - (toasts.length - 1 - i) * 26);
      noStroke(); drawingContext.globalAlpha = 1; textStyle(NORMAL);
    }
    if (!beat) { drawNextBar(); }
    // What the street sounds like, bottom left.
    if (sound && sound.style && typeof MUSIC_NAME !== 'undefined') {
      const on = sound.enabled && sound.context && sound.context.state === 'running', label = on ? `♪  ${MUSIC_NAME[sound.style]}` : '♪  Click for sound';
      textStyle(BOLD); textSize(12); const lw = textWidth(label) + 24; noStroke(); fill(0, 60); rect(16 + 2, height - 46 + 3, lw, 26, 13); fill(sound.style === 'rich' ? color(212, 160, 23) : sound.style === 'poor' ? color(110, 100, 96) : color(63, 143, 214)); rect(16, height - 46, lw, 26, 13);
      fill(255); textAlign(LEFT, CENTER); text(label, 28, height - 33); textStyle(NORMAL);
    }
  }
  if (!intro && !ending) { drawSoldBeat(); }
  if (intro) { drawOpening(); }
  if (ending && ending.kind === 'rule1') {
    const lines = [`You own ${owned.length} homes, worth ${moneyK(totalValue())}.`, `Your homes made you ${moneyK(totalValue() - owned.reduce((t, o) => t + o.price, 0) + rentIn)}. You didn’t work for it.`, `${movedOut} families moved further out so you could buy.`, '', 'This game was invented in 1904 by Lizzie Magie.', 'She called it The Landlord’s Game. It was a warning:', 'under these rules one player wins, and the street empties.', 'She wrote a second set of rules too.'];
    storyCard(owned.length >= OWN_GOAL ? 'YOU WIN' : 'TIME’S UP', lines, clockT - ending.t > 3.5 ? 'Press E or click to play her other rules' : '', easeN((clockT - ending.t - 2.5) / 1.2));
  }
  if (ending && ending.kind === 'rule2') {
    const a = firstRun || { owned: 0, moved: 0 };
    const lines = [`Rule 1: you owned ${a.owned}. ${a.moved} families moved out.`, `Rule 2: you owned ${owned.length}. ${newNeighbours} new neighbours moved in.`, `The land tax shared ${money(taxShared)} with you, and the same with everyone.`, '', 'In 1935 Parker Brothers sold the game as Monopoly,', 'with only the first rules. Charles Darrow was called', 'its inventor. Lizzie Magie was paid $500.'];
    storyCard('EVERYONE STILL LIVES HERE', lines, 'Press R to walk again', easeN((clockT - ending.t - 1) / 1.2), SHARE_COL);
  }
  pop();
  if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,236,200,${fadeA * 0.85})`; ctx.fillRect(0, 0, width, height); }
}
// The first thing anyone sees: what this is, what to do, and what it costs, in three lines.
function drawOpening() {
  const r1 = rules === 1, col = r1 ? '#c8322a' : SHARE_COL, pulse = 0.5 + 0.5 * Math.sin(clockT * 4);
  push(); noStroke(); fill(20, 14, 10, 150); rect(0, 0, width, height);
  const w = Math.min(600, width - 32), h = 320, x = width / 2 - w / 2, y = Math.max(12, height / 2 - h / 2), cx = width / 2;
  fill(0, 60); rect(x + 4, y + 6, w, h, 12); fill(255, 250, 238); rect(x, y, w, h, 12); fill(col); rect(x, y, w, 34, 12, 12, 0, 0);
  fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(12); text(r1 ? 'AN ARTWORK · MONOPOLY’S RULES, LIVED ON A REAL STREET' : 'ROUND 2 · THE SAME STREET, HER OTHER RULES', cx, y + 17);
  fill(40, 30, 24); textSize(Math.min(34, w / 14)); text(r1 ? 'THE LANDLORD’S WALK' : 'NOBODY HAS TO LEAVE', cx, y + 70);
  // Row 1: the goal.
  const rx = x + 34, tw = w - 68;
  for (let i = 0; i < OWN_GOAL; i++) { houseIcon(rx + i * 30, y + 112, 24, color(OWNER_COL), true); }
  fill(40, 30, 24); textAlign(LEFT, CENTER); textSize(19); text(r1 ? `Buy ${OWN_GOAL} homes before you turn ${endAge()}.` : `Buy homes again, until ${endAge()}.`, rx + OWN_GOAL * 30 + 12, y + 124, tw - OWN_GOAL * 30 - 12);
  // Row 2: the cost.
  const ry = y + 166;
  for (let i = 0; i < 4; i++) { personIcon(rx + i * 26, ry, 22, r1 ? color(200, 50, 40) : color(SHARE_COL), r1); }
  textStyle(BOLD); textSize(17); fill(r1 ? color(200, 50, 40) : color(SHARE_COL)); text(r1 ? 'Every home you buy, a family has to leave.' : 'Same street. Land tax is shared. Nobody is pushed out.', rx + 4 * 26 + 12, ry + 11, tw - 4 * 26 - 12);
  // Row 3: the keys.
  const ky = y + 232; textStyle(BOLD); textSize(13);
  const keys = [['↑', 'walk'], ['E', 'buy'], ['← →', 'poorer / richer town']];
  let kx = rx; for (const [k, label] of keys) { const kw = textWidth(k) + 20; fill(255); stroke(90, 70, 60); strokeWeight(1.5); rect(kx, ky, kw, 28, 6); noStroke(); fill(40, 30, 24); textAlign(CENTER, CENTER); text(k, kx + kw / 2, ky + 14); textStyle(NORMAL); fill(90, 70, 60); textAlign(LEFT, CENTER); text(label, kx + kw + 8, ky + 14); kx += kw + textWidth(label) + 28; textStyle(BOLD); }
  textAlign(CENTER, CENTER); textStyle(BOLD); textSize(16); fill(col); drawingContext.globalAlpha = 0.55 + 0.45 * pulse; text('Click or press E to start', cx, y + h - 34); drawingContext.globalAlpha = 1;
  pop();
}
// Just after you buy: a stamp, and the name of who had to leave (or who moved in).
// Your homes go up in value every second, so the bank will lend you more: coins fly from each
// home you own to your money, and the number ticks up while you stand there.
const coins = []; let coinT = 0, coinHitT = -9;
function endAge() { return END_AGES[rules - 1]; }   // Round 2 is shorter: two years is enough to see the difference
const YEAR_M = 240; let lastWalkZ = 0;   // half a lap (48 m x 10 / 2) is a year
function homesPerYear() { return owned.length ? totalValue() * GROWTH[rules - 1] / 100 : 0; }
function drawCoins(tx, ty) {
  if (owned.length && !paused && Math.abs(stepSpeed) > 0.5 && clockT - coinT > Math.max(0.35, 1.6 - owned.length * 0.25)) {
    coinT = clockT;
    const mine = []; for (const ch of chunks.values()) { for (const L of ch.lots) { if (L.owned && riseOf(L.born) > 0.9) { const q = P(L.side * (EDGE_X + L.setback + 1), L.H * 0.8, (L.z0 + L.z1) / 2); if (q.rz > 2 && q.x > 0 && q.x < width) { mine.push(q); } } } }
    const from = mine.length ? mine[Math.floor(Math.random() * mine.length)] : { x: 30 + Math.random() * 160, y: 60 };
    coins.push({ x: from.x, y: from.y, t: clockT, arc: 80 + Math.random() * 80 });
  }
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i], u = (clockT - c.t) / 0.9;
    if (u >= 1) { coins.splice(i, 1); coinHitT = clockT; if (sound && sound.enabled && sound.context && sound._note) { sound._note(2093 + Math.random() * 200, sound.context.currentTime, 0.12, 'sine', 0.012); } continue; }
    const e = u * u * (3 - 2 * u), x = lerp(c.x, tx, e), yy = lerp(c.y, ty, e) - Math.sin(u * PI) * c.arc, r = 9 * (1 - u * 0.3);
    push(); noStroke(); fill(0, 40); circle(x + 2, yy + 3, r * 2); fill(OWNER_COL); circle(x, yy, r * 2); fill('#fff1b0'); circle(x - r * 0.25, yy - r * 0.25, r * 0.8);
    fill(120, 80, 10); textStyle(BOLD); textSize(r * 1.2); textAlign(CENTER, CENTER); text('$', x, yy + 0.5); pop();
  }
}
function drawSoldBeat() {
  if (!soldBeat) { return; }
  const age = clockT - soldBeat.t; if (age > 4) { soldBeat = null; return; }
  const a = Math.min(1, age / 0.15, (4 - age) / 0.6), pop0 = 1 + Math.max(0, 0.4 - age) * 1.5, cx = width / 2, cy = height * 0.36;
  push(); drawingContext.globalAlpha = a; translate(cx, cy); rotate(-0.08); scale(pop0);
  const col = soldBeat.ok ? color(200, 50, 40) : color(SHARE_COL); noFill(); stroke(col); strokeWeight(5); rect(-110, -36, 220, 72, 8);
  noStroke(); fill(col); textFont('Georgia'); textStyle(BOLD); textSize(46); textAlign(CENTER, CENTER); text(soldBeat.ok ? 'SOLD' : 'WELCOME', 0, 2);
  pop(); push(); drawingContext.globalAlpha = a; textFont('Georgia'); textAlign(CENTER, CENTER);
  const l1 = soldBeat.ok ? `${soldBeat.who} had to leave.` : 'New neighbours are moving in.', l2 = soldBeat.ok ? `${soldBeat.n} famil${soldBeat.n > 1 ? 'ies' : 'y'} moved out so you could buy.` : 'Nobody had to leave.';
  textStyle(BOLD); textSize(20); const tw = Math.max(textWidth(l1), (textSize(14), textWidth(l2))) + 40; textSize(20);
  noStroke(); fill(30, 20, 16, 200); rect(cx - tw / 2, cy + 52, tw, 58, 10); fill(255); text(l1, cx, cy + 70); textStyle(ITALIC); textSize(14); fill(255, 220, 200); text(l2, cx, cy + 94);
  pop();
}
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
// A listing card in the style of a Monopoly title deed.
function drawListing(L, x, y) {
  const dep = priceOf(L) * DEPOSIT, w = 200, pw = buyingPower(), hh = 118;
  push(); noStroke(); fill(0, 50); rect(x + 3, y + 4, w, hh, 6); fill(255, 252, 244); rect(x, y, w, hh, 6);
  fill(deedCol(L)); rect(x + 8, y + 8, w - 16, 34, 3);
  fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(9); text('FOR SALE', x + w / 2, y + 17); textSize(13); text(deedName(L).toUpperCase(), x + w / 2, y + 31);
  textStyle(NORMAL); textSize(13);
  [['To buy it', moneyK(dep)], ['You have', moneyK(pw)]].forEach(([a, b], i) => { const ly = y + 56 + i * 20; fill(i === 1 && pw < dep ? color(200, 50, 40) : color(40, 30, 24)); textAlign(LEFT, CENTER); text(a, x + 14, ly); textAlign(RIGHT, CENTER); textStyle(BOLD); text(b, x + w - 14, ly); textStyle(NORMAL); });
  textStyle(ITALIC); textSize(11); textAlign(CENTER, CENTER); fill(rules === 1 ? color(200, 50, 40) : color(SHARE_COL));
  text(rules === 1 ? `${familyOf(L)} live here.` : 'Whoever lives here stays.', x + 8, y + 104, w - 16);
  pop();
}

/* ---------- Keys ---------- */
function boardKey(e) {
  const code = e.code;
  if (code === 'ArrowLeft' || code === 'KeyA') { tryTurn(-1); return true; }
  if (code === 'ArrowRight' || code === 'KeyD') { tryTurn(1); return true; }
  if (code === 'KeyE' || code === 'Space' || code === 'Enter' && (intro || ending)) { useHere(); return true; }
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
  const L = plotHere(distanceWalked), pw = buyingPower();
  if (L) { const dep = priceOf(L) * DEPOSIT; return pw >= dep ? 'Press E to buy it' : `Not enough money · wait for pay day`; }
  if (atCrossing(distanceWalked + 12) || atCrossing(distanceWalked + 6)) { return '← poorer town  ·  → richer town'; }
  const n = nextForSale();
  if (n && pw < priceOf(n.L) * DEPOSIT && zone < ZONE_NAMES.length - 1) { return 'Too dear here · turn ← at the corner'; }
  return 'Walk to a FOR SALE sign';
}
function drawNextBar() {
  const t = nextText(); push(); textFont('Georgia'); textStyle(BOLD); textSize(17);
  const w = textWidth(t) + 90, x = width / 2 - w / 2, crowded = x < 16 + Math.min(270, width * 0.42) + 8 || x + w > width - 16 - 190 - 8, y = crowded ? 124 : 16;
  noStroke(); fill(0, 60); rect(x + 3, y + 4, w, 40, 20); fill(42, 30, 24); rect(x, y, w, 40, 20);
  fill('#ffd23f'); rect(x + 10, y + 11, 52, 18, 9); fill(42, 30, 24); textSize(10); textAlign(CENTER, CENTER); text('NEXT', x + 36, y + 20.5);
  fill(255, 236, 190); textSize(17); textAlign(LEFT, CENTER); text(t, x + 72, y + 21);
  pop();
}
function drawTargetMarker() {
  if (intro || ending || nameBox) { return; }
  const n = nextForSale(); if (!n || n.m - distanceWalked < 3) { return; }
  const q = P(n.L.side * (EDGE_X + 1.4), 4.6 + Math.abs(Math.sin(clockT * 3)) * 0.8, n.m); if (q.rz < 2 || q.rz > 95) { return; }
  const s = Math.max(14, Math.min(40, q.k * 1.1));
  ctx.save(); ctx.fillStyle = '#ff4f9a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(q.x - s * 0.6, q.y - s * 1.3); ctx.lineTo(q.x + s * 0.6, q.y - s * 1.3); ctx.lineTo(q.x + s * 0.6, q.y - s * 0.6); ctx.lineTo(q.x + s, q.y - s * 0.6); ctx.lineTo(q.x, q.y + s * 0.3); ctx.lineTo(q.x - s, q.y - s * 0.6); ctx.lineTo(q.x - s * 0.6, q.y - s * 0.6); ctx.closePath();
  ctx.stroke(); ctx.fill(); ctx.restore();
}
function boardClick(mx, my) {
  if (intro) { intro = false; return true; }
  if (ending) { if (ending.kind === 'rule1' && clockT - ending.t > 3.5) { startRule2(); } return true; }
  return false;
}

// Persistent plot identities are independent of the lap and absolute camera distance.
function preserveLot(L) {
  if (!L.memoryKey) { return; }
  streetMemory.set(L.memoryKey, { H: L.H, tier: L.tier, color: L.color, depth: L.depth, crown: L.crown, spire: L.spire, glass: L.glass, name: L.name, sign: L.sign, forSale: L.forSale, investorAt: L.investorAt, sold: L.sold, owned: L.owned, home: L.home, vacant: L.vacant, formerName: L.formerName, changedYear: L.changedYear });
}
function rememberStreet(ch) {
  ch.zoneId = zone;
  ch.lots.forEach((L, i) => {
    L.memoryKey = zone + ':' + ch.slot + ':' + i;
    L.formerName = L.name || 'NEIGHBOURHOOD HOMES';
    L.redevelopYear = L.seed % 3 === 0 ? Infinity : START_AGE + 2 + (Math.abs(L.seed) % 5);
    const saved = streetMemory.get(L.memoryKey);
    if (saved) { Object.assign(L, saved); }
    if (L.owned && rules === 2) { addGarden(ch, L, false); }
  });
  // Ordinary residents, rather than only open-home queues, make the loss visible.
  const rr = rngN(seed + ch.slot * 83 + zone * 761);
  for (let i = 0; i < 12; i++) { ch.props.push({ kind: 'person', x: (i % 2 ? 1 : -1) * (EDGE_X - 0.8), z: ch.z0 + CROSS_W + 2 + rr() * (CHUNK_LEN - CROSS_W - 4), tone: rr(), h: 1.55 + rr() * 0.3, ph: rr() * 6, residentRank: (i + 1) / 13 }); }
  ch.props.filter(p => p.kind === 'person').forEach((p, i) => { if (p.residentRank === undefined) { p.residentRank = (i % 12 + 1) / 13; } });
  evolveStreet(ch);
}
// Rule 1: as the years pass, homes become empty investments, and every home you let out
// means fewer of the old neighbours. Rule 2: nobody is pushed out.
function evolveStreet(ch) {
  if (rules === 2) { ch.residentShare = 1; return; }
  for (const L of ch.lots) {
    if (L.owned || L.vacant || lifeAge < L.redevelopYear) { continue; }
    L.formerName = L.formerName || L.name || 'LOCAL HOMES';
    L.H = Math.max(L.H * 1.65, 20 + (L.seed % 19)); L.tier = 3; L.style = null; L.glass = true; L.color = '#88999f';
    L.vacant = true; L.forSale = false; L.investorAt = -1; L.sign = true; L.name = 'PRIVATE INVESTMENT'; L.changedYear = lifeAge;
    L.born = clockT; preserveLot(L);
  }
  const gone = ch.lots.filter(l => l.vacant || l.owned && !l.home).length;
  ch.residentShare = Math.max(0.1, 1 - gone / Math.max(1, ch.lots.length) * 1.4) * emptyK;
}
