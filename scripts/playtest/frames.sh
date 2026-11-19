#!/usr/bin/env bash
# Round 7's fixed frame set on one build: every mountain on each tier named, one playwright session a
# config (run the desktop and the phone side by side, never more than two browsers at once).
#   scripts/playtest/frames.sh http://127.0.0.1:4310/ shots/r7/before desk "high medium low" "0 1 2 3"
#   scripts/playtest/frames.sh http://127.0.0.1:4310/ shots/r7/before phone "medium" "0 1 2 3"
# FRAMES_SESSION names the playwright session; FRAMES_HOLD=true shoots each frame on the frame the run reaches it
# (frames.js `hold`), for a loaded machine.
BASE="$1"; OUT="$2"; DEV="${3:-desk}"; TIERS="${4:-high}"; MS="${5:-0 1 2 3}"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="${FRAMES_SESSION:-fr-$DEV}"
mkdir -p "$OUT"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
for t in $TIERS; do
  dir="$OUT/$t"; [ "$DEV" = phone ] && dir="$OUT/phone-$t"
  for m in $MS; do
    AT="null"; [ -f scripts/playtest/frames-r7.json ] && AT="$(cat scripts/playtest/frames-r7.json)"
    playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__framesCfg = { base: '$BASE', out: '$dir/', tier: '$t', ms: [$m], at: $AT, hold: ${FRAMES_HOLD:-false} }" >/dev/null 2>&1
    timeout 600 playwright-cli -s="$S" --raw run-code --filename=scripts/playtest/frames.js 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$dir-m$m.json"
    echo "$t m$m $(ls "$dir" 2>/dev/null | grep -c "^m$m-")"
  done
done
playwright-cli -s="$S" close >/dev/null 2>&1
