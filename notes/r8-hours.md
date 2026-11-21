# Round 8, the hours lane: a mountain's other hour, Lanternfall's pools, and the pick

What a player should say: "The night mountain is the most beautiful one", and "I opened Ember at night and had to ride
it." Brief: `notes/r8-briefs/hours.md`. Branch `r8-hours`, cut from `round-8` at cfb2bb0. Frames, pairs and keys are
under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/hours/` (see "Where the frames are").

## Where it stands

- **Built, committed and green** (tsc, the full vitest at 1842 tests): three more hours, Lanternfall's pools in silver,
  and the hour picked on the title, saved per mountain and wired into the title, a run and the reel.
- **The critics did not pass the hours.** Two fresh critics each, given only ART.md:
  - Frostfang at Noon: 0 of 10, then 0 of 10.
  - Ember Peak at Night: 2 picked and 2 level of 10, then 1 picked and 1 level.
  - Lanternfall at First Light: 4 of 10, then 4 of 10.
  The bar is half picked or level. Every critic said why in the same words: the other frame "follows the colour
  script" that ART.md 15 writes for the mountain's day, and the hour is "the wrong hour for this place". The
  question measures fidelity to ART.md, and ART.md describes only the day. See "For the main lane to decide", 1.
- **Lanternfall's pools: Low passes, High does not.**
  - Low: 6 better, 4 level, 0 worse; then 5 better, 2 level, 3 worse. That is level or better both times.
  - High: 2 better, 6 level, 2 worse; then 4 better, 3 level, 3 worse. The bar is 7 of 10. On High the critics mostly
    could not see a difference at frame size.
- **The picker and cost** are in their sections below.

## What changed for a player

- **Three more hours, where the Almanac promised them** (`ALT_HOURS` in `src/render/palette.ts`). The Almanac's card
  names each one: "Frostfang at Noon", "Ember Peak at Night", "Lanternfall at First Light", and also "Pinecrest at
  Dusk" and "Sakura Ridge in the Evening". The cards used to read "at its other hour".
  - **Frostfang at Noon** (page 12). The day's blue hour, night and dawn, turned to the glacier's glare.
    - A polar noon: the sun still low, left of the run, in a ring of sun dogs, with diamond dust glittering in the air.
    - A deep cobalt sky down to a white-hot horizon, with the Fang and the needles dark against it.
    - White snow with long, hard blue shadows, and the ice lit from inside.
    - The Crevasse Fields go to a silver afternoon. Cloud comes over before the cavern, so its mouth is a dark hole in
      a grey-blue light. Out of the cavern the glare is ahead, over the Fang.
  - **Ember Peak at Night** (page 18). ART.md 15's one image: a ceiling of smoke lit from below.
    - No coin in the sky. The deck is a dark ceiling, lit red low toward the fire.
    - The cone runs with lava from the start line. That is held under the 0.75 that would wake a night mood's
      lightning, so a plain run never flashes.
    - The snow is a cold lilac and the shade a plum-teal under it. The lava, the under-light and the lamps carry the
      orange.
    - Windows, forges and the valley's bells are lit from the first metre: the hour starts with all of the day gone.
    - The shield is lit hottest under the deck, and the halls and the market burn down to embers.
  - **Lanternfall at First Light** (page 32). The end of night above a cloud that warms rose from the east.
    - At the start, the sun is not yet up: a glow under the far range, the stars going, and the lanterns burning out
      (lamps 0.75).
    - Under the deck the underside is a rose-violet, never orange, and the valley a dusky rose that the lanterns
      stand in.
    - The sun's rim comes up rose over Firstlight's street, and the morning at the line is a violet-blue over a rose
      horizon.
    - The snow stays lilac with a silver lit side the whole way. The test holds the key light off gold and the shade
      in the violet hues.
- **Lanternfall's pools are silver** (`silverPool` in `LIGHT_GLSL`; `poolSilver` in the palette, on Lanternfall only).
  - A lamp's pool keeps the snow's own lilac and lifts its value toward a silver (`#E6E4FA`). The lamp's marigold is
    laid only at the pool's heart.
  - It used to add the lamp's whole hue, which three of the light lane's critics read as a peach or gold floor.
  - Low paints the same pool in flat values: two soft steps of silver and a small warm heart, where it used to paint
    two flat values of the lamp's hue (the ground truth's "stains").
  - Both of Lanternfall's hours have it. No other mountain is touched: `poolSilver.k` is 0 there, and that is tested.
