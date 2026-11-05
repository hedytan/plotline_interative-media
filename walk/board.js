/* Plotline — The Landlord's Walk: your win is someone else's loss.
 * Round 1: you are the landlord. One street; press E at a FOR SALE home to buy it. The family who
 * lived there carries their boxes away, and every home after your own turns into a plastic
 * Monopoly piece. Buy 3 and you win: the whole street turns into a board.
 * Round 2: the same street, and you are the first family you evicted, carrying a box. You walk past
 * the homes you bought ("OWNED BY YOU"). Every home for rent is too dear, and at each corner you are
 * pushed into a poorer town further out, until a caravan in The Fringe, 1h 35m from work.
 * The end card tells whose game this was: Lizzie Magie's warning of 1904, sold as Monopoly in 1935.
 */
const START_AGE = 24, OWN_GOAL = 3;
const RENT_WEEK = 380;     // the base weekly rent that town rents are scaled from
const BASE_PRICE = [520000, 780000, 1600000, 2400000, 4800000];  // by district tier, inner city
const ZONE_PRICE = 0.8, DEPOSIT = 0.1;                     // prices fall 20% per town out
const GROWTH = [8, 3];                                      // % price rise per year (a year = half a lap walked), by rule
const RENT_YIELD = [0.09, 0.05];   // tenants pay this share of a home's value a year
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

let lifeAge = START_AGE, zone = START_ZONE, market = 1, rentPaid = 0, rentWeek = TOWNS[START_ZONE].rent, rentBase = RENT_WEEK;
let turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, queuedTurn = 0, nameBox = null;
let ownedFromC = Infinity, home = null, ending = null, intro = true, landlordMode = false, lapStartT = 0;
let rules = 1, firstRun = null, startSeed = null, emptyK = 1;
let owned = [], rentIn = 0, movedOut = 0, walkedTotal = 0;
const toasts = [];
let soldBeat = null;   // the moment after you buy: who had to leave
let evicted = [], lastBuyZ = 0, rentedAt = 0;   // Round 1's families, for Round 2
const RENT_BUDGET = 230;   // what the evicted family can pay a week
function meName() { return (firstRun && firstRun.me) || 'The Nguyens'; }
function rentAsk(L) { return Math.round(TOWNS[zone].rent * (L.style ? STYLES_LOT[L.style].priceK : 0.85 + L.tier * 0.1) * L.priceK / 5) * 5; }
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
// Under her rules the land tax keeps land prices down (Henry George), so homes cost less.
function priceOf(L) { return TOWNS[zone].price * (L.style ? STYLES_LOT[L.style].priceK : 0.85 + L.tier * 0.1) * market * L.priceK; }
function chunkTier(slot) { const v = townSlot(slot); return typeof v === 'string' ? STYLES_LOT[v].tier : v; }
function rentFor(zn) { return Math.round(TOWNS[zn].rent * rentBase / RENT_WEEK); }
// What a home you own is worth now, and what the bank will still lend you against them all.
function valueOf(o) { return o.price * (market / o.mBuy) * o.lift; }
function totalValue() { return owned.reduce((s, o) => s + valueOf(o), 0); }
function rentOf(o) { return valueOf(o) * RENT_YIELD[rules - 1]; }
function paydayIn() { const half = CHUNK_LEN * LAP_LEN / 2; return Math.round(half - modN(distanceWalked, half)); }

