# We Build Our World: Full 15-Minute Presentation Script
# 完整 15 分钟讲稿（演示 + 问答 + reflection + 问答）

Thursday 12 November 2026, 11:00 - 11:15, room CB10.04.430, with Jacob Dawson-Daley.

| # | Part | Time | Clock |
|---|---|---|---|
| 1 | A2B presentation (slides 1-6, live demo) | 5 min | 11:00 - 11:05 |
| 2 | A2B Q&A | 3 min | 11:05 - 11:08 |
| 3 | A2C reflection (2 reflection slides) | 3 min | 11:08 - 11:11 |
| 4 | A2C Q&A | 2 min | 11:11 - 11:13 |
| | spare | 2 min | |

**The one sentence to remember (say it in slide 2, slide 6 and whenever asked "what is it about"):**

> Every city was a forest once. The meaning is in the gestures: cutting is one careless swing, building is a reach upward, and the code makes the world answer every action, so the cost of building is felt, not read.

**Tutor's rules:** no palm cards or phone script; short intro, then explain and demo straight away; describe the code structure briefly, highlight technical accomplishments, don't walk through every line; say how it meets the objectives and its impact on the audience; reflection = insights and future practice, not a story.

---

## Before you go in (准备清单)

- [ ] Laptop charged, charger in the bag.
- [ ] Open **hedytan.github.io/plotline_interative-media/build**, press **Cmd + Shift + R** (latest version: receipt ending, slow smog).
- [ ] Click the picture once so sound starts; set the volume.
- [ ] Press **C** for the camera, **stand still 2 s** while it calibrates. Raise both hands apart once (left and right) so it learns which is which.
- [ ] Press **R** to start again; leave it on the opening card.
- [ ] Second tab: `sketch-all.js` open (p5 editor or VS Code) for slide 5 / questions.
- [ ] Slides open on slide 1. Notifications off.
- [ ] Reflection slides (`We Build Our World - A2C reflection slides.pptx`) open in a second window, ready for Part 3.
- [ ] Wait outside until you are called.

## Controls (backup if the camera fails)

| Hand | Key | What happens |
|---|---|---|
| Swing left / right hand sideways | **Left / Right arrow** | Cut the forest on that side |
| Lift one finger | **H** | Homes |
| Lift an open hand | **S** | Shops |
| Lift a fist | **B** | Industry and towers |
| Lift higher | Press again (1 press = chest, 2 = above your head) or hold | Bigger building |
| Walk on the spot | **Up arrow** (fast), W | Walk down the street |
| | **T** | Turn round and look back |
| | **F** | Finish: the receipt prints |
| | **C** / **M** / **R** | Camera / sound / start again |

---

# PART 1: A2B PRESENTATION (5 minutes)

## Slide 1: Title (15 s)

Hi, I'm Hedy. This is **We Build Our World**, an interactive generative landscape made in p5.js. You walk down a street that is all forest, and with your own hands you turn it into a city.

## Slide 2: Every city was a forest once (30 s)

Every city was a forest once. In this piece you are the developer, and nothing stops you. There's no score and no warning.

My objective was to make the cost of development something you **feel through your own actions**, not something you read on a sign. The meaning is in the gestures: cutting is one careless swing, and building is a reach upward. The code makes the world answer every action.

It's made for anyone who has watched the forest at the edge of their town disappear under new buildings: people in growing cities, students, gallery visitors. You need no instructions and no gaming skill, just your hands.

## Slide 3: Your body is the tool (about 1:30, mostly demo)

Let me show you. The webcam feeds **ml5 handPose**, which gives me 21 points on each hand. Each hand works its own side of the street.

*[Demo: close the opening card. Swing the left hand sideways, then the right hand.]*

A quick sideways swing cuts the forest. The trees fall, you hear the axe, and the birds fly away.

*[Demo: raise one finger on the right hand and lift slowly.]*

Lifting builds, floor by floor. The shape of my hand picks what I build: **one finger builds homes**, an **open hand builds shops**, and a **fist builds industry and towers**. The higher I reach, the bigger the building.

*[Demo: lift an open left hand; then lift a fist above your head for a tall tower.]*

I move forward by walking on the spot. The camera watches my body, not my hands, so I can walk and build at the same time.

*[Demo: walk on the spot and swing once while walking.]*

Every gesture also has a key: the left and right arrows cut, the up arrow walks fast, and H, S and B build homes, shops and towers, with the same mix of buildings as the hands.

