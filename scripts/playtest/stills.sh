#!/usr/bin/env bash
# Round 8: the fixed frame list (frames-r7.json) shot as stills that hold the run still (stills.js: a pool rider
# replayed on a virtual clock, the same tick on any build with the same sim and pools), for blind pairs. Takes a
# browser slot for its whole run (browser-slot.sh).
#   scripts/playtest/stills.sh <base> <abs out> <desk|phone> "<tiers>" "<mountains>" [lane] [demo]
#   scripts/playtest/stills.sh http://127.0.0.1:4860/ "C:/.../shots/r8/stills-before" desk "high low" "0 1 2 3 4" main
BASE="$1"; OUT="$2"; DEV="${3:-desk}"; TIERS="${4:-high}"; MS="${5:-0 1 2 3 4}"; LANE="${6:-main}"; DEMO="${7:-0}"
HERE="$(cd "$(dirname "$0")" && pwd)"
CFG=.playwright/cli-headless.config.json; [ "$DEV" = phone ] && CFG=.playwright/mobile-headless.config.json
S="r8-stills-$LANE-$DEV"
slot=$(bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" take "$LANE-stills"); echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
for t in $TIERS; do
  dir="$OUT/$t"; [ "$DEV" = phone ] && dir="$OUT/phone-$t"
  mkdir -p "$dir"
  for m in $MS; do
    ZS=$(node -e "const l=JSON.parse(require('fs').readFileSync('$HERE/frames-r7.json','utf8'))[String($m)]||[];console.log(JSON.stringify(l.map(f=>f.z)))")
    playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
    playwright-cli -s="$S" eval "window.__stillsCfg = { base: '$BASE', out: '$dir/', tier: '$t', m: $m, demo: $DEMO, zs: $ZS }" >/dev/null 2>&1
    timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/stills.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$dir-m$m.json"
    echo "$(date +%H:%M) $t m$m $(ls "$dir" 2>/dev/null | grep -c "^m$m-")"
  done
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh" give "$LANE-stills"
echo done