/* ---------- Generated billboards ---------- */
// Sentence templates; {tokens} are filled with live numbers from the street around you.
const SIGNS = {
  0: ['Cosy! (Tiny.)', 'Rent {rent}/wk. Mould is a feature.', 'Fixer-upper. You fix it, we raise the rent.', 'Walk to everything you can’t afford.', '6 housemates. 1 bathroom. Endless vibes.'],
  1: ['{people} people at today’s inspection. Bring snacks. And a CV.', 'Light-filled! (One window.)', 'Renovated: we painted it grey and doubled the rent.', 'Just {deposit} deposit. Just 9 years of saving.', 'Pet friendly. People unfriendly.'],
  2: ['Gated for your safety. (From you.)', 'Your dream home. Someone else’s third.', 'Live where your barista can’t.', 'Heritage charm. Heritage wages not included.', 'Why own one home when you can own theirs?'],
  3: ['Luxury apartments. 80% empty. 100% sold.', 'Affordable housing: coming soon™', 'Rooftop pool for owners. A view of it for renters.', 'Invest in bricks. Live in a shoebox.', 'Prices up {growth}%. Wages up 3%. Smile!'],
  4: ['Sky homes for people who already have homes.', 'Exclusive: nobody you know lives here.', 'Your rent paid for this view.', 'Buy now. Prices only go up. (For us.)'],
  out: ['New estate! Only {commute} to the city. Each way.', 'Paddock to palace. Shops coming 2041.', 'Priced out? Welcome! Homes from {price}.', 'The bus comes twice a day. Enjoy the space!', 'Space to breathe. Nothing else.'],
  // Once you own homes, the city starts flattering you.
  landlord: ['LANDLORD OF THE YEAR: YOU', 'Fewer neighbours. More equity.', 'Raise the rent! Everyone else is.', 'Negative gearing: the tax office helps you buy their home.', 'You are the market now. Congratulations!', 'Thank you for your investment. — The City', 'Another one? You deserve it.'],
  luxury: ['Luxury apartments. 80% empty. 100% sold.', 'Affordable housing: coming soon™', 'From {price}. Bought by people who won’t live here.', 'Coming soon: 300 homes nobody here can afford.', 'Invest in bricks. Live in a shoebox.'],
  empty: ['Ghost street. Prime location.', 'Nobody lives here now. Great investment!', 'For lease. For lease. For lease.', 'Quiet neighbourhood. Very quiet.'],
  // Round 2: the street as a renter reads it.
  renting: ['{people} people at today’s inspection. Good luck!', 'Rent {rent}/wk. Applications close in 10 minutes.', 'No pets. No kids. No chance.', 'LANDLORD OF THE YEAR: (not you)', 'Can’t afford it here? Try further out!', 'Rent going up? So is our profit!']
};
// Satire everywhere else on the street: sandwich boards, lamp-post banners, the road itself, riders on the signs.
const AFRAME = ['OPEN HOME · 200 people · 1 bathroom', 'HURRY! Only your life savings', 'BID NOW · CRY LATER', 'NEW! Same old box, new price', 'APPLY HERE · 3 payslips and a kidney', 'NO PETS · NO KIDS · NO PROBLEM', 'TODAY ONLY: everything', 'DREAM HOME · terms & conditions apply'];
const POLE = ['LIVE · WORK · PAY', 'COMMUNITY (SOLD)', 'A GREAT PLACE TO INVEST', 'NEIGHBOURHOOD (FORMERLY)', 'YOUR CITY · OUR PROFIT', 'WELCOME HOME* *conditions'];
const ROAD = ['MIND THE WEALTH GAP', 'SLOW · PRICES RISING', 'NO STANDING UNLESS YOU OWN', 'KEEP WALKING · YOU CAN’T AFFORD TO STOP', 'BUY LANE ONLY', 'CAUTION · GENTRIFICATION AHEAD'];
const RIDER_SALE = ['SOLD OVER ASKING!', 'INVESTOR SPECIAL', '47 OFFERS', 'BE QUICK!', 'KIDS NOT INCLUDED', 'TENANTED · 8% YIELD'];
const RIDER_RENT = ['50 APPLIED', 'NO KIDS', 'RENT BIDDING', '3 PAYSLIPS', 'NO PETS', 'VIEWING: 3 MIN'];
// The artwork's own slogans, in red bars of white type, on billboards and across the buildings.
const ART = ['YOUR HOME IS OUR PORTFOLIO', 'LOCATION LOCATION EVICTION', 'HOME IS WHERE THE YIELD IS', 'BUY LOW. EVICT HIGH.', 'OWN NOTHING. RENT EVERYTHING.', 'NOBODY LIVES HERE. EVERYBODY PROFITS.', 'THIS COULD HAVE BEEN YOURS', 'WE SOLD YOUR STREET', 'YOU ARE NOT THE CUSTOMER. YOUR RENT IS.', 'THE MARKET LOVES YOU (NOT)', 'PASS GO. COLLECT EVERYTHING.', 'ROLL THE DICE. LOSE THE HOUSE.'];
const VOID_NAMES = ['NOBODY HOME', 'LUXURY VOIDS', 'THE EMPTY', 'INVESTMENT · NOT FOR LIVING', 'SOLD OUT · LIGHTS OFF'];
function fillSign(text, tier, n = 0) {
  const L = { tier, priceK: 1 };
  return text.replace('{rent}', money(rentWeek * (1 + tier * 0.6))).replace('{people}', 25 + tier * 12 + (n % 15))
    .replace('{price}', moneyK(priceOf(L))).replace('{deposit}', moneyK(priceOf(L) * DEPOSIT))
    .replace('{growth}', GROWTH[0]).replace(/{commute}/g, commuteText());
}
// Which voice the city speaks in right now: it changes as you change the street.
function signPool(tier) {
  if (rules === 2) { return zone >= 4 ? SIGNS.out : SIGNS.renting; }
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
      if (rules === 1) { for (let k = 0; k < 2; k++) { ch.props.push({ kind: 'person', x: side * (EDGE_X - 0.7 - k * 0.4), z: mid + (k ? 1.4 : -0.6), tone: r(), h: mixN(1.5, 1.85, r()), ph: r() * 6, residentRank: 0, lotRef: L }); } }
    }
  }
  if (rules === 2) {
    // Everyone else looking too: a queue at every home for rent. Out in The Fringe there is always one you can pay.
    if (zone === ZONE_NAMES.length - 1 && !ch.lots.some(L => L.forSale)) { const L = ch.lots.find(l => !l.special && l.z0 > ch.z0 + CROSS_W + 4); if (L) { Object.assign(L, { forSale: true, priceK: 0.9, investorAt: -1 }); } }
    for (const L of ch.lots) {
      if (!L.forSale) { continue; }
      if (zone === ZONE_NAMES.length - 1) { L.priceK = Math.min(L.priceK, RENT_BUDGET * 0.95 / Math.max(1, rentAsk(L) / L.priceK)); }
      const n = zone === ZONE_NAMES.length - 1 ? 2 + Math.floor(r() * 3) : 10 + Math.floor(r() * 12), zz = L.z0 + 1;
      L.applicants = zone === ZONE_NAMES.length - 1 ? 0 : 20 + Math.floor(r() * 40);
      for (let k = 0; k < n; k++) { ch.props.push({ kind: 'person', x: L.side * (EDGE_X - 1.2 - (k % 2) * 0.5), z: zz - 1.2 - k * 0.75, tone: r(), h: mixN(1.55, 1.85, r()), ph: r() * 6, residentRank: 0 }); }
    }
  }
  // The very first block: one home for sale, close ahead and safe from investors, so the story starts at once.
  if (rules === 1 && ch.c === 0 && !owned.length) {
    const L = ch.lots.filter(l => !l.special && l.z0 > ch.z0 + CROSS_W + 4).sort((a, b) => a.z0 - b.z0)[0];
    if (L) {
      for (const M of ch.lots) { if (M !== L) { M.forSale = false; } }   // nothing dearer beside it to confuse you
      if (!L.forSale) { Object.assign(L, { forSale: true, priceK: 1 }); const mid = (L.z0 + L.z1) / 2; for (let k = 0; k < 2; k++) { ch.props.push({ kind: 'person', x: L.side * (EDGE_X - 0.7 - k * 0.4), z: mid + (k ? 1.4 : -0.6), tone: r(), h: mixN(1.5, 1.85, r()), ph: r() * 6, residentRank: 0, lotRef: L }); } }
      L.investorAt = -1;
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
  // Satire: a sandwich board or two on the pavement, banners on some lamp posts, a slogan painted on the road.
  for (let i = 0; i < 1; i++) { if (r() < 0.4) { continue; } const side = r() < 0.5 ? -1 : 1; ch.props.push({ kind: 'aframe', x: side * (EDGE_X - 0.5), z: ch.z0 + CROSS_W + 4 + r() * (CHUNK_LEN - CROSS_W - 8), side, text: pickN(r, AFRAME) }); }
  for (const p of ch.props) { if (p.kind === 'lamp' && r() < 0.25) { p.slogan = pickN(r, POLE); p.scol = pickN(r, ['#c8322a', '#3f6fa8', '#d4a017', '#2e9e47']); } }
  ch.road = ch.slot === 0 || r() < 0.4 ? null : pickN(r, ROAD);
  for (const L of ch.lots) { if (L.forSale) { L.rider = Math.floor(r() * 6); } }
  for (const side of [-1, 1]) { const tall = ch.lots.filter(L => L.side === side && !L.forSale && L.H > 6.5); if (tall.length && r() < 0.7) { pickN(r, tall).art = pickN(r, ART); } }
  // A signpost at the crossing: which way is cheaper, which way is richer.
  ch.props.push({ kind: 'turnsign', x: ROAD_W + 0.9, z: ch.z0 - 0.8, side: 1 });
  // Billboards on the pavement, written from the prices on this block.
  for (let i = 0; i < 2; i++) {
    if (r() < 0.45) { continue; }
    const side = i === 0 ? -1 : 1, z = ch.z0 + CROSS_W + 6 + r() * (CHUNK_LEN - CROSS_W - 12);
    const idx = Math.floor(r() * 1000);
    ch.props.push({ kind: 'billboard', x: side * (ROAD_W + 1.4), z, side, tier: ch.tier, idx, col: DISTRICTS[ch.tier].stripe[0], art: r() < 0.45 ? ART[idx % ART.length] : null });
    // Someone sleeping rough under the luxury ad.
    if (r() < (ch.tier >= 2 ? 0.6 : 0.3)) { ch.props.push({ kind: 'tent', x: side * (ROAD_W + 2.1), z: z + 1.2, side, tone: r(), cardboard: pickN(r, ['I USED TO LIVE ON THIS STREET', 'WAS A RENTER', 'ON THE LIST 6 YRS', 'RENT WENT UP. I WENT OUT.']) }); }
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
      // Round 2: your old home. For a moment you hear it as it was.
      if (rules === 2 && L.home && L.owned && !L.memDone && Math.abs(mid - distanceWalked) < 10) { L.memDone = true; const q = P(L.side * (EDGE_X + L.setback + 2), 1.5, mid); sound.life(lifeKind(L), 1.2, q.rx / (Math.abs(q.rz) + 4), true); }
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
function boardUpdate(z) {
  updateTurn(); houseLife();
  const dt = Math.min(deltaTime / 1000, 0.05);
  // Prices rise with time, and time is the walk: standing still, nothing changes.
  const walked = distanceWalked - lastWalkZ; lastWalkZ = distanceWalked;
  if (!paused && !intro && !ending && walked > 0 && walked < 5) { walkedTotal += walked; lifeAge = START_AGE + Math.floor(walkedTotal / 120); market *= 1 + GROWTH[rules - 1] / 100 * walked / YEAR_M; }
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
        Object.assign(L, { style: null, forSale: false, investorAt: -1, sold: true, vacant: true, changedYear: lifeAge, born: clockT + 0.2, H: tower.H, depth: tower.depth, color: tower.color, tier: tower.tier, crown: tower.crown, spire: tower.spire, glass: tower.glass, name: VOID_NAMES[Math.abs(L.seed) % VOID_NAMES.length], sign: true });
        preserveLot(L); ch.props = ch.props.filter(p => p.lotRef !== L);
        ch.props.push({ kind: 'billboard', x: L.side * (ROAD_W + 1.4), z: (L.z0 + L.z1) / 2, side: L.side, text: 'SOLD to an investor! Will sit empty. Congratulations, everyone.', fixed: true, col: '#c8322a', born: clockT });
        sound.jail(); if (!toasts.some(t => t.text.startsWith('An investor') && clockT - t.t < 3)) { sayToast('An investor got there first. Congratulations to them.'); }
      }
    }
  }
  if (!ending && rules === 1 && owned.length >= OWN_GOAL && clockT - owned[owned.length - 1].t > 4) { endWalk('rule1'); }
  if (!ending && rules === 2 && rentedAt && clockT - rentedAt > 2.6) { endWalk('rule2'); }
  // Round 2: nothing here is affordable, so at the next corner you are turned further out.
  // On the old street that happens only after you have walked past every home you bought.
  if (rules === 2 && !ending && !intro && !turnAnim && !sideSt && !rentedAt && zone < ZONE_NAMES.length - 1) {
    const c = Math.floor(distanceWalked / CHUNK_LEN) + 1, zc = c * CHUNK_LEN + CROSS_W / 2, passZ = firstRun && zone === firstRun.zone ? firstRun.passZ : -Infinity;
    if (zc - distanceWalked < 26 && zc > passZ) { queuedTurn = -1; makeSide(-1, c); sayToast(`Nothing you can pay for here. Further out: ${ZONE_NAMES[zone + 1]}.`); }
  }
}
// Pay day: twice a lap, a year each time.
function onPassGo() { }   // no pay days: the walk is about who lives where, not about money
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
  if (rules === 1) { return { label: 'E  ·  Buy it', ok: true }; }
  if (rules === 2) { const a = rentAsk(L); return { label: `${money(a)} a week`, ok: a <= RENT_BUDGET }; }
  return null;
}
function useHere() {
  if (intro) { if (boardIntroOn()) { boardT0 = -99; return; } intro = false; return; }
  if (ending) { if (ending.kind === 'rule1' && clockT - ending.t > 6) { startRule2(); } return; }
  const L = plotHere(distanceWalked), act = actionFor(L);
  if (!act) { sayToast('Find a FOR SALE sign first.'); return; }
  if (rules === 2) {
    if (rentedAt) { return; }
    if (!act.ok) { soldBeat = { t: clockT, stamp: 'TOO DEAR', col: [110, 100, 96], l1: `${money(rentAsk(L))} a week. You can pay ${money(RENT_BUDGET)}.`, l2: `${L.applicants} others applied. One offered more.`, dur: 2.6 }; if (sound.ding) { sound.ding(); } return; }
    L.forSale = false; rentedAt = clockT;
    soldBeat = { t: clockT, stamp: 'HOME', col: [63, 111, 168], l1: `Congratulations! ${deedName(L)}, ${commuteShort(zone)}.`, l2: 'Far from everything you had.', dur: 2.8 }; if (sound.welcome) { sound.welcome(); }
    return;
  }
  buyLot(L);
}
function buyLot(L) {
  const price = priceOf(L);
  const first = !home, ch = chunks.get(Math.floor(L.z0 / CHUNK_LEN)), mid = (L.z0 + L.z1) / 2, n = movedFrom(L);
  const o = { key: L.memoryKey, price, mBuy: market, lift: 1, tier: L.tier, zone, home: first, t: clockT };
  owned.push(o);
  if (first) { home = { price, t: clockT, commute: commuteText(), zone, lifeAge }; }
  Object.assign(L, { forSale: false, owned: true, home: first, investorAt: -1, thud: false });
  // Your own home stays a real house and rises again as yours. Under Rule 1 every other home you buy
  // stops being a home: it sinks, and a plastic board-game piece drops onto the lot.
  if (rules === 1 && !first) { L.piece = { t0: clockT + 0.5, t: clockT + 1.25, kind: owned.length >= OWN_GOAL ? 'hotel' : 'house', loud: true }; }
  else { L.born = clockT + 0.3; }
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
    evicted.push(familyOf(L)); lastBuyZ = Math.max(lastBuyZ, L.z1);
    const cheers = ['Congratulations! You’re a landlord!', 'Another one! The city thanks you.', 'Winner! The street is yours.'];
    soldBeat = { t: clockT, stamp: 'SOLD', col: [200, 50, 40], l1: cheers[Math.min(owned.length - 1, 2)], l2: 'Their memories are included in the price.' };
    if (sound.evict) { setTimeout(() => sound.evict(), 350); }
  }
  preserveLot(L);
}
function endWalk(kind) {
  if (ending) { return; }
  if (kind === 'rule1') {
    // The whole street turns into the board: every house ahead sinks and a grey plastic piece drops in its place.
    const ahead = [...chunks.values()].flatMap(ch => ch.lots).filter(L => !L.piece && !L.home && L.z1 > distanceWalked && L.z0 < distanceWalked + 140).sort((a, b) => a.z0 - b.z0);
    ahead.forEach((L, i) => { const t0 = clockT + 0.2 + i * 0.09; L.piece = { t0, t: t0 + 0.7, kind: 'grey', loud: i % 4 === 0 && i < 16 }; });
  }
  endWalkNow(kind);
}
function endWalkNow(kind) { ending = { kind, t: clockT }; sound.go(); baseNight = kind === 'rule1' ? 0.6 : 0.15; nightTarget = baseNight; }
function resetLife() {
  streetMemory.clear(); nameBox = null; sideSt = null; queuedTurn = 0; turnAnim = null; turnYaw = 0;
  lifeAge = START_AGE; zone = START_ZONE; market = 1; rentPaid = 0; rentBase = RENT_WEEK; rentWeek = rentFor(START_ZONE); home = null; ending = null; landlordMode = false;
  owned = []; rentIn = 0; movedOut = 0; walkedTotal = 0; emptyK = 1; evicted = []; lastBuyZ = 0; rentedAt = 0; boardT0 = clockT;
  baseNight = 0; nightTarget = 0; ownedFromC = Infinity; intro = true; toasts.length = 0; soldBeat = null;
  chunks.clear(); firedCasinos.clear(); visitedJails.clear(); distanceWalked = 0; streetT = clockT; lastTier = -1; lastChunk = -1; buildSkyline();
}
function restartWalk() { rules = 1; firstRun = null; seed += 97; startSeed = seed; resetLife(); }
// Her other rules, on the very same street.
function startRule2() {
  // The homes you bought, and the investors' towers, are still there in Round 2.
  const keep = [...streetMemory.entries()].filter(([, v]) => v.owned || v.sold);
  // Round 2 starts in the town of the first home you bought, and walks you past every home you bought there.
  const z0 = owned.length && owned[0].zone < ZONE_NAMES.length - 2 ? owned[0].zone : START_ZONE, slots = owned.filter(o => o.zone === z0 && o.key).map(o => Number(o.key.split(':')[1]));
  firstRun = { owned: owned.length, moved: movedOut, evicted: evicted.slice(), me: evicted[0] || 'The Nguyens', zone: z0, passZ: slots.length ? (Math.max(...slots) + 1) * CHUNK_LEN - 20 : -Infinity };
  rules = 2; if (startSeed !== null) { seed = startSeed; } resetLife(); night = 0; nightTarget = 0;
  zone = z0; rentWeek = rentFor(zone); buildSkyline();
  for (const [k, v] of keep) { streetMemory.set(k, v); }
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
  ctx.fillStyle = rules === 2 && rentAsk(L) <= RENT_BUDGET ? '#3f6fa8' : '#c8322a'; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h * 0.34);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const r2 = rules === 2;
    ctx.font = `bold ${h * 0.2}px Georgia, serif`; ctx.fillStyle = '#fff'; ctx.fillText(r2 ? 'FOR RENT' : 'FOR SALE', base.x, top - h * 0.2 + h * 0.17);
    ctx.font = `bold ${h * 0.27}px Georgia, serif`; ctx.fillStyle = '#2a1e18'; ctx.fillText(r2 ? `${money(rentAsk(L))}/wk` : moneyK(priceOf(L)), base.x, top - h * 0.2 + h * 0.52);
    ctx.font = `${h * 0.15}px Georgia, serif`; ctx.fillStyle = '#7a5a4a'; ctx.fillText(r2 ? (L.applicants ? `${L.applicants} applied` : 'apply now') : 'a lovely family home', base.x, top - h * 0.2 + h * 0.8);
    // A rider stuck across the corner, the way agents do.
    const rid = (r2 ? RIDER_RENT : RIDER_SALE)[(L.rider || 0) % 6];
    const rh = h * 0.3, ry = top - h * 0.2 - rh - h * 0.04;
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(base.x - w * 0.46, ry, w * 0.92, rh); ctx.strokeStyle = '#2a1e18'; ctx.lineWidth = Math.max(1, 0.04 * k); ctx.strokeRect(base.x - w * 0.46, ry, w * 0.92, rh);
    ctx.fillStyle = '#c8322a'; ctx.font = `bold ${rh * 0.55}px Georgia, serif`; ctx.fillText(rid, base.x, ry + rh / 2 + 1, w * 0.86);
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
  drawArtPoster(x, top - h, w, h, (p.art || signText(p)).toUpperCase(), k); ctx.restore(); return;
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
// A poster in the artwork's own voice: a grey, grainy picture of a house, and white words on red bars.
function drawArtPoster(cx, y, w, h, slogan, k) {
  const x = cx - w / 2, g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#9a9792'); g.addColorStop(1, '#4a4846');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // A house, in silhouette, like a cut-out photograph.
  ctx.fillStyle = 'rgba(20,20,20,0.55)'; ctx.beginPath(); ctx.moveTo(x + w * 0.58, y + h); ctx.lineTo(x + w * 0.58, y + h * 0.5); ctx.lineTo(x + w * 0.76, y + h * 0.26); ctx.lineTo(x + w * 0.94, y + h * 0.5); ctx.lineTo(x + w * 0.94, y + h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(235,230,220,0.5)'; ctx.fillRect(x + w * 0.66, y + h * 0.62, w * 0.08, h * 0.14); ctx.fillRect(x + w * 0.79, y + h * 0.62, w * 0.08, h * 0.14);
  ctx.strokeStyle = '#111'; ctx.lineWidth = Math.max(1, 0.05 * k); ctx.strokeRect(x, y, w, h);
  if (w < 50) { ctx.fillStyle = '#e02020'; ctx.fillRect(x + w * 0.06, y + h * 0.3, w * 0.6, h * 0.14); return; }
  // Fit the words: shrink the type until the slogan takes at most four bars.
  let size = h * 0.15, lines = [];
  for (let tries = 0; tries < 6; tries++) {
    ctx.font = `italic 900 ${size}px "Helvetica Neue", Futura, Arial, sans-serif`; lines = []; let line = '';
    for (const wd of slogan.split(' ')) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w * 0.62 && line) { lines.push(line); line = wd; } else { line = t; } }
    lines.push(line); if (lines.length <= 4) { break; } size *= 0.86;
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const n = Math.min(4, lines.length), lh = size * 1.32, y0 = y + h * 0.5 - (n - 1) * lh / 2;
  lines.slice(0, n).forEach((ln, i) => { const tw = ctx.measureText(ln).width, bx = x + w * 0.05; ctx.fillStyle = '#e02020'; ctx.fillRect(bx, y0 + i * lh - size * 0.62, tw + size * 0.5, size * 1.24); ctx.fillStyle = '#fff'; ctx.fillText(ln, bx + size * 0.25, y0 + i * lh + 1); });
}
// The satire drawn onto the buildings themselves (called from drawLot, inside the rise scope).
// Every lived-in home wears a price tag on a string, like goods in a shop; empty investor towers
// get a tycoon's top hat and a VACANT sign in red neon.
function satireOnLot(L, x, z0, z1, H) {
  if (L.special || L.piece || intro) { return; }
  if (L.vacant) {
    const on = Math.sin(clockT * 3 + L.seed) > -0.6;
    facadeSign(L, x, z0, L.z0 + (L.z1 - L.z0) * 0.25, L.z1 - (L.z1 - L.z0) * 0.25, H * 0.3, H * 0.3 + 1.6, on ? '#2a0a0a' : '#1a1414', on ? '#ff4a3a' : '#5a2a2a', 'VACANT', on ? '#ff3020' : null);
    const xm = x + L.side * L.depth / 2, top = P(xm, H, (L.z0 + L.z1) / 2); if (top.rz < 3) { return; }
    const k = top.k, bw = L.depth * 1.1 * k, cw = L.depth * 0.62 * k, ch = L.depth * 0.75 * k;
    ctx.save(); ctx.globalAlpha = 1 - fogFor((L.z0 + L.z1) / 2) * 0.7;
    ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.ellipse(top.x, top.y, bw / 2, bw * 0.12, 0, 0, TWO_PI); ctx.fill();
    ctx.fillRect(top.x - cw / 2, top.y - ch, cw, ch); ctx.beginPath(); ctx.ellipse(top.x, top.y - ch, cw / 2, cw * 0.12, 0, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = '#d4a017'; ctx.fillRect(top.x - cw / 2, top.y - ch * 0.32, cw, ch * 0.14);
    ctx.restore();
    return;
  }
  if (L.owned || L.H > 16) { return; }
  const len = L.z1 - L.z0, az = L.z0 + len * 0.78; if (az < z0 + 0.3) { return; }
  const a = P(x - L.side * 0.05, H * 0.95, az); if (a.rz < 2.5 || a.rz > 70) { return; }
  const k = a.k, sw = Math.sin(clockT * 1.4 + L.seed % 7) * 0.12, tw = 1.9 * k, th = 1.05 * k, drop = 0.9 * k;
  const pk = L.priceK || (0.8 + (Math.abs(L.seed) % 47) / 100), label = rules === 2 ? `${money(Math.round(TOWNS[zone].rent * (L.style ? STYLES_LOT[L.style].priceK : 0.85 + L.tier * 0.1) * pk / 5) * 5)}/wk` : moneyK(TOWNS[zone].price * (L.style ? STYLES_LOT[L.style].priceK : 0.85 + L.tier * 0.1) * market * pk);
  ctx.save(); ctx.globalAlpha = 1 - fogFor(az) * 0.8; ctx.translate(a.x, a.y); ctx.rotate(sw);
  ctx.strokeStyle = '#f4f0e6'; ctx.lineWidth = Math.max(1, 0.03 * k); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, drop); ctx.stroke();
  ctx.translate(0, drop); ctx.rotate(0.18);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-tw / 2 + 0.06 * k, 0.08 * k, tw, th);
  ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.moveTo(-tw / 2 + th * 0.3, 0); ctx.lineTo(tw / 2, 0); ctx.lineTo(tw / 2, th); ctx.lineTo(-tw / 2 + th * 0.3, th); ctx.lineTo(-tw / 2, th / 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a1e18'; ctx.stroke();
  ctx.fillStyle = '#2a1e18'; ctx.beginPath(); ctx.arc(-tw / 2 + th * 0.32, th / 2, th * 0.08, 0, TWO_PI); ctx.fill();
  if (k > 9) { ctx.fillStyle = '#e02020'; ctx.font = `900 ${th * 0.42}px "Helvetica Neue", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, th * 0.25, th * 0.42, tw * 0.72); ctx.fillStyle = '#2a1e18'; ctx.font = `italic ${th * 0.2}px Georgia, serif`; ctx.fillText(rules === 2 ? 'per week, for now' : 'and rising', th * 0.25, th * 0.78, tw * 0.72); }
  ctx.restore();
}
// Sleeping rough under a billboard: a small tent, a sleeping bag, a cardboard sign.
function drawTent(q, p) {
  const k = q.k; if (k < 3) { return; }
  const w = 1.9 * k, h = 1.05 * k, col = ['#4a6a8a', '#6a7a5a', '#8a5a4a'][Math.floor(p.tone * 3)];
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.85;
  ctx.fillStyle = 'rgba(20,14,10,0.25)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, w * 0.6, 0.12 * k, 0, 0, TWO_PI); ctx.fill();
  ctx.fillStyle = toneN(col, p.z); ctx.beginPath(); ctx.moveTo(q.x - w / 2, q.y); ctx.quadraticCurveTo(q.x - w * 0.4, q.y - h * 1.2, q.x, q.y - h); ctx.quadraticCurveTo(q.x + w * 0.4, q.y - h * 1.2, q.x + w / 2, q.y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(q.x - w * 0.12, q.y); ctx.lineTo(q.x, q.y - h * 0.75); ctx.lineTo(q.x + w * 0.12, q.y); ctx.closePath(); ctx.fill();
  // The cardboard sign leaning on it.
  const cx = q.x + w * 0.5 * (p.side < 0 ? 1 : -1), cw = 1.15 * k, chh = 0.72 * k;
  ctx.fillStyle = toneN('#b8915a', p.z); ctx.fillRect(cx - cw / 2, q.y - chh, cw, chh);
  if (k > 9) { ctx.fillStyle = '#2a1e18'; ctx.font = `bold ${chh * 0.24}px "Marker Felt", "Comic Sans MS", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.cardboard, cx, q.y - chh / 2, cw * 0.9); }
  ctx.restore();
}
// An agent's sandwich board on the pavement.
function drawAFrame(q, p) {
  const k = q.k; if (k < 3) { return; }
  const w = 1.4 * k, h = 1.6 * k, top = q.y - h;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.85;
  ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.moveTo(q.x - w * 0.5, q.y); ctx.lineTo(q.x - w * 0.42, top); ctx.lineTo(q.x + w * 0.42, top); ctx.lineTo(q.x + w * 0.5, q.y); ctx.lineTo(q.x + w * 0.4, q.y); ctx.lineTo(q.x, top + h * 0.2); ctx.lineTo(q.x - w * 0.4, q.y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fffaee'; ctx.fillRect(q.x - w * 0.42, top, w * 0.84, h * 0.8); ctx.fillStyle = '#c8322a'; ctx.fillRect(q.x - w * 0.42, top, w * 0.84, h * 0.16);
  if (k > 16) {
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `bold ${h * 0.09}px Georgia, serif`; ctx.fillText('★ AGENT ★', q.x, top + h * 0.08);
    ctx.fillStyle = '#2a1e18'; const size = h * 0.1; ctx.font = `bold ${size}px Georgia, serif`;
    const words = p.text.split(' '), lines = []; let line = '';
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > w * 0.74 && line) { lines.push(line); line = wd; } else { line = t; } }
    lines.push(line); lines.slice(0, 5).forEach((ln, i) => ctx.fillText(ln, q.x, top + h * 0.48 - (Math.min(5, lines.length) - 1) * size * 0.6 + i * size * 1.2));
  }
  ctx.restore();
}
// A council banner hanging from a lamp post, cheerful and empty.
function drawPoleBanner(q, p) {
  const k = q.k; if (k < 3) { return; }
  const dir = p.x < 0 ? 1 : -1, bw = 0.55 * k, bh = 1.9 * k, bx = q.x + dir * 0.06 * k + (dir < 0 ? -bw : 0), by = q.y - 3.9 * k;
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.85;
  ctx.fillStyle = toneN(p.scol, p.z); ctx.fillRect(bx, by, bw, bh); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(bx, by + bh * 0.04, bw, bh * 0.02); ctx.fillRect(bx, by + bh * 0.94, bw, bh * 0.02);
  if (k > 14) { ctx.translate(bx + bw / 2, by + bh / 2); ctx.rotate(-HALF_PI); ctx.fillStyle = '#fff'; ctx.font = `bold ${bw * 0.34}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.slogan, 0, 1, bh * 0.86); }
  ctx.restore();
}
// A slogan painted on the road, read as you walk over it.
function roadSlogan(ch) { return ch.road || null; }
// People queueing for an open home.
function drawOpenHome(q, p) {
  const k = q.k; if (k < 2 || emptyK < 0.7 || (rules === 1 && movedOut >= 6)) { return; }
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.8;
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(q.x - 0.05 * k, q.y - 2.6 * k, 0.1 * k, 2.6 * k);
  ctx.fillStyle = '#c8322a'; ctx.fillRect(q.x - 1 * k, q.y - 2.6 * k, 2 * k, 0.8 * k);
  if (k > 14) { ctx.fillStyle = '#fff'; ctx.font = `bold ${0.32 * k}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('OPEN HOME', q.x, q.y - 2.32 * k); ctx.font = `${0.2 * k}px Georgia, serif`; ctx.fillText(`${p.n * 4} registered`, q.x, q.y - 2.02 * k); }
  ctx.restore();
}
// Monopoly's view of a home: a plastic piece on a coloured square. The real house sinks first.
const PIECE_COL = { house: '#1fb04a', hotel: '#e0302a', grey: '#a29d94' };
function toyTone(col, z, k) { return mixHex(toneN(col, z, k), shadeN(col, k), 0.6); }   // plastic keeps its colour through the haze
function pieceSink(L) { const pc = L.piece; return pc ? 1 - easeN((clockT - pc.t0) / 0.7) : 1; }
function drawBoardSquare(L) {
  const pc = L.piece, a = easeN((clockT - pc.t0) / 0.5); if (a <= 0) { return; }
  const z0 = clipZ(L.z0 + 0.3), z1 = L.z1 - 0.3; if (z1 <= z0) { return; }
  const xa = L.side * (EDGE_X + 0.2), xb = L.side * (EDGE_X + Math.max(6, L.setback + L.depth * 0.95)), xs = L.side * (EDGE_X + 1.6), mz = midN(z0, z1);
  polyN([P(xa, 0.06, z0), P(xb, 0.06, z0), P(xb, 0.06, z1), P(xa, 0.06, z1)], rgbaN(mixHex('#e9efe0', '#3a3448', night * 0.5), a * (1 - fogFor(mz) * 0.7)), rgbaN('#2a2420', 0.6 * a), 1.5);
  polyN([P(xa, 0.07, z0), P(xs, 0.07, z0), P(xs, 0.07, z1), P(xa, 0.07, z1)], rgbaN(pc.kind === 'grey' ? '#8a857e' : deedCol(L), a * (1 - fogFor(mz) * 0.7)), rgbaN('#2a2420', 0.6 * a), 1.5);
}
function drawToyPiece(L) {
  const pc = L.piece; if (clockT < pc.t - 0.55 || (L.sinkK !== undefined && L.sinkK < 0.5)) { return; }
  const u = constrain((clockT - pc.t + 0.55) / 0.55, 0, 1), land = clockT - pc.t;
  if (land >= 0 && !pc.hit) { pc.hit = true; if (pc.loud && sound.clack) { sound.clack(pc.kind); } }
  const squash = land > 0 && land < 0.3 ? 1 - Math.sin(land / 0.3 * PI) * 0.16 : 1, y0 = (1 - u * u) * 24;
  const hotel = pc.kind === 'hotel', len = L.z1 - L.z0;
  const pl = Math.min(len * 0.85, hotel ? 18 : 10), d = hotel ? 9 : 8.5, mid = (L.z0 + L.z1) / 2, za = mid - pl / 2, zb = mid + pl / 2;
  const x = L.side * (EDGE_X + 2.4), xo = x + L.side * d, xm = (x + xo) / 2;
  const hb = (hotel ? 9 : 7) * squash, apex = hb + (hotel ? 3 : 5) * squash, z0 = clipZ(za); if (zb <= z0) { return; }
  const col = PIECE_COL[pc.kind], edge = 'rgba(20,14,10,0.45)', mz = midN(z0, zb);
  if (u > 0.2) { const sh = 0.4 * u; polyN([P(x, 0.08, z0), P(xo + L.side * 1.2, 0.08, z0), P(xo + L.side * 1.2, 0.08, zb + 1), P(x, 0.08, zb + 1)], `rgba(20,14,10,${sh * (1 - fogFor(mz))})`); }
  polyN(wallQuad(x, z0, x, zb, y0, y0 + hb), toyTone(col, mz, 0.95), edge, 1.2);
  polyN(wallQuad(x - L.side * 0.03, z0, x - L.side * 0.03, zb, y0, y0 + hb * 0.12), 'rgba(0,0,0,0.18)');
  polyN(wallQuad(x - L.side * 0.03, z0, x - L.side * 0.03, zb, y0 + hb * 0.74, y0 + hb * 0.84), 'rgba(255,255,255,0.3)');
  if (za > cam.z + NEAR_Z) { polyN([P(x, y0, za), P(xo, y0, za), P(xo, y0 + hb, za), P(xm, y0 + apex, za), P(x, y0 + hb, za)], toyTone(col, za, 0.62), edge, 1.2); }
  polyN([P(x, y0 + hb, z0), P(x, y0 + hb, zb), P(xm, y0 + apex, zb), P(xm, y0 + apex, z0)], toyTone(col, mz, 1.2), edge, 1.2);
  const ra = 0.5, rb = 0.68, hx = (t) => mixN(x, xm, t), hy = (t) => y0 + mixN(hb, apex, t);
  polyN([P(hx(ra), hy(ra), z0), P(hx(ra), hy(ra), zb), P(hx(rb), hy(rb), zb), P(hx(rb), hy(rb), z0)], 'rgba(255,255,255,0.32)');
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
  moving: ['Priced out too?', 'Forty people at the last inspection.', 'Our landlord sold up as well.', 'Try further out. That’s what we did.', 'Need a hand with that box?'],
  shared: ['Morning, neighbour!', 'The kids play outside again.', 'Nice to have you here.', 'The land tax fixed the park.']
};
function moodN() { return rules === 2 ? 'moving' : owned.length === 0 ? 'renter' : owned.length < 3 ? 'wary' : 'cold'; }
function noticeYou(q, p) {
  if (p.mover || p.arrive || p.talked || intro || ending || turnAnim) { return; }
  const dz = p.z - distanceWalked; if (dz < 1.5 || dz > 8 || q.k < 3 || q.x < 40 || q.x > width - 40) { return; }
  if (clockT - talkT < 3.2) { return; }
  p.talked = true; if (!p.lotRef && Math.random() < 0.35) { return; }
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
// Rule 1: the street loses its colour as its families are moved out.
function drawStreetLife() {
  const a = 0.3 + (1 - streetLife()) * 0.8;
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
  ctx.strokeStyle = rules === 1 ? OWNER_COL : '#c8322a'; ctx.lineWidth = Math.max(1, 0.08 * k); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${h * 0.26}px Georgia, serif`; ctx.fillStyle = rules === 1 ? '#ffe9a8' : '#ffc8c0'; ctx.fillText(rules === 2 ? 'OWNED BY YOU' : L.home ? 'YOUR HOME' : 'YOURS · LET', base.x, top - h * 0.2 + h * 0.3);
    if (o && !L.home && rules === 1) { ctx.font = `${h * 0.2}px Georgia, serif`; ctx.fillStyle = '#e8dcc8'; ctx.fillText(`tenant pays ${money(rentOf(o) / 52)}/wk`, base.x, top - h * 0.2 + h * 0.66, w * 0.9); }
  }
  ctx.restore();
}

/* ---------- HUD ---------- */
function drawBoardHud() {
  const z = distanceWalked;
  push(); textFont('Georgia');
  if (!intro && !ending) {
    if (rules === 2) { drawCarryBox(); }
    // Who you are and what you have done, top left.
    const x = 16, y = 16, w = Math.min(270, width * 0.42), h = rules === 1 ? 96 : 74;
    noStroke(); fill(0, 50); rect(x + 3, y + 4, w, h, 8); fill(255, 250, 238); rect(x, y, w, h, 8);
    fill(rules === 1 ? '#c8322a' : '#3f6fa8'); rect(x, y, 6, h, 8, 0, 0, 8);
    fill(40, 30, 24); textStyle(BOLD); textSize(16); textAlign(LEFT, TOP);
    if (rules === 1) {
      text('YOU · THE LANDLORD', x + 16, y + 10); textStyle(NORMAL);
      for (let i = 0; i < Math.max(OWN_GOAL, owned.length); i++) { houseIcon(x + 16 + i * 22, y + 38, 17, i < owned.length ? color(OWNER_COL) : color(190, 175, 160), i < owned.length); }
      fill(150, 130, 120); textSize(11); textStyle(ITALIC); text(['The city believes in your money.', 'The city is proud of your money.', 'The city loves your money.', 'The city is your money.'][Math.min(owned.length, 3)], x + 16, y + 68); textStyle(NORMAL);
    } else {
      text('YOU · THE TENANT', x + 16, y + 10, w - 24);
      textStyle(NORMAL); textSize(12); fill(150, 120, 100); text('Looking for a home. Any home.', x + 16, y + 32);
      textStyle(BOLD); fill(40, 30, 24); textSize(13); text(ZONE_NAMES[zone], x + 16, y + 52); textStyle(NORMAL); fill(150, 120, 100); textAlign(RIGHT, TOP); textSize(11); text(commuteShort(zone), x + w - 12, y + 54);
      const ww = 170, wx = width - ww - 16;
      fill(0, 50); rect(wx + 3, y + 4, ww, 62, 8); fill(255, 250, 238); rect(wx, y, ww, 62, 8);
      fill(120, 100, 90); textSize(10); textAlign(RIGHT, TOP); text('YOU CAN PAY', wx + ww - 14, y + 10);
      fill(40, 30, 24); textStyle(BOLD); textSize(22); text(`${money(RENT_BUDGET)} a week`, wx + ww - 14, y + 27); textStyle(NORMAL);
    }
    const beat = soldBeat && clockT - soldBeat.t < 2.4;
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i], a2 = clockT - t.t; if (a2 > 4.2) { toasts.splice(i, 1); continue; }
      drawingContext.globalAlpha = easeN(a2 / 0.3) * (1 - easeN((a2 - 3.6) / 0.6));
      textStyle(ITALIC); textSize(16); fill(255); stroke(0, 140); strokeWeight(3); textAlign(CENTER, CENTER); text(t.text, width / 2, height - (rules === 2 ? 210 : 146) - (toasts.length - 1 - i) * 26);
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
  if (intro) {
    const bt = clockT - boardT0;
    if (rules === 1 && bt < 3.6) { drawBoardScene('intro', easeN((bt - 0.9) / 2.3), 1 - easeN((bt - 3.0) / 0.6)); }
    if (rules !== 1 || bt > 3.0) { drawOpening(); }
  }
  // The end: the camera rises out of the street and the city is a board again.
  if (ending) {
    const b0 = ending.kind === 'rule1' ? 2.6 : 0.3, et = clockT - ending.t;
    if (et > b0) { drawBoardScene(ending.kind === 'rule1' ? 'won' : 'out', 1 - easeN((et - b0 - 0.3) / 2.2), easeN((et - b0) / 0.4)); }
  }
  if (ending && ending.kind === 'rule1') {
    const names = evicted.slice(0, 3), who = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || 'Three families';
    const lines = [`You own ${owned.length} homes. Population: you.`, 'Their memories were included in the price.', '', 'Now walk the same street', 'as the people who lived in the first one.'];
    storyCard('CONGRATULATIONS. YOU WON THE STREET.', lines, clockT - ending.t > 6 ? 'Press E or click' : '', easeN((clockT - ending.t - 5.2) / 1.0));
  }
  if (ending && ending.kind === 'rule2') {
    const a = firstRun || { owned: 3, moved: 3 };
    const lines = [`You found a home in ${ZONE_NAMES[zone]}, ${commuteShort(zone)}.`, `In Round 1 you won ${a.owned} homes. One of them was yours.`, '', 'Monopoly began in 1904 as Lizzie Magie’s The Landlord’s Game.', 'It was a warning: under these rules one player wins,', 'and everyone else is pushed further out.', 'In 1935 it was sold as Monopoly. She was paid $500.'];
    storyCard('YOUR WIN WAS THEIR LOSS', lines, 'Press R to walk again', easeN((clockT - ending.t - 2.9) / 1.0), '#3f6fa8');
  }
  pop();
  if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,236,200,${fadeA * 0.85})`; ctx.fillRect(0, 0, width, height); }
}
// The first thing anyone sees: what this is, what to do, and what it costs, in three lines.
function drawOpening() {
  const r1 = rules === 1, col = r1 ? '#c8322a' : '#3f6fa8', pulse = 0.5 + 0.5 * Math.sin(clockT * 4);
  push(); noStroke(); fill(20, 14, 10, 150); rect(0, 0, width, height);
  const w = Math.min(600, width - 32), h = 350, x = width / 2 - w / 2, y = Math.max(12, height / 2 - h / 2), cx = width / 2;
  fill(0, 60); rect(x + 4, y + 6, w, h, 12); fill(255, 250, 238); rect(x, y, w, h, 12); fill(col); rect(x, y, w, 34, 12, 12, 0, 0);
  fill(255); textAlign(CENTER, CENTER); textStyle(BOLD); textSize(12); text(r1 ? 'AN ARTWORK · MONOPOLY, LIVED ON A REAL STREET' : 'ROUND 2 · THE SAME STREET', cx, y + 17);
  const title = r1 ? 'THE LANDLORD’S WALK' : 'NOW YOU ARE THEM';
  fill(40, 30, 24); textSize(34); textSize(Math.min(34, 34 * (w - 40) / textWidth(title))); text(title, cx, y + 70);
  const tag = r1 ? 'What if Monopoly were real, and the houses had people in them?' : 'The first home you bought was theirs.';
  textStyle(ITALIC); textSize(16); fill(110, 90, 80); textSize(Math.min(16, 16 * (w - 40) / textWidth(tag))); text(tag, cx, y + 102); textStyle(BOLD);
  const rx = x + 34, tw = w - 68;
  // Row 1: what to do.
  if (r1) { for (let i = 0; i < OWN_GOAL; i++) { houseIcon(rx + i * 30, y + 136, 24, color(OWNER_COL), true); } }
  else { houseIcon(rx, y + 136, 24, color(190, 175, 160), false); }
  const n1 = r1 ? OWN_GOAL : 1;
  fill(40, 30, 24); textAlign(LEFT, CENTER); textSize(19); text(r1 ? 'Win Monopoly. For real this time.' : 'Find a home you can rent.', rx + n1 * 30 + 12, y + 148, tw - n1 * 30 - 12);
  // Row 2: what it costs.
  const ry = y + 190, n2 = r1 ? 0 : 1;
  for (let i = 0; i < n2; i++) { personIcon(rx + i * 26, ry, 22, r1 ? color(200, 50, 40) : color(63, 111, 168), true); }
  textStyle(BOLD); textSize(17); fill(r1 ? color(200, 50, 40) : color(63, 111, 168)); text(r1 ? 'The whole city will cheer you on.' : `You can pay ${money(RENT_BUDGET)} a week.`, rx + n2 * 26 + 12, ry + 11, tw - n2 * 26 - 12);
  // Row 3: the keys.
  const ky = y + 248; textStyle(BOLD); textSize(13);
  const keys = r1 ? [['↑', 'walk'], ['E', 'buy'], ['← →', 'poorer / richer town']] : [['↑', 'walk'], ['E', 'rent']];
  let kx = rx; for (const [k, label] of keys) { const kw = textWidth(k) + 20; fill(255); stroke(90, 70, 60); strokeWeight(1.5); rect(kx, ky, kw, 28, 6); noStroke(); fill(40, 30, 24); textAlign(CENTER, CENTER); text(k, kx + kw / 2, ky + 14); textStyle(NORMAL); fill(90, 70, 60); textAlign(LEFT, CENTER); text(label, kx + kw + 8, ky + 14); kx += kw + textWidth(label) + 28; textStyle(BOLD); }
  textAlign(CENTER, CENTER); textStyle(BOLD); textSize(16); fill(col); drawingContext.globalAlpha = 0.55 + 0.45 * pulse; text('Click or press E to start', cx, y + h - 26); drawingContext.globalAlpha = 1; textStyle(ITALIC); textSize(13); fill(110, 90, 80); text('Stand still to listen to the homes.', cx, y + 296); textStyle(BOLD); drawingContext.globalAlpha = 1;
  pop();
}
// Round 2: you carry your things in a moving box, in front of you as you walk.
function drawCarryBox() {
  const w = Math.min(340, width * 0.38), h = w * 0.55, walk = Math.min(1, Math.abs(stepSpeed));
  const bob = Math.abs(Math.sin(stepPhase)) * 7 * walk, x = width / 2 - w / 2 + Math.sin(stepPhase * 0.5) * 4 * walk, y = height - h * 0.8 + bob;
  push(); noStroke();
  fill(0, 45); rect(x + 10, y + 12, w, h, 4);
  fill('#c39565'); rect(x, y, w, h, 4);
  fill('#a8784a'); rect(x, y, w, h * 0.14, 4, 4, 0, 0);
  fill('#e8d8b0'); rect(x, y + h * 0.14, w, h * 0.08);
  // Written on the box in marker: whose things these are.
  fill(70, 45, 30); textFont('Georgia'); textStyle(BOLD); textAlign(CENTER, CENTER);
  const label = 'EVERYTHING WE OWN'; textSize(w * 0.08); textSize(Math.min(w * 0.08, w * 0.08 * (w * 0.78) / textWidth(label))); text(label, x + w / 2, y + h * 0.36);
  textStyle(NORMAL); textSize(w * 0.05); text('this side up', x + w / 2, y + h * 0.5);
  fill('#d9a882'); ellipse(x + w * 0.03, y + h * 0.4, w * 0.12, w * 0.19); ellipse(x + w * 0.97, y + h * 0.4, w * 0.12, w * 0.19);
  pop();
}
// Just after you buy: a stamp, and the name of who had to leave (or who moved in).
// Your homes go up in value every second, so the bank will lend you more: coins fly from each
// home you own to your money, and the number ticks up while you stand there.
const YEAR_M = 240; let lastWalkZ = 0;   // half a lap (48 m x 10 / 2) is a year
function drawSoldBeat() {
  if (!soldBeat) { return; }
  const dur = soldBeat.dur || 4, age = clockT - soldBeat.t; if (age > dur) { soldBeat = null; return; }
  const a = Math.min(1, age / 0.15, (dur - age) / 0.6), pop0 = 1 + Math.max(0, 0.4 - age) * 1.5, cx = width / 2, cy = height * 0.36;
  push(); drawingContext.globalAlpha = a; translate(cx, cy); rotate(-0.08); scale(pop0);
  const col = color(...soldBeat.col); textFont('Georgia'); textStyle(BOLD); textSize(46); const sw = textWidth(soldBeat.stamp) + 60;
  noFill(); stroke(col); strokeWeight(5); rect(-sw / 2, -36, sw, 72, 8);
  noStroke(); fill(col); textAlign(CENTER, CENTER); text(soldBeat.stamp, 0, 2);
  pop(); push(); drawingContext.globalAlpha = a; textFont('Georgia'); textAlign(CENTER, CENTER);
  textStyle(BOLD); textSize(20); const tw = Math.max(textWidth(soldBeat.l1), (textSize(14), textWidth(soldBeat.l2))) + 40; textSize(20);
  noStroke(); fill(30, 20, 16, 200); rect(cx - tw / 2, cy + 52, tw, 58, 10); fill(255); text(soldBeat.l1, cx, cy + 70); textStyle(ITALIC); textSize(14); fill(255, 220, 200); text(soldBeat.l2, cx, cy + 94);
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


/* ---------- The board: the opening dive, and the city seen from above at the end ---------- */
// A board of 40 squares in the order of the towns, cheap to dear from GO. The opening starts
// above it and dives into the Leafy Suburbs square, which becomes the street. At the end the
// camera rises out of the street and the whole city is a board again.
const BOARD_ZONE_COL = ['#8a4a9a', '#2e9e47', '#d4a017', '#3f8fd6', '#e06a9a', '#8b5a2b'];
const BOARD_CELLS = [
  'GO', 5, 5, 'RENT UP', 5, 5, 'LEASE ENDS', 4, 4, 4,
  'PUSHED OUT', 4, 'INSPECTION', 3, 3, 'RENT UP', 3, 3, 3, 'NO KIDS',
  'WAITING LIST', 2, 2, 'RENT UP', 2, 2, 1, 1, 'BIDDING WAR', 1,
  'EVICTED', 0, 0, 'INVESTOR', 0, 'VACANT', 'VACANT', 'INVESTOR', 'VACANT', 'VACANT'
];
let boardT0 = 0;   // when the opening dive started
function cellXY(i) {
  // Board units: the board is 1100 x 1100, each square 100. GO is the bottom-right corner, play runs clockwise.
  if (i <= 10) { return [1000 - i * 100, 1000]; }
  if (i <= 20) { return [0, 1000 - (i - 10) * 100]; }
  if (i <= 30) { return [(i - 20) * 100, 0]; }
  return [1000, (i - 30) * 100];
}
function firstCell(zn) { return BOARD_CELLS.indexOf(zn); }
function boardIntroOn() { return intro && rules === 1 && clockT - boardT0 < 3.6; }
// mode: 'intro' (colourful, homes on every square), 'won' (grey, sold, only your pieces), 'out' (your path out to The Fringe)
function drawBoardScene(mode, zoomK, alpha) {
  if (alpha <= 0.001) { return; }
  const target = mode === 'won' && owned.length ? firstCell(owned[0].zone) : mode === 'out' ? firstCell(5) : firstCell(START_ZONE);
  const [tx0, ty0] = cellXY(target), tx = tx0 + 50, ty = ty0 + 50;
  const full = Math.min(width, height) * 0.86 / 1100, close = Math.max(width, height) * 1.25 / 100;
  const e = zoomK, sc = Math.exp(mixN(Math.log(full), Math.log(close), e));
  const keep = full * (1 - e) / sc, cx = tx - (tx - 550) * keep, cy = ty - (ty - 550) * keep, tilt = mixN(0.62, 1, e), rot = mixN(-0.32, 0, e);
  const grey = mode === 'won';
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = grey ? '#2a2a2c' : '#2f3a34'; ctx.fillRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2); ctx.scale(sc, sc * tilt); ctx.rotate(rot); ctx.translate(-cx, -cy);
  // The board itself, with a shadow under it.
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(18, 26, 1100, 1100);
  ctx.fillStyle = grey ? '#c9c7c2' : '#d8ead2'; ctx.fillRect(0, 0, 1100, 1100);
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, 1100, 1100); ctx.strokeRect(100, 100, 900, 900);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const mine = owned.map(o => o.zone); let placed = 0;
  for (let i = 0; i < 40; i++) {
    const [x, y] = cellXY(i), v = BOARD_CELLS[i], corner = i % 10 === 0;
    ctx.fillStyle = grey ? '#d6d3cc' : '#f2f6ea'; ctx.fillRect(x, y, 100, 100); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 100, 100);
    if (typeof v === 'number') {
      // A town's square: its colour bar on the inner edge, its name and price.
      const col = grey ? '#8a8680' : BOARD_ZONE_COL[v], side = i < 10 ? 0 : i < 20 ? 1 : i < 30 ? 2 : 3;
      ctx.fillStyle = col;
      if (side === 0) { ctx.fillRect(x, y, 100, 24); } else if (side === 1) { ctx.fillRect(x + 76, y, 24, 100); } else if (side === 2) { ctx.fillRect(x, y + 76, 100, 24); } else { ctx.fillRect(x, y, 24, 100); }
      ctx.fillStyle = '#1a1a1a'; ctx.font = 'bold 11px Georgia, serif'; ctx.fillText(ZONE_NAMES[v].toUpperCase(), x + 50, y + 46, 70);
      ctx.font = '11px Georgia, serif'; ctx.fillText(moneyK(TOWNS[v].price), x + 50, y + 62, 70);
      const k = mine.indexOf(v);
      if (mode === 'won' && k >= 0) {
        // Your pieces: the only colour left on the board.
        mine.splice(k, 1); placed++; ctx.fillStyle = placed >= 3 ? '#e0302a' : '#1fb04a';
        ctx.beginPath(); ctx.moveTo(x + 36, y + 96); ctx.lineTo(x + 36, y + 84); ctx.lineTo(x + 50, y + 73); ctx.lineTo(x + 64, y + 84); ctx.lineTo(x + 64, y + 96); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (mode === 'won') {
        ctx.save(); ctx.translate(x + 50, y + 82); ctx.rotate(-0.25); ctx.strokeStyle = '#c8322a'; ctx.lineWidth = 2; ctx.strokeRect(-26, -9, 52, 18); ctx.fillStyle = '#c8322a'; ctx.font = 'bold 12px Georgia, serif'; ctx.fillText('SOLD', 0, 1); ctx.restore();
      } else {
        // Somebody's home on every square.
        ctx.fillStyle = '#3f9e5a'; for (let h = 0; h < 2; h++) { const hx = x + 30 + h * 24, hy = y + 80; ctx.beginPath(); ctx.moveTo(hx - 8, hy + 10); ctx.lineTo(hx - 8, hy); ctx.lineTo(hx, hy - 7); ctx.lineTo(hx + 8, hy); ctx.lineTo(hx + 8, hy + 10); ctx.closePath(); ctx.fill(); }
      }
    } else {
      ctx.fillStyle = v === 'VACANT' || v === 'INVESTOR' ? (grey ? '#3a3a3a' : '#2a2a2a') : '#1a1a1a';
      if (v === 'VACANT' || v === 'INVESTOR') { ctx.fillRect(x + 6, y + 6, 88, 88); ctx.fillStyle = v === 'VACANT' ? '#ff4a3a' : '#d4a017'; }
      ctx.font = `bold ${corner ? 15 : 12}px Georgia, serif`; ctx.fillText(v, x + 50, y + 50, 88);
      if (v === 'GO') { ctx.fillStyle = '#c8322a'; ctx.font = 'bold 30px Georgia, serif'; ctx.fillText('←', x + 50, y + 76); }
    }
  }
  // The middle of the board.
  ctx.save(); ctx.translate(550, 550); ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = grey ? '#5a5652' : '#c8322a'; ctx.fillRect(-330, -50, 660, 100);
  ctx.fillStyle = '#fff'; ctx.font = 'italic 900 50px "Helvetica Neue", Arial, sans-serif'; ctx.fillText(grey ? 'POPULATION: YOU' : mode === 'out' ? 'FURTHER OUT' : 'THE LANDLORD’S WALK', 0, 3, 620);
  ctx.restore();
  // Round 2: the way you were pushed, from the suburbs to The Fringe.
  if (mode === 'out') {
    const pts = []; for (let i = firstCell(START_ZONE); i >= firstCell(5); i--) { const [x, y] = cellXY(i); pts.push([x + 50, y + 50]); }
    ctx.strokeStyle = '#c8322a'; ctx.lineWidth = 12; ctx.setLineDash([22, 14]); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
    const [ex, ey] = pts[pts.length - 1]; ctx.fillStyle = '#c39565'; ctx.fillRect(ex - 30, ey - 22, 60, 44); ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 3; ctx.strokeRect(ex - 30, ey - 22, 60, 44); ctx.fillStyle = '#e8d8b0'; ctx.fillRect(ex - 30, ey - 16, 60, 6);
  }
  ctx.restore();
}
// Round 2: the family's things, left out on the kerb in front of the home you bought from them.
function addKerbside(ch, L) {
  if (L.kerbDone) { return; } L.kerbDone = true;
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X - 0.7);
  ['mattress', 'bike', 'frame', 'box', 'teddy', 'free'].forEach((item, i) => ch.props.push({ kind: 'junk', item, x: x + L.side * (i % 2) * 0.35, z: mid - 3 + i * 1.1, side: L.side }));
}
function drawJunk(q, p) {
  const k = q.k; if (k < 3) { return; }
  ctx.save(); ctx.globalAlpha = 1 - fogFor(p.z) * 0.85; ctx.lineCap = 'round';
  const x = q.x, y = q.y;
  if (p.item === 'mattress') {
    ctx.translate(x, y); ctx.rotate(p.side * 0.12); ctx.fillStyle = toneN('#e8e4dc', p.z); ctx.fillRect(-0.45 * k, -1.9 * k, 0.9 * k, 1.9 * k);
    ctx.fillStyle = toneN('#8aa0c0', p.z); for (let i = 0; i < 6; i++) { ctx.fillRect(-0.45 * k, (-1.8 + i * 0.32) * k, 0.9 * k, 0.08 * k); }
    ctx.fillStyle = 'rgba(120,90,40,0.35)'; ctx.beginPath(); ctx.ellipse(0.1 * k, -0.7 * k, 0.22 * k, 0.15 * k, 0, 0, TWO_PI); ctx.fill();
  } else if (p.item === 'bike') {
    ctx.strokeStyle = toneN('#d03a3a', p.z); ctx.lineWidth = Math.max(1, 0.05 * k);
    ctx.beginPath(); ctx.arc(x - 0.3 * k, y - 0.22 * k, 0.22 * k, 0, TWO_PI); ctx.arc(x + 0.3 * k, y - 0.22 * k, 0.22 * k, 0, TWO_PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 0.3 * k, y - 0.22 * k); ctx.lineTo(x - 0.05 * k, y - 0.55 * k); ctx.lineTo(x + 0.3 * k, y - 0.22 * k); ctx.lineTo(x + 0.2 * k, y - 0.6 * k); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(x + 0.12 * k, y - 0.66 * k, 0.18 * k, 0.05 * k);
  } else if (p.item === 'frame') {
    // A family photo, face up to the sky.
    ctx.translate(x, y); ctx.rotate(-0.25); ctx.fillStyle = toneN('#b8902a', p.z); ctx.fillRect(-0.28 * k, -0.62 * k, 0.56 * k, 0.62 * k);
    ctx.fillStyle = toneN('#e8dcc0', p.z); ctx.fillRect(-0.22 * k, -0.56 * k, 0.44 * k, 0.5 * k);
    ctx.fillStyle = toneN('#6a5a4a', p.z); [-0.11, 0, 0.11].forEach((dx, i) => { const r = i === 1 ? 0.04 : 0.05; ctx.beginPath(); ctx.arc(dx * k, -0.38 * k, r * k, 0, TWO_PI); ctx.fill(); ctx.fillRect((dx - r) * k, -0.33 * k, r * 2 * k, 0.2 * k); });
  } else if (p.item === 'box') {
    ctx.fillStyle = toneN('#c39565', p.z); ctx.fillRect(x - 0.3 * k, y - 0.5 * k, 0.6 * k, 0.5 * k); ctx.fillStyle = toneN('#e8d8b0', p.z); ctx.fillRect(x - 0.3 * k, y - 0.46 * k, 0.6 * k, 0.07 * k);
    if (k > 20) { ctx.fillStyle = '#3a2a1a'; ctx.font = `bold ${0.1 * k}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('KIDS’ TOYS', x, y - 0.2 * k); }
  } else if (p.item === 'teddy') {
    ctx.fillStyle = toneN('#a8743a', p.z); ctx.beginPath(); ctx.arc(x, y - 0.18 * k, 0.16 * k, 0, TWO_PI); ctx.arc(x, y - 0.42 * k, 0.11 * k, 0, TWO_PI); ctx.arc(x - 0.08 * k, y - 0.52 * k, 0.04 * k, 0, TWO_PI); ctx.arc(x + 0.08 * k, y - 0.52 * k, 0.04 * k, 0, TWO_PI); ctx.fill();
  } else if (p.item === 'free') {
    ctx.fillStyle = '#5a4030'; ctx.fillRect(x - 0.03 * k, y - 0.9 * k, 0.06 * k, 0.9 * k); ctx.fillStyle = toneN('#b8915a', p.z); ctx.fillRect(x - 0.35 * k, y - 1.2 * k, 0.7 * k, 0.4 * k);
    if (k > 10) { ctx.fillStyle = '#2a1e18'; ctx.font = `bold ${0.24 * k}px "Marker Felt", "Comic Sans MS", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('FREE', x, y - 1.0 * k); }
  }
  ctx.restore();
}