**If the camera can't see your hands:**
> Hand tracking depends on the light, so here's the keyboard. It builds exactly the same things.

## Slide 4: The world answers back (about 1:00, mostly demo)

*[Demo: keep building while you talk; press B a few times for factories. From about 5 buildings the sky starts to grey, and it deepens slowly as you go on.]*

As the street fills up, the world answers. Every building adds a little smog, factories most of all, so the warm golden light slowly turns grey and a haze of smoke settles over the horizon. The birdsong fades into traffic, and the music changes from strings and harp, to pop, to a city house beat. None of this is a sound file; it is all synthesised live.

*[Demo: press T, wait two seconds, press T again.]*

T turns me round to look at what I've made.

*[Demo: press F.]*

When I decide I'm finished, I press F. I turn round one last time, and a small printer prints a receipt: **The World You Created**, a snapshot of my street, the trees I cut down, what I built, and at the bottom, **Paid by: the forest**.

*[Wait for the receipt to finish printing. Pause one second.]*

## Slide 5: How it works, key technical accomplishments (about 1:00)

*Highlights only. Don't walk through code line by line; open the code only if asked.*

Four things I'm proud of technically.

**First, the whole body is the controller, with just a webcam.** ml5 handPose finds both hands, and I read their shape from the finger joints, so one finger, an open hand and a fist mean three different things. Walking on the spot is detected separately by comparing camera frames, with the hands masked out, so you can walk and build at the same time. No extra hardware.

**Second, a 3D street on a flat 2D canvas.** I wrote my own perspective camera instead of using WEBGL, because I wanted it to look painted, like an illustration, while still feeling like you walk down a real street.

**Third, everything is generated, nothing is a file.** The trees grow branch by branch and are painted in leaf strokes, 24 kinds of building are drawn by code and picked at random, and all the sound, birds, wind, the axe and the music, is synthesised live with the Web Audio API. Zero photos, zero recordings.

**Fourth, it's clean and fast.** Four files with one job each: sound, forest, the street engine and the artwork's rules. And I measured where each frame's time went, fixed the slowest step, and made it run twice as fast.

## Slide 6: Objectives and impact (about 30 s)

So, how does it meet my objectives?
- **The meaning is in the moves.** You don't need to read anything; cutting is a swing, building is a reach.
- **The cost is felt, not read.** Every choice is answered in light, air and sound, and the receipt says who paid: the forest.
- **There's no goal to win.** The work hands you the question: when is it enough?

The impact I hope for: people walk away a little more aware of what was there before the buildings, and next time they see a forest cleared for a new estate, they remember that it only took one swing.

The video is a backup recording. I'm happy to take questions.

*(If over 5 minutes in practice, shorten slide 5 to the first and third points.)*

---

# PART 2: A2B Q&A (3 minutes)

Answer in one sentence first, then add one detail. Show the code or demo if you can. If you don't know: "I'm not sure, but I'd check it by..."

## Concept

**Q: What unifies your concept and your code?**
The gestures. Cutting is one careless swing and building is a reach upward, so the body acts out the idea. Then the code makes the world answer: the birds leave, the smog builds up, and the music turns into a city.

**Q: Does it meet your original objectives?**
Yes. The objective was to make the cost of development felt through your own actions. The gestures carry the meaning without text, every action changes the light, the air and the sound, and the receipt makes the cost visible at the end. What I still want to test is whether strangers read it the same way.

**Q: Who is it for, and what impact do you hope it has?**
Anyone who has watched forest at the edge of their town turn into new buildings. It needs no instructions or gaming skill, so it works in a gallery. I hope people leave more aware of what was there before, and of how easy it is to take it.

**Q: Why is there no score or win state?**
A score would reward building more, which is the opposite of the point. The receipt isn't a score, it's a bill. You decide when it's enough.

**Q: Why a receipt at the end?**
Because building always has a cost. The receipt lists what you took and says who paid: the forest. It changes with what you did; if you build nothing, the forest stays.

**Q: Why did you move away from the Monopoly version?**
The feedback was that the meaning was unclear and the interaction should carry it. The Monopoly version explained itself with signs. Here the gestures say it, so I could remove most of the text.

**Q: How is it a generative landscape?**
The street is generated by rules: seeded blocks, recursive trees, and random buildings from the family your hand picks. And you are part of the system: you are what changes the landscape.

## Hands and camera

