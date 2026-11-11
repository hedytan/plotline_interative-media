# We Build Our World: Presentation Script (technical version)
# 演示讲稿（专业技术版）

Thursday 12 November 2026, 11:00 – 11:15, CB10.04.430, with Jacob Dawson-Daley.

**怎么用这份讲稿**
- 讲稿是在家练习用的，现场不能看。每段先记住 **🔑**，那是一定要讲到的技术重点，其他用自己的话讲。
- 这一版不讲"我按什么键"，改讲**我用了什么技术、什么函数、什么库，为什么这样做**。
- 示范还是要做（老师要你讲一点就马上示范），但只在 `〔示范〕` 里安静地做，嘴巴讲的是技术。
- 每段英文下面有一句中文大意，帮你理解，不用背。
- 时间：slides 1–6 加示范约 8 分钟，reflection 约 3 分钟，其余时间留给问题。

---

## Slide 1: Title (about 20 seconds)

🔑 作品名称；p5.js；自己写的伪 3D 引擎；摄像头和身体控制。

> Hi, I'm Hedy. This is **We Build Our World**, an interactive generative landscape built in **p5.js 1.11.3**. It's a first-person street rendered entirely on the 2D canvas with my own perspective engine, and it's controlled by the body: hand gestures through **ml5.js handPose**, and walking on the spot through camera motion analysis. Everything you see and hear is generated in code. There are no image or audio files.

中文：作品名字；用 p5.js 做；自己的透视引擎；手势和身体控制；画面和声音全部用代码生成，没有图片和声音档。

〔示范：作品已经开着，停在开场卡片。〕

---

## Slide 2: Concept (about 40 seconds)

🔑 每座城市都曾经是森林；意义在手势里；没有分数。

> The concept is that every city was once a forest. The player is the developer: the whole street starts as forest, and nothing builds itself. Every building exists because the player cut the trees and raised it.
>
> The concept and the code are joined through **gesture and feedback**. Clearing land is a fast, careless sideways swing; building is a sustained upward reach. And every action has a systemic consequence: the smog level, the bird population, the soundscape and the music are all computed from how much of the street has been developed. There's deliberately no score, because a score would reward building more. The final card works as a bill rather than a reward.

中文：每座城市都曾是森林；玩家是开发商，什么都不会自己盖起来。概念和代码靠"手势加回应"连在一起：砍是随手一挥，盖是往上举；每个动作都会改变烟雾、鸟、环境声和音乐。没有分数，结尾的卡片像账单，不是奖励。

---

## Slide 3: Interaction: the body as the controller (about 2 minutes, with demo)

🔑 `createCapture(VIDEO)` 摄像头；ml5 handPose 21 个关键点；每根手指看直还是弯（一根手指 = 住宅，张开 = 商店，拳头 = 高楼）；砍树用速度；举手量变成楼层；原地走路用帧差分，手被挖掉，所以可以边走边砍边盖；每个手势都有键盘备用。

> The webcam is opened with p5's **`createCapture(VIDEO)`**, and the video is passed to **ml5.js handPose**, which is built on TensorFlow.js and Google's MediaPipe hand model. I load ml5 only when the camera is first turned on, so the piece still starts quickly without it. I run it in continuous mode with **`detectStart`**, tracking up to two hands, and each hand returns **21 landmarks**.

中文：用 p5 的 `createCapture(VIDEO)` 开摄像头，影像交给 ml5 的 handPose（底层是 TensorFlow.js 和 MediaPipe 的手部模型）。ml5 在第一次开摄像头时才载入。用 `detectStart` 连续侦测，最多两只手，每只手 21 个点。

〔示范：开摄像头，站着不动让它校准。〕

