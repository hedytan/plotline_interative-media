# We Build Our World: Presentation Pack
# 演示完整准备：讲稿 + 代码导览 + 问答

Thursday 12 November 2026, 11:00 – 11:15, CB10.04.430, with Jacob Dawson-Daley.

**这份是在家练习用的，现场不能看。** 老师说用小卡片或手机看稿会让他们怀疑你不懂代码。所以：
- 讲稿不用背到一字不差，**记住每段要讲的重点和要示范的动作**就好；
- 每段最上面的 **🔑 记住** 是那一段一定要讲到的关键句；
- `[DO: ...]` 是你那时要在笔电上做的动作。

---

# PART 1: The speaking script (about 7 minutes, with the demo)
# 第一部分：讲稿（连示范约 7 分钟）

> **更专业的技术版讲稿在 `presentation-script.md`**（讲用了什么函数、库、摄像头、声音和画法，不讲按键）。正式练习请用那一份，这里的是简单版。

老师要的流程：**很短的介绍 → 讲一点、马上示范 → 简单说代码结构**。所以 slides 1–2 要快，slides 3–5 每页讲完马上做。

---

### Slide 1 — Title (20 seconds)

🔑 **记住：** 名字 + 一句话说它是什么。

> Hi, I'm Hedy. This is **We Build Our World**, an interactive generative landscape in p5.js. You walk down a street where everything is still forest, and you use your own hands to turn it into a city.

`[DO: 作品已经在另一个视窗跑着，停在开场卡片。]`

---

### Slide 2 — Every city was a forest once (40 seconds)

🔑 **记住：** "The meaning is in the gestures." 以及没有分数、没有对错。

> The idea is simple: every city was a forest once. You are the developer. Nothing stops you and nothing tells you you're wrong. There's no score to win. The piece just lets you build, and makes sure you notice what it costs.
>
> What unifies the concept and the code is that **the meaning is in the gestures**. Cutting the forest is one careless swing. Building is a reach upward. And the code makes the world answer every action.

---

### Slide 3 — Your body is the tool (about 2 minutes, mostly demo)

🔑 **记住：** 挥手 = 砍，往上举 = 盖，手形 = 种类（一根手指 = 住宅，张开 = 商店，拳头 = 高楼），高度 = 大小；可以边走边砍边盖。

> Let me show you. I press C to start the camera. It first asks me to stand still for two seconds, to calibrate.

`[DO: 切到作品，点画面关掉开场卡片，按 C，站着不动 2 秒。]`

> Each hand works its own side of the street. A quick sideways swing cuts the forest on that side.

`[DO: 左手往旁边挥，砍左边。]`

> You can hear the axe, and the birds fly out of the trees. Now I lift one finger: that builds homes, floor by floor, with scaffolding. The higher I reach, the bigger it gets.

`[DO: 右手举一根食指，慢慢往上举。]`

> An open hand builds shops, and a fist builds industry: car parks, factories, and empty towers called things like Forest View Apartments.

`[DO: 张开手举起盖商店；再握拳往上举到头顶，盖一栋高楼。]`

> I can also walk on the spot to move down the street, and keep cutting and building while I walk, because the walking detector ignores my hands. And everything has a keyboard key as a backup: Z and X cut, H, S and B build homes, shops and towers.

`[DO: 原地踏步，同时挥手砍、举手盖。如果摄像头不顺，马上改用 Z / X / H / S / B。]`

**如果手势认不到：**
> The camera depends on the light, so here's the keyboard. It does exactly the same thing.

---

### Slide 4 — The world answers back (about 1.5 minutes, mostly demo)

🔑 **记住：** 烟雾、鸟、声音；按 T 回头；按 F 结局会回应你做的事。

> As the street fills, the world answers. Every building adds smog, factories most of all, so the sky turns grey. The birdsong fades into traffic, and the music changes from strings and harp to pop to a city house beat. There's a NATURE to CITY bar at the top left.

`[DO: 用键盘快速多盖几栋（先砍，再连按 B 几下），让天空变灰、音乐变。]`

> At any time I can press T to turn round and look at what I've done.

`[DO: 按 T，停两秒，再按 T 转回来。]`