**Q: How do you read the hand shape?**
ml5 gives 21 points per hand. For each finger I compare tip-to-wrist with joint-to-wrist to see if it's straight or curled. Only the index straight is one finger, three or more straight is an open hand, and none is a fist. An unclear shape builds nothing, and a new shape has to be seen three times in a row.

**Q: How do you know which hand is left or right?**
ml5 labels each hand Left or Right, but what that means depends on the camera, so the sketch learns it whenever both hands are in the picture, far apart. With one hand, it uses where the hand is, and a moving hand keeps its side, so a swing across the middle still cuts its own side.

**Q: How is a chop detected?**
A sideways movement of more than 18% of the picture within 0.4 seconds, and more sideways than vertical, so lifting never counts as chopping.

**Q: How does walking on the spot work? Is it machine learning?**
No, it's frame differencing. About 15 times a second, I shrink the camera image to 48 by 36 grey pixels and count how many changed, only in the middle, with the hands and arms masked out. So hand gestures don't move you, and you can walk and build at the same time. It calibrates for two seconds at the start.

**Q: Do the keys build the same things as the hands?**
Yes. A key press is treated exactly like one lift of the hand: one press is a lift to the chest, two presses reach above the head. Both go through the same functions, `makeBuilt` for the look and `growLot` for the floors, and each lot leans a little bigger or smaller, so neighbouring buildings differ.

## Visuals and code

**Q: How does the 3D work without WEBGL?**
My own function `P`: move the point relative to the camera, rotate it by the view, and divide by the distance. Then I draw from far to near. `clipNear` cuts shapes that cross behind the camera so they never flip.

**Q: Why not WEBGL?**
I tried a WEBGL version, but it looked like a game engine. I wanted a painted look, and drawing every shape myself on the 2D canvas gave me that control.

**Q: How is the street generated, and why is it endless?**
It's made of 48-metre blocks, created only when they come into view, from a seeded random generator, and deleted when they're far behind. Same seed, same block, so when you turn round, the street is exactly as you left it.

**Q: How are the trees made?**
Recursively: a branch draws itself, then two or three shorter, thinner branches. Then hundreds of leaf dabs are painted from dark to light. Twelve trees are painted once at the start and reused.

**Q: How is the sound made?**
It's all synthesised with the Web Audio API: oscillators, filtered noise for the wind and the axe, and envelopes for each sound. One number, how built-up the street is, crossfades the birds into traffic and picks the music style.

**Q: How does the smog work?**
Every building adds to it and a factory counts three times. It builds up slowly: a light grey at about five buildings, full smog at twenty. It greys the sky, dims the sun and the light, and puts a smoke haze over the horizon.

**Q: How did you make it run smoothly?**
I profiled it. Turning colour strings into colour objects took half of every frame. Now I parse each colour once and cache it: 9.1 milliseconds down to 4.7, with the same picture.

**Q: How is the code organised?**
Four files with one job each; the engine calls the artwork's rules through a few named hooks.

## Harder questions

**Q: Show me where the hand shape is decided.**
*[In `sketch-all.js` press Cmd + F, type `function handShape` (line 2016). The three lines that decide fist / point / open are 2021-2023.]*

**Q: What happens if the camera fails?**
Every gesture has a key, the camera calibrates itself, and if ml5 can't load, it tells you to use the keys. Drawing is wrapped in try/catch, so one bad shape can't freeze the sketch.

**Q: What are its limitations?**
Hand tracking depends on light and distance, and I still need to test with more strangers to know they read it the way I intend.

**Q: What would you add with more time?**
Let the forest slowly grow back when you stop building, so restraint has a visible reward.

---

# PART 3: A2C REFLECTION (3 minutes, 2 slides)

Talk about insights and future practice, not the whole story. Switch to the reflection slides.

## Reflection slide 1: The bugs were between the code and the body

**Opening (10 s)**
My reflection has two key insights, and what they taught me about my practice.

**Insight 1: Interaction bugs live between the algorithm and a real body (about 1 min)**
Chopping kept failing, and the problem wasn't the model, it was my rules. I assigned hands by which half of the picture they were in, so one swing across the middle became two half-swings. Then I over-corrected with a big rewrite that changed many thresholds at once, and it felt worse. I rolled back with version control and re-applied only two small fixes.

For my practice: I'll test with a real camera and real people early, change one thing at a time, and commit small working steps so I can always go back. Even this week, testing with my own hands led me to change the gestures, let walking and building happen together, and teach the sketch which hand is which.

*(Point to the dark box: FOR MY PRACTICE.)*