/* ---------- Keys ---------- */
function boardKey(e) {
  const code = e.code;
  if (rules === 1 && (code === 'ArrowLeft' || code === 'KeyA')) { tryTurn(-1); return true; }
  if (rules === 1 && (code === 'ArrowRight' || code === 'KeyD')) { tryTurn(1); return true; }
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
  const L = plotHere(distanceWalked);
  if (rules === 2) {
    if (rentedAt) { return 'Home.'; }
    if (L) { const a = rentAsk(L); return a <= RENT_BUDGET ? 'You can pay this one · press E' : `${money(a)} a week · too dear (press E to apply)`; }
    if (sideSt && queuedTurn) { return `Turning further out: ${ZONE_NAMES[sideSt.zone]}`; }
    return 'Walk on · look for FOR RENT';
  }
  if (L) { return 'Press E to buy it'; }
  if (sideSt && queuedTurn) { return `Turning to ${ZONE_NAMES[sideSt.zone]}`; }
  if (atCrossing(distanceWalked + 12) || atCrossing(distanceWalked + 6)) { return '← poorer town  ·  → richer town'; }
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
  if (intro) { if (boardIntroOn()) { boardT0 = -99; return true; } intro = false; return true; }
  if (ending) { if (ending.kind === 'rule1' && clockT - ending.t > 6) { startRule2(); } return true; }
  // A click (or a tap) beside a FOR SALE / FOR RENT sign buys or applies, so it plays without a keyboard.
  if (plotHere(distanceWalked)) { useHere(); return true; }
  return false;
}

