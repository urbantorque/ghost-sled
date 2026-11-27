#!/usr/bin/env bash
# Round 9's Low at 6x, each pass in a fresh browser (late in a long probe list Low read a third of its fresh speed):
# the five against round 8 (Pinecrest, Ember, Sakura; A B B A A B B A), then the three new mountains beside Pinecrest on
# round 9 alone, four passes, the order turned each pass.
#   scripts/playtest/perf-r9-low.sh http://127.0.0.1:4310/ http://127.0.0.1:4311/ shots/r9/main/perf/low
A="$1"; B="$2"; OUT="$3"; mkdir -p "$OUT"
p() { echo "{name:'low-6x-m$1',tier:'low',throttle:6,m:$1,seconds:45}"; }
FIVE="[$(p 0),$(p 2),$(p 3)]"
probe() {
  s=$1; base=$2; plan=$3
  playwright-cli -s="$s" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
  playwright-cli -s="$s" goto "$base" >/dev/null 2>&1
  # (A fresh browser's first loads stall 9 to 13 s on any build: one warm load before the timed plan.)
  playwright-cli -s="$s" goto "$base?debug" >/dev/null 2>&1
  playwright-cli -s="$s" eval "window.__perfCfg = { base: '$base', probes: $plan }" >/dev/null 2>&1
  playwright-cli -s="$s" run-code --filename=scripts/playtest/perf.js > "$OUT/$s.txt" 2>&1
  playwright-cli -s="$s" close >/dev/null 2>&1
  echo "$(date +%H:%M) $s"
}
i=0
for b in A B B A A B B A; do
  i=$((i+1)); base="$A"; [ "$b" = B ] && base="$B"
  probe "five$i-$(echo $b | tr AB ab)" "$base" "$FIVE"
done
probe new1-b "$B" "[$(p 0),$(p 5),$(p 6),$(p 7)]"
probe new2-b "$B" "[$(p 7),$(p 6),$(p 5),$(p 0)]"
probe new3-b "$B" "[$(p 5),$(p 0),$(p 7),$(p 6)]"
probe new4-b "$B" "[$(p 6),$(p 7),$(p 0),$(p 5)]"
echo done > "$OUT/done"
echo done
