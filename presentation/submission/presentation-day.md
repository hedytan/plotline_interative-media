# Presentation Day: We Build Our World
# 演示当天要注意的事

## 时间和地点

| | |
|---|---|
| **日期** | 2026 年 11 月 12 日，星期四 |
| **时间** | 上午 11:00 – 11:15（一共只有 15 分钟） |
| **地点** | CB10.04.430（UTS 10 号楼，4 楼，430 室） |
| **老师** | Jacob Dawson-Daley |

- 出发前再看一次**学校 Outlook 日历**，地点如果有变会更新在那里（转发的日历不一定会更新）。
- **10:45 左右到**，在门外等。**不要自己进去**，前一位同学可能还在演示，等有人叫你再进。

---

## 出发前（在家或到之前就做好）

- [ ] 笔电**充满电**，带充电器。
- [ ] 到门口之前，**笔电已经开机、登入、作品已经打开在跑**，不要进教室才开机。
- [ ] 打开网上版本：**hedytan.github.io/plotline_interative-media/build**（https，摄像头可以用）。
- [ ] 先点一下画面让**声音**开始，音量调到适中。
- [ ] 按 **C** 打开摄像头，**站着不动 2 秒**让它校准，再试一次挥手砍树、举手盖楼。
- [ ] 另开一个分页，打开**代码**（p5 编辑器或 VS Code），准备好秀 `P()`、`gotHands`、`handUpdate`。
- [ ] Slides 打开在第 1 页；demo 影片当**备用**，现场演示失败时才播。
- [ ] 关掉其他程序和通知（微信、Messages 等）。
- [ ] 如果要用鼠标，在门外就先接好。

---

## 15 分钟大概怎么分配

| 时间 | 做什么 |
|---|---|
| 约 1 分钟 | **简短介绍**（slides 1–2）：作品是什么，一句话讲概念 |
| 约 5 分钟 | **讲一点、马上示范**（slides 3–6）：手势 → 世界的回应 → 代码结构 |
| 中间穿插 | **老师提问**（会问很多、很快） |
| 约 3 分钟 | **Reflection**（没有 slides）：领悟和以后的改进 |

---

## 老师的五个重点

### 1. 准备好再进去
笔电开好、作品在跑才到门口；在外面等人叫你。

### 2. 不要看稿
- **不能用小卡片或手机看讲稿**，老师会怀疑你不懂自己的代码。
- 讲稿和代码解说是**在家练习用的**。现场用自己的话讲，不用背一字不差。

### 3. Slides 只是引子
- 介绍要**短**，老师想看的是你懂多少。
- 讲清楚**什么把你的概念和代码连在一起**：
  > "The meaning is in the gestures. Cutting is one careless swing, building is a reach upward, and the code makes the world answer every action: birds leave, smog builds up, the music turns into a city."

### 4. 讲一点，马上示范
最后 3 到 4 页 slides，每页讲完**马上做给老师看**：

| Slide | 说一句 | 马上示范 |
|---|---|---|
| 3 手势 | "Your body is the tool." | 边踏步边挥手砍树；一根手指盖住宅、张开手盖商店、握拳盖高楼 |
| 4 世界的回应 | "The world answers back." | 盖几栋，看天空变灰；按 **T** 回头；按 **F** 看结局 |
| 5 怎么运作 | "Four files, one job each; the engine calls the rules through hooks." | 切到代码，指出 `P()`（透视）、`handShape`（手势）、`handUpdate`（盖楼） |
| 6 Demo video | （备用） | 现场失败时才播 |

摄像头认不到手的时候不要慌，马上用键盘（← / → 或 Z / X 砍，按 H 住宅 / S 商店 / B 高楼，多按几下越来越高，只在砍过的那一边盖；T 回头，F 结束，M 声音），说一句：
> "The camera depends on the light, so here's the keyboard version. It does exactly the same."

### 5. Reflection：讲领悟，不讲流水账
- 老师手上有你那份 750 字的文件，会请你带他们走一遍。**没有 slides。**
- **不要从头讲发生了什么**，只讲最重要的领悟，以及以后做作品会怎么改进。
- 三个要记住的重点：
  1. **交互的 bug 藏在算法和真实身体之间。** 一只手挥过画面中间，被拆成两次半截的挥动，结果砍不到树。以后要早点用真的摄像头、找不同的人测试，一次只改一个参数。
  2. **删掉功能，反而更清楚。** 从 Monopoly 改成森林以后，画面和意思都变清楚了。以后先确认核心交互看不看得懂，再加细节。
  3. **"有意义"和"可靠"是两回事，缺一不可。** 手势要能带出意思，也要每次都有反应，所以每个手势都有键盘备用。

---

## 最可能被问到的问题（练到能马上回答）

| 问题 | 一句话答案 |
|---|---|
| How does the 3D work? | "My own perspective function: every point is divided by its distance, so far things get smaller." |
| How do you read the hand? | "ml5 gives 21 points per hand; for each finger I compare the tip and the middle joint's distance to the wrist: one finger = homes, open = shops, fist = towers." |
| How is a chop detected? | "A sideways move of more than 18% of the picture within 0.4 s, more sideways than vertical." |
| How does walking work? | "Frame differencing on a 48 by 36 grey copy of the camera, only the middle, with the hands cut out, so you can walk while you build." |
| How is it generative? | "Seeded random blocks, recursive trees, and random buildings from the family your gesture picks." |
| How did you make it fast? | "I profiled it: colour parsing took half of each frame; caching colours made it twice as fast." |
| How is the code organised? | "Four files with one job each; the engine calls the rules through a few named hooks." |
| Why no score? | "A score would reward building more. The counter is a bill, not a score." |

完整答案在 `code-walkthrough.md` 的第五部分。

---

## 版本提醒
现场演示的最好就是你交的那份代码。
- 交的是新的 `we-build-our-world-code.zip`：和网上版本一样，没问题。
- 交的还是旧的 `A2B code.zip`：被问到时就说明代码后来整理过（文件名不同），功能一样。
