# We Build Our World

*An interactive generative landscape in p5.js. Hedy Tan, UTS Interactive Media, A2B.*

**Live:** https://hedytan.github.io/plotline_interative-media/build/

You stand on a street where every plot is still forest. With your hands in front of the camera
you cut it down (a swing of your arm) and lift buildings out of the cleared ground (raise your
hand: higher = taller). You make the world you want, and the street answers: birds fly off, the
wind and birdsong give way to traffic and a band, the colour drains out of the picture and the
sky fills with smog. Press **C** to turn round and look at what you built. Press **F** when you
are done.

## How to run

Open `index.html` through any local web server (for example `python3 -m http.server` in the repo
root, then go to `/build/`). For the p5.js Web Editor, paste `sketch-all.js` into `sketch.js`;
it is every file below joined into one.

## Controls

| With the camera (H) | With the keyboard | What happens |
|---|---|---|
| Swing your left / right hand | Z / X (or ← / →) | Cut the forest on that side; birds flee |
| Lift an open hand ✋ | hold B | Homes: bungalow → terrace / villa → apartments |
| Lift a pointing finger ☝ | hold V | Shops: petrol / corner shop → high street → offices |
| Lift a fist ✊ | hold N | Industry: car park → factory → empty skyscraper |
| Walk or run on the spot | ↑ / W (Shift to run) | Move down the street at your pace |
| | C | Turn round and look back |
| | F | The end card: what it cost |
| | M · P · R | Sound · pause · new street |
| | G · I | Graphics pass on/off (before/after) · frame timing |

How high you lift chooses the size (low / middle / high on the camera picture). On the keyboard,
the longer you hold the key, the bigger the building.

## Files

| File | What it does |
|---|---|
| `sketch.js` | The street: camera and perspective projection `P(x, y, z)`, near-plane clipping, 48 m chunks generated from a seed (`chunkAt`, `makeLot`), sky, road, every building type, the look-back view (`drawMirrored`), input. |
| `board.js` | The artwork: forest lots that wait for your hands, chopping (`chopForest`), building floor by floor (`handUpdate`, `growLot`, `makeBuilt`), scaffolding and cranes, hand tracking with ml5 (`startHands`, `gotHands`), body-motion walking (`sampleMotion`, `bodySpeed`), smog, birds, HUD and cards. |
| `postfx.js` | WebGL post-processing over the finished 2D frame: bloom, light rays from the sun, a colour grade that moves from forest to city, vignette and grain. Adapts its own quality to the frame rate. |
| `dabforest.js` | Grows 12 painted tree sprites at start-up (broadleaf, poplar, gum, pine, bush) from recursive branches and hundreds of leaf dabs. |
| `trees.js` | Smaller painted street trees for gardens and pavements. |
| `music.js` | `WalkSound`: the whole soundscape in Web Audio (wind, birds, the axe, floors going up, the band that changes with the street). |
| `../street-sound.js` | The shared base sound engine (footsteps, hum, effects). |
| `sketch-all.js` | All of the above in one file for the p5.js Web Editor. |

## Techniques

- **Pseudo-3D in Canvas 2D.** A first-person camera projects world points with its own
  perspective function and clips polygons against the near plane, so the street can be painted
  with flat 2D shapes and sprites (a hand-made look WEBGL lighting did not give).
- **Seeded procedural generation.** Every 48 m block is generated from a seeded random number
  generator (`rngN`), so the same seed always grows the same street and nothing is stored.
- **Procedural painting.** Trees are grown with recursive branching and shaded leaf dabs, then
  cached as sprites; buildings get brick, weatherboard or render textures, weathering, window
  reflections and roof courses, all drawn in code.
- **Machine-learning interaction.** ml5.js `handPose` (MediaPipe hand landmarks) tracks two hands.
  The hand shape is read from the landmarks (fingertip-to-wrist distance against palm size:
  open / pointing / fist), a fast stroke is a chop, and upward movement is building.
- **Computer vision without ML.** Walking on the spot is measured by frame differencing a
  48 × 36 grey copy of the camera picture, after a 2-second stand-still calibration.
- **GPU post-processing.** A multi-pass GLSL pipeline (quarter-size bright pass, separable
  Gaussian blur, radial light scattering after GPU Gems 3 ch. 13, then composite). The grade is
  driven by the artwork's own state (how built-up the street is, the smog), so the picture itself
  tells the story.
- **Synthesised sound.** Web Audio oscillators, filtered noise and envelopes only; the music
  crossfades between styles at bar ends as the street develops.

## Performance

Measured in Chrome at 1024 × 768 (1.5× pixel density) on a half-built street:

| | Before | After |
|---|---|---|
| CPU time per frame | ~10.7 ms | ~5.7 ms |
| Post-processing pass | none | ~1.5 ms |

The biggest saving came from colour handling: the street blended about 4,600 colours a frame through
p5's `color()` objects. Colours are now parsed once into RGB and blended with plain arithmetic, and
the haze colour is cached per frame. If frames stay slower than ~30 ms, `postfx.js` drops the light
rays and then the bloom, and turns them back on when frames are fast again.

## Libraries and alternatives

| Option | Used? | Notes |
|---|---|---|
| p5.js 1.11 (Canvas 2D) | ✔ | Painted, illustrated look; full control of every shape. |
| p5.js WEBGL / Three.js | tried (`../3d/`) | Real 3D lighting, but the street looked like a game engine, not a painting. Kept 2D and added a GPU pass on top. |
| Raw WebGL for post-processing | ✔ | Bloom, light rays and grading at ~1.5 ms; no extra library, works in the p5 Web Editor. |
| ml5.js handPose | ✔ | Two-hand landmarks in the browser; no server, no training. |
| MediaPipe Tasks directly | alternative | The same hand model with more set-up code; ml5 wraps it for p5. |
| p5.brush | tried, dropped | Replaced by the leaf-dab tree sprites, which are painted once and cached. |
| Tone.js | alternative | Raw Web Audio is enough here and keeps one sound engine shared with the other versions. |
