/* Plotline — buy a plot.
 * Some plots along the street stay empty with a FOR SALE board. Walk up to one and press
 * E to buy it with the money you have earned. Your own building rises there with your name
 * on it. Every street you walk into after that has your properties near its start, and
 * walking past one of them pays you rent.
 */
const PLOT_PRICE = [60, 150, 400, 800, 1500];
const OWNER_COL = '#d4a017';
let ownerName = '', portfolio = [], ownedFromC = Infinity, nameBox = null;

function rentOf(tier) { return Math.round(PLOT_PRICE[tier] * 0.2); }

/* ---------- Called from chunkAt() ---------- */
function plotsForChunk(ch, r) {
  if (ch.park) { return; }
  // Your properties come back near the start of every new street.
  const idx = ch.c - ownedFromC;
  if (idx >= 0 && idx < portfolio.length) {
    const own = portfolio[idx], cand = ch.lots.filter(L => !L.special);
    if (cand.length) {
      const old = cand[Math.min(cand.length - 1, 1)], i = ch.lots.indexOf(old);
      const L = makeLot(null, own.tier, old.side, old.z0, old.z1 - old.z0, rngN(own.seed));
      Object.assign(L, { owned: true, ownerName: own.name, rentDue: true, sign: false });
      ch.lots[i] = L;
    }
  }
  // Roughly every other block has one plot for sale.
  if (r() < 0.6) {
    const cand = ch.lots.filter(L => !L.special && !L.owned);
    if (cand.length) { const L = cand[Math.floor(r() * cand.length)]; L.forSale = true; L.price = PLOT_PRICE[L.tier]; }
  }
}

/* ---------- Every frame ---------- */
function plotsUpdate(z) {
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (L.owned && L.rentDue && (L.z0 + L.z1) / 2 < z) {
        L.rentDue = false; const rent = rentOf(L.tier); wallet += rent;
        moneyPops.push({ text: moneyText(rent), t: clockT, up: true }); sound.cash(true);
        sayToast(`Rent from ${L.ownerName}: +$${rent}`);
      }
    }
  }
}
function nearPlot(z) {
  if (visit || dayOver || turnAnim || nameBox) { return null; }
  let best = null;
  for (const ch of chunks.values()) {
    for (const L of ch.lots) {
      if (!L.forSale || L.owned) { continue; }
      const d = Math.abs((L.z0 + L.z1) / 2 - z);
      if (d < 9 && (!best || d < best.d)) { best = { L, d }; }
    }
  }
  return best ? best.L : null;
}
function buyPlot(L) {
  if (wallet < L.price) { sayToast(`This plot costs $${L.price}. Earn $${L.price - wallet} more at work.`); return; }
  wallet -= L.price; moneyPops.push({ text: moneyText(-L.price), t: clockT, up: false }); sound.cash(false);
  L.owned = true; L.forSale = false; L.rentDue = false; L.sign = false; L.born = clockT + 0.3;
  const seedHere = L.seed;
  if (dest === L) { dest = null; }
  if (ownerName) { claim(L, seedHere); sayToast(`Sold! ${ownerName} is going up.`); }
  else { askName(L, seedHere); }
}
function claim(L, s) {
  L.ownerName = ownerName;
  portfolio.push({ name: ownerName, tier: L.tier, seed: s });
}
// First purchase: name your place. A small text box over the canvas.
function askName(L, s) {
  stepSpeed = 0;
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);background:#fffaee;border-radius:10px;padding:18px 20px;box-shadow:0 6px 24px rgba(0,0,0,.3);font:16px Georgia,serif;color:#2a1e18;text-align:center;z-index:10;width:min(320px,86vw)';
  box.innerHTML = '<div style="font-weight:bold;font-size:18px;margin-bottom:6px">Sold! Name your place</div><div style="font-size:13px;color:#6a5a50;margin-bottom:10px">It goes on the sign. Press Enter.</div>';
  const input = document.createElement('input');
  input.maxLength = 16; input.placeholder = 'e.g. Hedy’s';
  input.style.cssText = 'width:100%;box-sizing:border-box;font:18px Georgia,serif;padding:8px 10px;border:2px solid #d4a017;border-radius:6px;outline:none;text-align:center';
  box.appendChild(input); document.body.appendChild(box); nameBox = box;
  setTimeout(() => input.focus(), 30);
  const done = () => {
    ownerName = (input.value.trim() || 'My Place').slice(0, 16);
    claim(L, s); box.remove(); nameBox = null; canvasNode.focus({ preventScroll: true });
    sayToast(`${ownerName} is going up!`);
  };
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { done(); } });
}

/* ---------- Drawing ---------- */
// A FOR SALE board on its post, standing on the empty plot by the pavement.
function drawForSale(L) {
  const mid = (L.z0 + L.z1) / 2, x = L.side * (EDGE_X + 1.4), base = P(x, 0, mid);
  if (base.rz < 1.5 || base.rz > FAR_Z * 0.8) { return; }
  const k = base.k, fog = fogFor(mid), w = 3.2 * k, h = 1.7 * k, top = base.y - 3 * k;
  ctx.save(); ctx.globalAlpha = 1 - fog * 0.8;
  ctx.fillStyle = '#5a4030'; ctx.fillRect(base.x - 0.07 * k, top, 0.14 * k, 3 * k);
  ctx.fillStyle = '#fffaee'; ctx.strokeStyle = '#c8322a'; ctx.lineWidth = Math.max(1, 0.08 * k);
  ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h); ctx.strokeRect(base.x - w / 2, top - h * 0.2, w, h);
  ctx.fillStyle = '#c8322a'; ctx.fillRect(base.x - w / 2, top - h * 0.2, w, h * 0.38);
  if (w > 26) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${h * 0.26}px Georgia, serif`; ctx.fillStyle = '#fff'; ctx.fillText('FOR SALE', base.x, top - h * 0.2 + h * 0.19);
    ctx.font = `bold ${h * 0.32}px Georgia, serif`; ctx.fillStyle = '#2a1e18'; ctx.fillText(`$${L.price}`, base.x, top - h * 0.2 + h * 0.68);
  }
  ctx.restore();
}
// Your building: a gold sign with your name and a little flag on the roof.
function drawOwnedFront(L, x, z0, H) {
  if (!L.ownerName) { return; }
  const len = L.z1 - L.z0, ya = Math.min(H - 0.8, 4.4);
  facadeSign(L, x, z0, L.z0 + len * 0.15, L.z0 + len * 0.85, ya, ya + 1.2, '#2a1e18', '#ffe9a8', L.ownerName.toUpperCase(), OWNER_COL);
  const fz = L.z0 + len * 0.5; if (fz < z0) { return; }
  const pole = P(x + L.side * 0.6, H, fz), tip = P(x + L.side * 0.6, H + 3, fz); if (pole.rz < 1) { return; }
  ctx.strokeStyle = toneN('#3a2a20', fz); ctx.lineWidth = Math.max(1, 0.06 * pole.k); ctx.beginPath(); ctx.moveTo(pole.x, pole.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  const wave = Math.sin(clockT * 4) * 0.15 * tip.k;
  ctx.fillStyle = OWNER_COL; ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x + 1.3 * tip.k * -L.side, tip.y + 0.35 * tip.k + wave); ctx.lineTo(tip.x, tip.y + 0.7 * tip.k); ctx.fill();
}
