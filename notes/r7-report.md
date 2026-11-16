# Round 7: the report

Branch `round-7`, not merged, pushed or deployed. Everything below is in DECISIONS 276 to 358, the README's
"Round 7 play test and performance", ART.md 15 and LISTENING.md; this is the short version for the owner.
Nobody has played this build or heard it. It is not a 10.

## What changed for a player

- **It looks like a place at an hour.** Each mountain has a colour script by distance (ART.md 15) and every place
  its own grade under a film curve: Pinecrest's bright morning turns to gold over Old Town, Frostfang goes from blue
  hour through an aurora night and an ice cavern into a rose dawn, Ember is lit from below under its smoke deck,
  Sakura is a spring morning through blossom and torii. Air has two colours and pools in the valleys; the nearest
  lamps and lanterns light the snow; shadows hold still; there is depth in the frame (occlusion, contact shadows,
  depth of field in the beats, motion blur at speed, a lake that mirrors).
- **A fifth mountain, Lanternfall, and The Twelve.** A night mountain above a sea of cloud that breaks onto a valley
  of rising lanterns, a road of stone lamps and a town whose great lantern is lit at the finish. It opens by beating
  The Twelve, a ladder of duels against eleven named riders and their King, ordered by how fast each is at home.
- **Set pieces that never repeat the same way.** Fifteen set pieces over twelve verbs (a bell to shatter, a forge
  gate to beat, a slide on glass, lamps to kindle, a guide light to follow, a flame to carry and more), each with two
  or three seeded variants, and two legend moments a mountain (a white stag, a lantern fleet, the aurora coming down,
  a cinder wyrm, a lantern dragon, a great rising) on about one run in ten, never a session's first. Mastery is never
  punished: the skilled pilots now win 80 to 82 of 90.
- **A hero worth looking at, and a camera that directs.** The rider is rebuilt (broader, weighted, reacting: a
  glance passing, a lean, a fall played whole, three finishes) and drawn larger; the camera holds a wide over a big
  leap, tracks low down a street, whips onto a reveal and gives the biggest leap a slow hero frame, timed to the score.
- **A produced score.** Every mountain has its own genre, key, tempo and band, with one motif running through the
  game; sections follow the run, the biggest leap takes a breath, every verb has its stinger and its steps, each of
  The Twelve has a motif, and a legend has a chord colour of its own.
- **It is fairer at both ends.** A fall is got up from (three get-ups) instead of ending the run, so a clumsy player
  finishes: the clumsy pilot finishes 26 of 30 runs where it finished none. The race stays live past the first runs
  (seven riders laid across where you finish). A gamepad with rumble; hints that leave once learned.
- **Your run, directed.** "Watch your run" cuts a highlight reel from the run's own record, on the score's bar lines;
  results lead with the run's moment; each mountain's title is one composed shot; screens move as they are built.
- **The last pass fixed what every critic named on every mountain:** the course's spirit lights are small flames
  that belong in the frame (not flat stickers hanging in the sky), no ghost fills the frame at the lens, and the
  rider keeps its navy and vermillion through a dash, a ward and the flow.

## What was measured

All of it against round 6's build in the same sitting; the tables are in the README ("Round 7 play test and
performance").

- **Finishes by pilot** (pilot lab, six seeds a mountain): the clumsy pilot finishes 26 of 30 runs (round 6: 0 of
  24); every other pilot but the one that holds into the trees finishes every run on all five mountains.
- **Set pieces won by pilot:** expert 82 of 90 (round 6: 36 of 72), mid 80 of 90 (50 of 72), stunt 31 of 90, novice
  18 of 90 (27 of 71: fewer, see the open questions), the careful line 6 of 90, clumsy 1.
- **How live the race is:** run 1 0.43 to 0.56 (the same field either way); run 2 0.59 to 0.70 and run 5 0.63 to
  0.75 laid across your runs, where round 6's fixed roles gave 0.51 to 0.61 and 0.53 to 0.65.
- **Variants and legends:** each variant about as often as its others; a legend about one later run in ten on every
  mountain, never on a first run.
- **Performance:** 60 fps on High, Medium and Ultra at 1x on every mountain, and on the phone. Low at 6x beat round 6
  on Pinecrest and Ember; on Sakura it was 7 fps under in one sitting (mains) and 3 over in the other (battery,
  after the fixes): not settled. The first frame was 370 ms later and is level after the fixes (2,140 against 2,179
  ms). Draw calls on High 96 to 101 (round 6: 93 to 100).
- **Size:** 59.78 MB, 31 files, 10.73 MB initial: inside CrazyGames' 250 MB, 1,500 files and 50 MB (and the mobile
  homepage's 20 MB).
- **Loudness and audio CPU:** the mix at -15.4 to -16.5 LUFS, true peak -1.1 to -1.2 dBTP on all five mountains;
  the audio's main-thread cost level on High and a little lighter on Low.
- **The critic's scores:** five passes a mountain, no frame a 9, the best 8 to 8.5; High's mean 6.5 to 7.4 under the
  harsher critic (DECISIONS 342).
- **The console** is clean on a cold start on every tier and mountain, and in every capture.

## What was only seen in scripted runs

- Every frame in the review loop (five passes a mountain, scored by fresh critics), the variants and legends, the
  set pieces' worlds, the camera's beats and the reel were judged in stills and short strips from scripted riders on
  a headless browser. The 30 s clips are a replayed pool rider on a virtual clock, with no sound.
