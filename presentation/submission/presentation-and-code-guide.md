# We Build Our World：讲稿 + 代码问答准备

这份指南对应**整理后的最新版本**：`we-build-our-world-code.zip`（11 月 9 日，4 个文件，有三种结局），也就是网上的 live 版本。
- 讲稿用英文，可以直接念。
- 代码解释用中文，帮你理解。
- 每个问题都附上一段可以直接说的英文回答。
- 文中的行号指新 zip 里的 `sketch-all.js`。在 p5 编辑器里也可以用 Cmd+F 搜函数名。
- 如果你最后交的还是旧的 `A2B code.zip`，行号和文件名会不一样，但每个函数做的事情一样。

---

# 第一部分：讲稿（约 5 分钟）

念的时候放慢。每页旁边写着建议的时间。

## Slide 1: We Build Our World（0:00 – 0:30）

Hi, I'm Hedy. My project is **We Build Our World**, an interactive generative landscape made in p5.js.

What you see here is where every visit starts: a street, and on both sides of it, forest. Nothing is built yet.

In the next five minutes I'll show you the idea, how your body becomes the tool that changes this place, how the world answers back, and the technical work underneath. Then a 30-second clip of a full run.

## Slide 2: Every city was a forest once（0:30 – 1:20）

The concept in one line: every city was a forest once, and we build our world the way we want it.

The person in front of the screen is the developer. You start on the left: a street lined with painted forest, birdsong, warm light. You end wherever you choose to stop, often somewhere like the right: row houses, towers, a grey sky.

The work never tells you that you are doing something wrong. There is no score to win and no warning. It simply lets you build, and makes sure you notice what that costs.

My objective was to make the cost of development something you **feel through your own actions**, rather than something you read on a sign.

It is made for **anyone who has watched the forest at the edge of their town disappear under new buildings**. You need no instructions and no gaming skill, just your hands.

## Slide 3: Your body is the tool（1:20 – 2:10）

The interaction carries the meaning. I use ml5 hand tracking on the webcam, and every gesture was chosen for what it says.

- **Cutting the forest is a single swing of the arm.** It should feel too easy.
- **Building is lifting.** The higher you reach, the bigger the building, so greed is literally a reach upward.
- **The shape of your hand picks what you build.** One finger makes homes, from a log cabin to row houses to condos with trees on the balconies. An open hand makes shops, from a diner to a cinema to a mall. A fist makes industry: car parks, power stations, and towers that stand empty, with names like Forest View Apartments.
- **You move by walking on the spot**, so your whole body is involved, and you can keep cutting and building while you walk.

Each hand works its own side of the street. You are never lost: a **NEXT bar** always tells you the one thing to do now, the **camera panel** shows what each hand will build, the camera **calibrates itself** when it starts, and every gesture has a **keyboard key** as a backup.

## Slide 4: The world answers back（2:10 – 3:00）

Every action is answered, so you feel the consequence without being told.

In the forest the light is warm and golden. Every building adds smog, factories and power stations most of all, and the sky turns grey. When you chop, birds burst out of the trees and fly away.

Press **C** at any time to turn round and look at the street behind you. When you decide you're finished, the end card counts it up: how many trees, homes, shops and towers. And then: *listen, the birds have stopped.* The card answers what you actually did: build nothing, and it tells you the forest stays.

The sound makes the same journey: wind, leaves, birdsong and slow strings and harp at the start; as you build, the wild sounds fade, traffic rises, and the music changes to pop and then a city house beat.

## Slide 5: How it works（3:00 – 4:00）

Here is how it works, in simple terms.

- **It sees your hands.** The webcam finds both hands and reads their shape (one finger, an open hand or a fist), using a hand-tracking library called ml5.
- **It feels you walk.** When you step on the spot, the camera notices the movement and the street moves with you.
- **A painted street.** It is drawn flat, like an illustration, but my own perspective camera makes it feel like a real street. Nothing in it is a photo or a recording.
- **Trees made by code.** The program grows each tree branch by branch and paints it in hundreds of little leaf strokes.
- **Buildings made by code.** There are 24 kinds of building, all drawn by the program and picked at random, so no two streets are the same.
- **Sound made by code.** The birds, the wind, the axe and the music are all created live as you play.

