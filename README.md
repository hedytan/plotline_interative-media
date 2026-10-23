# Plotline — walk the board

**▶ Play it in your browser: https://hedytan.github.io/plotline_interative-media/** (click once to start the sound)

A first-person p5.js generative landscape (brief: *Generative Landscape*). You walk down an endless board-game street and decide what gets built on it. Every building, person and sound is drawn or synthesised in code. The only library is p5.js.

## Talk Back in the 2D street style (newest)
**▶ https://hedytan.github.io/plotline_interative-media/spray2d/**

The same spray-paint game on the original 2D board street: districts from shacks to towers, built out of the ground as you walk. Each block has a development site behind a hoarding with a developer billboard; the blocks are washed-out grey until you rewrite their billboards, then the colour comes back, the hoarding sinks, the site becomes a garden and people come out. Files: `spray2d/index.html`, `spray2d/sketch.js` (the 2D engine, with the mouse freed for aiming and colour tied to each block), `spray2d/talkback.js` (the game), `spray2d/sketch-all.js` (paste into the p5 Web Editor).

## Talk Back: the 3D spray-paint version
**▶ https://hedytan.github.io/plotline_interative-media/spray/**

The street grows in front of you as you walk, and the developers got there first: every new block goes up with a billboard telling you what to want (*Luxury living from $2.4M*, *Invest in your future*, *Sold out to investors*). You carry a spray can. Aim with the mouse and hold to spray. Cover enough of a billboard and your rewrite goes up in your paint (*Homes, not assets*, *We can't even rent*, *Sold out. Still empty.*), and that block answers: its buildings fill with colour, windows light up, a roof garden grows and people come out. Walk past and the ad stays, and the block stays grey and empty. After 14 billboards you see what you rewrote.

**Who it's for:** young renters in a city that sells homes as investments. **What it says:** a city is full of messages; who gets to write them?

Controls: W / ↑ walk, Shift hurry, mouse aim, hold click or Space to spray, 1–4 paint colour, ← → or the screen edges to look around, Enter stroll, M sound, R restart. Files: `spray/index.html`, `spray/sketch.js`, `spray/sketch-all.js` (paste into the p5 Web Editor).

## 3D version (work in progress)
**▶ https://hedytan.github.io/plotline_interative-media/3d/**: the same game in p5.js WEBGL. Low-poly toy-town buildings, trees and people, all generated in code, with a painterly post-process shader (ink outlines from the depth buffer, soft haze, a painted sky with watercolour clouds, paper grain) and satirical signs in front of what you build. Files: `3d/index.html`, `3d/sketch.js`, and `3d/sketch-all.js` to paste into the p5 Web Editor.

## Concept: You Plan the Street
You're the new city planner. The street is a row of empty plots, and every plot you walk up to is your decision:

| Choice | Money | What it does to the street |
|---|---|---|
| **1 Homes** | costs money (more as land value rises) | +60 people housed, families come out onto the pavement |
| **2 Tower** | a developer pays you a lot | only a few residents, the street gets quieter, land value jumps |
| **3 Shop** | earns a little | street life up, people stop by |
| **4 Park** | costs money | trees, benches, dogs, the most street life |

Your choice springs up out of the ground in front of you. People, sound and land value follow it, so the street you walk down becomes a picture of what you chose. Land value goes up with every tower, so the next homes cost more: building towers makes housing harder later.

**Skip a plot and the market decides.** If you walk past (or hurry with Shift), it becomes a shop, or a tower once land is valuable. The walker slows down beside each waiting plot so you have time to choose.

Passing **GO** collects council rates from your residents. After 16 plots you get a postcard of your street: a little skyline of everything you built, your numbers, and a title (*A street people can live on*, *A city of empty towers*, *A garden street*…).

**Who it's for:** young people who live in a city where homes are hard to afford, and anyone who has asked "who decided this?" about their street. **What they take away:** a street is a series of decisions, and each one is a choice between profit and people. Monopoly asks how much you can own. Plotline asks who the street is for.

## Interaction
- Hold W / Up / the mouse to walk, Shift to hurry, S / Down to step back, Enter to stroll on its own, move the mouse to look around.
- **1–4** or click a card to choose the plot ahead.
- **Left / Right** at a corner turns onto a new, empty street.
- **R** plans a new street. M toggles sound, P pauses.

## Look
A bright, toy-town palette: pastel sky, white clouds, a lavender landmark tower, mint grass, cream pavements and pastel buildings, with round little people and dogs. Everything is drawn in code, with no image files.

## Sound (native Web Audio)
- The music follows your street: warmer and livelier with more street life, colder and emptier when towers take over.
- Footsteps in time with the head bob, a till chime when money changes hands, a jingle at GO.

## How it is built
- **Camera**: a perspective projection at 1.6 m eye height. Walking bobs, nods and rolls the view slightly, in time with the footsteps.
- **The board**: 48 m chunks, each one cross street plus a block of lots on both sides, generated deterministically from the chunk number and lap.
- **Buildings**: projected boxes. The street facade is lit from the low sun at the far end, and the near end is back-lit and darker. Windows, awnings, cornices, signs and roofs are placed in facade coordinates. Sign text is mapped onto the facade with an affine transform.
- **Rising**: a building's height is scaled in the projection while it rises (an ease-out-back curve over 1.8 s), so windows, signs and roofs all grow with it.
- **Near-plane clipping**: every polygon is clipped in camera space before drawing, so cross streets stay correct when you look sideways.
- **Atmosphere**: soft light-blue haze toward the horizon, gentle sun rays and drifting clouds.

## Files
- index.html and vendor/p5.min.js: run locally with `python3 -m http.server` in this folder, then open http://localhost:8000/.
- sketch.js: the street, the camera, the districts, Chance and the overlays.
- board.js: You Plan the Street: the empty plots, the four choices and their effects, the market deciding, people on the pavement, the HUD and choice cards, the intro and the postcard ending.
- sketch-all.js: street-sound.js, sketch.js and board.js combined into one file, for pasting into the p5.js Web Editor. Tested with p5.js 1.11 and 2.3. Don't load it together with the separate scripts.
- street-sound.js: the soundscape.

## References
- The brief's prompts on the "three verticals" (trees and buildings here; people were cut to keep the focus on the buildings), motion past the camera, and infrequent surprising features.
- Theme-park "Main Street" layouts, where a single straight street leads toward one landmark.
- Board-game property streets, where value rises around the board.
- Paolo Pedercini, *Lichenia* and "SimCities and SimCrises": cities as systems of value.
- Kate Compton, "10,000 Bowls of Oatmeal": districts and Chance events change the street in ways you can see, not just its numbers.