> My callback, **`gotHands`**, turns those landmarks into three things.
>
> **First, which side.** The picture is mirrored, and each hand controls its own side of the street. When only one hand is visible, it keeps the identity it had a moment ago, so a swing across the middle of the frame stays one continuous gesture.
>
> **Second, the shape.** In **`handShape`**, I test each finger separately: I compare the distance from its tip to the wrist with the distance from its middle joint to the wrist. A straight finger's tip reaches well beyond the joint; a curled finger's tip folds back inside it. Because it's a ratio, it works whether you stand near or far. Only the index straight means **one finger**, three or more straight means an **open hand**, and none straight means a **fist**. Anything in between is treated as unclear and builds nothing, and a new shape only counts after it has been seen three frames in a row, so one blurred frame can't change what you're building. Detections that ml5 itself is unsure about are ignored.
>
> **Third, the motion.** I keep a 0.4-second history of each hand's position. In **`handFeedSide`**, a chop is a horizontal movement greater than 18% of the frame inside that window, and it has to be more horizontal than vertical, so lifting a hand is never misread as a chop.

中文：`gotHands` 把关键点变成三样东西：一、哪一边（画面镜像，一只手时沿用刚才的身份，挥过中间也算同一下）；二、手形（`handShape` 每根手指分开看：比较指尖到手腕、和中间关节到手腕的距离，直的手指指尖会超出关节，弯的会折回来；只有食指直 = 一根手指，三根以上直 = 张开，全部不直 = 拳头；看不清楚的手形什么都不盖，新手形要连续认到 3 次才算，ml5 没把握的手直接忽略）；三、动作（记录 0.4 秒的位置，横向移动超过画面 18% 而且横向多于纵向才算砍）。

〔示范：一只手往旁边挥，砍那一边的树。〕

> A chop calls **`chopForest`**, which clears the nearest two forest lots on that side, counts the trees, and releases birds as small particles that fly away. The cut trees fall over before they disappear.
>
> Building works the opposite way. Each frame, the **upward movement** of a hand is fed into the nearest cleared lots on that side through **`growLot`**, so the building literally grows in proportion to your reach, floor by floor, with scaffolding and a crane for tall buildings, which disappear as soon as each one is finished. The hand's **height in the frame** sets the scale, and the **hand shape** sets the type: one finger for homes, an open hand for shops, and a fist for industry and towers. **`makeBuilt`** then picks a random building from that family, from 24 building types in total. When the hand stops rising, the building tops out by itself a quarter of a second later, so the player doesn't have to hold a pose.

中文：砍会呼叫 `chopForest`：清掉那一边最近的两块森林、计算砍了几棵树、放出飞走的鸟（粒子），树会先倒下再消失。盖楼相反：手每一帧往上移动的量，经由 `growLot` 变成楼的高度，一层一层长，有鹰架，高楼旁边还有塔吊，盖好就马上消失。手在画面里的高度决定大小，手形决定种类（一根手指是住宅、张开是商店、拳头是工业和高楼），`makeBuilt` 再从那一类里随机挑，总共 24 种建筑。手停下 0.25 秒后楼会自己封顶，不用一直举着。

〔示范：举一根手指盖住宅；张开手举起盖商店；再握拳举高，盖一栋高楼。〕

> Walking is not machine learning. **`sampleMotion`** uses **frame differencing**: about fifteen times a second, the video is reduced to a 48 by 36 greyscale image, and I compare it with the previous frame. I only read the central columns, where the body is, and I mask out every hand ml5 has found, plus the arm below it. So moving your hands never starts or stops walking: you can walk, cut and build at the same time. Walking also needs about half a second of steady movement, six of the last eight samples, so one quick gesture can't move you. A two-second calibration at the start measures the room's background noise and subtracts it. **`bodySpeed`** maps the amount of motion to standing, walking or running.
>
> Because camera tracking depends on lighting, every gesture also has a keyboard equivalent, so the work is dependable as an installation.

中文：走路不是机器学习，`sampleMotion` 用帧差分：每秒约 15 次把影像缩成 48×36 的灰阶图，和上一张比较有多少像素变了；只看中间（身体），而且把 ml5 找到的每只手和下面的手臂挖掉，所以手怎么动都不会让你开始走或停下，可以边走边砍边盖；还要连续动约半秒（最近 8 次取样里有 6 次）才开始走，一下快动作不会让你前进。开头 2 秒校准，量出房间本身的杂讯再扣掉。`bodySpeed` 把动作量换成站着、走路或跑步。摄像头受光线影响，所以每个手势都有键盘备用。

