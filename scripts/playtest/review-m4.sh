#!/usr/bin/env bash
# The m4 review lane's extra frames on one build: review-m4.js (a pool rider's run, the gutter, the title)
# and the two legends (legends-r7.js), into <out>/<tier>-motion and <out>/<tier>-legends.
#   scripts/playtest/review-m4.sh http://127.0.0.1:4534/ "C:/.../shots/r7/review/m4/pass1" high
BASE="$1"; OUT="$2"; T="${3:-high}"; LG="${4:-1}"; S="${FRAMES_SESSION:-r7-review-m4}"
mkdir -p "$OUT/$T-motion" "$OUT/$T-legends"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__rvCfg = { base: '$BASE', out: '$OUT/$T-motion/', tier: '$T' }" >/dev/null 2>&1
timeout 580 playwright-cli -s="$S" --raw run-code --filename=scripts/playtest/review-m4.js 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/$T-motion.json"
echo "motion $(ls "$OUT/$T-motion" | wc -l)"
if [ "$LG" = 1 ]; then
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__lgCfg = { base: '$BASE', out: '$OUT/$T-legends', tier: '$T', runs: [{ m: 4, legend: 1 }, { m: 4, legend: 2 }] }" >/dev/null 2>&1
timeout 400 playwright-cli -s="$S" --raw run-code --filename=scripts/playtest/legends-r7.js 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/$T-legends.json"
echo "legends $(ls "$OUT/$T-legends" | wc -l)"
fi
playwright-cli -s="$S" close >/dev/null 2>&1
