# Plotline — walk the board

A first-person p5.js generative landscape (brief: *Generative Landscape*). You stand in the middle of a board-game main street and keep walking. The street never ends: it loops like a game board, and property value rises the further you go. Every building, sign and sound is drawn or synthesised in code. The only library is p5.js.

## Concept
The street is a loop of ten blocks:

1. **Rusty Row**: crooked shacks, patched boards, boarded windows, flickering signs, overflowing bins. The stone jail is here (just visiting).
2. **Maple Terrace**: pastel two- and three-storey townhouses with striped awnings, window boxes and street trees.
3. **Gilded Gardens**: mansions set back behind hedges, wrought-iron fences, columns and fountains.
4. **Brick & Glass Quarter**: tall brick and glass buildings with glowing storefronts and neon-lit signs.
5. **Pinnacle Heights**: glass skyscrapers with gold reflections, crowns and spires.

After Pinnacle Heights you pass **GO** and the board starts again in Rusty Row. Each lap is re-seeded, so no two laps are the same. A landmark tower always glows at the end of the street, in golden-hour light, and stays out of reach.

The pavements are painted in the board colours of each district, in board order. A deed card shows when you enter a district.

**The street builds itself as you walk.** Beyond about 55 m, each lot is only a plot outlined on the ground in its district colour, with a corner stake, like land on the board nobody has built on yet. As you approach, its building springs up out of the ground with a little overshoot, a puff of dust and a soft thud. The thud is pitched higher in richer districts. Lamps, trees, bins and banners pop up with it. When the page opens, the first street builds outward from where you stand.

## Interaction
- Hold W / Up / the mouse to walk. Add Shift to hurry. S / Down steps back. Enter strolls on its own. Move the mouse to look around.
- **Space rolls two dice**, and you dash forward that many lots.
- **Chance casinos**: walking past one draws a Chance card that reshapes the street ahead.
  - *Market boom*: buildings in the distance grow taller.
  - *Market crash*: they shrink and the town turns grey.
  - *Night on the town*: dusk falls, windows and lamps light up and stars come out.
  - Only buildings still more than 40 m ahead change. Once you are close, they keep what they became, so the effect rolls toward you down the street.
- M toggles sound, P pauses, R builds a new town.

## Sound (native Web Audio)
- Each district has its own small band (a pad chord plus an arpeggio), and it gets richer as value rises: bluesy square in Rusty Row, warm triangle in Maple Terrace, harp in Gilded Gardens, jazzy filtered saw in Brick & Glass, shimmering pad in Pinnacle Heights.
- Footsteps sound on every step, in sync with the head bob.
- Casino bells get louder as you approach a casino.
- The dice rattle, passing GO plays a jingle, the jail clanks, and each Chance card has its own sting.

## How it is built
- **Camera**: a perspective projection at 1.6 m eye height. Walking bobs, nods and rolls the view slightly, in time with the footsteps.
- **The board**: 48 m chunks, each one cross street plus a block of lots on both sides, generated deterministically from the chunk number and lap.
- **Buildings**: projected boxes. The street facade is lit from the low sun at the far end, and the near end is back-lit and darker. Windows, awnings, cornices, signs and roofs are placed in facade coordinates. Sign text is mapped onto the facade with an affine transform.
- **Rising**: a building's height is scaled in the projection while it rises (an ease-out-back curve over 1.8 s), so windows, signs and roofs all grow with it.
- **Near-plane clipping**: every polygon is clipped in camera space before drawing, so cross streets stay correct when you look sideways.
- **Atmosphere**: aerial haze toward the horizon, sun rays, drifting clouds, a vignette and film grain.

## Files
- index.html and vendor/p5.min.js: run locally with `python3 -m http.server` in this folder, then open http://localhost:8000/.
- sketch.js: the street, the camera, the districts, Chance, the dice and the overlays.
- sketch-all.js: street-sound.js and sketch.js combined into one file, for pasting into the p5.js Web Editor. Tested with p5.js 1.11 and 2.3. Don't load it together with the separate scripts.
- street-sound.js: the soundscape.

## References
- The brief's prompts on the "three verticals" (trees and buildings here; people were cut to keep the focus on the buildings), motion past the camera, and infrequent surprising features.
- Theme-park "Main Street" layouts, where a single straight street leads toward one landmark.
- Board-game property streets, where value rises around the board.
- Paolo Pedercini, *Lichenia* and "SimCities and SimCrises": cities as systems of value.
- Kate Compton, "10,000 Bowls of Oatmeal": districts and Chance events change the street in ways you can see, not just its numbers.
