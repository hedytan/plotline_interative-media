/* Plotline — a day on the board.
 * A simple daily routine on top of the street: a task card tells you where to go next
 * (coffee, work, lunch, work, the park). Each destination rises out of the street ahead
 * with a pin over it; walk up to its door and press E. Coffee and lunch cost money, work
 * pays. The street ahead is built from what you can afford: the more you earn, the
 * pricier the district you walk into. At any crossing you can turn left or right (A / D)
 * into a new street; the park is always around a corner.
 */
const DAY_TASKS = [
  { kind: 'cafe', title: 'Grab a coffee', clock: '7:30 am', base: -4, verb: 'Buy a coffee', done: 'Flat white, thanks!', place: 'Café' },
  { kind: 'office', title: 'Go to work', clock: '9:00 am', base: 120, verb: 'Work the morning shift', done: 'Morning shift done.', place: 'Office' },
  { kind: 'deli', title: 'Lunch: buy a sandwich', clock: '12:30 pm', base: -10, verb: 'Buy a sandwich', done: 'Ham, cheese, pickles.', place: 'Sandwich bar' },
  { kind: 'office', title: 'Back to work', clock: '1:30 pm', base: 150, verb: 'Work the afternoon', done: 'That’s a day’s pay.', place: 'Office' },
  { kind: 'park', title: 'Unwind in the park', clock: '6:00 pm', base: 0, verb: 'Sit on a bench', done: 'What a day.', place: 'Park' }
];
const WEALTH_AT = [0, 100, 300, 600, 1000];            // money needed for each district
const PRICE_K = [1, 1.5, 2.2, 3, 4];                    // prices and pay rise with the district
const PLACE_SIGN = { cafe: 'CAFÉ', office: 'OFFICE', deli: 'SANDWICH BAR' };
const PLACE_COL = { cafe: '#c8742c', office: '#2f5f9e', deli: '#3f9a4a', park: '#3f8a3a' };

let wallet = 20, dayNo = 1, taskIdx = 0, dest = null, wantDestFrom = 0, parkFromC = Infinity;
let turnAnim = null, turnYaw = 0, streetT = 0, baseNight = 0, fadeA = 0, dayOver = null, lastWealthTier = 0;
const toasts = [], moneyPops = [];

function wealthTier() { let t = 0; for (let i = 0; i < WEALTH_AT.length; i++) { if (wallet >= WEALTH_AT[i]) { t = i; } } return t; }
function currentTask() { return DAY_TASKS[taskIdx]; }
function priceAt(task, tier) { return Math.round(task.base * PRICE_K[tier]); }
function moneyText(v) { return (v < 0 ? '−$' : '+$') + Math.abs(v); }
function sayToast(text) { toasts.push({ text, t: clockT }); }

/* ---------- Called from sketch.js ---------- */
// Tier for a newly made chunk of street: what you can afford right now.
function chunkTier() { return wealthTier(); }
function isParkChunk(c) { return c >= parkFromC; }

function dayUpdate(z) {
  // Wealth went up: rebuild the part of the street you have not reached yet.
  const wt = wealthTier();
  if (wt !== lastWealthTier) {
    lastWealthTier = wt;
    for (const [c, ch] of chunks) { if (ch.z0 > z + APPEAR_Z + 12 && !ch.lots.includes(dest)) { chunks.delete(c); } }
  }
  if (queuedTurn && atCrossing(z)) { const d = queuedTurn; queuedTurn = 0; tryTurn(d); }
  updateVisit();
  // Keep the destination valid: it must still exist and not be behind you.
  const task = currentTask();
  if (dest && ![...chunks.values()].some(ch => ch.lots.includes(dest))) { dest = null; }
  if (dest && dest.z1 < z - 4 && !visit) { dest = null; wantDestFrom = z + 60; sayToast(`Missed it. There’s another ${task.place.toLowerCase()} ahead.`); }
  if (!dest && task.kind !== 'park' && !dayOver) { pickDest(task, Math.max(wantDestFrom, z + 70)); }
}
function pickDest(task, fromZ) {
  const lots = [...chunks.values()].flatMap(ch => ch.park ? [] : ch.lots).filter(L => !L.special && L.z0 >= fromZ).sort((a, b) => a.z0 - b.z0);
  if (lots.length) { dest = lots[0]; dest.dest = task.kind; dest.sign = false; }
}
// Distance to the next crossing ahead (where you can turn).
function nextCrossing(z) {
  const c = Math.floor(z / CHUNK_LEN), local = z - c * CHUNK_LEN;
  if (local < CROSS_W - 1) { return 0; }
  return (c + 1) * CHUNK_LEN + 2 - z;
}
function atCrossing(z) { const local = modN(z, CHUNK_LEN); return local > 0.5 && local < CROSS_W - 0.5; }