> When I decide I'm finished, I press F. I turn round one last time, and a little printer prints a receipt: THE WORLD YOU CREATED, a snapshot of my street, what I cut and built, and PAID BY: THE FOREST. It answers what I actually did: if I built nothing, it says the forest stays. If I built a city, it says the birds have stopped.

`[DO: 按 F，等卡片出现。然后再按 F 继续。]`

---

### Slide 5 — How it works: the code structure (about 1.5 minutes, show the code)

🔑 **记住：** 4 个文件、各做一件事；引擎用 hook 呼叫规则；三个核心函数。

> The code is four files, each with one job: `sound.js` for all the sound, `forest.js` for the painted trees, `sketch.js` is the street engine, and `world.js` holds the artwork's rules.
>
> The engine and the rules are separate. The engine only knows how to draw a street; it calls a few named hooks in `world.js`, like `worldUpdate` every frame or `lotRise` to ask how tall a building is. That's how I could change the whole concept from my earlier Monopoly version without rewriting the engine.

`[DO: 切到代码，照第二部分的"现场代码导览"讲三个函数。]`

> Everything is made in code: there are no images or sound files. And I profiled it: colour mixing took half of every frame, so I cached it, and now each frame is twice as fast.

---

### Slide 6 — Demo video (10 seconds, or skip)

> This is a 30-second recording of a full run, in case you'd like to see it again. I'm happy to take questions.

如果现场演示都很顺，**这页可以直接跳过**，说 "I'm happy to take questions." 就好。

---

### Reflection (about 3 minutes, no slides)

🔑 **记住：** 只讲领悟和以后的改进，不要从头讲流水账。

老师手上有你的 750 字。用这三点带他们走：

> **First: interaction bugs hide between the algorithm and a real body.** Chopping kept failing. The reason was that I assigned hands by which half of the picture they were in, so one hand swinging across the middle became two half-swings. I also learned not to change many thresholds at once: I tried a big rewrite, it felt worse, and I went back and re-applied only two small fixes. In future I'll test with a real camera and other people early, and change one thing at a time.
>
> **Second: removing features made it clearer.** My first version was a Monopoly street full of signs and rules, and my tutor said the meaning was unclear. When I cut it down to forest, clearing and building, the piece became calm and needed no reading. Next time I'll test whether people understand the core interaction before I add visual detail.
>
> **Third: meaningful and dependable are two different jobs.** A gesture has to say something, and it also has to respond every time. That's why every gesture has a keyboard fallback, and why a lift with no cleared land clears it first, so a gesture is never wasted.

最后一句可以说：
> Overall it reaches its main aim: the cost of building is felt, not read. What I still don't know is whether strangers read it the way I intend, so that's the next thing I'd test.

---

# PART 2: The live code tour (what to show in about 1 minute)
# 第二部分：现场代码导览（约 1 分钟）

老师可能会说 "show us how X works"。最好**在 VS Code 或 p5 编辑器里，开好这四个文件**。下面是建议依序秀给老师看的三个函数，以及要说的话。

### Stop 1: `P(x, y, z)` in sketch.js — the perspective camera

```js
const rz = dx * s + dz * c, rx = dx * c - dz * s;
return { x: cam.cx + rx * cam.f / rz, y: cam.hy + ry * cam.f / rz, ... };
```
> "This is the heart of the engine. Every point in the world, in metres, is moved relative to the camera, rotated by where I'm looking, and **divided by its distance**. That's perspective: far things get smaller and move towards the horizon. I wrote my own instead of using WEBGL because I wanted it to look painted."

中文：减去摄像机位置 → 按转头旋转 → 除以距离。

### Stop 2: `handShape` and `handFeedSide` in world.js — reading the hands

```js
const k = d(tip, wrist) / (d(pip, wrist) || 1); return k > 1.18 ? 'up' : k < 1.02 ? 'down' : '?';
...
if (up === 0 && down >= 3) { return 'fist'; }
if (i === 'up' && !rest.includes('up') && rest.filter(v => v === 'down').length >= 2) { return 'point'; }
if (up >= 3) { return 'open'; }
...
if (Math.abs(dx) > 0.18 && Math.abs(dx) > Math.abs(dy)) { chopForest(side); }
```
> "ml5 gives 21 points per hand. For each finger I compare the tip's distance to the wrist with the middle joint's distance: a straight finger reaches past the joint, a curled one folds back, so it works near or far. Only the index straight is one finger, for homes; three or more straight is an open hand, for shops; none straight is a fist, for towers. Anything unclear builds nothing, and a new shape must be seen three times in a row. A chop is a sideways move of more than 18% of the picture within 0.4 seconds, and it must be more sideways than vertical, so lifting never counts as chopping."