The code is split into small files that each do one job, with comments and a README.

And it runs smoothly. I measured where the time goes in each frame, found that mixing colours took almost half of it, and rewrote that part. Every frame now takes about half the time, from 9 milliseconds down to under 5, with exactly the same picture.

## Slide 6: Demo video（4:00 – 5:00）

*[播放影片，30 秒，有声音。]*

Here is a full walk: the forest, chopping both sides, homes rising floor by floor in scaffolding, a tall tower with a crane, shops and a cinema, and at the end the turn round to the card. Listen to the birds at the start, the axe, the building sounds, and the music turning into a city beat.

How it meets the objectives:
- **The meaning is in the moves.** You don't need to read anything to understand what you are doing.
- **Every choice is answered** in light, air and sound, so the cost of building is felt, not read.
- **There is no goal to win.** The work hands you the question of when it is enough.

I hope people leave a little more aware of what was there before the buildings. Thank you. I'm happy to show it live.

---

# 第二部分：整个程序是怎么运作的（先理解这个）

## 2.1 六个文件，各做一件事

| 文件 | 在 sketch-all.js 的位置 | 负责 |
|---|---|---|
| sound.js | 第 5 行起 | **所有声音**：音响系统、脚步、鸟、风、斧头、每层楼的声音、房子里的生活声、随城市变化的音乐 |
| forest.js | 第 268 行起 | **森林**：开场画好 12 种树，再按距离画到街上 |
| sketch.js | 第 378 行起 | **街道引擎**：摄像机、透视、生成街道、画所有东西 |
| world.js | 第 1605 行起 | **作品的规则**：砍、建、手势、走路、计分、三种结局 |

每个文件里面都按顺序分段，段落开头写着这段在做什么，例如 `/* ---------- Cutting the forest ---------- */`。

**最重要的设计**：sketch.js（引擎）不知道这个作品的规则。它只在固定的地方呼叫 world.js 里几个有名字的函数（hook）：
- `plotsForChunk`：新街区生成时，设定每块地；
- `propWaits`：路灯、树、行人要不要等附近有建筑才出现；
- `lotRise`：这栋楼现在长到多高；
- `worldUpdate`：每一帧更新规则；
- `drawBirds`：画鸟；
- `drawHud`：画计分板和卡片；
- `worldKey` / `worldClick`：处理按键和点击。

> **English:** "The street engine and the artwork are separate. sketch.js only knows how to draw a street. It calls a few named hooks in world.js, like worldUpdate or lotRise, and world.js decides the rules. That's how I could change the whole concept from Monopoly to the forest without rewriting the engine."

## 2.2 从打开网页到每一帧

1. **`setup()`（第 459 行）**，只执行一次：建立全屏画布，建立声音（`new WorldSound()`），做底片颗粒质感，生成远方城市剪影（`buildSkyline`），**预先画好所有的树**（`makeForest`）。
2. **`draw()`（第 555 行）**，每秒约 60 次：
   1. 读取输入：键盘、鼠标，或者摄像头里你的踏步速度（`bodySpeed()`）。
   2. 平滑速度，让起步和停下都有惯性。
   3. 走路的晃动和脚步声。
   4. 设定摄像机：位置、转头角度、上下晃。
   5. 生成你前面的街区，删掉太远的。
   6. `worldUpdate`：规则、手、烟雾、提示。
   7. 计算附近建好了多少（`sound.devK`），声音跟着变。
   8. 画：天空 → 远方城市 → 地面 → 街上所有东西 → 灰色滤镜 → HUD。

---

# 第三部分：每个重要部分的详细解释 + 老师可能问的问题

## 3.1 3D 是怎么做出来的：`P(x, y, z)`（第 476 行）

**这是整个作品最核心的一个函数。** 画布是平面的 Canvas 2D，没有用 WEBGL 或 Three.js。

每个东西都有真实世界的坐标，单位是米：x 是左右，y 是高度，z 是往前多远。`P()` 把它换算成屏幕上的点：
1. 减去摄像机的位置，得到"这个点相对于我在哪里"；
2. 按转头的角度旋转（`cos` / `sin` 那两行），所以转头时整个世界跟着转；
3. **除以距离**：`cam.f / rz`。远的东西除以大数字，变小，也更靠近画面中间的地平线。

