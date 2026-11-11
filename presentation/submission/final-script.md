# We Build Our World: Final Presentation Script
# 最终演示讲稿（照老师的流程和时间）

Thursday 12 November 2026, 11:00 – 11:15, CB10.04.430, with Jacob Dawson-Daley.

| 部分 | 时间 | 做什么 |
|---|---|---|
| 1. A2B 演示 | **5 分钟** | 很短的介绍（slides 1–2），然后 slides 3–6：讲一点、马上示范，再讲代码结构 |
| 2. A2B 问答 | 3 分钟 | 老师问作品和代码，回答要快、要短 |
| 3. A2C reflection | 3 分钟 | 没有 slides，只讲领悟和以后的做法 |
| 4. A2C 问答 | 2 分钟 | 老师问 reflection |

**老师的规则（一定要记住）**
- **不能看小卡片或手机上的稿**，会让老师怀疑你不懂代码。这份是在家练习用的。
- 每段只要记住 **🔑 一句话** 和 **〔示范〕的动作**，其他用自己的话讲。
- slides 只是引子，老师想看的是你**懂多少、能示范什么**。

---

## 一句话说清楚：什么把概念和代码连在一起

> **"Every city was a forest once. The meaning is in the gestures: cutting is one careless swing, building is a reach upward, and the code makes the world answer every action, so the cost of building is felt, not read."**

中文：每座城市都曾是森林。意义在手势里：砍树是随手一挥，盖楼是往上伸手；代码让世界回应你的每个动作，所以代价是"感受到"的，不是"读到"的。

**这一句要背熟。** 开头讲一次，代码结构时再讲一次，问答被问到也用它。

---

## 出发前（进教室之前就做好）

- [ ] 笔电充满电，带充电器。
- [ ] 打开网上版本 **hedytan.github.io/plotline_interative-media/build**，按 Cmd + Shift + R 确认是最新版（结局是打印收据）。
- [ ] 点一下画面开声音，音量调好。
- [ ] 按 **C** 开摄像头，**站着不动 2 秒**校准；左手在左、右手在右各举一下，让它学会左右手（镜头面板上会显示 L / R）。
- [ ] 按 **R** 重来一次，停在开场卡片。
- [ ] 另一个分页开好代码（VS Code 或 p5 编辑器），准备秀 `P()`、`handShape`、`growLot`。
- [ ] Slides 开在第 1 页。关掉通知。
- [ ] 在门外等，叫到才进去。

---

# PART 1 — A2B 演示（5 分钟）

### Slide 1 — Title（15 秒）

🔑 名字 + 一句话。

> Hi, I'm Hedy. This is **We Build Our World**, an interactive generative landscape in p5.js. You walk down a street that is all forest, and with your own hands you turn it into a city.

中文：我叫 Hedy，作品是 We Build Our World。你走在一条全是森林的街上，用自己的手把它变成城市。

---

### Slide 2 — Every city was a forest once（30 秒）

🔑 背熟的那一句 + 没有分数。

> Every city was a forest once. You are the developer, and nothing stops you. There's no score and no warning. The meaning is in the gestures: cutting is one careless swing, building is a reach upward. And the code makes the world answer every action, so you feel the cost instead of reading about it.

中文：你是开发商，没有东西阻止你，没有分数也没有警告。意义在手势里，世界会回应每个动作，所以你感受到代价，而不是读到。

---

### Slide 3 — Your body is the tool（约 1 分 30 秒，大部分是示范）

🔑 挥 = 砍，往上举 = 盖；手形 = 种类；高度 = 大小；原地走路 = 前进。

> I'll show you. The webcam goes to **ml5 handPose**, which gives me 21 points on each hand. Each hand works its own side of the street.

〔示范：关掉开场卡片。左手往旁边一挥，砍左边；右手一挥，砍右边。〕

> A quick sideways swing cuts the forest. The trees fall, you hear the axe, and birds fly out.

〔示范：右手举一根食指，慢慢往上举。〕

> Lifting builds, floor by floor. The shape of my hand picks what I build: **one finger is homes**, an **open hand is shops**, a **fist is industry and towers**. The higher I reach, the bigger it gets.

〔示范：张开左手举一下；再握拳举到头顶，盖一栋高楼。〕

> And I move by walking on the spot. The camera sees my body move, not my hands, so I can walk and build at the same time.

〔示范：原地踏步，同时挥手砍一下。〕

> Every gesture also has a key: the arrows cut, and H, S and B build homes, shops and towers, with the same mix of buildings as the hands.

**如果摄像头认不到手**：不要慌，马上用键盘（← / → 砍，连按 H / S / B 盖），说一句：
> "Hand tracking depends on the light, so here's the keyboard. It builds exactly the same things."

---

### Slide 4 — The world answers back（约 1 分钟，大部分是示范）

🔑 烟雾、鸟、声音；T 回头；F 打印收据。

〔示范：用键盘快速多盖几栋，尤其按 B 盖工厂，让天空变灰、音乐变。〕

