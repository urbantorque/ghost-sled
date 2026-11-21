#!/usr/bin/env bash
# Round 8, the modes lane: one browser slot for the UI pass (modes-ui.js) and a browser-ridden Long Night
# (modes-night.js), desk or phone.
#   scripts/playtest/modes-batch.sh <base> <abs out> <desk|phone> <tier> [legs] [what: "ui night"]
BASE="$1"; OUT="$2"; DEV="${3:-desk}"; TIER="${4:-high}"; LEGS="${5:-3}"; WHAT="${6:-ui night}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="r8-modes"
mkdir -p "$OUT/ui" "$OUT/night-$DEV-$TIER"
slot=$(bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" take modes); echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
for w in $WHAT; do
  playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
  if [ "$w" = ui ]; then
    playwright-cli -s="$S" eval "window.__uiCfg = { base: '$BASE', out: '$OUT/ui/', tier: '$TIER', page: 30, tag: '$DEV-$TIER' }" >/dev/null 2>&1
    timeout 600 playwright-cli -s="$S" --raw run-code --filename="$HERE/modes-ui.js" > "$OUT/ui/$DEV-$TIER.json" 2>&1
    echo "$(date +%H:%M) ui $(head -c 1500 "$OUT/ui/$DEV-$TIER.json")"
  else
    playwright-cli -s="$S" eval "window.__nightCfg = { base: '$BASE', out: '$OUT/night-$DEV-$TIER/', tier: '$TIER', legs: $LEGS }" >/dev/null 2>&1
    timeout 1500 playwright-cli -s="$S" --raw run-code --filename="$HERE/modes-night.js" > "$OUT/night-$DEV-$TIER/night.json" 2>&1
    echo "$(date +%H:%M) night $(wc -c < "$OUT/night-$DEV-$TIER/night.json") bytes"
  fi
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" give modes
echo done