这就是透视，和美术课画一点透视的原理一样：越远越小，最后消失在地平线上的一点。

**`clipNear`（第 485 行）**：如果一个形状有一部分在你身后，距离会变成负数，除下去会翻到画面另一边，画出乱线。这个函数在你眼前 0.25 米处把形状切掉，只留看得见的部分。

**画家算法**（`drawWorld`，第 747 行）：所有东西按距离排序，**先画远的，再画近的**，近的自然盖住远的。就像画油画，先画背景再画前景。

**Q：Why didn't you use WEBGL or Three.js?**
> "I tried a WEBGL version first. It had real lighting, but it looked like a game engine. I wanted it to look painted, like an illustration. So I wrote my own perspective function: every point is divided by its distance from the camera, so things get smaller towards the horizon. Then I sort everything far to near and draw it like a painter, back to front. That gave me full control over the painted look."

**Q：What does the P function do?**
> "It takes a point in the world in metres, subtracts the camera position, rotates it by where you're looking, and divides by the distance. That's the basic maths of perspective."

## 3.2 街道是怎么"生成"的：`chunkAt`（第 516 行）+ `rngN`（第 423 行）

- 街道切成一段段 48 米的街区（chunk）。你往前走，前面的街区才被生成；走远了，后面的就删掉。所以街道是**无限的**，内存也不会爆。
- **`rngN(seed)` 是带种子的随机数产生器。** 同一个种子，每次产生的随机数顺序一模一样。用处：
  - 你回头看的时候，街区重新生成，还是原来那条街；
  - 每块地的大小、颜色、树的位置都是随机的，但稳定、可重现。
- 每个街区：左右两边排地块（`makeLot`，第 543 行），长度随机；后面一排更高的楼；路灯、行道树。
- `STREET_PLAN`（第 1619 行）设定 10 个街区，每个街区的地块怎么分。

**Q：What makes it generative?**
> "Three things. The street is generated block by block from a seeded random generator, so it is endless but consistent. The trees are grown by a recursive algorithm, not drawn by hand. And every building is picked at random from a family that depends on your gesture, so no two streets are the same. The rules are fixed, but the result is different every time, and the player is part of the system."

**Q：Why a seeded random instead of Math.random()?**
> "With a seed, the same block always comes out the same. So when you turn round and look back, the street you walked through is still there exactly as it was. Math.random() would give a different street every time it's regenerated."

## 3.3 手势识别：`startHands` / `gotHands` / `handFeedSide`（第 1949–2041 行）

**`startHands`**：按 C 才开始。它从网上载入 ml5.js 1.0.1，打开摄像头（320×240），开启 `ml5.handPose`（最多两只手），每次识别到手就呼叫 `gotHands`。载入失败的话，会显示改用键盘的提示。

**`gotHands`**：ml5 每只手会给 **21 个关键点**（手腕、每根手指的关节和指尖）。

1. **判断手的形状**（`handShape`），每根手指分开看，用"比例"而不是像素距离，所以手离镜头远或近都一样准：
   - 比较"指尖到手腕的距离"和"中间关节（PIP）到手腕的距离"；
   - 比值 > 1.18 → 这根手指是**直的**；< 1.02 → **弯的**；中间 → 不确定；
   - 只有食指直、其他至少两根弯 → **一根手指** → 住宅；
   - 三根以上直 → **张开** → 商店；
   - 没有一根直、至少三根弯 → **拳头** → 工业/高楼；
   - 其他（例如比两根手指）→ **不清楚**，什么都不盖，免得盖错。
   - ml5 自己的信心低于 0.6 的手直接忽略。
   - 也会记下每只手在画面里的范围（`handBoxes`），给走路侦测用。
2. **镜像**：`x = 1 - p.x / 宽度`，所以你往左动，画面里的手也往左，像照镜子。
3. **分左右手**：用 ml5 自己给的左右手标签（handedness）。程序会在你玩的时候自动学会这个标签在你的镜头里代表哪一边（手明显在画面一边时投一票，`handVote`）；学会以后右手就一定管右边，伸过中间也一样。学会之前：同一只手还在连续移动（0.15 秒内、位置很近）就保持原来那边，新出现的手就看它在画面哪一半。

