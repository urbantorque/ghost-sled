# Round 8, the trials lane: Trials, a weekly rule twist with its own medal (G9's stretch)

Branch `r8-trials`, cut by hand from `r8-stretch` at 0dfc4d1. The brief: `notes/r8-briefs/trials.md`. Game layer, UI and
the worker only: `src/sim`, `src/bot` and `src/data/ghosts` are untouched, and nothing a Trial does reaches the sim but
what a run can already be given. Frames and raw output under `C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r8/trials/`.

## What a player gets

Once Trials are open, the week's Cup card has a second way to ride the week. Pick the Cup and the row under Ride shows
two halves, **Cup** and **Trial**; pick Trial and the title travels to the Trial's mountain (at its hour, if the week
names one) and reads "WEEK 48 TRIAL / Mirrored Sakura Ridge in the Evening", with the rule over Ride ("Most perfect
landings") and the three targets struck as the medals they win (bronze 13, silver 16, gold 18 perfects), your best this
week and the days it has left.
Ride rides it. As the run starts one card names the rule ("Trial: Most perfect landings", and the family dealt, or the
twist's name), and the stage line under the clock carries the next medal's target all the way down ("Gold under
1:54.2", "11 of 13 perfects for Silver", "Silver at 127,150"). The results lead with the medal: "SILVER IN THE TRIAL"
as the results' headline: the run's own figure on the week's measure, lit by the medal ("132,223 points", then "SILVER IN
THE TRIAL", then "56,727 short of gold" with the silver disc; on the clock "1:57.0 / GOLD IN THE TRIAL / 2.0 s inside
gold"), the race's place in the place line and Details. The one button rides the Trial again with the medal
to take next under it. The medal is the week's, kept for a year, and never goes down.

Files: `src/game/trial.ts` (the week's Trial, its tally, the targets, the medal, the words, the save's reader and
settle; pure), `src/game/trialfield.ts` (the week's field, made by the bot; only the worker and node import it, so the
main bundle never carries the bot), `src/ui/trials.css`, `tests/trials.test.ts`, and the lab:
`scripts/playtest/r8trial.ts` (one Trial ridden through the game layer), `r8-trials.ts` (weeks of Trials, the mid and
expert pilots), `r8-trials-calib.ts` (where the pilots stand in a week's field on every measure), `trials-ui.js` and
`trials-batch.sh` (the browser pass), `trials-cost.sh` (the cost against the base).

## Decisions

### The week's Trial (`trial.ts trialFor`)

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **Derived from the ISO week key the way the Cup is** (`trialSeed(week)` from `'ghost-sled-trial/' + week`, every draw a hash of it), so everyone's Trial is the same, and a friend's link and a ghost from the same week race the same rules. | "This week's Trial" means one thing to everyone. | `tests/trials.test.ts`: the same Trial from the same week, 12 weeks. |
| **Always one of the five named mountains, a new one every week** (`MOUNTAINS[(weekIndex * 2) % 5]`, so all five in any five weeks and never the same two weeks running). The Cup is a generated course; a Trial is a mountain the player knows, ridden differently. | The twist lands on a place you have learned, so you feel what changed. | Test: 40 weeks running, no two alike in a row. |
| **Its identity is the twist, named in a few words:** mirrored or not (half the weeks); one sky at most (a mood in about four weeks of ten, never the Cup's mood that week; the mountain's other hour, two in ten, open or not, a look only; an event, two in ten; plain, two in ten); the gates dealing one charm family only (half the weeks) or every charm; and a **measure**: the clock, the clock without a get-up, style points, or perfect landings, every four weeks in that order. The name says the place and the sky ("Mirrored Sakura Ridge in the Evening", "Mirrored Haunted Frostfang", "Pinecrest on a Powder Day"); the rule says the measure and the family ("Most perfect landings", "Fastest without a get-up, survival charms only"). | Readable in a second: a place, and what counts. | Test: 52 weeks, at most seven words a name, fifty characters a rule, no en or em dash. Two years: mirrored 54 of 104, family 52 of 104 (speed 10, style 21, survival 21), sky mood 42, event 22, hour 20, plain 20. |
| **Never a second Cup.** A week raced on the clock always has a twist of its own as well (mirrored, a sky or a family); its mood is never the Cup's. | The Trial and the Cup are two different reasons to ride the week. | Test over 104 weeks. |
| **The clock is never raced on Glass Ice;** Glass Ice stays for the style weeks (its drifts charge faster). A third of the grip makes a clock week a draw of who falls least. | A clock week is a race, not a lottery. | The lab's expert beat a fifth of the field on Lanternfall on Glass Ice and most of it elsewhere; mid and expert medals per week below. |
| **A week without a get-up is never a speed-family week** (it becomes survival). The speed family's Comet's Tail never wards. | "Without a get-up" asks for care, and gives you the charms for it. | With speed charms the lab's mid pilot finished clean in no ride of six (Pinecrest on a Powder Day). |
| **Lights, distinct tricks and set pieces won were tried as measures and left out.** The lab's expert took a third of the field's spirit lights (it flies, the bot chases lights), and tricks and set pieces put every skilled rider at the top of the field, so no medal told them apart. | Every medal means something. | `r8-trials-calib.ts` over 16 weeks (below). |

### What reaches the sim (`trialConfig`)

| Decision | Why | Measured |
| --- | --- | --- |
| A Trial's run hands the sim **the mountain's seed, the week's chaos roll, the sled ridden and the week's charm pool**, nothing else: the gates stand as on any run (three; the bot cannot ride fewer, so the field could not), it is never a save's first run, never a night's leg, and carries nothing in. The mirror is the input layer's (`modes.ts`), the hour the palette's, the measure the game layer's, judged at the line from the sim's own state (`TrialTally`: get-ups used over the run, the time, the score and the perfect landings at the line, filled by `Run.onStep` live and by a replay's callback for the field, the same function both ways). | The sim is closed (DECISIONS 370): a Trial is a run with its config chosen, so a Trial's record is an ordinary record and replays as one. | Test: a lab run's `sim.config` keys are exactly seed, chaos, sled and charmPool, equal to `trialConfig`; the record replayed alone gives the same figure. |
| **Left out because they need the sim:** fewer charm gates (the bot rides three, so the field could not be judged on fewer), a start with a held lantern or no get-ups (`carry` is the Long Night's, and a carried lantern is a sim input the field would also need), and a rule that changes what the sim does mid-run (no dash, no ward). | | |

### The medal (`trialTargets`, `settleTrial`)

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **The targets come out of the week's own field**: 25 riders ridden by the bot on the Trial itself (its mountain, chaos and charm pool): 20 across the whole skill range, 2 racers, 3 signature riders (never The Hollow King), each drafting the riders made before it as the pools' do, in the worker after the Daily's and the Cup's (`trialfield.ts`, `ghost.worker.ts`'s 'trial'). Each is judged by the same tally as the player; bronze, silver and gold are the figures that beat a fixed share of the field's runs that earn one. The same riders ride the race (with the slow riders the Cup adds), so you race the people who set the bar. | Fair and the same for everyone, never tuned by hand per week. | Test: the week's targets ordered, the field's best takes gold. Field made in node in 1.2 to 1.8 s. |
| **One share a measure, set once from the lab** (`TRIAL_PCT`): the clock 30/50/70%, without a get-up 20/40/60%, style points 22/50/80%, perfect landings 45/70/90%. The bot races the clock harder than a person and lands fewer perfects, so one share would have made the clock's gold unreachable and the perfects' gold free. | Gold is hard every week, bronze is there for a steady ride. | Calibrated on 20 weeks x 3 rides a pilot: each pilot's share of the field (table below); then the four weeks and twelve weeks of the lab. |
| **Ordered and apart:** silver over bronze and gold over silver by at least a second, one perfect, or a tenth of bronze's points. | Three medals, always three things to aim at. | Test on degenerate spreads for every measure. |
| **A medal is the week's, kept for a year (53 weeks), never lowered**; the best figure only improves (`SaveData.trials`, written only once a Trial has been ridden, read safely). A revive's second card settles from the medal held as the run started, so it gives the same answer. The week's runs keep their bests and ghosts under `trial:<week>`, pruned with the Cup's when the week ends; the medal stays. | Nothing earned is taken away. | Test: settle, flush, reload, a worse run and a crash after: the medal holds. |
| **What it pays follows the spine:** a Trial medal raised pays as the Daily's and the Cup's do (`dayMedal`: 20, 35, 60 XP), and the run pays everything any run pays. No new currency, nothing bought. A Trial's run stands on no ladder and fills no mastery board (its twist is the week's). | One bar, as every goal moves it. | |

### Where it lives, and when it opens

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **Opens on the Almanac's page 35 (the spine's placeholder, "Trials") or with the crown, whichever comes first.** By either, every mountain, every mirror and all three gates are open, so no week's Trial asks for something the player has not got. It is somewhere to go after The Twelve, as G9 says. | A late-game reward that never shows a locked mountain. | Page 35 is about run 100 for the mid pilot in the bars' career (DECISIONS 371). |
| **Reached from the Cup's card, not a new row.** Pick the Cup and the row under Ride (the hour and the mirror's row, empty on the Cup) shows the week's two ways as two halves of the hour's own pill: the trophy and Cup, the Trial's medal held (an empty ring for none) and Trial. The Cup's card stays outlined while either is picked; tapping it goes back to the Cup. | The week is one card with two races in it. | Title frames, desk and phone. |
| **Found three more ways:** the page that opens Trials rides this week's (its Ride, as the Long Night's page does); an unridden week's Trial is the title's one line of news when nothing else is ("This week's Trial: ... Pick it on the Cup."); and the medal wall has the week's Trial row under the Cup's. | It is never hidden behind a tap the player never makes. | |
| **A friend's link to a run of this week's Trial opens the Trial**, and on a save that has not opened Trials yet it opens it for that link. | A link means the same race for both. | |

### The run and the results

| Decision | Why a player would feel it | Measured |
| --- | --- | --- |
| **The twist is named once as the run starts**, in the HUD's one-line card after the reveal (when the sky has one): "Trial: Most perfect landings" with the family ("Survival charms only"), or the twist's name. The mirror and the sky need no words: the picture and the reveal card say them. | One idea, said once. | Run-start frames. |
| **The stage line carries the next medal's target** in place of "Stage 2 of 3" (its hairlines still fill): on the clock the best medal the clock still allows ("Gold under 1:54.2", stepping down as the time passes), on a count where you are ("11 of 13 perfects for Silver"), on points the next ("Silver at 127,150"); a get-up on a week without one says so ("A get-up used: no medal"). The HUD does not grow. | The target is always in view and always live. | |
| **The results lead with the Trial** (after both critics, below): the moment's figure is the run's own on the week's measure ("132,223 points", "1:57.0", "16 perfects"), lit by the medal as a place is (gold-white for gold, the silver step for silver and bronze), its words the medal ("Silver in the Trial"), its fact how far from the next with the medal's disc ("56,727 short of gold", "2.0 s inside gold"); the race's place stays in the place line and Details, whose race line says it all ("Trial: Silver with 132,223 points. Gold at 188,950 points, 56,727 more."). The one button is **Ride the Trial**, its reason the medal to take next ("Gold at 188,950 points"), or with gold your best to beat. A Trial's riders carry no "Daily" on their tags. | Which medal, and how far from the next, before anything else. | Results frames, desk and phone. |

## The lab: the mid and expert pilots ride the Trials

Through the real game layer in node (`scripts/playtest/r8trial.ts`): the week's Trial from `trialFor`, its field from
`trialField` (the worker's code), the race picked from it by `field.ts pickField` as the app picks the Cup's, the run a
`Run` with `trialConfig`, drafting and meeting that field by the sim's own rules (`rivals.ts draftsOn` and `RivalWatch`,
as `ghosts.ts`'s probes do), judged by `Run.onStep`'s tally and `trialMedal`. Every ride's record replayed alone gives the
same figure. Pilots: `labpilots.ts trickster` (the round 8 mid and expert, the air map and the charm gates) with their
lantern spenders, sled 0. Raw: `shots/r8/trials/lab-twelve-final.json`, `lab-four-final.json`, `calib2.json` (the final
code: the clock judged in its own tenths; 22 s for the four weeks, 70 s for twelve).

**Calibration** (`r8-trials-calib.ts`, 20 weeks from 2026-W48, 3 rides a pilot a week): the share of the week's field each
ride beats on each measure, quartiles 25 / 50 / 75 / 90:

| Measure | Mid | Expert |
| --- | --- | --- |
| The clock | 0.32 0.44 0.56 0.74 | 0.40 0.62 0.80 0.92 |
| Without a get-up | 0.20 0.40 0.52 0.71 | 0.00 0.22 0.72 0.88 |
| Style points | 0.28 0.39 0.48 0.64 | 0.64 0.88 0.96 1.00 |
| Perfect landings | 0.56 0.76 0.86 0.94 | 0.94 0.98 1.00 1.00 |

(An earlier pass with spirit lights: the expert's quartiles 0.00 0.12 0.29 0.56, under the mid's; tricks and set pieces had
both pilots near 1.0. Those measures were left out.)

**Medals by week**, six rides a pilot (seeds 1000 + 7919 k), B bronze, S silver, G gold, - none. Targets bronze / silver /
gold, figures in the measure's units:

| Week | Trial | Rule | Targets | Mid | Expert |
| --- | --- | --- | --- | --- | --- |
| 2026-W48 | Mirrored Sakura Ridge in the Evening | Most perfect landings | 13 / 16 / 18 | SSSGGS | GGGGGG |
| 2026-W49 | Pinecrest on a Powder Day | Fastest without a get-up, survival charms only | 2:14.6 / 2:07.8 / 2:03.5 | -GSGBG | -G-GG- |
| 2026-W50 | Ember Peak on a Lantern Night | Most style points, survival charms only | 55,610 / 127,150 / 188,950 | BBBBBB | GSSGGS |
| 2026-W51 | Lanternfall on a Powder Day | Fastest to the line | 2:16.7 / 2:10.1 / 1:59.0 | SSSSSS | SGGGSS |
| 2026-W52 | Mirrored Frostfang at Noon | Most perfect landings | 12 / 15 / 17 | SGBBBS | GGGGGS |
| 2026-W53 | Mirrored Sakura Ridge under a Comet | Fastest without a get-up, survival charms only | 2:07.0 / 2:01.8 / 1:57.0 | S-B--B | ----GG |
| 2027-W01 | Mirrored Pinecrest on a Lantern Night | Most style points, survival charms only | 72,610 / 122,110 / 178,040 | BBBSBB | SSGGGG |
| 2027-W02 | Mirrored Ember Peak | Fastest to the line, survival charms only | 2:05.8 / 2:00.0 / 1:54.4 | BBSBSB | GSBGSS |
| 2027-W03 | Mirrored Lanternfall with a Yeti Crossing | Most perfect landings, survival charms only | 9 / 14 / 15 | SBBBSB | SGGGGG |
| 2027-W04 | Frostfang in a Light Storm | Fastest without a get-up, style charms only | 2:08.0 / 2:02.3 / 1:57.3 | GSGSSG | --G-G- |
| 2027-W05 | Sakura Ridge in the Evening | Most style points, speed charms only | 74,270 / 160,990 / 198,370 | BBBBBB | -GGGSG |
| 2027-W06 | Mirrored Pinecrest with an Avalanche | Fastest to the line, style charms only | 2:12.0 / 2:07.4 / 2:02.0 | SG-SGG | GS---G |

The brief's four weeks (2026-W48 to W51, one of each measure): **the expert takes gold every week** (6, 3, 3 and 3 rides of
six) **and the mid pilot a medal every week** (bronze or better in 6, 5, 6 and 6 of six). Over all twelve weeks the expert
takes gold in every week and the mid a medal in every week. What it says beyond the bar: the clean weeks are the
expert's hardest (it flies everything and falls: no medal in four of six rides on W53 and W04, where the mid took
bronze to gold), the perfects weeks the easiest (W48: the mid's six rides were four silvers and two golds; the bot lands
far fewer perfects than the lab's pilots, and the share was already set at 45/70/90%), and style weeks spread the most
(W05: the mid six bronzes, the expert one ride with nothing and four golds). The lab's pilots are not a person: whether
gold feels earned is for a person (below).

## Cost

Measured against the lane's base (0dfc4d1 built the same way, `dist/r8-trials-base` on 4891), one browser on the
machine, `scripts/playtest/trials-cost.sh`; raw in `shots/r8/trials/cost/`.

| Measure | Base | Trials |
| --- | --- | --- |
| A Low frame's GL calls, Pinecrest, a held run 230 to 1,230 m (`lowperf/glv.js`, A B B A) | 449.4, 449.3 | 446.7, 449.2 |
| The same on Ember | 502.2, 502.9 | 499.5, 502.2 |
| The first frame at 6x, a fresh save, interleaved (`firstframe.js`), ms | 3,386, 2,849, 2,600, 2,898 | 2,713, 2,824, 2,376, 2,547 |
| Main script | 3,205 KB | 3,221 KB (+15 KB; the bot stays in the worker) |
| Worker | 187 KB | 192 KB |

A plain run takes none of the Trial's code but one `undefined` on the HUD's stage model; the title builds the week's
Trial (a handful of hashes) and, once Trials are open, its field in the worker after the Cup's. The first frame is
level (the machine's speed swings more than the gap). Frames a second were not judged (other lanes ran).

## Touched outside my files

- `src/game/run.ts`: `Run.onStep`, a hook called after every sim step (null on every run but a Trial's). Nothing else.
- `src/game/save.ts`: `SaveData.trials` (optional, read by `trial.ts readTrials`, written only once a Trial is ridden);
  `pruneDaily` also drops `trial:<week>` entries of other weeks from best, grudge and the run lists, as it does the Cup's.
- `src/game/ghostdata.ts`, `src/game/ghosts.ts`, `src/workers/ghost.worker.ts`: the worker's `'trial'` message and
  `GhostManager.generateTrial`, the Cup's `generatePool` pattern (a short-lived worker of its own).
- `src/game/app.ts`: the week's Trial, its generation after the Cup's, the title's pick, `mountainKey`, `hourPicked`,
  `duelHere`, `startRun` (the Trial's config, chaos, mirror, tally and start card; a demo rides its own field), the field
  (the week's pool, as the Cup's; tags without "Daily"), the results (the settle, no ladder or mastery board, the medal,
  the spine's `dayMedal`, `trialResults`), the Almanac's Ride, the link, the title's news. Every branch is behind
  `trialRun` or `trialPick`; a plain run takes none of it but `words: undefined` on the HUD's stage model.
- `src/ui/contract.ts`: `TitleTrial`, `TitleModel.trial`, `UIHandlers.onTrial`, `onRideMode`'s `{ kind: 'trial' }`,
  `AlmanacModel.modes.trial`, `HudModel.stage.words`, `ResultsModel.trial`.
- `src/ui/title.ts`: the week's pill, the Trial's panel, the place line, the medal wall's row, `travel`'s optional line.
- `src/ui/hud.ts`: the stage line says `words` when given (one line).
- `src/ui/results.ts`: the moment's fact is the Trial's line with its disc; the race line's medal disc reads "Trial:" too.
- `src/ui/almanac.ts`: the page that opens Trials carries a Ride.
- `src/ui/screens.css`: `.gs-mo-medal` (the disc's size in the moment's fact).
- Not touched: `src/sim`, `src/bot`, `src/data/ghosts`, `rank.ts`, `almanac.ts` (page 35 was already "Trials"),
  DECISIONS, README, ART, ASSETS, LISTENING.

## In the browser, and the critic

Headless, the slot taken, `scripts/playtest/trials-batch.sh` with `trials-ui.js`, on the production build served on 4890:
a save with page 35 opened; the title on the Cup, the Trial picked, the medal wall; a run of the Trial ridden by one of
its own field's riders replayed as the player (`?debug&week=...&demo=N`); the results. Desk (High, 1280x720) and phone
(Medium, 390x844 DPR 2), weeks 48, 50 and 51. Console clean on every cold start and every pass. The week's field was in
6.2 to 6.8 s after the title's first frame (the Daily's, then the Cup's, then the Trial's; the Trial's own about 1.5 s).
Frames under `shots/r8/trials/ui2` to `ui7` (the final set: `ui7`); the critics' sets under `shots/r8/trials/critic/` and `critic2/`.

*A demo is not its record:* a demo replays a record's inputs but not its showdown and steal tokens, so most field
records diverge when ridden as the player (week 48's silver rider came home with 2 perfects). The captures use riders
whose inputs alone hold their medal (found in node: week 50's Mila Frost, silver on points; week 51's Nico Rush, gold
on the clock). A dev tool's limit, not the game's.

**The first critic** (a fresh Opus at high effort, told only ART.md's path and the frames' folder, asked "Does this read
as a weekly challenge a player would understand in a second? Is anything confusing, cluttered, broken or off ART.md?"):
*"The trial's core reads quickly. 'WEEK 50 TRIAL', the rule and the bronze, silver and gold line on the title, the
'Trial: ...' pill at the start and 'RIDE THE TRIAL / Gold at ...' on the results together say 'a weekly challenge with a
medal ladder' in about a second."* It named eight faults; what was done:

| Fault | Done |
| --- | --- |
| The title names a mood its picture does not show ("Ember Peak on a Lantern Night" over Ember by day). | The Trial picked is shown in its sky (`world.setMood` with the Trial's mood on the title; the Cup's title is as it was). |
| What is picked is unclear: the Cup's card stays lit while the Trial is on, still saying the Cup's mood; nothing on the default title says a Trial exists. | The card is the week's once Trials are open: "Cup and Trial"; with the Trial picked it says the Trial's measure, medal and best, with the star. |
| The results lead with the race place; the Trial's own figure is never shown (a style week makes you subtract). | The moment's words are the medal ("Silver in the Trial"), its fact the run's figure and how far ("132,223 points, 56,727 short of gold"; on the clock the margin alone, since the time stands beside the words: "3.4 s off gold"); the race line in Details says both ("Trial: Silver with 132,223 points. Gold at 188,950 points, 56,727 more."). |
| Week 51's results say 1:57.0 and "Your best: 1:57.1". | A Trial's time is judged in the clock's own tenths (cut, as `standing.ts clock` shows it, not rounded). |
| The phone's medal line wraps over the rider's face. | The fact is the short form above: one line on the phone, under the words, clear of the rider's face (phone frames in `critic2/`). |
| The Trial half's empty ring reads as an unticked radio; the rule's flag reads as a mission. | The star on both; the half wears the medal held once there is one. |
| The player's sled has mint runners in week 51. | Not the Trial's: the demo rode its record's sled, the Wisp (sled 4), whose own look this is. For the main lane (ART.md 5 against the Wisp's runners). |
| The results' card hides the rider on a mirrored mountain (week 48). | Not the Trial's: every mirrored run's results (the modes lane's). Trials make mirrored runs common, so for the main lane. |
| A mint column behind the logo on the phone's week 50 title. | Not the Trial's: a title reel ghost near the lens on Ember. For the main lane. |

Its moderate points and nits, kept as they are, with the reason: the stage line's target is the stage line's size (the
HUD does not grow; it is under the clock, where a run's figures are); the clock's line shows the best medal the clock
still allows ("Gold under 1:59.0") where a count shows the next to reach (the clock can only lose medals, a count can only
gain them); the phone's truncated mood chip, ghosts at the lens, a deep top-centre stack and the hero crowded on the
Cup's title are the base game's; the gold disc is the Daily's and the Cup's gold (ART.md 10, meta.css); nothing says
when the week ends (done after the second critic: the panel says "4 days left").

**The second critic** (fresh, the same words, the frames after the fixes in `shots/r8/trials/critic2/`): *"On the title
and at the start of a run, it does read as a weekly challenge almost at a glance: the week, the place, one rule, three
targets and a labelled Ride button."* Its faults and what was done:

| Fault | Done |
| --- | --- |
| A style week's results still lead with "1st" in a winner's gold beside a time that does not count. | A Trial's results lead with its own figure on the week's measure ("132,223 points", "1:57.0", "16 perfects"), lit by the medal (gold as a win, silver and bronze as a podium), the words "Silver in the Trial" under it and the gap to the next medal; the race's place stays in the place line and Details. |
| The targets have no unit (the discs read as coins); nothing says when the week ends. | The unit after gold ("188,950 points"), and the days the week has left ("4 days left", "Last day"). |
| Mid-run the Trial gives way to the race at the top centre. | Kept: the target is on the stage line all the way down, and the HUD does not grow (ART.md 10, the brief). For a person to judge. |
| The mountain strip stays live, nothing marked, as if the Trial's mountain were a choice. | Kept: it is how the Cup and the Daily stand too; the strip is the way back to a mountain. For a person to judge. |
| The phone's mood chip truncated ("Pow..."), the mint sled, the Cup title's framing, the touch lessons in the thumbs' band, a deep top-centre stack. | The base game's (the critic said so of most); for the main lane. |

## What only a person can judge

- Whether a Trial reads as a different reason to ride the week, or as a harder Cup: the twist on a known mountain, and a
  medal that is not always the clock.
- Whether gold feels earned and bronze feels in reach. The targets are set against the bot's field with one share a
  measure, calibrated on two lab pilots; a person may find the perfects weeks easy (the lab's mid takes silver or gold
  there) and the no-get-up weeks hard (the lab's expert falls in half its rides).
- Whether "Most style points" is a race worth riding against ghosts who are racing on time (the field's riders ride their
  own way; the race and the medal are two things on a style week).
- Whether the Cup's card as "Cup and Trial", with the pick under Ride, is found by a player who never taps the Cup.
- Whether the stage line's target is read during a run, or only at the start and the end.
- Whether the title in the Trial's mood (a Blizzard, a Lantern Night) is still the mountain's key art.

## Still short

- **A demo is not its record** (`?demo` replays inputs, not showdown and steal tokens): a dev limit for captures.
- **The trial field costs the worker 25 bot runs and 25 replays** after the Cup's (about 1.5 s on this machine at full
  speed; the Cup's is 25 runs). A phone does the Daily's, the Cup's and the Trial's one after another, off the main
  thread; Ride waits only if a Trial is picked before its field is in (it says "Finding rivals…").
- **Glass Ice never came up** on a style week in the two years drawn (by chance: 19 such weeks, one mood in five each,
  some weeks the Cup's). Nothing stops it.
- **No album sticker** for a Trial medal: the spine's album has no Trial group, and adding one is the spine's (rank.ts
  and album.ts). A medal pays experience as the Cup's does.
- **The rider is hidden behind the results' column on a mirrored mountain** and the **Wisp sled's runners are mint**
  (both found by the critic in Trial frames, neither the Trial's: the main lane's).
- Only scripts and a critic have seen it. Nobody has ridden a Trial with hands.

## For the main lane to decide or wire

- **When Trials open:** page 35 or the crown. If the owner wants them sooner, `trialsOpen` in app.ts is one line; any
  earlier than page 21 can deal a Lanternfall week to a player who has not opened Lanternfall (it would ride it anyway,
  as a link does).
- **The album:** a sticker for a Trial gold (or a gold on each measure) would give the medal a keepsake; the spine's.
- **The two faults the critic found outside the Trial** (the mirrored results' framing, the Wisp's mint runners).
- **DECISIONS, ART.md and the README:** the text below.

## Text to fold in

**DECISIONS (a new item after 384):** *Trials, G9's stretch: a weekly rule twist with its own medal*
(`notes/r8-trials.md`, the trials lane; frames under `shots/r8/trials/`). Each ISO week names one Trial, the same for
everyone: a named mountain (a new one every week), mirrored or not, one sky at most (a mood never the Cup's, the other
hour, or an event), the gates dealing one charm family or all, and a measure in turn (the clock, the clock without a
get-up, style points, perfect landings). Nothing reaches the sim but its `SimConfig` (seed, chaos, sled, charm pool);
the measure is judged at the line from the sim's own state, by the same tally for the player and the field. Bronze,
silver and gold come out of the week's own field (25 bot riders on the Trial itself, in the worker after the Cup's), at
one share of the field a measure, set once from the lab (clock 30/50/70%, without a get-up 20/40/60%, points 22/50/80%,
perfects 45/70/90%): over twelve weeks the lab's expert took gold and its mid pilot a medal every week. Lights, distinct
tricks and set pieces were tried as measures and left out; the clock is never raced on Glass Ice, and a week without a
get-up never deals the speed family. A medal is kept per week for a year and never lowered, and pays as the Cup's does.
Opens on page 35 or with the crown; reached from the Cup's card ("Cup and Trial", the pick under Ride), its Almanac page
and the medal wall. A fresh critic read it as a weekly challenge in about a second and named eight faults; five were
the Trial's and were fixed (the title in the Trial's sky, the card saying what is picked, results leading with the
medal and the run's figure, the clock judged in its own tenths, the pick's ring), three were the base game's; a second
critic found the results still led with the race on a style week and the targets wanted a unit and the week's end, all
fixed. Cost: no
GL call on a plain run, nothing before the first frame, 15 KB of main script and 4.5 KB of worker.

**ART.md 10 (round 8 list):** *A Trial is the week's second race, on the Cup's card.* Once open the card reads "Cup and
Trial"; under Ride the hour's pill holds the week's two ways, the trophy and the Trial's star (or the medal it holds).
Picked, the title travels to its mountain in its sky and hour, the place line reads "Week 50 Trial" over the twist, and
over Ride the rule wears the star and the three targets are struck as the medals they win, a target already won struck
through. A run names the rule once in the HUD's one-line card, and the stage line's words carry the next medal's
target. A Trial's results lead with the run's own figure on the week's measure, lit by its medal as a place is
(gold-white for gold, the silver step for silver and bronze), "Silver in the Trial" under it and the gap to the next medal
with the medal's disc. No new colour: the medals' metals are the Daily's and the Cup's.

**README (modes, after the Long Night):** *Trials (from Almanac page 35, or the crown).* Every week a twist on a named
mountain, the same for everyone: mirrored, a mood, the other hour or an event, one charm family, and what counts (the
clock, the clock without a get-up, style points or perfect landings). Its bronze, silver and gold are set by the week's
own field of riders; pick it on the Cup's card. Dev: `?debug&trials`, `?debug&week=2026-W50` (another week's Cup and
Trial), `&demo=N` rides the Nth rider of the Trial's field.