中文：每根手指比较指尖和中间关节到手腕的距离，判断直还是弯；只有食指直 = 住宅，三根以上直 = 商店，全部不直 = 高楼；看不清楚就不盖，连续 3 次才换。横向挥动够快、够大，而且横向多于纵向才算砍。

### Stop 3: `handUpdate` and `growLot` in world.js — building floor by floor

```js
growLot(L, lift * 3 * Math.pow(8 / Math.max(8, L.H), 0.3), 0.97);
```
> "Every frame, how much each hand moved up goes into the two nearest cleared lots on that side. The building grows a floor at a time, with a sound for each floor. How high my hand is picks the size. When I stop lifting, it tops out by itself after a quarter of a second, so you don't have to hold your arm up."

中文：举手的量变成楼的高度，一层一层长，停手 0.25 秒自己封顶。

**如果老师还想看更多**（按被问到的顺序找）：
- 街道怎么生成 → `chunkAt`（sketch.js）
- 走路怎么侦测 → `sampleMotion`（world.js）
- 颜色缓存（性能） → `rgbOf`、`toneN`（sketch.js）
- 回头看 → `drawMirrored`（sketch.js）
- 声音 → `update`、`chop`（sound.js）
- 结局 → `endingCard`、`drawReceipt`、`snapStreet`（world.js）

---

# PART 3: What is in my code (a full walkthrough)
# 第三部分：代码里有什么（完整导览）

### sound.js — everything you hear (about 250 lines)
所有声音，用 Web Audio 即时合成，没有声音档。

| Section | What it does | 中文 |
|---|---|---|
| Music styles | Three styles (forest, town, city), each with tempo and four chords as MIDI numbers | 三种音乐：森林、小镇、城市 |
| Switching on and off | `start` on the first click (browsers block sound before that), `toggle` for M | 第一次点击才开声音，M 开关 |
| The sound graph `_build` | Master volume → compressor → speakers; one white-noise buffer reused for wind, leaves, steps, axe; channels for the band and the homes | 音响接线；一份白噪音重复用 |
| Sounds of the street | `footstep`, `go` (end chime), `life` (kids, dog, piano, TV...), `chop` (axe, cracks, crash), `flutter` (birds), `floorUp` (one thud per floor), `built` (warm chord for homes, cold chord for towers) | 每种声音的"配方" |
| Every frame `update` | Follows how built-up the street is: wind and birds fade, traffic and band rise, style switches at the end of a bar, notes scheduled 0.15 s ahead | 每帧跟着街道变化，音符提前排程 |

### forest.js — the painted forest (about 110 lines)
| Function | What it does | 中文 |
|---|---|---|
| `makeForest` | Paints 12 tree sprites once: recursive branches, then hundreds of leaf dabs, painted dark to light | 递归画 12 种树，只画一次 |
| `hazeSprite` | A haze-coloured copy of each tree, so distant trees fade into the air | 远处的树变淡（空气透视） |
| `drawBrushTree` | Draws a tree at its real height with a shadow | 按距离画树 |

