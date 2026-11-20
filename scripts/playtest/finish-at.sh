#!/usr/bin/env bash
# Round 8, the light lane: finish.js (the last lip, the town, the line, the coast, the stop and the results) on the
# mountains you name, in one browser slot.
#   scripts/playtest/finish-at.sh <base> <abs out dir> <tier> "<m m>" [lane] [desk|phone]
BASE="$1"; OUT="$2"; T="$3"; MS="$4"; LANE="${5:-light}"; DEV="${6:-desk}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="r8-fin-$LANE"
J="[$(for m in $MS; do printf '{ m: %s, mood: 0 },' "$m"; done)]"
mkdir -p "$OUT"
slot=$(bash "$HERE/slot-take.sh" "$LANE-fin") || { echo "no slot: $slot"; exit 2; }
echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__finishCfg = { base: '$BASE', out: '$OUT/', tier: '$T', jobs: $J }" >/dev/null 2>&1
timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/finish.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/finish-$T.json"
playwright-cli -s="$S" close >/dev/null 2>&1
bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" give "$LANE-fin"
head -c 600 "$OUT/finish-$T.json"; echo
