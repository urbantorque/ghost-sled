#!/usr/bin/env bash
# Round 7's final capture set on one build, in two playwright browsers side by side (never more):
#  - the fixed frames (frames-r7.json, the same distances as shots/r7/before) on High, Medium and Low on the desktop
#    and Medium on a phone, all five mountains;
#  - every set piece's every variant and both of each mountain's legends (moments-r7.js: variants 0, 1 and 2, each
#    set piece taking its own modulo, the legends alternating) on desktop High, desktop Low and phone Medium;
#  - each mountain's best 30 s in motion on Ultra (motion30.js on a virtual clock), encoded to MP4.
#   scripts/playtest/captures-r7.sh http://127.0.0.1:4536/ shots/r7/final <frames scratch dir>
B="$1"
OUT="$2"
SCRATCH="$3"
ROOT="$(pwd -W 2>/dev/null || pwd)"
mkdir -p "$OUT/moments" "$OUT/motion" "$SCRATCH"
RUNS="[$(for m in 0 1 2 3 4; do for v in 0 1 2; do printf "{m:$m,variant:$v,legend:$(( v % 2 + 1 ))},"; done; done)]"
moments() {
  s=$1; cfg=$2; tier=$3
  playwright-cli -s="$s" open --config="$cfg" >/dev/null 2>&1
  playwright-cli -s="$s" goto "$B" >/dev/null 2>&1
  playwright-cli -s="$s" eval "window.__mrCfg = { base: '$B', out: '$ROOT/$OUT/moments', tier: '$tier', runs: $RUNS }" >/dev/null 2>&1
  playwright-cli -s="$s" --raw run-code --filename=scripts/playtest/moments-r7.js > "$OUT/moments-$s-$tier.json" 2>&1
  playwright-cli -s="$s" close >/dev/null 2>&1
  echo "$(date +%H:%M) moments $s $tier"
}
# Each mountain's window: the pool run replayed (a clear, finished run with no fall) and where its 30 s start.
motion() {
  s=$1; shift
  playwright-cli -s="$s" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
  for spec in "$@"; do
    IFS=: read -r m demo z0 name <<< "$spec"
    dir="$SCRATCH/m$m"
    rm -rf "$dir"; mkdir -p "$dir"
    playwright-cli -s="$s" goto "$B" >/dev/null 2>&1
    playwright-cli -s="$s" eval "window.__m30Cfg = { base: '$B', out: '$dir/', m: $m, demo: $demo, z0: $z0 }" >/dev/null 2>&1
    timeout 2400 playwright-cli -s="$s" --raw run-code --filename=scripts/playtest/motion30.js > "$OUT/motion/m$m-$name.json" 2>&1
    node scripts/playtest/encode-motion.mjs "$dir" "$OUT/motion/m$m-$name.mp4" >> "$OUT/motion/m$m-$name.json" 2>&1
    echo "$(date +%H:%M) motion m$m $name"
  done
  playwright-cli -s="$s" close >/dev/null 2>&1
}
{
  FRAMES_SESSION=cap-desk scripts/playtest/frames.sh "$B" "$ROOT/$OUT" desk "high medium low" "0 1 2 3 4"
  moments cap-desk .playwright/cli-headless.config.json high
  motion cap-desk 0:0:3200:old-town-to-the-valley-leap 1:1:2950:cavern-to-dawn 2:0:2150:caldera-leap-and-basalt-halls
} > "$OUT/lane-desk.log" 2>&1 &
{
  FRAMES_SESSION=cap-phone scripts/playtest/frames.sh "$B" "$ROOT/$OUT" phone "medium" "0 1 2 3 4"
  moments cap-phone .playwright/mobile-headless.config.json medium
  moments cap-low .playwright/cli-headless.config.json low
  motion cap-mo 3:0:2150:blossom-leap-and-torii 4:0:1300:the-break-and-the-lamp-road
} > "$OUT/lane-phone.log" 2>&1 &
wait
echo done
