#!/usr/bin/env bash
# Round 9's perf sitting (M4): first the five against round 8 on every tier and the phone (perf-ab.sh, A B B A),
# then the three new mountains beside Pinecrest on round 9 alone, every tier and the phone, two passes interleaved.
# Serve both builds first (vite preview), nothing else on the GPU, on mains power, the machine held awake.
#   scripts/playtest/perf-r9.sh http://127.0.0.1:4310/ http://127.0.0.1:4311/ shots/r9/main/perf
A="$1"; B="$2"; OUT="$3"; mkdir -p "$OUT/ab" "$OUT/eight"
echo "$(date +%H:%M) part 1: the five against round 8"
bash scripts/playtest/perf-ab.sh "$A" "$B" "$OUT/ab"
mk() { # tier throttle seconds prefix -> a probe each for Pinecrest and the three new mountains
  local t=$1 k=$2 s=$3 p=$4 out=""
  for m in 0 5 6 7; do out="$out{name:'$p-m$m',tier:'$t',throttle:$k,m:$m,seconds:$s},"; done
  echo "${out%,}"
}
DESK="[$(mk ultra 1 45 ultra),$(mk high 1 45 high),$(mk medium 1 45 medium),$(mk low 6 45 low-6x)]"
PHONE="[$(mk medium 1 45 phone-medium),$(mk low 1 45 phone-low)]"
probe() {
  name=$1; cfg=$2; plan=$3
  playwright-cli -s="$name" open --config="$cfg" >/dev/null 2>&1
  playwright-cli -s="$name" goto "$B" >/dev/null 2>&1
  playwright-cli -s="$name" eval "window.__perfCfg = { base: '$B', probes: $plan }" >/dev/null 2>&1
  playwright-cli -s="$name" run-code --filename=scripts/playtest/perf.js > "$OUT/eight/$name.txt" 2>&1
  playwright-cli -s="$name" close >/dev/null 2>&1
  echo "$(date +%H:%M) $name"
}
echo "$(date +%H:%M) part 2: the eight on round 9"
probe e1 .playwright/cli-headless.config.json "$DESK"
probe f1 .playwright/mobile-headless.config.json "$PHONE"
probe e2 .playwright/cli-headless.config.json "$DESK"
probe f2 .playwright/mobile-headless.config.json "$PHONE"
echo done > "$OUT/done"
echo done