**这是我修过的一个 bug**：原来只按"手在画面左半边还是右半边"来分。结果一只手挥过中线，就被拆成两只手各挥了半下，两边都不够长，砍不到树。改成"记住这只手刚才是谁"之后就好了。（这件事写在你的 reflection 里。）

**`handFeedSide`（第 2023 行）**：处理一只手的每个新位置。
- **手形要稳定才算**：新的手形要**连续认到 3 次**（约 0.1 秒）才会换，举手中途画面糊一下不会把住宅变成高楼。
- **`kindOf`**：把手形换成要盖的东西：一根手指 → 住宅，张开 → 商店，拳头 → 高楼。
- **举手 = 建房**：和上一个位置比，往上移（y 变小）超过 0.004，就累加到 `s.lift`。
- **挥手 = 砍树**：记录手最近 0.4 秒的轨迹（`trail`）。如果 0.4 秒内**横向**移动超过画面宽度的 18%，**而且横向多于纵向**，就砍那一边。"横向多于纵向"这个条件保证往上举手不会被误判成砍树。砍完之后 0.35 秒内不会再触发，避免一下挥手被算成好几次。

**Q：How does the hand tracking work?**
> "ml5's handPose model gives me 21 landmarks per hand. For each finger I compare how far the tip is from the wrist with how far its middle joint is: a straight finger reaches past the joint, a curled finger folds back inside it. Only the index straight is one finger, for homes; three or more straight is an open hand, for shops; none straight is a fist, for towers. Anything unclear builds nothing, and a shape must be seen three times in a row before it counts. Using ratios means it works whether your hand is near or far from the camera."

**Q：How do you detect a chop?**
> "I keep the last 0.4 seconds of each hand's positions. If the hand moved sideways more than 18% of the picture in that time, and more sideways than up or down, that's a chop on that hand's side. The 'more sideways than vertical' rule is what stops a lift from being read as a chop."

**Q：What was the hardest problem?**
> "Chopping didn't work reliably. I found that hands were assigned by which half of the picture they were in, so one hand swinging across the middle was split into two half-swings, and neither was long enough. I fixed it by remembering which hand it was a moment ago. I also learned not to change many thresholds at once. I tried a big rewrite, it felt worse, so I went back to the working version and only re-applied two small fixes."

## 3.4 建造：`handUpdate` / `makeBuilt` / `growLot`（第 1743–1892 行）

**`handUpdate`（第 1787 行）**，每帧执行：
1. 键盘代替手势：H = 住宅，S = 商店，B = 工业和高楼，只在砍过的那一边盖。**多按几下就越长越高**（`tapBuild`）：按 1–2 下是小楼，3–4 下变中型，第 5 下变大楼，第 7 下以后每按一下再加一两层（最高 1.6 倍），不会越按越矮。每栋楼的高度是原本的 80% 到 125%，同时盖的几栋长大的节奏也不同，相邻的楼不会是同一种样子，所以整排楼不会一模一样。每块地会按一个高低交错的顺序偏大或偏小（`LEAN`、`lotLevel`），所以隔壁的楼会一高一矮，按住键、用手举、一下一下按都一样；高的住宅有三种：公寓、阳台种树的高楼、红砖公寓楼；最后一下之后 0.7 秒自己封顶。按住不放也会长。
2. 每只手把"举起的量"分给**它那一边最近的两块已经砍空的地**。
3. **如果那边还没砍**：自动先砍，并先记下你要建什么，树倒下后马上开始建。所以**每一次举手都一定有反应**，不会白举。
4. 楼一层一层往上长：长多快 = 举手的量 × 3，再按楼高稍微调整（高楼需要多举一点，但不会差很多）。
5. **停止举手 0.25 秒后，楼会自己封顶**，最后几层自动长完。

**`handLevel`（第 1774 行）**：手的高度决定楼的大小。手在画面下半部 → 小；胸口到脸 → 中；举过头 → 大。手举到更高的级别时，建筑会换成更大的一种，已经长好的高度保留。

**`makeBuilt`（第 1743 行）**：**手的形状 × 手的高度**，从对应的建筑家族里随机挑一种：

