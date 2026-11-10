# We Build Our World

*An interactive generative landscape in p5.js. Hedy Tan, UTS Interactive Media, A2B.*

**Live:** https://hedytan.github.io/plotline_interative-media/build/

You stand on a street where every plot is still forest. With your hands in front of the camera you
cut it down (a quick sideways swing) and raise buildings on the cleared ground (lift your hand: the
higher, the bigger). You make the world you want, and the street answers: birds fly off, wind and
birdsong give way to traffic and a band, and the sky fills with smog. Press **C** to turn round and
look at what you built; press **F** when you are done.

## How to run

Open `index.html` through a local web server, because the camera only works on localhost or https.
For example, run `python3 -m http.server` in this folder and go to http://localhost:8000/.
For the p5.js Web Editor, paste `sketch-all.js` (every file below joined into one) into `sketch.js`.

## Controls

| With the camera (press C) | With the keyboard | What happens |
|---|---|---|
| Swing your left / right hand sideways | Z / X (or left / right arrow) | Cut the forest on that side; birds flee |
| Lift one finger (index up, others curled) | H (press again = taller) | Homes: cabin, bungalow, caravan -> row houses, terraces, modern house, villa -> apartments, green condos |
| Lift an open hand (five fingers) | S (press again = taller) | Shops: diner, corner shop, petrol -> high street, supermarket, cinema -> offices, mall |
| Lift a fist | B (press again = taller) | Big buildings: car park, substation -> factory, power station, data centre -> empty skyscraper, glass tower |
| Walk or run on the spot | Up / W (Shift to run) | Move down the street at your pace (moving only your hands does not walk) |
| | T | Turn round and look back |
| | F | The end card: what it cost (it changes with what you did: the forest stays, a little, or a city) |
| | M / P / R | Sound on (mute), pause, start again |

A hand shape counts once it is seen three times in a row; an unclear shape builds nothing. Walking
ignores the hands and the arms below them (so you can cut and build while you walk), and needs about
half a second of steady stepping (6 of the last 8 samples) before you move.

Each hand works its own side of the street; a hand lift beside uncut forest clears it first. The keys
build only on the side(s) you have cut: cut the left (left arrow / Z) and H builds only on the left,
cut both and both sides build. Each press adds floors at once: the 2nd press makes it a bigger
building, the 3rd the biggest, and more presses keep adding floors; it tops out 0.7 s after the last press.

## Files

Four files, each with one job. They load in this order; only code this artwork uses is in them.

| File | Lines | What it does |
|---|---|---|
| `sound.js` | ~250 | `WorldSound`: everything you hear, made live with Web Audio. Wind, leaves and birdsong; footsteps; the axe and falling tree (`chop`); fleeing birds (`flutter`); a thud for each floor (`floorUp`); a chord when a building is finished (`built`); the life inside homes (`life`); and the band, which changes from strings and harp (forest) to pop (town) to a house beat (city) as the street fills (`update`, `_play`). |
| `forest.js` | ~110 | Grows 12 painted tree sprites once at start-up (`makeForest`: broadleaf, poplar, gum, pine, bush, from recursive branches and hundreds of shaded leaf dabs) and draws one at its real height with a shadow and distance haze (`drawBrushTree`). |
| `sketch.js` | ~1230 | The street engine: settings and state, colour helpers (`rgbOf`, `toneN`), the perspective camera `P(x, y, z)` and near-plane clipping, 48 m blocks grown from a seed (`chunkAt`, `makeLot`), the frame (`draw`), looking back (`drawMirrored`), sky, ground, the street drawn far to near (`drawWorld`, `drawForest`), every building (`drawLot`, `styleLot`, `drawStyled` and one function per building), lamps, trees and input. |
| `world.js` | ~610 | The artwork's rules: the street plan and building styles, cutting the forest (`chopForest`) and fleeing birds, building floor by floor (`handUpdate`, `growLot`, `makeBuilt`), the hands (`startHands`, `gotHands`, `handFeedSide`), walking on the spot (`sampleMotion`, `bodySpeed`), smog, the sounds of the homes, painted slogans, the HUD, the cards and the three endings. |
| `sketch-all.js` | | The four files joined into one, for the p5.js Web Editor. |
| `../vendor/p5.min.js` | | p5.js 1.11.3. |