- **The pick** (title, `hourPick` in `src/ui/title.ts`, `src/ui/hours.css`).
  - Where the Almanac has opened a mountain's hour, one row of choices sits under Ride: the hour, then Mirrored.
  - The hour is two halves of one soft pill, "Day" and the hour's name. Each half carries a swatch of its sky at the
    start of a run (zenith over horizon). The picked half is lit in the text's own colour, never in vermillion.
  - Picking relights the title's key art at once. Ride's line names the hour ("Ember Peak at Night"), and its
    accessible name says it too.
  - The pick is saved per mountain (`SaveData.hours`, mountain ids, written only when one is picked). A run rides at
    it, and the results and the reel keep the run's hour.
  - Nothing reaches the sim, the field, a record or a ghost. A ghost rides your hour with you.
  - A Long Night's leg, the Daily and the Cup ride the day.

## Decisions (each with what a player would feel, and how it was measured)

1. **Each hour is a different light on the same places, never the day re-tinted.**
   - Each hour has its own sun or none, its own sky and its own journey, keyed to the moved places: Frostfang's
     cavern at 3300 to 3560 m, Ember's halls from 2600 m, Lanternfall's town from 3350 m.
   - The PLACES (a ravine's dark slot, the cavern's roof, the caldera's lit deck, Lanternfall's Cloud Sea) lie over
     an hour as over the day, so the places keep their character.
   - Measured by `tests/hours.test.ts`, at every 10 m of each course:
     - the key light at least 17 degrees up;
     - hazards darker than the snow;
     - the sky never mint;
     - exposure in range;
     - a dusk that only rises;
     - smoothness: a 10 m step no larger than 0.2, or than 1.25 times the day's own step at the same metre (the
       day itself steps 0.24 at Frostfang's cavern mouth).
2. **Ember's night snow is cold lilac, not firelit ash.**
   - The first look, with a pale ash snow under a peach lava key, read as a sand floor (`it1/alt-high/m2-*`).
   - The day's own night over the market had already found the answer: cold lilac snow, with the lamps and the lava
     as what is orange.
   - The second critic named a "navy slab" bank and "dark violet snow", ART.md 15's "never a dark slab". The shade went
     up a step after it (`#24264E` to `#3E3C6C`), which no critic has judged yet.
3. **Frostfang's noon is a polar noon, not a high day.**
   - The first critic called the high, plain midday "a generic bright day that could be any mountain".
   - The second version has a low sun in sun dogs (the 22 degree halo, `atmo.halo` 0.75), diamond dust, and a darker
     Fang and needles against a white-hot horizon. The second critic still picked the day's colour script 10 of 10.