〔示范：原地踏几步，街道往前走。如果摄像头不顺，就安静地改用键盘。〕

---

## Slide 4: The world responds: visuals, sound and generation (about 2 minutes, with demo)

🔑 带种子的程序生成；递归画树（自己的"画笔"）；空气透视；烟雾公式；Web Audio 即时合成；音乐跟着开发程度变；三种结局。

> **The street is procedurally generated.** It's made of 48-metre blocks created by **`chunkAt`** only when they come into view and discarded when they're far behind, so it's endless with constant memory. Each block is generated from a **seeded random number generator** rather than `Math.random`, so a block is identical every time it's rebuilt. That's what allows the player to turn around and see exactly the street they changed.

中文：街道是程序生成的：`chunkAt` 在街区进入视野时才产生 48 米的街区，远远落在后面就删掉，所以无限长但记忆体不变。每个街区用带种子的随机数产生，不用 `Math.random`，所以每次重建都一样，回头看时街道和你改过的一模一样。

> **For the painted look, I didn't use a brush library.** I tried p5.brush in an earlier version and dropped it for performance and control. Instead, **`makeForest`** in `forest.js` paints twelve tree sprites once at start-up, into offscreen canvases made with **`createGraphics`**. Each tree is drawn **recursively**: a branch draws itself with a curved stroke, then splits into two or three shorter, thinner branches. Then hundreds of small, overlapping leaf dabs are painted around the branch tips, from dark shadow colours to light sunlit colours, so the crown reads as a rounded volume. There are five species: broadleaf, poplar, gum, pine and bush.
>
> For depth, I use **atmospheric perspective**: every colour passes through a tone function, **`toneN`**, that blends it toward the haze colour with distance, and **`hazeSprite`** makes faded versions of the trees for the far distance. The sky and sun are drawn with the canvas's native **linear and radial gradients**, and a film-grain texture, generated pixel by pixel into a `createGraphics` buffer, plus a vignette, sit on top.

中文：画面的手绘感没有用画笔库（之前试过 p5.brush，因为效能和控制而放弃）。`forest.js` 的 `makeForest` 在开始时用 `createGraphics` 在离屏画布上画 12 棵树：树枝用递归画，一枝画完分成两三枝更短更细的，再在枝头画几百个重叠的叶子笔触，由暗到亮，所以树冠看起来有体积。五种树：阔叶、白杨、尤加利、松、灌木。远近感用空气透视：每个颜色都经过 `toneN`，越远越接近雾的颜色；`hazeSprite` 做远处变淡的树。天空和太阳用画布原生的线性和放射渐层；最上面是逐像素生成的胶片颗粒和暗角。

〔示范：连续盖几栋，特别是工厂，让天空变灰。〕

> **The environment responds to development.** Smog is cumulative: the number of buildings plus three times the number of factories, divided by thirty. That value greys the sky gradient, the clouds, the sun and the distance fog. Lamps, street trees and people only appear once a building stands nearby, so the city visibly arrives with construction.

中文：环境跟着开发程度变：烟雾是累积的，（建筑数 + 工厂数 × 3）÷ 30，它让天空、云、太阳和远方的雾变灰。路灯、行道树和行人只有在附近有建筑时才出现，所以城市是跟着你盖楼来的。

> **All sound is synthesised in real time with the Web Audio API**, in `sound.js`. Oscillator nodes give pitch, biquad filters shape white noise into wind, rustling leaves, footsteps and the axe, gain envelopes give each sound its attack and decay, and stereo panners place sounds on the correct side of the street. Everything goes through a master compressor.
>
> Each frame, the code measures the share of built lots within 60 metres. That one value crossfades the wild sounds, wind and birdsong, into traffic, and it selects the music: strings and harp for the forest, pop for a town, and a house beat for the city. Style changes only happen at the end of a bar, and notes are scheduled 0.15 seconds ahead on the audio clock, so the rhythm stays steady even if a frame is slow. Inhabited houses also have their own sounds, like children, a dog, a piano or a television, but the empty luxury towers are silent.

