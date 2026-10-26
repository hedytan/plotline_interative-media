# Plotline — notes for Claude Code

Hedy's p5.js project for the UTS Interactive Media "Generative Landscape" assignment.
A first-person, endless board-game street (Canvas 2D, no WEBGL) that builds itself as you
walk. Current concept: "You Plan the Street" — you're the city planner; each empty plot you walk up to becomes homes, a tower, a shop or a park (keys 1–4); skip it and the market decides. Bright pastel toy-town look. Live: https://hedytan.github.io/plotline_interative-media/

## Files
- `sketch.js` — the street: camera/projection `P(x,y,z)`, near-plane clipping (`clipNear`),
  48 m chunks (`chunkAt`, 10 per lap, tiers by slot via `TIER_OF`), rising buildings
  (`riseOf`, ease-out-back over `RISE_T`), sky/ground palette, overlays, input. Casinos/jail are off (`special = null`).
- `board.js` — You Plan the Street: `plotsForChunk` (one pending plot per side per block), `canRise`, `effectOf`/`decide` (budget, housed, vibe, landValue), `plotTarget` (plot ahead), market decides passed plots, walkers, `soundTier`, turning, HUD + choice cards (`drawBoardHud`, `boardClick`), intro `storyCard`, postcard ending (`drawPostcard`).
- `street-sound.js` — Web Audio soundscape (`StreetSound`), no audio files.
- `sketch-all.js` — street-sound.js + sketch.js + board.js in one file for the p5 Web Editor.
  **Regenerate it after any change** (see below). Starts with `// noprotect`.
- `index.html` loads `vendor/p5.min.js` (1.11.3), then street-sound.js, sketch.js, board.js.

- `3d/` — WEBGL version: `3d/sketch.js` (street in 48 m chunks, static parts baked per chunk with `buildGeometry`, lots drawn live, `POST_FRAG` post shader on a framebuffer — framebuffer rows are flipped, sample with `1 - vUv.y`), HTML HUD, `3d/sketch-all.js` = street-sound.js + 3d/sketch.js. Headless test: chromium with `--use-angle=swiftshader`, `noLoop()` + manual `stepWorld`/`redraw` (swiftshader runs ~1 fps).

- `spray/` — "Talk Back", the newest direction: same 3D engine; ad lots carry tilted billboards (`makeAdLot`, `L.ad` with C/N/U/V), mouse ray picking (`pickBillboard`), painting into `paintG` with a 16×8 coverage grid (`sprayAt`, tag at 42%), `composeAd` layers ad + paint + rewrite (Permanent Marker), `tagWall` warms the block (`ch.warm`, `warmN`), spawns people/flowers. `textureWrap(REPEAT)` is called once in setup (calling it later iterates every texture and crashes on removed graphics).

- `spray2d/` — Talk Back on the 2D engine (her preferred building style): `spray2d/sketch.js` is a copy of the root sketch.js with look driven by `lookAim` and `toneN` greyed by `ch.warmNow`; `spray2d/talkback.js` replaces board.js (same hooks): ad lots are `devSite` (hoarding → garden in `drawOwnedLot`), billboards are props drawn with two affine-mapped triangles (`imageTri`), picked by barycentric hit-test on last frame's corners (`pickBillboard`). Rebuild `spray2d/sketch-all.js` = street-sound.js + spray2d/sketch.js + spray2d/talkback.js.

- `afford/` — "The House at the End of the Street" (idea A + B, newest): `afford/sketch.js` = root sketch.js + hooks `introCam()` (crane shot), `drawDreamHouse(z)` (after drawGround), `afterLot(L)` (inside riseK scope: facade slogans via `imageTri`, records `L.hit` for clicks), `landmarkScale()`. `afford/game.js`: time = walked metres (1 block = half a year), savings vs deposit by zone, turning (left = further out), `pickBuilding`/`whoLivesHere` (occupancy per lot), sleepers (`drawOpenHome`), HTML HUD/opening/endings. Rebuild `afford/sketch-all.js` = street-sound.js + afford/sketch.js + afford/game.js.

- `lived/` — "The Landlord's Game, lived" (Jack's suggestion, newest): `lived/sketch.js` = afford/sketch.js + `boardSlot(c)` (board grows 2 estate blocks per lap; inner tiers +1 per lap) and `streetLabel(ch)`; GO card removed from sketch (game shows its own). `lived/game.js`: GO/Chance HTML cards (`showMonoCard` — not `showCard`, which the sketch owns), `makeOffer` (city = always outbid, estate = buy if deposit), investor top-hat tokens (`spawnToken`, drawn in `drawDreamHouse`), `sellToInvestor` (tower + hotel in `afterLot`), mini-board SVG. Check for duplicate top-level names between sketch and game files. `lived/brushtrees.js` grows 6 tree sprites in plain canvas (recursive branches + shaded leaf dabs, cropped from a 900px canvas); `drawTree` draws them with a shadow and a haze overlay (`hazeSprite`). p5.brush (vendor) is no longer used. Jail removed. `lived/index.html` scripts carry `?v=N` cache-busters: bump N on every change.

- `landlord/` — "Monopoly, lived" (Hedy chose this; newest): you are the investor, goal own 8 properties. `landlord/sketch.js` = lived/sketch.js with chunk rng seeded by board slot only (same street every lap), mouse look restored, `coldK = lotCold(L)` greying owned lots in `toneN`. `landlord/game.js`: fixed 8-block `boardSlot`, `owned` Map keyed `slot:side:z`, `buyHere` (residents `p.leaving` with boxes), GO = bank loan, ending empties the street. Helpers (opening, paintOnFacade, imageTri, wallTex, drawBillboard) copied from lived/game.js. Rebuild `landlord/sketch-all.js` = street-sound + trees + sketch + game.

## Rules that keep it working in the p5 Web Editor (p5 1.x and 2.x)
- Every loop body in braces (the editor's loop-protect breaks brace-less loops).
- Don't name globals after p5 functions/constants (`day`, `pop`, `CROSS`, `key`… ), and not `target` (a local in `draw`). Helpers use an `N` suffix.
- Held keys come from the `keysHeld` Set (p5 2.x changed `keyIsDown`).
- Drawing in `draw()` is wrapped in try/catch so one bad polygon can't freeze the sketch.

## Rebuild the single file
```sh
{ printf '// noprotect\n// Plotline — combined file for the p5.js Web Editor (works with p5.js 1.x and 2.x).\n// Paste this whole file into sketch.js. It is street-sound.js, sketch.js and board.js in one; do not load those separately as well.\n\n'; cat street-sound.js; echo; cat sketch.js; echo; cat board.js; } > sketch-all.js
```

## Controls
↑ walk, Shift hurry, ↓ back, 1–4 choose (or click a card), ← / → turn at a corner, mouse look,
Enter auto-walk, M sound, P pause, R new street.

## Working with Hedy
- Plain, short explanations; she often writes in Chinese — reply in Chinese.
- Show changes iteratively; test in a browser (Playwright headless works) before saying done.
- Commit and push to `main` when a change works; GitHub Pages serves `main` / root.
