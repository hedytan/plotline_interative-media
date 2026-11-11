# We Build Our World: Code Walkthrough, Section by Section
# 代码逐段解说（英文 + 中文）

**How to use this guide / 怎么用这份文件**
- Every section of the code is explained in English, the way you can say it to your tutor, followed by a Chinese explanation. 每一段代码先用英文解释（可以直接对老师说），再用中文说明。
- Line numbers refer to `sketch-all.js` (the one-file version in `we-build-our-world-code.zip`). In the p5 editor, press Cmd+F and search the function name. 行号对应 zip 里的 `sketch-all.js`，在 p5 编辑器里用 Cmd+F 搜函数名最快。
- Each section has three parts: **What it does**, **How it works**, **Why I did it this way**. Teachers usually ask the "why". 每段分三部分：做什么、怎么做、为什么这样做。老师最常问的是"为什么"。

---

## 0. The big picture / 整体结构

**English:**
The code is four files, each with one job, and they load in this order:

| File | Lines in sketch-all.js | Job |
|---|---|---|
| `sound.js` | 5 – 256 | Everything you hear, synthesised live with Web Audio |
| `forest.js` | 258 – 366 | Paints 12 tree pictures once, then draws them in the street |
| `sketch.js` | 368 – 1593 | The street engine: camera, perspective, generating and drawing the street |
| `world.js` | 1595 – 2208 | The artwork's rules: cutting, building, hands, walking, score, endings |

The most important design decision is that **the engine and the artwork are separate**. `sketch.js` only knows how to draw a street. At fixed moments it calls named functions ("hooks") in `world.js`, such as `worldUpdate` every frame, `lotRise` to ask how tall a building is, and `drawHud` to draw the scoreboard. That is why I could change the whole concept from Monopoly to the forest without rewriting the engine.

**中文：**
四个文件各做一件事。最重要的设计是**引擎和作品规则分开**：`sketch.js` 只会画街道，在固定时刻呼叫 `world.js` 里有名字的函数（hook）。所以我从 Monopoly 换成森林的时候，引擎几乎不用改。

**Why / 为什么：** "Separation of concerns. If the drawing code and the rules are mixed together, every change breaks something else. With hooks, each file can be read and changed on its own." 关注点分离：画图和规则混在一起，改一个地方就会弄坏别的地方。

---

# PART A: sound.js — everything you hear (lines 5–266)
# 第一部分：sound.js，所有的声音

### A1. Header and music styles (lines 5–22)

**What it does:** Describes the sound design and defines the three kinds of music: `forest` (strings and harp, 72 bpm), `town` (pop, 108 bpm) and `city` (house beat, 122 bpm). Each has four chords written as MIDI note numbers. `MIDI(n)` turns a note number into a frequency: `440 * 2^((n − 69) / 12)`.

**Why:** "The music tells the same story as the picture: as the street fills, the music changes from forest to town to city. Writing chords as MIDI numbers is how musicians think, and one formula turns them into frequencies."

**中文：** 定义三种音乐（森林、小镇、城市）和每种的和弦。`MIDI()` 把音符编号换成频率，这是标准的乐理公式（A4 = 440 Hz）。音乐和画面讲同一个故事：街越满，音乐越像城市。

### A2. The constructor and switching on/off (lines 24–42)

**What it does:** `constructor` sets the starting values: sound off, no audio context yet, voice counters, music starts as `forest`. `start()` turns sound on, `toggle()` is the M key, and `_sync()` resumes or suspends the audio when the tab is hidden.

**How:** Browsers do not allow sound until the user clicks or presses a key, so `start()` is called from the first click (`beginSound` in sketch.js). The audio graph is only built at that moment.

**Why:** "Browsers block audio until the user interacts, so I build the sound system on the first click. And when you switch tabs, the sound fades out and the audio context is suspended to save CPU."

**中文：** 浏览器规定用户点击之前不能出声，所以第一次点击时才建立声音系统。切换分页时声音会淡出并暂停，节省电脑资源。

### A3. The sound graph: `_build()` (lines 44–88)

**What it does:** Builds the audio "wiring":
- `master` volume → a **compressor** (stops loud moments from clipping) → the speakers;
- a 3-second **white noise buffer**, reused for wind, leaves, footsteps, the axe;
- `hum` (traffic, low-pass noise) and `air` (a soft breeze);
- `music` and `styleGain`: every music note goes through these, so the band can be faded as a whole;
- `lifeFilter`: a low-pass filter for the sounds inside homes, so they sound "through the wall";
- `wind` and `leaves`: noise beds that start silent and are faded in by `update()`.

`_noiseBed` makes a looping, filtered noise and returns its volume knob. `_note` plays one synth note with an envelope (quick rise, slow fade). `_burst` plays one short noise hit. `_ok` checks there are not too many voices at once.

**Why:** "Web Audio works like a mixing desk: sources go through filters and volume controls to the output. I made one noise buffer and reuse it everywhere, because filtering the same noise differently gives wind, leaves, footsteps and the axe. A voice limit keeps it from overloading."

**中文：** 这里建立"音响接线"：主音量 → 压缩器 → 喇叭。白噪音只做一次，用不同的滤波器就能变成风声、树叶、脚步、斧头。有声部上限，避免同时太多声音造成卡顿。

### A4. Sounds of the street (lines 89–202)