中文：所有声音都在 `sound.js` 用 Web Audio API 即时合成：振荡器做音高，biquad 滤波器把白噪音变成风声、树叶、脚步和斧头，增益包络决定每个声音的起音和消失，立体声声像让声音出现在街道正确的那一边，最后全部经过一个压缩器。每一帧算出 60 米内已开发地块的比例，这一个数字让风声和鸟叫渐渐变成车声，也决定音乐：森林是弦乐和竖琴、小镇是流行、城市是 house。曲风只在小节结束时换，音符提前 0.15 秒按音频时钟排程，画面慢的时候节奏也稳。有人住的房子有自己的声音（小孩、狗、钢琴、电视），空的豪华高楼没有声音。

〔示范：转身回头看一下街道，再转回来。〕

> To look back, **`drawMirrored`** reflects the street behind the player so it can be drawn by the same far-to-near renderer, and a brief dark blink hides the switch.
>
> Finally, the ending is the player's decision. It comes as a **receipt**: a little printer, drawn on the canvas, prints THE WORLD YOU CREATED, with a snapshot of your street copied from the canvas, the trees cut and buildings built, and PAID BY: THE FOREST. Its words have **three versions** that respond to what was actually built: if nothing was built, the forest stays; if a little, it says so; if it became a city, the birdsong stops.

中文：回头看时，`drawMirrored` 把身后的街道镜像到前面，用同一个由远到近的画法画出来，中间一个短暂的暗场遮住切换。结局由玩家决定，以一张**收据**出现：画布上画的小打印机打印出 THE WORLD YOU CREATED、你的街道截图、砍了几棵树、盖了几栋楼、PAID BY: THE FOREST 和条形码。收据上的文字有三种，按实际盖了多少回应：什么都没盖，森林留下；盖了一点；变成城市，鸟叫就停了。

〔示范：结束，等卡片出现，再继续。〕

---

## Slide 5: How it works: architecture and rendering (about 1.5 minutes, show the code)

🔑 四个文件各管一件事；引擎和规则用 hooks 分开；`P()` 透视；`clipNear`；画家算法；用原生 Canvas API；颜色缓存让每帧快一倍。

> The code is organised into **four files with one responsibility each**: `sound.js` for audio, `forest.js` for the tree painting, `sketch.js` for the street engine, and `world.js` for the artwork's rules: gestures, building, smog, the interface and the endings.
>
> The engine and the rules are separated by **a small set of named hooks**. The engine knows how to generate and draw a street; every frame it calls `worldUpdate`, it asks `lotRise` how far each building has grown, and it passes input to `worldKey` and `worldClick`. That separation is why I could replace my earlier Monopoly concept completely without rewriting the renderer.

中文：代码分成四个文件，各负一个责任：声音、树、街道引擎、作品规则（手势、盖楼、烟雾、介面、结局）。引擎和规则用几个有名字的 hooks 分开：引擎每帧呼叫 `worldUpdate`、问 `lotRise` 楼长到多高、把输入交给 `worldKey` 和 `worldClick`。所以我可以把之前的 Monopoly 概念整个换掉，不用重写引擎。

〔示范：切到代码，打开 sketch.js 的 `P`。〕

> The rendering is a **custom pseudo-3D projection on the 2D canvas**, not WEBGL. The core is the function **`P(x, y, z)`**: a point in world space, measured in real metres, is translated relative to the camera, rotated by the viewing angle, and then **divided by its depth**. That's perspective projection, written by hand. **`clipNear`** clips any polygon that crosses the camera plane, so geometry behind the viewer doesn't flip across the screen. Visibility uses the **painter's algorithm**: in `drawWorld`, everything is sorted by distance and drawn from far to near.
>
> I use p5 for the canvas, the draw loop, input and text, but for the heavy drawing I call the **native Canvas 2D context directly through `drawingContext`**: paths, gradients and alpha. It's faster and gives finer control.

