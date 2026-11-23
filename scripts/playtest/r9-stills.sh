#!/usr/bin/env bash
# Round 9, the "Not paintings" bar: the still set of every mountain the game registers, shot by one rule
# (r9-stills-plan.ts: the opening, a quarter, a half and three quarters of the run, the finish), each a pool rider
# replayed as the player on a virtual clock (stills.js), desk on High; then named by metre and section kind, with
# greyscale copies and a contact sheet of each (r9-stills-name.mjs). Takes the browser slot for its whole run under its
# own lane name (browser-slot.sh), so a caller that holds a slot under another name must give it back first.
#   scripts/playtest/r9-stills.sh <base> <abs out> [lane] [tier] [demo]
#   scripts/playtest/r9-stills.sh http://127.0.0.1:4910/ "C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/measure/stills" r9-measure
BASE="$1"; OUT="$2"; LANE="${3:-main}"; TIER="${4:-high}"; DEMO="${5:-0}"
HERE="$(cd "$(dirname "$0")" && pwd -W)"
ROOT="$(cd "$HERE/../.." && pwd -W)"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
S="r9-stills-$LANE"
cd "$ROOT" || exit 1
mkdir -p "$OUT/raw/$TIER"
npx tsx "$HERE/r9-stills-plan.ts" --out "$OUT/plan.json" || exit 1
slot=$(bash "$SLOT" take "$LANE-r9stills") || { echo "no slot: $slot"; exit 2; }; echo "$(date +%H:%M) took $slot"
playwright-cli -s="$S" open --config=.playwright/cli-headless.config.json >/dev/null 2>&1
# (A fresh headless browser's first loads stall 9 to 13 s: load the origin before the first still.)
playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
for m in $(node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('$OUT/plan.json','utf8'))).join(' '))"); do
  ZS=$(node -e "const p=JSON.parse(require('fs').readFileSync('$OUT/plan.json','utf8'));console.log(JSON.stringify(p['$m'].frames.map(f=>f.z)))")
  playwright-cli -s="$S" goto "$BASE" >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__stillsCfg = { base: '$BASE', out: '$OUT/raw/$TIER/', tier: '$TIER', m: $m, demo: $DEMO, zs: $ZS }" >/dev/null 2>&1
  timeout 900 playwright-cli -s="$S" --raw run-code --filename="$HERE/stills.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$OUT/raw/$TIER-m$m.json"
  echo "$(date +%H:%M) m$m $(ls "$OUT/raw/$TIER" | grep -c "^m$m-")"
done
playwright-cli -s="$S" close >/dev/null 2>&1
bash "$SLOT" give "$LANE-r9stills"
node "$HERE/r9-stills-name.mjs" --raw "$OUT/raw/$TIER" --plan "$OUT/plan.json" --out "$OUT"
