# Plotline — notes for Claude Code

Hedy's p5.js project for the UTS Interactive Media "Generative Landscape" assignment.
A first-person, endless board-game street (Canvas 2D, no WEBGL) that builds itself as you
walk. Current concept: "The Landlord's Walk" — a satirical walk through housing affordability (Monopoly began as The Landlord's Game, 1904). Live: https://hedytan.github.io/plotline_interative-media/

## Files
- `sketch.js` — the street: camera/projection `P(x,y,z)`, near-plane clipping (`clipNear`),
  48 m chunks (`chunkAt`, 10 per lap, tiers by slot via `TIER_OF`), rising buildings
  (`riseOf`, ease-out-back over `RISE_T`), districts, Chance casinos, jail, overlays, input.
- `board.js` — The Landlord's Walk: age/savings, each lap past GO = a year (`onPassGo`), FOR SALE listings with rising prices (`priceOf`, `market`), investors buying plots, generated billboards (`SIGNS`, `pickSign`), open-home queues, zones and commute (left = further out), buying a home, intro/ending cards (`storyCard`), HUD (`drawBoardHud`, `drawListing`).
- `street-sound.js` — Web Audio soundscape (`StreetSound`), no audio files.
- `sketch-all.js` — street-sound.js + sketch.js + board.js in one file for the p5 Web Editor.
  **Regenerate it after any change** (see below). Starts with `// noprotect`.
- `index.html` loads `vendor/p5.min.js` (1.11.3), then street-sound.js, sketch.js, board.js.

## Rules that keep it working in the p5 Web Editor (p5 1.x and 2.x)
- Every loop body in braces (the editor's loop-protect breaks brace-less loops).
- Don't name globals after p5 functions/constants (`day`, `pop`, `CROSS`, `key`… ). Helpers use an `N` suffix.
- Held keys come from the `keysHeld` Set (p5 2.x changed `keyIsDown`).
- Drawing in `draw()` is wrapped in try/catch so one bad polygon can't freeze the sketch.

## Rebuild the single file
```sh
{ printf '// noprotect\n// Plotline — combined file for the p5.js Web Editor (works with p5.js 1.x and 2.x).\n// Paste this whole file into sketch.js. It is street-sound.js, sketch.js and board.js in one; do not load those separately as well.\n\n'; cat street-sound.js; echo; cat sketch.js; echo; cat board.js; } > sketch-all.js
```

## Controls
↑ walk, Shift hurry, ↓ back, ← further out / → toward the city (at a crossing), E / Space buy, mouse look,
Enter auto-walk, M sound, P pause, R new town.

## Working with Hedy
- Plain, short explanations; she often writes in Chinese — reply in Chinese.
- Show changes iteratively; test in a browser (Playwright headless works) before saying done.
- Commit and push to `main` when a change works; GitHub Pages serves `main` / root.
