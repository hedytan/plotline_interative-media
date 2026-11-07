/* Plotline — We Build Our World: post-processing.
 *
 * The street is painted with Canvas 2D (flat shapes, painted tree sprites). This file runs a small
 * WebGL pipeline over each finished frame, before the HUD is drawn, so the text stays sharp:
 *
 *   scene (2D canvas) ──► bright pass ─┬─► blur H ─► blur V ──► bloom ─┐
 *                        (¼ size)      └─► radial blur to the sun ───► light rays ─┤
 *                                                                                  ▼
 *                       composite: scene + bloom + rays, colour grade, vignette, grain
 *
 * The colour grade carries the idea of the piece: while the street is forest the light is warm and
 * green and the sun shines through the trees in rays; as you build, the picture loses colour, the
 * shadows turn cold, the smog swallows the rays and the edges darken.
 *
 * It needs only WebGL 1 (no libraries) and falls back to the plain picture if WebGL is missing.
 * G turns it off and on (before / after), I shows frame timing. If frames get slow it lowers its own
 * quality (rays first, then bloom) so the walk stays smooth.
 */
const PostFX = (() => {
  let gl = null, glCanvas = null, ready = false, failed = false;
  let enabled = true, quality = 2;           // 2 = bloom + rays, 1 = bloom only, 0 = grade only
  let programs = {}, quad = null, sceneTex = null, targets = {};
  let w = 0, h = 0, qw = 0, qh = 0;
  let slowT = 0, fastT = 0, frameMs = 16, gpuMs = 0;

  /* ---------- Shaders ---------- */
  const VERT = `
    attribute vec2 aPos; varying vec2 vUv;
    void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  // Keeps only the bright parts of the picture (soft knee, so there is no hard edge).
  const BRIGHT = `
    precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uThreshold;
    void main() {
      vec3 c = texture2D(uTex, vUv).rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      float k = smoothstep(uThreshold, uThreshold + 0.18, l);
      gl_FragColor = vec4(c * k, 1.0);
    }`;

  // 9-tap Gaussian blur in one direction (run twice: across, then down).
  const BLUR = `
    precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uStep;
    void main() {
      vec3 s = texture2D(uTex, vUv).rgb * 0.2270;
      s += (texture2D(uTex, vUv + uStep * 1.385).rgb + texture2D(uTex, vUv - uStep * 1.385).rgb) * 0.3162;
      s += (texture2D(uTex, vUv + uStep * 3.231).rgb + texture2D(uTex, vUv - uStep * 3.231).rgb) * 0.0703;
      gl_FragColor = vec4(s, 1.0);
    }`;

  // Light rays ("volumetric light scattering", GPU Gems 3 ch. 13): march from each pixel towards the
  // sun, adding up the bright sky found on the way. Tree trunks and buildings block it, so shafts of
  // light appear between them. Only bright, sky-coloured pixels near the sun count as light.
  const RAYS = `
    precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform vec2 uSun; uniform float uAspect;
    void main() {
      const int N = 36;
      vec2 d = (vUv - uSun) / float(N) * 0.92;
      vec2 p = vUv; float decay = 1.0; vec3 sum = vec3(0.0);
      for (int i = 0; i < N; i++) {
        p -= d;
        vec3 c = texture2D(uTex, p).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        vec2 o = (p - uSun) * vec2(uAspect, 1.0);
        float nearSun = exp(-dot(o, o) * 10.0);
        sum += c * smoothstep(0.78, 0.95, l) * nearSun * decay;
        decay *= 0.955;
      }
      gl_FragColor = vec4(sum / float(N) * 1.6, 1.0);
    }`;

  // Final picture. uDev: 0 = forest .. 1 = city; uSmog: 0 .. 1.
  const COMPOSITE = `
    precision mediump float; varying vec2 vUv;
    uniform sampler2D uScene, uBloom, uRays;
    uniform float uBloomK, uRaysK, uDev, uSmog, uTime, uAspect;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    vec3 saturate3(vec3 c, float s) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return mix(vec3(l), c, s); }
    void main() {
      vec2 fromMid = vUv - 0.5;
      float r2 = dot(fromMid * vec2(uAspect, 1.0), fromMid * vec2(uAspect, 1.0));
      // A hint of lens colour fringing towards the edges (more as the air gets dirty).
      vec2 ca = fromMid * r2 * (0.004 + 0.006 * uSmog);
      vec3 c = vec3(texture2D(uScene, vUv + ca).r, texture2D(uScene, vUv).g, texture2D(uScene, vUv - ca).b);
      c += texture2D(uBloom, vUv).rgb * uBloomK;
      c += texture2D(uRays, vUv).rgb * vec3(1.0, 0.9, 0.72) * uRaysK;

      // Colour grade: forest = warm, green and rich; city = flat, cold shadows, yellow-grey smog.
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      vec3 forest = saturate3(c, 0.9) * vec3(1.0, 1.02, 0.96);
      forest = mix(forest, forest * vec3(0.92, 1.04, 0.9), (1.0 - l) * 0.35);      // greener shade
      vec3 city = saturate3(c, 0.5);
      city = mix(city * vec3(0.9, 0.97, 1.08), city * vec3(1.04, 1.0, 0.94), l);   // cold shadows, warm-grey highlights
      vec3 g = mix(forest, city, uDev);
      g = mix(g, g * 0.86 + vec3(0.11, 0.105, 0.09), uSmog * 0.55);                // smog lifts and greys the blacks
      g = mix(g, g * g * (3.0 - 2.0 * g), 0.18 + 0.12 * uDev);                    // gentle S-curve, harder in the city

      // Vignette (heavier in smog), then fine moving film grain.
      g *= 1.0 - smoothstep(0.25, 1.15, r2) * (0.32 + 0.25 * uSmog);
      g += (hash(vUv * 900.0 + fract(uTime * 7.0)) - 0.5) * 0.035;
      gl_FragColor = vec4(clamp(g, 0.0, 1.0), 1.0);
    }`;

  /* ---------- Set-up ---------- */
  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
    return s;
  }
  function program(frag) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(p)); }
    const uni = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; uni[name] = gl.getUniformLocation(p, name); }
    return { p, uni };
  }
  function texture(tw, th) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (tw) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); }
    return t;
  }
  function target(tw, th) {
    const tex = texture(tw, th), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w: tw, h: th };
  }
  function init() {
    try {
      glCanvas = document.createElement('canvas');
      gl = glCanvas.getContext('webgl', { alpha: false, antialias: false, depth: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
      if (!gl) { throw new Error('no WebGL'); }
      programs = { bright: program(BRIGHT), blur: program(BLUR), rays: program(RAYS), comp: program(COMPOSITE) };
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);    // canvas rows run top-down, GL rows bottom-up
      sceneTex = texture(0, 0);
      ready = true;
    } catch (err) { failed = true; console.warn('PostFX off:', err.message); }
  }
  function resize(cw, ch) {
    if (cw === w && ch === h) { return; }
    w = cw; h = ch; glCanvas.width = w; glCanvas.height = h;
    qw = Math.max(1, Math.round(w / 4)); qh = Math.max(1, Math.round(h / 4));
    for (const t of Object.values(targets)) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
    targets = { bright: target(qw, qh), ping: target(qw, qh), pong: target(qw, qh), rays: target(qw, qh) };
  }
  // Draw one full-screen pass into `out` (or the screen when out is null).
  function pass(prog, out, inputs, set) {
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null);
    gl.viewport(0, 0, out ? out.w : w, out ? out.h : h);
    inputs.forEach(([name, tex], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(prog.uni[name], i); });
    if (set) { set(prog.uni); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ---------- Each frame ---------- */
  // Keeps the walk smooth: if frames stay slow for 2 s, drop a quality step; if they stay quick
  // for 6 s, try one step back up.
  function adapt(dtMs) {
    if (dtMs > 250) { return; }   // a hidden tab or a pause, not a slow frame
    frameMs = frameMs * 0.95 + dtMs * 0.05;
    if (frameMs > 30) { slowT += dtMs; fastT = 0; } else if (frameMs < 19) { fastT += dtMs; slowT = 0; } else { slowT = fastT = 0; }
    if (slowT > 2000 && quality > 0) { quality--; slowT = 0; }
    if (fastT > 6000 && quality < 2) { quality++; fastT = 0; }
  }
  // source: the p5 canvas; sun: the sun on screen in CSS pixels; dev, smog: 0..1.
  function apply(source, opt) {
    if (!enabled || failed) { return false; }
    if (!ready) { init(); if (failed) { return false; } }
    adapt(opt.dtMs || 16);
    const t0 = performance.now();
    resize(source.width, source.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const aspect = w / h, dev = opt.dev || 0, smog = opt.smog || 0;
    const bloomOn = quality >= 1, raysOn = quality >= 2 && opt.sun;
    if (bloomOn || raysOn) {
      pass(programs.bright, targets.bright, [['uTex', sceneTex]], u => gl.uniform1f(u.uThreshold, 0.86));
    }
    if (bloomOn) {
      pass(programs.blur, targets.ping, [['uTex', targets.bright.tex]], u => gl.uniform2f(u.uStep, 1.6 / qw, 0));
      pass(programs.blur, targets.pong, [['uTex', targets.ping.tex]], u => gl.uniform2f(u.uStep, 0, 1.6 / qh));
    }
    if (raysOn) {
      const sx = opt.sun.x / opt.cssW, sy = 1 - opt.sun.y / opt.cssH;
      pass(programs.rays, targets.rays, [['uTex', sceneTex]], u => { gl.uniform2f(u.uSun, sx, sy); gl.uniform1f(u.uAspect, aspect); });
    }
    // Light rays shine through the forest; smog and a built-up street swallow them.
    const raysK = raysOn ? (opt.sunK === undefined ? 1 : opt.sunK) * (1 - 0.6 * dev) * (1 - 0.85 * smog) * 0.55 : 0;
    pass(programs.comp, null, [['uScene', sceneTex], ['uBloom', bloomOn ? targets.pong.tex : sceneTex], ['uRays', targets.rays.tex]], u => {
      gl.uniform1f(u.uBloomK, bloomOn ? 0.22 - 0.08 * smog : 0); gl.uniform1f(u.uRaysK, raysK);
      gl.uniform1f(u.uDev, dev); gl.uniform1f(u.uSmog, smog); gl.uniform1f(u.uTime, opt.time || 0); gl.uniform1f(u.uAspect, aspect);
    });
    // Copy the result back onto the 2D canvas, under the HUD that is drawn next.
    const c2d = source.getContext('2d');
    c2d.save(); c2d.setTransform(1, 0, 0, 1, 0, 0); c2d.globalCompositeOperation = 'copy'; c2d.drawImage(glCanvas, 0, 0); c2d.restore();
    gpuMs = gpuMs * 0.9 + (performance.now() - t0) * 0.1;
    return true;
  }

  return {
    apply,
    toggle() { enabled = !enabled; return enabled; },
    get enabled() { return enabled && !failed; },
    stats() { return { on: enabled && !failed, quality: ['grade', 'grade + bloom', 'grade + bloom + rays'][quality], frameMs, fxMs: gpuMs, failed }; }
  };
})();