## Reflection slide 2: Let the world answer, not the words

*(Point to the BEFORE picture, then the NOW picture.)*

**Insight 2: Let the world answer instead of explaining with words (about 1 min)**
My first version was a Monopoly street full of signs and scores, and the feedback was that the meaning was unclear. I pivoted to forest-to-city and removed most of the text. The piece became calmer and clearer, because a consequence you cause yourself is more persuasive than a slogan. The pivot also showed that old Monopoly code was still running; removing it and caching colours made every frame twice as fast.

For my practice: I'll prototype the core interaction first and check that people understand it before adding detail; write down what the player should feel and judge every feature against it; and remove old code as soon as the direction changes.

*(Point to the gold line at the bottom.)*

**Closing (20 s)**
Overall, the work reaches its main aim: the cost of building is felt rather than read. The biggest lessons were about process: simplify the message until the interaction carries it, test with real bodies early, and use version control as a safety net that makes bold decisions possible.

---

# PART 4: A2C Q&A (2 minutes)

**Q: What was the most important thing you learned?**
That interaction bugs live between the algorithm and a real body, so I have to test with real people and change one thing at a time.

**Q: What will you do differently in your next project?**
Prototype the core interaction first, test it with strangers before adding visuals, and record real data to tune thresholds instead of guessing.

**Q: Why are you proud of the pivot if you lost days of work?**
Because the work became clearer. The Monopoly version told people what to think; this one lets them do it and feel it. And the days weren't wasted: the engine stayed, and only the rules changed.

**Q: How did version control help?**
When my big rewrite made the gestures worse, I could go straight back to the version that felt right and re-apply only the fixes that mattered.

**Q: Does the final work meet your original goal?**
Mostly. The cost of building is felt, not read. What I still don't know is whether strangers read it the way I intend, so that's the next test.

**Q: What surprised you?**
How much removing things helped: less text, fewer features, and the meaning got stronger.

**Q: How would you test it with users?**
I'd watch strangers play without instructions, note where they hesitate, then ask them to say in one sentence what it was about, and compare that with my intended sentence.

---

# APPENDIX: Where the main code is in `sketch-all.js`

Don't memorise line numbers: press **Cmd + F** and type `function` + the name.

| What | Function | Line |
|---|---|---|
| All the sound (Web Audio) | `class WorldSound` | 24 |
| Trees grown recursively, painted in leaf dabs | `makeForest` | 277 |
| Seeded random numbers | `rngN` | 423 |
| Colour cache (speed-up) | `rgbOf` | 435 |
| **Perspective camera** (key line `rx * cam.f / rz` at 480) | `P` | **476** |
| Clipping shapes behind the camera | `clipNear` | 485 |
| 48 m street blocks | `chunkAt` | 516 |
| Main loop each frame (up arrow at 559) | `draw` | 555 |
| Sky colours and smog | `skyColors` | 648 |
| Draw the street far to near | `drawWorld` | 747 |
| Rules each frame (smog speed at 1693) | `worldUpdate` | 1689 |
| Cutting the forest | `chopForest` | 1702 |
| Picking a building's look | `makeBuilt` | 1743 |
| A real lift only | `deliberateLift` | 1779 |
| Hand shape to building kind | `kindOf` | 1787 |
| Hands and held keys each frame | `handUpdate` | 1797 |
| Key presses | `tapBuild` | 1870 |
| **Floor by floor** (floor sound at 1883) | `growLot` | **1879** |
| Scaffolding and crane | `drawBuildSite` | 1903 |
| Camera and ml5 start | `startHands` | 1950 |
| Left / right hand | `gotHands` | 1976 |
| **Hand shape** (decision at 2021-2023) | `handShape` | **2016** |
| Swing = chop | `handFeedSide` | 2027 |
| Walking on the spot (frame differencing) | `sampleMotion` | 2058 |
| Grey, dim light and smoke haze | `drawStreetLife` | 2206 |
| The receipt | `drawReceipt` | 2327 |
| Finish (F) | `endWalk` | 2387 |
| All keys | `worldKey` | 2402 |

---

# Final reminders

- Don't read from notes on the day. Look at the tutor and at the work.
- Say one line, then show it. The demo matters more than the words.
- Start building during slide 3, so the sky is already greying when you reach slide 4.
- If you don't know an answer: "I'm not sure, but I'd check it by..."
- Practise at home with a timer: presentation under 5 minutes, reflection under 3.
