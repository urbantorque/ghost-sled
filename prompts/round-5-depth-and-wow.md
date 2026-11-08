# Ghost Sled, round 5: depth, wonder and scale

You're working on Ghost Sled, a downhill sled racer for the browser and CrazyGames, in this repo. It's built with Vite, TypeScript and three.js. Every mesh, texture and sound is generated in code. Read the README, DECISIONS.md (items 1 to 217) and ART.md before you change anything. The last round's results and its open problems are at the end of the README ("Wow pass play-test").

The game is good: a clear, stylised look, a real race on a first run, and a lot of systems. It isn't great yet. A player's honest summary would be: "Beautiful first minute, a fun race, and then I've seen it." This round is about **depth that lasts and wonder at scale**. You have room to make big changes, including replacing systems, when they add real value. Be ambitious, and measure everything.

## How the game works now (don't break these)

- **Determinism is absolute.** The sim (`src/sim`) runs at a fixed 60 Hz. Ghosts are replays of recorded input logs, so anything that affects a run must live in the sim, be seeded and replay exactly. Ghosts can't react to you. Nothing you add may let a player touch, slow or block a ghost, and a ghost must be able to "use" anything a player can, because its record reproduces its own run.
- **Clean breaks.** A sim change means bumping `SIM_VERSION` (now 6) and regenerating the bundled ghost pools with `npm run generate-ghosts`. That's allowed this round if it's worth it. Do at most one clean break, plan everything that needs the sim before you make it, and follow the pattern of the last one: saves keep their gifts, unlocks and counts, while bests, grudges and links from older versions are dropped safely. Fold in the open rail fix (`railAt`: 8 of 80 rails can't be mounted cleanly, and at least 3 sit under a kicker's flight) if you make the break.
- **Assets stay procedural and original.** Don't copy, or closely evoke, any existing game: its names, characters, art, music, power-ups or HUD.
- **Bars.** High and Medium hold 60 fps on desktop, and phone Medium holds 60. Low must not get worse than now, and should win back the frames the last round lost (6x throttle on a very first run: 41 to 45 fps, against 45 to 55 before). The build is now 683 KB zipped: justify every 100 KB you add, and stay under 1 MB. Tests and tsc stay green. The first frame must not get slower.
- **Honesty.** Measure before and after with the telemetry pilots and perf probes in `scripts/playtest`. Say what you measured, what you only saw in scripted runs, and what still needs a human to play or hear. Don't claim it's 10/10.
- **Process.** Work on a new branch from `main`. Parallel lanes can use worktrees, which now cut from an up-to-date `main`. Lanes must not run `playwright-cli close-all`; only the main session runs it, at the very end. Use the headless playwright configs. Don't merge, push or deploy until I ask.

## Start with a player review, then decide

Before building anything, play the current game as a player would, in a real browser: a very first run on each mountain, a second and third run, the Daily, the Cup, the shop and the results screens, on desktop and on a phone viewport. Use the scripted pilots for numbers, and look at the frames yourself. Write a short, blunt review into DECISIONS.md: what is wonderful, what is flat, and where a player would stop playing and why.

Then choose this round's work. Below are the problems I see and my thinking. Treat them as a brief, not a spec. You may reject an idea if you can show something better.

## 1. Replace "presents to collect" with something that matters

Today gifts are a flat currency. They buy six sleds (the dearest costs 900), missions pay out in gifts, and gifts add a little score. Once you've bought the sleds, gifts mean nothing, but the counter is still the second most visible number on screen. Picking them up rarely forces a choice. I'm not convinced presents are the best design.

Design a pickup and resource loop that turns the course into **decisions**: risk against reward, line against line, spend now or save for later. Some directions to weigh, which you can mix, replace or beat:

- **Course pickups that charge a meter you spend on abilities.** Place them on risky lines, high in the air, along rails and near hazards. Abilities should be self-only, short and readable, and could include a burst of speed, one free crash, a brief "phase" through an obstacle, a magnet, a reveal of the best line ahead, or a stronger slipstream. Make them fit a world of ghosts and mountain spirits, not generic kart items. Earning by skill (tricks, near misses, drafting) should feed the same meter, so skilled play and brave lines both pay.
- **Power-ups placed on the course**, seeded per mountain and per Daily, so every rider, ghost or human, meets the same ones. Ghosts using theirs should be visible and readable, so you can see why a ghost surged.
- **Route depth.** More real forks, with shortcuts, secret lines and high lines that only a confident rider can reach. Each mountain should have places a player learns and talks about.
- **Make race events into choices.** The avalanche, yeti, gift storm and Spirit Train should become things you decide how to play, not just things that happen to you.

Whatever you choose must stay fair in a ghost race. If it rewards pure collecting over riding well, or makes the winner random, it's wrong. Prove it with telemetry: decisions per minute, how far skill tiers spread apart, passes, finishes, and whether a skilled pilot gains more than a lucky one.