4. **Lanternfall's dawn kept off the Lamp Road.**
   - The first critic lost the pairs where the sunrise had begun on the road ("the marigold lanterns get lost against
     a peach or orange sky"). The sunrise now starts on the town's street (3350 m), rose not orange. The Crown has no
     disc and no rays, and the deck is rose-violet.
   - The second critic scored it the same, 4 of 10. Its wins were the Cloud Sea, the break, the street and the
     approach to the square. Its losses were the Crown ("the Crown's signature is gone": the moon) and the Lamp Road
     ("the pools are almost gone").
5. **The pools: a lift of the snow's own value, the hue only at the heart** (`silverPool`).
   - The first High version lifted the whole pool, and the first critic read it as "a milky cream haze" where a
     lamp's small warm pool read as lamplight. The lift now starts off the pool's faint rim and the heart warms a step
     sooner.
   - Low's first version lifted to near-white islands (`it1/day-low`). It is now two soft steps (0.32 and 0.26) and a
     heart of 0.32.
   - It is one `vec4` uniform, never an array of vectors (notes/r8-perf.md), and one compare a pixel where the palette
     does not ask for it.
6. **The hour is set wherever the course is set, in one function** (`applyHour` in `app.ts`).
   - It runs before `world.setCourse` in the title's entry, a mountain picked and a run's start, and before the world
     is built.
   - When the hour changes on a course the world already stands on (the pick itself), `World.relight()` builds its
     light again as a new mood does: the props' baked colours, the sky, the grade and the far shadows' sun.
   - Nothing sets it between a run's start and the title, so the results and the reel keep the run's hour.
   - The dev switch `?debug&hour=alt` opens and picks every hour until the title's pick is used.
7. **The swatches are the hours' own skies** (`hourSwatches` in palette.ts, built once a mountain), so the pick shows
   the light it picks and needs no word of explanation.

## The critics (blind pairs, High, `blind-pairs.mjs`; a fresh Opus critic at high effort each time, told only ART.md and the folder)

Each hour against its own mountain's day at the same metres. For Frostfang and Ember the day is this lane's base
(`before/`), which the lane does not change there. For Lanternfall the day is the after build's (`after1-day`,
`after2-day`), so a pair differs only by the hour.

| Set | Frames | The hour picked | Level | What it named |
|---|---|---|---|---|
| pairs1/frostfang | 150 595 975 1500 1917 2250 2700 3000 3600 4200 | 0 | 0 | the day "follows Frostfang's colour script"; the noon "a plain bright midday that could be any mountain" |
| pairs2/frostfang (polar noon) | 300 750 1045 1343 1800 2137 2548 2850 3549 4050 | 0 | 0 | the same; the noon has the crisper cast shadows, the day the script's light |
| pairs1/ember | 150 613 993 1500 1950 2550 3000 3450 3741 4200 | 2 | 2 | the day's "firelit warm snow"; the night "a flat blood-red sky", "lavender snow" with "orange specks" (noise) |
| pairs2/ember (dark deck, fewer embers) | 300 450 750 1166 1650 2271 2850 3323 3591 4050 | 1 | 1 | the night's "navy slab" bank and "dark violet" snow against ART.md's "never a dark slab" |
| pairs1/lanternfall | 300 785 1200 1650 2209 2700 3150 3500 3940 4330 | 4 | 0 | the hour's Cloud Sea, break and street; lost where its "orange sky" outshone the lanterns, and the Crown "the wrong hour" |
| pairs2/lanternfall (dawn moved later) | 150 565 945 1528 2059 2405 2850 3297 3750 4061 | 4 | 0 | won the Cloud Sea, the break and the town; lost the Crown (no moon) and the Lamp Road ("pools almost gone") |
| pairs1/pools High / Low | High 1938 to 3750, Low the same ten | 2 / 6 | 6 / 4 | Low's old pools "a stain", "a flat beige disc", "a gold floor"; High's new lift "a milky cream haze" by two lamps |
| pairs2/pools High / Low | High 1938 to 3581, Low 1938 to 3750 | 4 / 5 | 3 / 2 | the old side's "peach-gold haze", "beige-pink floor", "spotlight disc"; the new Low's "small cold white blots" (one pair) |