/* ---------- Doing the task ---------- */
function nearDest(z) {
  const task = currentTask();
  if (dayOver || visit) { return null; }
  if (task.kind === 'park') { const ch = chunkAt(Math.floor(z / CHUNK_LEN)); return ch.park && modN(z, CHUNK_LEN) > CROSS_W + 4 ? { task, amount: 0 } : null; }
  if (!dest || riseOf(dest.born) < 0.9) { return null; }
  const mid = (dest.z0 + dest.z1) / 2;
  return Math.abs(mid - z) < 8 ? { task, amount: priceAt(task, dest.tier) } : null;
}
// Pressing E starts a short stop: you turn to the door, wait while it happens, then walk on.
const VISIT = {
  cafe: { dur: 3.2, doing: 'The barista is making your coffee…', item: 'cafe' },
  office: { dur: 4.5, doing: 'Working…', item: null },
  deli: { dur: 3.2, doing: 'Making your sandwich…', item: 'deli' },
  park: { dur: 3.5, doing: 'Sitting on a bench, watching the trees…', item: null }
};
let visit = null, visitYaw = 0, heldItem = null, queuedTurn = 0;
function doTask() {
  if (visit) { return; }
  const near = nearDest(distanceWalked); if (!near) { return; }
  const { task, amount } = near;
  if (amount < 0 && wallet + amount < 0) { sayToast('Not enough money. Go to work first!'); return; }
  const side = dest ? dest.side : -1;
  visit = { task, amount, side, t: clockT, dur: VISIT[task.kind].dur };
  stepSpeed = 0; autoWalk = false;
  if (task.kind !== 'park' && task.kind !== 'office') { heldItem = null; }
  sound.door();
}
function updateVisit() {
  if (!visit) { visitYaw = lerp(visitYaw, 0, 0.12); return; }
  const age = clockT - visit.t, d = visit.dur;
  // Turn to face the door, hold, then turn back to the street.
  const inA = easeN(age / 0.6), outA = 1 - easeN((age - (d - 0.6)) / 0.6);
  visitYaw = visit.side * 1.05 * Math.min(inA, outA);
  if (age >= d) { finishVisit(); }
}
function finishVisit() {
  const { task, amount } = visit; visit = null;
  wallet += amount;
  if (amount !== 0) { moneyPops.push({ text: moneyText(amount), t: clockT, up: amount > 0 }); sound.cash(amount > 0); }
  if (dest) { dest.dest = null; dest.doneKind = task.kind; }
  dest = null; wantDestFrom = distanceWalked + 40;
  sayToast(task.done);
  if (VISIT[task.kind].item) { heldItem = { kind: VISIT[task.kind].item, t: clockT }; }
  if (task.kind === 'park') { endOfDay(); return; }
  taskIdx++;
  const next = currentTask();
  if (next.kind === 'park') { baseNight = 0.45; nightTarget = Math.max(nightTarget, baseNight); }
}
function endOfDay() {
  sound.go(); baseNight = 0.85; nightTarget = 0.85;
  dayOver = { t: clockT, tier: wealthTier() };
}
function startNextDay() {
  dayNo++; taskIdx = 0; dayOver = null; baseNight = 0; nightTarget = 0; parkFromC = Infinity;
  newStreet(0);
}