中文：渲染是在 2D 画布上自己写的伪 3D 投影，不是 WEBGL。核心是 `P(x, y, z)`：世界里以公尺为单位的点，先减去摄像机位置、按视角旋转、再除以深度，就是手写的透视投影。`clipNear` 把跨过摄像机平面的多边形裁掉，后面的东西不会翻到画面上。遮挡用画家算法：`drawWorld` 把所有东西按距离排序，由远到近画。p5 负责画布、绘图循环、输入和文字；大量的绘图我经由 `drawingContext` 直接用原生 Canvas 2D（路径、渐层、透明度），比较快也比较好控制。

> For performance, I **profiled** the sketch and found that almost half of each frame was spent converting colour strings into colour objects. I now parse each colour once, cache it in **`rgbOf`**, and blend with plain arithmetic. With an identical image, a frame went from **9.1 to 4.7 milliseconds**. Other optimisations: trees are pre-rendered sprites, blocks only exist when visible, the motion image is tiny, and the pixel density is capped.
>
> For robustness, drawing is wrapped in `try/catch` so one malformed shape can't freeze an installation, and the code follows the p5 Web Editor's constraints, so the same sketch runs in p5 1.x and 2.x.

中文：效能方面，我做了效能分析，发现每帧差不多一半时间花在把颜色字串变成颜色物件。现在每个颜色只解析一次、存在 `rgbOf`，混色用简单算术；画面完全一样，每帧从 9.1 毫秒降到 4.7 毫秒。其他：树是预先画好的、街区只在看得到时存在、走路用的影像很小、像素密度有上限。稳定性方面，绘图包在 `try/catch` 里，一个坏掉的形状不会让展示当掉；代码也照 p5 网页编辑器的规则写，p5 1.x 和 2.x 都能跑。

---

## Slide 6: Demo video (about 10 seconds, or skip)

> This is a thirty-second recording of a complete run, as a backup. I'm happy to take questions.

中文：这是 30 秒的完整录影，当备用。现场示范顺利的话，这页直接跳过，说 "I'm happy to take questions." 就好。

---

## Reflection (about 3 minutes, no slides)

🔑 只讲三个领悟和以后的做法，不讲流水账。

> **First: interaction bugs live between the algorithm and a real body.** Chopping was unreliable, and the cause wasn't the threshold. I was assigning hands by which half of the frame they were in, so one hand swinging across the middle was split into two half-gestures. I fixed it by keeping each hand's identity over time. I also learned to change one parameter at a time: a larger rewrite of the gesture code felt worse, so I reverted it and re-applied only two targeted fixes. In future I'll test with a real camera, and with other people, from the start.

中文：一、交互的 bug 藏在算法和真实身体之间。砍树不准，原因不是门槛，而是我按画面左右半边分配手，一只手挥过中间被拆成两个半截动作；我改成让每只手保持身份。我也学到一次只改一个参数：大改手势代码反而更差，所以退回去只加两个针对性的修正。以后一开始就用真的摄像头、找别人测试。

> **Second: reduction made the meaning clearer.** My earlier Monopoly version relied on signs, rules and text, and the feedback was that the meaning was unclear. Reducing it to clearing and building let the interaction carry the idea, and I could remove most of the text. Next time I'll validate the core interaction before adding visual detail.

中文：二、减少反而让意义更清楚。之前的 Monopoly 版本靠标志、规则和文字，回馈是意义不清楚；简化成砍和盖以后，交互本身就能带出意思，大部分文字都拿掉了。以后先确认核心交互看得懂，再加视觉细节。

> **Third: a meaningful interaction also has to be dependable.** A gesture has to express the idea and respond every time. That's why every gesture has a keyboard equivalent, the camera calibrates itself and why a lift only builds on land you have already cut.