// Persistent plot identities are independent of the lap and absolute camera distance.
function preserveLot(L) {
  if (!L.memoryKey) { return; }
  streetMemory.set(L.memoryKey, { H: L.H, tier: L.tier, color: L.color, depth: L.depth, crown: L.crown, spire: L.spire, glass: L.glass, name: L.name, sign: L.sign, forSale: L.forSale, investorAt: L.investorAt, sold: L.sold, owned: L.owned, home: L.home, piece: L.piece, vacant: L.vacant, formerName: L.formerName, changedYear: L.changedYear });
}
function rememberStreet(ch) {
  ch.zoneId = zone;
  ch.lots.forEach((L, i) => {
    L.memoryKey = zone + ':' + ch.slot + ':' + i;
    L.formerName = L.name || 'NEIGHBOURHOOD HOMES';
    L.redevelopYear = L.seed % 3 === 0 ? Infinity : START_AGE + 2 + (Math.abs(L.seed) % 5);
    const saved = streetMemory.get(L.memoryKey);
    if (saved) { Object.assign(L, saved); }
    if (rules === 2 && L.owned && L.home) { addKerbside(ch, L); }
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
    L.vacant = true; L.forSale = false; L.investorAt = -1; L.sign = true; L.name = VOID_NAMES[Math.abs(L.seed) % VOID_NAMES.length]; L.changedYear = lifeAge;
    L.born = clockT; preserveLot(L);
  }
  const gone = ch.lots.filter(l => l.vacant || l.owned && !l.home).length;
  ch.residentShare = Math.max(0.1, 1 - gone / Math.max(1, ch.lots.length) * 1.4) * emptyK;
}