/* ---------- Turning at a crossing ---------- */
function tryTurn(dir) {
  if (turnAnim || dayOver || visit) { return; }
  if (!atCrossing(distanceWalked)) {
    const ahead = nextCrossing(distanceWalked);
    if (ahead < 30) { queuedTurn = dir; sayToast(`Turning ${dir < 0 ? 'left' : 'right'} at the crossing ahead.`); }
    else { sayToast(`No corner here. The next crossing is ${Math.round(ahead)} m ahead.`); }
    return;
  }
  queuedTurn = 0;
  turnAnim = { dir, t: clockT, swapped: false }; sound.turn(dir);
}
function updateTurn() {
  if (!turnAnim) { turnYaw = 0; fadeA = Math.max(0, fadeA - 0.05); return; }
  const u = (clockT - turnAnim.t) / 0.85;
  turnYaw = turnAnim.dir * HALF_PI * easeN(Math.min(1, u));
  fadeA = easeN((u - 0.45) / 0.55);
  if (u >= 1 && !turnAnim.swapped) {
    turnAnim.swapped = true; turnYaw = 0;
    newStreet(turnAnim.dir);
    turnAnim = null; fadeA = 1;
  }
}
// A fresh street: new seed, you stand at its first crossing and it builds around you.
function newStreet(dir) {
  seed += 131; chunks.clear(); firedCasinos.clear(); visitedJails.clear();
  const startC = 2; distanceWalked = startC * CHUNK_LEN + 3; lastChunk = startC; lastTier = -1;
  stepSpeed = 0; dashTarget = null; streetT = clockT; dest = null; wantDestFrom = 0; buildSkyline();
  parkFromC = (currentTask().kind === 'park' && !dayOver && dir !== 0) ? startC : Infinity;
  if (parkFromC !== Infinity) { sayToast('The park! Walk in and find a bench.'); }
}

/* ---------- Drawing ---------- */
// A pin floating over the destination, visible from far away.
function drawDestPin() {
  if (!dest) { return; }
  const L = dest, mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + L.setback + 1.5);
  const built = riseOf(L.born), top = (built > 0.01 ? L.H * (L.econNow || 1) * Math.min(1, built) : 0) + 4;
  const p = P(x, top, mid); if (p.rz < 2) { return; }
  const bob = Math.sin(clockT * 3) * 4, s = Math.max(16, Math.min(34, p.k * 1.4));
  const col = PLACE_COL[L.dest];
  ctx.save();
  ctx.strokeStyle = rgbaN(col, 0.7); ctx.lineWidth = 2; const g = P(x, 0, mid);
  ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(p.x, p.y + bob + s); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y + bob, s, 0, TWO_PI); ctx.fill();
  ctx.beginPath(); ctx.moveTo(p.x - s * 0.5, p.y + bob + s * 0.8); ctx.lineTo(p.x + s * 0.5, p.y + bob + s * 0.8); ctx.lineTo(p.x, p.y + bob + s * 1.5); ctx.fill();
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(p.x, p.y + bob, s * 0.78, 0, TWO_PI); ctx.fill();
  ctx.restore();
  drawPlaceIcon(L.dest, p.x, p.y + bob, s * 0.9, col);
  const dist = Math.max(0, Math.round(mid - distanceWalked));
  push(); textAlign(CENTER, TOP); textStyle(BOLD); textSize(13); fill(255); stroke(0, 120); strokeWeight(3);
  text(`${currentTask().place} · ${dist} m`, p.x, p.y + bob + s * 1.6); pop();
}
// Small hand-drawn icons, so nothing depends on emoji fonts.
function drawPlaceIcon(kind, x, y, s, col) {
  push(); translate(x, y); stroke(col); strokeWeight(Math.max(1.5, s * 0.1)); noFill(); strokeJoin(ROUND); strokeCap(ROUND);
  if (kind === 'cafe') { rect(-s * 0.4, -s * 0.15, s * 0.6, s * 0.5, s * 0.1); arc(s * 0.2, s * 0.08, s * 0.3, s * 0.3, -HALF_PI, HALF_PI); for (let i = 0; i < 3; i++) { line(-s * 0.25 + i * s * 0.15, -s * 0.3, -s * 0.2 + i * s * 0.15, -s * 0.5); } }
  else if (kind === 'office') { rect(-s * 0.5, -s * 0.2, s, s * 0.6, s * 0.08); rect(-s * 0.18, -s * 0.4, s * 0.36, s * 0.2, s * 0.05); line(-s * 0.5, s * 0.02, s * 0.5, s * 0.02); }
  else if (kind === 'deli') { triangle(-s * 0.5, s * 0.3, s * 0.5, s * 0.3, 0, -s * 0.4); line(-s * 0.32, s * 0.08, s * 0.32, s * 0.08); }
  else { line(0, s * 0.45, 0, 0); circle(0, -s * 0.12, s * 0.6); }
  pop();
}
// Shop front for a destination: a sign, a lit door and a little welcome mat.
function drawDestFront(L, x, z0, H) {
  const len = L.z1 - L.z0, kind = L.dest || L.doneKind; if (!kind) { return; }
  const col = PLACE_COL[kind], dz = L.z0 + len * 0.42;
  if (dz + 1.6 > z0) { polyN(wallQuad(x - L.side * 0.08, Math.max(dz, z0), x - L.side * 0.08, dz + 1.6, 0, 2.6), L.dest ? '#ffe2a0' : toneN('#c8b08a', dz), toneN(col, dz), 3); }
  facadeSign(L, x, z0, L.z0 + len * 0.2, L.z0 + len * 0.8, Math.min(H - 0.6, 4.2), Math.min(H - 0.6, 4.2) + 1.1, toneN(col, L.z0), '#fffaf0', PLACE_SIGN[kind] || '', L.dest ? '#ffd27a' : null);
}