| | 低 | 中 | 高 |
|---|---|---|---|
| 张开（住宅） | 平房、小屋、木屋、拖车屋 | 排屋、运河排屋、现代住宅、别墅 | 公寓、阳台种树的绿色公寓 |
| 指（商店） | 小店、餐馆、加油站 | 商店街、超市、电影院 | 办公楼、商场 |
| 拳头（工业） | 停车场、变电站 | 数据中心、工厂、发电厂 | 摩天楼（空置）、斜顶玻璃楼 |

最高级的摩天楼会被设成**空置**（`vacant: true`），取名自 `VOID_NAMES`，例如 "FOREST VIEW APARTMENTS"。

**`growLot`（第 1878 行）**：每多长一层就播放一声"咚"（`floorUp`），一层比一层高音。长到 100% 就算建成：计数加一，播放落成音效，工厂和发电厂另外记一笔（会让烟雾加重）。

**Q：How does building work?**
> "Lifting a hand adds to a 'lift' amount. Each frame, that lift goes into the two nearest cleared lots on that hand's side, so the building grows floor by floor while you keep lifting, with a sound for every floor. How high your hand is picks the size, and the shape picks the type. When you stop lifting, it tops out on its own after a quarter of a second. If there's no cleared land yet, the lift clears it first, so a gesture is never wasted."

**Q：Why does the height of the hand change the size?**
> "Because it's the meaning: greed is literally a reach upward. The more you reach, the more you take."

## 3.5 用身体走路：`sampleMotion` / `bodySpeed`（第 2054–2095 行）

这里**没有用 AI 模型**，用的是一个简单又快的方法：**帧差法**（frame differencing）。
1. 每 66 毫秒（约每秒 15 次），把摄像头画面缩小成 **48×36** 的小图，变成灰度。
2. 和上一张小图逐点比较，亮度差超过 20 就算"这一点在动"。
3. **只看中间那几列**（第 15 到 33 列），也就是你的身体，不算往两边伸的手臂。
4. **把手挖掉**：ml5 刚看到的每只手（加一点边）和手下面的手臂都不算。所以手怎么动都不会让你开始走或停下，**可以一边走一边砍树、盖楼**。手刚好挡住身体时，保持原本的速度。
5. **要持续才走**：最近 8 次取样里要有 6 次在动（约半秒），一下快动作不会让你前进。
6. 动的点占的比例 = 动作量。
7. **校准**：开始的 2 秒请你站着不动，量出"站着时的噪音"（光线闪烁、镜头噪点），之后把它扣掉。
8. `bodySpeed`：动作量很小 → 0（站着）；中等 → 走路速度；大 → 跑步速度。
9. [ 和 ] 键可以调整灵敏度。

**Q：How does walking on the spot work?**
> "It's frame differencing, not a neural network. Fifteen times a second I shrink the camera image to 48 by 36 pixels in grey, and count how many pixels changed since the last one, only in the middle columns where your body is, and I cut out every hand ml5 finds plus the arm below it. So hand gestures never start or stop walking, and you can cut and build while you walk. It also needs about half a second of steady movement. At the start it calibrates for two seconds to measure the noise when you stand still, and subtracts it. Then the amount of movement maps to standing, walking or running speed."

**Q：Why shrink it to 48×36?**
> "Speed. Reading a full camera image every frame is expensive, and I only need to know roughly how much movement there is. 48 by 36 is about 1,700 pixels, which is almost free."

## 3.6 程序画的树：`makeForest` / `drawBrushTree`（第 268–376 行，forest.js）

**开场时一次画好 12 张树的图**，之后一直重复使用：
- 阔叶树 ×4（绿、深绿、秋天、金色）、白杨 ×2、桉树 ×2、松树 ×2、灌木 ×2。
- **递归画树枝**（`branch` 函数）：一根树枝末端分出 2 到 3 根更短、更细的树枝，每根再继续分，直到够深或够短。每根都稍微弯曲、角度随机，所以看起来自然。
- **在枝头点叶子**：每个枝头周围随机点几十笔小椭圆（dab）。
- **光影**：每笔叶子按它在树冠里的位置，决定颜色深浅（上面和靠光那边比较亮）。然后**从暗到亮依序画**，亮的叶子盖在上面，树冠就有立体感。
- 松树不用树枝，而是把叶子填进一层层的锥形里；灌木是低矮的半圆。
- 最后把树裁剪下来，缩进一张 260×420 的小图，记下树的实际高度比例（`g.top`）。