| Method | What it sounds like | How it is made |
|---|---|---|
| `footstep(pace)` | A scuff and a thud | Two noise bursts; brighter when you run |
| `go()` | The ending chime | Five rising triangle-wave notes |
| `life(kind)` | Kids, dog, piano, TV, talk, baby, cooking, radio | Short oscillator tones and noise hisses, through `lifeFilter`; returns how long it lasts |
| `chop(side)` | Axe bite, wood cracking, a creak, the tree crashing down | Noise bursts at different filters, a sawtooth creak, low "thumps" whose pitch drops; panned left or right |
| `flutter(side)` | Birds taking off | 14 tiny noise flaps and 3 high chirps |
| `floorUp(i, n)` | A heavy "dun" for each floor | A low tone sliding down, higher for each floor |
| `built(tower)` | Finished: a thump and a chord | Bright major chord for homes, cold glassy chord for towers |
| `_m`, `_hit`, `_kick` | Music notes, hi-hats/claps, kick drum | The band's building blocks |

**Why:** "There are no sound files at all. Every sound is a recipe: an oscillator for pitch, filtered noise for texture, and an envelope for shape. The axe pans to the side you chop, so the sound tells you where it happened. Homes and towers finish with different chords: a home sounds warm, a tower sounds cold."

**中文：** 所有声音都是"配方"，没有录音：振荡器给音高，滤过的噪音给质感，包络给形状。斧头声会偏向你砍的那一边。住宅建好是温暖的和弦，高楼是冷冷的和弦。

### A5. Every frame: the mix follows the street (lines 203–266)

**What it does:** `update()` runs every frame:
1. `devK` (0 = all forest, 1 = all built, set by sketch.js) is smoothed into `devSmooth`.
2. It picks the next style: under 0.3 → forest, under 0.65 → town, else city.
3. `wild = 1 − dev`: wind and leaves get quieter, **birds chirp with probability 0.05 × wild²**, so they disappear quickly as you build. At the end, birds stay if you built nothing, a few remain if you built a little, none after a city.
4. The traffic hum and the band get louder as `dev` rises.
5. **Stop and listen**: when you stand still (`listenK`), the band fades and the homes' sounds come through clearly.
6. **Look-ahead scheduling**: `while (this.nextAt < now + 0.15) this._play(this.nextAt)` puts notes on the audio clock 0.15 s in advance.

`_play(t)` plays one eighth note of the current style. The style only changes **at the end of a bar**: the band dips, swaps and comes back.

**Why:** "The audio clock is more precise than the drawing loop. If I played notes when a frame is drawn, the rhythm would wobble whenever a frame is slow. Scheduling slightly ahead keeps the beat steady. Changing style only at the end of a bar makes the change sound musical, not like a glitch."

**中文：** 每帧根据"发展程度"调整：风和鸟越来越少（鸟出现的机率是 (1−发展)²，所以消失得很快），车声和音乐越来越大。音符提前 0.15 秒排进音频时钟，画面卡一下节奏也不会乱。音乐只在小节结束时换风格，听起来自然。站着不动时，音乐变小，房子里的声音变清楚。

---

# PART B: forest.js — the painted forest (lines 268–376)
# 第二部分：forest.js，程序画的森林

### B1. `makeForest()` (lines 277–360)

**What it does:** Runs once in `setup`. It paints **12 tree pictures (sprites)** on hidden canvases: 4 broadleaf trees (green, deep, autumn, gold), 2 poplars, 2 gums, 2 pines, 2 bushes.

**How:**
- `grow(kind, seed, palette, options)` draws one tree on a 900 × 900 canvas with a seeded random generator.
- **Recursive branches** (`branch`): each branch draws a slightly curved line, then calls itself 2–3 times with shorter (×0.7–0.82) and thinner (×0.66) branches at spread-out angles, until it is deep enough or too short. Options like `up` bend branches upward (poplars) and `lean` tilts the trunk (gums).
- **Leaf dabs**: around every branch tip it scatters 20–30 small ellipses. Each dab gets a `light` value from its position in the crown (top and the sun side are brighter). Dabs are **sorted dark to light** and painted in that order, so the lit leaves sit on top and the crown looks round.
- Pines fill tiered cones with 1,400 dabs; bushes fill a low dome.
- The tree is cropped and shrunk into a 260 × 420 sprite; `g.top` remembers how much of the sprite is tree, so it can be drawn at its real height.

**Why:** "Painting a tree with hundreds of dabs is expensive, so I do it once at the start and reuse the picture thousands of times. Recursion is natural for trees: a branch is a smaller tree. Painting dark leaves first and light leaves last is how a painter builds volume."

**中文：** 开场时用递归画 12 张树的图：一根树枝分出 2–3 根更短更细的树枝，一直分下去。树枝末端点上几百笔小叶子，按亮度从暗到亮画，亮的盖在上面，树冠就有立体感。只画一次，之后重复使用，因为每帧重画会太慢。

### B2. `hazeSprite` and `drawBrushTree` (lines 361–376)

**What it does:** `drawBrushTree(q, kind, tone, h, z)` draws one tree at a ground point `q`: picks a sprite from the kind by `tone`, scales it to its height in metres times `q.k` (the perspective scale), draws a soft shadow ellipse, and for distant trees draws a **haze-coloured silhouette** (`hazeSprite`, made once per sprite and cached) on top, so far trees fade into the air.

**Why:** "Distant objects look paler because of the air between you and them. That's called atmospheric perspective. I make a haze-coloured copy of each tree once and fade it in with distance."

**中文：** 按距离缩放树的图，加上影子。远的树会盖一层雾色的剪影，这叫"空气透视"：越远的东西越淡、越接近空气的颜色。雾色剪影每张只做一次，存起来用。

---

# PART C: sketch.js — the street engine (lines 378–1603)
# 第三部分：sketch.js，街道引擎

### C1. Settings (lines 387–400)

**What it does:** All sizes are in **real metres**: eye height 1.6 m, road half-width 4.2 m, pavement 3.4 m, so buildings start 7.6 m from the centre (`EDGE_X`). A block is 48 m (`CHUNK_LEN`), a crossing 10 m, you see 230 m ahead (`FAR_Z`). Speeds: stroll 3, walk 4.5, run 9 m/s. Buildings appear within 36 m and rise in 2.4 s. `PALETTE` and `SHOP_NAMES`.

