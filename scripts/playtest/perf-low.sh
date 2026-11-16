#!/usr/bin/env bash
# Low at 6x on a very first run, two builds interleaved (A B B A A B B A A B): Pinecrest, Ember and Sakura, 45 s
# each, as perf-r7.sh's first part. For rechecking the Low bar alone after a change.
#   scripts/playtest/perf-low.sh http://127.0.0.1:4310/ http://127.0.0.1:4536/ shots/r7/perf/low2
A="$1"; B="$2"; OUT="$3"; mkdir -p "$OUT"
LOW="[{name:'low-6x-a',tier:'low',throttle:6,m:0,seconds:45},{name:'low-6x-b',tier:'low',throttle:6,m:2,seconds:45},{name:'low-6x-c',tier:'low',throttle:6,m:3,seconds:45}]"
i=0
for b in A B B A A B B A A B; do
  i=$((i+1)); base="$A"; [ "$b" = B ] && base="$B"
  s="low$i-$(echo $b | tr AB ab)"
  playwright-cli -s="$s" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
  playwright-cli -s="$s" goto "$base" >/dev/null 2>&1
  playwright-cli -s="$s" eval "window.__perfCfg = { base: '$base', probes: $LOW }" >/dev/null 2>&1
  playwright-cli -s="$s" run-code --filename=scripts/playtest/perf.js > "$OUT/$s.txt" 2>&1
  playwright-cli -s="$s" close >/dev/null 2>&1
  echo "$(date +%H:%M) $s"
done
echo done