## 2. Progression with real depth

The game has many thin systems: ladders, medals, missions, sleds, the Daily, the Cup, grudges. Make them add up to a reason to play the 10th and the 50th run.

- **Mountain mastery:** a clear, visible set of goals per mountain, covering time, style, secrets and rivals, that teach the mountain's places.
- **A meaningful sled and rider garage.** Sleds that are real sidegrades. Customisation players want, all procedural: liveries, scarves, hats, trails and sled sounds. No pay-to-win: in a ghost race, a bought advantage isn't acceptable.
- **The returning race.** Last round made the first run a great race, and a second run is now a weaker race than the first (the scripted telemetry was mixed). Fix that without faking ghosts: rivals, grudges, ladders and field picks that keep runs 2 to 20 a live race at your level.
- **The clumsy player.** A clumsy pilot finishes 0 of 8 runs today. Find a fair way for a struggling player to reach the finish town, and say how you know it's fair.

## 3. Characters with identity

Riders are a label and a glass silhouette. Make the ghosts **characters**: a roster of signature riders with designed silhouettes, sleds, colours, emblems and riding styles that show in their recorded runs, and a short voice in the race (a taunt chip, a style). Rivals and grudges should feel personal. The player's rider deserves more personality and animation too: anticipation, reactions to passes, crashes and wins, and a proper finish celebration.

## 4. Wonder at scale

The world is pretty but, for long stretches, it's a white groove with scenery beside it. Make the player ride **through** the wonder:

- **Bigger set pieces on the line:** jumps over valleys, ice caverns, frozen waterfalls, a collapsing snow bridge, a lit night village, a lift line you race under. Give each mountain two or three moments people screenshot.
- **Light and weather that change a run:** night runs with lanterns and aurora, storms that close in, sunrise breaking over a ridge. These should be seeded and part of the chaos roll where they affect play.
- **A world that answers you:** snow that sprays, trails that persist, things that break or scatter, crowds and animals that react.
- **More mountains, if it's worth it.** A fifth or sixth with a distinct biome and identity beats polishing the fourth again.
- **Low and phone keep their own beauty,** not just less of it. Design the Low look on purpose.

## 5. A living background, and marquee moments

I want the race to look jaw-dropping, and every so often the player should say "wow" out loud.

**The people and creatures in the world.** Today the crowds, villagers and animals mostly read as dots and simple shapes. Give them depth:
- Designed silhouettes and outfits for each mountain's culture.
- Varied poses, and idle and reaction animation: spectators who lean, wave, throw snow and turn to follow you; villagers at work; skiers on the lifts; kids sledding on side slopes; a snowboarder who drops in alongside for a moment.
- Animals with believable movement and behaviour: herds that scatter, birds that lift off as you pass, a fox that watches from a rock.
- Level of detail done well, so close figures are rich and far ones still read as alive.

**The world's detail.** Give the near and middle ground the craft a player notices at speed:
- Buildings with lit windows, smoke, signs and texture.
- Fences, prayer flags, bridges, cable cars and ruins that tell you where you are.
- Ice and snow surfaces with sparkle, depth and wind-blown texture.
- Rock with strata and overhangs, and trees that bend and shed snow.
- Each mountain should have a visual identity strong enough that a screenshot names it.

**Marquee moments.** Design a set of scripted-feeling but deterministic, seeded set pieces. Every run should hit one roughly every 45 to 60 seconds, and each mountain should have its own. Each needs:
- Composition: a camera beat that frames it without taking control away.
- Music and sound that swell with it.
- A clear piece of gameplay, so it's a moment you play, not a cutscene.

Examples to beat:
- A valley-crossing jump with the whole range opening below.
- Bursting out of a tunnel into sunrise.
- Racing a train or cable car.
- Riding through a festival village at night, under lanterns and fireworks.
- An avalanche chasing you down a gully.
- A frozen waterfall you thread.
- An aurora breaking overhead on the final straight.
- A finish town that erupts when you win.

Measure how often runs hit a marquee moment, check that each one reads on Low and on a phone, and screenshot every one.

## 6. Feel

Check the moment-to-moment verbs (carve, drift, pop, trick, draft, grind and wall ride) against the new systems. Every verb should matter for at least one goal and one ability. Tighten whatever reads as mushy. The audio hasn't been heard by a human yet: make it as good as you can, and tell me exactly what to listen for.

## What to deliver

- Choose 6 to 10 changes across the six areas, biased toward the ones with the biggest lift for a player. Write the plan into DECISIONS.md before you build, including what you rejected and why.
- Telemetry before and after for each change, perf on every tier, and size.
- Screenshots of every new set piece, ability and screen, on desktop and phone, with the console clean.
- README and ART.md brought up to date.
- A report that leads with what changed for a player. Say what was measured and what still needs a human: a short play route I can follow, the weakest remaining part, and the open questions only I can decide.
