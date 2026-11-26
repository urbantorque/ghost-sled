#!/usr/bin/env bash
# Round 9, the g6 lane: the race-distance sheets (r9-g6-sheet.js, the shop lane's r9-g6-sheet.js over the shelves as
# G6 left them) in one headless browser on the dev server at 5010. Takes the machine's one browser slot as g6 (or
# R9_LANE) and gives it back at the end. Sheets go to the main checkout's shots/r9/g6/sheet<R9_ROUND>/, each shelf's
# key to keys/ beside them (never shown to a critic).
#   R9_ROUND=1 scripts/playtest/r9-g6-sheet.sh hats scarves
# (R9_TIER=medium shoots at another tier; R9_NOHEAT=true takes the drift's heat out of the spray, for the probe.)
SHELVES="$*"
ROOT="$(cd "$(dirname "$0")/../.." && pwd -W)"
OUT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/g6/sheet${R9_ROUND:-}/"
KEYS="C:/Users/roger/OneDrive/Desktop/Ghost Sled/shots/r9/g6/keys${R9_ROUND:-}/"
BASE="${R9_BASE:-http://127.0.0.1:5010/}"
mkdir -p "$OUT/full" "$KEYS"
CFG="$ROOT/.playwright/cli-headless.config.json"
S="r9-g6"
SLOT="C:/Users/roger/OneDrive/Desktop/Ghost Sled/scripts/playtest/browser-slot.sh"
# (R9_HELD=1: the caller holds the slot already and gives it back.)
[ -n "$R9_HELD" ] || bash "$SLOT" take ${R9_LANE:-g6} >/dev/null || { echo "no slot"; exit 2; }
echo "$(date +%H:%M:%S) took the slot"
playwright-cli -s="$S" open --config="$CFG" >/dev/null 2>&1
# A fresh browser's first loads stall 9 to 13 s: load the origin once before anything is judged.
playwright-cli -s="$S" goto "${BASE}?debug" >/dev/null 2>&1
sleep 12
for shelf in $SHELVES; do
  playwright-cli -s="$S" goto about:blank >/dev/null 2>&1
  playwright-cli -s="$S" eval "window.__sheetCfg = { base: '$BASE', out: '$OUT', shelves: ['$shelf'], z: ${R9_Z:-300}, z0: $(( ${R9_Z:-300} - 100 )), tier: '${R9_TIER:-high}', noHeat: ${R9_NOHEAT:-false} }" >/dev/null 2>&1
  timeout 1800 playwright-cli -s="$S" --raw run-code --filename="$ROOT/scripts/playtest/r9-g6-sheet.js" 2>&1 | grep -v '^[╔║╚]' | grep -v '^$' > "$KEYS/key-$shelf.json"
  echo "$(date +%H:%M:%S) $shelf $(head -c 300 "$KEYS/key-$shelf.json")"
done
playwright-cli -s="$S" close >/dev/null 2>&1
[ -n "$R9_HELD" ] || bash "$SLOT" give ${R9_LANE:-g6} >/dev/null
echo "$(date +%H:%M:%S) gave the slot back"
