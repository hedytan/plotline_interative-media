# We Build Our World: speaking script (A2B, about 5 minutes)

Read at a calm pace. Times are a guide; the whole script is about 5 minutes.

---

## Slide 1: We Build Our World (0:00 to 0:30)

Hi, I'm Hedy. My project is **We Build Our World**, an interactive generative landscape made in p5.js.

What you see here is where every visit starts: a street, and on both sides of it, forest. Nothing is
built yet.

In the next five minutes I'll show you the idea, how your body becomes the tool that changes this
place, how the world answers back, and the technical work underneath it. Then a 30-second clip of a
full run.

## Slide 2: Every city was a forest once (0:30 to 1:20)

The concept in one line: every city was a forest once, and we build our world the way we want it.

The person in front of the screen is the developer. You start on the left image: a street lined with
painted forest, birdsong, warm light. You end wherever you choose to stop, often somewhere like the
right image: row houses, towers, a grey sky.

The work never tells you you're doing something wrong. There is no score to win and no warning. It
simply lets you build, and makes sure you notice what that costs.

The objective was to make the cost of development something you **feel through your own actions**,
rather than something you read on a sign.

It is made for **anyone who has watched the forest at the edge of their town disappear under new buildings**: people
who live in growing cities, students, gallery visitors. You need no instructions and no gaming skill,
just your hands.

## Slide 3: Your body is the tool (1:20 to 2:10)

The interaction carries the meaning. I use ml5 hand tracking on the webcam, and every gesture was
chosen for what it says.

- **Cutting the forest is a single swing of the arm.** It should feel too easy.
- **Building is lifting.** The higher you reach, the bigger the building, so greed is literally a
  reach upward.
- **The shape of your hand picks what you build.** One finger makes homes, from a log cabin to
  colourful row houses to condos with trees on the balconies. An open hand makes shops, from a
  diner to a cinema to a mall called Forest Plaza. A fist makes industry: car parks, substations,
  power stations, and towers that stand empty, with names like Forest View Apartments.
- **You move by walking on the spot**, so the whole body is involved, and you can cut and build
  while you walk.

Each hand works its own side of the street. The interface stays out of the way, but you are never
lost: a **NEXT bar** at the top always tells you the one thing to do now, the **camera panel** shows
where your hands are and what each will build, the camera **calibrates itself** when it starts, and
every gesture has a **keyboard key** as a backup.

## Slide 4: The world answers back (2:10 to 3:00)

Every action is answered, so you feel the consequence without being told.

In the forest the light is warm and golden. As the street fills, every building, especially
factories and power stations, adds smog, and the sky turns grey. When you chop, birds burst out of
the trees and fly away.

You can press **C** at any time to turn round and look at the street behind you. When you decide
you're finished, the end card counts it up: how many trees, how many homes, shops and towers. And
then: *listen, the birds have stopped.*

The sound makes the same journey. It starts with wind, leaves, birdsong and a slow strings-and-harp
piece; as you build, the wild sounds fade, traffic rises, and the music changes to pop and then a
city house beat.

## Slide 5: How it works (3:00 to 4:00)

Here is how it works, in simple terms.

- **It sees your hands.** The webcam finds both of your hands and reads their shape (one finger, an
  open hand or a fist), using a hand-tracking tool called ml5.
- **It feels you walk.** When you step on the spot, the camera notices the movement and the street
  moves with you.
- **A painted street.** It is drawn flat, like an illustration, but it feels like walking down a real
  street. Nothing in it is a photo or a recording.
- **Trees made by code.** The program grows each tree branch by branch and paints it in hundreds of
  little leaf strokes.
- **Buildings made by code.** There are 24 kinds of building, from a log cabin to a cinema to a power
  station with steaming towers, all drawn by the program and picked at random, so no two streets are
  the same.
- **Sound made by code.** The birds, the wind, the axe and the music are all created live as you play.

The code is split into small files that each do one job, with notes explaining it and a guide for
anyone who opens the folder.

And it runs smoothly: I measured where the time goes in each frame, found that mixing colours took
almost half of it, and rewrote that part. Every frame now takes about half the time (9 milliseconds
down to under 5), with exactly the same picture.

## Slide 6: Demo video (4:00 to 5:00)

*[Play the clip: 30 seconds, with sound.]*

Here is a full walk: the forest, chopping both sides, homes rising floor by floor in scaffolding, a
tall tower with a crane, shops and a cinema, and at the end the turn round to the card. Listen too:
the birds and wind at the start, the axe, the building sounds, and the music turning into a city beat.

How it meets the objectives:

- **The meaning is in the moves.** You don't need to read anything to understand what you are doing.
- **Every choice is answered** in light, air and sound, so the cost of building is felt, not read.
- **There is no goal to win.** The work hands you the question of when it is enough.

The impact I hope for is that people leave a little more aware of what was there before the
buildings. Thank you. I'm happy to show it live.

---

# Likely questions from your tutor (3 minutes)

Short answers you can give in your own words.

**Why Canvas 2D and not WEBGL or Three.js?**
I tried a WEBGL version. It had real lighting, but it looked like a game engine. I wanted the street
to look painted, so I wrote my own perspective camera in Canvas 2D, which lets me draw every building
and tree by hand in code.

**How does the hand tracking work?**
ml5.js handPose gives 21 landmarks per hand. I read the shape from them (one finger, open hand or fist). A
fast sideways movement of a hand is a chop on that hand's side; upward movement is a build, and how
high the hand is decides how big the building gets.

**What if the camera doesn't work, or someone can't use their hands?**
Every gesture has a keyboard key: Z / X chop, H / S / B build homes, shops or towers (hold for
bigger), the up arrow walks, C starts the camera, T turns round, F ends, M mutes.

**How is the landscape generative?**
The street is made of 48-metre blocks generated from a seeded random number generator, so the same
seed always gives the same street. Trees are grown procedurally, and each building is picked at
random from families of styles, so no two streets look the same.

**Why is there no score or win state?**
Because the work is about choice. A score would reward building more. Without one, the only measure
is what you notice: the birds leaving, the smog, the empty towers.

**What would you improve with more time?**
More reliable hand tracking in different light, a version for a gallery projection with a depth
camera, and letting the forest slowly grow back if you stop building.

**How did you handle performance?**
I profiled it. Almost half of every frame was spent mixing colours for the fog, night and smog, so I
parse each colour once and mix the numbers directly: the frame went from about 9 ms to under 5 ms with
the same picture. Trees are painted once and reused, blocks of street are only made when they come
into view and dropped once they are behind you, and the camera image for the walking detection is
shrunk to 48 x 36 pixels first.

**How is the code organised?**
Each file has one job: the street engine, the artwork's rules and hands, the trees, and the sound.
The street engine only talks to the artwork through a few named hooks, so it knows nothing about the
artwork's rules. There are comments explaining the logic, and a README with how to run it, the
controls and the techniques.