### sketch.js — the street engine (about 1230 lines)
| Section | What it does | 中文 |
|---|---|---|
| Settings | Real metres: eye 1.6 m, road, pavement, 48 m blocks, 230 m view, walk 4.5 m/s | 真实尺寸 |
| State, Keys | What changes while you play; held keys tracked from the browser (works in p5 1.x and 2.x) | 状态、按键 |
| Small helpers | `rngN` seeded random, easing, modulo | 带种子的随机数 |
| Colours | `rgbOf` cache, `toneN` (shade + night + distance fog) for every colour | 颜色缓存，快一倍 |
| Setup | Canvas, sound, film grain, skyline, forest | 初始化 |
| Camera | `P()` perspective, `clipNear` near-plane clipping, wall and polygon helpers | 透视（核心） |
| The street | `chunkAt` makes 48 m blocks from a seed; `makeLot` gives each lot size and colours by tier | 生成街区 |
| Every frame | `draw()`: input, speed, steps and head bob, looking, blocks, rules, draw; `drawMirrored` for looking back | 每一帧；回头看 |
| Things appearing | `riseOf` (rise with a little overshoot), lamps and people wait for buildings | 东西出现 |
| Sky and skyline | Gradient sky that greys with smog, clouds, sun glow, distant city and landmark | 天空变灰 |
| Ground | Road in 90 strips, pavements, kerb, zebra crossings | 马路 |
| The street, far to near | `drawWorld`: back rows, forest, falling trees, rising buildings, scaffolding and cranes, dust, props, birds (painter's algorithm) | 由远到近画 |
| A building | `drawLot`: walls with light, materials, windows, signs, weathering, slogans | 一栋楼的画法 |
| Buildings by tier / by style | 5 tiers + 19 styles = 24 kinds: homes, shops, industry and towers | 24 种建筑 |
| Street furniture, overlays | Lamps, trees, vignette, grain, then the HUD | 路灯、暗角、颗粒 |
| Input | Clicks and keys go to the artwork first (`worldClick`, `worldKey`), then Enter, M, P | 输入 |

### world.js — the artwork's rules (about 610 lines)
| Section | What it does | 中文 |
|---|---|---|
| Street plan and styles | 10-block plan (how land is divided); 19 building styles | 街道规划 |
| State and words | Counters; slogans (`ART`); empty-tower names (`VOID_NAMES`); thoughts every 10 buildings | 计数、标语 |
| A new block | Garden trees, back rows, a slogan wall, 12 people who wait for buildings | 新街区 |
| Every frame | `worldUpdate`: hands, homes' sounds, NATURE → CITY bar, smog = (buildings + factories × 3) / 30 | 每帧规则、烟雾 |
| Cutting the forest | `chopForest` clears 2 lots per swing, counts trees, releases birds | 砍树 |
| Building | `makeBuilt` (shape × height → building), `handUpdate`, `growLot`, `lotRise`, scaffolding and crane (`drawBuildSite`) | 一层一层盖 |
| Your hands | `startHands` (ml5), `gotHands` (side and hand boxes), `handShape` (one finger / open / fist), `handFeedSide` (steady shape, lift and chop), `kindOf` (shape to homes / shops / towers) | 手势 |
| Your body | `sampleMotion` (frame differencing, hands and arms masked out, about half a second of steady steps, calibration), `bodySpeed`, camera panel | 原地走路，可以边走边砍边盖 |
| Sound of the homes | Nearest 3 lived-in homes take turns; empty towers are silent | 房子的声音 |
| Drawing on the street | Painted slogans, people, a grey wash | 标语、行人 |
| HUD and cards | Scoreboard, NEXT bar, music label, opening card, three endings | 计分板、结局 |
| Ending, restart, keys | F ends (turn round first), R restarts, all the artwork's keys | 结束、重来、按键 |

更细的逐段解说在 `code-walkthrough.md`。

---

# PART 4: Questions the tutor will probably ask
# 第四部分：老师可能问的问题和回答

回答的原则：**先一句话直接回答，再补一个具体细节，必要时马上秀代码或示范。** 不知道的时候就诚实说，并讲你会怎么查。

## A. Concept / 概念

**Q1. What is the work about, in one sentence?**
> "Every city was a forest once: you use your own hands to turn a forest into a city, and the world shows you what that costs."

**Q2. What unifies your concept and your implementation?**
> "The meaning is in the gestures. Cutting is one careless swing, building is a reach upward, so greed is literally a gesture. And the code makes the world answer every action: birds leave, smog builds up, the music turns into a city."

**Q3. Why is there no score or win state?**
> "A score would reward building more, which is the opposite of the point. The receipt at the end isn't a score, it's a bill. You decide when it's enough."

**Q4. How does it fit "generative landscape"?**
> "The landscape is generated by rules: seeded blocks of street, recursive trees, random buildings. But the player is part of the generative system. You don't watch the landscape change; you are what changes it."

**Q5. Who is it for, and where would you show it?**
> "Anyone who's watched the forest at the edge of their town disappear. It works best as an installation: a big screen and a webcam, so you use your whole body. It also runs in any browser with the keyboard."

**Q6. Why did you change from Monopoly?**
> "My tutor said the meaning was unclear and the interaction should carry it. The Monopoly version explained itself with signs and rules. Here the gestures say it, and I could remove most of the text."

**Q7. Why three endings?**
> "So the ending answers what you actually did. If you build nothing, it says the forest stays: choosing not to build is a choice too. An ending that judges everyone the same would undermine that."

## B. Technical / 技术

**Q8. How does the 3D work without WEBGL?**
> "I wrote my own perspective function, `P`. Each point is moved relative to the camera, rotated by where you look, and divided by its distance. Then I sort everything far to near and draw it like a painter, so near things cover far things."

**Q9. Why not use WEBGL or Three.js?**
> "I tried a WEBGL version. It had real lighting, but it looked like a game engine. I wanted a painted, illustrated look, and drawing every shape myself in 2D gave me that control."

**Q10. What's the near-plane clipping for?**
> "When part of a shape is behind the camera, its distance becomes negative and it would flip across the screen. `clipNear` cuts every polygon just in front of the eye."

**Q11. How is the street generated, and why is it endless?**
> "It's made of 48-metre blocks. A block is only created when it comes into view and deleted when it's far behind, so it's endless but memory stays small. Each block comes from a seeded random generator, so it's the same every time."

**Q12. Why a seeded random generator instead of `Math.random`?**
> "With a seed, the same block always comes out the same. So when you turn round, the street behind you is exactly as it was, and I don't need to store anything."

**Q13. How do you detect the hand shape?**
> "ml5's handPose gives 21 landmarks per hand. For each finger I compare how far the tip is from the wrist with how far its middle joint is: straight fingers reach past the joint, curled ones fold back. Only the index straight is one finger, for homes; three or more straight is an open hand, for shops; none straight is a fist, for towers. It's a ratio, so it works near or far, and a shape has to be seen three times in a row before it counts."

**Q14. How do you detect a chop, and how do you stop a lift being read as a chop?**
> "I keep the last 0.4 seconds of each hand's positions. A chop is a sideways move of more than 18% of the picture, and it has to be more sideways than vertical. That last rule is what stops a lift from chopping."

**Q15. How do you know which hand is which?**
> "ml5 labels each hand Left or Right, but what that label means depends on the camera, so the sketch learns it while you play: a hand seen clearly on one side of the mirrored picture is a vote. Once it knows, your right hand always works the right side, even reaching across the middle. Before that, a hand that keeps moving keeps its side, so a swing across the middle stays one swing. Mixing up the hands was my biggest bug."

**Q16. How does walking on the spot work? Is it machine learning?**
> "No, it's frame differencing. Fifteen times a second I shrink the camera image to 48 by 36 grey pixels and count how many changed, only in the middle where your body is, and I cut out every hand ml5 finds plus the arm below it. So hand gestures never start or stop walking, and you can cut and build while you walk. It also needs about half a second of steady movement before you move. A two-second calibration at the start measures the room's noise and subtracts it."

**Q17. How are the trees made?**
> "Recursively. A branch draws itself and then two or three shorter, thinner branches, and so on. Then hundreds of small leaf dabs are painted around the tips, dark to light, so the crown looks round. I paint 12 trees once at the start and reuse them, because doing that every frame would be far too slow."

**Q18. How is the sound made?**
> "All synthesised with the Web Audio API. Oscillators for pitch, filtered white noise for wind, leaves and the axe, and envelopes for the shape. The mix follows how built-up the street is, and the music only changes style at the end of a bar."

**Q19. Why schedule the music ahead?**
> "The audio clock is much steadier than the drawing loop. If notes were played when a frame is drawn, the beat would wobble whenever a frame is slow. Scheduling 0.15 seconds ahead keeps the rhythm steady."

**Q20. How does smog work?**
> "It's cumulative: the number of buildings plus three times the number of factories, divided by 30. It greys the sky, the clouds, the sun and the fog. Factories count three times because industry pollutes more."

**Q21. How does looking back work?**
> "My drawing code only draws what's in front. So halfway through the turn I mirror the street behind you to lie ahead, which is a half turn, and a short dark blink hides the swap."

## C. Code quality and performance / 代码质量和性能

**Q22. How is the code organised?**
> "Four files with one job each: sound, the forest, the street engine and the artwork's rules. The engine calls the rules through a few named hooks, so each part can be changed on its own. Each file is in labelled sections, in the order you meet them."

**Q23. How did you make it run smoothly?**
> "I profiled it. Almost half of every frame went on turning colour strings into p5 colour objects, thousands of times a frame. I parse each colour once, cache it, and blend with plain arithmetic. The frame went from 9.1 to 4.7 milliseconds with the same picture."

**Q24. What else did you do for performance?**
> "Trees are painted once and reused; blocks are only made when visible; the camera image for walking is tiny; things behind you or too far away aren't drawn; and the sound has a voice limit."

**Q25. How did you clean up the old Monopoly code without breaking anything?**
> "I removed everything this piece never runs, then ran the old and new versions through the same scripted test: walking, chopping, building, looking back. The results were identical, and so were the pixels of the frame."

**Q26. What makes it robust for an installation?**
> "Every gesture has a keyboard key. The camera calibrates itself. If ml5 can't load, it tells you to use the keys. Drawing is wrapped in try/catch so one bad shape can't freeze the screen."

**Q27. Is it accessible?**
> "Every gesture has a keyboard alternative, the canvas has an aria-label describing the piece and its controls, and the NEXT bar always tells you the one thing to do now."

## D. Reflection and improvement / 反思和改进

**Q28. What was the hardest problem?**
> "Making chopping reliable. One hand crossing the middle of the picture was split into two half-swings. I fixed it by remembering which hand it was a moment ago."

**Q29. What would you do differently?**
> "Test with a real camera and other people much earlier, record real hand data and tune the thresholds from it, and change one setting at a time."

**Q30. What would you add with more time?**
> "Let the forest slowly grow back if you stop building, so restraint has a visible reward, and test it with strangers to check they understand it without me explaining."

**Q31. What are its limitations?**
> "Hand tracking depends on light and distance, and I haven't yet tested with enough people to know that strangers read it the way I intend."

## E. Tricky follow-ups / 比较刁钻的追问

**Q32. "Show me where the hand shape is decided."**
`[DO: 打开 world.js，搜 handShape，指出判断 fist / point / open 的三行。]`

**Q33. "What happens if I lift my hand but there's no cleared land?"**
> "It cuts the nearest forest first and remembers what you asked for, so the building starts as soon as the trees are down. A gesture is never wasted."

**Q34. "Why does the building keep growing after I stop?"**
> "On purpose: 0.25 seconds after you stop lifting, it tops out at the size your hand reached, so you don't have to hold your arm up."

**Q35. "What is `tier`?"**
> "A building's size class, from 0, a small shop, to 4, a skyscraper. It sets the colours, the height and what sound the home makes. Named styles like cinema or factory sit on top of a tier."

**Q36. "Why are lamps and people missing in the forest?"**
> "Nobody lives in a forest. Lamps, trees and people only appear when there's a building within 16 metres, so building visibly brings the city."

**Q37. "What does `try/catch` around draw hide? Isn't that hiding bugs?"**
> "It logs the first error to the console, so I still see it, but the installation keeps running instead of freezing. I tested every building type with no errors."

**Q38. "Did you write all of this yourself?"**
（照实回答你自己的情况。你可以说：）
> "I designed the concept, chose every gesture and what it means, made the decisions to pivot and simplify, and tested everything with my own camera. I made sure I can explain how every part works."

---

# PART 5: If something goes wrong / 出状况时
| 状况 | 怎么做、怎么说 |
|---|---|
| 摄像头认不到手 | 改用键盘："The camera depends on the light, so here's the keyboard; it does exactly the same." |
| 没有声音 | 点一下画面；再不行按 M 两次。 |
| 画面卡住、出错 | 按 R 重新开始，或重新整理网页；最后才播 demo 影片。 |
| 网路不好，ml5 载不进来 | 直接用键盘示范，说明手势会用 ml5 从网上载入。 |
| 被问到不会的 | "I'm not sure, but I'd check it by ..."，诚实比乱答好。 |