/* ---------- Park ---------- */
function fillPark(ch, r) {
  ch.park = true; ch.lots = [];
  for (let z = ch.z0 + CROSS_W + 1; z < ch.z0 + CHUNK_LEN; z += 3.2) {
    for (const side of [-1, 1]) {
      ch.props.push({ kind: 'tree', x: side * mixN(ROAD_W + 2, ROAD_W + 4, r()), z: z + r() * 2, h: mixN(4.5, 7.5, r()), tone: r() });
      for (let k = 0; k < 2; k++) { ch.props.push({ kind: 'tree', x: side * mixN(EDGE_X + 4, EDGE_X + 30, r()), z: z + r() * 3, h: mixN(5, 9, r()), tone: r() }); }
    }
  }
  for (let z = ch.z0 + CROSS_W + 6; z < ch.z0 + CHUNK_LEN; z += 10) { ch.props.push({ kind: 'bench', x: (r() < 0.5 ? -1 : 1) * (ROAD_W + 1.1), z }); }
}
function drawBench(q, p) {
  const k = q.k, dir = p.x > 0 ? -1 : 1;
  ctx.fillStyle = toneN('#8a5a3a', p.z); ctx.fillRect(q.x - 0.8 * k, q.y - 0.5 * k, 1.6 * k, 0.12 * k);
  ctx.fillRect(q.x - 0.8 * k + dir * 0.0, q.y - 1.0 * k, 1.6 * k, 0.1 * k);
  ctx.fillStyle = toneN('#2a2a30', p.z); ctx.fillRect(q.x - 0.7 * k, q.y - 0.5 * k, 0.08 * k, 0.5 * k); ctx.fillRect(q.x + 0.62 * k, q.y - 0.5 * k, 0.08 * k, 0.5 * k);
}

