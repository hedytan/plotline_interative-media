# Plotline — walk the board

**▶ Play it in your browser: https://hedytan.github.io/plotline_interative-media/** (click once to start the sound)

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

## The Landlord's Walk
Monopoly began in 1904 as Lizzie Magie's *The Landlord's Game*, made to show how landlords grow richer while tenants pay. Plotline walks you back into that warning.

**Who it's for:** young renters in a big city (students, first jobbers) who feel the city getting grander and further out of reach. **What they take away:** what it feels like when homes become game pieces for investors.

**How it plays**
- You're 24, renting a room for $380 a week, with $22,000 saved for a deposit.
- Walk forward and the street grows grander, from shacks to towers, with music to match.
- Every lap past GO is a year: wages in, rent and living costs out, you get a year older, and your rent goes up.
- FOR SALE plots show a title-deed listing: price, 10% deposit, repayments, commute. Prices tick up while you look. Investors sometimes buy a plot before you reach it, and an empty tower rises in its place.
- Billboards are generated from the prices around you: satirical real-estate copy that changes by district.
- Open homes have queues of people down the pavement.
- **Turn left** at a crossing to move further out (cheaper, quieter, longer commute). **Turn right** to move back toward the city.
- Buy a home with **E** when your savings cover the deposit. The walk ends when you buy, or when you turn 30 still renting, with a card that sums up your years.

## Interaction
- **E** or **Space** buys the plot beside you. **Left** moves you further out, **Right** back toward the city (at a crossing). **R** starts the walk again.
- Hold W / Up / the mouse to walk. Add Shift to hurry. S / Down steps back. Enter strolls on its own. Move the mouse to look around.
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
- A till chimes when money changes hands, passing GO plays a jingle, the jail clanks, and each Chance card has its own sting.

## How it is built
- **Camera**: a perspective projection at 1.6 m eye height. Walking bobs, nods and rolls the view slightly, in time with the footsteps.
- **The board**: 48 m chunks, each one cross street plus a block of lots on both sides, generated deterministically from the chunk number and lap.
- **Buildings**: projected boxes. The street facade is lit from the low sun at the far end, and the near end is back-lit and darker. Windows, awnings, cornices, signs and roofs are placed in facade coordinates. Sign text is mapped onto the facade with an affine transform.
- **Rising**: a building's height is scaled in the projection while it rises (an ease-out-back curve over 1.8 s), so windows, signs and roofs all grow with it.
- **Near-plane clipping**: every polygon is clipped in camera space before drawing, so cross streets stay correct when you look sideways.
- **Atmosphere**: aerial haze toward the horizon, sun rays, drifting clouds, a vignette and film grain.

## Files
- index.html and vendor/p5.min.js: run locally with `python3 -m http.server` in this folder, then open http://localhost:8000/.
- sketch.js: the street, the camera, the districts, Chance and the overlays.
- board.js: The Landlord's Walk: age and savings, years at GO, listings and rising prices, investors, generated billboards, open-home queues, zones and commute, buying a home, the intro and ending cards.
- sketch-all.js: street-sound.js, sketch.js and board.js combined into one file, for pasting into the p5.js Web Editor. Tested with p5.js 1.11 and 2.3. Don't load it together with the separate scripts.
- street-sound.js: the soundscape.

## References
- The brief's prompts on the "three verticals" (trees and buildings here; people were cut to keep the focus on the buildings), motion past the camera, and infrequent surprising features.
- Theme-park "Main Street" layouts, where a single straight street leads toward one landmark.
- Board-game property streets, where value rises around the board.
- Paolo Pedercini, *Lichenia* and "SimCities and SimCrises": cities as systems of value.
- Kate Compton, "10,000 Bowls of Oatmeal": districts and Chance events change the street in ways you can see, not just its numbers.
