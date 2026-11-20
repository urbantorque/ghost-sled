#!/usr/bin/env bash
# Round 8, the light lane: stills.js (a pool rider replayed on a virtual clock) at distances you name, for looking at
# a change between full stills.sh runs. Takes a browser slot for its run.
#   scripts/playtest/stills-at.sh <base> <abs out dir> <desk|phone> <tier> <m> "<z z z>" [lane] [extra url params]
BASE="$1"; OUT="$2"; DEV="$3"; T="$4"; M="$5"; ZS="$6"; LANE="${7:-light}"; EXTRA="${8:-}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="r8-at-$LANE"
J="[$(echo $ZS | tr ' ' ',')]"
mkdir -p "$OUT"
slot=$(bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" take "$LANE-at"); echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
playwright-cli -s="$S" eval "window.__stillsCfg = { base: '$BASE', out: '$OUT/', tier: '$T', m: $M, demo: 0, zs: $J, extra: '$EXTRA' }" >/dev/null 2>&1
timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/stills.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/m$M-$T.json"
playwright-cli -s="$S" close >/dev/null 2>&1
bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" give "$LANE-at"
cat "$OUT/m$M-$T.json" | head -c 600; echo