> As the street fills, the world answers. Every building adds smog, factories most of all, so the warm light turns grey. The birdsong fades into traffic, and the music changes from strings and harp, to pop, to a city house beat. None of this is a sound file; it's all made live.

〔示范：按 T 转身看，停两秒，再按 T 转回来。〕

> T turns me round to see what I made.

〔示范：按 F。〕

> When I decide I'm finished, I press F. I turn round one last time, and a little printer prints a receipt: **The World You Created**, a snapshot of my street, the trees I cut, what I built, and at the bottom, **paid by: the forest**.

〔等收据印完，停一秒让老师看。〕

---

### Slide 5 — How it works: the code structure（约 1 分 15 秒，切到代码）

🔑 四个文件各管一件事；引擎用 hooks 呼叫规则；三个核心函数；效能。

> The code is four files, each with one job: `sound.js` for all the sound, `forest.js` for the painted trees, `sketch.js` is the street engine, and `world.js` is the artwork's rules. The engine only knows how to draw a street; it calls a few named hooks in `world.js`, so the rules can change without touching the engine.

〔示范：切到代码。〕

> Three functions carry the piece:

1. **`P(x, y, z)` in sketch.js** — 〔指着 `rx * cam.f / rz` 那行〕
> "My own perspective camera on a flat 2D canvas: every point is moved relative to the camera, turned by where I look, and divided by its distance. Far things get smaller. Everything is drawn far to near, like a painter."

2. **`handShape` in world.js** — 〔指着判断 fist / point / open 的三行〕
> "For each finger I compare the tip's distance to the wrist with the middle joint's. A straight finger reaches past the joint, a curled one folds back. That gives one finger, open hand or fist, and it works near or far."

3. **`growLot` in world.js** — 〔指着 `growLot` 和 `floorUp`〕
> "The upward movement of my hand becomes floors. Each new floor plays a thud; at the top the building is counted, and that count drives the smog, the sound and the receipt."

> Everything is generated: the street from a seeded random generator, the trees grown recursively and painted in leaf dabs, 24 kinds of building. And I profiled it: colour mixing took half of every frame, so I cached it, and each frame now takes half the time.

---

### Slide 6 — Demo video / What it leaves you with（15 秒）

🔑 收尾三点，然后交给老师。

> So: the meaning is in the moves, every choice is answered in light, air and sound, and there's no goal to win. You decide when it's enough. The video here is a backup recording. I'm happy to take questions.

（现场示范都顺利的话，影片不用播。）

**时间检查**：1:15 → slides 1–2，再 3:45 → slides 3–6。练习时用计时器，超过 5 分钟就把 slide 5 的第三个函数拿掉。

---

# PART 2 — A2B 问答准备（3 分钟，回答要快）

**回答原则：先一句话直接答，再补一个细节；需要时马上秀代码或示范。** 不知道就说 "I'm not sure, but I'd check it by…"。

### 概念

**Q: What unifies your concept and your code?**
> "The gestures. Cutting is one careless swing and building is a reach upward, so the body acts out the idea. Then the code makes the world answer: birds leave, smog builds, the music turns into a city."

**Q: Why no score or win state?**
> "A score would reward building more, which is the opposite of the point. The receipt isn't a score, it's a bill. You decide when it's enough."

**Q: Why a receipt at the end?**
> "Because building always has a cost. The receipt lists what you took and says who paid: the forest. It also changes with what you did: build nothing and the forest stays."

**Q: Why did you change from the Monopoly version?**
> "The feedback was that the meaning was unclear and the interaction should carry it. The Monopoly version explained itself with signs. Here the gestures say it, so I could remove most of the text."

**Q: How is it a generative landscape?**
> "The street is generated by rules: seeded blocks, recursive trees, random buildings from the family your hand picks. And you are part of the system: you are what changes the landscape."

### 手势和摄像头

**Q: How do you read the hand shape?**
> "ml5 gives 21 points per hand. For each finger I compare tip-to-wrist with joint-to-wrist: straight or curled. Only the index straight is one finger, three or more straight is an open hand, none is a fist. An unclear shape builds nothing, and a new shape must be seen three frames in a row."

**Q: How do you know which hand is left or right?**
> "ml5 labels each hand Left or Right, but what that means depends on the camera, so the sketch learns it in the first few seconds from hands seen clearly on one side. After that your right hand always works the right side, even across the middle."

**Q: How is a chop detected?**
> "A sideways move of more than 18% of the picture within 0.4 seconds, and more sideways than vertical, so lifting never counts as chopping."

**Q: How does walking on the spot work? Is it machine learning?**
> "No, it's frame differencing. About 15 times a second I shrink the camera image to 48 by 36 grey pixels and count how many changed, only in the middle, with the hands and arms masked out. So hand gestures don't move you, and you can walk and build at once. It calibrates for two seconds at the start."

**Q: Why do the keys build the same things as the hands?**
> "Both call the same function, `makeBuilt`. With the hand, height picks the size; with the keys, the number of presses does. Each lot also leans a bit bigger or smaller, so next-door buildings differ."

### 画面和代码