Keys and picks: `shots/r8/hours/keys/` (`pairsN-*.json` the keys, `picksN-*.json` the critics' picks).

Things the critics named that are not this lane's:
- the ward's shards as flat stickers over the rider;
- horizontal banding on groomed snow ("scanlines");
- mint runner lines like speed lines;
- the close street lens with the rider at half the frame;
- a stippled milky rock shard at Lanternfall 3940;
- "Afternoon." and "Lovely day." speech chips on a night frame (the riders' chatter does not know the hour, on either
  build);
- Ember's basalt as "logs with white lids";
- Frostfang's flat blue lakes.

## The histogram (share of the frame under 15% and over 85% luminance, `histo.mjs`, means over the stills)

| Hour | Tier | <15% / >85% / mean | Its day |
|---|---|---|---|
| Frostfang at Noon | High (after2) | 4.3 / 1.4 / 47.3 | 8.6 / 0.6 / 37.5 |
| | Low (after1) | 0.5 / 3.3 / 51.4 | |
| | Phone (after1) | 1.2 / 2.9 / 54.6 | |
| Ember Peak at Night | High (after2) | 44.8 / 0.1 / 19.5 | 30.7 / 0.1 / 30.0 |
| | Low (after2) | 20.7 / 0.7 / 29.1 | |
| | Phone (after1) | 36.0 / 0.3 / 24.1 | |
| Lanternfall at First Light | High (after2) | 6.8 / 0.3 / 47.1 | 8.5 / 0.3 / 44.6 |
| | Low (after1) | 1.9 / 1.6 / 51.5 | |
| | Phone (after1) | 1.9 / 0.5 / 56.4 | |

Lanternfall by day with silver pools: 8.5 / 0.3 / 44.6, against the base's 8.5 / 0.3 / 44.8. The pools move value,
not the frame's darks or lights.

The bar (true darks and lights where ART.md 15 puts them) is not met by any hour:
- The noon has the most true lights of any High frame set here (1.4%), still few. The film curve stops the snow short
  of white by design.
- The night has true darks over 45% of the frame on High, which the critic read as "a navy slab": the shade's lift
  after it lowers that, unmeasured.

## The picker (playwright, desk 1280x720 and the phone 390x844; `scripts/playtest/hours-ui.js`)

(Results below; see `shots/r8/hours/ui/`.)

## Cost (Low's GL calls a frame, `glcount.js`, a live ride; `shots/r8/hours/cost/`)

(Results below.)

- No new draw, program, pass or texture on any tier. One new `vec4` shared uniform (`uPoolSilver`), cached by three
  as every vector uniform is, so it uploads only when the palette changes.
- On every mountain but Lanternfall the pool branch is one compare a lit pixel near a lamp.
- `hourSwatches` builds two palettes once a mountain, on the title only. Picking an hour rebuilds the props as a new
  mood does, once, on the title.
- Nothing new runs before the first frame: `setHour` before the world is built is one assignment.

## Low and the phone

- Every hour is a palette, so every tier draws it, Low through its poster: the grade baked into the colours, and the
  pools painted.
- Looked at by me:
  - Frostfang's noon on Low reads as the same glare in flat values (`after1-alt/low/m1-*`). There is one large purple
    smear left of the rider at 2250 m, which is the spindrift's Low billow, as on the day.
  - Ember's night on Low is a cold lilac road under the red deck. Its first Low capture logged GL warnings
    ("glGetProgramiv: Program object expected"). That capture ran without the browser slot (the slot script timed
    out and the run went on), so another browser was likely open at the same time. The re-shoot with the slot held
    (`after2-alt/low/m2-*`) has a clean console.
  - Lanternfall's first light on Low is lilac with a rose sky and silver pools (`after1-alt/low/m4-*`).
  - On the phone (`after1-alt/phone-medium/`) the three hours read as on High. Lanternfall under the deck was milky
    in that set; it was fixed for High after it, and the phone was not re-shot.
- The pick's row centres under the full-width Ride on a phone held upright.

## Touched outside my files

- `src/render/world.ts`: `relight()` (nine lines), so an hour picked on the course the world stands on rebuilds its
  light.
- `src/render/materials.ts`, the snow's local-light block: one branch, which calls `silverPool` where the palette
  asks and otherwise runs the old code unchanged. `silverPool` itself lives in `LIGHT_GLSL`.
- `src/game/almanac.ts`: `HOUR_PHRASES` and the hour card's name. The game layer reads no render code, so the words
  are kept twice, and `tests/hours.test.ts` holds them equal.
- `src/ui/contract.ts`: `TitleModel.hour` and `UIHandlers.onHour`.
- The mirror toggle (the modes lane's) moved into the new row under Ride, unchanged otherwise.

## For the main lane to decide or wire

1. **The hours' bar cannot be met by the question as set.**
   - The critics read ART.md 15's colour scripts as the standard, and those describe only each mountain's day.
   - The light lane's "Two other hours" (DECISIONS 373) were never judged, for the same reason.
   - Either ART.md gains a short paragraph per hour (the text is below) and a critic is shown it, or the hours ship as
     an Almanac reward judged by a person on the owner's route.
   - Lanternfall at First Light was nearest (4 of 10 twice).
2. **Ember's night shade was lifted after its second critic** and has not been judged.
3. **Lanternfall's pools on High** (bar 7 of 10) are short: 2 and 4 picked, with 6 and 3 level. Low passes.
   - Ship them on Low and High as one look, or keep the old add on High (`poolSilver.k` is per palette, but the
     uniform is one for every tier, so it would need a tier switch in `applyPalette`).
4. **The speech chips** ("Afternoon.", "Lovely day.") do not know the hour or the night on any build. That is the
   riders' chatter, not this lane's.

## What a person must judge

- Whether a mountain's other hour is a reward a player wants to ride: "I opened Ember at night and had to ride it."
- Whether the pick reads as the light it picks, with no word but its name.

## For ART.md and the README

ART.md 7, after "A mountain may have a second hour":
"Frostfang at Noon is the glacier's glare: a low polar sun in a ring of sun dogs, diamond dust in the air, a deep
cobalt sky over a white-hot horizon the Fang stands dark against, white snow with long hard blue shadows; a silver
afternoon over the fields and the glare ahead over the Fang out of the cavern. Ember Peak at Night is the deck lit from
below: no coin, a dark ceiling red low toward the fire, the cone running with lava, cold lilac snow with a plum-teal
shade, and the lava, the lamps and the forges the orange. Lanternfall at First Light is the end of the night: the sun
under the far range and the lanterns burning low at the Crown, a rose-violet underside to the deck, the sun's rim rose
over Firstlight's street and a violet-blue morning at the line; the snow lilac and silver all the way. The title offers
the day or the hour by its name under Ride, beside the mirror, each with a swatch of its sky."

ART.md 15, Lanternfall, "As built in round 8", to replace its last sentence:
"A lamp's pool keeps the snow's own lilac and lifts its value toward silver, the lamp's marigold only at its heart;
Low paints it in two soft steps of silver and a small warm heart."

README: the title's hour pick, the save's `hours`, and `?debug&hour=alt` (opens and picks every hour there is).

## Where the frames are (all under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/hours/`)

- `before/{high,low}`: the base, cfb2bb0, Frostfang, Ember and Lanternfall's fixed stills.
- `it1`, `it2`: working looks.
- `after1-day`, `after1-alt`: the first full after set. The day is Lanternfall (High and Low); the hours are High, Low
  and the phone on Medium.
- `after2-day`, `after2-alt`: after the first critics. The day is Lanternfall High and Low; the hours are High, and Low
  for Ember.
- `after3/high`: Ember's night after the shade lift.
- `pairs1`, `pairs2`: the blind pairs. `keys/`: the keys and the picks.
- `ui/`: the picker on desk and phone. `cost/`: GL counts.

Scripts added: `scripts/playtest/hours-ui.js` (the pick, checked on desk and phone). The lane's batch helpers are in
its worktree's `logs/` (not committed).