**Why:** "Using real-world units makes the street feel right: a 1.6 m eye height and a 4.5 m/s walk feel like a person walking, and every building size is believable."

**中文：** 全部用真实的公尺：眼睛 1.6 米、走路每秒 4.5 米。用真实单位，街道和建筑的比例看起来才对，像一个真人在走路。

### C2. State (lines 401–413)

**What it does:** The variables that change while you play: the `seed`, how far you have walked (`distanceWalked`), the clock (`clockT`), your speed, the step phase and head bob, where you look (`lookYaw`, `lookPitch`), `night`, the `chunks` map (the blocks in view), the camera object `cam`, `riseK` (vertical scale while a building rises), and the look-back values (`backT`, `backWant`, `mirrorView`).

**中文：** 游戏进行中会变化的资料：走了多远、时间、速度、视线方向、目前有哪些街区、摄像机、回头看的进度。

### C3. Keys (lines 414–421)

**What it does:** Keeps a `Set` of keys that are held down, from the browser's own `keydown`/`keyup` events, and clears it if the window loses focus. `held('KeyW')` asks if a key is down.

**Why:** "p5.js 2.x changed how `keyIsDown` works, so I track keys myself. The sketch works the same in p5.js 1.x and 2.x. Clearing the set on blur stops you walking forever if you switch windows while holding a key."

**中文：** 自己记录哪些键被按住，这样 p5.js 1.x 和 2.x 都能用。视窗失去焦点时清空，避免切换视窗时角色一直走。

### C4. Small helpers (lines 422–429)

**What it does:**
- `rngN(seed)`: a **seeded random number generator** (a linear congruential generator: `x = x × 1664525 + 1013904223`). The same seed always gives the same sequence.
- `mixN` (blend two numbers), `easeN` (smoothstep, a soft 0→1 curve), `modN` (modulo that works for negative numbers), `pickN` (pick from a list), `midN` (midpoint).

**Why:** "`Math.random()` gives different numbers every time. With a seed, the same block of street always comes out the same, so when you look back the street is exactly as you left it, and nothing has to be stored."

**中文：** `rngN` 是带种子的随机数：同一个种子永远产生一样的数字。所以回头看的时候街道还是原来那样，也不用存任何资料。

### C5. Colours (lines 430–457)

**What it does:**
- `rgbOf(col)`: parses a colour string like `'#8b5a2b'` **once** into `[r, g, b]` and caches it in a `Map`.
- `shadeN` (darker/lighter), `mixHex` (blend two colours), `rgbaN` (add transparency) do plain arithmetic on those numbers.
- `hazeHex()`: the colour of the distant air; it depends on night and smog, so it is recalculated only when those change.
- `fogFor(z)`: how foggy a point is: none within 40 m, up to 85% at 230 m.
- `toneN(col, z, k)`: **every colour in the street goes through this**: shade it, mix in a little night, then mix in the haze by distance.

**Why (performance):** "I profiled the sketch and found that almost half of each frame was spent turning colour strings into p5 colour objects, thousands of times a frame. Caching the parsed numbers and blending them with arithmetic made each frame twice as fast, 9.1 ms down to 4.7 ms, with an identical picture."

**中文：** 每个颜色都要经过 `toneN`（调明暗、加夜色、加雾）。原本每次都重新解析颜色字串，占了每帧快一半的时间。改成每个颜色只解析一次、存起来，之后直接用数字计算，每帧快了一倍（9.1 → 4.7 毫秒），画面完全一样。

### C6. Setup (lines 458–474)

**What it does:** `setup()` makes a full-window canvas (pixel density capped at 1.5 for speed), gives it an accessible `aria-label` describing the piece and controls, creates `WorldSound`, makes a film-grain texture, builds the distant skyline, and calls `makeForest()`. `buildSkyline()` makes 46 seeded skyline towers.

**Why:** "Pixel density is capped so it stays smooth on high-resolution screens. The aria-label lets a screen reader describe the artwork and its controls."

**中文：** 建立画布、声音、底片颗粒、远方城市剪影，并画好森林。像素密度最多 1.5 倍以保持流畅；`aria-label` 让读屏软件能说明这个作品，属于无障碍设计。

### C7. Camera: perspective and clipping (lines 475–514) — the core
### 摄像机：透视（最核心）

**What it does:** `P(x, y, z)` turns a point in the world (metres) into a point on the screen:
```js
const dx = x - cam.x, dz = z - cam.z, c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
const rz = dx * s + dz * c, rx = dx * c - dz * s;      // rotate by where you look
const ry = cam.eye - y * riseK;                          // height relative to your eye
return { x: cam.cx + rx * cam.f / rz, y: cam.hy + ry * cam.f / rz, rz, k: cam.f / rz };
```
1. Subtract the camera position.
2. Rotate by the head direction (`yaw`).
3. **Divide by the distance `rz`**: far things get smaller and move towards the horizon. `k = f / rz` is "pixels per metre" at that distance.

`clipNear` cuts any polygon at 0.25 m in front of the eye, so shapes that reach behind you don't flip across the screen. `polyN` fills a polygon; `wallQuad` makes the four corners of a vertical wall; `segN` draws a line; `clipZ` keeps a wall's near edge in front of you.

**Why:** "I wrote my own perspective camera instead of using WEBGL. I tried WEBGL first and it looked like a game engine. With my own projection on a flat canvas I can paint every shape and tree like an illustration, and still walk through it in 3D. Dividing by distance is the basic maths of perspective drawing."

