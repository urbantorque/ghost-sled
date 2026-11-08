# Round 6, the feel and garage lane (DECISIONS 240 changes 2 and 7)

Written for the main lane to fold into DECISIONS.md, ART.md (sections 5 and 13) and README.md. First person,
plain, no em dashes. Branch `r6-feel`, cut from `round-6` at d8aae90.

## Decisions (proposed numbering after the main lane's own)

**A dash puts the rider in a spirit shimmer.** For a dash's 1.4 s every rider material takes one uniform
(`uSpirit`): the body goes a little pale and luminous, a white-gold rim burns round the whole silhouette and
gold bands ripple up through the coat from the sled, about two a metre, rising at 1.6 a second. It eases in
over about 0.1 s and out over about 0.3 s, so it never flashes. The scarf keeps its vermillion (only a breath
of the rim): the player's signal does not change colour because the rider is fast. On Medium and High two
faint after-images (the seated rider's silhouette in white-gold glass, 0.05 s and 0.1 s behind) trail the
rider; they draw only where the rider is not (contract C10's stencil, as a ghost does) and only while it
dashes. Low gets the shimmer and no after-images, so Low draws nothing new. Reduced motion keeps the look and
slows the bands to a third. Rejected: a whole second rider drawn translucent behind (five draws an image, and
the chase lens looks straight through it at the rider); tinting the rider marigold (the lantern's colour
belongs to the lights and gifts; a dash already burns white-gold in the HUD's lantern).

**A ward cracks the lantern open, with a beat of slow motion.** At the hit a paper lantern of marigold
panels (five rows of ten, translucent, densest at its rims) stands round the rider, white-gold cracks burn
across it, and 0.09 s later it breaks: the panels fly out as shards that keep most of the sled's speed (so
they stream past rather than vanish behind), spin, cool and fade, and a ring of light runs flat over the snow
to 5.6 m. Shell, shards and ring are one instanced draw that exists only while a ward plays (about a second).
The ring and the paper tint what is behind them as well as adding light, because added light alone washed
out to white on the snow. The slow motion is `WARD_CURVE` in `timescale.ts`: 0.3 by 50 ms, held to 0.3 s,
back to full by 0.52 s, on both channels. I chose both and not the render channel alone because the rider
and the pack move on the feed: slowing only the render slows the shards and the shaders while the sled
shoots on at full speed, which reads as a glitch, not a beat. The feed channel is what a stomp's hit-stop
already uses; the sim stays tick-exact (only how much real time is fed to the fixed loop changes), so replays
and every ghost are untouched. It is triggered in `app.ts` from the sim's own `ward` event, one line. Reduced
motion plays none of the slow motion (the time scale's rule) and the lantern breaks later (0.2 s) and
gentler, with no pop of light.

**Sky gates are rings of light from 60 m on every tier.** A gate was a 0.14 m tube that showed at about
20 m. Now each is a ring with a deep amber edge on its silhouette, marigold through its body and a thin
white-gold line along its core, a shimmer running round it and one run of light chasing it, a halo that
tints and glows round it, a faint veil inside it (so it reads as a gate to fly through, not a hoop) and four
beacon motes riding it. The vertex shader holds the tube at least 2.7 px in radius and the halo 10 px wide
whatever the distance, so at 60 m it is a clear ring of light about fifty pixels across. Ring and halo are
one geometry in one instanced draw for every gate (as before), with a premultiplied blend: the ring writes
opaque light, the halo tints and adds. Low has no bloom, so the halo carries the glow there and the core
stays under 1; on Medium and High the core runs past the bloom threshold. The cap rose from 4 to 16 and
every entry of `course.skyGates` draws at its own radius, so a set piece's line of three smaller rings is
the same family. Flying through one swells it, burns it white-gold and it is gone in 0.7 s, with a ring of
motes. Rejected: a pale white-gold ring (it vanished on snow and on a bright sky: the first version did) and
a plain additive halo (white on white).

**Fireworks are streaks that rise, burst, droop and crackle.** The old shells were particle sparkles and
gouache dabs that read as puffs. A shell now climbs on a thin trail of embers (0.55 s at the finish, where the render-time ease already slows it, 0.9 s elsewhere), bursts with a
flash into a sphere of streaks (peony, chrysanthemum with longer tails, a tilted ring, a willow that droops
in marigold, a crackle that breaks into twinkling glitter), and every streak stretches along its motion on
screen, slows against the air and falls. One instanced draw for every spark of every shell, drawn only while
a show is in the air; Low throws about half the stars and its streaks carry their own halo. Each streak takes
a little of the sky away behind it (a premultiplied blend with alpha), so vermillion still reads against a
bright peach dusk. Colours are ART.md 13's: vermillion, coral, marigold, white-gold in four pairs, never mint
or rose; the finish's old periwinkle shell is gone. They fire over the square for every finish (moments.ts
keeps its show and its timing; only the shells changed), a bigger show over the square for a win, and over the
street ahead when a `moment` beat says a gates set piece is won. The square's shells keep the finish show's placement (from the lens as each goes up); the others are placed along the lens's own view
from where the lens will be when they burst, kept near the middle of the frame where the speed streaks smear
least: a sled at 30 m/s closes 40 m during a shell's climb, and the first placement (by the run, 70 m ahead)
burst over the top of the frame. Reduced motion keeps the show, drops the glitter's twinkle and most of the
burst's flash.

**The garage, finished.** Four new shelves beside the sleds and paints, all bought with gifts and all
cosmetic; nothing reaches the sim, a sled's handling, the lantern or a ghost (a test reads `src/sim` and
`src/bot` for any mention). Seven scarves (vermillion always dominant: two deeper stripes, cream bars, a short
broad rib, a fringe, narrow ink bands, cream-dipped ends with a fringe, a long slim streamer; each varies the
tails' length and width, the knit's pattern and the tassels, and the accent is at most cream or ink). Seven
hats in vermillion and the beanie's cream, each told by its outline from behind (the cuffed pom beanie, a
short watch cap with a thick rolled cuff, a pom over each ear, a trapper with a cream fur brim and long
flaps, a ring of bobbles, a pointed chullo with braided ties, a stocking cap that streams out behind; none
is a signature rider's hat). Six trails: plain powder, a pale honey spray, marigold sparks flicked off the
runners, gold glints left twinkling in the groove, a cream and gold stardust, a marigold stream straight back
(warm roles only; never mint, rose, coral or vermillion, because coral and vermillion are the drift's heat).
Trail motes are painted grains in the powder layer with a hot twin in the glow layer now and then: added
light alone vanished on white snow, and that was the first version. The five sled sounds are the music
lane's list (`SLED_SOUNDS`); the garage sells them, saves the choice and calls `AudioEngine.setSledSound`
at load, after the platform's save is bound and on every change. Prices run 60 to 240 gifts, the same band as
the paints; there are 23 items to buy for 3,370 gifts in all, so gifts keep mattering after the sleds.

**The garage's shop.** The Sleds sheet is now the Garage (the title's button says Garage over the sled's
name): a row of tab pills (Sleds, Paint, Scarves, Hats, Trails, Sounds) over the shelf, arrow keys moving
between tabs as tabs do. Every shelf is the sled shop's own shape, a preview with its one action beside tiles
that pick what the preview shows, so the six read as one place; buying is two taps everywhere (Buy arms,
Confirm spends), paints included (a paint used to buy on one tap). The previews are drawn from the same
numbers the game builds the looks from (`garageart.ts`): a scarf tail in its pattern and length, a head and
shoulders from behind in the hat, a groove with its spray and motes, a drawn wave for each sound, a deck in
its paint. A line under each preview says what the shelf touches and that it is a look only. On a phone the
tabs scroll sideways and the tiles go two a row. Rejected: rendering each hat and scarf with the game's
portrait renderer (a render per item and a second camera angle for the back of the head; the drawings are
instant and say the same thing), and a listen button for sounds (the music lane owns how they sound and has
no preview entry point yet).

**Saves.** New optional fields: `scarves`/`scarf`, `hats`/`hat`, `trails`/`trail`, `sounds`/`sound`
(`SHELF_KEYS`). Known ids only, once each, the free item never stored, and the worn one must be owned or it
reads as the free one. A save from before them loads with the free item on every shelf and keeps its shape:
nothing empty is written back. `tests/garage.test.ts` holds a round 5 save (gifts, sleds, paints, mastery,
counts) through a load and a write, round-trips a bought set exactly, and throws mangled values at it.

## ART.md text

For section 5 (the rider), after the paragraph on the wooden sled:

- The rider's look is the player's to choose in the garage, inside the signal: the hat and the scarf are
  always vermillion with at most the beanie's cream or an ink accent, so whatever is worn, the rider is the
  one vermillion figure on the run. Hats are told apart by their outline from behind (the chase lens always
  sees the back of the head): the cuffed pom beanie, a short watch cap with a thick rolled cuff, a pom over
  each ear, a trapper with a cream fur brim and long flaps, a ring of bobbles, a pointed chullo with braided
  ties, a long stocking cap that streams out behind. A scarf varies the tails' length and width, the knit's
  pattern (deeper stripes, cream bars, a rib, ink bands, cream-dipped ends) and its tassels; the knot and
  the wrap stay the classic vermillion.
- A trail is what the sled leaves: the spray warmed toward honey or cream, and motes in the lantern's
  warm family (marigold sparks, gold glints, cream and gold stardust, a marigold stream), never mint, rose,
  coral or vermillion (the drift's heat owns coral and vermillion).

For section 13, replacing the dash, ward, sky gate and fireworks bullets:

- **A dash** is the rider as a spirit for 1.4 s: a white-gold rim round the silhouette and gold bands
  rippling up through the coat, eased in and out, the scarf still vermillion; on Medium and High two faint
  white-gold after-images trail it, drawn only where the rider is not. The lens punches out and white-gold
  motes trail the sled. **A ward** stands a marigold paper lantern round the rider that cracks with white-gold
  light and breaks into shards and a ring of light over the snow, in a beat of slow motion (none under
  reduced motion). A dashing ghost trails pale mint-white light; a warded ghost breaks into marigold.
- **Sky gates** are rings of light: a deep amber edge, a marigold body and a white-gold core line, a halo
  that tints and glows, a faint veil inside and four beacon motes riding the ring, a shimmer running round it.
  Held to a few pixels thick at any distance, they read from 60 m on every tier, Low included. Every gate on
  the course, a set piece's smaller rings among them, is one draw. Flying through one bursts it into
  white-gold.
- **Fireworks** climb on a thin trail of embers and burst with a flash into spheres, rings and willows of
  streaks that stretch along their motion, droop and fade, the crackling kinds breaking into glitter: the
  rider's warm colours and the lantern's (vermillion, coral, marigold, white-gold), never mint or rose. They
  fire over the square at the finish (more for a win) and over the street when a gates set piece is won.

## README notes

Controls: no change. Under the round 6 play-test, a garage line: "The Garage (the title's Garage button)
sells sleds, paints, scarves, hats, trails and sled sounds for gifts. Everything but a sled is a look or a
sound only." Playtest scripts: `feelfx.js` (shoots each dash, ward, gate from 60 m and the finish off a
replayed run, with a garage look worn and reduced motion as options) and `fireworks.js` (a synthetic street
or win show mid-run). `garage-tris.ts` prints the hats' and effects' triangle counts.

## What I looked at

Frames under  in the worktree (ignored by git): the garage on desktop and phone (, , ), a High run of Pinecrest (: dashes, gates from 60 m, the finish), Old Wren's ward on High and Low (, ), Ember on Low wearing a long cap, ink bands and sparks (), Pinecrest on a phone on Medium with a dash and a ward under reduced motion (), a synthetic gate burst with a set piece's smaller rings (), and street and win shows (). The console stayed clean throughout (no errors, no warnings).

What I could not check: whether any of it feels right at speed with hands on the keys, how the five sled sounds sound (the music lane's), the real set pieces' ring lines and gates beats (I pushed synthetic ones), and frame rates (the main lane measures).

## Cost

Draw calls (settled frames): none added on any tier. The gates stay one draw (as before). Transient draws,
only while their moment plays: a ward's lantern, one draw for about a second; fireworks, one draw while a show
is in the air (the finish's shells moved from the particle layers into it); the dash's after-images, one draw
for 1.4 s on Medium and High only. Low draws nothing new except the ward's second and a show's few seconds.

Triangles: a gate is 722 (it was 480): three gates on a named mountain add about 0.7k on every tier; sixteen
would be 11.6k. A hat is 2,612 to 3,196 against the beanie's 2,646 (the wreck's head shares the geometry). The
scarf's tassels add 8. While they play: a ward 102, the after-images 5.1k (two of 2,562), fireworks two a
spark (a full win show peaks around 1,000 sparks, about 2k). Particles: trails emit 34 to 60 motes a second
into the existing layers (the budget scales them on Low).
