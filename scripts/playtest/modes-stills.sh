#!/usr/bin/env bash
# Round 8, the modes lane: mirrored stills (stills.js with &mirror) at the places lettering and glyphs stand: the start,
# the first charm gate coming up, a stretch of the run, the second gate, the finish board coming up and the town
# past the line. Takes a browser slot for its whole run.
#   scripts/playtest/modes-stills.sh <base> <abs out> <desk|phone> "<tiers>" "<mountains>" [extra] [zs]
BASE="$1"; OUT="$2"; DEV="${3:-desk}"; TIERS="${4:-high}"; MS="${5:-0 1 2 3 4}"; EXTRA="${6:-&mirror}"; ZS="${7:-[24, 70, 300, 1500, 4430, 4520]}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="r8-modes"
slot=$(bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" take modes); echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
for t in $TIERS; do
  dir="$OUT/$t"; [ "$DEV" = phone ] && dir="$OUT/phone-$t"
  mkdir -p "$dir"
  for m in $MS; do
    playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__stillsCfg = { base: '$BASE', out: '$dir/', tier: '$t', m: $m, demo: 0, zs: $ZS, extra: '$EXTRA' }" >/dev/null 2>&1
    timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/stills.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$dir-m$m.json"
    echo "$(date +%H:%M) $t m$m $(ls "$dir" 2>/dev/null | grep -c "^m$m-") $(head -c 300 "$dir-m$m.json")"
  done
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" give modes
echo done