**`drawBrushTree`**：每帧只要把这张图按距离缩放贴上去，加一个地上的影子，远的再盖一层雾。

`drawForest`（第 790 行）：每块还没建的地都是三排树，种类随机。地块开始建造时，树往下沉；被砍的时候，树朝远离马路的方向倒下、淡出，留下树桩。

**Q：How are the trees made?**
> "They're grown by a recursive branching algorithm: each branch splits into two or three shorter, thinner branches, with a bit of randomness in the angle and curve. Then hundreds of small leaf dabs are painted around the branch tips, shaded by their position and painted from dark to light, so the crown looks round. I paint 12 of these once at the start and reuse them, because growing a tree every frame would be far too slow."

## 3.7 颜色、雾、烟雾和性能（第 435–457 行，`toneN` 第 452 行）

- **`toneN`**：每个颜色在画出来之前都经过三步：按光影调暗或调亮 → 混一点夜色 → 按距离混入雾的颜色（`fogFor`：40 米以外开始起雾，越远越浓）。所以远的东西会融进空气里。
- **烟雾**（`smogK`，world.js 的 `worldUpdate`）：（建筑总数 + 工厂数 × 3）÷ 30，并且慢慢变化。它会让天空颜色（`skyColors`）、雾、太阳都变灰。
- **`drawStreetLife`**：在整个画面上盖一层 30% 的"去饱和"，让颜色比较沉稳，不像卡通。

**性能优化（slides 第 5 页讲的那个）**：
- 问题：因为每个形状都要经过 `toneN`，一帧会做几千次颜色混合。原本每次都用 p5 的 `color()` 把颜色字符串（例如 `'#8b5a2b'`）重新解析一遍，很慢。
- 我测量后发现，颜色处理占了每帧将近一半的时间。
- 解决：**`rgbOf` 缓存**。每个颜色字符串只解析一次，存成 `[r, g, b]` 三个数字放进 Map，之后直接用数字计算混合。雾的颜色（`hazeHex`）也只在夜色或烟雾改变时才重新计算。
- 结果：每帧从约 **9.1 ms 降到 4.7 ms**，画面完全一样。

**其他让它跑得快的做法**：
- 树只画一次，之后重复贴图；
- 街区只在看得到的时候生成，走过了就删掉；
- 摄像头画面先缩到 48×36 再分析；
- 太远或在你身后的东西不画；
- 同时发声的音符最多 40 个（`mvoices`）。

**Q：How did you handle performance?**
> "I profiled it. Every shape passes through a colour function for light, night and fog, so a frame does thousands of colour blends. Each blend was re-parsing a colour string with p5's color(). I cached the parsed RGB values in a Map, so each colour is parsed once and blending is plain arithmetic. The frame time went from about 9.1 to 4.7 milliseconds, with exactly the same picture."

## 3.8 声音：sound.js（第 5–266 行）

**全部用 Web Audio API 即时合成，没有任何音频文件。**

- `class WorldSound`：**一个类别管所有声音**。`_build` 建立音响系统（主音量 → 压缩器 → 喇叭，加上音乐、房子生活声各自的通道），其他方法各自负责一种声音。
- 合成方法：
  - **振荡器**（oscillator：正弦波、三角波、锯齿波）产生音高，用来做音乐、鸟叫、楼层的"咚"；
  - **白噪音 + 滤波器**产生风声、树叶声、斧头声、拍翅声；
  - **包络**（gain 先快速升高再慢慢降低）让每个声音有起伏。
- **斧头**（`chop`）：一下尖锐的砍击 + 木头断裂的一串劈啪 + 树倾倒的吱嘎声 + 倒地的轰隆声。声音会偏向你砍的那一边（立体声 pan）。
- **鸟叫**：几下快速往上滑的高音。出现的概率 ∝ (1 − 发展程度)²，建得越多，鸟越少。
- **音乐跟着发展程度变**（`update`）：
  - 附近建筑 < 30% → 弦乐 + 竖琴（森林）；
  - < 65% → 流行（小镇）；
  - 更多 → house 节拍（城市）。
  - **只在小节结束时切换**，先淡出再淡入，不会突兀。
