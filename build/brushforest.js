/* A forest painted with p5.brush (https://github.com/acamposuribe/p5.brush, vendor/p5.brush.js).
 * p5.brush paints only on WEBGL, and the street is a 2D canvas, so every kind of tree is painted
 * once at start-up into ONE reused WEBGL buffer (watercolour with bleed and paper texture,
 * charcoal and pencil for trunks and branches), lifted off the white paper into a sprite, and the
 * street then draws these paintings scaled with distance. Kinds: round broadleaf trees (green,
 * deep green, autumn), dark pines, narrow poplars, tall pale gums and low bushes. Every tree on the
 * street, forest or garden, uses them, so the whole picture is one painted style.
 */
let forestSprites = null;
const FW = 240, FH = 420;
// How much of the sprite's height the painting fills, so each kind is drawn at its real height.
const FOREST_TOP = { broad: 0.86, pine: 0.95, poplar: 0.88, gum: 0.82, bush: 0.4 };
function makeForest() {
  if (forestSprites || typeof brush === 'undefined') { return; }
  try {
    forestSprites = { broad: [], pine: [], poplar: [], gum: [], bush: [] };
    const g = createGraphics(FW, FH, WEBGL); g.pixelDensity(1); brush.load(g);   // one buffer, reused; never removed
    const base = FH / 2 - 6;
    const paint = (kind, seedN, fn) => { brush.reDraw(); g.clear(); g.background(255); brush.reDraw(); g.background(255); brush.seed(seedN); fn(rngN(seedN)); brush.reDraw();
      // p5.brush keeps its last stroke until the next one: paint an invisible dot far away to push it onto this page.
      brush.noStroke(); brush.fill('#ffffff', 1); brush.circle(-FW * 3, -FH * 3, 1); brush.reDraw(); const img = g.get(); forestPaperToAlpha(img); forestSprites[kind].push(img); };
    const trunk = (col, w0, w1, top, lean = 0) => {
      brush.noStroke(); brush.fill(col, 170); brush.bleed(0.04); brush.fillTexture(0.4, 0.3);
      brush.polygon([[-w0, base], [-w1 + lean, top], [w1 + lean, top], [w0, base]]);
      brush.noFill(); brush.set('charcoal', '#3a2a20', 1.1); brush.line(-w0, base, -w1 + lean, top + 4); brush.line(w0, base, w1 + lean, top + 4);
    };
    const blob = (x, y, rad, col, alpha, bleed = 0.15) => { brush.noStroke(); brush.fill(col, alpha); brush.bleed(bleed, 'out'); brush.fillTexture(0.55, 0.5); brush.circle(x, y, rad, true); };
    const hatch = (cx, cy, rx, ry, col, n) => { brush.noFill(); brush.set('HB', col, 1); for (let i = 0; i < n; i++) { const a = Math.random() * TWO_PI, d = Math.random(), lx = cx + Math.cos(a) * d * rx, ly = cy + Math.sin(a) * d * ry; brush.line(lx, ly, lx + 4 + Math.random() * 6, ly - 3 - Math.random() * 5); } };
    // Round broadleaf trees: a green one, a deep green one and one in autumn colours.
    [['#4f8a3e', '#7fb35a', '#bcd98a'], ['#2f5f3a', '#4f8650', '#86b07a'], ['#9a4a22', '#d0782e', '#efb85a']].forEach((pal, v) => paint('broad', 2000 + v, r => {
      const cy = base - FH * 0.55; trunk('#6e4c38', 9, 4, cy + 30);
      brush.set('2B', '#4a3226', 1); for (let i = 0; i < 4; i++) { const y0 = cy + 40 + r() * 30, dir = i % 2 ? -1 : 1; brush.line(0, y0, dir * (24 + r() * 26), y0 - 30 - r() * 30); }
      for (let i = 0; i < 9; i++) { const t = i / 8; blob((r() - 0.5) * FW * 0.38, cy + (r() - 0.3) * FH * 0.14 - t * 34, FW * (0.15 + r() * 0.08), pal[t < 0.4 ? 0 : t < 0.8 ? 1 : 2], 100 + r() * 50); }
      hatch(0, cy + 14, FW * 0.25, FH * 0.08, pal[0], 20);
    }));
    // Pines: a straight trunk and stacked tiers of dark needles, narrowing to a point.
    [['#1f3f2c', '#2f5a3a', '#4f7a4e'], ['#24452e', '#3a6440', '#6a8f5a']].forEach((pal, v) => paint('pine', 3000 + v, r => {
      const top = -FH / 2 + 14; trunk('#5a3c2c', 6, 3, top + 60);
      const tiers = 6;
      for (let i = 0; i < tiers; i++) {
        const t = i / (tiers - 1), yb = base - FH * 0.14 - t * FH * 0.68, w = FW * (0.36 - t * 0.27), ht = FH * 0.22;
        brush.noStroke(); brush.fill(pal[i % 2 ? 1 : 0], 150); brush.bleed(0.08, 'out'); brush.fillTexture(0.5, 0.4);
        brush.polygon([[-w, yb], [(r() - 0.5) * 6, yb - ht], [w, yb]]);
        brush.fill(pal[2], 90); brush.polygon([[-w * 0.15, yb - 2], [0, yb - ht * 0.9], [-w * 0.7, yb - 2]]);
      }
      hatch(0, base - FH * 0.4, FW * 0.18, FH * 0.3, pal[0], 26);
    }));
    // Poplars: tall and narrow, a column of yellow-green leaves.
    [['#4f7a2e', '#86a83e', '#c8d670'], ['#3f6a3a', '#6a9a50', '#a8c880']].forEach((pal, v) => paint('poplar', 4000 + v, r => {
      trunk('#6a4c3a', 6, 3, base - FH * 0.3);
      for (let i = 0; i < 9; i++) { const t = i / 8; blob((r() - 0.5) * FW * 0.1, base - FH * 0.22 - t * FH * 0.58, FW * (0.12 - t * 0.03 + r() * 0.02), pal[t < 0.35 ? 0 : t < 0.75 ? 1 : 2], 110 + r() * 40, 0.1); }
      hatch(0, base - FH * 0.5, FW * 0.08, FH * 0.3, pal[0], 16);
    }));
    // Gums: a tall, pale, leaning trunk, bare branches and loose clumps of olive leaves high up.
    [['#5f7046', '#7a8a56', '#a8b47a'], ['#55684a', '#7a8f62', '#b0c090']].forEach((pal, v) => paint('gum', 5000 + v, r => {
      const lean = (v ? -1 : 1) * 18, top = -FH * 0.16; trunk(v ? '#d8d0c0' : '#e8e0d0', 8, 4, top, lean);
      brush.set('charcoal', '#8a7a68', 1); for (let i = 0; i < 4; i++) { const y0 = top + 40 + i * 30, dir = i % 2 ? -1 : 1; brush.line(lean * 0.6, y0, lean * 0.6 + dir * (40 + r() * 30), y0 - 50 - r() * 30); }
      for (let i = 0; i < 7; i++) { blob(lean + (r() - 0.5) * FW * 0.5, top - 10 - r() * FH * 0.14, FW * (0.08 + r() * 0.04), pal[i % 3], 110 + r() * 40, 0.12); }
    }));
    // Bushes: low and wide, a few soft rounds sitting on the ground.
    [['#3f6a3a', '#5f8a4a', '#9ab870'], ['#4a5f30', '#6f8a40', '#a8b860']].forEach((pal, v) => paint('bush', 6000 + v, r => {
      for (let i = 0; i < 7; i++) { const t = i / 6; blob((r() - 0.5) * FW * 0.4, base - FH * (0.06 + t * 0.11), FW * (0.13 + r() * 0.05), pal[t < 0.4 ? 0 : t < 0.8 ? 1 : 2], 110 + r() * 40); }
      hatch(0, base - FH * 0.12, FW * 0.3, FH * 0.06, pal[0], 14);
    }));
  } catch (e) { console.warn('p5.brush forest failed, using the plain trees', e && e.stack); forestSprites = null; }
}
// Watercolour on white paper -> paint with transparency (colour-to-alpha against white).
function forestPaperToAlpha(img) {
  img.loadPixels(); const px = img.pixels;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255, a = Math.max(1 - r, 1 - g, 1 - b);
    if (a < 0.03) { px[i + 3] = 0; continue; }
    px[i] = 255 * (r - (1 - a)) / a; px[i + 1] = 255 * (g - (1 - a)) / a; px[i + 2] = 255 * (b - (1 - a)) / a; px[i + 3] = 255 * Math.min(1, a * 1.15);
  }
  img.updatePixels();
}
// Draw one painted tree at a ground point: its kind sets the shape, h its real height in metres.
function drawBrushTree(q, kind, tone, h, z) {
  const list = forestSprites && forestSprites[kind]; if (!list || !list.length) { return false; }
  const img = list[Math.floor(tone * 997) % list.length], hpx = h * q.k / FOREST_TOP[kind], wpx = hpx * FW / FH, fog = fogFor(z), y0 = q.y - hpx + hpx * 6 / FH;
  ctx.save(); ctx.fillStyle = `rgba(40,30,20,${0.16 * (1 - fog)})`; ctx.beginPath(); ctx.ellipse(q.x, q.y + 0.15 * q.k, Math.min(wpx * 0.25, h * q.k * 0.4), 0.3 * q.k, 0, 0, TWO_PI); ctx.fill();
  ctx.drawImage(img.canvas || img.elt, q.x - wpx / 2, y0, wpx, hpx); ctx.restore();
  if (fog > 0.02) { ctx.save(); ctx.globalAlpha = fog * 0.85; ctx.drawImage(hazeSprite(img), q.x - wpx / 2, y0, wpx, hpx); ctx.restore(); }
  return true;
}
