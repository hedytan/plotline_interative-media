/* Hand-painted trees with p5.brush (https://github.com/acamposuribe/p5.brush).
 * p5.brush needs WEBGL, and the street is a 2D canvas, so the trees are painted once into a few
 * small WEBGL buffers at start-up (watercolour foliage with bleed, charcoal trunk and branches,
 * pencil hatching for shade). The street then draws these paintings as sprites, scaled with
 * distance, like stage flats. If p5.brush isn't loaded, the plain trees are used instead.
 */
let brushTrees = null;
const BT_W = 240, BT_H = 360;
function makeBrushTrees() {
  if (typeof brush === 'undefined' || brushTrees) { return; }
  try {
    brushTrees = [];
    const greens = [['#5f9e4a', '#8cc66a', '#c4e39a'], ['#4f8a52', '#7fb86e', '#b8dc9c'], ['#6aa349', '#9ccf5c', '#d6eb9a'], ['#3f7d5a', '#6eae7c', '#a8d6a8']];
    const g = createGraphics(BT_W, BT_H, WEBGL); g.pixelDensity(1); brush.load(g);   // one buffer, reused: browsers allow few WebGL contexts
    for (let v = 0; v < 6; v++) {
      g.clear(); g.background(255); brush.seed(1000 + v);   // paint on white paper, then lift the paper off
      const r = rngN(777 + v * 31), pal = greens[v % greens.length], base = BT_H / 2 - 8, cy = base - BT_H * 0.6;
      // Trunk: a tapered watercolour shape with charcoal edges.
      brush.noStroke(); brush.fill('#7a5440', 160); brush.bleed(0.05); brush.fillTexture(0.4, 0.3);
      brush.polygon([[-9, base], [-4, cy + 30], [4, cy + 30], [10, base]]);
      brush.noFill(); brush.set('charcoal', '#4a3226', 1.2);
      brush.line(-9, base, -4, cy + 34); brush.line(10, base, 4, cy + 34);
      brush.set('2B', '#4a3226', 1);
      for (let i = 0; i < 4; i++) { const y0 = cy + 40 + r() * 30, dir = i % 2 ? -1 : 1; brush.line(0, y0, dir * (24 + r() * 26), y0 - 30 - r() * 30); }
      // Watercolour canopy: overlapping blobs, dark underneath, light on top.
      brush.noStroke();
      const blobs = 8;
      for (let i = 0; i < blobs; i++) {
        const t = i / (blobs - 1), bx = (r() - 0.5) * BT_W * 0.36, by = cy + (r() - 0.3) * BT_H * 0.16 - t * 30, rad = BT_W * (0.16 + r() * 0.08);
        brush.fill(pal[t < 0.4 ? 0 : t < 0.8 ? 1 : 2], 100 + r() * 50); brush.bleed(0.12 + r() * 0.1, 'out'); brush.fillTexture(0.55, 0.5);
        brush.circle(bx, by, rad, true);
      }
      // Pencil marks for leaves on the shadow side.
      brush.noFill(); brush.set('HB', '#2f5a34', 1);
      for (let i = 0; i < 22; i++) { const a = r() * TWO_PI, d = r() * BT_W * 0.25, lx = Math.cos(a) * d, ly = cy + Math.sin(a) * d * 0.6 + 16; brush.line(lx, ly, lx + 5 + r() * 6, ly - 3 - r() * 5); }
      brush.reDraw();
      const img = g.get(); paperToAlpha(img); brushTrees.push(img);
    }
    // Keep the buffer: p5.brush stays attached to it (removing it breaks p5.brush's draw hooks).
  } catch (e) { console.warn('p5.brush trees failed, using plain trees', e && e.stack); brushTrees = null; }
}

// Watercolour on white paper -> paint with transparency (colour-to-alpha against white).
function paperToAlpha(img) {
  img.loadPixels(); const px = img.pixels;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255, a = Math.max(1 - r, 1 - g, 1 - b);
    if (a < 0.03) { px[i + 3] = 0; continue; }
    px[i] = 255 * (r - (1 - a)) / a; px[i + 1] = 255 * (g - (1 - a)) / a; px[i + 2] = 255 * (b - (1 - a)) / a; px[i + 3] = 255 * Math.min(1, a * 1.15);
  }
  img.updatePixels();
}
