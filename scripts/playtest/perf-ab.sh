#!/usr/bin/env bash
# Interleaved performance: old build, new build, new build, old build, then the phone probes, so a drift in
# the machine lands on both. Serve both builds first, and run this with nothing else on the GPU.
#   scripts/playtest/perf-ab.sh http://127.0.0.1:4310/ http://127.0.0.1:4173/ <output folder>
A="$1"
B="$2"
OUT="$3"
mkdir -p "$OUT"
DESK="[{name:'high-m0',tier:'high',throttle:1,m:0,seconds:150},{name:'high-m1',tier:'high',throttle:1,m:1,seconds:150},{name:'medium-m0',tier:'medium',throttle:1,m:0,seconds:150},{name:'medium-m2',tier:'medium',throttle:1,m:2,seconds:150},{name:'high-lantern',tier:'high',throttle:1,m:3,mood:2,seconds:60},{name:'high-avalanche-4x',tier:'high',throttle:4,m:0,event:1,seconds:60,chaseOnly:true},{name:'low-6x-a',tier:'low',throttle:6,m:0,seconds:45},{name:'low-6x-b',tier:'low',throttle:6,m:2,seconds:45},{name:'low-6x-c',tier:'low',throttle:6,m:3,seconds:45}]"
PHONE="[{name:'phone-medium',tier:'medium',throttle:1,m:0,seconds:75},{name:'phone-low',tier:'low',throttle:1,m:1,seconds:60},{name:'phone-avalanche',tier:'medium',throttle:1,m:0,event:1,seconds:60,chaseOnly:true}]"
probe() {
  name=$1; base=$2; cfg=$3; plan=$4
  playwright-cli -s="$name" open --config="$cfg" >/dev/null 2>&1
  playwright-cli -s="$name" goto "$base" >/dev/null 2>&1
  playwright-cli -s="$name" eval "window.__perfCfg = { base: '$base', probes: $plan }" >/dev/null 2>&1
  playwright-cli -s="$name" run-code --filename=scripts/playtest/perf.js > "$OUT/$name.txt" 2>&1
  playwright-cli -s="$name" close >/dev/null 2>&1
}
probe pa1 "$A" .playwright/cli-headless.config.json "$DESK"
probe pb1 "$B" .playwright/cli-headless.config.json "$DESK"
probe pb2 "$B" .playwright/cli-headless.config.json "$DESK"
probe pa2 "$A" .playwright/cli-headless.config.json "$DESK"
probe qa1 "$A" .playwright/mobile-headless.config.json "$PHONE"
probe qb1 "$B" .playwright/mobile-headless.config.json "$PHONE"
echo done