/* ---------- HUD ---------- */
function drawDayHud() {
  const task = currentTask(), z = distanceWalked;
  push(); textFont('Georgia');
  // Task card, top left.
  const w = Math.min(300, width * 0.42), x = 16, y = 16;
  noStroke(); fill(0, 50); rect(x + 3, y + 4, w, 96, 8); fill(255, 250, 238); rect(x, y, w, 96, 8);
  fill(PLACE_COL[task.kind]); rect(x, y, 8, 96, 8, 0, 0, 8);
  fill(120, 100, 90); textSize(12); textAlign(LEFT, TOP); text(`DAY ${dayNo} · ${dayOver ? '9:00 pm' : task.clock}`, x + 20, y + 12);
  fill(40, 30, 24); textStyle(BOLD); textSize(18); text(dayOver ? 'Home time' : task.title, x + 20, y + 32, w - 28);
  textStyle(NORMAL); textSize(13); fill(90, 70, 60);
  let hint = '';
  if (dayOver) { hint = 'Press E to sleep and start a new day.'; }
  else if (task.kind === 'park') { hint = chunkAt(Math.floor(z / CHUNK_LEN)).park ? 'Find a bench in the park.' : `Turn left or right at a crossing (A / D). Next one in ${Math.round(nextCrossing(z))} m.`; }
  else if (dest) { hint = `${task.place} ${Math.max(0, Math.round((dest.z0 + dest.z1) / 2 - z))} m ahead, on your ${dest.side < 0 ? 'left' : 'right'}.`; }
  else { hint = 'Keep walking…'; }
  text(hint, x + 20, y + 60, w - 28);
  // Wallet, top right.
  const ww = 150, wx = width - ww - 16;
  fill(0, 50); rect(wx + 3, y + 4, ww, 64, 8); fill(255, 250, 238); rect(wx, y, ww, 64, 8);
  fill(120, 100, 90); textSize(11); textAlign(RIGHT, TOP); text('WALLET', wx + ww - 14, y + 10);
  fill(40, 30, 24); textStyle(BOLD); textSize(26); text(`$${wallet}`, wx + ww - 14, y + 26);
  const wt = wealthTier(); textStyle(NORMAL); textSize(10); fill(DISTRICTS[wt].stripe[0]); textAlign(LEFT, TOP); text(DISTRICTS[wt].name, wx + 12, y + 12, 70);
  // Money popping up out of the wallet.
  for (let i = moneyPops.length - 1; i >= 0; i--) {
    const m = moneyPops[i], age = clockT - m.t; if (age > 2) { moneyPops.splice(i, 1); continue; }
    fill(m.up ? '#2f8a3a' : '#c8322a'); textStyle(BOLD); textSize(24); textAlign(RIGHT, TOP); drawingContext.globalAlpha = 1 - easeN((age - 1.2) / 0.8);
    text(m.text, wx + ww - 14, y + 70 + age * 18); drawingContext.globalAlpha = 1;
  }
  // "Press E" prompt at the door.
  const near = nearDest(z);
  if (near || dayOver) {
    const label = dayOver ? 'E  ·  Sleep' : `E  ·  ${near.task.verb}${near.amount ? '  ' + moneyText(near.amount) : ''}`;
    textStyle(BOLD); textSize(18); const tw = textWidth(label) + 40, bx = width / 2 - tw / 2, by = height - 210;
    fill(0, 60); rect(bx + 3, by + 4, tw, 46, 23); fill(255, 250, 238); rect(bx, by, tw, 46, 23);
    fill(40, 30, 24); textAlign(CENTER, CENTER); text(label, width / 2, by + 24);
  }
  // Waiting at the door: a progress bar.
  if (visit) {
    const u = constrain((clockT - visit.t) / visit.dur, 0, 1), bw = Math.min(360, width - 40), bx = width / 2 - bw / 2, by = height - 200;
    fill(0, 60); rect(bx + 3, by + 4, bw, 64, 12); fill(255, 250, 238); rect(bx, by, bw, 64, 12);
    fill(40, 30, 24); textStyle(ITALIC); textSize(15); textAlign(CENTER, TOP);
    const doing = visit.task.kind === 'office' ? `Working… ${['9', '10', '11', '12'][Math.min(3, Math.floor(u * 4))]}:00` : VISIT[visit.task.kind].doing;
    text(doing, width / 2, by + 12); fill(225, 215, 195); rect(bx + 20, by + 40, bw - 40, 10, 5); fill(PLACE_COL[visit.task.kind]); rect(bx + 20, by + 40, (bw - 40) * u, 10, 5);
  }
  drawHeldItem();
  // Short messages.
  for (let i = toasts.length - 1; i >= 0; i--) {
    const t = toasts[i], age = clockT - t.t; if (age > 3.2) { toasts.splice(i, 1); continue; }
    drawingContext.globalAlpha = easeN(age / 0.3) * (1 - easeN((age - 2.6) / 0.6));
    textStyle(ITALIC); textSize(16); fill(255); stroke(0, 140); strokeWeight(3); textAlign(CENTER, CENTER); text(t.text, width / 2, height - 250 - (toasts.length - 1 - i) * 26);
    noStroke(); drawingContext.globalAlpha = 1;
  }
  // End of the day.
  if (dayOver) {
    const a = easeN((clockT - dayOver.t) / 1.2); drawingContext.globalAlpha = a;
    const cw = Math.min(380, width - 32), cx = width / 2 - cw / 2, cy = height * 0.32;
    fill(255, 250, 238); rect(cx, cy, cw, 140, 10); fill(PLACE_COL.park); rect(cx, cy, cw, 36, 10, 10, 0, 0);
    fill(255); textStyle(BOLD); textSize(16); textAlign(CENTER, CENTER); text(`END OF DAY ${dayNo}`, width / 2, cy + 18);
    fill(40, 30, 24); textSize(22); text(`You have $${wallet}`, width / 2, cy + 66);
    textStyle(NORMAL); textSize(14); fill(90, 70, 60); text(`Tomorrow starts in ${DISTRICTS[dayOver.tier].name}.`, width / 2, cy + 100);
    drawingContext.globalAlpha = 1;
  }
  pop();
  // Fade while turning a corner.
  if (fadeA > 0.01) { ctx.fillStyle = `rgba(255,236,200,${fadeA * 0.85})`; ctx.fillRect(0, 0, width, height); }
}