- **提前排程**（`while (this.nextAt < now + 0.15)`）：音符都提前 0.15 秒排进 Web Audio 的时间线，所以就算画面卡一下，节奏也不会乱。这是 Web Audio 的标准做法。
- **房子里的生活声**（`houseLife`）：离你最近的 3 栋有人住的房子，会发出小孩、狗、钢琴、电视的声音，经过低通滤波，像隔着墙。站着不动时滤波打开，听得比较清楚。工业、停车场和空置高楼没有声音。

**Q：How is the sound made?**
> "Everything is synthesised live with the Web Audio API, with no sound files. Tones come from oscillators, and wind, leaves and the axe come from filtered white noise. The mix follows how built-up the street is around you: the wind and birds fade, traffic rises, and the music switches from strings and harp to pop to a house beat, always at the end of a bar. Notes are scheduled slightly ahead on the audio clock, so the rhythm stays steady even if a frame is slow."

## 3.9 回头看：`drawMirrored`（第 610 行）

按 T 转身，过程 1.1 秒：
- 前半段：摄像机真的转（yaw 从 0 转到 90°）。
- 后半段：把身后的街**镜像**到前面来画：z' = 2A − z，x' = −x（A 是一个街区的边界）。这等于把世界转了 180°，所以可以继续用原本"往前画"的那一套代码。
- 切换的瞬间加一下暗暗的"眨眼"，遮住接缝。
- 镜像时用 `Object.create` 包住原来的对象，只改位置，其他资料（砍了没、建了多少）都照旧读取。

**Q：How does looking back work?**
> "My drawing code only draws what's in front of the camera. So instead of rewriting it, I mirror the street behind you so it lies ahead: z becomes 2A minus z, and x becomes minus x, which is a half turn. A quick dark blink hides the moment it swaps. Everything you cut and built is kept, because the blocks behind you aren't deleted while you look back."

## 3.10 建筑升起的动画、脚手架、提示

- **`riseOf`（第 629 行）**：ease-out-back 缓动曲线，2.4 秒。楼长到顶会稍微超过一点再回来，有"砰"的弹跳感。
- **`lotRise`（第 1893 行）**：建造中的楼按**整层**跳升（不是平滑长高），每升一层轻轻弹一下，所以看得出是一层一层盖的。
- **`drawBuildSite`（第 1902 行）**：建造中的脚手架（钢管、横杆、斜撑、木板、绿色防护网），18 米以上的楼旁边再加一台转动的塔吊；**楼一盖好就马上消失**。
- **`nextText` / `drawNextBar`（第 2247 行）**：画面上方的 NEXT 提示，依情况变化：
  - 附近有空地 → "Lift a hand to build..."；
  - 有森林 → "Swing your left or right hand to cut that side"；
  - 都没有 → "Walk on"。
- **`spawnBirds` / `drawBirds`**：砍树时飞出 6 到 12 只鸟，最多同时 40 只。每只鸟有速度和重力，翅膀用两条线画，会拍动，2.2 秒后淡出。
- **`propWaits`（第 1678 行）**：路灯、行人要等附近有建筑才出现，"森林里没有人住"。
- 每建 10 栋会跳出一句话（`THOUGHTS`）；建到 6 栋时提示可以按 T 回头看。

## 3.11 让它在 p5 编辑器里稳定运行的规则

- 第一行 `// noprotect`：p5 网页编辑器会自动在循环里插入"死循环保护"，它会误伤这个作品里的长循环，所以要关掉。
- 所有循环都加了大括号 `{}`：编辑器的保护对没有大括号的循环会出错。
- 按键存进 `keysHeld` 这个 Set，而不是用 `keyIsDown`：p5 2.x 改了 `keyIsDown`，这样 1.x 和 2.x 都能用。
- 画面绘制包在 `try/catch` 里：就算一个形状出错，作品也不会整个卡住。
- 不用和 p5 内建函数同名的变量名（例如 `key`、`day`），所以小工具函数都加 N 结尾（`mixN`、`easeN`）。
- **无障碍**：画布有 `aria-label` 说明作品和操作方式；每个手势都有键盘替代。

