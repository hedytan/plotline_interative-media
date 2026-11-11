/* Painted trees. Each tree is grown once at start-up from a seed: a trunk that splits into
 * tapering branches (recursive), and hundreds of small leaf dabs clustered at the branch tips.
 * Leaves are shaded by where they sit in the crown: lit and yellow-green on the sun side (the
 * far end of the street), cool blue-green in the shade and underneath, with gaps where the sky
 * shows through. The result is kept as a sprite and drawn into the street with the same haze as
 * everything else, plus a soft shadow on the ground.
 */
let brushTrees = null;
const BT_W = 300, BT_H = 420;
function makeBrushTrees() {
  if (brushTrees) { return; }
  brushTrees = [];
  const kinds = [
    { leaf: ['#3f6b3a', '#5b8a45', '#86b25a', '#b9d47a'], spread: 0.95, crown: 0.55 },   // plane tree
    { leaf: ['#355f3e', '#4f7d4c', '#76a462', '#a9cc86'], spread: 0.8, crown: 0.6 },     // gum
    { leaf: ['#4a6b2f', '#6f9440', '#9fbf55', '#d2df86'], spread: 1.05, crown: 0.5 },    // spring green
    { leaf: ['#7a3f55', '#b85f7c', '#e08aa4', '#f6c3d2'], spread: 0.9, crown: 0.55 },    // jacaranda / blossom
    { leaf: ['#3a5f45', '#557f58', '#7fa874', '#b4d0a0'], spread: 0.75, crown: 0.62 },
    { leaf: ['#4b6a33', '#6c8f46', '#94b65e', '#c6d98c'], spread: 1.0, crown: 0.52 }
  ];
  kinds.forEach((k, v) => {
    const big = document.createElement('canvas'); big.width = 900; big.height = 900;   // grow freely, then crop to the sprite
    const c = big.getContext('2d'), r = rngN(4242 + v * 977), tips = [];
    // Branches: recursive, tapering, slightly crooked.
    function branch(x, y, ang, len, w, depth) {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len, mx = (x + x2) / 2 + (r() - 0.5) * len * 0.25, my = (y + y2) / 2 + (r() - 0.5) * len * 0.15;
      c.strokeStyle = depth < 2 ? '#4a3a30' : '#5a463a'; c.lineCap = 'round'; c.lineWidth = w;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, x2, y2); c.stroke();
      if (depth >= 2) { tips.push([x2, y2, depth]); }
      if (depth >= 5 || len < 10) { return; }
      const n = depth === 0 ? 3 : 2 + (r() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) { const a2 = ang + (i - (n - 1) / 2) * (0.42 + r() * 0.25) * k.spread + (r() - 0.5) * 0.3; branch(x2, y2, a2 + (-Math.PI / 2 - a2) * 0.18, len * (0.7 + r() * 0.12), w * 0.66, depth + 1); }
    }
    const baseX = 450, baseY = 880, trunk = 150 * (1 - k.crown);
    // Trunk with a lit edge.
    c.fillStyle = '#4a3a30'; c.beginPath(); c.moveTo(baseX - 9, baseY); c.quadraticCurveTo(baseX - 4, baseY - trunk * 0.6, baseX - 3, baseY - trunk); c.lineTo(baseX + 3, baseY - trunk); c.quadraticCurveTo(baseX + 5, baseY - trunk * 0.6, baseX + 10, baseY); c.fill();
    branch(baseX, baseY - trunk + 2, -Math.PI / 2 + (r() - 0.5) * 0.15, 80, 7, 0);
    // Crown bounds, for shading.
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of tips) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2, rx = (x1 - x0) / 2 + 30, ry = (y1 - y0) / 2 + 30;
    // Leaf dabs: back (dark) to front (lit), so the crown has depth.
    const dabs = [];
    for (const [tx, ty, dp] of tips) {
      const spreadR = dp <= 2 ? 52 : dp === 3 ? 40 : 30, n = dp <= 2 ? 30 : 20;
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.pow(r(), 0.55) * spreadR, x = tx + Math.cos(a) * d, y = ty + Math.sin(a) * d * 0.85 + spreadR * 0.15;
        const nx = (x - cxm) / rx, ny = (y - cym) / ry, light = constrain(0.55 - ny * 0.45 - nx * 0.15 + (r() - 0.5) * 0.35, 0, 1);
        dabs.push({ x, y, light, rot: r() * Math.PI, s: 3 + r() * 4.5 });
      }
    }
    dabs.sort((a, b) => a.light - b.light);
    for (const d of dabs) {
      const idx = Math.min(3, Math.floor(d.light * 4)); c.fillStyle = k.leaf[idx]; c.globalAlpha = 0.75 + d.light * 0.25;
      c.beginPath(); c.ellipse(d.x, d.y, d.s, d.s * 0.62, d.rot, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    // Crop to the tree and fit it into the sprite, base at the bottom centre.
    const bx0 = Math.min(x0 - 70, baseX - 20), bx1 = Math.max(x1 + 70, baseX + 20), by0 = y0 - 60, sc = Math.min(BT_W / (bx1 - bx0), BT_H / (baseY + 4 - by0));
    const g = createGraphics(BT_W, BT_H); g.pixelDensity(1); g.clear();
    const dw = (bx1 - bx0) * sc, dh = (baseY + 4 - by0) * sc;
    g.drawingContext.drawImage(big, bx0, by0, bx1 - bx0, baseY + 4 - by0, BT_W / 2 - (baseX - bx0) * sc, BT_H - dh, dw, dh);
    brushTrees.push(g);
  });
}
