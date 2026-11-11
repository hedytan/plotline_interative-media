# A2C Reflection: We Build Our World

*Hedy Tan*

## 1. The project

*We Build Our World* is a first-person generative street in p5.js where every plot begins as forest. Through a webcam, the player swings an arm to cut the trees down and lifts a hand to raise buildings: the hand's shape chooses homes, shops or industry, and its height chooses the size. Nothing stops you; the world answers: birds flee, birdsong becomes traffic, strings turn into a city beat, and the sky fills with smog. The most novel part is that the meaning lives in the body. Clearing a forest takes one careless swing, and greed is literally a reach upward.

## 2. Key feature one: gestures that carry meaning

**Recount.** I designed each gesture for what it says, not only what it does. ml5 handPose gives 21 landmarks per hand. From these I read the hand's shape by comparing fingertip and wrist distances, detect a swing as fast sideways travel within a short time window, and treat upward movement as building, floor by floor. Each hand works its own side of the street, walking on the spot moves you forward, and every gesture has a keyboard fallback.

**React.** When it worked, it felt powerful and slightly uncomfortable, which was exactly the point. But in testing, chopping often failed, and I was frustrated: if the very first gesture does not respond, the whole concept collapses.

**Analyse.** The fault was not the model but my rules. Hands were assigned by which half of the picture they were in, so one hand swinging across the middle was split into two half-swings. Fast swings also blurred out of the tracker. I then over-corrected with a large rewrite that changed many thresholds at once. The interaction lost the feel I had tuned, so I rolled back to the earlier version and re-applied only two small fixes: keeping a hand's identity across the middle, and accepting a shorter, quicker swing. The pattern I learned is that interaction bugs hide in the gap between an algorithm and a real body, and that changing several variables together hides which one helped.

**Improve.** Next time I will test with a real camera and different people early, record raw hand positions to tune thresholds from data, and change one parameter at a time. Version control is what rescued me, so I will keep committing small, working steps that I can always return to.

## 3. Key feature two: letting the world answer instead of words

**Recount.** The project began as a satirical Monopoly street about housing, full of signs, slogans and scores. My tutor's feedback was that the meaning was unclear and that the interactions should carry it. I pivoted to the forest-to-city idea, removed most of the text, and made consequences visible and audible: a nature-to-city bar, fleeing birds, smog that thickens with every factory, sound that fades from wild to urban, a look-back view, and an end card that simply counts what was lost.

**React.** I was anxious about throwing away days of work, but this is the decision I am proudest of. The piece became calmer and clearer; it needs no reading.

**Analyse.** The earlier version tried to explain its message; this one lets the player cause it. A consequence of your own action is more persuasive than a slogan, because you cannot blame anyone else for it. The pivot also exposed a cost I had ignored: leftover Monopoly code (jail, casinos, rent) was still running underneath. Profiling showed colour mixing took almost half of every frame. Removing about 420 lines of dead code and caching colours made each frame twice as fast (9.1 ms to 4.7 ms) and made the program far easier to read.

**Improve.** In future I will prototype the core interaction and test whether people understand it before building visual detail. I will write down what the player should feel and judge every feature against that sentence. When direction changes, I will remove old code immediately.

## 4. What I learned

Compared with my initial concept, the final work reaches its main goal: the cost of building is felt rather than read. Hand tracking is still sensitive to lighting and distance. Technically, I learned computer vision with ml5, procedural drawing, Web Audio synthesis and performance profiling. The deeper lessons were about process: simplify the message until the interaction can carry it, test with real bodies early, change one thing at a time, and treat version control as a safety net that makes bold decisions possible.
