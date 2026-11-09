#!/usr/bin/env bash
# Round 6's performance run, with nothing else on the machine: Low at 6x on a very first run, five passes a build
# interleaved (A B B A A B B A A B); then the README table's desktop plan once a build; the phone plan once a
# build; and the first rendered frame at 6x on a fresh save, four rounds interleaved.
#   scripts/playtest/perf-r6.sh http://127.0.0.1:4310/ http://127.0.0.1:4320/ shots/r6/perf
A="$1"
B="$2"
OUT="$3"
mkdir -p "$OUT"
LOW="[{name:'low-6x-a',tier:'low',throttle:6,m:0,seconds:45},{name:'low-6x-b',tier:'low',throttle:6,m:2,seconds:45},{name:'low-6x-c',tier:'low',throttle:6,m:3,seconds:45}]"
DESK="[{name:'high-m0',tier:'high',throttle:1,m:0,seconds:150},{name:'high-m1',tier:'high',throttle:1,m:1,seconds:150},{name:'medium-m0',tier:'medium',throttle:1,m:0,seconds:150},{name:'medium-m2',tier:'medium',throttle:1,m:2,seconds:150},{name:'high-lantern',tier:'high',throttle:1,m:3,mood:2,seconds:60},{name:'high-avalanche-4x',tier:'high',throttle:4,m:0,event:1,seconds:60,chaseOnly:true}]"
PHONE="[{name:'phone-medium',tier:'medium',throttle:1,m:0,seconds:75},{name:'phone-low',tier:'low',throttle:1,m:1,seconds:60},{name:'phone-avalanche',tier:'medium',throttle:1,m:0,event:1,seconds:60,chaseOnly:true}]"
probe() {
  name=$1; base=$2; cfg=$3; plan=$4
  playwright-cli -s="$name" open --config="$cfg" >/dev/null 2>&1
  playwright-cli -s="$name" goto "$base" >/dev/null 2>&1
  playwright-cli -s="$name" eval "window.__perfCfg = { base: '$base', probes: $plan }" >/dev/null 2>&1
  playwright-cli -s="$name" run-code --filename=scripts/playtest/perf.js > "$OUT/$name.txt" 2>&1
  playwright-cli -s="$name" close >/dev/null 2>&1
}
i=0
for b in A B B A A B B A A B; do
  i=$((i+1))
  if [ "$b" = A ]; then probe "low$i-a" "$A" .playwright/cli-headless.config.json "$LOW"; else probe "low$i-b" "$B" .playwright/cli-headless.config.json "$LOW"; fi
done
probe desk-a "$A" .playwright/cli-headless.config.json "$DESK"
probe desk-b "$B" .playwright/cli-headless.config.json "$DESK"
probe phone-a "$A" .playwright/mobile-headless.config.json "$PHONE"
probe phone-b "$B" .playwright/mobile-headless.config.json "$PHONE"
playwright-cli -s=ff open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
playwright-cli -s=ff eval "window.__ffCfg = { builds: ['$A', '$B'], rounds: 4, throttle: 6, fresh: true }" >/dev/null 2>&1
playwright-cli -s=ff run-code --filename=scripts/playtest/firstframe.js > "$OUT/firstframe.txt" 2>&1
playwright-cli -s=ff close >/dev/null 2>&1
echo done