**中文：** `P()` 是整个作品最核心的函数：减去摄像机位置 → 按转头角度旋转 → **除以距离**。远的东西除以大数字就变小、靠近地平线，这就是透视。`clipNear` 把跑到你身后的形状切掉，避免画面出现乱线。我先试过 WEBGL，但看起来像游戏引擎；自己写透视，才能做出插画般的手绘感。

### C8. The street: 48 m blocks from a seed (lines 515–553)

**What it does:** `chunkAt(c)` returns block number `c`, making it the first time it is needed:
- picks its plan slot (the plan of 10 blocks repeats) and makes a random generator from `seed + slot × 7919 + STREET_SEED × 104729` (big primes so seeds don't overlap);
- on each side, lines up lots (`makeLot`) until the block is full, each with a random length and a small gap;
- adds a taller **back row** visible through the cross streets;
- adds **lamps** every 12 m and **street trees** every 9 m;
- calls the hooks `plotsForChunk` and `addResidents` in world.js.

`makeLot(tier, side, z, len, r)` gives a lot its height, depth, colours and details by **tier** (0 small shop, 1 terrace, 2 mansion, 3 brick/glass offices, 4 skyscraper).

**Why:** "The street is endless, but only the blocks you can see exist. Blocks are made as you approach and deleted when they are far behind, so memory stays small. Because each block comes from a seed, it is the same every time it is made."

**中文：** 街道切成 48 米一段，你走近才生成，走远就删除，所以街道无限长、记忆体却很小。每段都由种子生成，重新生成时一模一样。tier 是建筑的大小等级：0 小店、1 排屋、2 豪宅、3 办公楼、4 摩天楼。

### C9. Every frame: `draw()` (lines 554–626)

**What it does:** Runs about 60 times a second:
1. **Input → target speed**: Up/W walks, Shift runs, Down goes back, Enter auto-walks. With no key, `bodySpeed()` from the camera (walking on the spot). While a card is up or you are turning round, you stand still.
2. **Smooth speed**: `lerp(stepSpeed, target, 1 − e^(−dt·4.5))` gives inertia that doesn't depend on frame rate.
3. **Steps and head bob**: `stepPhase` advances with speed; each whole step plays a footstep and the camera bobs and sways slightly.
4. **Looking**: the mouse turns your head; when you stand still (`stillT`) you can turn much further (±0.3 → ±1.2 rad).
5. **Camera** values are set (position, yaw, eye height with bob, horizon).
6. **Blocks**: make the blocks in view, keep some behind for looking back, delete the rest.
7. `updateLandmarks` and `worldUpdate` (the rules).
8. **How built-up is it?** Share of built lots within 60 m → `sound.devK`.
9. **Draw**: sky → skyline → ground → street → grey wash, inside `try/catch` so one bad shape can never freeze the sketch. A short dark **blink** hides the moment the look-back view swaps.
10. `drawOverlays` (vignette, grain, HUD).

**Why:** "Using `1 − e^(−dt·k)` for smoothing makes the motion the same at 30 or 120 frames per second. The try/catch is a safety net: in a live installation, a single drawing error must never freeze the screen."

**中文：** 每帧：读输入 → 平滑速度（用指数公式，所以快慢电脑都一样）→ 脚步和镜头晃动 → 视线 → 生成/删除街区 → 执行规则 → 计算发展程度 → 画画面。画画面包在 try/catch 里，展示时就算一个形状出错，画面也不会卡住。

### C10. Looking back: `drawMirrored()` (lines 610–626)

**What it does:** Pressing C turns you round in 1.1 s. The first half really rotates the camera (up to 90°). The second half draws the street behind you **mirrored so it lies ahead**: `z' = 2A − z`, `x' = −x`, where A is a block boundary. Each block, lot and prop is wrapped with `Object.create`, so only its position changes and everything else (cut, built, height) reads through. Afterwards the real blocks and camera are restored (`finally`).

**Why:** "My drawing code only draws what is in front of the camera. Instead of rewriting it, I mirror the street behind you so it's in front: that's a half turn. A dark blink hides the swap. Looking back matters to the concept: you see the forest you replaced."

**中文：** 我的画图程序只会画前面的东西，所以回头时把身后的街"镜像"到前面来画（z 变 2A−z，x 变 −x，等于转 180 度），用一下暗暗的眨眼遮住切换。回头看对概念很重要：你会看到你取代掉的森林。

### C11. Things appearing (lines 627–646)

**What it does:**
- `riseOf(born)`: an **ease-out-back** curve over 2.4 s: the building rises, overshoots a little and settles, like it lands.
- `birthDelay`: a small random delay so things don't all pop up at once.
- `updateLandmarks`: a back row appears only when every lot in front of it is built; lamps, trees and people appear only when there are buildings near them (`propWaits`).

**Why:** "Nobody lives in a forest. Street lamps and people only arrive with the buildings, so building a home visibly brings the city with it."

**中文：** 建筑升起用"超过一点再回来"的缓动曲线，有落地的感觉。路灯、行人要等附近有建筑才出现：森林里没有人住，盖房子才会把城市带进来。

### C12. Sky and skyline (lines 647–712)

**What it does:**
- `skyColors()`: four sky colours, mixed towards dusk with `night` and towards grey with **smog**.
- `drawSky()`: a vertical gradient, a sun glow behind the landmark (dimmer with smog, `'lighter'` blend), and 9 soft clouds made of overlapping radial gradients, drifting slowly and turning grey with smog.
- `drawSkyline()`: the distant city (46 towers with lit windows) and a stepped art-deco landmark at the end of the street, then a golden haze over the horizon. Positions use `Math.tan(angle − yaw)`, so the skyline turns with your head but never comes closer.

**Why:** "The sky is the clearest signal of consequence. Every building adds smog, so the golden sky slowly turns grey. The city on the horizon is always out of reach: you keep walking towards it."

**中文：** 天空颜色会被烟雾慢慢染灰，太阳也变暗，这是最明显的后果。远方的城市永远走不到，只会跟着你转头。

### C13. Ground (lines 713–745)

**What it does:** `drawGround(z)` draws the road in 90 strips from far to near, with strips getting longer further away (`(i/steps)^2.2`). For each strip: the road, the cross streets at crossings, pavement tiles, a grey kerb and a pink band, the green verge, the centre line and zebra crossings. Each strip is fogged by distance.

**Why:** "Near the camera you need small strips for detail; far away one long strip covers many metres. Spacing them by a power curve gives detail where you look and saves work where you don't."

**中文：** 路面从远到近分 90 条画，近处的条小（细节多），远处的条长（省工），用次方曲线分配。

### C14. The street, far to near (lines 746–856)

**What it does:** `drawWorld(z)`:
1. **Back rows** far to near: as forest until they rise, then buildings.
2. **Lots** far to near (the **painter's algorithm**): for each lot, `lotRise(L)` says how built it is (0 forest → 1 built).
   - not built: forest floor (`drawPlot`) and the forest (`drawForest`);
   - being cut: trees fall away from the road and fade, leaving stumps;
   - rising: the trees sink, the building rises (`riseK` scales its height), dust puffs (`drawDust`).
3. **Props and yards** sorted by distance: lamps, trees, people, mansion yards.
4. `drawBirds()`.

`drawForest(L, k, ...)` places 3 rows of trees per lot from the lot's seed (30% broadleaf, 22% pine, 15% poplar, 17% gum, 16% bush) and draws them far to near. `drawBack` draws the back rows as several buildings with windows.

**Why:** "Canvas 2D has no depth buffer, so I sort everything by distance and draw the far things first; near things simply paint over them, like a painter working from background to foreground."

**中文：** Canvas 2D 没有深度判断，所以所有东西按距离排序，先画远的再画近的，近的自然盖住远的，这叫"画家算法"。每块地还没建就是三排树；被砍时树倒下、留下树桩；建造时树往下沉、楼往上升。

### C15. A building's walls and surface (lines 857–1008)

**What it does:** `drawLot(L)` draws one building:
- open lots (car park, petrol, substation) skip the box;
- the **street facade** with a gradient (lit by the low sun at the far end of the street) and the **near end wall** darker with a warm rim light;
- `drawMaterial` (weatherboards, brick courses or render), then the building's own details (by tier or style), then `drawWeathering` (damp at the foot, shadow under the eaves, a shadow on the ground);
- `paintSlogan` (a hand-painted slogan) and, on empty towers, a sign "FORMERLY FOREST".

Helpers: `facadeWindows` (a grid of windows, some lit, with sills and bars), `facadeSign` (text mapped onto the wall in perspective), `glassFill` (sky reflections), `roofCourses` (roof tiles), `wallMaterial` (which material a building gets).

**Why:** "Small details make a flat shape feel real: light on one side, damp at the bottom of a wall, bars in the windows. Text on the walls is drawn with an affine transform so it lies flat on the wall in perspective."

**中文：** 一栋楼的画法：街面的墙有光线渐层，靠近你的那面比较暗、顶边有暖色轮廓光；再加材质（木板、砖、抹灰）、窗户、风化痕迹（墙脚潮湿、屋檐阴影）。墙上的字用仿射变换贴上去，所以会跟着透视。

### C16. Buildings by tier (lines 1009–1091)

`drawShack` (tier 0: patched boards, crooked roof, flickering sign), `drawTownhouse` (tier 1: shop window, striped awning, cornice), `drawMansion` + `drawYard` (tier 2: columns, mansard roof, hedge, iron fence, fountain), `drawBrick` (tier 3: glowing storefront, neon sign), `drawTower` (tier 4: glass curtain wall with a gold reflection, mullions, crown and spire).

**中文：** 五种基本大小等级的建筑：小店、排屋、豪宅（有花园和喷水池）、砖造办公楼、玻璃摩天楼。

### C17. Buildings by style (lines 1092–1129)

**What it does:** `styleLot(L, style, r)` gives a lot the size and colours of a named style (cabin, cinema, factory...), using `STYLES_LOT` from world.js. `drawStyled` picks the function that draws that style.

**Why:** "A table of styles plus one drawing function per style means adding a new building is one entry and one function, without touching the rest."

**中文：** 风格表加上每种风格一个函数：新增一种建筑只要加一行设定和一个函数，不用改其他地方。

### C18–C20. Homes, shops, industry (lines 1130–1564)

| Group | Functions | Details |
|---|---|---|
| Homes | `drawBungalow`, `drawCabin`, `drawCaravan`, `drawCanal`, `drawModern`, `drawVilla`, `drawApartment`, `drawGreenCondo` | Bungalow porch and door; log cabin with a deck, a steep A-frame roof and a smoking stove pipe; caravan; tall canal row houses with stepped gables; modern house with a glass ground floor; villa; flats with balconies, washing and air conditioners; a "vertical forest" condo with trees on every balcony |
| Shops | `drawDiner`, `drawPetrol`, `drawSupermarket`, `drawCinema`, `drawMall` | Retro diner with chrome walls, a red stripe and a neon sign; petrol pumps under a lit canopy; supermarket with a brand band and trolleys; cinema with a bulb marquee and a blade sign; mall with a glass atrium |
| Industry and towers | `drawCarpark` (+ `drawCarN` cars), `drawSubstation`, `drawFactory`, `drawPowerPlant`, `drawDataCentre`, `drawSlantTop` | Car park with bays and cars; substation behind a wire fence with a pylon; factory with a sawtooth roof and smoking chimneys; power station with steaming cooling towers; windowless data centre with fans and blinking lights; glass tower with a slanted glass roof and a red aircraft light |

**Why:** "There are 24 kinds of building in total, all drawn in code. Many of the names are ironic: the mall is 'Forest Plaza', the data centre 'Data Forest', the power station 'Greenpower Station'. They are named after what they replaced."

**中文：** 一共 24 种建筑，全部用程序画。很多名字是讽刺的：商场叫 "Forest Plaza"，数据中心叫 "Data Forest"，发电厂叫 "Greenpower Station"，都用被取代的东西来命名。

### C21. Street furniture and overlays (lines 1565–1586)

`drawLamp` (a post, a lamp head and a soft glow), `drawTree` (a broadleaf sprite). `drawOverlays` adds a **vignette** (dark corners), the **film grain**, then calls `drawHud` in world.js.

**Why:** "The vignette and grain make it feel like a painting or old film rather than a crisp game."

**中文：** 路灯、行道树。最后加暗角和底片颗粒，让画面像画或老电影，而不是锐利的游戏画面。

### C22. Input (lines 1587–1603)

**What it does:** `beginSound` starts audio once. `mousePressed` passes clicks to `worldClick` (closing cards), otherwise holding the mouse walks. `keyPressed` ignores repeated keys, starts sound, passes the key to `worldKey` first, then handles Enter (auto-walk), M (sound) and P (pause). Touch works like holding the mouse. `windowResized` resizes the canvas.

**Why:** "The engine handles only basic keys and asks the artwork first, so the artwork's keys never clash with the engine's."

**中文：** 先把按键交给作品（`worldKey`），作品不用的键才由引擎处理（Enter 自动走、M 声音、P 暂停）。手机触控等于按住滑鼠往前走。

---

# PART D: world.js — the artwork's rules (lines 1605–2416)
# 第四部分：world.js，作品的规则

### D1. The street plan and building styles (lines 1615–1645)

**What it does:** `STREET_PLAN`: 10 blocks that repeat; a word is a style (`'bungalow'`), a number a tier (1 = narrow high-street lots). The plan only decides **how the land is divided**: every lot starts as forest. `STREET_SEED = 3`. `STYLES_LOT`: 19 styles with tier, lot length and setback. `chunkStyle`/`chunkTier` read the plan.

**Why:** "Wide bungalow lots and narrow high-street lots give the land a rhythm, so a big hand can build a mall on a wide lot and a small shop on a narrow one."

**中文：** 街道规划只决定土地怎么分（宽的地、窄的地），所有地一开始都是森林。宽窄交错，宽的地才能盖商场、大房子。

### D2. State and words (lines 1646–1658)

Counters (`treesCut`, `builtCount`, `homesBuilt`, `shopsBuilt`, `towersBuilt`, `factoriesBuilt`), `ending`, `intro`, `toasts` (short messages) and `THOUGHTS` (a line every 10 buildings, like "Every city was a forest once."). `ART`: slogans painted on walls ("FORMERLY: FOREST", "NATURE, NOW WITH PARKING"). `VOID_NAMES`: names for empty towers ("FOREST VIEW APARTMENTS", "GREENWOOD TOWER (NO WOOD)").

**Why:** "The text is satirical and short. It doesn't explain; it comments, like graffiti."

**中文：** 计数器、提示讯息。墙上的标语和空楼的名字都是讽刺，不解释，只像涂鸦一样评论。

### D3. A new block (lines 1659–1682)

`plotsForChunk`: a front-garden tree for some bungalow lots, lower back rows behind low lots, and picks one wall per side for a slogan. `addResidents`: 12 people per block from a seed. `propWaits`: a lamp, tree or person waits until a building stands within 16 m.

**中文：** 新街区生成时：加前院的树、决定后排楼的高度、选一面墙写标语、放 12 个行人（要等附近有建筑才出现）。

### D4. Every frame (lines 1683–1697)

`worldUpdate(z)`: plays the homes' sounds (`houseLife`), processes the hands (`handUpdate`), smooths the NATURE → CITY bar (`devBar`), updates **smog**: `smogK → min(1, (builtCount + factoriesBuilt × 3) / 30)` (so ~30 buildings make full smog, and factories count three times), shows "Press T to turn round" after 6 buildings, and a thought every 10.

**Why:** "Smog is cumulative: it follows everything you have ever built, not just what is near you. Factories count three times, because industry pollutes more."

**中文：** 每帧更新：烟雾 =（建筑数 + 工厂数 × 3）÷ 30，累积不会消失；工厂算三倍，因为工业污染更重。盖到 6 栋提示可以按 T 回头看。

### D5. Cutting the forest (lines 1698–1738)

**What it does:**
- `treesOn(L)`: trees on a lot = 3 rows × one per 2.4 m.
- `chopForest(side)`: finds the nearest forest lot on that side within 45 m ahead, marks it cut (`cutT`), and **one swing clears two lots**. Adds to `treesCut`, releases birds, plays the axe and the flutter. If there is no forest left it says "Walk on to find more"; the first time it hints "Lift your hand to build".
- `spawnBirds`: 6–12 birds per lot (max 40), each with a velocity and gravity; `drawBirds` flaps their wings and fades them out after 2.2 s.

**Why:** "Cutting should feel too easy: one swing clears two whole lots of forest. The birds flying away are the forest's reaction."

**中文：** 一挥手就砍掉两块地的森林，故意做得"太容易"。鸟飞走是森林的反应。

### D6. Building, floor by floor (lines 1739–1948)

**What it does:**
- `makeBuilt(L, kind, level)`: hand shape (`home`/`shop`/`tower`) × height level (0/1/2) chooses a random building from a family. The tallest towers are made **vacant** and get a name from `VOID_NAMES`.
- `handLevel(s)`: hand height: low half of the picture → 0, chest to face → 1, above the head → 2.
- `handUpdate(dt)` every frame:
  - keys H / S / B (homes / shops / towers) lift like a hand, but **only on a side you have cut** (a key never clears forest itself; with nothing cut on either side it shows "Cut the forest first"). **Each press** (`keyTap` → `tapBuild`) adds floors at once to the 2 nearest cut lots: presses 1–2 small, 3–4 middle, 5 the biggest, then from the 7th about a floor per press (up to 1.6×); a bigger building never ends up lower than what is built; each lot's own size lean, taken in turn from a mixed tall/small pattern per side (`LEAN`, `lotBias` / `lotLevel`, for hands, held keys and presses) and `pace`, a ×0.8–1.25 height in `makeBuilt` and `recentLooks` (none of the last 5 looks, else the one used longest ago) keep a row from looking uniform; it tops out 0.7 s after the last press. Holding also grows it (hold < 0.6 s small, < 1.4 s middle, longer big);
  - each hand's lift goes to the **2 nearest cleared lots on its side**;
  - if nothing is cleared, a hand lift builds nothing (you always cut first) and a hint says which side to cut; `deliberateLift` ignores the 0.6 s after a chop and any rise under 6% of the picture;
  - reaching a higher level re-makes the building bigger but keeps the height already built;
  - growth = `lift × 3`, slightly slower for tall buildings, capped at 97% while lifting;
  - **0.25 s after you stop lifting it tops out by itself**.
- `growLot`: each new floor plays `floorUp`; at 100% it counts the building and plays `built`.
- `floorsOf` (2–16 floors, one per 3 m), `lotRise` (rises in **whole floors** with a small bump).
- `drawBuildSite` draws scaffolding (poles, planks, braces, a green net) and, beside buildings over 18 m, a turning tower crane (`drawCrane`), only while the building is going up, so both disappear the moment it is finished. A building also tops out 0.4 s after reaching its cap even if your hand keeps twitching upward (`L.capT`).

**Why:** "Building is a reach upward: the higher you lift, the bigger it gets. Greed is literally a gesture. Growing in whole floors with a sound for each makes it feel like construction, not a slider. Topping out on its own means a person doesn't have to hold their arm up for long."

**中文：** 手的形状决定盖什么，手的高度决定多大。手往上举，楼就一层一层长，每层"咚"一声；停手 0.25 秒楼自己封顶，手不用一直举着。没砍过的地会先自动砍，所以每次举手都有反应。最高的摩天楼是空的，取名 "Forest View Apartments"。

### D7. Your hands: webcam + ml5 handPose (lines 1949–2053)

**What it does:**
- `startHands()` (C key): loads ml5.js 1.0.1 from the web, opens the camera (320 × 240), starts `ml5.handPose({ maxHands: 2 })` and calls `gotHands` every time it sees hands. If anything fails, it tells you to use the keys.
- `gotHands(results)`: each hand has **21 landmarks**. Hands that ml5 is less than 60% sure about are skipped. The picture is **mirrored** (`1 − x`). Which hand is which comes from ml5's own **handedness** label; the sketch learns whether that label means your left or the picture's left only from both hands seen far apart at once (`handVote`, `sideOfLabel`), so after a few seconds your right hand always works the right side, even reaching across the middle. Until then: a hand still moving keeps its side (seen < 0.15 s ago, close by), and a hand that appears anew goes by its half of the picture. It also records each hand's box in the picture (`handBoxes`) for the walking detector.
- `handShape(at, wrist)`: each finger is read on its own: the distance from its **tip** to the wrist ÷ the distance from its **middle joint (PIP)** to the wrist. Above 1.18 the finger is straight, below 1.02 it is curled, in between unsure. Only the index straight (the others curled) → **point** (one finger, homes); three or more straight → **open** (shops); none straight and most curled → **fist** (towers); anything else → `null` (unclear, builds nothing).
- `handFeedSide(side, x, y, shape)`: a new shape only counts after it is seen **3 times in a row** (`cand`, `candN`); upward movement adds to `lift` (building); a **chop** is a sideways move of more than 18% of the picture within 0.4 s that is more sideways than vertical, with a 0.35 s pause between chops.
- `kindOf(shape)`: one finger → `home`, open → `shop`, fist → `tower`.

**Why:** "Comparing each fingertip with its own joint works near or far and tells a curled finger from a straight one more reliably than one palm-size ratio. Treating unclear shapes as nothing, and waiting for three frames in a row, stops a blurred frame from building the wrong thing. The 'more sideways than vertical' rule stops a lift being read as a chop. Keeping a hand's identity across the middle fixed my biggest bug: a swing across the centre used to be split into two half-swings."

**中文：** ml5 每只手给 21 个点。每根手指分开看：指尖到手腕 ÷ 中间关节到手腕，大于 1.18 是直的，小于 1.02 是弯的。只有食指直 = 一根手指（住宅），三根以上直 = 张开（商店），全部不直 = 拳头（高楼），看不清楚就不盖。新手形要连续认到 3 次才算。挥手要"横向多于纵向"才算砍，举手不会被误判。一只手挥过画面中间仍然算同一只手，这修好了我最大的 bug。

### D8. Your body: walking on the spot (lines 2054–2136)

**What it does:**
- `sampleMotion()` every 66 ms: shrinks the camera picture to **48 × 36 grey pixels**, compares it with the last one, counts pixels whose brightness changed by more than 20, **only in the middle columns** (your body, not your arms), and **skips every hand ml5 saw in the last 0.3 s, plus the arm below it** (a mask from `handBoxes`). If the hands hide almost all of the body, it keeps your pace. Walking only starts when 6 of the last 8 samples moved (`stepHist`, about half a second).
- **Calibration**: for the first 2 seconds you stand still; the average movement then is the noise baseline and is subtracted afterwards.
- `bodySpeed()`: movement under 0.04 → standing; up to 0.16 → walking speed; more → running.
- `drawHandPanel()`: the camera picture bottom right, lines for LOW/MID/TALL, your hands' trails, a STEPS meter and the calibration message.

**Why:** "This is computer vision without machine learning: frame differencing. It's cheap because the picture is tiny, and it only looks at the middle with the hands cut out, so hand gestures never start or stop walking: you can cut and build while you walk. Needing half a second of steady movement means one quick gesture can't move you. Calibration adapts to each room: light flicker or a fan behind you."

**中文：** 用"帧差法"（不是 AI）：画面缩成 48×36 灰阶，跟上一张比较有多少点在变，只看中间（身体），而且把手和手下面的手臂挖掉，所以可以边走边砍边盖；要连续动约半秒才开始走。开始时站 2 秒校准，量出房间本身的噪音再扣掉。右下角面板显示摄像头画面、手的轨迹和踏步量。

### D9. The sound of the homes (lines 2137–2167)

`lifeKind` picks a home's sound from its seed (small homes: dog, radio; big ones: piano, TV). `lived` is false for industry, car parks and empty towers. `houseLife` lets the 3 nearest lived-in homes within 24 m take turns, panned to where they are; standing still opens the filter so you can listen.

**Why:** "The buildings you make are lived in, and you can hear it if you stop. Empty towers are silent: that's part of the message."

**中文：** 附近 3 间有人住的房子轮流发出生活声，站着不动就听得清楚。空置的高楼没有声音，这也是想表达的。

### D10. Drawing on the street (lines 2168–2216)

`paintSlogan` paints a red marker slogan with a white edge and paint drips on one wall per side, fitted to one or two lines and mapped onto the wall in perspective. `drawPerson` draws a person with a shadow, legs, coat, head and sometimes a phone. `drawStreetLife` lays a 30% desaturating wash over the street.

**中文：** 墙上用红色马克笔写标语（有白边和往下流的颜料），跟着透视贴在墙上。画行人。整个画面盖一层 30% 去饱和，让颜色沉稳。

### D11. The HUD and the cards (lines 2217–2376)

- `drawHud()`: the scoreboard (TREES YOU CUT DOWN | BUILDINGS YOU BUILT, and the NATURE → CITY bar), messages, the NEXT bar, the music label, the camera panel, the opening card and the ending card.
- `nextText()`/`drawNextBar()`: one instruction at a time: build if there is cleared land, cut if there is forest, else "Walk on".
- `drawOpening()`: what the piece is, the four moves, and how to start.
- `drawReceipt()` + `snapStreet()`: the ending as a printed receipt. `snapStreet` copies the middle of the canvas (your street, just after you turn round) into a small canvas; `drawReceipt` draws a printer and a paper strip that slides out over 2.8 s (clipped below the slot, far end first) with THE WORLD YOU CREATED, the snapshot, the counts, PAID BY: THE FOREST, the ending's words and a barcode seeded from your counts; `sound.printer` buzzes while it prints.
- `endingCard()`: **three endings**: built nothing → THE FOREST STAYS; 5 or fewer → A LITTLE OF THE WORLD WE WANTED; more → THE WORLD WE WANTED.

**Why:** "The NEXT bar gives one instruction at a time, so nobody is lost but there is no manual. The ending answers what you actually did, so it never judges everyone the same way."

**中文：** 计分板、NEXT 提示（一次只给一个指示）、开场卡、结局卡。结局按你做的事情分三种，不会用同一种方式评判每个人。

### D12. Ending and starting again (lines 2377–2391)

`endWalk()` (F): sets the ending, plays the chime, dims the light a little, and **turns you round first** to see the street you made; the card fades in at 2.6 s. `restartWalk()` (R): a new seed, every count back to zero, the forest back, the opening card.

**中文：** 按 F：先让你转身看你建的街，再淡入结局卡。按 R：新的种子、全部归零、森林回来。

### D13. Keys and clicks (lines 2392–2416)

`worldKey(e)`: E/Space close the opening card, R restart, T turn round, F end/continue, C camera, X/D/→ cut right, Z/A/← cut left, H/S/B (held) build homes/shops/towers, `[`/`]` step sensitivity. `worldClick`: a click closes the opening card, or the end card after 4.5 s.

**中文：** 作品的按键和点击。

---

# PART E: Likely "why" questions, in one place
# 第五部分：老师最可能问的"为什么"

| Question | Short answer |
|---|---|
| Why Canvas 2D instead of WEBGL? | "I wanted a painted look. WEBGL looked like a game engine, so I wrote my own perspective camera." |
| Why a seeded random generator? | "So the endless street is consistent: look back and it's the same, with nothing stored." |
| Why ratios for the hand shape? | "So it works at any distance from the camera." |
| Why frame differencing for walking, not ML? | "It's fast and good enough: I only need how much the body moves. A 48 × 36 picture costs almost nothing." |
| Why calibrate? | "Every room has different noise: light flicker, a fan, a moving curtain." |
| Why build floor by floor? | "So it feels like construction, and greed is a reach upward." |
| Why do lamps and people wait for buildings? | "Nobody lives in a forest; building brings the city." |
| Why no score to win? | "A score would reward building more. The counter is a bill, not a score." |
| Why three endings? | "So the ending answers what you did. Choosing not to build is a choice too." |
| Why synthesise the sound? | "No files to load, and the sound can change smoothly with the street." |
| Why schedule music ahead? | "The audio clock is steadier than the drawing loop, so the beat never wobbles." |
| Why `try/catch` around drawing? | "In an installation, one bad shape must never freeze the screen." |
| How did you make it fast? | "I profiled it: colour parsing took half of each frame. Caching colours made it twice as fast." |
| How is the code organised? | "Four files with one job each. The engine and the rules talk through a few named hooks." |
