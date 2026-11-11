/* The forest, painted in leaf dabs: every tree is grown once at start-up from a seed and painted
 * as hundreds of small, overlapping leaf dabs, lit and yellow-green on the sun side, cool and dark
 * in the shade and underneath, over branching, tapering branches. One style for every tree; the
 * kinds differ in shape, colour and height: round broadleaf trees (green, deep green, autumn),
 * narrow poplars, pale gums with leaves high up, dark pines in tiers, and low bushes.
 * The sprites are drawn into the street scaled with distance (drawBrushTree).
 */
let forestSprites = null;
const FW = 260, FH = 420;
function makeForest() {
  if (forestSprites) { return; }
  forestSprites = { broad: [], pine: [], poplar: [], gum: [], bush: [] };
  const PAL = {
    green: ['#3f6b3a', '#5b8a45', '#86b25a', '#b9d47a'], deep: ['#2c4f34', '#43704a', '#6a9a62', '#a0c48a'],
    autumn: ['#7a3a1e', '#b8592a', '#e08a3a', '#f4c36a'], gold: ['#6a5a1e', '#9a8a2a', '#c8b43e', '#ecdc7a'],
    poplar: ['#3f6230', '#64883e', '#94b450', '#cddf86'], gum: ['#4f5f3f', '#6f7f52', '#94a26a', '#c0c898'],
    pine: ['#1c3a2a', '#28503a', '#3d6a48', '#6a9466'], bush: ['#34583a', '#4f7a46', '#78a058', '#a8c87a']
  };
  const grow = (kind, seedN, pal, opt) => {
    const big = document.createElement('canvas'); big.width = 900; big.height = 900;
    const c = big.getContext('2d'), r = rngN(seedN), tips = [], dabs = [], baseX = 450, baseY = 880;
    let x0 = baseX - 20, x1 = baseX + 20, y0 = baseY - 40;
    const keep = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); };
    // Branches: recursive, tapering, slightly crooked.
    const branch = (x, y, ang, len, w, depth) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, mx = (x + x2) / 2 + (r() - 0.5) * len * 0.25, my = (y + y2) / 2 + (r() - 0.5) * len * 0.15;
      c.strokeStyle = opt.bark || (depth < 2 ? '#4a3a30' : '#5a463a'); c.lineCap = 'round'; c.lineWidth = w;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, x2, y2); c.stroke(); keep(x2, y2);
      if (depth >= (opt.leafFrom || 2)) { tips.push([x2, y2, depth]); }
      if (depth >= (opt.depth || 5) || len < 10) { return; }
      const n = depth === 0 ? 3 : 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) { const a2 = ang + (i - (n - 1) / 2) * (0.42 + r() * 0.25) * opt.spread + (r() - 0.5) * 0.3; branch(x2, y2, a2 + (-Math.PI / 2 - a2) * (opt.up || 0.18), len * (0.7 + r() * 0.12), w * 0.66, depth + 1); }
    };
    const trunk = (h, w, col, lean = 0) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(baseX - w, baseY); c.quadraticCurveTo(baseX - w * 0.4 + lean * 0.5, baseY - h * 0.6, baseX - w * 0.3 + lean, baseY - h); c.lineTo(baseX + w * 0.3 + lean, baseY - h); c.quadraticCurveTo(baseX + w * 0.5 + lean * 0.5, baseY - h * 0.6, baseX + w, baseY); c.fill(); keep(baseX + lean, baseY - h);
    };
    if (kind === 'pine') {
      // A straight trunk and needles in tiers: dabs fill a cone that narrows to the top, wider at the bottom of each tier.
      const H = opt.h, top = baseY - H; trunk(H * 0.9, 7, '#3a2a20');
      for (let i = 0; i < 1400; i++) {
        const v = Math.pow(r(), 0.8), y = top + v * (H - 70), tier = (v * 6) % 1, half = (16 + v * opt.w) * (0.55 + 0.45 * tier), x = baseX + (r() * 2 - 1) * half;
        const light = constrain(0.6 - (x - baseX) / (opt.w + 16) * 0.35 - tier * 0.25 + (r() - 0.5) * 0.35, 0, 1);
        dabs.push({ x, y, light, rot: (r() - 0.5) * 0.6, s: 2.5 + r() * 3, flat: 0.45 }); keep(x, y);
      }
    } else if (kind === 'bush') {
      // No trunk: a low dome of leaves with a few twigs.
      for (let i = 0; i < 6; i++) { c.strokeStyle = '#4a3a30'; c.lineWidth = 3; c.beginPath(); c.moveTo(baseX + (r() - 0.5) * 40, baseY); c.lineTo(baseX + (r() - 0.5) * 150, baseY - 40 - r() * 50); c.stroke(); }
      for (let i = 0; i < 900; i++) {
        const a = Math.PI + r() * Math.PI, d = Math.pow(r(), 0.5), x = baseX + Math.cos(a) * d * opt.w, y = baseY - 6 + Math.sin(a) * d * opt.h;
        const light = constrain(0.5 + (baseY - y) / opt.h * 0.4 - (x - baseX) / opt.w * 0.15 + (r() - 0.5) * 0.35, 0, 1);
        dabs.push({ x, y, light, rot: r() * Math.PI, s: 3 + r() * 4, flat: 0.62 }); keep(x, y);
      }
    } else {
      // Trees with branches: broadleaf, poplar and gum.
      const th = opt.trunk;
      trunk(th, opt.trunkW || 9, opt.bark || '#4a3a30', opt.lean || 0);
      branch(baseX + (opt.lean || 0), baseY - th + 2, -Math.PI / 2 + (r() - 0.5) * 0.15, opt.len || 80, opt.trunkW ? opt.trunkW * 0.8 : 7, 0);
      let cx0 = 1e9, cx1 = -1e9, cy0 = 1e9, cy1 = -1e9; for (const [x, y] of tips) { cx0 = Math.min(cx0, x); cx1 = Math.max(cx1, x); cy0 = Math.min(cy0, y); cy1 = Math.max(cy1, y); }
      const cxm = (cx0 + cx1) / 2, cym = (cy0 + cy1) / 2, rx = (cx1 - cx0) / 2 + 30, ry = (cy1 - cy0) / 2 + 30;
      for (const [tx, ty, dp] of tips) {
        const spreadR = (dp <= 2 ? 52 : dp === 3 ? 40 : 30) * (opt.clump || 1), n = Math.round((dp <= 2 ? 30 : 20) * (opt.dense || 1));
        for (let i = 0; i < n; i++) {
          const a = r() * Math.PI * 2, d = Math.pow(r(), 0.55) * spreadR, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.85 + spreadR * 0.15;
          const nx = (x - cxm) / rx, ny = (y - cym) / ry, light = constrain(0.55 - ny * 0.45 - nx * 0.15 + (r() - 0.5) * 0.35, 0, 1);
          dabs.push({ x, y, light, rot: r() * Math.PI, s: 3 + r() * 4.5, flat: 0.62 }); keep(x, y);
        }
      }
    }
    // Paint the dabs from shade to light, so the crown has depth.
    dabs.sort((a, b) => a.light - b.light);
    for (const d of dabs) { c.fillStyle = pal[Math.min(3, Math.floor(d.light * 4))]; c.globalAlpha = 0.75 + d.light * 0.25; c.beginPath(); c.ellipse(d.x, d.y, d.s, d.s * d.flat, d.rot, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
    // Crop to the tree and fit it into the sprite, base at the bottom centre; remember how tall it came out.
    const bx0 = Math.min(x0 - 12, baseX - 20), bx1 = Math.max(x1 + 12, baseX + 20), by0 = y0 - 12, half = Math.max(baseX - bx0, bx1 - baseX), sc = Math.min(FW / (half * 2), FH / (baseY + 4 - by0));
    const g = createGraphics(FW, FH); g.pixelDensity(1); g.clear();
    const dh = (baseY + 4 - by0) * sc;
    g.drawingContext.drawImage(big, baseX - half, by0, half * 2, baseY + 4 - by0, FW / 2 - half * sc, FH - dh, half * 2 * sc, dh);
    g.top = dh / FH; forestSprites[kind].push(g);
  };
  try {
    // Round broadleaf trees in four colours.
    [['green', 1.0], ['deep', 0.9], ['autumn', 1.05], ['gold', 0.95]].forEach(([p, sp], v) => grow('broad', 7100 + v * 13, PAL[p], { spread: sp, trunk: 70 }));
    // Poplars: a short trunk, branches that all turn upwards, a tall narrow crown.
    [0, 1].forEach(v => grow('poplar', 7200 + v * 13, PAL.poplar, { spread: 0.32, up: 0.55, trunk: 30, len: 70, depth: 6, leafFrom: 1, clump: 0.85, dense: 1.3 }));
    // Gums: a tall pale trunk that leans, leaves only high up in loose clumps.
    [0, 1].forEach(v => grow('gum', 7300 + v * 13, PAL.gum, { spread: 1.25, trunk: 190, trunkW: 11, bark: v ? '#d8d0c0' : '#e6dfd2', lean: v ? -30 : 30, len: 70, depth: 4, leafFrom: 3, clump: 0.8, dense: 0.8 }));
    // Pines: dark tiers of needles.
    [0, 1].forEach(v => grow('pine', 7400 + v * 13, PAL.pine, { h: 420 + v * 60, w: 120 }));
    // Bushes: low and wide.
    [0, 1].forEach(v => grow('bush', 7500 + v * 13, PAL.bush, { w: 150 + v * 30, h: 110 }));
  } catch (e) { console.warn('the forest could not be painted', e && e.stack); forestSprites = null; }
}
// A haze-coloured silhouette of a tree sprite, laid over it in the distance so far trees fade into the air.
const hazeCache = new Map();
function hazeSprite(img) {
  if (hazeCache.has(img)) { return hazeCache.get(img); }
  const src = img.canvas || img.elt, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const c = cv.getContext('2d'); c.drawImage(src, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#ffd79a'; c.fillRect(0, 0, cv.width, cv.height);
  hazeCache.set(img, cv); return cv;
}
// Draw one painted tree at a ground point: its kind sets the shape, h its real height in metres.
function drawBrushTree(q, kind, tone, h, z) {
  const list = forestSprites && forestSprites[kind]; if (!list || !list.length) { return false; }
  const img = list[Math.floor(tone * 997) % list.length], hpx = h * q.k / (img.top || 1), wpx = hpx * FW / FH, fog = fogFor(z), y0 = q.y - hpx;
  ctx.save(); ctx.fillStyle = `rgba(40,30,20,${0.16 * (1 - fog)})`; ctx.beginPath(); ctx.ellipse(q.x, q.y + 0.15 * q.k, Math.min(wpx * 0.25, h * q.k * 0.4), 0.3 * q.k, 0, 0, TWO_PI); ctx.fill();
  ctx.drawImage(img.elt || img.canvas, q.x - wpx / 2, y0, wpx, hpx); ctx.restore();
  if (fog > 0.02) { ctx.save(); ctx.globalAlpha = fog * 0.85; ctx.drawImage(hazeSprite(img), q.x - wpx / 2, y0, wpx, hpx); ctx.restore(); }
  return true;
}
