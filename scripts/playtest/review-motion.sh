#!/usr/bin/env bash
# The review loop's frames in motion (review-motion.js) on one build:
#   scripts/playtest/review-motion.sh http://127.0.0.1:4533/ "C:/.../pass1/motion" 3 "250 900 1790 2440 2500 4400"
BASE="$1"; OUT="$2"; M="${3:-3}"; AT="$4"
S="${FRAMES_SESSION:-rv-motion}"
mkdir -p "$OUT"
LIST="$(echo $AT | tr ' ' ',')"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__motionCfg = { base: '$BASE', out: '$OUT/', m: $M, at: [$LIST] }" >/dev/null 2>&1
timeout 400 playwright-cli -s="$S" --raw run-code --filename=scripts/playtest/review-motion.js 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT.json"
playwright-cli -s="$S" close >/dev/null 2>&1
ls "$OUT" | wc -l