## Techniques

- **Pseudo-3D in Canvas 2D.** A first-person camera projects world points with its own perspective
  function and clips polygons at the near plane, so the street can be painted with flat 2D shapes and
  sprites, giving a hand-made look rather than a game-engine look.
- **Seeded procedural generation.** Every 48 m block grows from a seeded random number generator
  (`rngN`), so the same seed always gives the same street and nothing has to be stored.
- **Procedural painting.** Trees are grown with recursive branching and shaded leaf dabs, then cached
  as sprites. 24 kinds of building (19 styles and 5 basic district types) are drawn entirely in code:
  brick, weatherboard and render, glass curtain walls, neon signs, steaming cooling towers, chimney
  smoke, and scaffolding with a tower crane on tall buildings while they go up (gone the moment they finish).
- **Machine-learning interaction.** ml5.js `handPose` (MediaPipe hand landmarks) tracks two hands. The
  hand shape (open, pointing, fist) is read from the landmarks, a quick sideways stroke is a chop and
  upward movement builds.
- **Computer vision without ML.** Walking on the spot is measured by frame differencing a 48 x 36 grey
  copy of the camera picture, after a 2-second stand-still calibration.
- **Synthesised sound.** Web Audio oscillators, filtered noise and envelopes only; the music changes
  style at the end of a bar as the street becomes a city.
- **No assets.** There are no image or sound files: everything is generated in code.

## How the code is organised

Each file has one job (see the table above). Inside each file, functions are grouped in the order you
meet them, under banner comments (`/* ---------- Camera ---------- */`, `/* ---------- Cutting the forest ---------- */` ...),
and the comments explain *why* things work the way they do, not just what they do.

The street engine (`sketch.js`) knows nothing about the artwork's rules. It calls a small set of named
hooks in `world.js`:

| Hook | When the engine calls it |
|---|---|
| `plotsForChunk`, `addResidents` | A new block of street is made |
| `propWaits` | Should this lamp, tree or person wait (no buildings near it yet)? |
| `worldUpdate` | Every frame, before drawing |
| `lotRise` | How far has this building risen (floor by floor)? |
| `drawBuildSite`, `paintSlogan`, `drawBirds` | While drawing the street |
| `drawHud` | After the street, for the scoreboard, cards and camera panel |
| `worldKey`, `worldClick` | A key or click the engine does not use itself |

## Performance

Measured in Chrome at 1024 x 768 (1.5x pixel density) on a built-up street, median of 60 frames:

| | Time to draw one frame |
|---|---|
| Before | 9.1 ms |
| After | 4.7 ms |

Profiling showed that almost half of each frame went on mixing colours (fog, night and smog blend
thousands of colours a frame through p5's `color()` objects). Colours are now parsed once into RGB
numbers (`rgbOf`) and blended with plain arithmetic, and the haze colour is worked out only when it
changes (`hazeHex`). The picture is identical; each frame takes about half the time. Other savings:
trees are painted once and kept as sprites, blocks of street are only generated when they come into
view and dropped once they are far behind, and the camera picture for walking detection is shrunk to
48 x 36 pixels before it is compared.

## Libraries and alternatives

| Option | Used? | Notes |
|---|---|---|
| p5.js 1.11 (Canvas 2D) | yes | A painted, illustrated look with full control over every shape. |
| p5.js WEBGL / Three.js | tried in an earlier version | Real 3D lighting, but the street looked like a game engine rather than a painting. |
| ml5.js handPose | yes | Two-hand landmarks in the browser, with no server and no training. |
| MediaPipe Tasks directly | alternative | The same hand model with more set-up code; ml5 wraps it for p5. |
| p5.brush | tried, dropped | Replaced by the leaf-dab tree sprites, which are painted once and cached. |
| Tone.js | alternative | Raw Web Audio is enough here: one small class, no library to load. |