**Q: How does the 3D work without WEBGL?**
> "My own function `P`: move the point relative to the camera, rotate by the view, divide by distance. Then I draw far to near. `clipNear` cuts shapes that cross behind the camera so they never flip."

**Q: Why not WEBGL?**
> "I tried a WEBGL version; it looked like a game engine. I wanted a painted look, and drawing every shape myself on the 2D canvas gave me that control."

**Q: How is the street generated and endless?**
> "48-metre blocks, made only when they come into view from a seeded random generator, and deleted when they're far behind. Same seed, same block, so when you turn round the street is exactly as you left it."

**Q: How are the trees made?**
> "Recursively: a branch draws itself, then two or three shorter, thinner branches. Then hundreds of leaf dabs, painted dark to light. Twelve trees are painted once at the start and reused."

**Q: How is the sound made?**
> "All synthesised with the Web Audio API: oscillators, filtered noise for wind and the axe, envelopes for each sound. One number, how built-up the street is, crossfades birds into traffic and picks the music style."

**Q: How does smog work?**
> "Buildings plus three times the factories, divided by thirty. It greys the sky, the clouds, the sun and the fog."

**Q: How did you make it run smoothly?**
> "I profiled it. Turning colour strings into colour objects took half of every frame. I parse each colour once and cache it: 9.1 milliseconds down to 4.7, same picture."

**Q: How is the code organised?**
> "Four files with one job each; the engine calls the artwork's rules through a few named hooks."

### 刁钻的追问

**Q: Show me where the hand shape is decided.** 〔打开 world.js，搜 `handShape`。〕

**Q: What happens if the camera fails?**
> "Every gesture has a key, the camera calibrates itself, and if ml5 can't load it tells you to use the keys. Drawing is wrapped in try/catch, so one bad shape can't freeze it."

**Q: What are its limitations?**
> "Hand tracking depends on light and distance, and I still need to test with more strangers to know they read it the way I intend."

**Q: What would you add with more time?**
> "Let the forest slowly grow back when you stop building, so restraint has a visible reward."

---

# PART 3 — A2C Reflection（3 分钟，没有 slides）

🔑 不讲流水账，只讲**领悟**和**以后的做法**。老师手上有你的 750 字。照这个顺序：

**开头（10 秒）**
> My reflection has two key features and what they taught me about my practice.

**领悟一：交互的 bug 藏在算法和真实身体之间（约 1 分钟）**
> Chopping kept failing, and the problem wasn't the model, it was my rules. I assigned hands by which half of the picture they were in, so one swing across the middle became two half-swings. Then I over-corrected with a big rewrite that changed many thresholds at once, and it felt worse. I rolled back with version control and re-applied only two small fixes.
>
> **For my practice:** test with a real camera and real people early, change one thing at a time, and commit small working steps so I can always go back. Even this week, testing with my own hands led me to change the gestures, let walking and building happen together, and teach the sketch which hand is which.

**领悟二：让世界回应，而不是用文字解释（约 1 分钟）**
> My first version was a Monopoly street full of signs and scores, and the feedback was that the meaning was unclear. I pivoted to forest-to-city and removed most of the text. The piece became calmer and clearer, because a consequence you cause yourself is more persuasive than a slogan. The pivot also showed old Monopoly code still running; removing it and caching colours made every frame twice as fast.
>
> **For my practice:** prototype the core interaction first and check people understand it before adding detail; write down what the player should feel and judge every feature against it; remove old code as soon as the direction changes.

**结尾（20 秒）**
> Overall it reaches its main aim: the cost of building is felt rather than read. The biggest lessons were about process: simplify the message until the interaction carries it, test with real bodies early, and use version control as a safety net that makes bold decisions possible.

---

# PART 4 — A2C 问答准备（2 分钟）

**Q: What was the most important thing you learned?**
> "That interaction bugs live between the algorithm and a real body, so I have to test with real people and change one thing at a time."

**Q: What will you do differently in your next project?**
> "Prototype the core interaction first, test it with strangers before adding visuals, and record real data to tune thresholds instead of guessing."

**Q: Why were you proud of the pivot if you lost days of work?**
> "Because the work became clearer. The Monopoly version told people what to think; this one lets them do it and feel it. The days weren't wasted: the engine stayed and only the rules changed."

**Q: How did version control help?**
> "When my big rewrite made the gestures worse, I could go straight back to the version that felt right and re-apply only the fixes that mattered."

**Q: Does the final work meet your original goal?**
> "Mostly: the cost of building is felt, not read. What I still don't know is whether strangers read it the way I intend, so that's the next test."

**Q: What surprised you?**
> "How much removing things helped: less text, fewer features, and the meaning got stronger."

**Q: How would you test it with users?**
> "Watch strangers play without instructions, note where they hesitate, then ask them in one sentence what it was about, and compare that with my intended sentence."

---

## 最后提醒
- 讲的时候**看老师、看作品**，不要看稿。
- 示范比讲话重要：**讲一句，马上做给他看**。
- 被问到不会的，诚实说你会怎么查，比乱答好。
- 背熟那一句："The meaning is in the gestures… felt, not read."
