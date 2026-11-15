#!/usr/bin/env bash
# Round 7's performance run against round 6, with nothing else on the machine (no lanes, no browser-pane tabs,
# one playwright browser at a time): Low at 6x on a very first run, five passes a build interleaved
# (A B B A A B B A A B); the desktop plan once a build (High on four mountains, Medium on two, a lantern night,
# the avalanche at 4x); the phone plan once a build; the new build's own plan (Lanternfall on every tier, Ultra,
# Low at 6x on Lanternfall), which round 6 cannot run; and the first rendered frame at 6x on a fresh save, four
# rounds interleaved.
#   scripts/playtest/perf-r7.sh http://127.0.0.1:4310/ http://127.0.0.1:4536/ shots/r7/perf
A="$1"
B="$2"
OUT="$3"
mkdir -p "$OUT"
LOW="[{name:'low-6x-a',tier:'low',throttle:6,m:0,seconds:45},{name:'low-6x-b',tier:'low',throttle:6,m:2,seconds:45},{name:'low-6x-c',tier:'low',throttle:6,m:3,seconds:45}]"
DESK="[{name:'high-m0',tier:'high',throttle:1,m:0,seconds:150},{name:'high-m1',tier:'high',throttle:1,m:1,seconds:150},{name:'high-m2',tier:'high',throttle:1,m:2,seconds:150},{name:'high-m3',tier:'high',throttle:1,m:3,seconds:150},{name:'medium-m0',tier:'medium',throttle:1,m:0,seconds:150},{name:'medium-m2',tier:'medium',throttle:1,m:2,seconds:150},{name:'high-lantern',tier:'high',throttle:1,m:3,mood:2,seconds:60},{name:'high-avalanche-4x',tier:'high',throttle:4,m:0,event:1,seconds:60,chaseOnly:true}]"
PHONE="[{name:'phone-medium',tier:'medium',throttle:1,m:0,seconds:75},{name:'phone-low',tier:'low',throttle:1,m:1,seconds:60},{name:'phone-avalanche',tier:'medium',throttle:1,m:0,event:1,seconds:60,chaseOnly:true}]"
NEW="[{name:'high-m4',tier:'high',throttle:1,m:4,seconds:150},{name:'medium-m4',tier:'medium',throttle:1,m:4,seconds:120},{name:'medium-m1',tier:'medium',throttle:1,m:1,seconds:120},{name:'medium-m3',tier:'medium',throttle:1,m:3,seconds:120},{name:'ultra-m0',tier:'ultra',throttle:1,m:0,seconds:90},{name:'ultra-m4',tier:'ultra',throttle:1,m:4,seconds:90},{name:'low-6x-m4',tier:'low',throttle:6,m:4,seconds:45},{name:'low-6x-m1',tier:'low',throttle:6,m:1,seconds:45}]"
PHONENEW="[{name:'phone-medium-m4',tier:'medium',throttle:1,m:4,seconds:75},{name:'phone-low-m4',tier:'low',throttle:1,m:4,seconds:60}]"
probe() {
  name=$1; base=$2; cfg=$3; plan=$4
  playwright-cli -s="$name" open --config="$cfg" >/dev/null 2>&1
  playwright-cli -s="$name" goto "$base" >/dev/null 2>&1
  playwright-cli -s="$name" eval "window.__perfCfg = { base: '$base', probes: $plan }" >/dev/null 2>&1
  playwright-cli -s="$name" run-code --filename=scripts/playtest/perf.js > "$OUT/$name.txt" 2>&1
  playwright-cli -s="$name" close >/dev/null 2>&1
  echo "$(date +%H:%M) $name"
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
probe new-b "$B" .playwright/cli-headless.config.json "$NEW"
probe phonenew-b "$B" .playwright/mobile-headless.config.json "$PHONENEW"
playwright-cli -s=ff open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
playwright-cli -s=ff eval "window.__ffCfg = { builds: ['$A', '$B'], rounds: 4, throttle: 6, fresh: true }" >/dev/null 2>&1
playwright-cli -s=ff run-code --filename=scripts/playtest/firstframe.js > "$OUT/firstframe.txt" 2>&1
playwright-cli -s=ff close >/dev/null 2>&1
echo done
