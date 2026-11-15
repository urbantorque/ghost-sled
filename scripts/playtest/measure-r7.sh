#!/usr/bin/env bash
# Round 7's sound and size measurements against round 6, after perf-r7.sh and on the same quiet machine (one
# playwright browser at a time): loudness on both builds (the first 70 s of each mountain's demo=0 run, the mix,
# and the music and the effects alone on Pinecrest and, on the new build, Lanternfall); the audio engine's
# main-thread cost on High at 1x and Low at 6x, the builds interleaved; how often each variant and legend comes up
# over rolled runs (node); and the release check's sizes against CrazyGames' limits.
#   scripts/playtest/measure-r7.sh http://127.0.0.1:4310/ http://127.0.0.1:4536/ shots/r7/perf
A="$1"
B="$2"
OUT="$3"
mkdir -p "$OUT"
CFG=.playwright/cli-headless.config.json
run() {
  name=$1; base=$2; var=$3; val=$4; file=$5
  playwright-cli -s="$name" open --config="$CFG" >/dev/null 2>&1
  playwright-cli -s="$name" goto "$base" >/dev/null 2>&1
  playwright-cli -s="$name" eval "window.$var = $val" >/dev/null 2>&1
  playwright-cli -s="$name" --raw run-code --filename="$file" > "$OUT/$name.txt" 2>&1
  playwright-cli -s="$name" close >/dev/null 2>&1
  echo "$(date +%H:%M) $name"
}
LOUD_A="[{m:0,part:'mix'},{m:1,part:'mix'},{m:2,part:'mix'},{m:3,part:'mix'},{m:0,part:'music'},{m:0,part:'sfx'}]"
LOUD_B="[{m:0,part:'mix'},{m:1,part:'mix'},{m:2,part:'mix'},{m:3,part:'mix'},{m:4,part:'mix'},{m:0,part:'music'},{m:0,part:'sfx'},{m:4,part:'music'},{m:4,part:'sfx'}]"
run loud-a "$A" __loudCfg "{ base: '$A', seconds: 70, passes: $LOUD_A }" scripts/playtest/loudness.js
run loud-b "$B" __loudCfg "{ base: '$B', seconds: 70, passes: $LOUD_B }" scripts/playtest/loudness.js
CPU="[{base:'$A',tier:'high',m:0},{base:'$B',tier:'high',m:0},{base:'$A',tier:'low',m:0,throttle:6},{base:'$B',tier:'low',m:0,throttle:6},{base:'$B',tier:'low',m:0,throttle:6},{base:'$A',tier:'low',m:0,throttle:6},{base:'$B',tier:'high',m:0},{base:'$A',tier:'high',m:0},{base:'$B',tier:'high',m:4},{base:'$B',tier:'low',m:4,throttle:6}]"
run cpu "$A" __cpuCfg "{ base: '$A', passes: $CPU }" scripts/playtest/audiocpu.js
npx tsx scripts/playtest/moments-plan.ts --rolls 4000 > "$OUT/rolls.txt" 2>&1
echo "$(date +%H:%M) rolls"
npm run release > "$OUT/release.txt" 2>&1
echo "$(date +%H:%M) release (exit $?)"
echo done
