#!/usr/bin/env bash
# The props lane's close stills (props-stills.js) on one build, as frames.sh shoots the fixed frames:
#   FRAMES_SESSION=vl-props-desk scripts/playtest/props-stills.sh http://127.0.0.1:4604/ <abs out> desk "high medium low" "0 1 2 3 4"
BASE="$1"; OUT="$2"; DEV="${3:-desk}"; TIERS="${4:-high}"; MS="${5:-0 1 2 3 4}"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="${FRAMES_SESSION:-st-$DEV}"
mkdir -p "$OUT"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
for t in $TIERS; do
  dir="$OUT/$t"; [ "$DEV" = phone ] && dir="$OUT/phone-$t"
  mkdir -p "$dir"
  for m in $MS; do
    playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__stillsCfg = { base: '$BASE', out: '$dir/', tier: '$t', ms: [$m] }" >/dev/null 2>&1
    timeout 600 playwright-cli -s="$S" --raw run-code --filename=scripts/playtest/props-stills.js 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$dir-m$m.json"
    echo "$t m$m $(ls "$dir" 2>/dev/null | grep -c "^m$m-")"
  done
done
playwright-cli -s="$S" close >/dev/null 2>&1