/* ---------- Keys ---------- */
function dayKey(e) {
  const code = e.code;
  if (code === 'KeyE' || code === 'Space') { if (dayOver) { if (clockT - dayOver.t > 1) { startNextDay(); } } else { doTask(); } return true; }
  if (code === 'KeyA' || code === 'ArrowLeft') { tryTurn(-1); return true; }
  if (code === 'KeyD' || code === 'ArrowRight') { tryTurn(1); return true; }
  return false;
}

// What you are carrying, held low in the corner of your view and swaying as you walk.
function drawHeldItem() {
  if (!heldItem) { return; }
  const age = clockT - heldItem.t; if (age > 70) { heldItem = null; return; }
  const s = Math.min(width, height) * 0.16, sway = Math.sin(PI * stepPhase) * 6 * bobAmp, rise = (1 - easeN(age / 0.5)) * s;
  const x = width - s * 1.2 + sway, y = height - s * 0.55 + rise + Math.abs(Math.cos(PI * stepPhase)) * 4 * bobAmp;
  push(); noStroke();
  fill(232, 190, 160); ellipse(x + s * 0.05, y + s * 0.55, s * 0.95, s * 0.6);                    // hand
  if (heldItem.kind === 'cafe') {
    fill(250, 246, 238); quad(x - s * 0.32, y - s * 0.55, x + s * 0.32, y - s * 0.55, x + s * 0.24, y + s * 0.5, x - s * 0.24, y + s * 0.5);
    fill(PLACE_COL.cafe); quad(x - s * 0.29, y - s * 0.12, x + s * 0.29, y - s * 0.12, x + s * 0.27, y + s * 0.18, x - s * 0.27, y + s * 0.18);
    fill(60, 50, 44); rect(x - s * 0.36, y - s * 0.68, s * 0.72, s * 0.15, s * 0.05);
    stroke(255, 255, 255, 120); strokeWeight(2); noFill();
    for (let i = 0; i < 3; i++) { const sx = x - s * 0.15 + i * s * 0.15, ph = clockT * 2 + i; beginShape(); for (let k = 0; k < 6; k++) { vertex(sx + Math.sin(ph + k * 0.9) * s * 0.04, y - s * 0.75 - k * s * 0.08); } endShape(); }
  } else {
    fill(222, 180, 110); triangle(x - s * 0.5, y + s * 0.35, x + s * 0.5, y + s * 0.35, x, y - s * 0.45);
    fill(120, 180, 90); rect(x - s * 0.42, y + s * 0.12, s * 0.84, s * 0.07);
    fill(240, 200, 120); rect(x - s * 0.4, y + s * 0.2, s * 0.8, s * 0.06);
    fill(250, 240, 220); triangle(x - s * 0.44, y + s * 0.3, x + s * 0.44, y + s * 0.3, x, y - s * 0.3);
  }
  pop();
}