**Q：How did you make it robust?**
> "Every gesture has a keyboard fallback. The camera calibrates itself. If ml5 can't load, it tells you to use the keys. Drawing is wrapped in try/catch so one bad shape can't freeze it. And I followed the p5 editor's rules, like braces on every loop and no names that clash with p5, so it runs in both p5 1.x and 2.x."

---

# 第四部分：其他可能被问到的问题

**Q：Why is there no score or win state?**
> "Because the work is about choice. A score would reward building more. Without one, the only measure is what you notice: the birds leaving, the smog, the empty towers. The counter on the end card isn't a score; it's a bill."

**Q：How does this connect to the theme "Generative Landscape"?**
> "The landscape is generated by rules, the street, trees and buildings, but the player is part of the generative system. You don't watch the landscape change; you are the force that changes it. It's a landscape that answers to a human, which is what happens to real landscapes."

**Q：Why did you change from Monopoly to this?**
> "My tutor's feedback was that the meaning wasn't clear and the interactions should carry it. The Monopoly version explained itself with signs and rules. Here the gestures themselves say it: cutting is a swing, building is a reach. I also removed most of the text, and the piece got clearer."

**Q：How did you keep the code clean?**
> "When I changed direction from Monopoly, I removed everything this piece doesn't run: the old district music, casino, dice and jail sounds, and props that could never appear. It's now four files with one job each: sound, the forest, the street engine and the artwork's rules. Each file is split into labelled sections in the order you meet them. I checked the clean-up by running the old and new versions through the same test: the results and even the pixels of the frame were identical."

**Q：What does "tier" mean in the code?**
> "It's a building's size class, from 0 (a small shop) to 4 (a skyscraper). It sets the colours, height and the kind of sound a home makes. Named styles like cinema or factory sit on top of a tier."

**Q：What would you improve?**
> "First, test with people who've never seen it, to check they understand it without me explaining. Second, more reliable tracking in different light, maybe by recording real hand data and tuning the thresholds from it. Third, I'd like the forest to slowly grow back if you stop building, so restraint has a visible reward too."

**Q：What if the camera doesn't work during the demo?**
> "Every gesture has a key: Z and X chop left and right, press H, S or B to build homes, shops or towers on the side I've cut, and each extra press makes it taller, so cutting the left and pressing H builds only on the left, the up arrow walks, T turns round, F ends, M mutes."

**Q：Who is the audience, and where would it be shown?**
> "Anyone who's watched the forest at the edge of their town disappear. It works best as an installation: a big screen and a webcam, where you stand and use your body. It also runs in any browser with keys."

---

# 第五部分：现场演示的步骤与注意事项

1. **打开网页版**：hedytan.github.io/plotline_interative-media/build（就是最新版，按 F 的结局会按你做了什么而不同：什么都没建 → THE FOREST STAYS；建一点 → A LITTLE OF THE WORLD WE WANTED；建很多 → THE WORLD WE WANTED）。
2. 先点一下画面（声音要点击后才会开始）。
3. 按 **C** 开摄像头 → **站着不动 2 秒**让它校准 → 举起手。
4. 演示顺序：
   1. 原地踏步往前走（之后一边走一边做下面的动作）；
   2. 左手往旁边挥，砍左边；
   3. 举一根食指慢慢往上举，盖住宅；
   4. 张开手举起，盖商店；
   5. 握拳举高，盖高楼；
   6. 按 **T** 回头看；
   7. 按 **F** 看结局。
5. 如果光线不好、手认不到：马上改用键盘（Z / X 砍，按住 H / S / B 盖，T 回头，F 结束），说一句："The camera depends on light, so here's the keyboard version, which does exactly the same."
6. 演示前在同一个房间先测一次摄像头。

---

# 最后：三句一定要会说的话

1. **概念**："Every city was a forest once. The player is the developer, and the gestures carry the meaning: cutting is a swing, building is a reach."
2. **技术**："I wrote my own perspective camera in Canvas 2D, used ml5 hand tracking with ratio-based gesture rules, frame differencing for walking, recursive trees, and synthesised all the sound with Web Audio."
3. **过程**："I measured before I optimised, I changed one thing at a time when tuning gestures, and when my tutor said the meaning was unclear, I cut features instead of adding them."