- The race's liveliness on runs 2 to 6 comes from the race lab (node, the pilots' own rides raced against fields
  built as the game builds them); five-run telemetry in the browser was too few runs to confirm it.
- The jukebox plays every cue on demand and the console is clean while it does; that the cues sound right is not
  measured.

## What still needs a human

- **Every sound.** Whether the score is good music, whether a few seconds name each mountain, whether the stingers
  and the legend's chord read, whether anything reminds a listener of existing music (LISTENING.md, the eight calls).
- **The feel.** Whether a get-up feels fair or like a penalty, whether the set pieces' variants feel different under
  hands, whether the forge gate, the glass slide, the carry and the follow are fair tests at 40 m/s, whether a duel
  against The Twelve can be won by a person (no human has won one), whether the slow hero frame reads as a beat or a
  stutter.
- **The look in motion.** Whether the camera's beats direct or distract, whether the new lights read as a trail
  over a leap at speed, whether the Low poster look pleases on a real low-end device, and the phone's thumb zones.

## The 15-minute play-and-listen route

`npm run dev`, then in a desktop browser with headphones (all switches are dev-only):

1. **The title (1 min).** http://127.0.0.1:5173/ : listen for the theme; move between mountains to see the cut.
2. **Pinecrest, a whole run (3 min).** Ride from the title. Hear the sections follow you; at the Valley Leap the
   score should take a breath and the frame slow; at the line, fireworks if you are first. Watch your run after.
3. **Lanternfall (3 min).** http://127.0.0.1:5173/?m=4 : the Crown above the cloud, the cloud sea (follow the guide
   light), the break onto the valley of lanterns (the round's biggest moment), the Lamp Road, Firstlight's square.
4. **A variant and a legend (3 min).** http://127.0.0.1:5173/?m=1&variant=1&legend=1 : Frostfang with every set
   piece's second variant and the aurora coming down; then ?m=2&legend=1 for the Cone Wakes over the bridge.
5. **The Twelve (2 min).** From the title's card, ride the first duel. Is the rider ahead a rival you can catch?
6. **Low and a phone (2 min).** http://127.0.0.1:5173/?tier=low on the desktop, then the game on a phone over the
   LAN (`npm run dev -- --host`): does Low read as a designed poster, and is the HUD clear of your thumbs?
7. **The jukebox, if time is left (1 min).** http://127.0.0.1:5173/?jukebox : the rows "Set-Piece Steps" and
   "Legends and the Hero Frame".

LISTENING.md is the long route (about 42 minutes) and the questions only an ear can answer.

## The weakest remaining part

**The look's ceiling, and Low's look above all.** The brief asked for frames that stop people; five critics a
mountain gave none a 9, and under the harsher critic High averages 6.5 to 7.4. What they named that no lane could
reach is structural: the rider is small in High's wides; props still read as boxes (a kicker's lip, a stone lantern,
the FINISH board's lettering); Sakura's blossom never reads backlit (faceted canopies); Lanternfall's great lantern
is never framed lit with the rider (its best frame scored 5.5); and Low is still a degraded High rather than the
designed poster ART.md 15 asks for (its frames score 5.9 to 7.0). Low's frame rate on Sakura against round 6 is the
other open thing, and it needs a quiet sitting on mains to settle.

## Open questions only the owner can decide

1. **Merge and ship.** `round-7` holds everything, tested; nothing is merged to `main`, pushed or deployed. When?
2. **The AAC fallback packs** (17.3 MB, `ASSETS.md`): AAC is a patented format and nobody has checked whether
   shipping it on CrazyGames needs anything. Keep them for older Safari, or drop them (the live band plays instead)?
3. **The novice wins fewer set pieces** (a fifth, where it won 38%): each set piece now asks its verb. Keep that, or
   give each a gentler variant a novice can win?
4. **Should the collapse ask more?** The careful line wins it six times in six.
5. **Should a struggling player be able to light Lanternfall's great lantern?** Today it needs pace.
6. **A true slow-motion of the flight in the hero frame** (it would slow the trick inputs mid-air: a feel call).
7. **Medium's music packs:** the full packs cost 108 to 155 MB decoded; Medium plays the light ones today.
8. **Sakura's calm lens** (no colour fringe): Sakura only, or every mountain?
9. **The legend figure on Sakura's cone,** and **new canopy geometry** so the blossom can read backlit (a cost).
10. **A camera beat for Lanternfall's great lantern,** lit, with the rider in the frame.
11. **Low's poster look:** invest in painted shafts and rims for Low, a design and some cost?
12. **A ghost passed beside the lens** now vanishes completely: add a faint rim?
13. **Pinecrest's slide sign** reads as a road marking: restyle?
14. **Spirit lights over a leap** still read as hanging in the sky before the lip: moving them is a sim change
    (SIM_VERSION 10 and new pools).
15. **Shells on every finish,** or only the winner's volley (today); **the letterbox over a steering shot;** **an eighth
    rider** in the field.
16. **A stray `C:\c` folder**, from capture paths that resolved wrongly in some lanes, holds 146 misplaced frames
    (161 MB) that lanes meant for `shots/r7/` (fx, light, lanternworld, momentsworld, a review), under
    `C:\c\Users\roger\OneDrive\Desktop\Ghost Sled\shots\r7\`. It is outside the repository: yours to look over and delete.