中文：三、有意义的交互也必须可靠。手势要表达概念，也要每次都有反应，所以每个手势都有键盘备用、摄像头会自己校准、举手只会在砍过的地上盖。

> Overall, I think it achieves its main aim: the cost of building is felt rather than read. The open question is whether people who don't know the project read it the way I intend, so user testing with strangers is the next step.

中文：整体来说达到了主要目标：盖楼的代价是感受到的，不是读到的。还不知道的是不认识这个作品的人会不会照我的意思理解，所以下一步是找陌生人测试。

---

## 一页速记：用到的技术（练习时对照，确定每一项都讲得出来）

| 类别 | 用了什么 | 在哪里 |
|---|---|---|
| 框架 | p5.js 1.11.3（2D canvas、draw loop、输入、文字） | 全部 |
| 原生绘图 | Canvas 2D context（`drawingContext`）：路径、`quadraticCurveTo`、线性和放射渐层、`globalAlpha`、`shadowBlur` | sketch.js、forest.js |
| 离屏画布 | `createGraphics`：12 棵树的 sprite、胶片颗粒 | forest.js、sketch.js |
| 3D | 自己写的透视 `P()`、`clipNear`、画家算法 `drawWorld` | sketch.js |
| 生成 | 带种子的随机数 `rngN`、48 米街区 `chunkAt`、10 格街道规划、24 种建筑 `makeBuilt` | sketch.js、world.js |
| "画笔" | 没有用画笔库（p5.brush 试过放弃）；递归树枝 + 几百个叶子笔触 | forest.js `makeForest` |
| 远近感 | 空气透视 `toneN`、`hazeSprite` | sketch.js、forest.js |
| 摄像头 | p5 `createCapture(VIDEO)` | world.js `startHands` |
| 手势 | ml5.js 1.0.1 handPose（TensorFlow.js + MediaPipe），`detectStart`，2 只手，21 个点；每根手指看直或弯：一根手指 = 住宅、张开 = 商店、拳头 = 高楼；连续 3 次才换手形 | world.js `gotHands`、`handShape`、`handFeedSide` |
| 身体走路 | 帧差分 48×36 灰阶、约 15 次/秒、只看中间、挖掉手和手臂、要连续约半秒、2 秒校准 | world.js `sampleMotion`、`bodySpeed` |
| 声音 | Web Audio API：Oscillator、BiquadFilter、Gain 包络、StereoPanner、DynamicsCompressor、白噪音 AudioBuffer、提前 0.15 秒排程 | sound.js `WorldSound` |
| 环境回应 | 烟雾 =（建筑 + 工厂×3）÷ 30；60 米内开发比例控制声音和音乐 | world.js、sound.js |
| 效能 | 颜色缓存 `rgbOf`：9.1 → 4.7 ms/帧 | sketch.js |
| 稳定 | `try/catch`、键盘备用、自动校准、p5 1.x / 2.x 都能跑 | 全部 |

问答准备（38 题）在 `presentation-pack.md` 第四部分，逐段代码解说在 `code-walkthrough.md`。

## 键盘备用（摄像头不顺时安静地改用）

| 键 | 作用 |
|---|---|
| C | 开 / 关摄像头 |
| Z / X（或 ← / →） | 砍左边 / 右边的森林 |
| H | 住宅 |
| S | 商店 |
| B | 高楼和工业 |

**多按几下就越长越高**：按 1–2 下是小楼，3–4 下变中型，第 5 下变大楼，之后再按就再加一两层。同时盖的几栋，样子和高度都不一样（每栋楼有自己的高度和长高的速度，相邻的楼不会是同一种样子）；最后一下之后 0.7 秒自己封顶。

按 H / S / B **只会在你砍过的那一边盖**：只砍左边就只盖左边，只砍右边就只盖右边，两边都砍两边都盖。还没砍就按，会提示你先用 ← / → 砍。
| ↑ 或 W（Shift 跑） | 往前走 |
| T | 转身回头看 |
| F | 结束卡片（再按 F 继续） |
| M | 静音 / 开声音 |
| R | 重新开始 |
