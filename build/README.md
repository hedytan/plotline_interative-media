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

| With the camera (press H) | With the keyboard | What happens |
|---|---|---|
| Swing your left / right hand sideways | Z / X (or left / right arrow) | Cut the forest on that side; birds flee |
| Lift an open hand | B (hold = bigger) | Homes: cabin, bungalow, caravan -> row houses, terraces, modern house, villa -> apartments, green condos |
| Lift a pointing finger | V (hold = bigger) | Shops: diner, corner shop, petrol -> high street, supermarket, cinema -> offices, mall |
| Lift a fist | N (hold = bigger) | Industry: car park, substation -> factory, power station, data centre -> empty skyscraper, glass tower |
| Walk or run on the spot | Up / W (Shift to run) | Move down the street at your pace |
| | C | Turn round and look back |
| | F | The end card: what it cost |
| | M / P / R | Sound on/off, pause, start again |

If the land beside you is still forest, a build clears it first. Each hand works its own side of the
street. With the keys, both sides build at once.

## Files

| File | What it does |
|---|---|
| `sketch.js` | The street: a first-person camera and perspective projection `P(x, y, z)`, near-plane clipping, 48 m blocks generated from a seed (`chunkAt`, `makeLot`), the sky, the road, every building style (`drawLot`, `styleLot`, `drawStyled` and one `draw...` function per style), the look-back view (`drawMirrored`) and keyboard / mouse input. |
| `board.js` | The artwork: forest lots that wait for your hands, chopping (`chopForest`), building floor by floor (`handUpdate`, `growLot`, `makeBuilt`), scaffolding and cranes, hand tracking with ml5 (`startHands`, `gotHands`, `handFeedSide`), walking on the spot (`sampleMotion`, `bodySpeed`), smog, fleeing birds, the HUD and the opening and ending cards. |
| `dabforest.js` | Grows 12 painted tree sprites at start-up (broadleaf, poplar, gum, pine, bush) from recursive branches and hundreds of leaf dabs. |
| `trees.js` | Smaller painted trees for pavements and gardens. |
| `music.js` | `WalkSound`: wind, birds, the axe, building sounds, the life inside homes, and a band that changes style as the street develops. |
| `street-sound.js` | The shared base sound engine (footsteps, traffic hum, effects). |
| `sketch-all.js` | All of the above in one file, for the p5.js Web Editor. |
| `vendor/p5.min.js` | p5.js 1.11.3. |

## Techniques

- **Pseudo-3D in Canvas 2D.** A first-person camera projects world points with its own perspective
  function and clips polygons at the near plane, so the street can be painted with flat 2D shapes and
  sprites, giving a hand-made look rather than a game-engine look.
- **Seeded procedural generation.** Every 48 m block grows from a seeded random number generator
  (`rngN`), so the same seed always gives the same street and nothing has to be stored.
- **Procedural painting.** Trees are grown with recursive branching and shaded leaf dabs, then cached
  as sprites. 24 kinds of building (19 styles and 5 basic district types) are drawn entirely in code:
  brick, weatherboard and render, glass curtain walls, neon signs, steaming cooling towers, chimney
  smoke, scaffolding and tower cranes.
- **Machine-learning interaction.** ml5.js `handPose` (MediaPipe hand landmarks) tracks two hands. The
  hand shape (open, pointing, fist) is read from the landmarks, a quick sideways stroke is a chop and
  upward movement builds.
- **Computer vision without ML.** Walking on the spot is measured by frame differencing a 48 x 36 grey
  copy of the camera picture, after a 2-second stand-still calibration.
- **Synthesised sound.** Web Audio oscillators, filtered noise and envelopes only; the music changes
  style at the end of a bar as the street becomes a city.
- **No assets.** There are no image or sound files: everything is generated in code.

## Libraries and alternatives

| Option | Used? | Notes |
|---|---|---|
| p5.js 1.11 (Canvas 2D) | yes | A painted, illustrated look with full control over every shape. |
| p5.js WEBGL / Three.js | tried (`../3d/`) | Real 3D lighting, but the street looked like a game engine rather than a painting. |
| ml5.js handPose | yes | Two-hand landmarks in the browser, with no server and no training. |
| MediaPipe Tasks directly | alternative | The same hand model with more set-up code; ml5 wraps it for p5. |
| p5.brush | tried, dropped | Replaced by the leaf-dab tree sprites, which are painted once and cached. |
| Tone.js | alternative | Raw Web Audio is enough here and keeps one sound engine shared with the other versions. |
